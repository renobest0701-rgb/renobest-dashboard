import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACT_PROMPT = `あなたは不動産物件情報の抽出専門AIです。
添付されたPDFから以下のJSONを生成してください。

【重要】
- HTMLは絶対に生成しない
- 不明な項目は null にする
- 4言語テキストは物件の魅力が伝わるよう自然な表現で
- 画像スロット候補は、PDFの何ページ目のどの画像がそのスロットに適切か提案する

以下のJSONスキーマに従ってください:
{
  "property_name": "物件名（英数字・小文字・アンダースコアのみのslugも含む）",
  "property_slug": "slug（英数字・小文字・アンダースコアのみ）",
  "price": "価格表示",
  "address": "住所",
  "access": "交通アクセス",
  "area": "専有面積",
  "layout": "間取り",
  "built": "築年月",
  "structure": "構造",
  "management_fee": "管理費",
  "repair_fee": "修繕積立金",
  "parking": "駐車場",
  "pet": "ペット可否",
  "developer": "分譲会社",
  "total_units": "総戸数",
  "floor": "階数",
  "catchcopy": "キャッチコピー（日本語・短く印象的に）",
  "subtitle": "サブタイトル",
  "recommend_comment": "おすすめコメント",
  "facilities": ["施設・設備リスト"],
  "rooms": ["部屋構成リスト"],
  "equipment": ["設備リスト"],
  "recommend_points": ["おすすめポイント（3〜5個）"],
  "summary": "物件概要（2〜3文）",
  "plan_highlight": "間取りのポイント",
  "stage_title": "ステージタイトル",
  "stage_body": "ステージ本文",
  "texts": {
    "ja": {
      "catchcopy": "キャッチコピー",
      "summary": "概要",
      "recommend_comment": "おすすめコメント",
      "stage_body": "ステージ本文"
    },
    "en": {
      "catchcopy": "Catchcopy in English",
      "summary": "Summary in English",
      "recommend_comment": "Recommend comment in English",
      "stage_body": "Stage body in English"
    },
    "zh-cn": {
      "catchcopy": "简体中文キャッチコピー",
      "summary": "简体中文概要",
      "recommend_comment": "简体中文おすすめ",
      "stage_body": "简体中文本文"
    },
    "zh-tw": {
      "catchcopy": "繁體中文キャッチコピー",
      "summary": "繁體中文概要",
      "recommend_comment": "繁體中文おすすめ",
      "stage_body": "繁體中文本文"
    }
  },
  "image_slot_candidates": {
    "hero": "ページ番号と位置の説明",
    "lifestyle": "ページ番号と位置の説明",
    "floorplan": "間取り図のみ（販売図面全体ではない）のページ番号と位置",
    "area0": "エリア写真候補",
    "area1": "エリア写真候補",
    "area2": "エリア写真候補",
    "common0": "共用部写真候補",
    "common1": "共用部写真候補",
    "common2": "共用部写真候補"
  },
  "missing_fields": ["不足している情報のリスト"]
}

JSONのみを返してください。説明文・マークダウンコードブロック・前置きは不要です。`

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const pdfFile = formData.get('pdf') as File | null

  if (!pdfFile) {
    return NextResponse.json({ error: 'PDFファイルが必要です' }, { status: 400 })
  }

  if (pdfFile.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'PDFは20MB以下にしてください' }, { status: 400 })
  }

  const pdfBuffer = await pdfFile.arrayBuffer()
  const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: EXTRACT_PROMPT,
            },
          ],
        },
      ],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'AI応答のJSON解析に失敗しました', raw }, { status: 500 })
    }

    return NextResponse.json({ extracted })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import fs from 'fs/promises'
import path from 'path'

// テンプレートの許可された差し替えキー一覧
const ALLOWED_KEYS = [
  'property_name', 'property_slug', 'price', 'address', 'access',
  'area', 'layout', 'built', 'structure', 'management_fee', 'repair_fee',
  'parking', 'pet', 'developer', 'total_units', 'floor',
  'catchcopy', 'subtitle', 'recommend_comment',
  'facilities', 'rooms', 'equipment', 'recommend_points',
  'summary', 'plan_highlight', 'stage_title', 'stage_body',
  'ja_catchcopy', 'ja_summary', 'ja_recommend_comment', 'ja_stage_body',
  'en_catchcopy', 'en_summary', 'en_recommend_comment', 'en_stage_body',
  'zhcn_catchcopy', 'zhcn_summary', 'zhcn_recommend_comment', 'zhcn_stage_body',
  'zhtw_catchcopy', 'zhtw_summary', 'zhtw_recommend_comment', 'zhtw_stage_body',
  'img_hero', 'img_lifestyle', 'img_floorplan',
  'img_area0', 'img_area1', 'img_area2',
  'img_common0', 'img_common1', 'img_common2',
  'img_logo', 'img_qr_line', 'img_qr_wechat',
  // 連絡先
  'company_name', 'agent_display', 'tel', 'mail', 'web', 'inquiry_url',
]

// 顧客用HTMLから除去するパターン
const CUSTOMER_REMOVE_PATTERNS = [
  /<input[^>]*type=['"]file['"][^>]*\/?>/gi,
  /contenteditable=['"][^'"]*['"]/gi,
  /onclick=['"][^'"]*setupImgReplace[^'"]*['"]/gi,
  /onclick=['"][^'"]*saveHTML[^'"]*['"]/gi,
  /onclick=['"][^'"]*saveForCustomer[^'"]*['"]/gi,
  /onclick=['"][^'"]*generateDM[^'"]*['"]/gi,
  /document\.getElementById\(['"]fi-[^)]+\)/g,
  /function setupImgReplace[\s\S]*?^}/gm,
  /<!--\s*admin[^>]*-->[\s\S]*?<!--\s*\/admin[^>]*-->/gi,
  /class=['"][^'"]*preview_check[^'"]*['"]/gi,
  // DMボタン・HTML保存ボタン・顧客用保存ボタンを含むbutton要素を除去
  /<button[^>]*>[^<]*(?:generateDM|saveHTML|saveForCustomer|DM作成|HTML保存|顧客用保存)[^<]*<\/button>/gi,
  // 管理者用ヒントブロック
  /<div[^>]*class=['"][^'"]*admin-hint[^'"]*['"][^>]*>[\s\S]*?<\/div>/gi,
  // 画像変更オーバーレイ
  /<div[^>]*class=['"][^'"]*img-replace-overlay[^'"]*['"][^>]*>[\s\S]*?<\/div>/gi,
]

function applyCustomerRestrictions(html: string): string {
  let result = html
  for (const pattern of CUSTOMER_REMOVE_PATTERNS) {
    result = result.replace(pattern, '')
  }
  return result
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '') // 全角・日本語除去
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'property'
}

function replaceSlots(template: string, replacements: Record<string, string>): string {
  let result = template
  for (const key of ALLOWED_KEYS) {
    const value = replacements[key]
    if (value === undefined) continue
    // {{key}} 形式のプレースホルダーを置換
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    extracted: Record<string, unknown>
    images: Record<string, string>
    slug?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストが不正です' }, { status: 400 })
  }

  const { extracted, images, slug: rawSlug } = body
  const slug = slugify(rawSlug || String(extracted?.property_slug || extracted?.property_name || 'property'))

  // テンプレートファイル読み込み
  const templatesDir = path.join(process.cwd(), 'templates')
  let adminTemplate: string
  let customerTemplate: string

  try {
    adminTemplate = await fs.readFile(path.join(templatesDir, 'proposal_template_base.html'), 'utf-8')
    customerTemplate = await fs.readFile(path.join(templatesDir, 'proposal_template_base_customer.html'), 'utf-8')
  } catch {
    return NextResponse.json({
      error: 'テンプレートファイルが見つかりません。templates/proposal_template_base.html と proposal_template_base_customer.html を配置してください。'
    }, { status: 500 })
  }

  // テキスト差し替えマップ構築
  const texts = extracted.texts as Record<string, Record<string, string>> | undefined
  const replacements: Record<string, string> = {
    property_name: String(extracted.property_name ?? ''),
    property_slug: slug,
    price: String(extracted.price ?? ''),
    address: String(extracted.address ?? ''),
    access: String(extracted.access ?? ''),
    area: String(extracted.area ?? ''),
    layout: String(extracted.layout ?? ''),
    built: String(extracted.built ?? ''),
    structure: String(extracted.structure ?? ''),
    management_fee: String(extracted.management_fee ?? ''),
    repair_fee: String(extracted.repair_fee ?? ''),
    parking: String(extracted.parking ?? ''),
    pet: String(extracted.pet ?? ''),
    developer: String(extracted.developer ?? ''),
    total_units: String(extracted.total_units ?? ''),
    floor: String(extracted.floor ?? ''),
    catchcopy: String(extracted.catchcopy ?? ''),
    subtitle: String(extracted.subtitle ?? ''),
    recommend_comment: String(extracted.recommend_comment ?? ''),
    facilities: Array.isArray(extracted.facilities)
      ? (extracted.facilities as string[]).map(f => `<div class="fac-item"><span class="ck">✓</span><span>${f}</span></div>`).join('')
      : String(extracted.facilities ?? ''),
    rooms: Array.isArray(extracted.rooms)
      ? (extracted.rooms as string[]).map(r => {
          // "名前 面積" or "名前　面積" を分離（スペース区切り）
          const m = r.match(/^(.+?)\s+([\d.]+[㎡帖畳坪][^\s]*)$/)
          if (m) return `<div class="room-row"><div><span class="room-n">${m[1]}</span></div><span class="room-s">${m[2]}</span></div>`
          return `<div class="room-row"><div><span class="room-n">${r}</span></div></div>`
        }).join('')
      : String(extracted.rooms ?? ''),
    equipment: Array.isArray(extracted.equipment)
      ? (extracted.equipment as string[]).map(e => `<div class="eq-item"><span class="ck">✓</span><span>${e}</span></div>`).join('')
      : String(extracted.equipment ?? ''),
    recommend_points: Array.isArray(extracted.recommend_points)
      ? (extracted.recommend_points as string[]).map((p, i) => `<li><span class="rec-num">0${i+1}</span><div><div class="rec-desc">${p}</div></div></li>`).join('')
      : '',
    summary: String(extracted.summary ?? ''),
    plan_highlight: String(extracted.plan_highlight ?? ''),
    stage_title: String(extracted.stage_title ?? ''),
    stage_body: String(extracted.stage_body ?? ''),
    // 4言語
    ja_catchcopy: texts?.ja?.catchcopy ?? String(extracted.catchcopy ?? ''),
    ja_summary: texts?.ja?.summary ?? String(extracted.summary ?? ''),
    ja_recommend_comment: texts?.ja?.recommend_comment ?? String(extracted.recommend_comment ?? ''),
    ja_stage_body: texts?.ja?.stage_body ?? String(extracted.stage_body ?? ''),
    en_catchcopy: texts?.en?.catchcopy ?? '',
    en_summary: texts?.en?.summary ?? '',
    en_recommend_comment: texts?.en?.recommend_comment ?? '',
    en_stage_body: texts?.en?.stage_body ?? '',
    zhcn_catchcopy: texts?.['zh-cn']?.catchcopy ?? '',
    zhcn_summary: texts?.['zh-cn']?.summary ?? '',
    zhcn_recommend_comment: texts?.['zh-cn']?.recommend_comment ?? '',
    zhcn_stage_body: texts?.['zh-cn']?.stage_body ?? '',
    zhtw_catchcopy: texts?.['zh-tw']?.catchcopy ?? '',
    zhtw_summary: texts?.['zh-tw']?.summary ?? '',
    zhtw_recommend_comment: texts?.['zh-tw']?.recommend_comment ?? '',
    zhtw_stage_body: texts?.['zh-tw']?.stage_body ?? '',
    // 画像スロット
    img_hero: images?.hero ?? '',
    img_lifestyle: images?.lifestyle ?? '',
    img_floorplan: images?.floorplan ?? '',
    img_area0: images?.area0 ?? '',
    img_area1: images?.area1 ?? '',
    img_area2: images?.area2 ?? '',
    img_common0: images?.common0 ?? '',
    img_common1: images?.common1 ?? '',
    img_common2: images?.common2 ?? '',
    img_logo: images?.logo ?? '',
    img_qr_line: images?.qr_line ?? '',
    img_qr_wechat: images?.qr_wechat ?? '',
    // 連絡先（デフォルト値。将来的にウィザードで入力可能にする）
    company_name: '株式会社RENOBEST',
    agent_display: '山田正文',
    tel: '要入力',
    mail: '要入力',
    web: '要入力',
    inquiry_url: '要入力',
  }

  const adminHtml = replaceSlots(adminTemplate, replacements)
  const customerHtmlRaw = replaceSlots(customerTemplate, replacements)
  const customerHtml = applyCustomerRestrictions(customerHtmlRaw)

  return NextResponse.json({
    slug,
    admin_filename: `gest_${slug}.html`,
    customer_filename: `gest_${slug}_customer.html`,
    admin_html: adminHtml,
    customer_html: customerHtml,
  })
}

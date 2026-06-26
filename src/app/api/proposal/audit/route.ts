import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

interface AuditItem {
  key: string
  label: string
  count: number
  status: 'ok' | 'ng' | 'warn'
  detail?: string
}

function countPattern(html: string, pattern: RegExp): number {
  return (html.match(pattern) ?? []).length
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { admin_html, customer_html, slug } = await req.json() as {
    admin_html: string
    customer_html: string
    slug: string
  }

  function auditHtml(html: string, isCustomer: boolean): AuditItem[] {
    const items: AuditItem[] = []

    // 構造タグ検査はscriptブロック内を除外して行う
    const htmlWithoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '<script></script>')

    // DOCTYPE
    const doctypeCount = countPattern(htmlWithoutScripts, /<!DOCTYPE/gi)
    items.push({
      key: 'doctype',
      label: 'DOCTYPE数',
      count: doctypeCount,
      status: doctypeCount === 1 ? 'ok' : 'ng',
    })

    // html/head/body/script/style タグ数（script内除外済みhtmlで検査）
    for (const tag of ['html', 'head', 'body', 'script', 'style'] as const) {
      const open = countPattern(htmlWithoutScripts, new RegExp(`<${tag}[\\s>]`, 'gi'))
      items.push({
        key: `tag_${tag}`,
        label: `<${tag}>タグ数`,
        count: open,
        status: open === 1 ? 'ok' : open === 0 ? 'ng' : 'ng',
      })
    }

    // file input 残存（顧客用のみNG）
    const fileInputCount = countPattern(html, /<input[^>]*type=['"]file['"]/gi)
    items.push({
      key: 'file_input',
      label: 'file input残存',
      count: fileInputCount,
      status: isCustomer ? (fileInputCount === 0 ? 'ok' : 'ng') : 'ok',
    })

    // contenteditable 残存（顧客用のみNG）
    const ceCount = countPattern(html, /contenteditable/gi)
    items.push({
      key: 'contenteditable',
      label: 'contenteditable残存',
      count: ceCount,
      status: isCustomer ? (ceCount === 0 ? 'ok' : 'ng') : 'ok',
    })

    // onclick 残存（顧客用でsaveHTML/saveForCustomer/generateDM/setupImgReplaceがあればNG）
    const adminOnlyOnclick = countPattern(html, /onclick=['"][^'"]*(?:saveHTML|saveForCustomer|generateDM|setupImgReplace)[^'"]*['"]/gi)
    items.push({
      key: 'onclick',
      label: '管理者用onclick残存',
      count: adminOnlyOnclick,
      status: isCustomer ? (adminOnlyOnclick === 0 ? 'ok' : 'ng') : 'ok',
    })

    // 外部画像URL残存（http:// or https:// が src に残っているか確認）
    const externalImgCount = countPattern(html, /src=['"]https?:\/\//gi)
    items.push({
      key: 'external_img',
      label: '外部画像URL残存',
      count: externalImgCount,
      status: externalImgCount === 0 ? 'ok' : 'warn',
    })

    // 日本語ファイル名
    const jpFilename = countPattern(html, /src=['"][^'"]*[぀-ゟ゠-ヿ一-龯][^'"]*['"]/gi)
    items.push({
      key: 'jp_filename',
      label: '日本語ファイル名',
      count: jpFilename,
      status: jpFilename === 0 ? 'ok' : 'ng',
    })

    // 全角文字（HTMLコンテンツ部に含まれる全角スペース）
    const zenkakuSpace = countPattern(html, /　/g)
    items.push({
      key: 'zenkaku_space',
      label: '全角スペース',
      count: zenkakuSpace,
      status: zenkakuSpace === 0 ? 'ok' : 'warn',
    })

    // テンプレートプレースホルダー残存
    const placeholderCount = countPattern(html, /\{\{[a-z_]+\}\}/g)
    items.push({
      key: 'placeholder',
      label: 'テンプレート値残存 ({{...}})',
      count: placeholderCount,
      status: placeholderCount === 0 ? 'ok' : 'ng',
    })

    // footer重複
    const footerCount = countPattern(html, /<footer[\s>]/gi)
    items.push({
      key: 'footer',
      label: 'footer重複',
      count: footerCount,
      status: footerCount <= 1 ? 'ok' : 'ng',
    })

    // 画像src空チェック
    const emptySrc = countPattern(html, /src=['"]{2}/g)
    items.push({
      key: 'empty_src',
      label: '画像src空',
      count: emptySrc,
      status: emptySrc === 0 ? 'ok' : 'warn',
    })

    // data-key初期表示残存
    const dataKeyDefault = countPattern(html, /data-key=['"][^'"]+['"]\s*>[^<]*\{\{/gi)
    items.push({
      key: 'data_key_default',
      label: 'data-key初期表示残存',
      count: dataKeyDefault,
      status: dataKeyDefault === 0 ? 'ok' : 'ng',
    })

    return items
  }

  const adminItems = auditHtml(admin_html, false)
  const customerItems = auditHtml(customer_html, true)

  const adminNg = adminItems.filter(i => i.status === 'ng').length
  const customerNg = customerItems.filter(i => i.status === 'ng').length
  const passed = adminNg === 0 && customerNg === 0

  return NextResponse.json({
    passed,
    slug,
    admin: { items: adminItems, ng_count: adminNg },
    customer: { items: customerItems, ng_count: customerNg },
  })
}

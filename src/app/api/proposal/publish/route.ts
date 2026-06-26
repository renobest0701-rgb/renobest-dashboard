import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_OWNER = process.env.GITHUB_PAGES_OWNER
const GITHUB_REPO = process.env.GITHUB_PAGES_REPO
const GITHUB_BRANCH = process.env.GITHUB_PAGES_BRANCH ?? 'main'
const GITHUB_PAGES_BASE_URL = process.env.GITHUB_PAGES_BASE_URL

async function githubPutFile(path: string, content: string, message: string) {
  const encoded = Buffer.from(content, 'utf-8').toString('base64')
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`

  // 既存ファイルのSHAを取得（更新の場合に必要）
  let sha: string | undefined
  const getRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (getRes.ok) {
    const existing = await getRes.json() as { sha: string }
    sha = existing.sha
  }

  const body: Record<string, string> = {
    message,
    content: encoded,
    branch: GITHUB_BRANCH,
  }
  if (sha) body.sha = sha

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!putRes.ok) {
    const err = await putRes.text()
    throw new Error(`GitHub API error (${putRes.status}): ${err}`)
  }

  return putRes.json()
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return NextResponse.json({
      error: 'GitHub設定が未完了です。GITHUB_TOKEN / GITHUB_PAGES_OWNER / GITHUB_PAGES_REPO を .env.local に設定してください。'
    }, { status: 500 })
  }

  const { slug, admin_html, customer_html } = await req.json() as {
    slug: string
    admin_html: string
    customer_html: string
  }

  const adminFilename = `gest_${slug}.html`
  const customerFilename = `gest_${slug}_customer.html`
  const timestamp = new Date().toISOString()

  try {
    await githubPutFile(adminFilename, admin_html, `提案書生成: ${adminFilename} (${timestamp})`)
    await githubPutFile(customerFilename, customer_html, `提案書生成: ${customerFilename} (${timestamp})`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const base = GITHUB_PAGES_BASE_URL ?? `https://${GITHUB_OWNER}.github.io/${GITHUB_REPO}`
  const adminUrl = `${base}/${adminFilename}`
  const customerUrl = `${base}/${customerFilename}`

  return NextResponse.json({
    success: true,
    admin_url: adminUrl,
    customer_url: customerUrl,
    line_url: `https://line.me/R/msg/text/?${encodeURIComponent(customerUrl)}`,
    email_body: encodeURIComponent(`物件提案書をご覧ください：${customerUrl}`),
  })
}

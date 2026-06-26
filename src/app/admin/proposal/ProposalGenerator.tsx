'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Upload, FileText, Image, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, ChevronLeft, Globe, Link, Mail, Loader2,
  RefreshCw, Eye, Send, GitBranch
} from 'lucide-react'

// =============================================
// 型定義
// =============================================
type Step = 'upload' | 'extract' | 'images' | 'texts' | 'generate' | 'audit' | 'publish'

const IMAGE_SLOTS = [
  { key: 'hero',      label: 'ヒーロー画像',   required: true },
  { key: 'lifestyle', label: 'ライフスタイル', required: false },
  { key: 'floorplan', label: '間取り図（切り出し）', required: true },
  { key: 'area0',     label: 'エリア写真①',   required: false },
  { key: 'area1',     label: 'エリア写真②',   required: false },
  { key: 'area2',     label: 'エリア写真③',   required: false },
  { key: 'common0',   label: '共用部①',        required: false },
  { key: 'common1',   label: '共用部②',        required: false },
  { key: 'common2',   label: '共用部③',        required: false },
  { key: 'logo',      label: 'RENOBESTロゴ',  required: false },
  { key: 'qr_line',   label: 'LINE QR',        required: false },
  { key: 'qr_wechat', label: 'WeChat QR',      required: false },
]

const LANGS = [
  { key: 'ja',    label: '日本語' },
  { key: 'en',    label: 'English' },
  { key: 'zh-cn', label: '中文简体' },
  { key: 'zh-tw', label: '中文繁體' },
]

const TEXT_FIELDS = [
  { key: 'catchcopy',        label: 'キャッチコピー', rows: 2 },
  { key: 'summary',          label: '概要',           rows: 3 },
  { key: 'recommend_comment',label: 'おすすめコメント', rows: 3 },
  { key: 'stage_body',       label: 'ステージ本文',   rows: 4 },
]

type Extracted = Record<string, unknown>
type Texts = Record<string, Record<string, string>>
type Images = Record<string, string>

interface AuditItem {
  key: string
  label: string
  count: number
  status: 'ok' | 'ng' | 'warn'
}

interface AuditResult {
  passed: boolean
  slug: string
  admin: { items: AuditItem[]; ng_count: number }
  customer: { items: AuditItem[]; ng_count: number }
}

interface PublishResult {
  success: boolean
  admin_url: string
  customer_url: string
  line_url: string
  email_body: string
}

// =============================================
// ユーティリティ
// =============================================
function str(val: unknown): string { return String(val ?? '') }

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'property'
}

// =============================================
// ステップ進捗バー
// =============================================
const STEPS: { id: Step; label: string }[] = [
  { id: 'upload',   label: 'アップロード' },
  { id: 'extract',  label: 'AI抽出' },
  { id: 'images',   label: '画像スロット' },
  { id: 'texts',    label: '4言語テキスト' },
  { id: 'generate', label: 'HTML生成' },
  { id: 'audit',    label: '実数監査' },
  { id: 'publish',  label: 'GitHub公開' },
]

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current)
  return (
    <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            i < idx  ? 'bg-green-100 text-green-700' :
            i === idx ? 'bg-blue-600 text-white' :
            'bg-gray-100 text-gray-400'
          }`}>
            {i < idx && <CheckCircle2 className="w-3 h-3" />}
            {s.label}
          </div>
          {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
        </div>
      ))}
    </div>
  )
}

// =============================================
// メインコンポーネント
// =============================================
export function ProposalGenerator() {
  const [step, setStep] = useState<Step>('upload')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [images, setImages] = useState<Images>({})
  const [texts, setTexts] = useState<Texts>({ ja: {}, en: {}, 'zh-cn': {}, 'zh-tw': {} })
  const [activeLang, setActiveLang] = useState('ja')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<{ admin_html: string; customer_html: string; slug: string; admin_filename: string; customer_filename: string } | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [auditing, setAuditing] = useState(false)
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const pdfInputRef = useRef<HTMLInputElement>(null)
  const imgInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ---------- PDF アップロード ----------
  async function handleExtract() {
    if (!pdfFile) return
    setExtracting(true)
    setExtractError(null)

    const fd = new FormData()
    fd.append('pdf', pdfFile)

    try {
      const res = await fetch('/api/proposal/extract', { method: 'POST', body: fd })
      const data = await res.json() as { extracted?: Extracted; error?: string }
      if (!res.ok || !data.extracted) {
        setExtractError(data.error ?? 'AI抽出に失敗しました')
        return
      }
      setExtracted(data.extracted)
      // テキストを初期化
      const t = data.extracted.texts as Texts | undefined
      if (t) setTexts(t)
      setStep('extract')
    } catch (err) {
      setExtractError(String(err))
    } finally {
      setExtracting(false)
    }
  }

  // ---------- 画像アップロード ----------
  async function handleImageUpload(slot: string, file: File) {
    const dataUrl = await fileToDataUrl(file)
    setImages(prev => ({ ...prev, [slot]: dataUrl }))
  }

  // ---------- HTML生成 ----------
  async function handleGenerate() {
    if (!extracted) return
    setGenerating(true)
    setGenerateError(null)

    try {
      const res = await fetch('/api/proposal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extracted: { ...extracted, texts },
          images,
          slug: slugify(String(extracted.property_slug ?? extracted.property_name ?? '')),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.error ?? 'HTML生成に失敗しました')
        return
      }
      setGenerated(data)
      setStep('generate')
    } catch (err) {
      setGenerateError(String(err))
    } finally {
      setGenerating(false)
    }
  }

  // ---------- 監査 ----------
  async function handleAudit() {
    if (!generated) return
    setAuditing(true)

    try {
      const res = await fetch('/api/proposal/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_html: generated.admin_html,
          customer_html: generated.customer_html,
          slug: generated.slug,
        }),
      })
      const data = await res.json() as AuditResult
      setAuditResult(data)
      setStep('audit')
    } finally {
      setAuditing(false)
    }
  }

  // ---------- 公開 ----------
  async function handlePublish() {
    if (!generated || !auditResult?.passed) return
    setPublishing(true)
    setPublishError(null)

    try {
      const res = await fetch('/api/proposal/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: generated.slug,
          admin_html: generated.admin_html,
          customer_html: generated.customer_html,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPublishError(data.error ?? 'GitHub公開に失敗しました')
        return
      }
      setPublishResult(data as PublishResult)
      setStep('publish')
    } catch (err) {
      setPublishError(String(err))
    } finally {
      setPublishing(false)
    }
  }

  // =============================================
  // レンダリング
  // =============================================
  return (
    <div className="max-w-4xl mx-auto">
      <StepBar current={step} />

      {/* ---- STEP 1: アップロード ---- */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              PDFアップロード
            </h2>
            <div
              onClick={() => pdfInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              {pdfFile ? (
                <div>
                  <p className="text-sm font-medium text-gray-900">{pdfFile.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">クリックして販売図面PDFを選択</p>
                  <p className="text-xs text-gray-400 mt-1">.pdf（最大20MB）</p>
                </div>
              )}
            </div>
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {extractError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {extractError}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
            AIがPDFから物件情報・4言語テキスト・画像スロット候補をJSONで抽出します。HTMLは生成しません。
          </div>

          <button
            onClick={handleExtract}
            disabled={!pdfFile || extracting}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {extracting ? <><Loader2 className="w-4 h-4 animate-spin" />AI抽出中...</> : <>AI抽出を実行<ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      )}

      {/* ---- STEP 2: AI抽出結果確認 ---- */}
      {step === 'extract' && extracted && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">AI抽出結果確認</h2>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ['物件名', 'property_name'], ['価格', 'price'], ['住所', 'address'],
                  ['交通', 'access'], ['面積', 'area'], ['間取り', 'layout'],
                  ['築年月', 'built'], ['構造', 'structure'], ['管理費', 'management_fee'],
                  ['修繕積立金', 'repair_fee'], ['駐車場', 'parking'], ['ペット', 'pet'],
                  ['分譲会社', 'developer'], ['総戸数', 'total_units'], ['階数', 'floor'],
                ] as [string, string][]
              ).map(([label, key]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">{label}</label>
                  <input
                    type="text"
                    defaultValue={str(extracted[key])}
                    onChange={e => setExtracted(prev => ({ ...prev!, [key]: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>

            {/* キャッチコピー・概要 */}
            <div className="mt-4 space-y-3">
              {(
                [
                  ['キャッチコピー', 'catchcopy', 1],
                  ['サブタイトル', 'subtitle', 1],
                  ['おすすめコメント', 'recommend_comment', 2],
                  ['概要', 'summary', 2],
                  ['プランハイライト', 'plan_highlight', 2],
                  ['ステージタイトル', 'stage_title', 1],
                  ['ステージ本文', 'stage_body', 3],
                ] as [string, string, number][]
              ).map(([label, key, rows]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <textarea
                    rows={rows}
                    defaultValue={str(extracted[key])}
                    onChange={e => setExtracted(prev => ({ ...prev!, [key]: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              ))}
            </div>

            {/* スラッグ確認 */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                ファイル名スラッグ（英数字・小文字・アンダースコアのみ）
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  defaultValue={slugify(String(extracted.property_slug ?? extracted.property_name ?? ''))}
                  onChange={e => setExtracted(prev => ({ ...prev!, property_slug: slugify(e.target.value) }))}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  → gest_<span className="font-mono text-gray-700">{slugify(str(extracted.property_slug || extracted.property_name))}</span>.html
                </span>
              </div>
            </div>

            {/* 不足情報 */}
            {Array.isArray(extracted.missing_fields) && (extracted.missing_fields as string[]).length > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">不足情報（AI検出）</p>
                <ul className="text-xs text-amber-600 space-y-0.5">
                  {(extracted.missing_fields as string[]).map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 画像スロット候補（AI提案） */}
            {!!extracted.image_slot_candidates && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-700 mb-2">画像スロット候補（AI提案）</p>
                <div className="space-y-1.5">
                  {Object.entries(extracted.image_slot_candidates as Record<string, string>).map(([slot, desc]) => (
                    <div key={slot} className="flex items-start gap-2 text-xs text-blue-700">
                      <span className="font-mono font-semibold min-w-[80px]">{slot}:</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('upload')} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" />戻る
            </button>
            <button onClick={() => setStep('images')} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5">
              確定して画像スロットへ<ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 3: 画像スロット ---- */}
      {step === 'images' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Image className="w-4 h-4 text-blue-600" />
              画像スロット割り当て
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              floorplanは販売図面全体でなく間取り図のみを切り出してアップロードしてください
            </p>
            <div className="grid grid-cols-2 gap-4">
              {IMAGE_SLOTS.map(slot => (
                <div key={slot.key} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-gray-700">{slot.label}</label>
                    {slot.required && <span className="text-xs text-red-500">*</span>}
                  </div>
                  {images[slot.key] ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={images[slot.key]}
                        alt={slot.label}
                        className="w-full h-28 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => setImages(prev => { const n = { ...prev }; delete n[slot.key]; return n })}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                      >×</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => imgInputRefs.current[slot.key]?.click()}
                      className="border-2 border-dashed border-gray-200 rounded-lg h-28 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-gray-300 mb-1" />
                      <span className="text-xs text-gray-400">クリックして選択</span>
                    </div>
                  )}
                  <input
                    ref={el => { imgInputRefs.current[slot.key] = el }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(slot.key, f) }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('extract')} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" />戻る
            </button>
            <button onClick={() => setStep('texts')} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5">
              4言語テキストへ<ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 4: 4言語テキスト ---- */}
      {step === 'texts' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              4言語テキスト確認・編集
            </h2>
            <div className="flex gap-2 mb-5">
              {LANGS.map(lang => (
                <button
                  key={lang.key}
                  onClick={() => setActiveLang(lang.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeLang === lang.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              {TEXT_FIELDS.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                  <textarea
                    rows={field.rows}
                    value={texts[activeLang]?.[field.key] ?? ''}
                    onChange={e => setTexts(prev => ({
                      ...prev,
                      [activeLang]: { ...prev[activeLang], [field.key]: e.target.value }
                    }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {generateError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {generateError}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('images')} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" />戻る
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" />HTML生成中...</> : <>HTMLを生成する<ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 5: HTML生成完了 ---- */}
      {step === 'generate' && generated && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              HTML生成完了
            </h2>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">管理用HTML</p>
                  <p className="text-sm font-mono font-medium text-gray-900">{generated.admin_filename}</p>
                </div>
                <a
                  href={`data:text/html;charset=utf-8,${encodeURIComponent(generated.admin_html)}`}
                  download={generated.admin_filename}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />プレビュー用DL
                </a>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">顧客用HTML</p>
                  <p className="text-sm font-mono font-medium text-gray-900">{generated.customer_filename}</p>
                </div>
                <a
                  href={`data:text/html;charset=utf-8,${encodeURIComponent(generated.customer_html)}`}
                  download={generated.customer_filename}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />プレビュー用DL
                </a>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('texts')} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" />戻る
            </button>
            <button
              onClick={handleAudit}
              disabled={auditing}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {auditing ? <><Loader2 className="w-4 h-4 animate-spin" />監査中...</> : <>実数監査を実行<ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}

      {/* ---- STEP 6: 実数監査 ---- */}
      {step === 'audit' && auditResult && (
        <div className="space-y-6">
          <div className={`rounded-xl border p-5 ${auditResult.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {auditResult.passed
                ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                : <XCircle className="w-5 h-5 text-red-500" />}
              <span className={`text-base font-semibold ${auditResult.passed ? 'text-green-700' : 'text-red-700'}`}>
                {auditResult.passed ? '監査合格 — GitHub Pagesへ公開できます' : '監査不合格 — 提出不可'}
              </span>
            </div>
            {!auditResult.passed && (
              <div className="mt-2 text-sm text-red-600 space-y-0.5">
                {auditResult.admin.items.filter(i => i.status === 'ng').map(i => (
                  <p key={i.key} className="flex items-center gap-1.5"><XCircle className="w-3 h-3" />[管理用] {i.label}（{i.count}件）</p>
                ))}
                {auditResult.customer.items.filter(i => i.status === 'ng').map(i => (
                  <p key={i.key} className="flex items-center gap-1.5"><XCircle className="w-3 h-3" />[顧客用] {i.label}（{i.count}件）</p>
                ))}
              </div>
            )}
          </div>

          {/* 監査詳細 */}
          {['admin', 'customer'].map(type => {
            const result = auditResult[type as 'admin' | 'customer']
            return (
              <div key={type} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {type === 'admin' ? '管理用HTML監査' : '顧客用HTML監査'}
                    {result.ng_count > 0 && (
                      <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">NG {result.ng_count}件</span>
                    )}
                  </h3>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2">項目</th>
                      <th className="text-right px-4 py-2">件数</th>
                      <th className="text-center px-4 py-2">判定</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.items.map(item => (
                      <tr key={item.key} className={item.status === 'ng' ? 'bg-red-50' : item.status === 'warn' ? 'bg-amber-50' : ''}>
                        <td className="px-4 py-2 text-gray-700">{item.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-600">{item.count}</td>
                        <td className="px-4 py-2 text-center">
                          {item.status === 'ok'   && <span className="text-green-600 font-semibold">OK</span>}
                          {item.status === 'ng'   && <span className="text-red-600 font-semibold">NG</span>}
                          {item.status === 'warn' && <span className="text-amber-600 font-semibold">WARN</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}

          <div className="flex gap-3">
            <button onClick={() => setStep('generate')} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" />戻る
            </button>
            {!auditResult.passed ? (
              <button
                onClick={() => { setStep('texts'); setGenerated(null); setAuditResult(null) }}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />最初からやり直す
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {publishing ? <><Loader2 className="w-4 h-4 animate-spin" />公開中...</> : <><GitBranch className="w-4 h-4" />GitHub Pagesへ公開</>}
              </button>
            )}
          </div>

          {publishError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {publishError}
            </div>
          )}
        </div>
      )}

      {/* ---- STEP 7: 公開完了 ---- */}
      {step === 'publish' && publishResult && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <h2 className="text-base font-semibold text-green-700">GitHub Pagesへ公開完了</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: '管理用URL', url: publishResult.admin_url, icon: <Eye className="w-4 h-4" /> },
                { label: '顧客用URL', url: publishResult.customer_url, icon: <Link className="w-4 h-4" /> },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-lg border border-green-200 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-blue-600 hover:underline truncate flex-1">{item.url}</a>
                    <button
                      onClick={() => navigator.clipboard.writeText(item.url)}
                      className="text-xs text-gray-500 hover:text-gray-700 flex-shrink-0"
                    >コピー</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 送信用リンク */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">送信用リンク</h3>
            <a
              href={publishResult.line_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 justify-center"
            >
              <Send className="w-4 h-4" />LINE で送信
            </a>
            <a
              href={`mailto:?subject=物件提案書&body=${publishResult.email_body}`}
              className="flex items-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 justify-center"
            >
              <Mail className="w-4 h-4" />メールで送信
            </a>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
            GitHub Pages への反映には通常 1〜3分かかります。URLが開けない場合は少し待ってから再アクセスしてください。
          </div>

          <button
            onClick={() => {
              setStep('upload')
              setPdfFile(null)
              setExtracted(null)
              setImages({})
              setTexts({ ja: {}, en: {}, 'zh-cn': {}, 'zh-tw': {} })
              setGenerated(null)
              setAuditResult(null)
              setPublishResult(null)
              setExtractError(null)
              setGenerateError(null)
              setPublishError(null)
            }}
            className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
          >
            新しい提案書を作成
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { resendNotification } from '../actions'
import { RefreshCw } from 'lucide-react'

export function ResendButton({ logId }: { logId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<'success' | 'error' | null>(null)

  async function handleResend() {
    if (!confirm('この通知を再送しますか？')) return
    setLoading(true)
    const result = await resendNotification(logId)
    setDone(result?.success ? 'success' : 'error')
    setLoading(false)
  }

  if (done === 'success') return <span className="text-xs text-green-600 font-medium">再送済</span>
  if (done === 'error') return <span className="text-xs text-red-500">失敗</span>

  return (
    <button
      onClick={handleResend}
      disabled={loading}
      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 transition-colors"
    >
      <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
      再送
    </button>
  )
}

'use client'

import { useState } from 'react'
import { approveRequest, rejectRequest } from './actions'
import { CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  requestId: string
  projectId: string
  fieldName: string
  newValue:  string
}

export function ApprovalActions({ requestId, projectId, fieldName, newValue }: Props) {
  const [showReject, setShowReject] = useState(false)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  if (done === 'approved') return <span className="text-xs text-green-600 font-medium">承認しました</span>
  if (done === 'rejected') return <span className="text-xs text-red-500 font-medium">却下しました</span>

  if (showReject) {
    return (
      <form action={async (fd) => {
        const res = await rejectRequest(fd)
        if (!res?.error) setDone('rejected')
        else alert(res.error)
      }} className="space-y-2">
        <input type="hidden" name="requestId" value={requestId} />
        <textarea
          name="rejectionReason"
          required
          rows={2}
          placeholder="却下理由を入力"
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
        <div className="flex gap-1.5">
          <button type="submit"
            className="flex-1 px-2 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">
            却下する
          </button>
          <button type="button" onClick={() => setShowReject(false)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            戻る
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex gap-1.5">
      <form action={async (fd) => {
        const res = await approveRequest(fd)
        if (!res?.error) setDone('approved')
        else alert(res.error)
      }}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="fieldName" value={fieldName} />
        <input type="hidden" name="newValue" value={newValue} />
        <button type="submit"
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
          <CheckCircle2 className="w-3 h-3" /> 承認
        </button>
      </form>
      <button
        onClick={() => setShowReject(true)}
        className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors">
        <XCircle className="w-3 h-3" /> 却下
      </button>
    </div>
  )
}

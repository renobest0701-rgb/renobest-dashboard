import { cn } from '@/lib/utils'
import { TrendingDown, AlertTriangle } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  subValue?: string
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  isWarning?: boolean
  isPending?: boolean  // 変更申請中
  size?: 'sm' | 'md' | 'lg'
}

export function MetricCard({
  label,
  value,
  subValue,
  variant = 'default',
  isWarning = false,
  isPending = false,
  size = 'md',
}: MetricCardProps) {
  const isNegative = value.startsWith('-') || value.startsWith('▲')

  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-4 flex flex-col gap-1 relative',
        variant === 'primary'  && 'border-blue-200 bg-blue-50',
        variant === 'success'  && 'border-green-200 bg-green-50',
        variant === 'warning'  && 'border-amber-200 bg-amber-50',
        variant === 'danger'   && 'border-red-200 bg-red-50',
        variant === 'default'  && 'border-gray-200',
        isWarning && 'border-amber-400 ring-1 ring-amber-400',
        isPending && 'border-dashed border-gray-400 opacity-75'
      )}
    >
      {isPending && (
        <span className="absolute top-2 right-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          申請中
        </span>
      )}
      {isWarning && (
        <AlertTriangle className="absolute top-3 right-3 w-4 h-4 text-amber-500" />
      )}

      <span className="text-xs font-medium text-gray-500 leading-none">{label}</span>
      <span
        className={cn(
          'font-bold leading-tight',
          size === 'sm' && 'text-base',
          size === 'md' && 'text-xl',
          size === 'lg' && 'text-2xl',
          isNegative ? 'text-red-600' : (
            variant === 'primary' ? 'text-blue-700' :
            variant === 'success' ? 'text-green-700' :
            variant === 'warning' ? 'text-amber-700' :
            variant === 'danger'  ? 'text-red-700' :
            'text-gray-900'
          )
        )}
      >
        {isNegative && <TrendingDown className="inline w-4 h-4 mr-1" />}
        {value}
      </span>
      {subValue && (
        <span className="text-xs text-gray-500">{subValue}</span>
      )}
    </div>
  )
}

interface ProgressBarProps {
  label: string
  value: number    // 0〜1
  target?: number
  color?: 'blue' | 'green' | 'amber' | 'red'
}

export function ProgressBar({ label, value, target, color = 'blue' }: ProgressBarProps) {
  const pct = Math.min(value * 100, 100)
  const colorMap = {
    blue:  'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-400',
    red:   'bg-red-500',
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className={cn('text-sm font-bold',
          pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-blue-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'
        )}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={cn('h-2.5 rounded-full transition-all duration-500', colorMap[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {target !== undefined && (
        <div className="text-xs text-gray-400">目標: {target.toLocaleString()}円</div>
      )}
    </div>
  )
}

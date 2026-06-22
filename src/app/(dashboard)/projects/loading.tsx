export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-200 rounded-lg" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-12 bg-gray-100 rounded-xl" />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-12 bg-gray-50 border-b border-gray-200" />
        {Array.from({length: 8}).map((_, i) => (
          <div key={i} className="h-14 border-b border-gray-100 px-4 flex items-center gap-4">
            <div className="h-4 w-32 bg-gray-100 rounded" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

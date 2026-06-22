export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded-lg" />
          <div className="h-4 w-32 bg-gray-100 rounded mt-2" />
        </div>
        <div className="h-10 w-48 bg-gray-200 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {[1,2,3].map((i) => <div key={i} className="h-6 bg-gray-100 rounded-full" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({length: 8}).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}

export default function MessageLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 h-10 w-36 rounded bg-[#f1f5f9] animate-pulse" />

      <div className="bg-white rounded-lg border border-[#e2e8f0]">
        <div className="p-6 border-b border-[#e2e8f0]">
          <div className="h-7 w-64 rounded bg-[#e2e8f0] animate-pulse mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-72 rounded bg-[#f1f5f9] animate-pulse" />
            <div className="h-4 w-60 rounded bg-[#f1f5f9] animate-pulse" />
            <div className="h-4 w-48 rounded bg-[#f1f5f9] animate-pulse" />
          </div>
        </div>

        <div className="p-6 space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-4 rounded bg-[#f8fafc] animate-pulse"
              style={{ width: `${92 - index * 8}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

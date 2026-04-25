export default function InboxLoading() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="h-8 w-40 rounded bg-[#e2e8f0] animate-pulse" />
        <div className="mt-2 h-4 w-56 rounded bg-[#f1f5f9] animate-pulse" />
      </div>

      <div className="bg-white rounded-lg border border-[#e2e8f0] divide-y divide-[#e2e8f0]">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-4">
            <div className="w-5 h-5 rounded bg-[#e2e8f0] animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="h-4 w-40 rounded bg-[#e2e8f0] animate-pulse" />
                <div className="h-3 w-16 rounded bg-[#f1f5f9] animate-pulse" />
              </div>
              <div className="mt-2 h-4 w-56 rounded bg-[#f1f5f9] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

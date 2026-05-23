"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="rounded-full bg-red-50 p-4 text-red-600 mb-6">
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-[#1a365d] mb-2">服务暂时不可用</h2>
      <p className="text-sm text-[#64748b] max-w-md mb-8">
        Nexatech 管理后台目前发生了一点偶发波动，或是数据库连接正忙。请您刷新或稍后重试。
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="rounded-md bg-[#1a365d] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2b4c7e] transition"
        >
          刷新页面
        </button>
        <a
          href="/mail/admin"
          className="rounded-md border border-[#e2e8f0] bg-white px-5 py-2.5 text-sm font-semibold text-[#1a365d] hover:bg-[#f8fafc] transition"
        >
          返回管理后台
        </a>
      </div>
    </div>
  );
}

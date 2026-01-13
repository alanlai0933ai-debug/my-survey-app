import React from 'react';

// cn 是一個簡單的 class 合併技巧，這裡我們直接寫簡單版
export default function Skeleton({ className, ...props }) {
  return (
    <div 
      className={`animate-pulse bg-slate-200 rounded-lg ${className}`} 
      {...props}
    />
  );
}

// 預設幾種常用的形狀
export function SkeletonCard() {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      {/* 模擬圖片/標題 */}
      <Skeleton className="h-40 w-full rounded-2xl" />
      {/* 模擬文字行 */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonList() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-100">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                    </div>
                </div>
            ))}
        </div>
    )
}
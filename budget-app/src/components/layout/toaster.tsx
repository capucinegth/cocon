"use client";

import { CircleCheck } from "lucide-react";
import { useUI } from "@/store/ui-store";

export function Toaster() {
  const { toast } = useUI();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 bottom-[calc(max(env(safe-area-inset-bottom),12px)+156px)] lg:bottom-8"
    >
      {toast && (
        <div
          key={toast.id}
          className="inline-flex animate-pop items-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-medium text-white shadow-float"
        >
          <CircleCheck size={18} className="text-sage-100" aria-hidden />
          {toast.message}
        </div>
      )}
    </div>
  );
}

"use client";

import { CircleCheck } from "lucide-react";
import { useUI } from "@/store/ui-store";

/** Confirmation discrète en bas d'écran, avec une action éventuelle (« Annuler »). */
export function Toaster() {
  const { toast, dismissToast } = useUI();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 bottom-[calc(max(env(safe-area-inset-bottom),12px)+156px)] lg:bottom-8"
    >
      {toast && (
        <div
          key={toast.id}
          className="pointer-events-auto inline-flex max-w-full animate-pop items-center gap-3 rounded-[1.75rem] bg-ink py-2 pl-5 pr-2 text-[15px] font-medium text-white shadow-float"
        >
          <CircleCheck size={18} className="shrink-0 text-sage-100" aria-hidden />
          <span className="min-w-0 break-words py-1">{toast.message}</span>
          {toast.onAction ? (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                dismissToast();
              }}
              className="h-10 shrink-0 rounded-full bg-white/15 px-4 text-sm font-semibold transition-colors hover:bg-white/25"
            >
              {toast.actionLabel}
            </button>
          ) : (
            <span className="w-3" aria-hidden />
          )}
        </div>
      )}
    </div>
  );
}

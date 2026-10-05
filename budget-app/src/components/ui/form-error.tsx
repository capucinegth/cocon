import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/** Message d'erreur sous un formulaire, annoncé aux lecteurs d'écran. */
export function FormError({ message, className }: { message: string | null | undefined; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("flex items-start gap-2 rounded-2xl bg-blush-50 px-4 py-3 text-[14px] font-medium text-blush-700", className)}>
      <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">{message}</span>
    </p>
  );
}

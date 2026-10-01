import Link from "next/link";
import { useId } from "react";
import { appConfig } from "@/config/app";

/** Logo : un cocon arrondi, dégradé rose → lilas. */
export function BrandMark({ size = 40 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-blush-300)" />
          <stop offset="1" stopColor="var(--color-lilac-100)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="13" fill={`url(#${gradientId})`} />
      <path d="M25.66 14.34A8 8 0 1 0 25.66 25.66" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="20" cy="20" r="2.4" fill="#fff" />
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-2xl px-2 py-1">
      <BrandMark />
      <div className="leading-tight">
        <p className="text-lg font-semibold tracking-tight">{appConfig.name}</p>
        <p className="text-[13px] text-muted">{appConfig.tagline}</p>
      </div>
    </Link>
  );
}

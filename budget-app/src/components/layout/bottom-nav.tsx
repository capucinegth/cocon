"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, mainNav } from "@/config/navigation";
import { cn } from "@/lib/cn";

/** Barre de navigation flottante en bas d'écran — mobile et tablette. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(env(safe-area-inset-bottom),12px)] min-[360px]:px-3 lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch rounded-[26px] bg-surface/90 p-1 shadow-nav backdrop-blur-xl min-[360px]:p-1.5">
        {mainNav.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 rounded-[20px] py-1.5 text-[10px] font-semibold min-[375px]:text-[11px]"
              >
                <span
                  className={cn(
                    "grid h-8 w-10 place-items-center rounded-full transition-colors duration-300 min-[375px]:w-12",
                    active ? "bg-blush-100 text-ink" : "text-muted",
                  )}
                >
                  <Icon size={21} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                </span>
                <span className={cn("max-w-full whitespace-nowrap", active ? "text-ink" : "text-muted")}>{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

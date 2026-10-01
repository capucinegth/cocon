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
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch rounded-[26px] bg-surface/90 p-1.5 shadow-nav backdrop-blur-xl">
        {mainNav.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 rounded-[20px] py-1.5 text-[11px] font-semibold"
              >
                <span
                  className={cn(
                    "grid h-8 w-12 place-items-center rounded-full transition-colors duration-300",
                    active ? "bg-blush-100 text-ink" : "text-muted",
                  )}
                >
                  <Icon size={21} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                </span>
                <span className={active ? "text-ink" : "text-muted"}>{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

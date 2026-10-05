"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import {
  isActivePath,
  mainNav,
  settingsNav,
  type NavItem,
} from "@/config/navigation";
import { cn } from "@/lib/cn";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import { Brand } from "./brand";

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[15px] font-medium transition-all duration-200",
        active
          ? "bg-surface text-ink shadow-card ring-1 ring-ink/5"
          : "text-muted hover:bg-blush-50 hover:text-ink",
      )}
    >
      <Icon
        size={19}
        strokeWidth={active ? 2.2 : 1.8}
        className={active ? "text-blush-700" : undefined}
        aria-hidden
      />
      {item.label}
    </Link>
  );
}

/** Navigation latérale — ordinateur uniquement. */
export function Sidebar() {
  const pathname = usePathname();
  const { openAdd } = useUI();
  const { summary, status, source } = useBudget();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink/5 px-4 py-7 lg:flex">
      <Brand />

      <Button
        size="lg"
        onClick={() => openAdd()}
        className="mt-7 w-full"
        disabled={status !== "ready"}
      >
        <Plus size={20} strokeWidth={2.4} aria-hidden />
        Ajouter
      </Button>

      <nav
        aria-label="Navigation principale"
        className="mt-6 flex flex-col gap-1"
      >
        {mainNav.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isActivePath(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        {status === "ready" && (
          <Link href="/" className="lift rounded-3xl bg-blush-50 p-4">
            <p className="text-[13px] font-medium text-ink-soft">
              Disponible aujourd&apos;hui
            </p>
            <p className="mt-0.5 text-xl font-semibold tracking-tight">
              <Money value={summary.perDay} cents="always" />
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              <Money value={summary.remaining} cents="always" /> pour{" "}
              {summary.daysLeft} jours
            </p>
          </Link>
        )}
        {source === "demo" && (
          <p className="px-2 text-[12px] leading-snug text-muted">
            Mode démo : données fictives, rien n&apos;est enregistré.
          </p>
        )}
        <SidebarLink
          item={settingsNav}
          active={isActivePath(pathname, settingsNav.href)}
        />
      </div>
    </aside>
  );
}

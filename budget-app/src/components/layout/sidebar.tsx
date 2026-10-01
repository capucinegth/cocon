"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isActivePath, mainNav, settingsNav, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { useUI } from "@/store/ui-store";
import { Brand } from "./brand";

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-12 items-center gap-3 rounded-2xl px-4 text-[15px] font-medium transition-all duration-200",
        active ? "bg-surface text-ink shadow-card" : "text-muted hover:bg-blush-50 hover:text-ink",
      )}
    >
      <Icon size={20} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-blush-700" : undefined} aria-hidden />
      {item.label}
    </Link>
  );
}

/** Navigation latérale — ordinateur uniquement. */
export function Sidebar() {
  const pathname = usePathname();
  const { openAdd } = useUI();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col px-5 py-8 lg:flex">
      <Brand />

      <Button size="lg" onClick={openAdd} className="mt-8 w-full">
        <Plus size={20} strokeWidth={2.4} aria-hidden />
        Ajouter une dépense
      </Button>

      <nav aria-label="Navigation principale" className="mt-6 flex flex-col gap-1">
        {mainNav.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActivePath(pathname, item.href)} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-3xl bg-blush-50 p-4">
          <p className="text-sm font-semibold">Mode démo</p>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            Données fictives : rien n&apos;est enregistré ni connecté à une banque.
          </p>
        </div>
        <SidebarLink item={settingsNav} active={isActivePath(pathname, settingsNav.href)} />
      </div>
    </aside>
  );
}

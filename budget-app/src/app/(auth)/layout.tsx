import type { ReactNode } from "react";

/** Pages de connexion / inscription : sans navigation, centrées, même univers que l'application. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 size-80 rounded-full bg-blush-100/70 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-20 size-96 rounded-full bg-lilac-50 blur-3xl" />
      <div className="relative w-full max-w-md">{children}</div>
    </main>
  );
}

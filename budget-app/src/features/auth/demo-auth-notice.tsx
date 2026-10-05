import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { supabaseConfigProblem } from "@/lib/supabase/env";
import { AuthCard } from "./auth-card";

/** Sans Supabase configuré : pas de compte possible, la démo reste accessible. */
export function DemoAuthNotice() {
  return (
    <AuthCard title="Mode démo" subtitle="Les comptes ne sont pas encore activés sur cette installation.">
      {supabaseConfigProblem && (
        <p role="alert" className="mb-5 rounded-2xl bg-blush-50 px-4 py-3 text-[14px] text-blush-700">
          {supabaseConfigProblem}
        </p>
      )}
      <p className="text-[15px] text-ink-soft">
        Tu peux découvrir Cocon avec des données fictives : rien n&apos;est enregistré. La connexion sera disponible une fois la base de données
        configurée.
      </p>
      <Link href="/" className={`${buttonStyles({ size: "lg" })} mt-6 w-full`}>
        Ouvrir la démo
      </Link>
    </AuthCard>
  );
}

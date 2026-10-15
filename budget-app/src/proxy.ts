import { NextResponse, type NextRequest } from "next/server";
import { dataSource, supabaseEnv } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/proxy-session";

/**
 * Avec Supabase : session rafraîchie et pages protégées.
 * En mode démo : rien à protéger, les requêtes passent telles quelles.
 */
export async function proxy(request: NextRequest) {
  if (dataSource !== "supabase" || !supabaseEnv) return NextResponse.next();
  return updateSession(request, supabaseEnv);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, les icônes et le manifeste de l'application.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/|ocr/|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

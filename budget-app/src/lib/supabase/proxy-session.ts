import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-path";
import type { SupabaseEnv } from "./env";

/** Pages accessibles sans être connecté. */
const AUTH_PAGES = new Set(["/connexion", "/inscription", "/mot-de-passe-oublie"]);
const PUBLIC_PREFIXES = ["/auth/"];

function redirect(request: NextRequest, pathname: string, params: Record<string, string>, carry: NextResponse): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = NextResponse.redirect(url);
  // Conserve les cookies de session éventuellement rafraîchis.
  carry.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  carry.headers.forEach((value, key) => {
    if (key.toLowerCase() === "cache-control") response.headers.set(key, value);
  });
  return response;
}

/**
 * Rafraîchit la session Supabase à chaque requête et protège les pages :
 * non connecté → /connexion ; déjà connecté → pas de page de connexion.
 * (Vérification « optimiste » : la vraie protection des données reste la RLS.)
 */
export async function updateSession(request: NextRequest, env: SupabaseEnv): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Ne rien intercaler entre la création du client et getClaims (recommandation Supabase).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.has(pathname);
  const isPublic = isAuthPage || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!signedIn && !isPublic) {
    const hadSession = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
    const params: Record<string, string> = {};
    if (pathname !== "/") params.suite = `${pathname}${search}`;
    if (hadSession) params.raison = "session";
    return redirect(request, "/connexion", params, response);
  }

  if (signedIn && isAuthPage) {
    return redirect(request, safeNextPath(request.nextUrl.searchParams.get("suite")), {}, response);
  }

  return response;
}

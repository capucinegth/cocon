/** N'accepte qu'un chemin interne (« /budget »), jamais une autre origine (« //site », « https:… »). */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

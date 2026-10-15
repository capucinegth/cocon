import type { SupabaseClient } from "@supabase/supabase-js";

/** Client Supabase factice : enregistre les requêtes, chaque modification touche une ligne. */
export function fakeClient() {
  const calls: { table: string; values: Record<string, unknown>; filters: [string, unknown][] }[] = [];
  const client = {
    from(table: string) {
      const call = { table, values: {} as Record<string, unknown>, filters: [] as [string, unknown][] };
      calls.push(call);
      const query = {
        update(values: Record<string, unknown>) {
          call.values = values;
          return query;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return query;
        },
        select() {
          return query;
        },
        then(resolve: (result: { data: unknown; error: null }) => void) {
          resolve({ data: [{ id: "x" }], error: null });
        },
      };
      return query;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

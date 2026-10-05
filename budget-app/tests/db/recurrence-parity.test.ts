/**
 * La même règle de récurrence existe en SQL (génération en base) et en TypeScript
 * (prévisions à l'écran). Elles doivent donner exactement les mêmes dates.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { nextOccurrenceDate } from "@/lib/recurrence";
import { adminUrl, createTestDatabase } from "./helpers";

const suite = adminUrl ? describe : describe.skip;

suite("récurrences : SQL et TypeScript identiques", () => {
  let db: Client;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase("cocon_parity"));
  });
  afterAll(async () => {
    await drop?.();
  });

  it("sur deux années complètes, tous jours d'ancrage confondus", async () => {
    const cases: [string, "weekly" | "monthly", number | null][] = [];
    for (let date = "2027-01-01"; date <= "2028-12-31"; date = addDays(date, 1)) {
      cases.push([date, "weekly", null], [date, "monthly", null]);
      const day = Number(date.slice(8, 10));
      if (day >= 28) for (const anchor of [28, 29, 30, 31]) cases.push([date, "monthly", anchor]);
    }
    const { rows } = await db.query<{ next: string }>(
      `select to_char(public.next_occurrence_date(d, f, a::smallint), 'YYYY-MM-DD') as next
       from unnest($1::date[], $2::text[], $3::int[]) with ordinality as c(d, f, a, i) order by i`,
      [cases.map((c) => c[0]), cases.map((c) => c[1]), cases.map((c) => c[2])],
    );
    const mismatches = cases.filter((c, i) => nextOccurrenceDate(c[0], c[1], c[2] ?? undefined) !== rows[i].next);
    expect(cases.length).toBeGreaterThan(1500);
    expect(mismatches).toEqual([]);
  });
});

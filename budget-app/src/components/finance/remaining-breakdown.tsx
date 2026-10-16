import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import type { MonthSummary } from "@/lib/budget";

/**
 * « Le calcul du mois » : le calcul complet, ligne à ligne, pour comprendre
 * d'où vient le chiffre principal (« Tu peux encore dépenser »). Affiché dans Budget.
 */
export function RemainingBreakdown({ summary }: { summary: MonthSummary }) {
  const rows: { label: string; value: number; sign?: "always"; hint?: ReactNode }[] = [
    {
      label: "Revenus",
      value: summary.income,
      sign: "always" as const,
      hint:
        summary.incomeUpcoming + summary.incomeExpected > 0 ? <>dont <Money value={summary.incomeUpcoming + summary.incomeExpected} /> attendus</> : undefined,
    },
    {
      label: "Charges fixes",
      value: -summary.fixed,
      hint: summary.fixedUpcoming > 0 ? <>dont <Money value={summary.fixedUpcoming} /> à venir</> : undefined,
    },
    {
      label: "Dépenses du quotidien",
      value: -summary.variable,
      hint: summary.variableUpcoming > 0 ? <>dont <Money value={summary.variableUpcoming} /> prévus</> : undefined,
    },
    { label: summary.isPast ? "Épargne" : "Épargne prévue", value: -summary.savingsReserved },
  ];

  return (
    <Card id="calcul" className="scroll-mt-6">
      <SectionHeader
        title={summary.isPast ? "Ce qu'il t'est resté" : "Le calcul du mois"}
        subtitle={summary.isPast ? "Le calcul, ligne par ligne" : "D'où vient ce que tu peux encore dépenser"}
      />
      <dl className="flex flex-col gap-3.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="min-w-0">
              <span className="text-[15px] text-ink-soft">{row.label}</span>
              {row.hint && <span className="block text-[13px] text-muted">{row.hint}</span>}
            </dt>
            <dd>
              <Money value={row.value} sign={row.sign} cents="always" className="tabular text-[15px] font-semibold" />
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-baseline justify-between gap-4 rounded-2xl bg-blush-50 px-4 py-3.5">
        <p className="text-[15px] font-semibold">{summary.isPast ? "Resté en fin de mois" : "Tu peux encore dépenser"}</p>
        <Money value={summary.remaining} cents="always" className="text-xl font-semibold tracking-tight" />
      </div>
    </Card>
  );
}

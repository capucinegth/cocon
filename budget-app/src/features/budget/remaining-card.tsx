import { formatMoney } from "@/lib/format";

interface RemainingCardProps {
  income: number;
  fixed: number;
  variable: number;
  saved: number;
  remaining: number;
  perDay: number;
  daysLeft: number;
}

/** « Reste disponible » : le calcul complet, ligne à ligne, pour comprendre d'où vient le chiffre. */
export function RemainingCard({ income, fixed, variable, saved, remaining, perDay, daysLeft }: RemainingCardProps) {
  const rows = [
    { label: "Revenus", value: income, sign: "always" as const },
    { label: "Charges fixes", value: -fixed },
    { label: "Dépenses variables", value: -variable },
    { label: "Épargne", value: -saved },
  ];

  return (
    <section
      aria-labelledby="remaining-title"
      className="relative overflow-hidden rounded-hero bg-linear-to-br from-blush-100 via-blush-50 to-lilac-50 p-6 shadow-card sm:p-7"
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-blush-300/30 blur-3xl" />
      <div className="relative">
        <h2 id="remaining-title" className="text-[17px] font-semibold tracking-tight">
          Reste disponible
        </h2>
        <p className="text-sm text-ink/70">Ce qu&apos;il te reste vraiment, une fois tout prévu</p>

        <dl className="mt-6 flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 text-[15px]">
              <dt className="text-ink/75">{row.label}</dt>
              <dd className="tabular font-semibold">{formatMoney(row.value, { sign: row.sign, cents: "always" })}</dd>
            </div>
          ))}
        </dl>

        <div className="my-5 h-px bg-ink/10" />

        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className="pb-1 text-[15px] font-semibold">Il te reste</p>
          <p className="text-[40px] font-semibold leading-none tracking-tight">{formatMoney(remaining, { cents: "always" })}</p>
        </div>
        <p className="mt-3 text-sm text-ink/70">
          Soit ≈ <span className="font-semibold text-ink">{formatMoney(perDay, { cents: "always" })} par jour</span> pendant {daysLeft}{" "}
          jours.
        </p>
      </div>
    </section>
  );
}

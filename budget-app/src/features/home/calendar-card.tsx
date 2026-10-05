"use client";

import { useState } from "react";
import { CalendarLegend, EventMarker, MonthCalendar, eventTypeLabels } from "@/components/calendar/month-calendar";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { formatLongDate, monthKey } from "@/lib/dates";
import { getCalendarEvents } from "@/lib/timeline";
import { useBudget } from "@/store/budget-store";

/** Le mois en un coup d'œil : revenus, charges fixes, grosses dépenses, épargne. */
export function CalendarCard({ month }: { month: string }) {
  const data = useBudget();
  const events = getCalendarEvents(data, month);
  const isCurrent = monthKey(data.today) === month;
  const [selected, setSelected] = useState<string>(isCurrent ? data.today : (events[0]?.date ?? `${month}-01`));
  const dayEvents = events.filter((e) => e.date === selected);

  return (
    <Card>
      <SectionHeader title="Ton mois en un coup d'œil" subtitle="Les mouvements qui comptent" />
      <MonthCalendar month={month} today={data.today} events={events} selectedDate={selected} onSelect={setSelected} />
      <CalendarLegend className="mt-4" />

      <div className="mt-4 rounded-2xl bg-canvas p-4" aria-live="polite">
        <p className="text-sm font-semibold">
          {formatLongDate(selected)}
          {selected === data.today && <span className="font-medium text-muted"> · aujourd&apos;hui</span>}
        </p>
        {dayEvents.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Aucun mouvement important ce jour-là.</p>
        ) : (
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {dayEvents.map((event) => (
              <li key={event.id} className="flex items-center gap-3 text-[15px]">
                <span className="grid size-5 place-items-center">
                  <EventMarker type={event.type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">{event.label}</span>
                  <span className="block text-[13px] text-muted">
                    {eventTypeLabels[event.type]}
                    {event.planned ? " · prévu" : ""}
                  </span>
                </span>
                <Money
                  value={event.type === "income" ? event.amount : -event.amount}
                  sign="always"
                  className={event.type === "income" ? "tabular font-semibold text-sage-700" : "tabular font-semibold"}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

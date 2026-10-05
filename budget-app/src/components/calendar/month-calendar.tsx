"use client";

import { cn } from "@/lib/cn";
import { addDays, daysInMonth, formatLongDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import type { CalendarEvent, CalendarEventType } from "@/lib/timeline";

export const eventTypeLabels: Record<CalendarEventType, string> = {
  income: "Revenu",
  fixed: "Charge fixe",
  expense: "Dépense importante",
  saving: "Épargne",
};

const markerClasses: Record<CalendarEventType, string> = {
  income: "size-[7px] rounded-full bg-blush-500",
  fixed: "size-[7px] rounded-[1.5px] bg-lilac-500",
  expense: "size-[6px] rotate-45 rounded-[1px] bg-peach-600",
  saving: "size-[8px] rounded-full border-[1.5px] border-sage-500",
};

/** Marqueur d'événement : forme + couleur (jamais la couleur seule). */
export function EventMarker({ type, className }: { type: CalendarEventType; className?: string }) {
  return <span aria-hidden className={cn("inline-block shrink-0", markerClasses[type], className)} />;
}

export function CalendarLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted", className)}>
      {(Object.keys(eventTypeLabels) as CalendarEventType[]).map((type) => (
        <li key={type} className="inline-flex items-center gap-1.5">
          <EventMarker type={type} />
          {eventTypeLabels[type]}
        </li>
      ))}
    </ul>
  );
}

const WEEKDAYS = [
  { short: "L", long: "lundi" },
  { short: "M", long: "mardi" },
  { short: "M", long: "mercredi" },
  { short: "J", long: "jeudi" },
  { short: "V", long: "vendredi" },
  { short: "S", long: "samedi" },
  { short: "D", long: "dimanche" },
];

interface MonthCalendarProps {
  /** AAAA-MM */
  month: string;
  today: string;
  events: CalendarEvent[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

/** Calendrier du mois : les jours avec des mouvements portent de petits marqueurs. */
export function MonthCalendar({ month, today, events, selectedDate, onSelect }: MonthCalendarProps) {
  const first = `${month}-01`;
  // getUTCDay : 0 = dimanche → décalage pour une semaine qui commence le lundi.
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth(first) }, (_, i) => addDays(first, i));

  return (
    <div role="group" aria-label="Calendrier du mois">
      <div aria-hidden className="grid grid-cols-7 pb-1">
        {WEEKDAYS.map((day) => (
          <span key={day.long} className="text-center text-[12px] font-semibold text-muted">
            {day.short}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`empty-${i}`} aria-hidden />
        ))}
        {days.map((date) => {
          const dayEvents = events.filter((e) => e.date === date);
          const types = [...new Set(dayEvents.map((e) => e.type))];
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const label = `${formatLongDate(date)}${isToday ? ", aujourd'hui" : ""}${
            dayEvents.length
              ? ` : ${dayEvents.map((e) => `${e.label} ${formatMoney(e.amount)}${e.planned ? " (prévu)" : ""}`).join(", ")}`
              : ""
          }`;
          return (
            <button
              key={date}
              type="button"
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => onSelect(date)}
              className={cn(
                "mx-auto flex h-12 w-full max-w-12 flex-col items-center justify-center gap-1 rounded-2xl text-[14px] transition-colors duration-200",
                isSelected ? "bg-blush-100 font-semibold text-ink" : "hover:bg-blush-50",
                isToday && !isSelected && "font-semibold text-ink ring-1 ring-inset ring-blush-300",
                !isToday && !isSelected && (dayEvents.length ? "text-ink" : "text-muted"),
                date > today && "[&_.marker]:opacity-60",
              )}
            >
              <span className="leading-none">{Number(date.slice(8))}</span>
              <span className="flex h-2 items-center gap-[3px]">
                {types.slice(0, 3).map((type) => (
                  <EventMarker key={type} type={type} className="marker" />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { ArticleActivityDay } from "../../contracts";

const levels = [
  { label: "0件", color: "bg-slate-100" },
  { label: "1件", color: "bg-emerald-200" },
  { label: "2〜3件", color: "bg-emerald-400" },
  { label: "4〜6件", color: "bg-emerald-600" },
  { label: "7件以上", color: "bg-emerald-900" },
] as const;

function colorForCount(count: number): string {
  const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
  return levels[level].color;
}

function dateLabel(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

type ActivityCalendarProps = {
  readonly days: readonly ArticleActivityDay[];
};

export function ActivityCalendar({ days }: ActivityCalendarProps) {
  const [selectedIndex, setSelectedIndex] = useState(days.length - 1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const startDate = days[0]?.date ?? "";
  const endDate = days.at(-1)?.date ?? "";
  const leadingDays = (new Date(`${startDate}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekCount = Math.ceil((leadingDays + days.length) / 7);
  const selectedDay = days[selectedIndex];
  const monthLabels = new Map<number, string>();
  days.forEach(({ date }, index) => {
    if (index === 0 || date.endsWith("-01")) {
      monthLabels.set(Math.floor((leadingDays + index) / 7), `${Number(date.slice(5, 7))}月`);
    }
  });

  useEffect(() => {
    if (scrollRef.current !== null) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, []);

  function moveSelection(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const targets: Record<string, number> = {
      ArrowUp: index - 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 7,
      ArrowRight: index + 7,
      Home: 0,
      End: days.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(days.length - 1, target));
    setSelectedIndex(next);
    buttons.current[next]?.focus();
  }

  return (
    <>
      <p className="mt-2 text-sm leading-6 text-slate-600" id="activity-grid-help">
        日付を選ぶと件数を確認できます。表示が収まらない場合は横にスクロールできます。
        <span className="sr-only">
          キーボードでは上下矢印で1日、左右矢印で1週、Homeで最初の日、Endで今日へ移動します。
        </span>
      </p>
      <div className="mt-5 overflow-x-auto pb-3" ref={scrollRef}>
        <div className="flex w-max gap-2">
          <div
            aria-hidden="true"
            className="grid w-5 grid-rows-7 gap-1 pt-7 text-xs leading-3 text-slate-500"
          >
            {["月", "火", "水", "木", "金", "土", "日"].map((day) => (
              <span key={day}>{["月", "水", "金"].includes(day) ? day : ""}</span>
            ))}
          </div>
          <div>
            <div
              aria-hidden="true"
              className="mb-4 grid h-3 gap-1 text-xs leading-3 text-slate-500"
              style={{ gridTemplateColumns: `repeat(${weekCount}, 0.75rem)` }}
            >
              {Array.from(monthLabels, ([week, month]) => (
                <span className="w-max" key={week} style={{ gridColumn: week + 1 }}>
                  {month}
                </span>
              ))}
            </div>
            <fieldset
              aria-describedby="activity-grid-help"
              aria-label="直近365日の既読活動"
              className="m-0 grid min-w-0 grid-flow-col grid-rows-7 gap-1 border-0 p-0"
              style={{
                gridTemplateColumns: `repeat(${weekCount}, 0.75rem)`,
                gridTemplateRows: "repeat(7, 0.75rem)",
              }}
            >
              {["月", "火", "水", "木", "金", "土", "日"].slice(0, leadingDays).map((day) => (
                <span aria-hidden="true" key={day} />
              ))}
              {days.map((day, index) => (
                <button
                  aria-label={`${dateLabel(day.date)}: ${day.count}件既読`}
                  aria-pressed={index === selectedIndex}
                  className={`size-3 rounded-xs ${colorForCount(day.count)} ${index === selectedIndex ? "outline-2 outline-offset-1 outline-slate-900" : "outline-offset-1 hover:outline-1 hover:outline-slate-500"} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700`}
                  key={day.date}
                  onClick={() => setSelectedIndex(index)}
                  onFocus={() => setSelectedIndex(index)}
                  onKeyDown={(event) => moveSelection(event, index)}
                  ref={(element) => {
                    buttons.current[index] = element;
                  }}
                  tabIndex={index === selectedIndex ? 0 : -1}
                  title={`${dateLabel(day.date)}: ${day.count}件既読`}
                  type="button"
                />
              ))}
            </fieldset>
          </div>
        </div>
      </div>
      <ul
        aria-label="草の色と件数"
        className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600"
      >
        {levels.map((level) => (
          <li className="flex items-center gap-1.5" key={level.label}>
            <span aria-hidden="true" className={`size-3 rounded-xs ${level.color}`} />
            {level.label}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-5">
        <label className="block text-sm text-slate-600">
          日付を確認
          <input
            className="mt-1 block min-h-11 max-w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
            max={endDate}
            min={startDate}
            onChange={(event) => {
              const index = days.findIndex(({ date }) => date === event.target.value);
              if (index >= 0) setSelectedIndex(index);
            }}
            type="date"
            value={selectedDay?.date ?? endDate}
          />
        </label>
        <p aria-live="polite" aria-atomic="true" className="text-sm text-slate-600" role="status">
          {selectedDay === undefined ? "" : `${dateLabel(selectedDay.date)}　`}
          <strong className="text-lg font-semibold tabular-nums text-slate-900">
            {selectedDay?.count ?? 0}件
          </strong>
          既読
        </p>
      </div>
    </>
  );
}

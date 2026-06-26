"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronDown, ChevronRight, Printer, UtensilsCrossed } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";

type Group = RouterOutputs["today"]["getDailyView"][number];
type Task = Group["tasks"][number];

type SlotFilter = "ALL" | "MORNING" | "LUNCH" | "AFTERNOON" | "EVENING";
const PERIOD_ORDER = ["MORNING", "LUNCH", "AFTERNOON", "EVENING"] as const;
type Period = (typeof PERIOD_ORDER)[number];

type Entry = { quantity: string; unit?: string | null; instructions?: string | null };
type Column = { feedType: string; isMed: boolean };
type PeriodMatrix = {
  period: Period;
  animals: Array<{ id: string; name: string }>;
  columns: Column[];
  cells: Map<string, Entry[]>; // key: `${animalId}|${feedType}`
};

const cellKey = (animalId: string, feedType: string) => `${animalId}|${feedType}`;

function buildMatrices(tasks: Task[]): PeriodMatrix[] {
  const feedTasks = tasks.filter((t) => t.taskType === "FEEDING" || t.taskType === "MEDICATION");
  const result: PeriodMatrix[] = [];

  for (const period of PERIOD_ORDER) {
    const entries = feedTasks.filter((t) => t.slot === period && t.feedType);
    if (entries.length === 0) continue;

    const animals = new Map<string, string>();
    const columns = new Map<string, boolean>(); // feedType → isMed
    const cells = new Map<string, Entry[]>();

    for (const t of entries) {
      const feedType = t.feedType!;
      animals.set(t.animalId, t.animalName);
      const isMed = t.taskType === "MEDICATION";
      columns.set(feedType, (columns.get(feedType) ?? false) || isMed);
      const key = cellKey(t.animalId, feedType);
      const list = cells.get(key) ?? [];
      list.push({ quantity: t.quantity ?? "", unit: t.unit, instructions: t.instructions });
      cells.set(key, list);
    }

    result.push({
      period,
      animals: [...animals.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      // Feed columns first, then medications; each alphabetical.
      columns: [...columns.entries()]
        .map(([feedType, isMed]) => ({ feedType, isMed }))
        .sort((a, b) => Number(a.isMed) - Number(b.isMed) || a.feedType.localeCompare(b.feedType)),
      cells,
    });
  }
  return result;
}

function formatEntry(e: Entry): string {
  return `${e.quantity}${e.unit ? ` ${e.unit}` : ""}`;
}

export function FeedPrepTable({
  groups,
  slotFilter,
  barnName,
  date,
}: {
  groups: Group[];
  slotFilter: SlotFilter;
  barnName: string;
  date: string;
}) {
  const t = useTranslations("foodPrep");
  const tt = useTranslations("today");
  const locale = useLocale();
  const [collapsed, setCollapsed] = useState(false);

  const allMatrices = buildMatrices(groups.flatMap((g) => g.tasks));
  const matrices = slotFilter === "ALL" ? allMatrices : allMatrices.filter((m) => m.period === slotFilter);

  if (matrices.length === 0) return null;

  function printSheet() {
    const esc = (s: string) =>
      s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

    const tablesHtml = matrices
      .map((m) => {
        const head = `<th>${esc(t("animal"))}</th>${m.columns
          .map((c) => `<th>${esc(c.feedType)}${c.isMed ? ` <span class="med">${esc(t("med"))}</span>` : ""}</th>`)
          .join("")}`;
        const rows = m.animals
          .map((a) => {
            const cells = m.columns
              .map((c) => {
                const entries = m.cells.get(cellKey(a.id, c.feedType)) ?? [];
                const text = entries.length
                  ? entries
                      .map((e) => esc(formatEntry(e)) + (e.instructions ? `<div class="note">${esc(e.instructions)}</div>` : ""))
                      .join("<hr>")
                  : "—";
                return `<td>${text}</td>`;
              })
              .join("");
            return `<tr><th class="rowh">${esc(a.name)}</th>${cells}</tr>`;
          })
          .join("");
        return `<h2>${esc(tt(`slots.${m.period}`))}</h2><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
      })
      .join("");

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><title>${esc(t("printSheetTitle"))}</title><style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:20px 0 6px}
        .sub{color:#555;margin:0 0 8px;font-size:12px}
        table{border-collapse:collapse;width:100%;margin-bottom:8px}
        th,td{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top;font-size:12px}
        thead th,.rowh{background:#f3f3f3} .med{font-size:9px;border:1px solid #999;border-radius:8px;padding:0 4px}
        .note{color:#555;font-size:10px;margin-top:2px} hr{border:none;border-top:1px dashed #ccc;margin:3px 0}
      </style></head><body><h1>${esc(barnName)}</h1><p class="sub">${esc(t("title"))} — ${esc(formatDate(date, locale))}</p>${tablesHtml}</body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          className="flex items-center gap-2 font-semibold"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <UtensilsCrossed className="h-4 w-4 text-green-600" />
          {t("title")}
        </button>
        {!collapsed && (
          <Button variant="outline" size="sm" onClick={printSheet}>
            <Printer className="h-4 w-4 mr-2" />
            {t("print")}
          </Button>
        )}
      </div>

      {!collapsed && (
        <CardContent className="space-y-4 pt-0">
          {matrices.map((m) => (
            <div key={m.period} className="space-y-1">
              {slotFilter === "ALL" && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tt(`slots.${m.period}`)}
                </p>
              )}
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 font-medium">{t("animal")}</th>
                      {m.columns.map((c) => (
                        <th key={c.feedType} className="px-3 py-2 font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {c.feedType}
                            {c.isMed && <Badge variant="warning" className="text-[10px]">{t("med")}</Badge>}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.animals.map((a) => (
                      <tr key={a.id} className="border-b last:border-0 align-top">
                        <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium whitespace-nowrap">
                          {a.name}
                        </th>
                        {m.columns.map((c) => {
                          const entries = m.cells.get(cellKey(a.id, c.feedType)) ?? [];
                          return (
                            <td key={c.feedType} className="px-3 py-2">
                              {entries.length === 0 ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <div className="space-y-1">
                                  {entries.map((e, i) => (
                                    <div key={i}>
                                      <span className="whitespace-nowrap">{formatEntry(e)}</span>
                                      {e.instructions && (
                                        <div className="text-xs text-muted-foreground">{e.instructions}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

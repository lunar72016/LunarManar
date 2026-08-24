import type { Commission } from "@/lib/commission";

export type CompletedArchiveMonth = { key: string; label: string; commissions: Commission[] };
export type CompletedArchiveYear = { year: string; months: CompletedArchiveMonth[] };

function completedTimestamp(commission: Commission) {
  return commission.completedAt ?? commission.updatedAt;
}

export function groupCompletedCommissionsByYearMonth(commissions: Commission[]): CompletedArchiveYear[] {
  const months = new Map<string, Commission[]>();
  [...commissions].sort((a, b) => completedTimestamp(b) - completedTimestamp(a)).forEach((commission) => {
    const date = new Date(completedTimestamp(commission));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, [...(months.get(key) ?? []), commission]);
  });
  const years = new Map<string, CompletedArchiveMonth[]>();
  Array.from(months.entries()).sort(([a], [b]) => b.localeCompare(a)).forEach(([key, grouped]) => {
    const [year, month] = key.split("-");
    years.set(year, [...(years.get(year) ?? []), { key, label: `${Number(month)}月`, commissions: grouped }]);
  });
  return Array.from(years.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([year, grouped]) => ({ year, months: grouped }));
}

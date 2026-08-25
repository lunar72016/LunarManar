import { Commission, CommissionStatus, describeArtworkItems, displayPrice, formatCurrency, formatDisplayDate, getCommissionScheduleWeek, statusMeta, weekLabel } from "@/lib/commission";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Banknote, CalendarClock, Eye, Flame, UsersRound } from "lucide-react";

type CommissionCardProps = {
  commission: Commission;
  onView: (commission: Commission) => void;
  onAdvance?: (commission: Commission, next: CommissionStatus) => void;
  compact?: boolean;
};

export function CommissionCard({ commission, onView, onAdvance, compact = false }: CommissionCardProps) {
  return compact ? <CompactCommissionCard commission={commission} onView={onView} /> : <FullCommissionCard commission={commission} onView={onView} onAdvance={onAdvance} />;
}

const flow: Exclude<CommissionStatus, "archived">[] = ["inquiry", "confirmed", "awaiting_deposit", "queued", "sketching", "sketch_confirmed", "awaiting_balance", "finalizing", "completed"];

function FullCommissionCard({ commission, onView, onAdvance }: Omit<CommissionCardProps, "compact">) {
  const rush = commission.isRush;
  const scheduleWeek = getCommissionScheduleWeek(commission);
  const currentIndex = commission.status === "archived" ? -1 : flow.indexOf(commission.status);
  const next = currentIndex === -1 ? undefined : flow[currentIndex + 1];
  return <article className={`group relative overflow-hidden rounded-2xl border bg-[#fffdfa] p-4 shadow-[0_8px_30px_rgba(40,59,49,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(40,59,49,0.14)] ${rush ? "border-[#bc694c] ring-1 ring-[#bc694c]/35" : "border-[#cfd9cf]"}`}>
    <div className={`absolute left-0 top-0 h-1 w-full ${rush ? "bg-gradient-to-r from-[#bc694c] via-[#ead7c7] to-[#bc694c]" : "bg-gradient-to-r from-[#283b31] via-[#87a18d] to-[#283b31]"}`} />
    <div className="mt-2 flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-medium tracking-[0.12em] text-[#a9573c]">{commission.orderCode}</p><h3 className="mt-1 truncate font-display text-xl font-semibold text-[#283b31]">{commission.clientName}</h3></div><Badge variant="outline" className={`shrink-0 border px-2.5 py-1 text-[11px] font-medium ${statusMeta[commission.status].tone}`}>{statusMeta[commission.status].label}</Badge></div>
    <div className="mt-4 space-y-2.5 text-sm text-[#456153]"><div className="flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 text-[#6c9575]" /><span className="line-clamp-2">{describeArtworkItems(commission)}</span></div>{!rush && <div className="flex items-center gap-2 text-xs"><CalendarClock className="h-3.5 w-3.5 text-[#6c9575]" /><span>{commission.scheduleType === "reservation" ? "預約週次" : "排單週次"}：{weekLabel(scheduleWeek)}</span></div>}{commission.dueDate && <div className={`flex items-center gap-2 text-xs ${rush ? "font-semibold text-[#a9573c]" : "text-[#456153]"}`}><Flame className="h-3.5 w-3.5" />{rush ? "加急交稿" : "指定交稿"}：{formatDisplayDate(commission.dueDate)}{rush ? ` · ${commission.rushLevel}` : ""}</div>}<div className="flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-[#a9573c]" /><span>NT$ {displayPrice(commission)}</span></div></div>
    <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#edf5ed] p-2.5 text-xs"><PaymentMini label="訂金" amount={commission.depositAmount} state={commission.depositState} /><PaymentMini label="尾款" amount={commission.balanceAmount} state={commission.balanceState} /></div>
    <div className="mt-4 flex gap-2"><Button variant="outline" size="sm" className="flex-1 border-[#c9d5ca] bg-[#fffdfa] text-[#355b48] hover:bg-[#edf5ed]" onClick={() => onView(commission)}><Eye className="mr-1.5 h-3.5 w-3.5" />查看</Button>{next && onAdvance && <Button size="sm" className="flex-1 bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" onClick={() => onAdvance(commission, next)}>遞臻<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>}</div>
    {commission.scheduleType === "reservation" && <span className="absolute right-4 top-16 rounded-full bg-[#e8efe7] px-2 py-1 text-[10px] font-medium text-[#355b48]">預約單 · 未計入排單</span>}{rush && <span className="absolute right-4 top-16 rounded-full bg-[#fff0e9] px-2 py-1 text-[10px] font-medium text-[#a9573c]">加急優先 · {commission.rushLevel}</span>}
  </article>;
}

function CompactCommissionCard({ commission, onView }: Omit<CommissionCardProps, "compact">) {
  const scheduleWeek = getCommissionScheduleWeek(commission);
  const isArchived = commission.status === "archived";
  const isRush = commission.isRush;
  const scheduleLabel = isArchived ? "入卷日" : isRush ? "交稿日" : commission.scheduleType === "reservation" ? "預約日" : "排單日";
  const scheduleValue = isArchived ? formatDisplayDate(commission.archivedAt) : isRush ? (commission.dueDate ? formatDisplayDate(commission.dueDate) : "依加急安排") : weekLabel(scheduleWeek);
  const totalValue = commission.totalAmount === null || commission.totalAmount === undefined ? "待繪師報價" : `NT$ ${formatCurrency(commission.totalAmount)}`;
  return <article className={`relative overflow-hidden rounded-2xl border bg-[#fffdfa] p-3.5 shadow-[0_6px_20px_rgba(40,59,49,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(40,59,49,0.1)] ${isRush ? "border-[#bc694c] ring-1 ring-[#bc694c]/30" : "border-[#cfd9cf]"}`}><div className={`absolute left-0 top-0 h-1 w-full ${isRush ? "bg-gradient-to-r from-[#bc694c] via-[#ead7c7] to-[#bc694c]" : "bg-gradient-to-r from-[#283b31] via-[#87a18d] to-[#283b31]"}`} /><div className="mt-1 flex items-start justify-between gap-2"><h3 className="truncate font-display text-lg font-semibold text-[#283b31]">{commission.clientName}</h3>{isRush && <span className="shrink-0 rounded-full bg-[#fff0e9] px-2 py-0.5 text-[10px] font-medium text-[#a9573c]">急 · {commission.rushLevel}</span>}</div><div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#f4f8f3] p-2.5 text-xs"><CardDatum label="委託日" value={formatDisplayDate(commission.createdAt)} /><CardDatum label={scheduleLabel} value={scheduleValue} /><CardDatum label="總金額" value={totalValue} /></div><Button variant="outline" size="sm" className="mt-3 h-8 w-full border-[#c9d5ca] bg-[#fffdfa] text-[#355b48] hover:bg-[#edf5ed]" onClick={() => onView(commission)}><Eye className="mr-1.5 h-3.5 w-3.5" />查看</Button></article>;
}

function PaymentMini({ label, amount, state }: { label: string; amount: number | null; state: Commission["depositState"] }) { return <div><p className="text-[#456153]">{label}</p><p className="mt-1 font-semibold text-[#283b31]">{state === "unrecorded" ? "待補登" : `NT$ ${formatCurrency(amount)}`}</p></div>; }
function CardDatum({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[10px] text-[#6c7e70]">{label}</p><p className="mt-1 truncate font-medium text-[#355b48]">{value}</p></div>; }

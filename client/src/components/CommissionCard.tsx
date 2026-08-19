import { Commission, CommissionStatus, describeArtworkItems, displayPrice, formatCurrency, getCommissionScheduleWeek, isPrivacyReminderDue, statusMeta, weekLabel } from "@/lib/commission";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Banknote, CalendarClock, CheckCircle2, CircleDashed, Eye, Flame, ShieldCheck, UsersRound } from "lucide-react";

type CommissionCardProps = {
  commission: Commission;
  onView: (commission: Commission) => void;
  onAdvance: (commission: Commission, next: CommissionStatus) => void;
};

const flow: CommissionStatus[] = ["inquiry", "confirmed", "awaiting_deposit", "queued", "sketching", "sketch_confirmed", "awaiting_balance", "finalizing", "completed"];

export function CommissionCard({ commission, onView, onAdvance }: CommissionCardProps) {
  const currentIndex = flow.indexOf(commission.status);
  const next = flow[currentIndex + 1];
  const rush = commission.isRush;
  const privacyReminder = isPrivacyReminderDue(commission);
  const scheduleWeek = getCommissionScheduleWeek(commission);

  return (
    <article className={`group relative overflow-hidden rounded-2xl border bg-[#fffdfa] p-4 shadow-[0_8px_30px_rgba(40,59,49,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(40,59,49,0.14)] ${rush ? "border-[#bc694c] ring-1 ring-[#bc694c]/35" : "border-[#cfd9cf]"}`}>
      <div className={`absolute left-0 top-0 h-1 w-full ${rush ? "bg-gradient-to-r from-[#bc694c] via-[#ead7c7] to-[#bc694c]" : "bg-gradient-to-r from-[#283b31] via-[#87a18d] to-[#283b31]"}`} />
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-[0.12em] text-[#a9573c]">{commission.orderCode}</p>
          <h3 className="mt-1 truncate font-display text-xl font-semibold text-[#283b31]">{commission.clientName}</h3>
        </div>
        <Badge variant="outline" className={`shrink-0 border px-2.5 py-1 text-[11px] font-medium ${statusMeta[commission.status].tone}`}>{statusMeta[commission.status].label}</Badge>
      </div>

      <div className="mt-4 space-y-2.5 text-sm text-[#456153]">
        <div className="flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 text-[#6c9575]" /><span className="line-clamp-2">{describeArtworkItems(commission)}</span></div>
        <div className="flex items-center gap-2 text-xs"><CalendarClock className="h-3.5 w-3.5 text-[#6c9575]" /><span>{commission.scheduleType === "reservation" ? "預約週次" : "排單週次"}：{weekLabel(scheduleWeek)}</span></div>
        {commission.dueDate && <div className={`flex items-center gap-2 text-xs ${rush ? "font-semibold text-[#a9573c]" : "text-[#456153]"}`}><Flame className="h-3.5 w-3.5" />{rush ? "加急交稿" : "指定交稿"}：{new Date(commission.dueDate).toLocaleDateString("zh-TW")}{rush ? ` · ${commission.rushLevel}` : ""}</div>}
        {commission.estimatedWorkdays && <div className="flex items-center gap-2 text-xs"><CalendarClock className="h-3.5 w-3.5 text-[#6c9575]" />預計工期：{commission.estimatedWorkdays} 個工作天</div>}
        {privacyReminder && <div className="flex items-center gap-2 text-xs font-medium text-[#355b48]"><ShieldCheck className="h-3.5 w-3.5" />不可公開期限已到，可確認是否解除限制</div>}
        <div className="flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-[#a9573c]" /><span>NT$ {displayPrice(commission)}</span></div>
      </div>

      <div className={`mt-4 grid gap-2 rounded-xl bg-[#edf5ed] p-2.5 text-xs ${commission.additionalAmount && commission.additionalAmount !== 0 ? "grid-cols-3" : "grid-cols-2"}`}>
        <PaymentMini label="訂金" amount={commission.depositAmount} state={commission.depositState} />
        <PaymentMini label="尾款" amount={commission.balanceAmount} state={commission.balanceState} />
        {commission.additionalAmount && commission.additionalAmount !== 0 && <PaymentMini label="追加款" amount={commission.additionalQuoteAmount} state={commission.additionalState} />}
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 border-[#c9d5ca] bg-[#fffdfa] text-[#355b48] hover:bg-[#edf5ed]" onClick={() => onView(commission)}><Eye className="mr-1.5 h-3.5 w-3.5" />查看</Button>
        {next && <Button size="sm" className="flex-1 bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" onClick={() => onAdvance(commission, next)}>{next === "completed" ? "完成" : "推進"}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>}
      </div>
      {commission.scheduleType === "reservation" && <span className="absolute right-4 top-16 rounded-full bg-[#e8efe7] px-2 py-1 text-[10px] font-medium text-[#355b48]">預約單 · 未計入排單</span>}
      {rush && <span className="absolute right-4 top-16 rounded-full bg-[#fff0e9] px-2 py-1 text-[10px] font-medium text-[#a9573c]">加急優先 · {commission.rushLevel}</span>}
    </article>
  );
}

function PaymentMini({ label, amount, state }: { label: string; amount: number | null; state: Commission["depositState"] }) {
  const paid = state === "paid";
  return <div><div className="flex items-center gap-1 text-[#456153]">{paid ? <CheckCircle2 className="h-3.5 w-3.5 text-[#6c9575]" /> : <CircleDashed className="h-3.5 w-3.5 text-[#b8c7b9]" />}{label}</div><p className={`mt-1 font-semibold ${paid ? "text-[#283b31]" : "text-[#456153]"}`}>{state === "unrecorded" ? "待補登" : `NT$ ${formatCurrency(amount)}`}</p></div>;
}

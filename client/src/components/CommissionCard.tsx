import { Commission, CommissionStatus, displayPrice, formatCurrency, statusMeta } from "@/lib/commission";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Banknote, CheckCircle2, CircleDashed, Pencil, UsersRound } from "lucide-react";

type CommissionCardProps = {
  commission: Commission;
  onEdit: (commission: Commission) => void;
  onAdvance: (commission: Commission, next: CommissionStatus) => void;
};

const flow: CommissionStatus[] = ["inquiry", "confirmed", "awaiting_deposit", "queued", "sketching", "sketch_confirmed", "awaiting_balance", "finalizing", "completed"];

export function CommissionCard({ commission, onEdit, onAdvance }: CommissionCardProps) {
  const currentIndex = flow.indexOf(commission.status);
  const next = flow[currentIndex + 1];
  const paymentComplete = commission.depositState === "paid" && (commission.balanceState === "paid" || commission.balanceState === "unrecorded");

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[#ebe3dc] bg-[#fffdfa] p-4 shadow-[0_8px_30px_rgba(90,66,47,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(90,66,47,0.11)]">
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#c98f6b] via-[#f2cfad] to-[#628674]" />
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-[0.12em] text-[#9a8779]">{commission.orderCode}</p>
          <h3 className="mt-1 truncate font-display text-xl font-semibold text-[#294435]">{commission.clientName}</h3>
        </div>
        <Badge variant="outline" className={`shrink-0 border px-2.5 py-1 text-[11px] font-medium ${statusMeta[commission.status].tone}`}>{statusMeta[commission.status].label}</Badge>
      </div>

      <div className="mt-4 space-y-2.5 text-sm text-[#75685e]">
        <div className="flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 text-[#bd7c55]" /><span className="truncate">{commission.characterCount} 人 · {commission.artScopes.join("、") || "未填寫範圍"}</span></div>
        <div className="flex items-center gap-2"><Pencil className="h-3.5 w-3.5 text-[#bd7c55]" /><span className="truncate">{commission.finishLevels.join("、") || "未填寫精緻度"}</span></div>
        <div className="flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-[#bd7c55]" /><span>NT$ {displayPrice(commission)}</span></div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#f7f3ee] p-2.5 text-xs">
        <PaymentMini label="訂金" amount={commission.depositAmount} state={commission.depositState} />
        <PaymentMini label="尾款" amount={commission.balanceAmount} state={commission.balanceState} />
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 border-[#e1d7ce] bg-white text-[#5c5148] hover:bg-[#f8f3ed]" onClick={() => onEdit(commission)}><Pencil className="mr-1.5 h-3.5 w-3.5" />查看</Button>
        {next && <Button size="sm" className="flex-1 bg-[#355b48] text-white hover:bg-[#294a3a]" onClick={() => onAdvance(commission, next)}>{next === "completed" ? "完成" : "推進"}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>}
      </div>
      {commission.isRush && <span className="absolute right-4 top-16 rounded-full bg-[#fff0e7] px-2 py-1 text-[10px] font-medium text-[#aa5f42]">加急 · {commission.rushLevel}</span>}
    </article>
  );
}

function PaymentMini({ label, amount, state }: { label: string; amount: number | null; state: Commission["depositState"] }) {
  const paid = state === "paid";
  return <div><div className="flex items-center gap-1 text-[#96867a]">{paid ? <CheckCircle2 className="h-3.5 w-3.5 text-[#5c8a6f]" /> : <CircleDashed className="h-3.5 w-3.5 text-[#bd8a4d]" />}{label}</div><p className={`mt-1 font-semibold ${paid ? "text-[#3d6e52]" : "text-[#685d55]"}`}>{state === "unrecorded" ? "待補登" : `NT$ ${formatCurrency(amount)}`}</p></div>;
}

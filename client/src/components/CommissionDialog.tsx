import {
  Commission,
  CommissionStatus,
  PaymentState,
  artScopeOptions,
  commissionStatuses,
  contactChannels,
  createBlankCommission,
  finishLevelOptions,
  rushLevelOptions,
  statusMeta,
} from "@/lib/commission";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, CircleDollarSign, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type CommissionDialogProps = {
  commission: Commission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (commission: Commission) => Promise<void>;
};

const paymentLabels: Record<PaymentState, string> = {
  unrecorded: "待補登",
  unpaid: "未付",
  paid: "已收款",
};

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ToggleList({
  options,
  values,
  onChange,
}: {
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const checked = values.includes(option);
        return (
          <label
            key={option}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
              checked ? "border-[#59796b] bg-[#eaf0eb] text-[#274438]" : "border-[#e5ddd5] bg-white text-[#746c64]"
            }`}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(nextChecked) => {
                onChange(nextChecked ? [...values, option] : values.filter((value) => value !== option));
              }}
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}

export function CommissionDialog({ commission, open, onOpenChange, onSave }: CommissionDialogProps) {
  const [draft, setDraft] = useState<Commission>(createBlankCommission());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(commission ? structuredClone(commission) : createBlankCommission());
  }, [commission, open]);

  const update = <K extends keyof Commission>(key: K, value: Commission[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateBasePrice = (value: string) => {
    const basePriceMin = numberOrNull(value);
    const suggestedDeposit = basePriceMin === null ? null : Math.round(basePriceMin / 2);
    setDraft((current) => ({
      ...current,
      basePriceMin,
      basePriceText: value,
      depositAmount: suggestedDeposit,
      depositText: suggestedDeposit === null ? current.depositText : String(suggestedDeposit),
    }));
  };

  const submit = async () => {
    if (!draft.clientName.trim()) return;
    setSaving(true);
    try {
      const isNew = !commission;
      const now = Date.now();
      const statusChanged = commission && commission.status !== draft.status;
      const statusHistory = statusChanged
        ? [...draft.statusHistory, { status: draft.status, at: now, note: "由委託單編輯更新。" }]
        : draft.statusHistory;
      await onSave({
        ...draft,
        clientName: draft.clientName.trim(),
        orderCode: draft.orderCode.trim() || `CM-${String(now).slice(-6)}`,
        balanceAmount:
          draft.finalPrice !== null && draft.depositAmount !== null
            ? Math.max(draft.finalPrice - draft.depositAmount, 0)
            : null,
        statusHistory,
        completedAt: draft.status === "completed" ? draft.completedAt ?? now : null,
        createdAt: isNew ? now : draft.createdAt,
        updatedAt: now,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-[#e7ddd3] bg-[#fffdfa] p-0 sm:rounded-[1.5rem]">
        <div className="sticky top-0 z-10 border-b border-[#eee5dd] bg-[#fffdfa]/95 px-6 pb-4 pt-6 backdrop-blur sm:px-8">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#283b31]">{commission ? "編輯委託單" : "建立新委託單"}</DialogTitle>
            <DialogDescription className="text-[#80756c]">細節會儲存在你的個人 Firebase 資料庫，離線時也可繼續填寫。</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-8 px-6 py-6 sm:px-8">
          <section className="space-y-4">
            <SectionTitle icon={<Sparkles className="h-4 w-4" />} title="委託人與排單" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="委託人姓名 *"><Input value={draft.clientName} onChange={(event) => update("clientName", event.target.value)} placeholder="例如：Tiffany Su" /></Field>
              <Field label="委託單編號"><Input value={draft.orderCode} onChange={(event) => update("orderCode", event.target.value)} placeholder="未填將自動產生" /></Field>
              <Field label="聯絡管道">
                <Select value={draft.contactChannel} onValueChange={(value) => update("contactChannel", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{contactChannels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="帳號／聯絡方式"><Input value={draft.contactHandle} onChange={(event) => update("contactHandle", event.target.value)} placeholder="不會顯示在看板摘要" /></Field>
              <Field label="排單月份"><Input type="month" value={draft.queueMonth} onChange={(event) => update("queueMonth", event.target.value)} /></Field>
              <Field label="月內順序"><Input type="number" min="0" value={draft.queuePosition || ""} onChange={(event) => update("queuePosition", Number(event.target.value) || 0)} /></Field>
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle icon={<Check className="h-4 w-4" />} title="繪製內容" />
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <Field label="人物數量"><Input type="number" min="1" value={draft.characterCount} onChange={(event) => update("characterCount", Math.max(1, Number(event.target.value) || 1))} /></Field>
              <Field label="繪製範圍"><ToggleList options={artScopeOptions} values={draft.artScopes} onChange={(values) => update("artScopes", values)} /></Field>
            </div>
            <Field label="精緻度"><ToggleList options={finishLevelOptions} values={draft.finishLevels} onChange={(values) => update("finishLevels", values)} /></Field>
            <div className="rounded-xl border border-[#ece4dc] bg-[#fffcf8] p-4">
              <label className="flex items-center gap-3 text-sm font-medium text-[#4c5f53]">
                <Checkbox checked={draft.hasBackground} onCheckedChange={(value) => update("hasBackground", Boolean(value))} />
                包含背景／光影需求
              </label>
              {draft.hasBackground && <Input className="mt-3" value={draft.backgroundNote} onChange={(event) => update("backgroundNote", event.target.value)} placeholder="背景內容、光影、複雜度等" />}
            </div>
            <Field label="其他需求備註"><Textarea value={draft.requirements} onChange={(event) => update("requirements", event.target.value)} placeholder="人物設定、動作、授權、不可公開、R15／R18 或其他細節" /></Field>
          </section>

          <section className="space-y-4">
            <SectionTitle icon={<CircleDollarSign className="h-4 w-4" />} title="報價與付款" />
            <div className="rounded-xl border border-[#e9dfd3] bg-[#f8f3ec] p-4">
              <label className="flex items-center gap-3 text-sm font-medium text-[#584f43]">
                <Checkbox checked={draft.isRush} onCheckedChange={(value) => update("isRush", Boolean(value))} />
                此委託為加急件
              </label>
              {draft.isRush && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Select value={draft.rushLevel} onValueChange={(value) => update("rushLevel", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{rushLevelOptions.map((level) => <SelectItem value={level} key={level}>{level}</SelectItem>)}</SelectContent></Select>
                  <Input type="number" min="0" value={draft.rushFee ?? ""} onChange={(event) => update("rushFee", numberOrNull(event.target.value))} placeholder="手動加急費" />
                  <Input type="number" min="1" step="0.1" value={draft.rushMultiplier ?? ""} onChange={(event) => update("rushMultiplier", numberOrNull(event.target.value))} placeholder="加急倍率（選填）" />
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="底價／預估價格"><Input inputMode="numeric" value={draft.basePriceText} onChange={(event) => updateBasePrice(event.target.value)} placeholder="例如 5200 或 4000-5000" /></Field>
              <Field label="訂金（自動為底價 50%）"><Input inputMode="numeric" value={draft.depositText} onChange={(event) => update("depositText", event.target.value)} placeholder="例如 400" /></Field>
              <Field label="最終價格"><Input inputMode="numeric" value={draft.finalPriceText} onChange={(event) => update("finalPriceText", event.target.value)} placeholder="例如 1500↓ 或 ?" /></Field>
              <Field label="訂金狀態"><PaymentSelect value={draft.depositState} onChange={(value) => update("depositState", value)} /></Field>
              <Field label="尾款狀態"><PaymentSelect value={draft.balanceState} onChange={(value) => update("balanceState", value)} /></Field>
              <Field label="收款方式"><Input value={draft.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)} placeholder="例如：郵局轉帳" /></Field>
            </div>
            <Field label="收款備註"><Textarea value={draft.paymentNote} onChange={(event) => update("paymentNote", event.target.value)} placeholder="交易末五碼、付款提醒或核帳紀錄" /></Field>
          </section>

          <section className="space-y-4">
            <SectionTitle icon={<Check className="h-4 w-4" />} title="草稿與工作進度" />
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="目前階段">
                <Select value={draft.status} onValueChange={(value) => update("status", value as CommissionStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{commissionStatuses.map((status) => <SelectItem value={status} key={status}>{statusMeta[status].label}</SelectItem>)}</SelectContent></Select>
              </Field>
              <Field label="草稿提供時間"><Input type="datetime-local" value={toInputDate(draft.sketchSentAt)} onChange={(event) => update("sketchSentAt", event.target.value ? new Date(event.target.value).getTime() : null)} /></Field>
              <Field label="草稿確認時間"><Input type="datetime-local" value={toInputDate(draft.sketchConfirmedAt)} onChange={(event) => update("sketchConfirmedAt", event.target.value ? new Date(event.target.value).getTime() : null)} /></Field>
            </div>
            <Field label="草稿修改／確認備註"><Textarea value={draft.revisionNote} onChange={(event) => update("revisionNote", event.target.value)} placeholder="記錄草稿回覆、調整項目或確認內容" /></Field>
          </section>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#eee5dd] bg-[#fffdfa]/95 px-6 py-4 backdrop-blur sm:px-8">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button className="bg-[#355b48] text-white hover:bg-[#294a3a]" onClick={submit} disabled={saving || !draft.clientName.trim()}>{saving ? "儲存中…" : "儲存委託單"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-[#51463d]"><span>{label}</span>{children}</label>;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-[#314d3e]"><span className="text-[#bd7c55]">{icon}</span>{title}</h3>;
}

function PaymentSelect({ value, onChange }: { value: PaymentState; onChange: (value: PaymentState) => void }) {
  return <Select value={value} onValueChange={(next) => onChange(next as PaymentState)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(paymentLabels) as PaymentState[]).map((item) => <SelectItem value={item} key={item}>{paymentLabels[item]}</SelectItem>)}</SelectContent></Select>;
}

function toInputDate(value: number | null) {
  if (!value) return "";
  const date = new Date(value - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

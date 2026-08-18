import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Commission, CommissionStatus, LicenseOption, PaymentState, applyAutomaticPricing, artScopeOptions, commissionStatuses, contactChannels, createBlankCommission, finishLevelOptions, formatCurrency, getDefaultMultiplier, rushLevelOptions, statusMeta } from "@/lib/commission";
import { StudioSettings } from "@/lib/studioSettings";
import { Check, CircleDollarSign, Gauge, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CommissionDialogProps = {
  commission: Commission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (commission: Commission) => Promise<void>;
  onDelete?: (commission: Commission) => Promise<void>;
  settings: StudioSettings;
};

const paymentLabels: Record<PaymentState, string> = { unrecorded: "待補登", unpaid: "未付", paid: "已收款" };
const licenseLabels: Record<LicenseOption, string> = { commercial: "商用", promotion: "宣傳", buyout: "買斷" };

function numberOrNull(value: string) { const parsed = Number(value); return value.trim() && Number.isFinite(parsed) ? parsed : null; }

function ToggleList({ options, values, onChange }: { options: string[]; values: string[]; onChange: (next: string[]) => void }) {
  return <div className="flex flex-wrap gap-2">{options.map((option) => { const checked = values.includes(option); return <label key={option} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${checked ? "border-[#59796b] bg-[#eaf0eb] text-[#274438]" : "border-[#e5ddd5] bg-white text-[#746c64]"}`}><Checkbox checked={checked} onCheckedChange={(nextChecked) => onChange(nextChecked ? [...values, option] : values.filter((value) => value !== option))} />{option}</label>; })}</div>;
}

export function CommissionDialog({ commission, open, onOpenChange, onSave, onDelete, settings }: CommissionDialogProps) {
  const [draft, setDraft] = useState<Commission>(createBlankCommission());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const recalculate = (current: Commission, resetMultiplier = false) => {
    const defaultMultiplier = getDefaultMultiplier(settings, current);
    const next = { ...current, rushMultiplier: resetMultiplier || !current.rushMultiplier ? defaultMultiplier : current.rushMultiplier };
    return applyAutomaticPricing(settings, next);
  };

  useEffect(() => {
    if (!open) return;
    if (commission) {
      setDraft({ ...createBlankCommission(), ...structuredClone(commission), licenses: commission.licenses ?? [], customArtScope: commission.customArtScope ?? "", estimatedPrice: commission.estimatedPrice ?? null, additionalAmount: commission.additionalAmount ?? null });
    } else {
      setDraft(recalculate(createBlankCommission(), true));
    }
  }, [commission, open]);

  const update = <K extends keyof Commission>(key: K, value: Commission[K], recalculatePrice = false, resetMultiplier = false) => setDraft((current) => recalculatePrice ? recalculate({ ...current, [key]: value }, resetMultiplier) : { ...current, [key]: value });

  const updateLicenses = (option: LicenseOption, checked: boolean) => {
    setDraft((current) => {
      const existing = current.licenses ?? [];
      let licenses = checked ? [...existing, option] : existing.filter((item) => item !== option);
      if (checked && option === "commercial") licenses = licenses.filter((item) => item !== "promotion");
      if (checked && option === "promotion") licenses = licenses.filter((item) => item !== "commercial");
      return recalculate({ ...current, licenses: Array.from(new Set(licenses)) }, true);
    });
  };

  const submit = async () => {
    if (!draft.clientName.trim()) return;
    setSaving(true);
    try {
      const isNew = !commission;
      const now = Date.now();
      const changedStatus = commission && commission.status !== draft.status;
      const next = recalculate({ ...draft, clientName: draft.clientName.trim(), orderCode: draft.orderCode.trim() || `CM-${String(now).slice(-6)}`, statusHistory: changedStatus ? [...draft.statusHistory, { status: draft.status, at: now, note: "由委託單編輯更新。" }] : draft.statusHistory, completedAt: draft.status === "completed" ? draft.completedAt ?? now : null, createdAt: isNew ? now : draft.createdAt, updatedAt: now });
      await onSave(next);
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!commission || !onDelete) return;
    setDeleting(true);
    try { await onDelete(commission); onOpenChange(false); } finally { setDeleting(false); }
  };

  const maxMultiplier = useMemo(() => Math.max(5, getDefaultMultiplier(settings, draft) * 2), [draft, settings]);
  const scopeHasOther = draft.artScopes.includes("其他");

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-[#e7ddd3] bg-[#fffdfa] p-0 sm:rounded-[1.5rem]"><div className="sticky top-0 z-10 border-b border-[#eee5dd] bg-[#fffdfa]/95 px-6 pb-4 pt-6 backdrop-blur sm:px-8"><DialogHeader><DialogTitle className="font-display text-2xl text-[#283b31]">{commission ? "編輯委託單" : "建立新委託單"}</DialogTitle><DialogDescription className="text-[#80756c]">範圍、精緻度與設定頁的價格表會自動計算底價和收款金額。</DialogDescription></DialogHeader></div>
    <div className="space-y-8 px-6 py-6 sm:px-8">
      <section className="space-y-4"><SectionTitle icon={<Sparkles className="h-4 w-4" />} title="委託人與排單" /><div className="grid gap-4 md:grid-cols-2"><Field label="委託人姓名 *"><Input value={draft.clientName} onChange={(event) => update("clientName", event.target.value)} placeholder="例如：Tiffany Su" /></Field><Field label="委託單編號"><Input value={draft.orderCode} onChange={(event) => update("orderCode", event.target.value)} placeholder="未填將自動產生" /></Field><Field label="聯絡管道"><Select value={draft.contactChannel} onValueChange={(value) => update("contactChannel", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{contactChannels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent></Select></Field><Field label="帳號／聯絡方式"><Input value={draft.contactHandle} onChange={(event) => update("contactHandle", event.target.value)} /></Field><Field label="排單月份"><Input type="month" value={draft.queueMonth} onChange={(event) => update("queueMonth", event.target.value)} /></Field><Field label="月內順序"><Input type="number" min="1" value={draft.queuePosition || ""} onChange={(event) => update("queuePosition", Number(event.target.value) || 0)} placeholder="未填會排在當月最後" /><span className="text-xs font-normal text-[#9b8b7e]">同月份已有相同順序時，原有排單會自動往後遞補。</span></Field></div></section>
      <section className="space-y-4"><SectionTitle icon={<Check className="h-4 w-4" />} title="繪製內容" /><div className="grid gap-4 md:grid-cols-[180px_1fr]"><Field label="人物數量"><Input type="number" min="1" value={draft.characterCount} onChange={(event) => update("characterCount", Math.max(1, Number(event.target.value) || 1))} /></Field><Field label="繪製範圍"><ToggleList options={artScopeOptions} values={draft.artScopes} onChange={(values) => update("artScopes", values, true)} /></Field></div>{scopeHasOther && <Field label="其他繪製範圍"><Input value={draft.customArtScope} onChange={(event) => update("customArtScope", event.target.value)} placeholder="例如：徽章、表情差分、特殊尺寸" /></Field>}<Field label="精緻度"><ToggleList options={finishLevelOptions} values={draft.finishLevels} onChange={(values) => update("finishLevels", values, true)} /></Field><div className="rounded-xl border border-[#ece4dc] bg-[#fffcf8] p-4"><label className="flex items-center gap-3 text-sm font-medium text-[#4c5f53]"><Checkbox checked={draft.hasBackground} onCheckedChange={(value) => update("hasBackground", Boolean(value))} />包含背景／光影需求</label>{draft.hasBackground && <Input className="mt-3" value={draft.backgroundNote} onChange={(event) => update("backgroundNote", event.target.value)} placeholder="背景內容、光影、複雜度等" />}</div><Field label="其他需求備註"><Textarea value={draft.requirements} onChange={(event) => update("requirements", event.target.value)} placeholder="人物設定、動作、授權或不可公開等細節" /></Field></section>
      <section className="space-y-4">
        <SectionTitle icon={<Gauge className="h-4 w-4" />} title="加急與權利" />
        <div className="rounded-xl border border-[#e9dfd3] bg-[#f8f3ec] p-4">
          <label className="flex items-center gap-3 text-sm font-medium text-[#584f43]"><Checkbox checked={draft.isRush} onCheckedChange={(value) => update("isRush", Boolean(value), true, true)} />此委託為加急件</label>
          {draft.isRush && <div className="mt-4"><Field label="加急層級"><Select value={draft.rushLevel} onValueChange={(value) => update("rushLevel", value, true, true)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{rushLevelOptions.map((level) => <SelectItem value={level} key={level}>{level}</SelectItem>)}</SelectContent></Select></Field></div>}
        </div>
        <div className="rounded-xl border border-[#ece4dc] bg-[#fffcf8] p-4"><p className="text-sm font-medium text-[#51463d]">權利選項</p><p className="mt-1 text-xs text-[#948477]">商用與宣傳二選一；買斷可與其中一項及加急並用。複選時預設只取最高倍率。</p><div className="mt-3 flex flex-wrap gap-2">{(Object.keys(licenseLabels) as LicenseOption[]).map((option) => <label key={option} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${draft.licenses.includes(option) ? "border-[#59796b] bg-[#eaf0eb] text-[#274438]" : "border-[#e5ddd5] bg-white text-[#746c64]"}`}><Checkbox checked={draft.licenses.includes(option)} onCheckedChange={(checked) => updateLicenses(option, Boolean(checked))} />{licenseLabels[option]}</label>)}</div></div>
        {(draft.isRush || draft.licenses.length > 0) && <div className="rounded-xl border border-[#d9e7db] bg-[#f3f8f3] p-4"><Label>套用倍率（可手動調整）</Label><p className="mt-1 text-xs text-[#789080]">預設取已選加急／權利中的最高倍率；可用滑桿覆寫本張委託的倍率。</p><div className="mt-3 flex items-center gap-3"><input className="w-full accent-[#355b48]" type="range" min="1" max={maxMultiplier} step="0.01" value={draft.rushMultiplier ?? 1} onChange={(event) => update("rushMultiplier", Number(event.target.value), true)} /><span className="w-16 rounded-lg bg-white px-2 py-1 text-center text-sm font-semibold text-[#355b48]">×{(draft.rushMultiplier ?? 1).toFixed(2)}</span></div></div>}
      </section>
      <section className="space-y-4"><SectionTitle icon={<CircleDollarSign className="h-4 w-4" />} title="價格與付款" /><div className="grid gap-4 md:grid-cols-3"><MoneyField label="底價" value={draft.basePriceMin} /><MoneyField label="訂金" value={draft.depositAmount} /><EditableMoneyField label="估價" value={draft.estimatedPrice} onChange={(value) => update("estimatedPrice", value, true)} /><MoneyField label="報價" value={draft.finalPrice} /><MoneyField label="尾款" value={draft.balanceAmount} /><EditableMoneyField label="追加款" value={draft.additionalAmount} onChange={(value) => update("additionalAmount", value, true)} /><MoneyField label="追加報價" value={draft.additionalQuoteAmount} /><MoneyField label="總額" value={draft.totalAmount} emphasize /></div><div className="grid gap-4 md:grid-cols-3"><Field label="訂金狀態"><PaymentSelect value={draft.depositState} onChange={(value) => update("depositState", value)} /></Field><Field label="尾款狀態"><PaymentSelect value={draft.balanceState} onChange={(value) => update("balanceState", value)} /></Field><Field label="收款方式"><Input value={draft.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)} placeholder="例如：郵局轉帳" /></Field></div><Field label="收款備註"><Textarea value={draft.paymentNote} onChange={(event) => update("paymentNote", event.target.value)} /></Field></section>
      <section className="space-y-4"><SectionTitle icon={<Check className="h-4 w-4" />} title="草稿與工作進度" /><div className="grid gap-4 md:grid-cols-3"><Field label="目前階段"><Select value={draft.status} onValueChange={(value) => update("status", value as CommissionStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{commissionStatuses.map((status) => <SelectItem value={status} key={status}>{statusMeta[status].label}</SelectItem>)}</SelectContent></Select></Field><Field label="草稿提供時間"><Input type="datetime-local" value={toInputDate(draft.sketchSentAt)} onChange={(event) => update("sketchSentAt", event.target.value ? new Date(event.target.value).getTime() : null)} /></Field><Field label="草稿確認時間"><Input type="datetime-local" value={toInputDate(draft.sketchConfirmedAt)} onChange={(event) => update("sketchConfirmedAt", event.target.value ? new Date(event.target.value).getTime() : null)} /></Field></div><Field label="草稿修改／確認備註"><Textarea value={draft.revisionNote} onChange={(event) => update("revisionNote", event.target.value)} /></Field></section>
    </div>
    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[#eee5dd] bg-[#fffdfa]/95 px-6 py-4 backdrop-blur sm:px-8"><div>{commission && onDelete && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="border-[#edc9bf] text-[#a14f3d] hover:bg-[#fff1ec] hover:text-[#8d4030]" disabled={saving || deleting}><Trash2 className="mr-1.5 h-4 w-4" />刪除此排單</Button></AlertDialogTrigger><AlertDialogContent className="border-[#ecd8cf] bg-[#fffdfa]"><AlertDialogHeader><AlertDialogTitle className="font-display text-xl text-[#543a32]">確定刪除「{commission.clientName}」的排單？</AlertDialogTitle><AlertDialogDescription className="leading-6 text-[#806c61]">此動作會從工作台與 Firestore 移除這筆資料，無法復原。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>保留排單</AlertDialogCancel><AlertDialogAction onClick={() => void remove()} disabled={deleting} className="bg-[#a6523e] text-white hover:bg-[#8e4030]">{deleting ? "刪除中…" : "確定刪除"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div><div className="flex gap-3"><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>取消</Button><Button className="bg-[#355b48] text-white hover:bg-[#294a3a]" onClick={submit} disabled={saving || deleting || !draft.clientName.trim()}>{saving ? "儲存中…" : "儲存委託單"}</Button></div></div>
  </DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium text-[#51463d]"><span>{label}</span>{children}</label>; }
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) { return <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-[#314d3e]"><span className="text-[#bd7c55]">{icon}</span>{title}</h3>; }
function PaymentSelect({ value, onChange }: { value: PaymentState; onChange: (value: PaymentState) => void }) { return <Select value={value} onValueChange={(next) => onChange(next as PaymentState)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(paymentLabels) as PaymentState[]).map((item) => <SelectItem value={item} key={item}>{paymentLabels[item]}</SelectItem>)}</SelectContent></Select>; }
function MoneyField({ label, value, emphasize = false }: { label: string; value: number | null; emphasize?: boolean }) { return <Field label={label}><Input readOnly value={value === null ? "—" : `NT$ ${formatCurrency(value)}`} className={emphasize ? "border-[#b9d2bf] bg-[#eef6ef] font-semibold text-[#315d42]" : "bg-[#f8f5f0] text-[#675b51]"} /></Field>; }
function EditableMoneyField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) { return <Field label={label}><Input type="number" min="0" step="1" value={value ?? ""} onChange={(event) => onChange(numberOrNull(event.target.value))} placeholder="0" /></Field>; }
function toInputDate(value: number | null) { if (!value) return ""; const date = new Date(value - new Date().getTimezoneOffset() * 60_000); return date.toISOString().slice(0, 16); }

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { zhTW } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArtworkItem, Commission, CommissionStatus, LicenseOption, PaymentState, RushLevel, ScheduleType, addWeeks, applyAutomaticPricing, applyRushDecision, autoDetectRushLevel, commissionStatuses, contactChannels, createArtworkItem, createBlankCommission, formatCurrency, formatDateInput, getAvailableFinishes, getAvailableQSizes, getAvailableScopes, getSelectedMultiplierRange, isDateAfter, rushLevelOptions, startOfWeek, statusMeta, weekLabel } from "@/lib/commission";
import { StudioSettings } from "@/lib/studioSettings";
import { CalendarClock, CalendarDays, Check, CircleDollarSign, Gauge, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CommissionDialogProps = {
  commission: Commission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (commission: Commission) => Promise<void>;
  settings: StudioSettings;
  defaultScheduleWeekStart: number;
  lastQueuedWeek: number | null;
};

const paymentLabels: Record<PaymentState, string> = { unrecorded: "待補登", unpaid: "未付", paid: "已收款" };
const licenseLabels: Record<LicenseOption, string> = { commercial: "商用", promotion: "宣傳", buyout: "買斷" };
const privacyLabels = { open: "可公開", permanent: "永久不可公開", until: "指定日期前不可公開" } as const;
const chineseNumbers = ["", "壹", "貳", "參", "肆", "伍", "陸", "柒", "捌", "玖"];
function chineseOrdinal(value: number) {
  if (value <= 9) return chineseNumbers[value] ?? String(value);
  if (value === 10) return "拾";
  if (value < 20) return `拾${chineseNumbers[value - 10]}`;
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${chineseNumbers[tens] ?? tens}拾${ones ? chineseNumbers[ones] : ""}`;
}

function numberOrNull(value: string) { const parsed = Number(value); return value.trim() && Number.isFinite(parsed) ? parsed : null; }
function toInputDate(value: number | null) { return !value ? "" : new Date(value - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }

export function CommissionDialog({ commission, open, onOpenChange, onSave, settings, defaultScheduleWeekStart, lastQueuedWeek }: CommissionDialogProps) {
  const [draft, setDraft] = useState<Commission>(createBlankCommission());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const availableScopes = useMemo(() => getAvailableScopes(settings), [settings]);
  const weekOptions = useMemo(() => {
    const selected = commission?.scheduleWeekStart ?? defaultScheduleWeekStart;
    const first = addWeeks(startOfWeek(Math.min(selected, defaultScheduleWeekStart)), -8);
    return Array.from({ length: 41 }, (_, index) => addWeeks(first, index));
  }, [commission?.scheduleWeekStart, defaultScheduleWeekStart]);

  const recalculate = (current: Commission, resetMultiplier = false) => {
    const range = getSelectedMultiplierRange(settings, current);
    return applyAutomaticPricing(settings, { ...current, rushMultiplier: resetMultiplier || current.rushMultiplier === null ? range.min : current.rushMultiplier });
  };
  const makeInitialItem = () => {
    const scope = availableScopes[0] as ArtworkItem["artScope"] | undefined;
    if (!scope) return null;
    if (scope === "Q版") { const qSize = getAvailableQSizes(settings)[0]; return qSize ? createArtworkItem({ artScope: scope, qSize }) : null; }
    const finish = getAvailableFinishes(settings, scope)[0];
    return finish ? createArtworkItem({ artScope: scope, finishLevel: finish, qSize: null }) : null;
  };
  const detectRush = (current: Commission, dueDate: number | null, rushRequestedAt = current.rushRequestedAt ?? Date.now()) => {
    return recalculate(applyRushDecision({ ...current, dueDate }, lastQueuedWeek, rushRequestedAt), true);
  };

  useEffect(() => {
    if (!open) return;
    const legacy = commission ? structuredClone(commission) : createBlankCommission();
    const normalized: Commission = {
      ...createBlankCommission(),
      ...legacy,
      scheduleWeekStart: legacy.scheduleWeekStart ?? defaultScheduleWeekStart,
      scheduleType: legacy.scheduleType ?? "queued",
      estimatedWorkdays: legacy.estimatedWorkdays ?? null,
      rushRequestedAt: legacy.rushRequestedAt ?? null,
      licenses: legacy.licenses ?? [], artworkItems: legacy.artworkItems ?? [], characterSettingNote: legacy.characterSettingNote ?? "", poseNote: legacy.poseNote ?? "", costumeDesignNote: legacy.costumeDesignNote ?? "", accessoryNote: legacy.accessoryNote ?? "", deliveryPreference: legacy.deliveryPreference ?? "unspecified", privacyMode: legacy.privacyMode ?? "open", additionalState: legacy.additionalState ?? "unrecorded", depositPaidAt: legacy.depositPaidAt ?? Date.now(), balancePaidAt: legacy.balancePaidAt ?? Date.now(), additionalPaidAt: legacy.additionalPaidAt ?? null, clientPortal: legacy.clientPortal ?? { enabled: false, accessTokenHash: null, expiresAt: null, referenceFiles: [] },
    };
    if (!commission && !normalized.artworkItems.length) { const initial = makeInitialItem(); if (initial) normalized.artworkItems = [initial]; }
    setSaveError(null);
    setDraft(normalized.deliveryPreference === "date" && !commission ? detectRush(normalized, normalized.dueDate) : recalculate(normalized, !commission));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commission, defaultScheduleWeekStart, lastQueuedWeek, open, settings]);

  const update = <K extends keyof Commission>(key: K, value: Commission[K], shouldRecalculate = false, resetMultiplier = false) => setDraft((current) => shouldRecalculate ? recalculate({ ...current, [key]: value }, resetMultiplier) : { ...current, [key]: value });
  const updateScheduleWeek = (scheduleWeekStart: number) => setDraft((current) => ({ ...current, scheduleWeekStart }));
  const updateAdditionalAmount = (additionalAmount: number | null) => setDraft((current) => recalculate({ ...current, additionalAmount }));
  const updatePaymentState = (field: "deposit" | "balance", state: PaymentState) => setDraft((current) => ({ ...current, [`${field}State`]: state, [`${field}PaidAt`]: state === "paid" ? current[`${field}PaidAt` as keyof Commission] ?? Date.now() : current[`${field}PaidAt` as keyof Commission] } as Commission));
  const updateArtItem = (id: string, patch: Partial<ArtworkItem>) => setDraft((current) => recalculate({ ...current, artworkItems: current.artworkItems.map((item) => {
    if (item.id !== id) return item;
    const next = { ...item, ...patch };
    if (patch.artScope === "Q版") return { ...next, qSize: getAvailableQSizes(settings)[0] ?? next.qSize ?? "2頭身" };
    if (patch.artScope) { const finish = getAvailableFinishes(settings, patch.artScope)[0]; return { ...next, finishLevel: finish ?? next.finishLevel, qSize: null }; }
    return next;
  }) }));
  const addArtItem = () => { const item = makeInitialItem(); if (item) setDraft((current) => recalculate({ ...current, artworkItems: [...current.artworkItems, item] })); };
  const removeArtItem = (id: string) => setDraft((current) => recalculate({ ...current, artworkItems: current.artworkItems.filter((item) => item.id !== id) }));
  const updateLicenses = (option: LicenseOption, checked: boolean) => setDraft((current) => {
    const currentLicenses = current.licenses ?? [];
    let licenses = checked ? [...currentLicenses, option] : currentLicenses.filter((item) => item !== option);
    if (checked && option === "commercial") licenses = licenses.filter((item) => item !== "promotion");
    if (checked && option === "promotion") licenses = licenses.filter((item) => item !== "commercial");
    return recalculate({ ...current, licenses: Array.from(new Set(licenses)) }, true);
  });
  const changeDeliveryPreference = (value: Commission["deliveryPreference"]) => setDraft((current) => value === "unspecified" ? recalculate({ ...current, deliveryPreference: value, dueDate: null, isRush: false, rushRequestedAt: null }, true) : { ...current, deliveryPreference: value, rushRequestedAt: current.rushRequestedAt ?? Date.now() });
  const redetectRush = () => setDraft((current) => detectRush(current, current.dueDate, current.rushRequestedAt ?? Date.now()));
  const submit = async () => {
    if (!draft.clientName.trim()) { setSaveError("請填寫委託人姓名後再儲存畫約。"); return; }
    setSaving(true);
    setSaveError(null);
    try {
      if (isDateAfter(draft.rushRequestedAt, draft.dueDate)) { setSaveError("加急申請日不得晚於加急交稿日，請修正日期後再儲存。"); return; }
      const now = Date.now();
      const changedStatus = commission && commission.status !== draft.status;
      const next = recalculate({ ...draft, scheduleWeekStart: draft.scheduleWeekStart ?? defaultScheduleWeekStart, clientName: draft.clientName.trim(), orderCode: draft.orderCode.trim() || `CM-${String(now).slice(-6)}`, statusHistory: changedStatus ? [...draft.statusHistory, { status: draft.status, at: now, note: "由委託單編輯更新。" }] : draft.statusHistory, completedAt: draft.status === "completed" ? draft.completedAt ?? now : null, createdAt: commission ? draft.createdAt : now, updatedAt: now });
      await onSave(next);
      onOpenChange(false);
    } catch (error) { setSaveError(error instanceof Error ? error.message : "儲存時發生問題，請稍後重試。"); } finally { setSaving(false); }
  };
  const multiplierRange = getSelectedMultiplierRange(settings, draft);
  const automaticRushLevel = draft.isRush ? draft.rushLevel : autoDetectRushLevel(draft.dueDate, lastQueuedWeek, draft.rushRequestedAt ?? Date.now());
  const isReservation = draft.scheduleType === "reservation";

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="hui-dialog min-w-0 max-h-[88vh] w-full max-w-[calc(100%-1rem)] overflow-x-hidden overflow-y-scroll p-0 sm:max-w-[36rem] sm:rounded-[1.5rem]"><div className="sticky top-0 z-10 border-b border-[#d8ded5] bg-[#fffdfa]/95 px-4 pb-4 pt-6 backdrop-blur sm:px-8"><DialogHeader><DialogTitle className="font-display text-2xl text-[#283b31]">{commission ? "編輯畫約" : "寫畫起約"}</DialogTitle><DialogDescription className="text-[#456153]">先安放預計週次、作畫內容與期限；系統會依交稿日自動判斷加急。</DialogDescription></DialogHeader></div>
    <div className="min-w-0 space-y-8 px-4 py-6 sm:px-8">
      <section className="space-y-4"><SectionTitle icon={<Sparkles className="h-4 w-4" />} title="寄墨主與排程" /><div className="grid gap-4 md:grid-cols-2"><Field label="寄墨主姓名 *"><Input value={draft.clientName} onChange={(event) => update("clientName", event.target.value)} /></Field><Field label="聯絡管道"><Select value={draft.contactChannel} onValueChange={(value) => update("contactChannel", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{contactChannels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent></Select></Field><Field label="委託單編號"><Input value={draft.orderCode} onChange={(event) => update("orderCode", event.target.value)} placeholder="未填將自動產生" /></Field><Field label="帳號／聯絡方式"><Input value={draft.contactHandle} onChange={(event) => update("contactHandle", event.target.value)} /></Field></div>
        <div className="rounded-2xl border border-[#c9d5ca] bg-[#f4f8f3] p-4"><div className="grid grid-cols-[minmax(0,1fr)_5.75rem] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_5.75rem_minmax(0,1fr)]"><div className="col-span-2 sm:col-span-1"><Field label="預計排單週次"><Select value={String(draft.scheduleWeekStart ?? defaultScheduleWeekStart)} onValueChange={(value) => updateScheduleWeek(Number(value))}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent>{weekOptions.map((week) => <SelectItem key={week} value={String(week)}>{weekLabel(week)}</SelectItem>)}</SelectContent></Select></Field></div><Field label="月內順序"><Input readOnly value={draft.queuePosition > 0 ? String(draft.queuePosition) : "—"} className="h-10 bg-[#fffdfa] px-2 text-center text-[#456153]" /></Field><label className="col-span-2 flex h-10 min-w-0 items-center gap-2 rounded-xl border border-[#c9d5ca] bg-[#fffdfa] px-3 text-sm font-medium text-[#355b48] sm:col-span-1"><Checkbox checked={isReservation} onCheckedChange={(checked) => update("scheduleType", checked ? "reservation" as ScheduleType : "queued" as ScheduleType)} /><span className="whitespace-nowrap">此為預約單</span></label></div><div className="mt-3 grid gap-1 text-xs leading-5 text-[#456153]"><p>目前最後一般排單{lastQueuedWeek ? `為 ${weekLabel(lastQueuedWeek)}，` : "尚未建立，"}但最終排程仍會滾動調整。</p><p>預約請勾選「此為預約單」。</p><p>加急不參與排單請於下方選擇加急。</p></div></div></section>
      <section className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><SectionTitle icon={<Check className="h-4 w-4" />} title="作畫項目" /><p className="mt-1 text-xs text-[#456153]">一單一圖可多個項目，底價會依每項設定與人物數量加總。</p></div><Button type="button" variant="outline" className="shrink-0 border-[#b9cdbd] text-[#355b48]" onClick={addArtItem} disabled={!availableScopes.length}><Plus className="mr-1.5 h-4 w-4" />增加項目</Button></div>{!availableScopes.length && <div className="rounded-xl border border-[#e4c7b1] bg-[#fff7f1] p-4 text-sm text-[#8b5238]">丹青設案尚未填定任何組合底價，請先至丹青設案輸入至少一格價格。</div>}<div className="space-y-4">{draft.artworkItems.map((item, index) => <ArtworkItemEditor key={item.id} item={item} index={index} settings={settings} onChange={(patch) => updateArtItem(item.id, patch)} onRemove={() => removeArtItem(item.id)} removable={draft.artworkItems.length > 1} />)}</div><div className="rounded-xl border border-[#d8ded5] bg-[#fffdfa] p-4"><label className="flex items-center gap-3 text-sm font-medium text-[#355b48]"><Checkbox checked={draft.hasBackground} onCheckedChange={(value) => update("hasBackground", Boolean(value))} />包含背景／光影需求</label>{draft.hasBackground && <Input className="mt-3" value={draft.backgroundNote} onChange={(event) => update("backgroundNote", event.target.value)} placeholder="背景內容、光影、複雜度等" />}</div><div className="grid gap-4 md:grid-cols-2"><Field label="人物設定"><Textarea value={draft.characterSettingNote} onChange={(event) => update("characterSettingNote", event.target.value)} placeholder="角色關係、設定稿重點" /></Field><Field label="動作／構圖"><Textarea value={draft.poseNote} onChange={(event) => update("poseNote", event.target.value)} placeholder="姿勢、互動、鏡位" /></Field><Field label="服裝設計"><Textarea value={draft.costumeDesignNote} onChange={(event) => update("costumeDesignNote", event.target.value)} placeholder="服裝設計、布料、配色" /></Field><Field label="配飾"><Textarea value={draft.accessoryNote} onChange={(event) => update("accessoryNote", event.target.value)} placeholder="武器、飾品、指定物件" /></Field></div><Field label="其他補充"><Textarea value={draft.requirements} onChange={(event) => update("requirements", event.target.value)} placeholder="可以填入設定文件網址等需求" /></Field></section>
      <section className="space-y-4">
        <SectionTitle icon={<Gauge className="h-4 w-4" />} title="期限、加急與權利" />
        <div className="rounded-xl border border-[#c9d5ca] bg-[#f4f8f3] p-4">
          <div className="grid grid-cols-2 items-start gap-x-5 gap-y-4">
            <Field label="加急選項"><Select value={draft.deliveryPreference} onValueChange={(value) => changeDeliveryPreference(value as Commission["deliveryPreference"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unspecified">不指定</SelectItem><SelectItem value="date">加急</SelectItem></SelectContent></Select></Field>
            {draft.deliveryPreference === "date" && <Field label="加急交稿日"><CalendarDatePicker value={draft.dueDate} endOfDay onDateChange={(dueDate) => setDraft((current) => commission && current.isRush ? { ...current, dueDate, rushRequestedAt: current.rushRequestedAt ?? Date.now() } : detectRush(current, dueDate, current.rushRequestedAt ?? Date.now()))} /></Field>}
          </div>
          {draft.deliveryPreference === "date" && <div className="mt-4 border-t border-[#c9d5ca] pt-4 text-sm text-[#456153]">
            <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><Field label="加急申請日"><CalendarDatePicker value={draft.rushRequestedAt} maxDate={draft.dueDate} onDateChange={(rushRequestedAt) => setDraft((current) => detectRush(current, current.dueDate, rushRequestedAt ?? Date.now()))} /></Field><Button type="button" variant="outline" className="min-h-10 border-[#b77a5d] text-[#8e4932]" onClick={redetectRush}>依基準日重新判定</Button></div>
            <p className={`mt-3 font-medium ${automaticRushLevel ? "text-[#7d4631]" : "text-[#355b48]"}`}>{automaticRushLevel ? `此委託已判定為${automaticRushLevel}，並帶入對應倍率範圍。` : "此交稿日目前不需插隊。"}</p>
            <p className="mt-1 text-xs leading-5">一般編輯與後續排單變動不會覆寫已保存層級；更改交稿日或補登申請日後，請主動重新判定。</p>
          </div>}
        </div>
        <div className="rounded-xl border border-[#c9d5ca] bg-[#f4f8f3] p-4"><p className="text-sm font-medium text-[#355b48]">權利選項</p><p className="mt-1 text-xs text-[#456153]">「商用」與「宣傳」的差異在於是否營利，判定標準與倍率由繪師判斷；買斷可與其中一項及加急併用。</p><div className="mt-3 flex flex-wrap gap-2">{(Object.keys(licenseLabels) as LicenseOption[]).map((option) => <label key={option} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${draft.licenses.includes(option) ? "border-[#9bb7a0] bg-[#dce9dc] text-[#283b31]" : "border-[#c9d5ca] bg-[#fffdfa] text-[#355b48]"}`}><Checkbox checked={draft.licenses.includes(option)} onCheckedChange={(checked) => updateLicenses(option, Boolean(checked))} />{licenseLabels[option]}</label>)}</div><div className="mt-4 grid items-start gap-4 sm:grid-cols-2"><Field label="公開設定"><Select value={draft.privacyMode} onValueChange={(value) => update("privacyMode", value as Commission["privacyMode"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(privacyLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>{draft.privacyMode === "until" && <Field label="不可公開至"><CalendarDatePicker value={draft.privacyUntil} endOfDay onDateChange={(privacyUntil) => update("privacyUntil", privacyUntil)} /></Field>}</div></div>
        {(draft.isRush || draft.licenses.length > 0) && <div className="rounded-xl border border-[#b9cdbd] bg-[#edf5ed] p-4"><Label>套用倍率 ×{(draft.rushMultiplier ?? multiplierRange.min).toFixed(1)}</Label><p className="mt-1 text-xs text-[#456153]">可選範圍為 ×{multiplierRange.min.toFixed(1)} 至 ×{multiplierRange.max.toFixed(1)}；套用倍率會同步反映在底價與訂金。</p><div className="mt-3 flex items-center gap-3"><input className="w-full accent-[#355b48]" type="range" min={multiplierRange.min} max={multiplierRange.max} step="0.1" value={draft.rushMultiplier ?? multiplierRange.min} onChange={(event) => update("rushMultiplier", Number(event.target.value), true)} /><span className="w-16 rounded-lg bg-[#fffdfa] px-2 py-1 text-center text-sm font-semibold text-[#283b31]">×{(draft.rushMultiplier ?? multiplierRange.min).toFixed(1)}</span></div></div>}
      </section>
      <section className="space-y-4"><SectionTitle icon={<CircleDollarSign className="h-4 w-4" />} title="價格與付款" /><div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4"><MoneyField label="底價" value={draft.basePriceMin} /><MoneyField label="訂金" value={draft.depositAmount} /><EditableMoneyField label="估價" value={draft.estimatedPrice} onChange={(value) => update("estimatedPrice", value, true)} /><MoneyField label="報價" value={draft.finalPrice} /><MoneyField label="尾款" value={draft.balanceAmount} /><EditableMoneyField label="追加款" value={draft.additionalAmount} onChange={updateAdditionalAmount} /><MoneyField label="追加報價" value={draft.additionalQuoteAmount} /><MoneyField label="總額" value={draft.totalAmount} emphasize /></div><div className="grid items-start gap-4"><PaymentRecord title="訂金收款" state={draft.depositState} paidAt={draft.depositPaidAt} onStateChange={(value) => updatePaymentState("deposit", value)} onDateChange={(value) => update("depositPaidAt", value)} /><PaymentRecord title="尾款收款" state={draft.balanceState} paidAt={draft.balancePaidAt} onStateChange={(value) => updatePaymentState("balance", value)} onDateChange={(value) => update("balancePaidAt", value)} /></div><div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><Field label="收款方式"><Input value={draft.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)} placeholder="例如：郵局轉帳" /></Field><Field label="收款備註"><Textarea className="min-h-10" value={draft.paymentNote} onChange={(event) => update("paymentNote", event.target.value)} /></Field></div></section>
      <section className="space-y-4"><SectionTitle icon={<CalendarClock className="h-4 w-4" />} title="草稿與工作進度" /><div className="grid items-start gap-4 md:grid-cols-2"><Field label="目前階段"><Select value={draft.status} onValueChange={(value) => update("status", value as CommissionStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{commissionStatuses.filter((status) => status !== "archived").map((status) => <SelectItem value={status} key={status}>{statusMeta[status].label}</SelectItem>)}</SelectContent></Select></Field><Field label="預計工期（工作天）"><Input type="number" min="1" step="1" value={draft.estimatedWorkdays ?? ""} onChange={(event) => update("estimatedWorkdays", numberOrNull(event.target.value))} placeholder="例如：5" /><span className="text-xs font-normal text-[#456153]">以週一至週五計算，不含週六、日；供工作節奏估算使用。</span></Field><Field label="草稿提供時間"><CalendarDateTimePicker value={draft.sketchSentAt} onDateTimeChange={(sketchSentAt) => update("sketchSentAt", sketchSentAt)} /></Field><Field label="草稿確認時間"><CalendarDateTimePicker value={draft.sketchConfirmedAt} onDateTimeChange={(sketchConfirmedAt) => update("sketchConfirmedAt", sketchConfirmedAt)} /></Field></div><Field label="草稿修改／確認備註"><Textarea value={draft.revisionNote} onChange={(event) => update("revisionNote", event.target.value)} /></Field></section>
    </div><div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-[#d8ded5] bg-[#fffdfa]/95 px-4 py-4 backdrop-blur sm:px-8">{saveError && <p className="max-w-xs text-xs leading-5 text-[#a9573c]">{saveError}</p>}<Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button><Button className="bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" onClick={submit} disabled={saving || !draft.clientName.trim()}>{saving ? "儲存中…" : "儲存畫約"}</Button></div>
  </DialogContent></Dialog>;
}

function ArtworkItemEditor({ item, index, settings, onChange, onRemove, removable }: { item: ArtworkItem; index: number; settings: StudioSettings; onChange: (patch: Partial<ArtworkItem>) => void; onRemove: () => void; removable: boolean }) {
  const scopes = Array.from(new Set([...getAvailableScopes(settings), item.artScope]));
  const finishes = getAvailableFinishes(settings, item.artScope);
  const qVariants = getAvailableQSizes(settings);
  const selectedVariant = qVariants.includes(item.qSize ?? "2頭身") ? item.qSize ?? "2頭身" : qVariants[0];
  const isQVariantReady = item.artScope !== "Q版" || qVariants.length > 0;
  return <article className="min-w-0 rounded-2xl border border-[#d8ded5] bg-[#fffdfa] p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="font-display text-lg font-semibold text-[#355b48]">作畫項目 {chineseOrdinal(index + 1)}</p>{removable && <Button type="button" variant="ghost" size="sm" className="text-[#a9573c] hover:bg-[#fff0e9] hover:text-[#8e4932]" onClick={onRemove}><Trash2 className="mr-1.5 h-3.5" />移除此項</Button>}</div><div className="grid min-w-0 grid-cols-[5.75rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-4"><Field label="人物數量"><Input type="number" min="1" value={item.characterCount} onChange={(event) => onChange({ characterCount: Math.max(1, Number(event.target.value) || 1) })} /></Field><Field label="繪製範圍"><Select value={item.artScope} onValueChange={(value) => onChange({ artScope: value as ArtworkItem["artScope"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{scopes.map((scope) => <SelectItem value={scope} key={scope}>{scope}</SelectItem>)}</SelectContent></Select></Field>{item.artScope === "Q版" ? <Field label="Q版規格"><Select value={selectedVariant} onValueChange={(value) => onChange({ qSize: value as ArtworkItem["qSize"] })} disabled={!qVariants.length}><SelectTrigger><SelectValue placeholder="請先設定 Q 版底價" /></SelectTrigger><SelectContent>{qVariants.map((variant) => <SelectItem value={variant} key={variant}>{variant}</SelectItem>)}</SelectContent></Select></Field> : <Field label="精緻度"><Select value={item.finishLevel} onValueChange={(value) => onChange({ finishLevel: value as ArtworkItem["finishLevel"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{finishes.map((finish) => <SelectItem value={finish} key={finish}>{finish}</SelectItem>)}</SelectContent></Select></Field>}</div>{!isQVariantReady && <p className="mt-3 text-xs text-[#a9573c]">請先到丹青設案為 Q 版填入至少一種規格的底價。</p>}<div className="mt-4"><Field label="備註"><Textarea className="min-h-20" value={item.note} onChange={(event) => onChange({ note: event.target.value })} /></Field></div></article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid min-w-0 content-start gap-2 text-sm font-medium text-[#355b48]"><span className="min-h-5">{label}</span>{children}</label>; }
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) { return <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-[#283b31]"><span className="text-[#6c9575]">{icon}</span>{title}</h3>; }
function PaymentSelect({ value, onChange }: { value: PaymentState; onChange: (value: PaymentState) => void }) { return <Select value={value} onValueChange={(next) => onChange(next as PaymentState)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(paymentLabels) as PaymentState[]).map((item) => <SelectItem value={item} key={item}>{paymentLabels[item]}</SelectItem>)}</SelectContent></Select>; }
function PaymentRecord({ title, state, paidAt, onStateChange, onDateChange }: { title: string; state: PaymentState; paidAt: number | null; onStateChange: (value: PaymentState) => void; onDateChange: (value: number | null) => void }) { return <div className="min-w-0 rounded-2xl border border-[#cfd9cf] bg-[#f7faf7] p-4"><p className="mb-3 font-display text-base font-semibold text-[#355b48]">{title}</p><div className="grid min-w-0 items-start grid-cols-[minmax(5.5rem,0.8fr)_minmax(0,1.2fr)] gap-3"><Field label="收款狀態"><PaymentSelect value={state} onChange={onStateChange} /></Field><Field label="付款日期"><CalendarDatePicker value={paidAt} onDateChange={onDateChange} /></Field></div></div>; }

function CalendarDatePicker({ value, onDateChange, endOfDay = false, maxDate }: { value: number | null; onDateChange: (value: number | null) => void; endOfDay?: boolean; maxDate?: number | null }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value) : undefined;
  const max = maxDate ? new Date(maxDate) : undefined;
  const chooseDate = (date: Date | undefined) => {
    if (!date) { onDateChange(null); setOpen(false); return; }
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), endOfDay ? 23 : 12, endOfDay ? 59 : 0, endOfDay ? 59 : 0).getTime();
    if (isDateAfter(next, maxDate)) return;
    onDateChange(next); setOpen(false);
  };
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 min-w-0 w-full justify-start border-[#cfd9cf] bg-[#fffdfa] px-3 text-left font-normal text-[#355b48] hover:bg-[#f4f8f3]"><CalendarDays className="mr-2 h-4 w-4 shrink-0 text-[#6c9575]" /><span className="truncate">{formatDateInput(value)}</span></Button></PopoverTrigger><PopoverContent align="start" className="w-auto border-[#cfd9cf] bg-[#fffdfa] p-0"><Calendar mode="single" locale={zhTW} selected={selected} onSelect={chooseDate} disabled={max ? { after: max } : undefined} defaultMonth={selected ?? max ?? new Date()} initialFocus /></PopoverContent></Popover>;
}

function CalendarDateTimePicker({ value, onDateTimeChange }: { value: number | null; onDateTimeChange: (value: number | null) => void }) {
  const updateDate = (date: number | null) => {
    if (!date) { onDateTimeChange(null); return; }
    const selected = new Date(date); const current = value ? new Date(value) : new Date();
    selected.setHours(current.getHours(), current.getMinutes(), 0, 0);
    onDateTimeChange(selected.getTime());
  };
  const updateTime = (time: string) => {
    if (!time || !value) return;
    const [hours, minutes] = time.split(":").map(Number); const next = new Date(value);
    next.setHours(hours, minutes, 0, 0); onDateTimeChange(next.getTime());
  };
  const timeValue = value ? `${String(new Date(value).getHours()).padStart(2, "0")}:${String(new Date(value).getMinutes()).padStart(2, "0")}` : "";
  return <div className="grid gap-2"><CalendarDatePicker value={value} onDateChange={updateDate} /><Input type="time" value={timeValue} disabled={!value} onChange={(event) => updateTime(event.target.value)} aria-label="選擇時間" />{!value && <span className="text-xs font-normal text-[#456153]">請先選擇日期，再選時間。</span>}</div>;
}
function MoneyField({ label, value, emphasize = false }: { label: string; value: number | null; emphasize?: boolean }) { return <Field label={label}><Input readOnly value={value === null ? "—" : `NT$ ${formatCurrency(value)}`} className={emphasize ? "border-[#b9cdbd] bg-[#edf5ed] font-semibold text-[#355b48]" : "bg-[#f7f4ee] text-[#456153]"} /></Field>; }
function EditableMoneyField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) { return <Field label={label}><Input type="number" min="0" step="1" value={value ?? ""} onChange={(event) => onChange(numberOrNull(event.target.value))} placeholder="0" /></Field>; }

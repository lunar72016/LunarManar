import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatPortalDateInput } from "@/lib/clientPortal";
import { ArtworkItem, LicenseOption, PrivacyMode, artScopeOptions, contactChannels, createArtworkItem, finishLevelOptions, formatCurrency, getAvailableFinishes, getAvailableQSizes, getAvailableScopes, qSizeOptions } from "@/lib/commission";
import { StudioSettings } from "@/lib/studioSettings";
import type { PublicScheduleChoice } from "@/pages/ClientPortalPage";
import { CalendarDays, Check, CheckCircle2, Copy, LoaderCircle, LogIn, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { zhTW } from "date-fns/locale";
import { useState } from "react";

export type PublicSubmissionFormState = {
  clientName: string;
  contactEmail: string;
  contactChannel: string;
  contactHandle: string;
  referenceUrls: string;
  scheduleChoice: PublicScheduleChoice;
  reservationDate: string;
  artworkItems: ArtworkItem[];
  licenses: LicenseOption[];
  rushDueDate: string;
  privacyMode: PrivacyMode;
  privacyUntil: string;
  characterSettingNote: string;
  poseNote: string;
  costumeDesignNote: string;
  accessoryNote: string;
  requirements: string;
  deliveryNote: string;
  termsAccepted: boolean;
};

type PublicFormProps = {
  form: PublicSubmissionFormState;
  settings: StudioSettings;
  pricingReady: boolean;
  previewAmount: number;
  previewMultiplier: number;
  update: (key: keyof PublicSubmissionFormState, value: PublicSubmissionFormState[keyof PublicSubmissionFormState]) => void;
  onSubmit: () => Promise<void>;
  submitting: boolean;
  loading: boolean;
  signedInWithGoogle: boolean;
  accountEmail: string;
  queueWeekLabel: string | null;
  onGoogle: () => Promise<void>;
  onSignOut: () => void;
  resultCode: string | null;
};

const chineseNumbers = ["", "壹", "貳", "參", "肆", "伍", "陸", "柒", "捌", "玖"];
const licenseLabels: Record<LicenseOption, string> = { commercial: "商用", promotion: "宣傳", buyout: "買斷" };

function publicArtworkItem(settings: StudioSettings): ArtworkItem {
  const scope = getAvailableScopes(settings)[0] as ArtworkItem["artScope"] | undefined;
  if (!scope) return createArtworkItem();
  if (scope === "Q版") return createArtworkItem({ artScope: scope, qSize: getAvailableQSizes(settings)[0] ?? "2頭身" });
  return createArtworkItem({ artScope: scope, finishLevel: getAvailableFinishes(settings, scope)[0] ?? "一般", qSize: null });
}

export function PublicSubmissionForm({ form, settings, pricingReady, previewAmount, previewMultiplier, update, onSubmit, submitting, loading, signedInWithGoogle, accountEmail, queueWeekLabel, onGoogle, onSignOut, resultCode }: PublicFormProps) {
  const updateItem = (id: string, patch: Partial<ArtworkItem>) => update("artworkItems", form.artworkItems.map((item) => {
    if (item.id !== id) return item;
    const next = { ...item, ...patch };
    if (patch.artScope === "Q版") return { ...next, qSize: getAvailableQSizes(settings)[0] ?? "2頭身" };
    if (patch.artScope) return { ...next, qSize: null, finishLevel: getAvailableFinishes(settings, patch.artScope)[0] ?? "一般" };
    return next;
  }));

  const toggleLicense = (license: LicenseOption, checked: boolean) => {
    let licenses = checked ? [...form.licenses, license] : form.licenses.filter((item) => item !== license);
    if (checked && license === "commercial") licenses = licenses.filter((item) => item !== "promotion");
    if (checked && license === "promotion") licenses = licenses.filter((item) => item !== "commercial");
    update("licenses", Array.from(new Set(licenses)));
  };

  return (
    <section className="mt-5 rounded-[2rem] border border-[#cfd9cf] bg-[#fffdfa] p-5 shadow-[0_14px_32px_rgba(40,59,49,.06)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">懸榜昭繪</h2>
          <p className="mt-1 text-sm leading-6 text-[#456153]">請填寫作畫項目與設定稿網址；繪師將啟讀墨諾函箋並與您確認細節。</p>
        </div>
        {signedInWithGoogle ? (
          <div className="rounded-xl bg-[#edf5ed] px-3 py-2 text-xs text-[#355b48]"><span className="max-w-36 truncate">{accountEmail}</span><button className="ml-2 underline" onClick={onSignOut}>登出</button></div>
        ) : (
          <Button variant="outline" className="border-[#b9cdbd] text-[#355b48]" onClick={() => void onGoogle()}><LogIn className="mr-1.5 h-4 w-4" />以 Google 帳號填寫</Button>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <FormField label="寄墨主姓名 *"><Input value={form.clientName} onChange={(event) => update("clientName", event.target.value)} /></FormField>
        <FormField label="聯絡管道"><Select value={form.contactChannel} onValueChange={(value) => update("contactChannel", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{contactChannels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent></Select></FormField>
        <FormField label="電子郵件 *"><Input type="email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} /></FormField>
        <FormField label="帳號／聯絡方式"><Input value={form.contactHandle} onChange={(event) => update("contactHandle", event.target.value)} /></FormField>
      </div>

      <section className="mt-7 border-t border-[#d8ded5] pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-display text-xl">作畫項目 *</h3><p className="mt-1 text-xs leading-5 text-[#456153]">一張畫可填多個項目；底價會依每項人物數量、範圍與精緻度加總。</p></div>
          <Button type="button" variant="outline" className="border-[#b9cdbd] text-[#355b48]" onClick={() => update("artworkItems", [...form.artworkItems, publicArtworkItem(settings)])}><Plus className="mr-1.5 h-4 w-4" />增加項目</Button>
        </div>
        {!pricingReady && <p className="mt-4 rounded-xl bg-[#fff7f1] px-3 py-2 text-sm text-[#8b5238]">預估底價直接同步自丹青設案；目前尚未讀到已定價項目。繪師登入一次後會自動同步，無需另行填寫公開價目。</p>}
        <div className="mt-4 space-y-4">{form.artworkItems.map((item, index) => <PublicArtworkItem key={item.id} item={item} index={index} settings={settings} onChange={(patch) => updateItem(item.id, patch)} onRemove={() => update("artworkItems", form.artworkItems.filter((current) => current.id !== item.id))} removable={form.artworkItems.length > 1} />)}</div>
        <div className="mt-4 rounded-2xl border border-[#b9cdbd] bg-[#edf5ed] p-4"><p className="text-xs font-semibold tracking-[.1em] text-[#456153]">預估底價</p><p className="mt-1 font-display text-2xl font-semibold text-[#283b31]">NT$ {formatCurrency(previewAmount)}</p><p className="mt-1 text-xs text-[#456153]">已按目前倍率 ×{previewMultiplier.toFixed(1)} 試算；最終報價以繪師確認內容為準。</p></div>
      </section>

      <section className="mt-7 border-t border-[#d8ded5] pt-6">
        <h3 className="font-display text-xl">期限、加急與權利</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([{ value: "queued", title: "排單", detail: queueWeekLabel ? `將排至${queueWeekLabel}後。` : "將排至繪師目前排單週次後。" }, { value: "reservation", title: "預約", detail: "排單日期靠近時會通知。" }, { value: "rush", title: "加急", detail: "開放加急時可使用。" }] as const).map((option) => <button type="button" key={option.value} onClick={() => update("scheduleChoice", option.value)} className={`rounded-2xl border p-3 text-left transition ${form.scheduleChoice === option.value ? "border-[#355b48] bg-[#edf5ed]" : "border-[#c9d5ca] bg-[#fffdfa]"}`}><p className="text-sm font-semibold text-[#283b31]">{option.title}</p><p className="mt-1 text-xs leading-5 text-[#456153]">{option.detail}</p></button>)}
        </div>
        {form.scheduleChoice === "reservation" && <FormField label="希望預約日期（可不填）" className="mt-4"><PublicDatePicker value={form.reservationDate} onChange={(value) => update("reservationDate", value)} /></FormField>}
        {form.scheduleChoice === "rush" && <FormField label="加急交稿日 *" className="mt-4"><PublicDatePicker value={form.rushDueDate} onChange={(value) => update("rushDueDate", value)} required /></FormField>}
        <div className="mt-5 border-t border-[#d8ded5] pt-5">
          <p className="text-sm font-medium text-[#355b48]">權利選項</p>
          <div className="mt-3 flex flex-wrap gap-2">{(["commercial", "promotion", "buyout"] as LicenseOption[]).map((license) => <label key={license} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${form.licenses.includes(license) ? "border-[#9bb7a0] bg-[#dce9dc] text-[#283b31]" : "border-[#c9d5ca] text-[#355b48]"}`}><Checkbox checked={form.licenses.includes(license)} onCheckedChange={(checked) => toggleLicense(license, Boolean(checked))} />{licenseLabels[license]}</label>)}</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><FormField label="公開設定"><Select value={form.privacyMode} onValueChange={(value) => update("privacyMode", value as PrivacyMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">可公開</SelectItem><SelectItem value="permanent">永久不可公開</SelectItem><SelectItem value="until">指定日期前不可公開</SelectItem></SelectContent></Select></FormField>{form.privacyMode === "until" && <FormField label="不可公開至"><PublicDatePicker value={form.privacyUntil} onChange={(value) => update("privacyUntil", value)} /></FormField>}</div>
        </div>
      </section>

      <section className="mt-7 border-t border-[#d8ded5] pt-6"><FormField label="設定稿／參考資料雲端網址"><Textarea value={form.referenceUrls} onChange={(event) => update("referenceUrls", event.target.value)} placeholder="可貼上 Google Drive、Dropbox、雲端相簿等網址；多個網址可分行填寫。" /></FormField></section>

      <section className="mt-6 rounded-2xl border border-[#b9cdbd] bg-[#edf5ed] p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox checked={form.termsAccepted} onCheckedChange={(checked) => update("termsAccepted", Boolean(checked))} className="mt-0.5" />
          <span className="min-w-0"><span className="block text-sm font-semibold text-[#283b31]">送出前確認 *</span><span className="mt-1 block text-xs leading-5 text-[#456153]">我已閱讀作品集與委託須知，並理解上述預估底價僅依目前項目與倍率試算；最終總價仍會依人物設定、構圖、背景、細節、期限與權利需求，由繪師確認後調整。</span></span>
        </label>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#d8ded5] pt-5">
        <p className="max-w-md text-xs leading-5 text-[#6c7e70]"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />未使用 Google 帳號時，系統會建立受限工作階段並提供對契符節；請妥善保存。</p>
        <Button disabled={submitting || loading || !form.artworkItems.length || !form.termsAccepted} className="bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" onClick={() => void onSubmit()}>{submitting && <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />}{submitting ? "寄出中…" : "寄出墨諾函箋"}</Button>
      </div>
      {resultCode && <ResultCodeCard code={resultCode} />}
    </section>
  );
}

function PublicDatePicker({ value, onChange, required = false }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  const selectDate = (date: Date | undefined) => {
    if (!date) { onChange(""); setOpen(false); return; }
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    onChange(next);
    setOpen(false);
  };
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" className={`h-10 w-full justify-start border-[#cfd9cf] bg-[#fffdfa] px-3 text-left font-normal hover:bg-[#f4f8f3] ${value ? "text-[#355b48]" : "text-[#6c7e70]"}`}><CalendarDays className="mr-2 h-4 w-4 shrink-0 text-[#6c9575]" /><span>{formatPortalDateInput(value)}</span>{required && <span className="sr-only">必填</span>}</Button></PopoverTrigger><PopoverContent align="start" className="w-auto border-[#cfd9cf] bg-[#fffdfa] p-0"><Calendar mode="single" locale={zhTW} selected={selected} onSelect={selectDate} defaultMonth={selected ?? new Date()} initialFocus /></PopoverContent></Popover>;
}

function ResultCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  return <div className="mt-5 rounded-2xl border border-[#b9cdbd] bg-[#edf5ed] p-4"><p className="flex items-center gap-2 font-semibold text-[#283b31]"><CheckCircle2 className="h-5 w-5 text-[#3e6c50]" />墨諾函箋已送達</p><p className="mt-2 text-sm text-[#456153]">請保存此對契符節。繪師建立畫約後，可用它檢視遞臻：</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 break-all rounded-xl bg-[#fffdfa] px-3 py-2 text-sm font-semibold text-[#283b31]">{code}</code><Button type="button" variant="outline" className="shrink-0 border-[#9bb7a0] text-[#355b48]" onClick={() => void copyCode()}>{copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}{copied ? "已複製" : "複製對契符節"}</Button></div></div>;
}

function PublicArtworkItem({ item, index, settings, onChange, onRemove, removable }: { item: ArtworkItem; index: number; settings: StudioSettings; onChange: (patch: Partial<ArtworkItem>) => void; onRemove: () => void; removable: boolean }) {
  const scopes = Array.from(new Set([...artScopeOptions, ...getAvailableScopes(settings), item.artScope]));
  const finishes = Array.from(new Set([...finishLevelOptions, ...getAvailableFinishes(settings, item.artScope), item.finishLevel]));
  const qSizes = Array.from(new Set([...qSizeOptions, ...getAvailableQSizes(settings), item.qSize ?? "2頭身"]));
  const ordinal = index + 1 <= 9 ? chineseNumbers[index + 1] : String(index + 1);
  return <article className="rounded-2xl border border-[#d8ded5] bg-[#fffdfa] p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="font-display text-lg font-semibold text-[#355b48]">作畫項目 {ordinal}</p>{removable && <Button type="button" variant="ghost" size="sm" className="text-[#a9573c]" onClick={onRemove}><Trash2 className="mr-1 h-3.5 w-3.5" />移除此項</Button>}</div><div className="grid min-w-0 grid-cols-[5.75rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-4"><FormField label="人物數量"><Input type="number" min="1" value={item.characterCount} onChange={(event) => onChange({ characterCount: Math.max(1, Number(event.target.value) || 1) })} /></FormField><FormField label="繪製範圍"><Select value={item.artScope} onValueChange={(value) => onChange({ artScope: value as ArtworkItem["artScope"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{scopes.map((scope) => <SelectItem key={scope} value={scope}>{scope}</SelectItem>)}</SelectContent></Select></FormField>{item.artScope === "Q版" ? <FormField label="Q版規格"><Select value={item.qSize ?? qSizes[0] ?? "2頭身"} onValueChange={(value) => onChange({ qSize: value as ArtworkItem["qSize"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{qSizes.map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}</SelectContent></Select></FormField> : <FormField label="精緻度"><Select value={item.finishLevel} onValueChange={(value) => onChange({ finishLevel: value as ArtworkItem["finishLevel"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{finishes.map((finish) => <SelectItem key={finish} value={finish}>{finish}</SelectItem>)}</SelectContent></Select></FormField>}</div><FormField label="備註" className="mt-4"><Textarea className="min-h-20" value={item.note} onChange={(event) => onChange({ note: event.target.value })} /></FormField></article>;
}

function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid min-w-0 content-start gap-2 text-sm font-medium text-[#355b48] ${className}`}><span>{label}</span>{children}</label>;
}

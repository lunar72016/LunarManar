import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { artScopeOptions, finishLevelOptions, qSizeOptions, rushLevelOptions, type ArtScope, type FinishLevel, type LicenseOption } from "@/lib/commission";
import { MultiplierRange, StudioSettings, normalizeStudioSettings } from "@/lib/studioSettings";
import { BookMarked, Info, LayoutList, Loader2, Plus, Save, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Props = { settings: StudioSettings; loading: boolean; saving: boolean; error: string | null; onSave: (settings: StudioSettings) => Promise<void> };
const labels = { commercial: "商用", promotion: "宣傳", buyout: "買斷" } as const;
const money = (value: string) => { const n = Number(value); return value.trim() && n > 0 && Number.isFinite(n) ? n : null; };
const multiplier = (value: string, fallback: number) => { const n = Number(value); return n >= 1 && Number.isFinite(n) ? n : fallback; };

export default function StudioSettingsPage({ settings, loading, saving, error, onSave }: Props) {
  const [draft, setDraft] = useState(() => normalizeStudioSettings(settings));
  const [scope, setScope] = useState<ArtScope>(artScopeOptions[0]);
  const [finish, setFinish] = useState<FinishLevel>(finishLevelOptions[0]);
  const [newPrice, setNewPrice] = useState("");

  useEffect(() => setDraft(normalizeStudioSettings(settings)), [settings]);

  const setPrice = (s: string, f: string, raw: string) => setDraft((current) => ({
    ...current,
    combinationPrices: { ...current.combinationPrices, [s]: { ...current.combinationPrices[s], [f]: money(raw) } },
  }));
  const setQVariantPrice = (variant: string, raw: string) => setDraft((current) => ({
    ...current,
    qVariantPrices: { ...current.qVariantPrices, [variant]: money(raw) },
  }));
  const enabled = artScopeOptions
    .filter((item) => item !== "Q版")
    .flatMap((artScope) => finishLevelOptions.flatMap((finishLevel) => {
      const price = draft.combinationPrices[artScope]?.[finishLevel] ?? null;
      return price === null ? [] : [{ artScope, finishLevel, price }];
    }));
  const available = finishLevelOptions.filter((item) => draft.combinationPrices[scope]?.[item] === null);
  const updateRange = (group: "rush" | "license", key: string, field: keyof MultiplierRange, value: string) => setDraft((current) => {
    const old = group === "rush" ? current.rushMultiplierRanges[key] ?? { min: 1, max: 1 } : current.licenseMultiplierRanges[key as LicenseOption] ?? { min: 1, max: 1 };
    const next = { ...old, [field]: multiplier(value, old[field]) };
    const range = { min: Math.min(next.min, next.max), max: Math.max(next.min, next.max) };
    return group === "rush"
      ? { ...current, rushMultiplierRanges: { ...current.rushMultiplierRanges, [key]: range } }
      : { ...current, licenseMultiplierRanges: { ...current.licenseMultiplierRanges, [key]: range } };
  });
  const save = async () => {
    try {
      await onSave({ ...draft, updatedAt: Date.now() });
      toast.success("丹青設案已儲存");
    } catch {
      toast.error("儲存設定失敗，請檢查 Firebase 規則。");
    }
  };

  if (loading) return <div className="flex min-h-[calc(100vh-70px)] items-center justify-center bg-[#fffdfa] text-sm text-[#456153]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在展讀畫案設定…</div>;

  return <main className="min-h-[calc(100vh-70px)] bg-[#fffdfa] px-4 py-5 sm:px-7 sm:py-7">
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="font-display text-3xl font-semibold text-[#283b31]">丹青設案</p><p className="mt-2 text-sm text-[#456153]">先設下可承接的畫法與倍率；寫畫起約只會開放已填定底價的組合。</p></div>
        <Button className="bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{saving ? "落印中…" : "儲存設案"}</Button>
      </header>
      {error && <p className="rounded-xl border border-[#bc694c] bg-[#fff0e9] p-3 text-sm text-[#8e4932]">Firebase 設定同步提示：{error}</p>}

      <Panel icon={<BookMarked />} title="畫案題名" description="此名稱會顯示在左側畫案標記中。"><Input value={draft.studioName} onChange={(event) => setDraft((current) => ({ ...current, studioName: event.target.value }))} placeholder="例如 繪月錄" /></Panel>

      <Panel icon={<LayoutList />} title="組合底價" description="一般作畫依範圍與精緻度定價；Q 版另依表情貼、2 頭身或 2.5 頭身設定。未填價格的項目不會出現在寫畫起約。">
        {enabled.length > 0 && <div className="overflow-hidden rounded-xl border border-[#cfd9cf]">
          {enabled.map(({ artScope, finishLevel, price }) => <div key={`${artScope}-${finishLevel}`} className="grid items-center gap-2 border-b border-[#e4ebe4] px-3 py-2 last:border-b-0 sm:grid-cols-[1fr_1fr_9rem_2.25rem]">
            <span className="text-sm text-[#283b31]">{artScope}</span>
            <span className="text-sm text-[#456153]">{finishLevel}</span>
            <Input className="h-9" type="number" value={price} onChange={(event) => setPrice(artScope, finishLevel, event.target.value)} />
            <Button variant="ghost" size="icon" className="h-9 w-9 text-[#a9573c] hover:bg-[#fff0e9]" onClick={() => setPrice(artScope, finishLevel, "")} aria-label={`停用 ${artScope}${finishLevel}`}><X className="h-4 w-4" /></Button>
          </div>)}
        </div>}
        <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-[#b9cdbd] bg-[#edf5ed] p-3 lg:grid-cols-[1fr_1fr_9rem_auto]">
          <Select value={scope} onValueChange={(value) => setScope(value as ArtScope)}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{artScopeOptions.filter((item) => item !== "Q版").map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          <Select value={available.includes(finish) ? finish : undefined} onValueChange={(value) => setFinish(value as FinishLevel)}><SelectTrigger className="h-9"><SelectValue placeholder="精緻度" /></SelectTrigger><SelectContent>{available.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          <Input className="h-9" type="number" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} placeholder="底價" />
          <Button className="h-9 bg-[#355b48] px-3 text-[#fffdfa]" onClick={() => { if (newPrice && available.includes(finish)) { setPrice(scope, finish, newPrice); setNewPrice(""); } }}><Plus className="mr-1 h-4 w-4" />啟用組合</Button>
        </div>

        <div className="mt-4 rounded-xl border border-[#d2ded2] bg-[#f4f8f3] p-3">
          <div><p className="text-sm font-medium text-[#355b48]">Q 版獨立規格</p><p className="mt-0.5 text-xs text-[#456153]">Q 版不分精緻度；填入底價後，寫畫起約會開放對應規格。</p></div>
          <div className="mt-2 space-y-2">{qSizeOptions.map((variant) => <div key={variant} className="grid items-center gap-2 rounded-lg border border-[#d8e2d8] bg-[#fffdfa] px-3 py-2 sm:grid-cols-[1fr_minmax(0,1.2fr)_minmax(9rem,1fr)]">
            <span className="text-sm text-[#283b31]">Q版</span><span className="text-sm text-[#456153]">{variant}</span>
            <div className="flex gap-2"><Input className="h-9" type="number" min="0" value={draft.qVariantPrices[variant] ?? ""} onChange={(event) => setQVariantPrice(variant, event.target.value)} placeholder="填入底價以啟用" /><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-[#a9573c] hover:bg-[#fff0e9]" onClick={() => setQVariantPrice(variant, "")} aria-label={`停用 Q版${variant}`}><X className="h-4 w-4" /></Button></div>
          </div>)}</div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2"><RangePanel title="加急倍率" entries={rushLevelOptions.map((item) => [item, item])} values={draft.rushMultiplierRanges} onChange={(key, field, value) => updateRange("rush", key, field, value)} /><RangePanel title="權利倍率" entries={Object.entries(labels)} values={draft.licenseMultiplierRanges} onChange={(key, field, value) => updateRange("license", key, field, value)} /></div>
    </div>
  </main>;
}

function Panel({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-[1.5rem] border border-[#cfd9cf] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(40,59,49,.06)]"><div className="flex gap-3"><span className="rounded-xl bg-[#dce9dc] p-2 text-[#355b48]">{icon}</span><div><h2 className="font-display text-2xl text-[#283b31]">{title}</h2><p className="text-sm text-[#456153]">{description}</p></div></div><div className="mt-3">{children}</div></section>;
}

function RangePanel({ title, entries, values, onChange }: { title: string; entries: readonly (readonly [string, string])[]; values: Record<string, MultiplierRange>; onChange: (key: string, field: keyof MultiplierRange, value: string) => void }) {
  return <Panel icon={<SlidersHorizontal />} title={title} description="設定最小與最大倍率；委託單以最小值為預設。">{entries.map(([key, label]) => { const value = values[key] ?? { min: 1, max: 1 }; return <div className="mt-2 grid items-center gap-2 rounded-xl bg-[#edf5ed] p-2.5 sm:grid-cols-[1fr_8rem_8rem]" key={key}><span className="text-sm text-[#283b31]">{label}</span><Input className="h-9" type="number" step="0.1" value={value.min} onChange={(event) => onChange(key, "min", event.target.value)} /><Input className="h-9" type="number" step="0.1" value={value.max} onChange={(event) => onChange(key, "max", event.target.value)} /></div>; })}</Panel>;
}

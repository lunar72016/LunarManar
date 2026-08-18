import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudioSettings, normalizeStudioSettings } from "@/lib/studioSettings";
import { artScopeOptions, finishLevelOptions, rushLevelOptions } from "@/lib/commission";
import { BookMarked, Loader2, Save, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type StudioSettingsPageProps = {
  settings: StudioSettings;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onSave: (settings: StudioSettings) => Promise<void>;
};

const licenseLabels = { commercial: "商用", promotion: "宣傳", buyout: "買斷" } as const;

export default function StudioSettingsPage({ settings, loading, saving, error, onSave }: StudioSettingsPageProps) {
  const [draft, setDraft] = useState<StudioSettings>(() => normalizeStudioSettings(settings));

  useEffect(() => { setDraft(normalizeStudioSettings(settings)); }, [settings]);

  const setPrice = (scope: string, finish: string, value: string) => {
    const amount = Number(value);
    setDraft((current) => ({ ...current, combinationPrices: { ...current.combinationPrices, [scope]: { ...current.combinationPrices[scope], [finish]: Number.isFinite(amount) ? amount : 0 } } }));
  };

  const setMultiplier = (group: "rush" | "license", key: string, value: string) => {
    const multiplier = Number(value);
    setDraft((current) => group === "rush" ? { ...current, rushMultipliers: { ...current.rushMultipliers, [key]: Number.isFinite(multiplier) ? multiplier : 1 } } : { ...current, licenseMultipliers: { ...current.licenseMultipliers, [key]: Number.isFinite(multiplier) ? multiplier : 1 } });
  };

  const submit = async () => {
    try { await onSave({ ...draft, updatedAt: Date.now() }); toast.success("價格與倍率設定已儲存"); } catch (saveError) { toast.error("儲存設定失敗", { description: saveError instanceof Error ? saveError.message : "請檢查 Firebase 規則" }); }
  };

  if (loading) return <div className="flex min-h-[calc(100vh-70px)] items-center justify-center bg-[#faf7f2] text-sm text-[#7d7167]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在展讀畫案設定…</div>;

  return <main className="min-h-[calc(100vh-70px)] bg-[#faf7f2] px-4 py-5 sm:px-7 sm:py-7"><div className="mx-auto max-w-6xl space-y-7">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="font-display text-3xl font-semibold tracking-tight text-[#294335]">丹青設案</p><p className="mt-2 text-sm text-[#88786b]">在此落定組合底價與權利倍率；寫畫起約時將依此自動換算。</p></div><Button className="bg-[#355b48] px-5 text-white shadow-[0_8px_20px_rgba(53,91,72,.18)] hover:bg-[#294a3a]" onClick={() => void submit()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{saving ? "落印中…" : "儲存設案"}</Button></div>
    {error && <div className="rounded-2xl border border-[#efc8ba] bg-[#fff4ef] px-4 py-3 text-sm text-[#8b4d39]">Firebase 設定同步提示：{error}</div>}
    <section className="rounded-[1.5rem] border border-[#e9e0d8] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(83,63,43,.06)] sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-[#e8f0e7] p-2 text-[#4a7259]"><BookMarked className="h-4 w-4" /></div><div><h2 className="font-display text-2xl font-semibold text-[#2d4637]">畫案題名</h2><p className="mt-1 text-sm leading-6 text-[#88786b]">此名稱會顯示在左側畫案標記中。</p></div></div><label className="grid min-w-56 gap-2 text-sm font-medium text-[#51463d]"><span>工作室名稱</span><Input value={draft.studioName} onChange={(event) => setDraft((current) => ({ ...current, studioName: event.target.value }))} placeholder="例如 繪月錄" /></label></div></section>
    <section className="rounded-[1.5rem] border border-[#e9e0d8] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(83,63,43,.06)] sm:p-6"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-[#e8f0e7] p-2 text-[#4a7259]"><Settings2 className="h-4 w-4" /></div><div><h2 className="font-display text-2xl font-semibold text-[#2d4637]">組合底價表</h2><p className="mt-1 text-sm leading-6 text-[#88786b]">每個選取的「繪製範圍 × 精緻度」組合會加總成底價；尚未設定的格子以 0 計算。</p></div></div><div className="mt-5 overflow-x-auto rounded-xl border border-[#eadfd4]"><table className="min-w-[900px] w-full border-collapse text-sm"><thead><tr className="bg-[#f7f2ec]"><th className="sticky left-0 z-10 bg-[#f7f2ec] px-4 py-3 text-left font-medium text-[#62564d]">繪製範圍</th>{finishLevelOptions.map((finish) => <th className="px-2 py-3 text-center font-medium text-[#62564d]" key={finish}>{finish}</th>)}</tr></thead><tbody>{artScopeOptions.map((scope) => <tr className="border-t border-[#eee5dd]" key={scope}><th className="sticky left-0 z-10 bg-[#fffdfa] px-4 py-3 text-left font-medium text-[#5e5148]">{scope}</th>{finishLevelOptions.map((finish) => <td className="p-1.5" key={finish}><Input className="h-9 min-w-20 border-[#ebe0d6] bg-white text-right text-xs" type="number" min="0" step="1" value={draft.combinationPrices[scope]?.[finish] ?? 0} onChange={(event) => setPrice(scope, finish, event.target.value)} /></td>)}</tr>)}</tbody></table></div></section>
    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-[1.5rem] border border-[#e9e0d8] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(83,63,43,.06)] sm:p-6"><h2 className="font-display text-2xl font-semibold text-[#2d4637]">加急倍率</h2><p className="mt-1 text-sm leading-6 text-[#88786b]">選擇一種加急層級時，會帶入對應倍率；之後仍可在委託單內以滑桿覆寫。</p><div className="mt-5 grid gap-3">{rushLevelOptions.map((level) => <label className="grid grid-cols-[1fr_110px] items-center gap-3 rounded-xl bg-[#f8f4ef] px-4 py-3 text-sm text-[#584e45]" key={level}><span>{level}</span><Input type="number" min="1" step="0.01" value={draft.rushMultipliers[level] ?? 1} onChange={(event) => setMultiplier("rush", level, event.target.value)} /></label>)}</div></div><div className="rounded-[1.5rem] border border-[#e9e0d8] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(83,63,43,.06)] sm:p-6"><h2 className="font-display text-2xl font-semibold text-[#2d4637]">權利倍率</h2><p className="mt-1 text-sm leading-6 text-[#88786b]">商用、宣傳與買斷可與加急組合選擇；多選時預設只套用其中最高倍率。</p><div className="mt-5 grid gap-3">{(Object.keys(licenseLabels) as (keyof typeof licenseLabels)[]).map((license) => <label className="grid grid-cols-[1fr_110px] items-center gap-3 rounded-xl bg-[#f8f4ef] px-4 py-3 text-sm text-[#584e45]" key={license}><span>{licenseLabels[license]}</span><Input type="number" min="1" step="0.01" value={draft.licenseMultipliers[license] ?? 1} onChange={(event) => setMultiplier("license", license, event.target.value)} /></label>)}</div></div></section>
  </div></main>;
}

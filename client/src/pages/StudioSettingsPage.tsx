import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudioSettings, normalizeStudioSettings } from "@/lib/studioSettings";
import { artScopeOptions, finishLevelOptions, rushLevelOptions } from "@/lib/commission";
import { Camera, Check, ImageUp, Loader2, Save, Settings2 } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type StudioSettingsPageProps = {
  settings: StudioSettings;
  loading: boolean;
  saving: boolean;
  uploading: boolean;
  uploadProgress: number | null;
  uploadStage: "uploading" | "saving" | null;
  error: string | null;
  onSave: (settings: StudioSettings) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<string>;
};

const licenseLabels = { commercial: "商用", promotion: "宣傳", buyout: "買斷" } as const;

export default function StudioSettingsPage({ settings, loading, saving, uploading, uploadProgress, uploadStage, error, onSave, onUploadAvatar }: StudioSettingsPageProps) {
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

  const selectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { await onUploadAvatar(file); toast.success("工作室頭像已更新"); } catch (uploadError) { toast.error("頭像上傳失敗", { description: uploadError instanceof Error ? uploadError.message : "請稍後再試" }); } finally { event.target.value = ""; }
  };

  const submit = async () => {
    try { await onSave({ ...draft, updatedAt: Date.now() }); toast.success("價格與倍率設定已儲存"); } catch (saveError) { toast.error("儲存設定失敗", { description: saveError instanceof Error ? saveError.message : "請檢查 Firebase 規則" }); }
  };

  if (loading) return <div className="flex min-h-[calc(100vh-70px)] items-center justify-center bg-[#faf7f2] text-sm text-[#7d7167]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在讀取工作室設定…</div>;

  return <main className="min-h-[calc(100vh-70px)] bg-[#faf7f2] px-4 py-5 sm:px-7 sm:py-7"><div className="mx-auto max-w-6xl space-y-7"><div><p className="font-display text-3xl font-semibold text-[#294335]">丹青設案</p><p className="mt-2 text-sm text-[#88786b]">設定組合底價與倍率後，寫畫起約會自動帶入計算結果。</p></div>{error && <div className="rounded-xl border border-[#efc8ba] bg-[#fff4ef] px-4 py-3 text-sm text-[#8b4d39]">{error}</div>}
    <section className="grid gap-6 rounded-[1.5rem] border border-[#e9e0d8] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(83,63,43,.06)] sm:grid-cols-[auto_1fr] sm:p-6"><div className="relative h-fit"><Avatar className="h-24 w-24 border-4 border-[#e5eee5]"><AvatarImage src={draft.avatarUrl} alt="工作室頭像" /><AvatarFallback className="bg-[#dce8dd] font-display text-3xl text-[#315741]">{draft.studioName.slice(0, 1).toUpperCase() || "L"}</AvatarFallback></Avatar><label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#355b48] text-white shadow-md hover:bg-[#294a3a]"><Camera className="h-4 w-4" /><input className="sr-only" type="file" accept="image/*" onChange={selectAvatar} disabled={uploading} /></label></div><div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="grid gap-2 text-sm font-medium text-[#51463d]"><span>工作室名稱</span><Input value={draft.studioName} onChange={(event) => setDraft((current) => ({ ...current, studioName: event.target.value }))} placeholder="例如 繪月錄" /></label><div className="flex items-end"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#decec2] bg-[#fffdfa] px-3 py-2 text-sm text-[#66574b] hover:bg-[#f8f1ea]"><ImageUp className="h-4 w-4" />{uploading ? uploadStage === "saving" ? "登錄頭像中…" : `上傳中 ${uploadProgress ?? 0}%` : "更換頭像"}<input className="sr-only" type="file" accept="image/*" onChange={selectAvatar} disabled={uploading} /></label></div>{uploading && <div className="sm:col-span-2"><div className="h-2 overflow-hidden rounded-full bg-[#e5eee5]"><div className="h-full bg-[#5b8769] transition-[width] duration-200" style={{ width: `${uploadStage === "saving" ? 100 : uploadProgress ?? 0}%` }} /></div><p className="mt-2 text-xs text-[#789080]">{uploadStage === "saving" ? "圖檔已上傳，正在寫入畫案設定…" : "圖檔正上傳至 Storage…"}</p></div>}<p className="text-xs leading-5 text-[#9b8b7e] sm:col-span-2">頭像會儲存於 Firebase Storage；請使用小於 5MB 的 JPG、PNG 或 WebP。若 45 秒未完成，系統會自動取消並提示你檢查 Storage bucket 與規則。</p></div></section>

    <section className="rounded-[1.5rem] border border-[#e9e0d8] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(83,63,43,.06)] sm:p-6"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-[#e8f0e7] p-2 text-[#4a7259]"><Settings2 className="h-4 w-4" /></div><div><h2 className="font-display text-2xl font-semibold text-[#2d4637]">組合底價表</h2><p className="mt-1 text-sm leading-6 text-[#88786b]">每個選取的「繪製範圍 × 精緻度」組合會加總成底價。尚未設定的格子以 0 計算；「其他」對應自訂範圍的預設價格。</p></div></div><div className="mt-5 overflow-x-auto rounded-xl border border-[#eadfd4]"><table className="min-w-[900px] w-full border-collapse text-sm"><thead><tr className="bg-[#f7f2ec]"><th className="sticky left-0 z-10 bg-[#f7f2ec] px-4 py-3 text-left font-medium text-[#62564d]">繪製範圍</th>{finishLevelOptions.map((finish) => <th className="px-2 py-3 text-center font-medium text-[#62564d]" key={finish}>{finish}</th>)}</tr></thead><tbody>{artScopeOptions.map((scope) => <tr className="border-t border-[#eee5dd]" key={scope}><th className="sticky left-0 z-10 bg-[#fffdfa] px-4 py-3 text-left font-medium text-[#5e5148]">{scope}</th>{finishLevelOptions.map((finish) => <td className="p-1.5" key={finish}><Input className="h-9 min-w-20 border-[#ebe0d6] bg-white text-right text-xs" type="number" min="0" step="1" value={draft.combinationPrices[scope]?.[finish] ?? 0} onChange={(event) => setPrice(scope, finish, event.target.value)} /></td>)}</tr>)}</tbody></table></div></section>

    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-[1.5rem] border border-[#e9e0d8] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(83,63,43,.06)] sm:p-6"><h2 className="font-display text-2xl font-semibold text-[#2d4637]">加急倍率</h2><p className="mt-1 text-sm leading-6 text-[#88786b]">建立委託時選擇一種加急層級，會帶入對應倍率；之後仍可在委託單內用滑桿覆寫。</p><div className="mt-5 grid gap-3">{rushLevelOptions.map((level) => <label className="grid grid-cols-[1fr_110px] items-center gap-3 rounded-xl bg-[#f8f4ef] px-4 py-3 text-sm text-[#584e45]" key={level}><span>{level}</span><Input type="number" min="1" step="0.01" value={draft.rushMultipliers[level] ?? 1} onChange={(event) => setMultiplier("rush", level, event.target.value)} /></label>)}</div></div><div className="rounded-[1.5rem] border border-[#e9e0d8] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(83,63,43,.06)] sm:p-6"><h2 className="font-display text-2xl font-semibold text-[#2d4637]">權利倍率</h2><p className="mt-1 text-sm leading-6 text-[#88786b]">商用、宣傳與買斷可與加急組合選擇；多選時系統預設只套用其中最高倍率。</p><div className="mt-5 grid gap-3">{(Object.keys(licenseLabels) as (keyof typeof licenseLabels)[]).map((license) => <label className="grid grid-cols-[1fr_110px] items-center gap-3 rounded-xl bg-[#f8f4ef] px-4 py-3 text-sm text-[#584e45]" key={license}><span>{licenseLabels[license]}</span><Input type="number" min="1" step="0.01" value={draft.licenseMultipliers[license] ?? 1} onChange={(event) => setMultiplier("license", license, event.target.value)} /></label>)}</div></div></section>

    <div className="sticky bottom-5 flex justify-end"><Button className="bg-[#355b48] px-5 text-white shadow-[0_8px_20px_rgba(53,91,72,.18)] hover:bg-[#294a3a]" onClick={() => void submit()} disabled={saving || uploading}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{saving ? "儲存中…" : "儲存設定"}</Button></div>
  </div></main>;
}

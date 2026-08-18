import { CommissionCard } from "@/components/CommissionCard";
import { CommissionDialog } from "@/components/CommissionDialog";
import DashboardLayout, { WorkspaceView } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useCommissions } from "@/hooks/useCommissions";
import { useStudioSettings } from "@/hooks/useStudioSettings";
import { Commission, CommissionStatus, applyAutomaticPricing, formatCurrency, monthLabel, statusMeta } from "@/lib/commission";
import StudioSettingsPage from "@/pages/StudioSettingsPage";
import { BadgePlus, CalendarClock, CircleDollarSign, CloudOff, FolderKanban, LockKeyhole, Search, Sparkles, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const titleIconSrc = `${import.meta.env.BASE_URL}hui-yue-title.svg`;

export default function Home() {
  const auth = useFirebaseAuth();
  if (auth.loading) return <LoadingScreen />;
  if (!auth.configured) return <ConfigMissing />;
  if (!auth.user) return <LoginScreen />;
  if (!auth.isAllowed) return <AccessDenied />;
  return <CommissionWorkspace />;
}

function CommissionWorkspace() {
  const { user } = useFirebaseAuth();
  const { commissions, syncState, error: commissionsError, saveQueuedCommission, deleteCommission, changeStatus, importInitialRecords } = useCommissions(user, true);
  const studio = useStudioSettings(user, true);
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Commission | null>(null);
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return commissions;
    return commissions.filter((commission) => [commission.clientName, commission.contactHandle, commission.artScopes.join(" "), commission.finishLevels.join(" "), commission.status].join(" ").toLowerCase().includes(keyword));
  }, [commissions, search]);

  const monthlyGroups = useMemo(() => filtered.reduce<Record<string, Commission[]>>((result, commission) => {
    const key = commission.queueMonth || "unplanned";
    result[key] = [...(result[key] ?? []), commission];
    return result;
  }, {}), [filtered]);

  const summary = useMemo(() => {
    const paidDeposit = commissions.filter((item) => item.depositState === "paid").reduce((total, item) => total + (item.depositAmount ?? 0), 0);
    const paidBalance = commissions.filter((item) => item.balanceState === "paid").reduce((total, item) => total + (item.balanceAmount ?? 0), 0);
    return { total: commissions.length, sketching: commissions.filter((item) => item.status === "sketching").length, finalizing: commissions.filter((item) => item.status === "finalizing").length, awaiting: commissions.filter((item) => ["awaiting_deposit", "awaiting_balance"].includes(item.status)).length, income: paidDeposit + paidBalance };
  }, [commissions]);

  const openNew = () => { setSelected(null); setDialogOpen(true); };
  const saveCommission = async (commission: Commission) => {
    try {
      const calculated = applyAutomaticPricing(studio.settings, commission);
      await saveQueuedCommission(calculated, !selected);
      toast.success(selected ? "委託單已更新" : "已建立新的委託單", { description: "已先儲存在本機，系統會在背景自動同步。" });
    } catch (saveError) {
      toast.error("儲存時發生問題", { description: saveError instanceof Error ? saveError.message : "請稍後再試" });
      throw saveError;
    }
  };
  const advance = async (commission: Commission, next: CommissionStatus) => {
    try { await changeStatus(commission, next); toast.success(`${commission.clientName} 已更新為「${statusMeta[next].label}」`); }
    catch { toast.error("無法更新進度，請檢查網路或 Firestore 規則。") }
  };
  const removeCommission = async (commission: Commission) => {
    try {
      await deleteCommission(commission.id);
      toast.success(`已刪除「${commission.clientName}」的排單`, { description: "已從本機移除，系統會在背景同步刪除。" });
    } catch (deleteError) {
      toast.error("刪除時發生問題", { description: deleteError instanceof Error ? deleteError.message : "請稍後再試" });
      throw deleteError;
    }
  };
  const importRecords = async () => {
    setImporting(true);
    try { await importInitialRecords(); toast.success("已匯入八月與九月的 14 張既有委託單", { description: "資料已先寫入本機，正等待背景同步。" }); }
    catch (importError) { toast.error("匯入失敗", { description: importError instanceof Error ? importError.message : "請確認 Firestore 已建立並套用規則" }); }
    finally { setImporting(false); }
  };

  const error = commissionsError ?? studio.error;
  const heading = activeView === "dashboard" ? "運筆宮商" : activeView === "board" ? "排畫連雲" : "丹青設案";

  return <DashboardLayout activeView={activeView} onViewChange={setActiveView} syncState={syncState} studioName={studio.settings.studioName}>
    {activeView === "settings" ? <StudioSettingsPage settings={studio.settings} loading={studio.loading} saving={studio.saving} error={studio.error} onSave={studio.saveSettings} /> : <main className="min-h-[calc(100vh-70px)] bg-[#faf7f2] px-4 py-5 sm:px-7 sm:py-7">
      {error && <div className="mb-5 rounded-2xl border border-[#efc8ba] bg-[#fff4ef] px-4 py-3 text-sm text-[#8b4d39]">Firebase 資料同步提示：{error}</div>}
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="font-display text-3xl font-semibold tracking-tight text-[#294335]">{heading}</p><p className="mt-2 text-sm text-[#88786b]">每一筆約稿與收款皆收錄於此；離線時亦可先安放在此方畫案。</p></div>
        <div className="flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#a99686]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="border-[#e8ded4] bg-[#fffdfa] pl-9" placeholder="搜尋委託人、範圍或精緻度" /></div><Button className="bg-[#355b48] text-white shadow-[0_8px_20px_rgba(53,91,72,.18)] hover:bg-[#294a3a]" onClick={openNew}><BadgePlus className="mr-1.5 h-4 w-4" />寫畫起約</Button></div>
      </div>
      {commissions.length === 0 && syncState !== "loading" ? <InitialImport onImport={() => void importRecords()} loading={importing} /> : activeView === "dashboard" ? <DashboardView summary={summary} commissions={filtered} onEdit={(commission) => { setSelected(commission); setDialogOpen(true); }} onAdvance={advance} /> : <BoardView groups={monthlyGroups} onEdit={(commission) => { setSelected(commission); setDialogOpen(true); }} onAdvance={advance} />}
    </main>}
    <CommissionDialog commission={selected} open={dialogOpen} onOpenChange={setDialogOpen} onSave={saveCommission} onDelete={removeCommission} settings={studio.settings} />
  </DashboardLayout>;
}

function DashboardView({ summary, commissions, onEdit, onAdvance }: { summary: { total: number; sketching: number; finalizing: number; awaiting: number; income: number }; commissions: Commission[]; onEdit: (commission: Commission) => void; onAdvance: (commission: Commission, next: CommissionStatus) => void }) {
  const priority = commissions.filter((commission) => !["completed", "inquiry"].includes(commission.status)).slice(0, 4);
  return <div className="space-y-7"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><SummaryCard icon={<FolderKanban />} label="全部委託" value={String(summary.total)} detail="目前工作庫" tone="sage" /><SummaryCard icon={<CalendarClock />} label="草稿製作中" value={String(summary.sketching)} detail="等待草稿確認" tone="sand" /><SummaryCard icon={<Sparkles />} label="完稿製作中" value={String(summary.finalizing)} detail="收尾與完稿階段" tone="sage" /><SummaryCard icon={<WalletCards />} label="待收款" value={String(summary.awaiting)} detail="訂金或尾款等待確認" tone="rose" /><SummaryCard icon={<CircleDollarSign />} label="已入帳" value={`NT$ ${formatCurrency(summary.income)}`} detail="依付款狀態統計" tone="ink" /></div><section className="rounded-[1.5rem] border border-[#e9e0d8] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(83,63,43,.06)] sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-2xl font-semibold text-[#2c4637]">近案墨痕</h2><p className="mt-1 text-sm text-[#88786b]">優先處理正在線上的委託與付款節點。</p></div><Sparkles className="h-5 w-5 text-[#c98962]" /></div>{priority.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{priority.map((commission) => <CommissionCard commission={commission} key={commission.id} onEdit={onEdit} onAdvance={onAdvance} />)}</div> : <EmptyState />}</section></div>;
}

function BoardView({ groups, onEdit, onAdvance }: { groups: Record<string, Commission[]>; onEdit: (commission: Commission) => void; onAdvance: (commission: Commission, next: CommissionStatus) => void }) {
  const months = Object.keys(groups).sort();
  if (!months.length) return <EmptyState />;
  return <div className="space-y-8">{months.map((month) => <section key={month}><div className="mb-4 flex items-center gap-3"><div className="h-px flex-1 bg-[#dfd5cb]" /><h2 className="shrink-0 font-display text-2xl font-semibold text-[#314a3c]">{month === "unplanned" ? "尚未排定" : monthLabel(month)}</h2><span className="rounded-full bg-[#ece5dc] px-2.5 py-1 text-xs font-medium text-[#7d6c5e]">{groups[month].length} 張</span><div className="h-px flex-1 bg-[#dfd5cb]" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{groups[month].map((commission) => <CommissionCard commission={commission} key={commission.id} onEdit={onEdit} onAdvance={onAdvance} />)}</div></section>)}</div>;
}

function SummaryCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "sage" | "sand" | "rose" | "ink" }) {
  const colors = { sage: "bg-[#eaf1eb] text-[#47745b]", sand: "bg-[#f7ecd9] text-[#a46f38]", rose: "bg-[#f8e9e5] text-[#a75f52]", ink: "bg-[#e8efec] text-[#416453]" };
  return <article className="rounded-2xl border border-[#ebe2d9] bg-[#fffdfa] p-4 shadow-[0_6px_22px_rgba(83,63,43,.04)]"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors[tone]}`}>{icon}</div><p className="mt-4 text-sm font-medium text-[#7f7064]">{label}</p><p className="mt-1 font-display text-2xl font-semibold text-[#2f4739]">{value}</p><p className="mt-1 text-xs text-[#a08f80]">{detail}</p></article>;
}

function InitialImport({ onImport, loading }: { onImport: () => void; loading: boolean }) {
  return <div className="relative overflow-hidden rounded-[2rem] border border-[#e7ddd3] bg-[#fffdfa] p-8 text-center shadow-[0_18px_45px_rgba(83,63,43,.08)] sm:p-14"><div className="absolute -left-10 -top-10 h-44 w-44 rounded-full bg-[#f7e5d9] blur-2xl" /><div className="relative mx-auto max-w-lg"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e5efe5] text-[#4a7259]"><FolderKanban className="h-6 w-6" /></div><h2 className="mt-5 font-display text-3xl font-semibold text-[#2b4737]">先收舊卷，再續新章</h2><p className="mt-3 leading-7 text-[#86766a]">已為你整理八月與九月的 14 筆舊約，保留原始價格筆記。匯入後可逐筆補上收款、草稿與作畫進度。</p><Button className="mt-6 bg-[#355b48] text-white hover:bg-[#294a3a]" onClick={onImport} disabled={loading}>{loading ? "正在收卷…" : "收錄既有約稿"}</Button></div></div>;
}

function EmptyState() { return <div className="py-14 text-center text-sm text-[#948477]">此處暫無相符約稿。可調整尋卷條件，或另起一紙新約。</div>; }

function LoginScreen() {
  const { signIn } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSubmitting(true); setError(""); try { await signIn(email, password); } catch { setError("無法登入，請確認電子郵件、密碼與 Firebase Authentication 設定。"); } finally { setSubmitting(false); } };
  return <div className="min-h-screen bg-[#f9f5ef] p-5"><div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-[#e6dbd0] bg-[#fffdfa] shadow-[0_24px_70px_rgba(73,52,34,.12)] lg:grid-cols-[1.1fr_.9fr]"><div className="relative hidden overflow-hidden bg-[#385d4a] p-12 text-white lg:block"><div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_18%_21%,#efd1b6_0,transparent_28%),radial-gradient(circle_at_72%_78%,#acc5ae_0,transparent_27%)]" /><div className="relative flex h-full flex-col justify-between"><div><div className="flex items-center gap-3"><img src={titleIconSrc} className="h-9 w-9" alt="繪月錄圖示" /><p className="text-xs tracking-[0.25em] text-[#eac29e]">繪月錄 · HUI YUE LEDGER</p></div><h1 className="mt-5 font-display text-5xl leading-[1.12]">讓每一筆<br />畫約都安放於<br />恰好的章法。</h1></div><p className="max-w-sm text-sm leading-7 text-[#dceadf]">此方畫案收納排單、款項與草稿節點；縱使暫斷網路，墨跡仍可留存。</p></div></div><div className="flex items-center justify-center p-7 sm:p-12"><form className="w-full max-w-sm" onSubmit={submit}><div className="mb-9"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f0e7] text-[#3e6c50]"><LockKeyhole className="h-5 w-5" /></div><p className="mt-6 font-display text-3xl font-semibold text-[#2d4637]">重臨畫案</p><p className="mt-2 text-sm leading-6 text-[#8c7b6d]">以繪師專用帳號啟卷，續寫你的約稿筆記。</p></div><div className="space-y-5"><label className="grid gap-2"><Label>電子郵件</Label><Input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className="grid gap-2"><Label>密碼</Label><Input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="rounded-xl bg-[#fff0eb] px-3 py-2 text-xs leading-5 text-[#a15241]">{error}</p>}<Button className="w-full bg-[#355b48] text-white hover:bg-[#294a3a]" type="submit" disabled={submitting}>{submitting ? "展卷中…" : "啟卷入案"}</Button></div></form></div></div></div>;
}

function AccessDenied() { const { signOut, user } = useFirebaseAuth(); return <div className="flex min-h-screen items-center justify-center bg-[#f9f5ef] p-5"><div className="max-w-md rounded-[1.75rem] border border-[#ecd9d0] bg-[#fffdfa] p-8 text-center shadow-[0_18px_50px_rgba(82,59,38,.08)]"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0eb] text-[#a15445]"><LockKeyhole className="h-6 w-6" /></div><h1 className="mt-5 font-display text-2xl font-semibold text-[#493d35]">這個帳號尚未獲得存取權</h1><p className="mt-3 text-sm leading-6 text-[#856f61]">目前登入的帳號為 {user?.email ?? "未知帳號"}。請以已列入 Firebase 管理者白名單的繪師帳號登入。</p><Button variant="outline" className="mt-6 border-[#e2d2c7]" onClick={() => void signOut()}>換一個帳號</Button></div></div>; }
function ConfigMissing() { return <div className="flex min-h-screen items-center justify-center bg-[#f9f5ef] p-5"><div className="max-w-md rounded-[1.75rem] border border-[#e6dbd0] bg-[#fffdfa] p-8 text-center"><CloudOff className="mx-auto h-7 w-7 text-[#a47455]" /><h1 className="mt-4 font-display text-2xl text-[#473c34]">尚未設定 Firebase</h1><p className="mt-3 text-sm leading-6 text-[#856f61]">請依 README 提供的 Firebase 環境變數與部署步驟設定此應用程式。</p></div></div>; }
function LoadingScreen() { return <div className="flex min-h-screen items-center justify-center bg-[#f9f5ef]"><div className="flex items-center gap-3 text-sm text-[#7e7064]"><span className="h-3 w-3 animate-pulse rounded-full bg-[#597b68]" />正展卷入案…</div></div>; }

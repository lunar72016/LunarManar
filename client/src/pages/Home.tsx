import { CommissionCard } from "@/components/CommissionCard";
import { CommissionDialog } from "@/components/CommissionDialog";
import { ClientAccessDialog } from "@/components/ClientAccessDialog";
import { SafariGoogleSignInHint } from "@/components/SafariGoogleSignInHint";
import { CommissionViewDialog } from "@/components/CommissionViewDialog";
import DashboardLayout, { WorkspaceView } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useCommissions } from "@/hooks/useCommissions";
import { commissionFromClientSubmission, useClientIntake } from "@/hooks/useClientIntake";
import { useStudioSettings } from "@/hooks/useStudioSettings";
import { Commission, CommissionStatus, PendingPaymentCommission, applyAutomaticPricing, filterArchivedCommissions, formatCurrency, getDefaultScheduleWeekStart, getLastQueuedWeek, getPendingPaymentCommissions, groupQueuedCommissionsByMonth, monthLabel, prioritizeRecentCommissions, sortCommissionsForSchedule, statusMeta } from "@/lib/commission";
import StudioSettingsPage from "@/pages/StudioSettingsPage";
import ClientPortalPage from "@/pages/ClientPortalPage";
import { getClientProgressPath, getPendingClientSubmissions, isPortalAccessCode } from "@/lib/clientPortal";
import { describeFirebaseAuthError } from "@/lib/firebase";
import { ArchiveRestore, BadgePlus, CalendarClock, CircleDollarSign, CloudOff, FolderKanban, Inbox, KeyRound, LockKeyhole, LogIn, Search, Sparkles, Trash2, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const titleIconSrc = `${import.meta.env.BASE_URL}hui-yue-title.svg`;

export default function Home() {
  const auth = useFirebaseAuth();
  if (auth.loading) return <LoadingScreen />;
  if (!auth.configured) return <ConfigMissing />;
  if (!auth.user) return <LoginScreen />;
  if (!auth.isAllowed) return <ClientPortalPage initialTab="progress" />;
  return <CommissionWorkspace />;
}

function CommissionWorkspace() {
  const { user } = useFirebaseAuth();
  const { commissions, syncState, error: commissionsError, saveQueuedCommission, deleteCommission, changeStatus, archiveCommission, restoreCommission, importInitialRecords } = useCommissions(user, true);
  const studio = useStudioSettings(user, true);
  const intake = useClientIntake(user, true);
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [search, setSearch] = useState("");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveStage, setArchiveStage] = useState<"all" | Exclude<CommissionStatus, "archived">>("all");
  const [archiveLimit, setArchiveLimit] = useState(12);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [clientAccessOpen, setClientAccessOpen] = useState(false);
  const [selected, setSelected] = useState<Commission | null>(null);
  const [submissionToAccept, setSubmissionToAccept] = useState<import("@/lib/clientPortal").ClientSubmission | null>(null);
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return commissions;
    return commissions.filter((commission) => [commission.clientName, commission.contactHandle, commission.artScopes.join(" "), commission.finishLevels.join(" "), commission.status].join(" ").toLowerCase().includes(keyword));
  }, [commissions, search]);

  const activeCommissions = useMemo(() => commissions.filter((commission) => commission.status !== "archived"), [commissions]);
  const archivedCommissions = useMemo(() => commissions.filter((commission) => commission.status === "archived"), [commissions]);
  const archivedMatches = useMemo(() => filterArchivedCommissions(archivedCommissions, archiveSearch, archiveStage), [archiveSearch, archiveStage, archivedCommissions]);
  const lastQueuedWeek = useMemo(() => getLastQueuedWeek(activeCommissions), [activeCommissions]);
  const defaultScheduleWeekStart = useMemo(() => getDefaultScheduleWeekStart(activeCommissions), [activeCommissions]);

  const boardGroups = useMemo(() => {
    const activeFiltered = filtered.filter((commission) => commission.status !== "archived");
    const pending = activeFiltered.filter((commission) => commission.status !== "completed");
    return { months: groupQueuedCommissionsByMonth(pending), rush: pending.filter((commission) => commission.isRush), reservations: pending.filter((commission) => !commission.isRush && commission.scheduleType === "reservation"), completed: activeFiltered.filter((commission) => commission.status === "completed") };
  }, [filtered]);

  const summary = useMemo(() => {
    const currentCommissions = activeCommissions.filter((item) => item.status !== "completed");
    const paidDeposit = currentCommissions.filter((item) => item.depositState === "paid").reduce((total, item) => total + (item.depositAmount ?? 0), 0);
    const paidBalance = currentCommissions.filter((item) => item.balanceState === "paid").reduce((total, item) => total + (item.balanceAmount ?? 0), 0);
    const pendingPayments = getPendingPaymentCommissions(activeCommissions);
    const queuedCount = currentCommissions.filter((item) => item.scheduleType !== "reservation").length;
    const reservationCount = currentCommissions.length - queuedCount;
    return { total: queuedCount, reservations: reservationCount, sketching: currentCommissions.filter((item) => item.status === "sketching" && item.scheduleType !== "reservation").length, finalizing: currentCommissions.filter((item) => item.status === "finalizing" && item.scheduleType !== "reservation").length, awaiting: pendingPayments.length, awaitingAmount: pendingPayments.reduce((total, item) => total + item.totalAmount, 0), income: paidDeposit + paidBalance };
  }, [activeCommissions]);
  const pendingPayments = useMemo(() => getPendingPaymentCommissions(filtered), [filtered]);

  const openNew = () => { setSubmissionToAccept(null); setSelected(null); setViewOpen(false); setDialogOpen(true); };
  const openEdit = (commission: Commission) => { setSelected(commission); setViewOpen(false); setDialogOpen(true); };
  const openView = (commission: Commission) => { setSelected(commission); setDialogOpen(false); setViewOpen(true); };
  const openClientAccess = (commission: Commission) => { setSelected(commission); setViewOpen(false); setClientAccessOpen(true); };
  const saveCommission = async (commission: Commission) => {
    try {
      const calculated = applyAutomaticPricing(studio.settings, commission);
      const saved = await saveQueuedCommission(calculated, !selected || !selected.id);
      if (submissionToAccept) {
        await intake.publishProgress(saved, submissionToAccept);
        setSubmissionToAccept(null);
      } else if (!selected || !selected.id) {
        await intake.getOrCreateCodeProgress(saved);
      } else await intake.syncProgress(saved);
      toast.success(selected ? "委託單已更新" : "已建立新的委託單", { description: submissionToAccept ? "已沿用公開填單的委託人入口。" : !selected?.id ? "已自動建立專屬驗證碼；可在「委託人入口」複製連結。" : "已先儲存在本機，系統會在背景自動同步。" });
    } catch (saveError) {
      toast.error("儲存時發生問題", { description: saveError instanceof Error ? saveError.message : "請稍後再試" });
      throw saveError;
    }
  };
  const removeCommission = async (commission: Commission) => {
    try {
      await intake.removeCommissionPortalRecords(commission.id);
      await deleteCommission(commission.id);
      toast.success(`已刪除「${commission.clientName}」的排單`, { description: "已從本機移除，系統會在背景同步刪除。" });
    } catch (deleteError) {
      toast.error("刪除時發生問題", { description: deleteError instanceof Error ? deleteError.message : "請稍後再試" });
      throw deleteError;
    }
  };
  const advance = async (commission: Commission, next: CommissionStatus) => {
    try { await changeStatus(commission, next); await intake.syncProgress({ ...commission, status: next }); toast.success(`${commission.clientName} 已更新為「${statusMeta[next].label}」`); }
    catch { toast.error("無法更新進度，請檢查網路或 Firestore 規則。") }
  };
  const archive = async (commission: Commission) => {
    try {
      await archiveCommission(commission);
      toast.success(`已封存「${commission.clientName}」`, { description: "案件保留於封存專區，不再列入工作與排單。" });
    } catch {
      toast.error("無法封存案件，請檢查網路或 Firestore 規則。");
    }
  };
  const restore = async (commission: Commission) => {
    try {
      await restoreCommission(commission);
      toast.success(`已重新啟用「${commission.clientName}」`, { description: "案件已回到原本的工作進度。" });
    } catch {
      toast.error("無法重新啟用案件，請檢查網路或 Firestore 規則。");
    }
  };
  const importRecords = async () => {
    setImporting(true);
    try { await importInitialRecords(); toast.success("已匯入八月與九月的 14 張既有委託單", { description: "資料已先寫入本機，正等待背景同步。" }); }
    catch (importError) { toast.error("匯入失敗", { description: importError instanceof Error ? importError.message : "請確認 Firestore 已建立並套用規則" }); }
    finally { setImporting(false); }
  };
  const acceptSubmission = (submission: import("@/lib/clientPortal").ClientSubmission) => {
    setSubmissionToAccept(submission);
    setSelected(commissionFromClientSubmission(submission));
    setViewOpen(false);
    setDialogOpen(true);
  };
  const discardSubmission = async (submission: import("@/lib/clientPortal").ClientSubmission) => {
    if (!window.confirm(`確定要刪除「${submission.clientName}」的未受理委託函嗎？此操作無法復原。`)) return;
    try {
      const outcome = await intake.discardSubmission(submission.id);
      toast.success(outcome === "offline" ? "已在本機移除委託函" : "已刪除未受理委託函", { description: outcome === "offline" ? "目前離線，系統會在恢復連線後再同步刪除。" : undefined });
    } catch (discardError) {
      toast.error("刪除委託函時發生問題", { description: discardError instanceof Error ? discardError.message : "請稍後再試" });
    }
  };

  const error = commissionsError ?? studio.error;
  const heading = activeView === "dashboard" ? "運筆宮商" : activeView === "board" ? "排畫連雲" : activeView === "archive" ? "封畫入卷" : activeView === "intake" ? "委託函" : "丹青設案";

  return <TooltipProvider><Toaster richColors position="top-right" /><DashboardLayout activeView={activeView} onViewChange={setActiveView} syncState={syncState} studioName={studio.settings.studioName}>
    {activeView === "settings" ? <StudioSettingsPage settings={studio.settings} loading={studio.loading} saving={studio.saving} error={studio.error} onSave={studio.saveSettings} /> : <main className="min-h-[calc(100vh-70px)] bg-[#fffdfa] px-4 py-5 sm:px-7 sm:py-7">
      {error && <div className="mb-5 rounded-2xl border border-[#bc694c] bg-[#fff0e9] px-4 py-3 text-sm text-[#8e4932]">Firebase 資料同步提示：{error}</div>}
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="font-display text-3xl font-semibold tracking-tight text-[#283b31]">{heading}</p><p className="mt-2 text-sm text-[#456153]">每一筆約稿與收款皆收錄於此；離線時亦可先安放在此方畫案。</p></div>
        <div className="flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#456153]" /><Input value={activeView === "archive" ? archiveSearch : search} onChange={(event) => { if (activeView === "archive") { setArchiveSearch(event.target.value); setArchiveLimit(12); } else setSearch(event.target.value); }} className="border-[#cfd9cf] bg-[#fffdfa] pl-9" placeholder={activeView === "archive" ? "搜尋入卷案件、單號或需求" : "搜尋委託人、範圍或精緻度"} /></div></div>
      </div>
      {activeView === "intake" ? <ClientIntakeView submissions={intake.submissions} loading={intake.loading} error={intake.error} onAccept={acceptSubmission} onDiscard={discardSubmission} /> : commissions.length === 0 && syncState !== "loading" ? <InitialImport onImport={() => void importRecords()} loading={importing} /> : activeView === "dashboard" ? <DashboardView summary={summary} commissions={filtered.filter((commission) => commission.status !== "archived")} pendingPayments={pendingPayments} onView={openView} onAdvance={advance} /> : activeView === "archive" ? <ArchivedView commissions={archivedMatches.slice(0, archiveLimit)} total={archivedMatches.length} stage={archiveStage} pageSize={archiveLimit} hasMore={archivedMatches.length > archiveLimit} onStageChange={(value) => { setArchiveStage(value); setArchiveLimit(12); }} onPageSizeChange={(value) => setArchiveLimit(value)} onLoadMore={() => setArchiveLimit((current) => current + 12)} onView={openView} /> : <BoardView months={boardGroups.months} rush={boardGroups.rush} reservations={boardGroups.reservations} completed={boardGroups.completed} onView={openView} />}
    </main>}
    {activeView !== "settings" && <Button className="fixed bottom-6 right-5 z-30 rounded-full bg-[#355b48] px-5 text-[#fffdfa] shadow-[0_12px_28px_rgba(40,59,49,.28)] hover:bg-[#294a3a] sm:bottom-8 sm:right-8" onClick={openNew}><BadgePlus className="mr-1.5 h-4 w-4" />寫畫起約</Button>}
    <CommissionDialog commission={selected} open={dialogOpen} onOpenChange={setDialogOpen} onSave={saveCommission} onDelete={removeCommission} settings={studio.settings} defaultScheduleWeekStart={defaultScheduleWeekStart} lastQueuedWeek={lastQueuedWeek} />
    <CommissionViewDialog commission={selected} open={viewOpen} onOpenChange={setViewOpen} onEdit={openEdit} onArchive={archive} onRestore={restore} onDelete={removeCommission} onManageClientAccess={openClientAccess} />
    <ClientAccessDialog commission={selected} open={clientAccessOpen} onOpenChange={setClientAccessOpen} onPublish={async (input) => {
      if (!selected) throw new Error("請先選擇案件。");
      const progress = await intake.publishExistingProgress(selected, input);
      toast.success("委託人進度入口已可使用", { description: progress.accessMode === "code" ? "已取得有效專屬連結，請傳給委託人。" : "委託人可用綁定的 Google 帳號查看。" });
      return progress;
    }} onRevoke={async () => {
      if (!selected) return;
      await intake.revokeCommissionProgress(selected.id);
      toast.success("已撤銷此案件的委託人進度入口");
    }} />
  </DashboardLayout></TooltipProvider>;
}

function ClientIntakeView({ submissions, loading, error, onAccept, onDiscard }: { submissions: import("@/lib/clientPortal").ClientSubmission[]; loading: boolean; error: string | null; onAccept: (submission: import("@/lib/clientPortal").ClientSubmission) => void; onDiscard: (submission: import("@/lib/clientPortal").ClientSubmission) => void }) {
  const publicFormPath = `${window.location.origin}${import.meta.env.BASE_URL}#/client`;
  const pending = getPendingClientSubmissions(submissions);
  return <div className="mx-auto max-w-5xl space-y-5"><section className="rounded-[1.75rem] border border-[#cfd9cf] bg-[#edf5ed] p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[#355b48]"><Inbox className="h-5 w-5" /><span className="text-xs font-semibold tracking-[.14em]">PUBLIC INTAKE</span></div><h2 className="mt-2 font-display text-2xl font-semibold text-[#283b31]">公開委託函</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#456153]">將下方網址提供給委託人。他們送出後會先留在此處，直到你檢視內容並建立正式畫約；不會直接進入排單。</p></div><a className="max-w-full break-all rounded-xl border border-[#b9cdbd] bg-[#fffdfa] px-3 py-2 text-sm font-medium text-[#355b48] underline decoration-[#9bb7a0] underline-offset-2" href={publicFormPath} target="_blank" rel="noreferrer noopener">{publicFormPath}</a></div></section>{error && <p className="rounded-xl border border-[#e6c6b8] bg-[#fff2eb] px-4 py-3 text-sm text-[#a9573c]">{error}</p>}<section><div className="mb-4 flex items-center justify-between"><div><h2 className="font-display text-xl font-semibold text-[#283b31]">待閱函件</h2><p className="mt-1 text-sm text-[#456153]">{loading ? "正在讀取公開送件…" : `目前 ${pending.length} 筆等待確認`}</p></div></div>{!loading && pending.length === 0 ? <div className="rounded-2xl border border-dashed border-[#cfd9cf] bg-[#fffdfa] p-10 text-center text-sm leading-6 text-[#6c7e70]">目前沒有等待確認的公開送件。新送件會在此處出現，不影響既有畫約與排單。</div> : <div className="grid gap-4 lg:grid-cols-2">{pending.map((submission) => <article key={submission.id} className="rounded-2xl border border-[#cfd9cf] bg-[#fffdfa] p-5 shadow-[0_8px_20px_rgba(40,59,49,.04)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-lg font-semibold text-[#283b31]">{submission.clientName}</h3><p className="mt-1 text-xs text-[#6c7e70]">{submission.contactEmail} · {new Date(submission.createdAt).toLocaleString("zh-TW")}</p></div><span className="rounded-full bg-[#edf5ed] px-2.5 py-1 text-xs font-semibold text-[#355b48]">{submission.accessMode === "google" ? "Google 帳號" : "驗證碼"}</span></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#456153]">{submission.requirements}</p>{submission.referenceUrls.length > 0 && <div className="mt-4 rounded-xl bg-[#f6f7f2] p-3"><p className="text-xs font-semibold text-[#456153]">設定稿／參考網址</p>{submission.referenceUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="mt-1 block break-all text-xs text-[#355b48] underline">{url}</a>)}</div>}<div className="mt-5 flex gap-2 border-t border-[#e1e6df] pt-4"><Button className="flex-1 bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" onClick={() => onAccept(submission)}><BadgePlus className="mr-1.5 h-4 w-4" />帶入寫畫起約並受理</Button><Button variant="outline" className="border-[#d7a18e] text-[#a9573c] hover:bg-[#fff2eb]" onClick={() => onDiscard(submission)}><Trash2 className="h-4 w-4" /><span className="sr-only">刪除委託函</span></Button></div></article>)}</div>}</section></div>;
}

function DashboardView({ summary, commissions, pendingPayments, onView, onAdvance }: { summary: { total: number; reservations: number; sketching: number; finalizing: number; awaiting: number; awaitingAmount: number; income: number }; commissions: Commission[]; pendingPayments: PendingPaymentCommission[]; onView: (commission: Commission) => void; onAdvance: (commission: Commission, next: CommissionStatus) => void }) {
  const priority = prioritizeRecentCommissions(commissions.filter((commission) => commission.status !== "completed")).slice(0, 4);
  return <div className="space-y-6">
    <section className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
      <SummaryGroup title="筆墨進程" detail={summary.reservations ? `候筆繪列另有 ${summary.reservations} 張預約` : "候筆繪列的目前節奏"} icon={<FolderKanban className="h-4 w-4" />}>
        <div className="grid grid-cols-3 gap-2.5"><CompactSummary label="一般排單" value={String(summary.total)} tone="sage" /><CompactSummary label="草稿製作中" value={String(summary.sketching)} tone="sand" /><CompactSummary label="完稿製作中" value={String(summary.finalizing)} tone="sage" /></div>
      </SummaryGroup>
      <SummaryGroup title="潤筆入匣" detail={summary.awaiting ? `待收 NT$ ${formatCurrency(summary.awaitingAmount)}` : "款項已收錄完畢"} icon={<WalletCards className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2.5"><CompactSummary label="待潤筆" value={`${summary.awaiting} 筆`} tone="rose" /><CompactSummary label="已入帳" value={`NT$ ${formatCurrency(summary.income)}`} tone="ink" /></div>
      </SummaryGroup>
    </section>
    {pendingPayments.length > 0 && <PendingPaymentShelf payments={pendingPayments} onView={onView} />}
    <section className="rounded-[1.5rem] border border-[#cfd9cf] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(40,59,49,.07)] sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-2xl font-semibold text-[#283b31]">近案墨痕</h2><p className="mt-1 text-sm text-[#456153]">加急或期限在前的畫約會優先置頂並以暖色標記；預約單不列入此處。</p></div><Sparkles className="h-5 w-5 text-[#6c9575]" /></div>{priority.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{priority.map((commission) => <CommissionCard commission={commission} key={commission.id} onView={onView} onAdvance={onAdvance} />)}</div> : <EmptyState />}</section>
  </div>;
}

function PendingPaymentShelf({ payments, onView }: { payments: PendingPaymentCommission[]; onView: (commission: Commission) => void }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? payments : payments.slice(0, 3);
  const pendingTotal = payments.reduce((total, item) => total + item.totalAmount, 0);
  const label = (kind: PendingPaymentCommission["entries"][number]["kind"]) => kind === "deposit" ? "待收訂金" : "待收尾款";
  return <section className="rounded-2xl border border-[#e4c7b1] bg-[#fffaf6] p-4 shadow-[0_6px_22px_rgba(169,87,60,.06)] sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-semibold text-[#7d4631]">待潤筆畫約</h2><p className="mt-0.5 text-xs text-[#8b614f]">尚有 {payments.length} 筆待收，合計 NT$ {formatCurrency(pendingTotal)}</p></div><span className="rounded-full border border-[#ecd2c2] bg-[#fff6f0] px-2.5 py-1 text-xs font-medium text-[#a9573c]">待收款</span></div><div className="mt-3 divide-y divide-[#efdcd0] border-y border-[#efdcd0]">{visible.map(({ commission, entries, totalAmount }) => <button type="button" key={commission.id} onClick={() => onView(commission)} className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-[#fff5ee]"><div className="min-w-0"><p className="truncate font-medium text-[#283b31]">{commission.clientName}</p><div className="mt-1 flex flex-wrap gap-1.5">{entries.map((entry) => <span key={entry.kind} className="rounded-full bg-[#fff0e9] px-2 py-0.5 text-[11px] font-medium text-[#a9573c]">{label(entry.kind)}</span>)}<span className="rounded-full bg-[#f2eee8] px-2 py-0.5 text-[11px] text-[#6c6259]">{statusMeta[commission.status].label}</span></div></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-[#7d4631]">NT$ {formatCurrency(totalAmount)}</p><p className="mt-0.5 text-xs text-[#8b614f]">查看畫約 →</p></div></button>)}</div>{payments.length > 3 && <div className="mt-3 text-center"><Button type="button" variant="outline" size="sm" className="border-[#d7b8a7] bg-[#fffdfa] text-[#8e4932] hover:bg-[#fff0e9]" onClick={() => setExpanded((value) => !value)}>{expanded ? "收起待潤筆" : `查看全部待收款（${payments.length}）`}</Button></div>}</section>;
}

function SummaryGroup({ title, detail, icon, children }: { title: string; detail: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#cfd9cf] bg-[#fffdfa] p-4 shadow-[0_6px_22px_rgba(40,59,49,.05)]"><div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dce9dc] text-[#355b48]">{icon}</span><div><h2 className="font-display text-lg font-semibold text-[#283b31]">{title}</h2><p className="text-[11px] text-[#6c7e70]">{detail}</p></div></div>{children}</section>; }
function CompactSummary({ label, value, tone }: { label: string; value: string; tone: "sage" | "sand" | "rose" | "ink" }) { const styles = { sage: "border-[#d2ded2] bg-[#f4f8f3] text-[#355b48]", sand: "border-[#d8ded5] bg-[#f7f7f2] text-[#456153]", rose: "border-[#ecd2c2] bg-[#fff6f0] text-[#a9573c]", ink: "border-[#355b48] bg-[#355b48] text-[#fffdfa]" }; return <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${styles[tone]}`}><p className="truncate text-[11px] font-medium opacity-85">{label}</p><p className="mt-1 truncate font-display text-xl font-semibold leading-none">{value}</p></div>; }

function CommissionShelf({ title, description, commissions, onView, sort, compact = false }: { title: string; description: string; commissions: Commission[]; onView: (commission: Commission) => void; sort: (items: Commission[]) => Commission[]; compact?: boolean }) {
  const [limit, setLimit] = useState(6);
  const ordered = sort(commissions);
  const visible = ordered.slice(0, limit);
  return <section className="rounded-[1.5rem] border border-[#cfd9cf] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(40,59,49,.06)] sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold text-[#283b31]">{title}</h2><p className="mt-1 text-sm text-[#456153]">{description}</p></div><span className="rounded-full bg-[#edf2ed] px-3 py-1 text-xs font-medium text-[#355b48]">{commissions.length} 張</span></div>{visible.length ? <><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((commission) => <CommissionCard commission={commission} key={commission.id} onView={onView} compact={compact} />)}</div>{ordered.length > limit && <div className="mt-5 text-center"><Button variant="outline" className="border-[#b9cdbd] bg-[#fffdfa] text-[#355b48] hover:bg-[#edf5ed]" onClick={() => setLimit((current) => current + 6)}>載入更多</Button></div>}</> : <EmptyState />}</section>;
}

function ArchivedView({ commissions, total, stage, pageSize, hasMore, onStageChange, onPageSizeChange, onLoadMore, onView }: { commissions: Commission[]; total: number; stage: "all" | Exclude<CommissionStatus, "archived">; pageSize: number; hasMore: boolean; onStageChange: (value: "all" | Exclude<CommissionStatus, "archived">) => void; onPageSizeChange: (value: number) => void; onLoadMore: () => void; onView: (commission: Commission) => void }) {
  const stageOptions = (Object.keys(statusMeta) as CommissionStatus[]).filter((item) => item !== "archived");
  return <section className="rounded-[1.5rem] border border-dashed border-[#b9c6ba] bg-[#f7faf7] p-5 shadow-[0_10px_35px_rgba(40,59,49,.05)] sm:p-6"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><h2 className="font-display text-2xl font-semibold text-[#355b48]">封畫入卷</h2><p className="mt-1 text-sm text-[#456153]">已入卷案件不計入一般工作、排單與收款統計；可搜尋、查看、重新啟用或刪除。</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-medium text-[#456153]"><span>入卷前階段</span><Select value={stage} onValueChange={(value) => onStageChange(value as "all" | Exclude<CommissionStatus, "archived">)}><SelectTrigger className="min-w-36 bg-[#fffdfa]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部階段</SelectItem>{stageOptions.map((item) => <SelectItem key={item} value={item}>{statusMeta[item].label}</SelectItem>)}</SelectContent></Select></label><label className="grid gap-1.5 text-xs font-medium text-[#456153]"><span>每次顯示</span><Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}><SelectTrigger className="min-w-28 bg-[#fffdfa]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="12">12 張</SelectItem><SelectItem value="24">24 張</SelectItem><SelectItem value="48">48 張</SelectItem></SelectContent></Select></label></div></div>{total === 0 ? <div className="py-12 text-center"><ArchiveRestore className="mx-auto h-7 w-7 text-[#6c9575]" /><h3 className="mt-4 font-display text-xl font-semibold text-[#355b48]">沒有相符的封畫入卷</h3><p className="mt-2 text-sm text-[#456153]">可調整上方搜尋字詞或入卷前階段篩選。</p></div> : <><div className="mt-5 flex items-center justify-between text-xs text-[#456153]"><span>顯示 {commissions.length}／{total} 張</span><span>依入卷日期由新至舊排序</span></div><div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{commissions.map((commission) => <CommissionCard commission={commission} key={commission.id} onView={onView} />)}</div>{hasMore && <div className="mt-6 text-center"><Button variant="outline" className="border-[#b9cdbd] bg-[#fffdfa] text-[#355b48] hover:bg-[#edf5ed]" onClick={onLoadMore}>載入更多封畫入卷</Button></div>}</>}</section>;
}

function BoardView({ months, rush, reservations, completed, onView }: { months: Record<string, Commission[]>; rush: Commission[]; reservations: Commission[]; completed: Commission[]; onView: (commission: Commission) => void }) {
  const hasQueued = Object.keys(months).length > 0;
  if (!hasQueued && !rush.length && !reservations.length && !completed.length) return <EmptyState />;
  return <div className="space-y-8"><MonthlyQueueShelf months={months} rush={rush} onView={onView} /><CommissionShelf title="先寄墨諾" description="預約案件不計入一般排單，保留約定與等待順序。" commissions={reservations} onView={onView} compact sort={(items) => sortCommissionsForSchedule(items)} /><CommissionShelf title="墨痕錦匣" description="已完成的案件依完稿日期由新至舊收錄。" commissions={completed} onView={onView} compact sort={(items) => [...items].sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt))} /></div>;
}

function MonthlyQueueShelf({ months, rush, onView }: { months: Record<string, Commission[]>; rush: Commission[]; onView: (commission: Commission) => void }) {
  const [limit, setLimit] = useState(6);
  const monthKeys = Object.keys(months).sort((a, b) => a === "unplanned" ? 1 : b === "unplanned" ? -1 : a.localeCompare(b));
  const visibleMonths = monthKeys.slice(0, limit);
  return <section className="rounded-[1.5rem] border border-[#cfd9cf] bg-[#fffdfa] p-5 shadow-[0_10px_35px_rgba(40,59,49,.06)] sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold text-[#283b31]">候筆繪列</h2><p className="mt-1 text-sm text-[#456153]">等待作畫案件；急單不計入一般排單量與月份排程。</p></div><span className="rounded-full bg-[#dce9dc] px-3 py-1 text-xs font-medium text-[#355b48]">{monthKeys.length + (rush.length ? 1 : 0)} 組</span></div>{rush.length > 0 && <div className="mt-5"><div className="mb-3 flex items-center gap-3"><div className="h-px flex-1 bg-[#ead7c7]" /><h3 className="shrink-0 font-display text-xl font-semibold text-[#a9573c]">飛墨急案</h3><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-xs font-medium text-[#a9573c]">{rush.length} 張</span><div className="h-px flex-1 bg-[#ead7c7]" /></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[...rush].sort((a, b) => (a.dueDate ?? Number.MAX_SAFE_INTEGER) - (b.dueDate ?? Number.MAX_SAFE_INTEGER)).map((commission) => <CommissionCard commission={commission} key={commission.id} onView={onView} compact />)}</div></div>}{visibleMonths.length ? <><div className="mt-6 space-y-6">{visibleMonths.map((month) => <div key={month}><div className="mb-3 flex items-center gap-3"><div className="h-px flex-1 bg-[#cfd9cf]" /><h3 className="shrink-0 font-display text-xl font-semibold text-[#283b31]">{month === "unplanned" ? "尚未排定月份" : monthLabel(month)}</h3><span className="rounded-full bg-[#edf2ed] px-2.5 py-1 text-xs font-medium text-[#456153]">{months[month].length} 張</span><div className="h-px flex-1 bg-[#cfd9cf]" /></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{sortCommissionsForSchedule(months[month]).map((commission) => <CommissionCard commission={commission} key={commission.id} onView={onView} compact />)}</div></div>)}</div>{monthKeys.length > limit && <div className="mt-6 text-center"><Button variant="outline" className="border-[#b9cdbd] bg-[#fffdfa] text-[#355b48] hover:bg-[#edf5ed]" onClick={() => setLimit((current) => current + 6)}>載入更多月份</Button></div>}</> : !rush.length && <EmptyState />}</section>;
}

function SummaryCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "sage" | "sand" | "rose" | "ink" }) {
  const colors = { sage: "bg-[#dce9dc] text-[#355b48]", sand: "bg-[#edf2ed] text-[#456153]", rose: "bg-[#fff0e9] text-[#a9573c]", ink: "bg-[#355b48] text-[#fffdfa]" };
  return <article className="rounded-2xl border border-[#cfd9cf] bg-[#fffdfa] p-4 shadow-[0_6px_22px_rgba(40,59,49,.06)]"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors[tone]}`}>{icon}</div><p className="mt-4 text-sm font-medium text-[#456153]">{label}</p><p className="mt-1 font-display text-2xl font-semibold text-[#283b31]">{value}</p><p className="mt-1 text-xs text-[#6c7e70]">{detail}</p></article>;
}

function InitialImport({ onImport, loading }: { onImport: () => void; loading: boolean }) {
  return <div className="relative overflow-hidden rounded-[2rem] border border-[#cfd9cf] bg-[#fffdfa] p-8 text-center shadow-[0_18px_45px_rgba(40,59,49,.08)] sm:p-14"><div className="absolute -left-10 -top-10 h-44 w-44 rounded-full bg-[#dce9dc] blur-2xl" /><div className="relative mx-auto max-w-lg"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dce9dc] text-[#355b48]"><FolderKanban className="h-6 w-6" /></div><h2 className="mt-5 font-display text-3xl font-semibold text-[#283b31]">先收舊卷，再續新章</h2><p className="mt-3 leading-7 text-[#456153]">已為你整理八月與九月的 14 筆舊約，保留原始價格筆記。匯入後可逐筆補上收款、草稿與作畫進度。</p><Button className="mt-6 bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" onClick={onImport} disabled={loading}>{loading ? "正在收卷…" : "收錄既有約稿"}</Button></div></div>;
}

function EmptyState() { return <div className="py-14 text-center text-sm text-[#456153]">此處暫無相符約稿。可調整尋卷條件，或另起一紙新約。</div>; }

function LoginScreen() {
  const { signIn, signInWithGoogle, googleSignInIssue, clearGoogleSignInIssue } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [portalCode, setPortalCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSubmitting(true); setError(""); try { await signIn(email, password); } catch { setError("無法登入，請確認電子郵件、密碼與 Firebase Authentication 設定。"); } finally { setSubmitting(false); } };
  const googleLogin = async () => { setError(""); try { await signInWithGoogle(); } catch (nextError) { setError(describeFirebaseAuthError(nextError)); } };
  const openClientPortal = () => { clearGoogleSignInIssue(); setError(""); window.location.hash = "/client"; };
  const lookupProgress = () => { const normalized = portalCode.trim().toUpperCase(); if (!isPortalAccessCode(normalized)) { setError("請輸入完整的專屬驗證碼。"); return; } clearGoogleSignInIssue(); setError(""); window.location.hash = getClientProgressPath(normalized).replace(/^\/#/, ""); };
  return <div className="min-h-screen bg-[#fffdfa] p-5"><div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-[#cfd9cf] bg-[#fffdfa] shadow-[0_24px_70px_rgba(40,59,49,.13)] lg:grid-cols-[1.1fr_.9fr]"><div className="relative hidden overflow-hidden bg-[#283b31] p-12 text-[#fffdfa] lg:block"><div className="absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_18%_21%,#bc694c_0,transparent_28%),radial-gradient(circle_at_72%_78%,#6c9575_0,transparent_27%)]" /><div className="relative flex h-full flex-col justify-between"><div><div className="flex items-center gap-3"><img src={titleIconSrc} className="h-9 w-9" alt="繪月錄圖示" /><p className="text-xs tracking-[0.25em] text-[#dce9dc]">繪月錄 · HUI YUE LEDGER</p></div><h1 className="mt-5 font-display text-5xl leading-[1.12]">讓每一筆<br />畫約都安放於<br />恰好的章法。</h1></div><p className="max-w-sm text-sm leading-7 text-[#fffdfa]/85">登入後，系統會自動辨識繪師或委託人身分，帶您前往對應空間。</p></div></div><div className="flex items-center justify-center p-7 sm:p-12"><div className="w-full max-w-sm space-y-5"><div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dce9dc] text-[#355b48]"><LockKeyhole className="h-5 w-5" /></div><p className="mt-6 font-display text-3xl font-semibold text-[#283b31]">重臨畫案</p><p className="mt-2 text-sm leading-6 text-[#456153]">使用您的登入方式，系統會自動帶往工作台、委託填單或個人案件進度。</p></div><form className="space-y-4" onSubmit={submit}><label className="grid gap-2"><Label>電子郵件</Label><Input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className="grid gap-2"><Label>密碼</Label><Input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><Button className="w-full bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" type="submit" disabled={submitting}>{submitting ? "登入中…" : "以帳密登入"}</Button></form><div className="border-t border-[#d8ded5] pt-4"><Button variant="outline" className="w-full border-[#b9cdbd] text-[#355b48] hover:bg-[#edf5ed]" onClick={() => void googleLogin()}><LogIn className="mr-1.5 h-4 w-4" />使用 Google 帳號登入</Button><Button type="button" variant="outline" className="mt-3 w-full border-[#b9cdbd] bg-[#edf5ed] text-[#355b48] hover:bg-[#dce9dc]" onClick={openClientPortal}><BadgePlus className="mr-1.5 h-4 w-4" />未登入？直接填寫委託</Button><div className="mt-4 rounded-xl bg-[#edf5ed] p-3"><Label className="text-xs text-[#355b48]">已有專屬驗證碼？</Label><div className="mt-2 flex gap-2"><Input className="h-9 min-w-0 text-xs" value={portalCode} onChange={(event) => setPortalCode(event.target.value)} placeholder="HY-…" /><Button type="button" size="sm" variant="outline" className="shrink-0 border-[#b9cdbd] text-[#355b48]" onClick={lookupProgress}><KeyRound className="mr-1 h-3.5 w-3.5" />查看</Button></div></div></div>{(error || googleSignInIssue) && <><p className="rounded-xl bg-[#fff0e9] px-3 py-2 text-xs leading-5 text-[#8e4932]">{error || googleSignInIssue}</p><SafariGoogleSignInHint visible={Boolean(googleSignInIssue)} /></>}</div></div></div></div>;
}

function AccessDenied() { const { signOut, user } = useFirebaseAuth(); return <div className="flex min-h-screen items-center justify-center bg-[#fffdfa] p-5"><div className="max-w-md rounded-[1.75rem] border border-[#cfd9cf] bg-[#fffdfa] p-8 text-center shadow-[0_18px_50px_rgba(40,59,49,.1)]"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0e9] text-[#a9573c]"><LockKeyhole className="h-6 w-6" /></div><h1 className="mt-5 font-display text-2xl font-semibold text-[#283b31]">這個帳號尚未獲得存取權</h1><p className="mt-3 text-sm leading-6 text-[#456153]">目前登入的帳號為 {user?.email ?? "未知帳號"}。請以已列入 Firebase 管理者白名單的繪師帳號登入。</p><Button variant="outline" className="mt-6 border-[#cfd9cf] text-[#355b48] hover:bg-[#edf2ed]" onClick={() => void signOut()}>換一個帳號</Button></div></div>; }
function ConfigMissing() { return <div className="flex min-h-screen items-center justify-center bg-[#fffdfa] p-5"><div className="max-w-md rounded-[1.75rem] border border-[#cfd9cf] bg-[#fffdfa] p-8 text-center"><CloudOff className="mx-auto h-7 w-7 text-[#a9573c]" /><h1 className="mt-4 font-display text-2xl text-[#283b31]">尚未設定 Firebase</h1><p className="mt-3 text-sm leading-6 text-[#456153]">請依 README 提供的 Firebase 環境變數與部署步驟設定此應用程式。</p></div></div>; }
function LoadingScreen() { return <div className="flex min-h-screen items-center justify-center bg-[#fffdfa]"><div className="flex items-center gap-3 text-sm text-[#456153]"><span className="h-3 w-3 animate-pulse rounded-full bg-[#6c9575]" />正展卷入案…</div></div>; }

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { SafariGoogleSignInHint } from "@/components/SafariGoogleSignInHint";
import { ClientProgress, ClientSubmission, buildPendingClientProgress, createPortalAccessCode, getClientProgressPath, hydrateClientSubmission, isPortalAccessCode, normalizeReferenceUrls } from "@/lib/clientPortal";
import { ArtworkItem, LicenseOption, PaymentState, ScheduleType, applyAutomaticPricing, contactChannels, createArtworkItem, createBlankCommission, formatCurrency, formatDisplayDate, getAvailableFinishes, getAvailableQSizes, getAvailableScopes, statusMeta } from "@/lib/commission";
import { describeAnonymousAuthError, describeFirebaseAuthError, firebaseAuth, firestoreDb } from "@/lib/firebase";
import { StudioSettings, defaultStudioSettings, normalizeStudioSettings } from "@/lib/studioSettings";
import { AtSign, CheckCircle2, ChevronDown, ClipboardList, Eye, Facebook, KeyRound, LoaderCircle, LogIn, MoonStar, Palette, Plus, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { collection, doc, getDoc, onSnapshot, query, setDoc, where, writeBatch } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

type PortalTab = "submit" | "progress";

const emptyForm = {
  clientName: "", contactEmail: "", contactChannel: "Facebook", contactHandle: "", characterSettingNote: "", poseNote: "", costumeDesignNote: "", accessoryNote: "", requirements: "", referenceUrls: "", deliveryNote: "", scheduleType: "queued" as ScheduleType, artworkItems: [] as ArtworkItem[], isRush: false, licenses: [] as LicenseOption[], dueDate: "",
};

const socialLinks = [
  { label: "作品集", href: "https://lunar72016.wixsite.com/muing", icon: Palette },
  { label: "Facebook", href: "https://www.facebook.com/liu.mu.ying.760255", icon: Facebook },
  { label: "Threads", href: "https://www.threads.com/@liu_mu_ying", icon: AtSign },
  { label: "X", href: "https://x.com/Muing_315830", icon: Send },
];

function makePublicArtworkItem(settings: StudioSettings): ArtworkItem | null {
  const scope = getAvailableScopes(settings)[0] as ArtworkItem["artScope"] | undefined;
  if (!scope) return null;
  if (scope === "Q版") { const qSize = getAvailableQSizes(settings)[0]; return qSize ? createArtworkItem({ artScope: scope, qSize }) : null; }
  const finish = getAvailableFinishes(settings, scope)[0];
  return finish ? createArtworkItem({ artScope: scope, finishLevel: finish, qSize: null }) : null;
}

function readableFirebaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("auth/")) return describeFirebaseAuthError(error);
  if (message.includes("auth/operation-not-allowed")) return "此登入方式尚未啟用。請通知繪師於 Firebase Authentication 開啟 Google 或 Anonymous Provider。";
  if (message.includes("permission-denied") || message.includes("insufficient permissions")) return "資料庫尚未套用委託人入口規則，請通知繪師在 Firebase Console 發布最新版 firestore.rules 後再試。";
  return "目前無法完成操作，請確認網路後再試。";
}

function readableCodeLookupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("permission-denied") || message.includes("insufficient permissions")) return "找不到可用的進度連結。請確認驗證碼，或請繪師先建立／重新提供專屬驗證碼。";
  return readableFirebaseError(error);
}

export default function ClientPortalPage({ initialTab }: { initialTab?: PortalTab }) {
  const { user, loading, signInWithGoogle, signInWithAnonymousAccount, signOut, googleSignInIssue, clearGoogleSignInIssue } = useFirebaseAuth();
  const routeCode = useMemo(() => {
    const route = window.location.hash.replace(/^#/, "") || window.location.pathname;
    const match = route.match(/^\/client\/progress\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]).toUpperCase() : "";
  }, []);
  const [tab, setTab] = useState<PortalTab>(routeCode ? "progress" : initialTab ?? "submit");
  const [form, setForm] = useState(emptyForm);
  const [settings, setSettings] = useState<StudioSettings>(defaultStudioSettings());
  const [pricingReady, setPricingReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultCode, setResultCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState(routeCode);
  const [codeProgress, setCodeProgress] = useState<ClientProgress | null>(null);
  const [searching, setSearching] = useState(false);
  const [myProgress, setMyProgress] = useState<ClientProgress[]>([]);
  const [mySubmissions, setMySubmissions] = useState<ClientSubmission[]>([]);

  useEffect(() => {
    if (!firestoreDb) return;
    return onSnapshot(doc(firestoreDb, "publicStudioSettings", "studio"), (snapshot) => {
      setSettings(normalizeStudioSettings(snapshot.exists() ? snapshot.data() as Partial<StudioSettings> : undefined));
      setPricingReady(snapshot.exists());
    }, () => setPricingReady(false));
  }, []);

  useEffect(() => {
    if (form.artworkItems.length) return;
    const initial = makePublicArtworkItem(settings);
    if (initial) setForm((current) => current.artworkItems.length ? current : { ...current, artworkItems: [initial] });
  }, [form.artworkItems.length, settings]);

  useEffect(() => {
    const syncProgressRoute = () => {
      const route = window.location.hash.replace(/^#/, "") || window.location.pathname;
      const match = route.match(/^\/client\/progress\/([^/]+)$/);
      if (!match) return;
      const nextCode = decodeURIComponent(match[1]).toUpperCase();
      setCode(nextCode);
      setTab("progress");
    };
    syncProgressRoute();
    window.addEventListener("hashchange", syncProgressRoute);
    return () => window.removeEventListener("hashchange", syncProgressRoute);
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous || !firestoreDb) return;
    void setDoc(doc(firestoreDb, "clientProfiles", user.uid), {
      uid: user.uid, email: user.email ?? "", displayName: user.displayName ?? "", updatedAt: Date.now(),
    }, { merge: true });
    setForm((current) => current.contactEmail ? current : { ...current, contactEmail: user.email ?? "", clientName: user.displayName ?? "" });
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !firestoreDb) {
      setMyProgress([]); setMySubmissions([]);
      return;
    }
    const progressQuery = query(collection(firestoreDb, "clientProgress"), where("clientUid", "==", user.uid), where("revokedAt", "==", null));
    const submissionQuery = query(collection(firestoreDb, "clientSubmissions"), where("clientUid", "==", user.uid));
    const unsubscribeProgress = onSnapshot(progressQuery, (snapshot) => setMyProgress(snapshot.docs.map((item) => item.data() as ClientProgress)), () => setMyProgress([]));
    const unsubscribeSubmissions = onSnapshot(submissionQuery, (snapshot) => setMySubmissions(snapshot.docs.map((item) => hydrateClientSubmission(item.id, item.data() as ClientSubmission)).sort((a, b) => b.createdAt - a.createdAt)), () => setMySubmissions([]));
    return () => { unsubscribeProgress(); unsubscribeSubmissions(); };
  }, [user?.uid]);

  const update = <K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const preview = useMemo(() => {
    const rawBase = form.artworkItems.reduce((sum, item) => sum + (item.artScope === "Q版" ? settings.qVariantPrices[item.qSize ?? "2頭身"] ?? 0 : settings.combinationPrices[item.artScope]?.[item.finishLevel] ?? 0) * Math.max(1, item.characterCount), 0);
    return applyAutomaticPricing(settings, { ...createBlankCommission(), artworkItems: form.artworkItems, isRush: form.isRush, rushLevel: "一般加急", licenses: form.licenses, estimatedPrice: rawBase });
  }, [form.artworkItems, form.isRush, form.licenses, settings]);
  const useGoogle = async () => {
    setError(null);
    try { await signInWithGoogle(); } catch (nextError) { setError(readableFirebaseError(nextError)); }
  };

  const submit = async () => {
    if (!form.clientName.trim() || !form.contactEmail.trim() || !form.artworkItems.length) {
      setError("請填寫寄墨主姓名、電子郵件與至少一項作畫項目後再送出。");
      return;
    }
    if (!firestoreDb) { setError("Firebase 尚未設定完成。"); return; }
    setSubmitting(true);
    setError(null);
    try {
      if (!firebaseAuth?.currentUser) {
        try { await signInWithAnonymousAccount(); }
        catch (authError) { setError(describeAnonymousAuthError(authError)); return; }
      }
      const currentUser = firebaseAuth?.currentUser;
      if (!currentUser) throw new Error("auth/session-missing");
      const accessCode = createPortalAccessCode();
      const now = Date.now();
      const reference = doc(collection(firestoreDb, "clientSubmissions"));
      const access = {
        id: accessCode,
        accessMode: currentUser.isAnonymous ? "code" as const : "google" as const,
        clientUid: currentUser.uid,
        accessCode: currentUser.isAnonymous ? accessCode : null,
        ownerUid: import.meta.env.VITE_FIREBASE_ALLOWED_UID ?? "",
      };
      const batch = writeBatch(firestoreDb);
      batch.set(reference, {
        id: reference.id,
        ownerUid: access.ownerUid,
        clientUid: currentUser.uid,
        accessCode,
        accessMode: access.accessMode,
        ...form,
        referenceUrls: normalizeReferenceUrls(form.referenceUrls),
        state: "submitted",
        scheduleType: form.scheduleType,
        artworkItems: form.artworkItems,
        isRush: form.isRush,
        licenses: form.licenses,
        deliveryPreference: form.dueDate ? "date" : "unspecified",
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).getTime() : null,
        estimatedPrice: preview.rawBasePrice,
        createdAt: now,
        updatedAt: now,
      });
      if (currentUser.isAnonymous) batch.set(doc(firestoreDb, "clientProgress", accessCode), buildPendingClientProgress(access, form.clientName.trim()));
      await batch.commit();
      setResultCode(accessCode);
      setForm((current) => ({ ...emptyForm, contactEmail: currentUser.email ?? "", clientName: currentUser.displayName ?? "" }));
    } catch (nextError) {
      setError(readableFirebaseError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const lookupCode = async () => {
    const normalized = code.trim().toUpperCase();
    if (!isPortalAccessCode(normalized)) { setError("請輸入完整的專屬驗證碼。"); return; }
    if (!firestoreDb) { setError("Firebase 尚未設定完成。"); return; }
    setSearching(true);
    setError(null);
    clearGoogleSignInIssue();
    try {
      const result = await getDoc(doc(firestoreDb, "clientProgress", normalized));
      const data = result.exists() ? result.data() as ClientProgress : null;
      if (!data || data.revokedAt) {
        setCodeProgress(null);
        setError("找不到可用的進度連結；請確認驗證碼或向繪師索取新的連結。");
        return;
      }
      setCodeProgress(data);
      window.location.hash = getClientProgressPath(normalized).replace(/^\/#/, "");
    } catch (nextError) {
      setError(readableCodeLookupError(nextError));
    } finally {
      setSearching(false);
    }
  };

  const signedInWithGoogle = Boolean(user && !user.isAnonymous);
  return (
    <main className="min-h-screen bg-[#f6f5ef] px-4 py-6 text-[#283b31] sm:px-8 sm:py-10">
      <section className="mx-auto max-w-3xl">
        <header className="rounded-[2rem] bg-[#283b31] px-6 py-8 text-[#fffdfa] shadow-[0_18px_48px_rgba(40,59,49,.16)] sm:px-10">
          <div className="flex items-center gap-3 text-[#dbe8dc]"><MoonStar className="h-6 w-6" /><span className="text-xs font-semibold tracking-[.18em]">繪月錄 · 寄墨主入口</span></div>
          <h1 className="mt-5 font-display text-3xl sm:text-4xl">把委託內容，交給月光妥善收錄。</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#d8e4da]">您可先填寫墨諾函箋，並隨時以 Google 帳號或專屬驗證碼查看自己的畫約進度。</p>
          <div className="mt-6 flex flex-wrap gap-2">{socialLinks.map(({ label, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-full border border-[#a9c1ad]/45 bg-[#355b48]/65 px-3 py-1.5 text-xs font-medium text-[#fffdfa] transition hover:bg-[#456e57]"><Icon className="h-3.5 w-3.5" />{label}</a>)}</div>
        </header>
        <div className="mt-5 flex rounded-2xl border border-[#cfd9cf] bg-[#fffdfa] p-1.5">
          <TabButton active={tab === "submit"} onClick={() => setTab("submit")} icon={<ClipboardList />}>懸榜昭繪</TabButton>
          <TabButton active={tab === "progress"} onClick={() => setTab("progress")} icon={<Sparkles />}>查看進度</TabButton>
        </div>
        {(error || googleSignInIssue) && <div className="mt-4 space-y-3"><p className="rounded-xl border border-[#e6c6b8] bg-[#fff2eb] px-4 py-3 text-sm text-[#a9573c]">{error || googleSignInIssue}</p><SafariGoogleSignInHint visible={Boolean(googleSignInIssue)} /></div>}
        {tab === "submit" ? (
          <SubmissionForm
            form={form}
            settings={settings}
            pricingReady={pricingReady}
            previewAmount={preview.finalPrice ?? 0}
            previewMultiplier={preview.rushMultiplier ?? 1}
            update={update}
            onSubmit={submit}
            submitting={submitting}
            loading={loading}
            signedInWithGoogle={signedInWithGoogle}
            accountEmail={user?.email ?? "Google 帳號"}
            onGoogle={useGoogle}
            onSignOut={() => void signOut()}
            resultCode={resultCode}
          />
        ) : (
          <ProgressPanel
            signedInWithGoogle={signedInWithGoogle}
            accountEmail={user?.email ?? "Google 帳號"}
            code={code}
            setCode={setCode}
            codeProgress={codeProgress}
            myProgress={myProgress}
            mySubmissions={mySubmissions}
            searching={searching}
            onLookup={lookupCode}
            onGoogle={useGoogle}
            onSignOut={() => void signOut()}
          />
        )}
      </section>
    </main>
  );
}

function SubmissionForm({ form, settings, pricingReady, previewAmount, previewMultiplier, update, onSubmit, submitting, loading, signedInWithGoogle, accountEmail, onGoogle, onSignOut, resultCode }: {
  form: typeof emptyForm; settings: StudioSettings; pricingReady: boolean; previewAmount: number; previewMultiplier: number; update: <K extends keyof typeof emptyForm>(key: K, value: typeof emptyForm[K]) => void; onSubmit: () => Promise<void>; submitting: boolean; loading: boolean; signedInWithGoogle: boolean; accountEmail: string; onGoogle: () => Promise<void>; onSignOut: () => void; resultCode: string | null;
}) {
  const addItem = () => { const item = makePublicArtworkItem(settings); if (item) update("artworkItems", [...form.artworkItems, item]); };
  const updateItem = (id: string, patch: Partial<ArtworkItem>) => update("artworkItems", form.artworkItems.map((item) => {
    if (item.id !== id) return item; const next = { ...item, ...patch };
    if (patch.artScope === "Q版") return { ...next, qSize: getAvailableQSizes(settings)[0] ?? "2頭身" };
    if (patch.artScope) return { ...next, qSize: null, finishLevel: getAvailableFinishes(settings, patch.artScope)[0] ?? next.finishLevel };
    return next;
  }));
  const toggleLicense = (license: LicenseOption, checked: boolean) => {
    let licenses = checked ? [...form.licenses, license] : form.licenses.filter((item) => item !== license);
    if (checked && license === "commercial") licenses = licenses.filter((item) => item !== "promotion");
    if (checked && license === "promotion") licenses = licenses.filter((item) => item !== "commercial");
    update("licenses", Array.from(new Set(licenses)));
  };
  return <section className="mt-5 rounded-[2rem] border border-[#cfd9cf] bg-[#fffdfa] p-5 shadow-[0_14px_32px_rgba(40,59,49,.06)] sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-2xl">懸榜昭繪</h2><p className="mt-1 text-sm leading-6 text-[#456153]">請留下作畫項目與設定稿網址；繪師將啟讀墨諾函箋並與您確認細節。</p></div>{signedInWithGoogle ? <AccountBadge email={accountEmail} onSignOut={onSignOut} /> : <Button variant="outline" className="border-[#b9cdbd] text-[#355b48]" onClick={() => void onGoogle()}><LogIn className="mr-1.5 h-4 w-4" />以 Google 帳號填寫</Button>}</div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="寄墨主姓名 *"><Input value={form.clientName} onChange={(event) => update("clientName", event.target.value)} /></Field><Field label="聯絡管道"><Select value={form.contactChannel} onValueChange={(value) => update("contactChannel", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{contactChannels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent></Select></Field><Field label="電子郵件 *"><Input type="email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} /></Field><Field label="帳號／聯絡方式"><Input value={form.contactHandle} onChange={(event) => update("contactHandle", event.target.value)} /></Field></div><label className="mt-5 flex min-h-11 items-center gap-3 rounded-xl border border-[#c9d5ca] bg-[#f4f8f3] px-3 text-sm font-medium text-[#355b48]"><Checkbox checked={form.scheduleType === "reservation"} onCheckedChange={(checked) => update("scheduleType", checked ? "reservation" : "queued")} />此為預約單</label><section className="mt-7 border-t border-[#d8ded5] pt-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-xl">作畫項目 *</h3><p className="mt-1 text-xs leading-5 text-[#456153]">可填多個項目；預估底價會依人物數量、範圍、精緻度與倍率計算。</p></div><Button type="button" variant="outline" className="border-[#b9cdbd] text-[#355b48]" disabled={!pricingReady || !getAvailableScopes(settings).length} onClick={addItem}><Plus className="mr-1.5 h-4 w-4" />增加項目</Button></div>{!pricingReady || !getAvailableScopes(settings).length ? <p className="mt-4 rounded-xl bg-[#fff7f1] px-3 py-2 text-sm text-[#8b5238]">繪師尚未發布公開價目；仍可留下其他需求，或請稍後再選擇作畫項目。</p> : <div className="mt-4 space-y-3">{form.artworkItems.map((item, index) => <PublicArtworkItem key={item.id} item={item} index={index} settings={settings} onChange={(patch) => updateItem(item.id, patch)} onRemove={() => update("artworkItems", form.artworkItems.filter((current) => current.id !== item.id))} removable={form.artworkItems.length > 1} />)}</div>}<div className="mt-4 rounded-2xl border border-[#b9cdbd] bg-[#edf5ed] p-4"><p className="text-xs font-semibold tracking-[.1em] text-[#456153]">預估底價</p><p className="mt-1 font-display text-2xl font-semibold text-[#283b31]">NT$ {formatCurrency(previewAmount)}</p><p className="mt-1 text-xs text-[#456153]">已按目前倍率 ×{previewMultiplier.toFixed(1)} 試算；最終報價以繪師確認內容為準。</p></div></section><section className="mt-7 border-t border-[#d8ded5] pt-6"><h3 className="font-display text-xl">期限、加急與權利</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="希望交稿日期"><Input type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} /></Field><label className="flex min-h-10 items-center gap-3 self-end rounded-xl border border-[#c9d5ca] bg-[#f4f8f3] px-3 text-sm font-medium text-[#355b48]"><Checkbox checked={form.isRush} onCheckedChange={(checked) => update("isRush", Boolean(checked))} />希望以加急方式安排</label></div><div className="mt-4 flex flex-wrap gap-2">{(["commercial", "promotion", "buyout"] as LicenseOption[]).map((license) => <label key={license} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${form.licenses.includes(license) ? "border-[#9bb7a0] bg-[#dce9dc] text-[#283b31]" : "border-[#c9d5ca] text-[#355b48]"}`}><Checkbox checked={form.licenses.includes(license)} onCheckedChange={(checked) => toggleLicense(license, Boolean(checked))} />{{ commercial: "商用", promotion: "宣傳", buyout: "買斷" }[license]}</label>)}</div><Field label="期限或其他補充" className="mt-4"><Textarea value={form.deliveryNote} onChange={(event) => update("deliveryNote", event.target.value)} placeholder="例如：活動日期、可調整的程度或其他安排。" /></Field></section><section className="mt-7 border-t border-[#d8ded5] pt-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="人物設定"><Textarea value={form.characterSettingNote} onChange={(event) => update("characterSettingNote", event.target.value)} /></Field><Field label="動作／構圖"><Textarea value={form.poseNote} onChange={(event) => update("poseNote", event.target.value)} /></Field><Field label="服裝設計"><Textarea value={form.costumeDesignNote} onChange={(event) => update("costumeDesignNote", event.target.value)} /></Field><Field label="配飾／背景"><Textarea value={form.accessoryNote} onChange={(event) => update("accessoryNote", event.target.value)} /></Field></div><Field label="其他作畫需求" className="mt-5"><Textarea className="min-h-28" value={form.requirements} onChange={(event) => update("requirements", event.target.value)} /></Field><Field label="設定稿／參考資料雲端網址" className="mt-5"><Textarea value={form.referenceUrls} onChange={(event) => update("referenceUrls", event.target.value)} placeholder="可貼上 Google Drive、Dropbox、雲端相簿等網址；多個網址可分行填寫。" /></Field></section><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#d8ded5] pt-5"><p className="max-w-md text-xs leading-5 text-[#6c7e70]"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />未使用 Google 帳號時，系統會建立受限工作階段並提供專屬驗證碼；請妥善保存。</p><Button disabled={submitting || loading || !form.artworkItems.length} className="bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" onClick={() => void onSubmit()}>{submitting && <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />}{submitting ? "寄出中…" : "寄出墨諾函箋"}</Button></div>{resultCode && <div className="mt-5 rounded-2xl border border-[#b9cdbd] bg-[#edf5ed] p-4"><p className="flex items-center gap-2 font-semibold text-[#283b31]"><CheckCircle2 className="h-5 w-5 text-[#3e6c50]" />墨諾函箋已送達</p><p className="mt-2 text-sm text-[#456153]">請保存此專屬驗證碼。繪師建立畫約後，可用它查看進度：</p><code className="mt-3 block break-all rounded-xl bg-[#fffdfa] px-3 py-2 text-sm font-semibold text-[#283b31]">{resultCode}</code></div>}</section>;
}

function PublicArtworkItem({ item, index, settings, onChange, onRemove, removable }: { item: ArtworkItem; index: number; settings: StudioSettings; onChange: (patch: Partial<ArtworkItem>) => void; onRemove: () => void; removable: boolean }) {
  const scopes = Array.from(new Set([...getAvailableScopes(settings), item.artScope])); const finishes = getAvailableFinishes(settings, item.artScope); const qSizes = getAvailableQSizes(settings);
  return <article className="rounded-2xl border border-[#d8ded5] bg-[#fffdfa] p-4"><div className="mb-3 flex items-center justify-between"><p className="font-medium text-[#355b48]">作畫項目 {index + 1}</p>{removable && <Button type="button" size="sm" variant="ghost" className="text-[#a9573c]" onClick={onRemove}><Trash2 className="mr-1 h-3.5 w-3.5" />移除</Button>}</div><div className="grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-3"><Field label="人物"><Input type="number" min="1" value={item.characterCount} onChange={(event) => onChange({ characterCount: Math.max(1, Number(event.target.value) || 1) })} /></Field><Field label="繪製範圍"><Select value={item.artScope} onValueChange={(value) => onChange({ artScope: value as ArtworkItem["artScope"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{scopes.map((scope) => <SelectItem key={scope} value={scope}>{scope}</SelectItem>)}</SelectContent></Select></Field>{item.artScope === "Q版" ? <Field label="Q版規格"><Select value={item.qSize ?? qSizes[0]} onValueChange={(value) => onChange({ qSize: value as ArtworkItem["qSize"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{qSizes.map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}</SelectContent></Select></Field> : <Field label="精緻度"><Select value={item.finishLevel} onValueChange={(value) => onChange({ finishLevel: value as ArtworkItem["finishLevel"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{finishes.map((finish) => <SelectItem key={finish} value={finish}>{finish}</SelectItem>)}</SelectContent></Select></Field>}</div><Field label="項目備註" className="mt-3"><Input value={item.note} onChange={(event) => onChange({ note: event.target.value })} /></Field></article>;
}

function ProgressPanel({ signedInWithGoogle, accountEmail, code, setCode, codeProgress, myProgress, mySubmissions, searching, onLookup, onGoogle, onSignOut }: { signedInWithGoogle: boolean; accountEmail: string; code: string; setCode: (value: string) => void; codeProgress: ClientProgress | null; myProgress: ClientProgress[]; mySubmissions: ClientSubmission[]; searching: boolean; onLookup: () => Promise<void>; onGoogle: () => Promise<void>; onSignOut: () => void }) {
  const progress = codeProgress ? [codeProgress] : myProgress;
  return <section className="mt-5 rounded-[2rem] border border-[#cfd9cf] bg-[#fffdfa] p-5 shadow-[0_14px_32px_rgba(40,59,49,.06)] sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-2xl">我的畫約進度</h2><p className="mt-1 text-sm leading-6 text-[#456153]">此頁顯示繪師公開給寄墨主的畫約、款項與作畫進度。</p></div>{signedInWithGoogle ? <AccountBadge email={accountEmail} onSignOut={onSignOut} /> : <Button variant="outline" className="border-[#b9cdbd] text-[#355b48]" onClick={() => void onGoogle()}><LogIn className="mr-1.5 h-4 w-4" />使用 Google 帳號</Button>}</div><div className="mt-6 rounded-2xl bg-[#edf5ed] p-4"><Label className="text-[#355b48]">沒有 Google 帳號？輸入專屬驗證碼</Label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="HY-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx" /><Button variant="outline" className="border-[#b9cdbd] text-[#355b48]" disabled={searching} onClick={() => void onLookup()}><KeyRound className="mr-1.5 h-4 w-4" />{searching ? "查詢中…" : "查看"}</Button></div></div><div className="mt-6 space-y-3">{progress.map((item) => <ProgressCard key={item.id} progress={item} />)}{mySubmissions.length > 0 && <div className="rounded-2xl border border-dashed border-[#cfd9cf] p-4"><p className="font-medium">已寄出的墨諾函箋</p><div className="mt-2 space-y-1 text-sm text-[#456153]">{mySubmissions.map((item) => <p key={item.id}>· {item.state === "submitted" ? "等待繪師啟函" : item.state === "accepted" ? "已轉為畫約" : "未受理"} · {new Date(item.createdAt).toLocaleDateString("zh-TW")}</p>)}</div></div>}{progress.length === 0 && <div className="rounded-2xl border border-dashed border-[#cfd9cf] p-8 text-center text-sm leading-6 text-[#6c7e70]">尚未找到已公開的畫約。若您剛寄出墨諾函箋，請等候繪師確認；也可使用繪師提供的專屬驗證碼查看。</div>}</div></section>;
}

function ProgressCard({ progress }: { progress: ClientProgress }) {
  const [open, setOpen] = useState(false);
  const badge = progress.isRush ? "飛墨急案" : progress.scheduleType === "reservation" ? "先寄墨諾" : null;
  const paymentText = (state: PaymentState | undefined, paidAt: number | null | undefined) => state === "paid" ? `已繳 · ${formatDisplayDate(paidAt)}` : state === "unpaid" ? "待繳" : "待繪師補登";
  return <article className="rounded-2xl border border-[#cfd9cf] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-display text-lg font-semibold">{progress.clientName} 的畫約</p><p className="mt-1 text-xs text-[#6c7e70]">{progress.orderCode}</p></div><div className="flex flex-wrap justify-end gap-1.5">{badge && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${progress.isRush ? "bg-[#fff0e9] text-[#a9573c]" : "bg-[#f3eef9] text-[#6b4d83]"}`}>{badge}</span>}<span className="rounded-full bg-[#edf5ed] px-2.5 py-1 text-xs font-semibold text-[#355b48]">{progress.statusLabel}</span></div></div><p className="mt-4 text-sm leading-6 text-[#456153]">{progress.nextStep}</p><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-[#6c7e70]">排程週次：</span>{progress.scheduleWeekLabel}</p>{progress.dueDateLabel && <p><span className="text-[#6c7e70]">交稿期限：</span>{progress.dueDateLabel}</p>}</div><Button type="button" variant="outline" size="sm" className="mt-4 border-[#b9cdbd] text-[#355b48]" onClick={() => setOpen((value) => !value)}><Eye className="mr-1.5 h-4 w-4" />{open ? "收起內容" : "查看內容"}<ChevronDown className={`ml-1.5 h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} /></Button>{open && <div className="mt-4 space-y-4 border-t border-[#d8ded5] pt-4"><div><p className="text-xs font-semibold tracking-[.1em] text-[#6c7e70]">作畫項目</p><div className="mt-2 space-y-2">{progress.artworkItems?.length ? progress.artworkItems.map((item) => <p key={item.id} className="rounded-xl bg-[#f6f7f2] px-3 py-2 text-sm text-[#355b48]">{item.summary}</p>) : <p className="text-sm text-[#6c7e70]">繪師確認後提供。</p>}</div></div><div className="grid gap-3 rounded-xl bg-[#f6f7f2] p-3 text-sm sm:grid-cols-2"><p><span className="text-[#6c7e70]">委託日：</span>{formatDisplayDate(progress.createdAt)}</p><p><span className="text-[#6c7e70]">總價：</span>NT$ {formatCurrency(progress.totalAmount)}</p><p><span className="text-[#6c7e70]">訂金：</span>NT$ {formatCurrency(progress.depositAmount)} · {paymentText(progress.depositState, progress.depositPaidAt)}</p><p><span className="text-[#6c7e70]">尾款：</span>NT$ {formatCurrency(progress.balanceAmount)} · {paymentText(progress.balanceState, progress.balancePaidAt)}</p></div><div><p className="text-xs font-semibold tracking-[.1em] text-[#6c7e70]">進度</p><div className="mt-2 space-y-1.5 text-sm">{progress.statusHistory?.length ? progress.statusHistory.slice().reverse().map((entry, index) => <p key={`${entry.at}-${index}`}><span className="font-medium text-[#355b48]">{statusMeta[entry.status].label}</span><span className="text-[#6c7e70]"> · {formatDisplayDate(entry.at)}</span></p>) : <p className="text-[#6c7e70]">目前為 {progress.statusLabel}</p>}</div></div></div>}</article>;
}
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <div className={className}><Label className="text-[#355b48]">{label}</Label><div className="mt-2">{children}</div></div>; }
function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[#355b48] text-[#fffdfa]" : "text-[#456153] hover:bg-[#edf5ed]"}`} onClick={onClick}>{icon}{children}</button>; }
function AccountBadge({ email, onSignOut }: { email: string; onSignOut?: () => void }) { return <div className="flex items-center gap-2 rounded-xl bg-[#edf5ed] px-3 py-2 text-xs text-[#355b48]"><ShieldCheck className="h-4 w-4" /><span className="max-w-36 truncate">{email}</span>{onSignOut && <button className="underline" onClick={onSignOut}>登出</button>}</div>; }

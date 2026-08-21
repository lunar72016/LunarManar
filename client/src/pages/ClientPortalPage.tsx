import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { ClientProgress, ClientSubmission, createPortalAccessCode, getClientProgressPath, isPortalAccessCode, normalizeReferenceUrls } from "@/lib/clientPortal";
import { describeFirebaseAuthError, firebaseAuth, firestoreDb } from "@/lib/firebase";
import { CheckCircle2, ClipboardList, KeyRound, LoaderCircle, LogIn, MoonStar, ShieldCheck, Sparkles } from "lucide-react";
import { addDoc, collection, doc, getDoc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

type PortalTab = "submit" | "progress";

const emptyForm = {
  clientName: "", contactEmail: "", contactChannel: "", contactHandle: "", characterSettingNote: "", poseNote: "", costumeDesignNote: "", accessoryNote: "", requirements: "", referenceUrls: "", deliveryNote: "",
};

function readableFirebaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("auth/")) return describeFirebaseAuthError(error);
  if (message.includes("auth/operation-not-allowed")) return "此登入方式尚未啟用。請通知繪師於 Firebase Authentication 開啟 Google 或 Anonymous Provider。";
  if (message.includes("permission-denied")) return "資料庫尚未套用委託人入口規則，請通知繪師發布最新版 firestore.rules。";
  return "目前無法完成操作，請確認網路後再試。";
}

export default function ClientPortalPage({ initialTab }: { initialTab?: PortalTab }) {
  const { user, loading, signInWithGoogle, signInWithAnonymousAccount, signOut } = useFirebaseAuth();
  const routeCode = useMemo(() => {
    const route = window.location.hash.replace(/^#/, "") || window.location.pathname;
    const match = route.match(/^\/client\/progress\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]).toUpperCase() : "";
  }, []);
  const [tab, setTab] = useState<PortalTab>(routeCode ? "progress" : initialTab ?? "submit");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [resultCode, setResultCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState(routeCode);
  const [codeProgress, setCodeProgress] = useState<ClientProgress | null>(null);
  const [searching, setSearching] = useState(false);
  const [myProgress, setMyProgress] = useState<ClientProgress[]>([]);
  const [mySubmissions, setMySubmissions] = useState<ClientSubmission[]>([]);

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
    const unsubscribeSubmissions = onSnapshot(submissionQuery, (snapshot) => setMySubmissions(snapshot.docs.map((item) => item.data() as ClientSubmission).sort((a, b) => b.createdAt - a.createdAt)), () => setMySubmissions([]));
    return () => { unsubscribeProgress(); unsubscribeSubmissions(); };
  }, [user?.uid]);

  const update = (key: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const useGoogle = async () => {
    setError(null);
    try { await signInWithGoogle(); } catch (nextError) { setError(readableFirebaseError(nextError)); }
  };

  const submit = async () => {
    if (!form.clientName.trim() || !form.contactEmail.trim() || !form.requirements.trim()) {
      setError("請填寫姓名、電子郵件與委託需求後再送出。");
      return;
    }
    if (!firestoreDb) { setError("Firebase 尚未設定完成。"); return; }
    setSubmitting(true);
    setError(null);
    try {
      if (!firebaseAuth?.currentUser) await signInWithAnonymousAccount();
      const currentUser = firebaseAuth?.currentUser;
      if (!currentUser) throw new Error("auth/session-missing");
      const accessCode = createPortalAccessCode();
      const now = Date.now();
      const reference = await addDoc(collection(firestoreDb, "clientSubmissions"), {
        id: "",
        ownerUid: import.meta.env.VITE_FIREBASE_ALLOWED_UID ?? "",
        clientUid: currentUser.uid,
        accessCode,
        accessMode: currentUser.isAnonymous ? "code" : "google",
        ...form,
        referenceUrls: normalizeReferenceUrls(form.referenceUrls),
        state: "submitted",
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(reference, { id: reference.id }, { merge: true });
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
    try {
      const result = await getDoc(doc(firestoreDb, "clientProgress", normalized));
      const data = result.exists() ? result.data() as ClientProgress : null;
      if (!data || data.revokedAt) {
        setCodeProgress(null);
        setError("找不到可用的進度連結；請確認驗證碼或向繪師索取新的連結。");
        return;
      }
      setCodeProgress(data);
      window.history.replaceState({}, "", getClientProgressPath(normalized));
    } catch (nextError) {
      setError(readableFirebaseError(nextError));
    } finally {
      setSearching(false);
    }
  };

  const signedInWithGoogle = Boolean(user && !user.isAnonymous);
  return (
    <main className="min-h-screen bg-[#f6f5ef] px-4 py-6 text-[#283b31] sm:px-8 sm:py-10">
      <section className="mx-auto max-w-3xl">
        <header className="rounded-[2rem] bg-[#283b31] px-6 py-8 text-[#fffdfa] shadow-[0_18px_48px_rgba(40,59,49,.16)] sm:px-10">
          <div className="flex items-center gap-3 text-[#dbe8dc]"><MoonStar className="h-6 w-6" /><span className="text-xs font-semibold tracking-[.18em]">繪月錄 · 委託人入口</span></div>
          <h1 className="mt-5 font-display text-3xl sm:text-4xl">把委託內容，交給月光妥善收錄。</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#d8e4da]">您可先填寫需求，並隨時以 Google 帳號或專屬驗證碼查看自己的案件進度。</p>
        </header>
        <div className="mt-5 flex rounded-2xl border border-[#cfd9cf] bg-[#fffdfa] p-1.5">
          <TabButton active={tab === "submit"} onClick={() => setTab("submit")} icon={<ClipboardList />}>填寫委託</TabButton>
          <TabButton active={tab === "progress"} onClick={() => setTab("progress")} icon={<Sparkles />}>查看進度</TabButton>
        </div>
        {error && <p className="mt-4 rounded-xl border border-[#e6c6b8] bg-[#fff2eb] px-4 py-3 text-sm text-[#a9573c]">{error}</p>}
        {tab === "submit" ? (
          <SubmissionForm
            form={form}
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

function SubmissionForm({ form, update, onSubmit, submitting, loading, signedInWithGoogle, accountEmail, onGoogle, onSignOut, resultCode }: {
  form: typeof emptyForm; update: (key: keyof typeof emptyForm, value: string) => void; onSubmit: () => Promise<void>; submitting: boolean; loading: boolean; signedInWithGoogle: boolean; accountEmail: string; onGoogle: () => Promise<void>; onSignOut: () => void; resultCode: string | null;
}) {
  return <section className="mt-5 rounded-[2rem] border border-[#cfd9cf] bg-[#fffdfa] p-5 shadow-[0_14px_32px_rgba(40,59,49,.06)] sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-2xl">寫下委託內容</h2><p className="mt-1 text-sm leading-6 text-[#456153]">送出後，繪師會依內容與您確認。設定稿請貼雲端網址，請確認連結已開放給繪師查看。</p></div>{signedInWithGoogle ? <AccountBadge email={accountEmail} onSignOut={onSignOut} /> : <Button variant="outline" className="border-[#b9cdbd] text-[#355b48]" onClick={() => void onGoogle()}><LogIn className="mr-1.5 h-4 w-4" />以 Google 帳號填寫</Button>}</div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="姓名或稱呼 *"><Input value={form.clientName} onChange={(event) => update("clientName", event.target.value)} /></Field><Field label="電子郵件 *"><Input type="email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} /></Field><Field label="聯絡管道"><Input placeholder="例如：Facebook、LINE、Discord" value={form.contactChannel} onChange={(event) => update("contactChannel", event.target.value)} /></Field><Field label="帳號或聯絡方式"><Input value={form.contactHandle} onChange={(event) => update("contactHandle", event.target.value)} /></Field></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="人物設定"><Textarea value={form.characterSettingNote} onChange={(event) => update("characterSettingNote", event.target.value)} /></Field><Field label="動作／構圖"><Textarea value={form.poseNote} onChange={(event) => update("poseNote", event.target.value)} /></Field><Field label="服裝設計"><Textarea value={form.costumeDesignNote} onChange={(event) => update("costumeDesignNote", event.target.value)} /></Field><Field label="配飾／背景"><Textarea value={form.accessoryNote} onChange={(event) => update("accessoryNote", event.target.value)} /></Field></div>
    <Field label="委託需求 *" className="mt-5"><Textarea className="min-h-28" value={form.requirements} onChange={(event) => update("requirements", event.target.value)} placeholder="請描述想委託的內容、人物數量、繪製範圍與其他需求。" /></Field>
    <Field label="設定稿／參考資料雲端網址" className="mt-5"><Textarea value={form.referenceUrls} onChange={(event) => update("referenceUrls", event.target.value)} placeholder="可貼上 Google Drive、Dropbox、雲端相簿等網址；多個網址可分行填寫。" /></Field>
    <Field label="期限或其他補充" className="mt-5"><Textarea value={form.deliveryNote} onChange={(event) => update("deliveryNote", event.target.value)} placeholder="例如：希望於活動前完成；若可調整請一併告知。" /></Field>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#d8ded5] pt-5"><p className="max-w-md text-xs leading-5 text-[#6c7e70]"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />未使用 Google 帳號時，系統會建立受限工作階段並提供專屬驗證碼；請妥善保存。</p><Button disabled={submitting || loading} className="bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" onClick={() => void onSubmit()}>{submitting && <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />}{submitting ? "送出中…" : "送出委託"}</Button></div>
    {resultCode && <div className="mt-5 rounded-2xl border border-[#b9cdbd] bg-[#edf5ed] p-4"><p className="flex items-center gap-2 font-semibold text-[#283b31]"><CheckCircle2 className="h-5 w-5 text-[#3e6c50]" />委託已送出</p><p className="mt-2 text-sm text-[#456153]">請保存此專屬驗證碼。繪師建立案件後，可用它查看進度：</p><code className="mt-3 block break-all rounded-xl bg-[#fffdfa] px-3 py-2 text-sm font-semibold text-[#283b31]">{resultCode}</code></div>}
  </section>;
}

function ProgressPanel({ signedInWithGoogle, accountEmail, code, setCode, codeProgress, myProgress, mySubmissions, searching, onLookup, onGoogle, onSignOut }: { signedInWithGoogle: boolean; accountEmail: string; code: string; setCode: (value: string) => void; codeProgress: ClientProgress | null; myProgress: ClientProgress[]; mySubmissions: ClientSubmission[]; searching: boolean; onLookup: () => Promise<void>; onGoogle: () => Promise<void>; onSignOut: () => void }) {
  const progress = codeProgress ? [codeProgress] : myProgress;
  return <section className="mt-5 rounded-[2rem] border border-[#cfd9cf] bg-[#fffdfa] p-5 shadow-[0_14px_32px_rgba(40,59,49,.06)] sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-2xl">我的案件進度</h2><p className="mt-1 text-sm leading-6 text-[#456153]">此頁只顯示繪師已公開給您的案件進度，不包含報價、付款與內部備註。</p></div>{signedInWithGoogle ? <AccountBadge email={accountEmail} onSignOut={onSignOut} /> : <Button variant="outline" className="border-[#b9cdbd] text-[#355b48]" onClick={() => void onGoogle()}><LogIn className="mr-1.5 h-4 w-4" />使用 Google 帳號</Button>}</div><div className="mt-6 rounded-2xl bg-[#edf5ed] p-4"><Label className="text-[#355b48]">沒有 Google 帳號？輸入專屬驗證碼</Label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="HY-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx" /><Button variant="outline" className="border-[#b9cdbd] text-[#355b48]" disabled={searching} onClick={() => void onLookup()}><KeyRound className="mr-1.5 h-4 w-4" />{searching ? "查詢中…" : "查看"}</Button></div></div><div className="mt-6 space-y-3">{progress.map((item) => <ProgressCard key={item.id} progress={item} />)}{mySubmissions.length > 0 && <div className="rounded-2xl border border-dashed border-[#cfd9cf] p-4"><p className="font-medium">已送出的委託</p><div className="mt-2 space-y-1 text-sm text-[#456153]">{mySubmissions.map((item) => <p key={item.id}>· {item.state === "submitted" ? "等待繪師確認" : item.state === "accepted" ? "已轉為案件" : "未受理"} · {new Date(item.createdAt).toLocaleDateString("zh-TW")}</p>)}</div></div>}{progress.length === 0 && <div className="rounded-2xl border border-dashed border-[#cfd9cf] p-8 text-center text-sm leading-6 text-[#6c7e70]">尚未找到已公開的案件。若您剛送出委託，請等候繪師確認；也可使用繪師提供的專屬驗證碼查看。</div>}</div></section>;
}

function ProgressCard({ progress }: { progress: ClientProgress }) { return <article className="rounded-2xl border border-[#cfd9cf] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-display text-lg font-semibold">{progress.clientName} 的畫約</p><p className="mt-1 text-xs text-[#6c7e70]">{progress.orderCode}</p></div><span className="rounded-full bg-[#edf5ed] px-2.5 py-1 text-xs font-semibold text-[#355b48]">{progress.statusLabel}</span></div><p className="mt-4 text-sm leading-6 text-[#456153]">{progress.nextStep}</p><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-[#6c7e70]">排程週次：</span>{progress.scheduleWeekLabel}</p>{progress.dueDateLabel && <p><span className="text-[#6c7e70]">交稿期限：</span>{progress.dueDateLabel}</p>}</div></article>; }
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <div className={className}><Label className="text-[#355b48]">{label}</Label><div className="mt-2">{children}</div></div>; }
function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[#355b48] text-[#fffdfa]" : "text-[#456153] hover:bg-[#edf5ed]"}`} onClick={onClick}>{icon}{children}</button>; }
function AccountBadge({ email, onSignOut }: { email: string; onSignOut?: () => void }) { return <div className="flex items-center gap-2 rounded-xl bg-[#edf5ed] px-3 py-2 text-xs text-[#355b48]"><ShieldCheck className="h-4 w-4" /><span className="max-w-36 truncate">{email}</span>{onSignOut && <button className="underline" onClick={onSignOut}>登出</button>}</div>; }

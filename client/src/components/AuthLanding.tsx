import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SafariGoogleSignInHint } from "@/components/SafariGoogleSignInHint";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { getClientProgressPath, isPortalAccessCode } from "@/lib/clientPortal";
import { describeFirebaseAuthError } from "@/lib/firebase";
import { BadgePlus, KeyRound, LockKeyhole, LogIn } from "lucide-react";
import { useState } from "react";

const titleIconSrc = `${import.meta.env.BASE_URL}hui-yue-title.svg`;

export function AuthLanding() {
  const { signInWithGoogle, googleSignInIssue, clearGoogleSignInIssue } = useFirebaseAuth();
  const [portalCode, setPortalCode] = useState("");
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try { await signInWithGoogle(); }
    catch (nextError) { setError(describeFirebaseAuthError(nextError)); }
    finally { setGoogleLoading(false); }
  };
  const openClientPortal = () => { clearGoogleSignInIssue(); setError(""); window.location.hash = "/client"; };
  const lookupProgress = () => {
    const normalized = portalCode.trim().toUpperCase();
    if (!isPortalAccessCode(normalized)) { setError("請輸入完整的對契符節。"); return; }
    clearGoogleSignInIssue();
    setError("");
    window.location.hash = getClientProgressPath(normalized).replace(/^\/#/, "");
  };

  return <div className="min-h-screen bg-[#fffdfa] p-5"><div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-[#cfd9cf] bg-[#fffdfa] shadow-[0_24px_70px_rgba(40,59,49,.13)] lg:grid-cols-[1.1fr_.9fr]"><div className="relative hidden overflow-hidden bg-[#283b31] p-12 text-[#fffdfa] lg:block"><div className="absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_18%_21%,#bc694c_0,transparent_28%),radial-gradient(circle_at_72%_78%,#6c9575_0,transparent_27%)]" /><div className="relative flex h-full flex-col justify-between"><div><div className="flex items-center gap-3"><img src={titleIconSrc} className="h-9 w-9" alt="繪月錄圖示" /><p className="text-xs tracking-[0.25em] text-[#dce9dc]">繪月錄 · HUI YUE LEDGER</p></div><h1 className="mt-5 font-display text-5xl leading-[1.12]">讓每一筆<br />畫約都安放於<br />恰好的章法。</h1></div><p className="max-w-sm text-sm leading-7 text-[#fffdfa]/85">以 Google 帳號登入，系統會自動辨識繪師或寄墨主身分，帶您前往對應空間。</p></div></div><div className="flex items-center justify-center p-7 sm:p-12"><div className="w-full max-w-sm space-y-5"><div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dce9dc] text-[#355b48]"><LockKeyhole className="h-5 w-5" /></div><p className="mt-6 font-display text-3xl font-semibold text-[#283b31]">重臨畫案</p><p className="mt-2 text-sm leading-6 text-[#456153]">以 Google 帳號登入後，系統會自動帶往工作台、懸榜昭繪或寄墨主的畫約遞臻。</p></div><Button className="w-full border-[#b9cdbd] text-[#355b48] hover:bg-[#edf5ed]" variant="outline" disabled={googleLoading} onClick={() => void googleLogin()}><LogIn className="mr-1.5 h-4 w-4" />{googleLoading ? "正前往 Google…" : "使用 Google 帳號登入"}</Button><div className="border-t border-[#d8ded5] pt-4"><Button type="button" variant="outline" className="w-full border-[#b9cdbd] bg-[#edf5ed] text-[#355b48] hover:bg-[#dce9dc]" onClick={openClientPortal}><BadgePlus className="mr-1.5 h-4 w-4" />未登入？直接填寫委託</Button><div className="mt-4 rounded-xl bg-[#edf5ed] p-3"><p className="text-xs font-medium text-[#355b48]">已有對契符節？</p><div className="mt-2 flex gap-2"><Input className="h-9 min-w-0 text-xs" value={portalCode} onChange={(event) => setPortalCode(event.target.value)} placeholder="HY-…" /><Button type="button" size="sm" variant="outline" className="shrink-0 border-[#b9cdbd] text-[#355b48]" onClick={lookupProgress}><KeyRound className="mr-1 h-3.5 w-3.5" />檢視遞臻</Button></div></div></div>{(error || googleSignInIssue) && <><p className="rounded-xl bg-[#fff0e9] px-3 py-2 text-xs leading-5 text-[#8e4932]">{error || googleSignInIssue}</p><SafariGoogleSignInHint visible={Boolean(googleSignInIssue)} /></>}</div></div></div></div>;
}

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientAccessMode, ClientProgress, createPortalAccessCode, getClientProgressPath } from "@/lib/clientPortal";
import { Commission } from "@/lib/commission";
import { CheckCircle2, Copy, KeyRound, Link2, LoaderCircle, Mail, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function ClientAccessDialog({ commission, open, onOpenChange, onPublish, onRevoke }: { commission: Commission | null; open: boolean; onOpenChange: (open: boolean) => void; onPublish: (input: { accessMode: ClientAccessMode; clientEmail?: string; accessCode?: string }) => Promise<ClientProgress>; onRevoke: () => Promise<void> }) {
  const [accessMode, setAccessMode] = useState<ClientAccessMode>("code");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<ClientProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressUrl = useMemo(() => result?.accessCode ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${getClientProgressPath(result.accessCode)}` : "", [result?.accessCode]);

  useEffect(() => { if (open) { setEmail(""); setResult(null); setError(null); setAccessMode("code"); } }, [open]);
  if (!commission) return null;
  const publish = async () => {
    setBusy(true); setError(null);
    try { setResult(await onPublish({ accessMode, clientEmail: email })); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "無法建立寄墨通衢。"); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true); setError(null);
    try { await onRevoke(); setResult(null); setError("已撤銷此案件所有公開進度連結。") }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "無法撤銷連結。"); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="hui-dialog max-w-lg border-[#cfd9cf] bg-[#fffdfa]"><DialogHeader><DialogTitle className="font-display text-2xl text-[#283b31]">寄墨通衢</DialogTitle><DialogDescription>僅會公開畫約進度、排程週次、交稿期限、公開款項與下一步說明，不會公開設定稿或內部備註。</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-2xl bg-[#edf5ed] p-4"><p className="font-medium text-[#283b31]">{commission.clientName} · {commission.orderCode}</p><p className="mt-1 text-sm text-[#456153]">選擇寄墨主使用的查看方式後建立通衢。</p></div><div className="grid grid-cols-2 gap-2"><button onClick={() => setAccessMode("code")} className={`rounded-xl border p-3 text-left ${accessMode === "code" ? "border-[#355b48] bg-[#edf5ed]" : "border-[#cfd9cf]"}`}><KeyRound className="h-4 w-4 text-[#355b48]" /><p className="mt-2 text-sm font-semibold">對契符節</p><p className="mt-1 text-xs leading-5 text-[#6c7e70]">系統自動產生，不需 Google 帳號</p></button><button onClick={() => setAccessMode("google")} className={`rounded-xl border p-3 text-left ${accessMode === "google" ? "border-[#355b48] bg-[#edf5ed]" : "border-[#cfd9cf]"}`}><Mail className="h-4 w-4 text-[#355b48]" /><p className="mt-2 text-sm font-semibold">Google 帳號</p><p className="mt-1 text-xs leading-5 text-[#6c7e70]">帳號登入後查看</p></button></div>{accessMode === "code" ? <p className="rounded-xl bg-[#f6f7f2] px-3 py-2 text-xs leading-5 text-[#456153]">系統會取得現有有效對契符節，若尚未建立或已失效，會自動補建並完成同步確認。</p> : <div><Label>寄墨主的 Google 電子郵件</Label><Input className="mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="需先在公開入口以此帳號登入一次" /></div>}{error && <p className={`rounded-xl px-3 py-2 text-sm ${error.startsWith("已撤銷") ? "bg-[#edf5ed] text-[#355b48]" : "bg-[#fff0e9] text-[#a9573c]"}`}>{error}</p>}{result && <div className="rounded-2xl border border-[#b9cdbd] bg-[#edf5ed] p-4"><p className="flex items-center gap-2 font-medium text-[#283b31]"><CheckCircle2 className="h-5 w-5 text-[#3e6c50]" />寄墨通衢已建立並完成同步確認</p>{result.accessCode ? <><code className="mt-3 block break-all rounded-xl bg-[#fffdfa] p-2 text-xs">{result.accessCode}</code><a className="mt-3 block break-all text-xs font-medium text-[#355b48] underline" href={progressUrl} target="_blank" rel="noreferrer noopener">{progressUrl}</a><Button size="sm" variant="outline" className="mt-3 border-[#b9cdbd] text-[#355b48]" onClick={() => void navigator.clipboard?.writeText(progressUrl)}><Copy className="mr-1.5 h-3.5 w-3.5" />複製連結</Button></> : <p className="mt-2 text-sm text-[#456153]">此畫約已綁定該 Google 帳號；寄墨主登入公開入口後即可檢視遞臻。</p>}</div>}<div className="flex flex-wrap justify-between gap-3 border-t border-[#d8ded5] pt-4"><Button variant="outline" className="border-[#bc694c] text-[#a9573c] hover:bg-[#fff0e9]" disabled={busy} onClick={() => void revoke()}><ShieldOff className="mr-1.5 h-4 w-4" />撤銷寄墨通衢</Button><Button className="bg-[#355b48] text-[#fffdfa] hover:bg-[#294a3a]" disabled={busy} onClick={() => void publish()}>{busy && <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />}<Link2 className="mr-1.5 h-4 w-4" />{accessMode === "code" ? "取得對契符節" : "建立／更新通衢"}</Button></div></div></DialogContent></Dialog>;
}

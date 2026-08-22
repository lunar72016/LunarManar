import { ShieldCheck } from "lucide-react";
import { isSafariBrowser } from "@/lib/firebase";

export function SafariGoogleSignInHint({ visible }: { visible: boolean }) {
  if (!visible || !isSafariBrowser()) return null;
  return <div className="rounded-xl border border-[#e5d2a9] bg-[#fffaed] px-3 py-3 text-xs leading-5 text-[#755f31]"><p className="font-semibold"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Safari 不會跳出 Cookie 授權視窗</p><p className="mt-1">請暫時關閉「防止跨網站追蹤」後重新登入：Mac 為 <strong>Safari → 設定 → 隱私權</strong>；iPhone／iPad 為 <strong>設定 → Safari</strong>。完成後可重新開啟此保護。</p><p className="mt-1">若只需查看進度，請使用繪師提供的<strong>專屬驗證碼</strong>；此流程不需要 Google 登入。</p></div>;
}

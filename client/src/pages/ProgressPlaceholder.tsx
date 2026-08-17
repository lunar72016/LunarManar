import { Button } from "@/components/ui/button";
import { MoonStar, ShieldCheck } from "lucide-react";

export default function ProgressPlaceholder() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9f5ef] p-5">
      <section className="max-w-md rounded-[1.75rem] border border-[#e6dbd0] bg-[#fffdfa] p-8 text-center shadow-[0_18px_50px_rgba(82,59,38,.08)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f0e7] text-[#3e6c50]">
          <MoonStar className="h-6 w-6" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-[#493d35]">委託進度查看</h1>
        <p className="mt-3 text-sm leading-6 text-[#856f61]">此頁面已預留給未來的限時進度連結。為保護委託內容、設定與付款資訊，公開查看功能會在伺服器端驗證權杖後才啟用。</p>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-[#5d856a]"><ShieldCheck className="h-4 w-4" />未公開任何委託資料</div>
        <Button variant="outline" className="mt-6 border-[#dfd3c7]" onClick={() => window.location.assign("/")}>返回工作台</Button>
      </section>
    </main>
  );
}

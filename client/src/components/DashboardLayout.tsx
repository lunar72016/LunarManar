import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { Archive, Cloud, CloudOff, Inbox, LayoutDashboard, ListTree, LogOut, PanelLeft, RefreshCw, Settings2, Trash2 } from "lucide-react";

export type WorkspaceView = "dashboard" | "board" | "archive" | "intake" | "trash" | "settings";

const menuItems: { id: WorkspaceView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "千繪總覽", icon: LayoutDashboard },
  { id: "board", label: "排畫連雲", icon: ListTree },
  { id: "archive", label: "封畫入卷", icon: Archive },
  { id: "intake", label: "墨諾函箋", icon: Inbox },
  { id: "trash", label: "落紙餘灰", icon: Trash2 },
  { id: "settings", label: "丹青設案", icon: Settings2 },
];

const titleIconSrc = `${import.meta.env.BASE_URL}hui-yue-title.svg`;

export default function DashboardLayout({ children, activeView, onViewChange, syncState, studioName, pendingIntakeCount = 0 }: { children: React.ReactNode; activeView: WorkspaceView; onViewChange: (view: WorkspaceView) => void; syncState: "loading" | "connecting" | "synced" | "offline" | "pending" | "error"; studioName: string; pendingIntakeCount?: number }) {
  return <SidebarProvider><WorkspaceSidebar activeView={activeView} onViewChange={onViewChange} studioName={studioName} pendingIntakeCount={pendingIntakeCount} /><SidebarInset><WorkspaceHeader activeView={activeView} syncState={syncState} />{children}</SidebarInset></SidebarProvider>;
}

function WorkspaceSidebar({ activeView, onViewChange, studioName, pendingIntakeCount }: { activeView: WorkspaceView; onViewChange: (view: WorkspaceView) => void; studioName: string; pendingIntakeCount: number }) {
  const { user, signOut } = useFirebaseAuth();
  const { toggleSidebar, state, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const collapsed = state === "collapsed";
  const selectView = (view: WorkspaceView) => {
    onViewChange(view);
    if (isMobile) setOpenMobile(false);
  };
  return (
    <Sidebar collapsible="icon" className="border-r border-[#cfd9cf] bg-[#f7f4ee] text-[#283b31]">
      <SidebarHeader className="h-24 px-3 py-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <button onClick={toggleSidebar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#dce9dc] text-[#355b48] transition hover:bg-[#c9d9cb]" aria-label="收合導覽"><PanelLeft className="h-4 w-4" /></button>
          {!collapsed && <div className="flex items-center gap-2"><img src={titleIconSrc} className="h-7 w-7" alt="繪月錄圖示" /><p className="font-display text-xl font-semibold tracking-tight text-[#283b31]">繪月錄</p></div>}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2"><p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-[#6c9575] group-data-[collapsible=icon]:hidden">丹青筆閣</p><SidebarMenu>{menuItems.map((item) => <SidebarMenuItem key={item.id}><SidebarMenuButton isActive={activeView === item.id} tooltip={item.id === "intake" && pendingIntakeCount ? `${item.label} · ${pendingIntakeCount} 封待啟` : item.label} onClick={() => selectView(item.id)} className="h-11 rounded-xl text-[#355b48] data-[active=true]:bg-[#dce9dc] data-[active=true]:font-medium data-[active=true]:text-[#283b31]"><item.icon className="h-4 w-4" /><span className="flex-1">{item.label}</span>{item.id === "intake" && pendingIntakeCount > 0 && <strong className="rounded-full bg-[#d4a359] px-2 py-0.5 text-[10px] font-semibold text-[#1f382c] group-data-[collapsible=icon]:hidden">{pendingIntakeCount}</strong>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent>
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2"><div className="rounded-2xl bg-[#edf2ed] p-2 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"><div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center"><img src={titleIconSrc} className="h-9 w-9 shrink-0 rounded-xl border border-[#b9cdbd] bg-[#fffdfa] p-1.5" alt="繪月錄圖示" /><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-semibold text-[#283b31]">{studioName || "繪月錄"}</p><p className="truncate text-[10px] text-[#456153]">{user?.email ?? "Firebase 帳號"}</p></div></div>{!collapsed && <Button variant="ghost" size="sm" onClick={() => void signOut()} className="mt-2 h-8 w-full justify-start text-xs text-[#a9573c] hover:bg-[#fff0e9] hover:text-[#8e4932]"><LogOut className="mr-1.5 h-3.5 w-3.5" />登出</Button>}</div></SidebarFooter>
    </Sidebar>
  );
}

function WorkspaceHeader({ activeView, syncState }: { activeView: WorkspaceView; syncState: "loading" | "connecting" | "synced" | "offline" | "pending" | "error" }) {
  const isMobile = useIsMobile();
  const item = menuItems.find((menuItem) => menuItem.id === activeView) ?? menuItems[0];
  const sync = syncState === "synced" ? { label: "已同步", icon: Cloud, tone: "text-[#355b48] bg-[#dce9dc]" } : syncState === "pending" ? { label: "同步中", icon: RefreshCw, tone: "text-[#456153] bg-[#edf2ed]" } : syncState === "offline" ? { label: "離線快取", icon: CloudOff, tone: "text-[#8e4932] bg-[#fff0e9]" } : syncState === "connecting" ? { label: "連線中，可先作業", icon: RefreshCw, tone: "text-[#456153] bg-[#edf2ed]" } : { label: "讀取資料", icon: RefreshCw, tone: "text-[#456153] bg-[#edf2ed]" };
  const SyncIcon = sync.icon;
  return <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-[#cfd9cf] bg-[#fffdfa]/92 px-4 backdrop-blur-xl sm:px-7"><div className="flex items-center gap-3">{isMobile && <SidebarTrigger className="rounded-xl border border-[#cfd9cf] bg-[#fffdfa]" />}<p className="font-display text-xl font-semibold text-[#283b31]">{item.label}</p></div><div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${sync.tone}`}><SyncIcon className={`h-3.5 w-3.5 ${syncState === "pending" || syncState === "loading" ? "animate-spin" : ""}`} />{sync.label}</div></header>;
}

import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { BookOpenCheck, Cloud, CloudOff, LayoutDashboard, ListTree, LogOut, PanelLeft, RefreshCw } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

export type WorkspaceView = "dashboard" | "board";

const menuItems: { id: WorkspaceView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "工作總覽", icon: LayoutDashboard },
  { id: "board", label: "排單看板", icon: ListTree },
];

export default function DashboardLayout({
  children,
  activeView,
  onViewChange,
  syncState,
}: {
  children: React.ReactNode;
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  syncState: "loading" | "synced" | "offline" | "pending" | "error";
}) {
  return <SidebarProvider><WorkspaceSidebar activeView={activeView} onViewChange={onViewChange} /><SidebarInset><WorkspaceHeader activeView={activeView} syncState={syncState} />{children}</SidebarInset></SidebarProvider>;
}

function WorkspaceSidebar({ activeView, onViewChange }: { activeView: WorkspaceView; onViewChange: (view: WorkspaceView) => void }) {
  const { user, signOut } = useFirebaseAuth();
  const { toggleSidebar, state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon" className="border-r border-[#e9e0d8] bg-[#f7f4ef] text-[#3c5144]">
      <SidebarHeader className="h-24 px-3 py-4">
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e9eee8] text-[#466a57] transition hover:bg-[#dbe6dc]" aria-label="收合導覽"><PanelLeft className="h-4 w-4" /></button>
          {!collapsed && <div><p className="font-display text-xl font-semibold tracking-tight text-[#294a3a]">Lunar Atelier</p><p className="text-[10px] tracking-[0.18em] text-[#9a8574]">COMMISSION DESK</p></div>}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-[#a39081] group-data-[collapsible=icon]:hidden">工作空間</p>
        <SidebarMenu>
          {menuItems.map((item) => <SidebarMenuItem key={item.id}><SidebarMenuButton isActive={activeView === item.id} tooltip={item.label} onClick={() => onViewChange(item.id)} className="h-11 rounded-xl text-[#5b6d61] data-[active=true]:bg-[#e2ebe2] data-[active=true]:font-medium data-[active=true]:text-[#294a3a]"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="rounded-2xl bg-[#eef1e9] p-2 group-data-[collapsible=icon]:bg-transparent">
          <div className="flex items-center gap-2.5"><Avatar className="h-9 w-9 border border-[#d8e1d8]"><AvatarFallback className="bg-[#dce8dd] text-xs font-semibold text-[#315741]">{user?.email?.slice(0, 1).toUpperCase() ?? "L"}</AvatarFallback></Avatar><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-semibold text-[#405748]">繪師工作室</p><p className="truncate text-[10px] text-[#819082]">{user?.email ?? "Firebase 帳號"}</p></div></div>
          {!collapsed && <Button variant="ghost" size="sm" onClick={() => void signOut()} className="mt-2 h-8 w-full justify-start text-xs text-[#92635c] hover:bg-[#f8e9e5] hover:text-[#82514a]"><LogOut className="mr-1.5 h-3.5 w-3.5" />登出</Button>}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function WorkspaceHeader({ activeView, syncState }: { activeView: WorkspaceView; syncState: "loading" | "synced" | "offline" | "pending" | "error" }) {
  const isMobile = useIsMobile();
  const item = menuItems.find((menuItem) => menuItem.id === activeView) ?? menuItems[0];
  const sync = syncState === "synced" ? { label: "已同步", icon: Cloud, tone: "text-[#4d8161] bg-[#edf5ef]" } : syncState === "pending" ? { label: "同步中", icon: RefreshCw, tone: "text-[#a26b33] bg-[#fff5e5]" } : syncState === "offline" ? { label: "離線快取", icon: CloudOff, tone: "text-[#876951] bg-[#f8eee5]" } : { label: "讀取資料", icon: RefreshCw, tone: "text-[#7e796f] bg-[#f2f0ec]" };
  const SyncIcon = sync.icon;
  return <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-[#eee6df] bg-[#fffdfa]/92 px-4 backdrop-blur-xl sm:px-7"><div className="flex items-center gap-3">{isMobile && <SidebarTrigger className="rounded-xl border border-[#e9e0d8] bg-white" />}<div><p className="font-display text-xl font-semibold text-[#2e4638]">{item.label}</p>{!isMobile && <p className="mt-0.5 text-[10px] tracking-[0.14em] text-[#a18875]">LUNAR COMMISSION MANAGER</p>}</div></div><div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${sync.tone}`}><SyncIcon className={`h-3.5 w-3.5 ${syncState === "pending" || syncState === "loading" ? "animate-spin" : ""}`} />{sync.label}</div></header>;
}

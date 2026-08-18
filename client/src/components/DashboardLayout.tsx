import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { Cloud, CloudOff, LayoutDashboard, ListTree, LogOut, PanelLeft, RefreshCw, Settings2 } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

export type WorkspaceView = "dashboard" | "board" | "settings";

const menuItems: { id: WorkspaceView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "千繪總覽", icon: LayoutDashboard },
  { id: "board", label: "排畫連雲", icon: ListTree },
  { id: "settings", label: "丹青設案", icon: Settings2 },
];

export default function DashboardLayout({
  children,
  activeView,
  onViewChange,
  syncState,
  studioName,
  avatarUrl,
}: {
  children: React.ReactNode;
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  syncState: "loading" | "connecting" | "synced" | "offline" | "pending" | "error";
  studioName: string;
  avatarUrl: string;
}) {
  return <SidebarProvider><WorkspaceSidebar activeView={activeView} onViewChange={onViewChange} studioName={studioName} avatarUrl={avatarUrl} /><SidebarInset><WorkspaceHeader activeView={activeView} syncState={syncState} />{children}</SidebarInset></SidebarProvider>;
}

function WorkspaceSidebar({ activeView, onViewChange, studioName, avatarUrl }: { activeView: WorkspaceView; onViewChange: (view: WorkspaceView) => void; studioName: string; avatarUrl: string }) {
  const { user, signOut } = useFirebaseAuth();
  const { toggleSidebar, state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon" className="border-r border-[#e9e0d8] bg-[#f7f4ef] text-[#3c5144]">
      <SidebarHeader className="h-24 px-3 py-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <button onClick={toggleSidebar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e9eee8] text-[#466a57] transition hover:bg-[#dbe6dc]" aria-label="收合導覽"><PanelLeft className="h-4 w-4" /></button>
          {!collapsed && <div><p className="font-display text-xl font-semibold tracking-tight text-[#294a3a]">繪月錄</p><p className="text-[10px] tracking-[0.18em] text-[#9a8574]">PAINTING LEDGER</p></div>}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-[#a39081] group-data-[collapsible=icon]:hidden">工作空間</p>
        <SidebarMenu>
          {menuItems.map((item) => <SidebarMenuItem key={item.id}><SidebarMenuButton isActive={activeView === item.id} tooltip={item.label} onClick={() => onViewChange(item.id)} className="h-11 rounded-xl text-[#5b6d61] data-[active=true]:bg-[#e2ebe2] data-[active=true]:font-medium data-[active=true]:text-[#294a3a]"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <div className="rounded-2xl bg-[#eef1e9] p-2 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center"><Avatar className="h-9 w-9 border border-[#d8e1d8]"><AvatarImage src={avatarUrl} alt={studioName} /><AvatarFallback className="bg-[#dce8dd] text-xs font-semibold text-[#315741]">{studioName.slice(0, 1).toUpperCase() || user?.email?.slice(0, 1).toUpperCase() || "L"}</AvatarFallback></Avatar><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-semibold text-[#405748]">{studioName || "繪師工作室"}</p><p className="truncate text-[10px] text-[#819082]">{user?.email ?? "Firebase 帳號"}</p></div></div>
          {!collapsed && <Button variant="ghost" size="sm" onClick={() => void signOut()} className="mt-2 h-8 w-full justify-start text-xs text-[#92635c] hover:bg-[#f8e9e5] hover:text-[#82514a]"><LogOut className="mr-1.5 h-3.5 w-3.5" />登出</Button>}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function WorkspaceHeader({ activeView, syncState }: { activeView: WorkspaceView; syncState: "loading" | "connecting" | "synced" | "offline" | "pending" | "error" }) {
  const isMobile = useIsMobile();
  const item = menuItems.find((menuItem) => menuItem.id === activeView) ?? menuItems[0];
  const sync = syncState === "synced" ? { label: "已同步", icon: Cloud, tone: "text-[#4d8161] bg-[#edf5ef]" } : syncState === "pending" ? { label: "同步中", icon: RefreshCw, tone: "text-[#a26b33] bg-[#fff5e5]" } : syncState === "offline" ? { label: "離線快取", icon: CloudOff, tone: "text-[#876951] bg-[#f8eee5]" } : syncState === "connecting" ? { label: "連線中，可先作業", icon: RefreshCw, tone: "text-[#766958] bg-[#f6f1e9]" } : { label: "讀取資料", icon: RefreshCw, tone: "text-[#7e796f] bg-[#f2f0ec]" };
  const SyncIcon = sync.icon;
  return <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-[#eee6df] bg-[#fffdfa]/92 px-4 backdrop-blur-xl sm:px-7"><div className="flex items-center gap-3">{isMobile && <SidebarTrigger className="rounded-xl border border-[#e9e0d8] bg-white" />}<div><p className="font-display text-xl font-semibold text-[#2e4638]">{item.label}</p>{!isMobile && <p className="mt-0.5 text-[10px] tracking-[0.14em] text-[#a18875]">HUI YUE LEDGER</p>}</div></div><div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${sync.tone}`}><SyncIcon className={`h-3.5 w-3.5 ${syncState === "pending" || syncState === "loading" ? "animate-spin" : ""}`} />{sync.label}</div></header>;
}

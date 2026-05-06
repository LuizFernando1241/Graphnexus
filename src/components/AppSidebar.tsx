import { Home, StickyNote, CheckSquare, FolderKanban, Network, Archive, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { ResizeHandle } from "@/components/ui/ResizeHandle";

const navItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Notas", url: "/notes", icon: StickyNote },
  { title: "Tarefas", url: "/tasks", icon: CheckSquare },
  { title: "Projetos", url: "/projects", icon: FolderKanban },
  { title: "Grafo", url: "/graph", icon: Network },
  { title: "Arquivos", url: "/archive", icon: Archive },
];

const SIDEBAR_MIN = 64;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 240;
const COLLAPSE_THRESHOLD = 140;
const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 220;

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [width, setWidth] = useLocalStorage<number>("ui:sidebar-width", SIDEBAR_DEFAULT);

  const collapsed = width < COLLAPSE_THRESHOLD;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate("/login", { replace: true });
    toast.success("Você saiu da conta.");
  };

  // Snap on release: if user lands in the gray zone, snap to nearest mode.
  const handleCommit = (value: number) => {
    if (value < COLLAPSED_WIDTH + 20) {
      setWidth(COLLAPSED_WIDTH);
    } else if (value < COLLAPSE_THRESHOLD + 40) {
      setWidth(value < COLLAPSE_THRESHOLD ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
    }
  };

  return (
    <div className="flex h-screen shrink-0">
      <aside
        className="flex h-full flex-col border-r border-border/50 bg-sidebar/80 backdrop-blur-lg shrink-0"
        style={{ width: `${width}px` }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-2 py-5 ${collapsed ? "px-3 justify-center" : "px-5"}`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
            <Network className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-heading text-lg font-bold text-foreground truncate">NexusGraph</span>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-3 pt-2 overflow-hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              title={collapsed ? item.title : undefined}
              aria-label={item.title}
              className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                collapsed ? "justify-center px-2" : "px-3"
              }`}
              activeClassName="bg-sidebar-accent text-foreground"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-border px-3 py-3">
          <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Sair"
              aria-label="Sair da conta"
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <ResizeHandle
        side="right"
        width={width}
        onChange={setWidth}
        onCommit={handleCommit}
        min={SIDEBAR_MIN}
        max={SIDEBAR_MAX}
        ariaLabel="Redimensionar barra lateral"
      />
    </div>
  );
}

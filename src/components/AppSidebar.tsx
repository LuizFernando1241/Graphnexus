import { Home, StickyNote, CheckSquare, FolderKanban, Network, Archive, Upload, LogOut, Crosshair, ShoppingCart, Settings as SettingsIcon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";

const navItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Notas", url: "/notes", icon: StickyNote },
  { title: "Tarefas", url: "/tasks", icon: CheckSquare },
  { title: "Projetos", url: "/projects", icon: FolderKanban },
  { title: "Grafo", url: "/graph", icon: Network },
  { title: "Arquivos", url: "/archive", icon: Archive },
  { title: "Importar", url: "/import", icon: Upload },
];

const SIDEBAR_MIN = 64;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 240;
const COLLAPSE_THRESHOLD = 140;

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [width, setWidth] = useLocalStorage<number>("ui:sidebar-width", SIDEBAR_DEFAULT);
  const collapsed = width < COLLAPSE_THRESHOLD;
  const effectiveWidth = collapsed ? 64 : width;
  const { produtos: radarProdutos } = useRadarProdutos();
  const produtosEmDecisao = radarProdutos.filter((p) => p.stage === "decisao").length;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate("/login", { replace: true });
    toast.success("Você saiu da conta.");
  };

  return (
    <div className="flex h-screen shrink-0">
      <aside
        className="flex h-full flex-col border-r border-border/50 bg-sidebar/80 backdrop-blur-lg shrink-0"
        style={{ width: `${effectiveWidth}px` }}
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
        <nav aria-label="Navegação principal" className={`flex flex-1 flex-col gap-1 pt-2 overflow-hidden ${collapsed ? "px-2" : "px-3"}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              title={collapsed ? item.title : undefined}
              className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "px-2 justify-center" : "px-3"}`}
              activeClassName="bg-sidebar-accent text-foreground"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </NavLink>
          ))}

          {/* Radar section */}
          {!collapsed && (
            <div className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Radar
            </div>
          )}
          {collapsed && <div className="mt-4 mx-2 border-t border-border/50" />}

          <NavLink
            to="/radar"
            title={collapsed ? "Pipeline" : undefined}
            className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "px-2 justify-center" : "px-3"}`}
            activeClassName="bg-sidebar-accent text-foreground"
          >
            <Crosshair className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="truncate flex-1">Pipeline</span>
                {produtosEmDecisao > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                    {produtosEmDecisao}
                  </span>
                )}
              </>
            )}
          </NavLink>

          <NavLink
            to="/radar/aprovados"
            title={collapsed ? "Aprovados" : undefined}
            className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "px-2 justify-center" : "px-3"}`}
            activeClassName="bg-sidebar-accent text-foreground"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Aprovados</span>}
          </NavLink>
        </nav>

        {/* Settings */}
        <div className={`border-t border-border py-2 ${collapsed ? "px-2" : "px-3"}`}>
          <NavLink
            to="/settings"
            title={collapsed ? "Configurações" : undefined}
            className={`flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "px-2 justify-center" : "px-3"}`}
            activeClassName="bg-sidebar-accent text-foreground"
          >
            <SettingsIcon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Configurações</span>}
          </NavLink>
        </div>

        {/* User footer */}
        <div className={`border-t border-border py-3 ${collapsed ? "px-2" : "px-3"}`}>
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
        width={effectiveWidth}
        onChange={(w) => setWidth(w < COLLAPSE_THRESHOLD ? 64 : w)}
        min={SIDEBAR_MIN}
        max={SIDEBAR_MAX}
        ariaLabel="Redimensionar barra lateral"
      />
    </div>
  );
}

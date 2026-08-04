import {
  Home,
  StickyNote,
  CheckSquare,
  FolderKanban,
  Network,
  Archive,
  LogOut,
  Sparkles,
  Crosshair,
  ShoppingCart,
  Settings as SettingsIcon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import { useRadarSinais } from "@/hooks/radar/useRadarSinais";
import { usePendingSuggestionCount } from "@/hooks/useSuggestionCount";

const navItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Notas", url: "/notes", icon: StickyNote },
  { title: "Tarefas", url: "/tasks", icon: CheckSquare },
  { title: "Projetos", url: "/projects", icon: FolderKanban },
  { title: "Grafo", url: "/graph", icon: Network },
  { title: "Arquivos", url: "/archive", icon: Archive },
];

const linkClass =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

export function MobileSidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { produtos: radarProdutos } = useRadarProdutos();
  const { urgentes } = useRadarSinais();
  const { data: suggestionCount = 0 } = usePendingSuggestionCount();

  const produtosEmDecisao = radarProdutos.filter((p) => p.stage === "decisao").length;
  const badgeCount = urgentes.length + produtosEmDecisao;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate("/login", { replace: true });
    toast.success("Você saiu da conta.");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Network className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-heading text-lg font-bold text-foreground">NexusGraph</span>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Navegação principal"
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-2 pb-4"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            onClick={onNavigate}
            className={linkClass}
            activeClassName="bg-sidebar-accent text-foreground"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.title}</span>
          </NavLink>
        ))}

        <NavLink
          to="/suggestions"
          onClick={onNavigate}
          className={linkClass}
          activeClassName="bg-sidebar-accent text-foreground"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">Sugestões IA</span>
          {suggestionCount > 0 && (
            <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {suggestionCount}
            </span>
          )}
        </NavLink>

        <div className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Radar
        </div>

        <NavLink
          to="/radar"
          end
          onClick={onNavigate}
          className={linkClass}
          activeClassName="bg-sidebar-accent text-foreground"
        >
          <Crosshair className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">Pipeline</span>
          {badgeCount > 0 && (
            <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
              {badgeCount}
            </span>
          )}
        </NavLink>

        <NavLink
          to="/radar/aprovados"
          onClick={onNavigate}
          className={linkClass}
          activeClassName="bg-sidebar-accent text-foreground"
        >
          <ShoppingCart className="h-4 w-4 shrink-0" />
          <span className="truncate">Comprados</span>
        </NavLink>

        <div className="mt-4 border-t border-border pt-2">
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className={linkClass}
            activeClassName="bg-sidebar-accent text-foreground"
          >
            <SettingsIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">Configurações</span>
          </NavLink>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
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
    </div>
  );
}

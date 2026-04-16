import { Home, StickyNote, CheckSquare, FolderKanban, Network, Archive, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const navItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Notas", url: "/notes", icon: StickyNote },
  { title: "Tarefas", url: "/tasks", icon: CheckSquare },
  { title: "Projetos", url: "/projects", icon: FolderKanban },
  { title: "Grafo", url: "/graph", icon: Network },
  { title: "Arquivos", url: "/archive", icon: Archive },
];

export function MobileSidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
      <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-3 pt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeClassName="bg-sidebar-accent text-foreground"
          >
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </NavLink>
        ))}
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

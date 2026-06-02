import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Network, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center text-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
          <Network className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-6xl font-heading font-bold text-foreground tracking-tight">404</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Página não encontrada
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            O endereço que você tentou acessar não existe ou foi movido.
          </p>
        </div>
        <Button asChild className="min-h-[44px] gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Link>
        </Button>
      </div>
    </main>
  );
};

export default NotFound;

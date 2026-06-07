import { ShoppingCart, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition } from "@/components/PageTransition";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";

export default function AprovadosPage() {
  const { produtos, isLoading } = useRadarProdutos();

  const aprovados = produtos.filter((p) => p.stage === "aprovado");
  const aComprar = aprovados.filter((p) => p.statusCompra === "a_comprar").length;
  const comprados = aprovados.filter((p) => p.statusCompra === "comprado").length;

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Produtos Aprovados</h1>
            </div>
            {!isLoading && aprovados.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {aComprar > 0 && (
                  <Badge variant="secondary">A comprar: {aComprar}</Badge>
                )}
                {comprados > 0 && (
                  <Badge variant="outline">Comprado: {comprados}</Badge>
                )}
              </div>
            )}
          </div>

          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Conteúdo — substituído na Parte 5 */}
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : aprovados.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
              <p className="text-base font-medium">Nenhum produto aprovado ainda</p>
              <p className="text-sm text-muted-foreground">
                Produtos marcados como "Vou Comprar" no pipeline aparecem aqui
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Tabela será construída na Parte 5</p>
              <p className="text-xs text-muted-foreground">
                {aprovados.length} produto(s) aprovado(s) no banco
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}

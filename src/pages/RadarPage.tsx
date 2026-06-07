import { Crosshair, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition } from "@/components/PageTransition";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";

export default function RadarPage() {
  const { produtos, isLoading } = useRadarProdutos();

  const contadores = {
    prospeccao: produtos.filter((p) => p.stage === "prospeccao").length,
    aguardando_custo: produtos.filter((p) => p.stage === "aguardando_custo").length,
    decisao: produtos.filter((p) => p.stage === "decisao").length,
    arquivado: produtos.filter((p) => p.stage === "arquivado").length,
  };

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Radar de Produtos</h1>
              {contadores.decisao > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {contadores.decisao} aguardando decisão
                </Badge>
              )}
            </div>
            {!isLoading && (
              <p className="text-sm text-muted-foreground">
                Prospecção ({contadores.prospeccao}) · Aguardando ({contadores.aguardando_custo}) · Decisão ({contadores.decisao})
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        </div>

        {/* Conteúdo — substituído na Parte 3 */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex flex-col gap-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Crosshair className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Kanban será construído na Parte 3</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}

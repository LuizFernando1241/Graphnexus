import { useState } from "react";
import { ShoppingCart, Crosshair } from "lucide-react";
import { Link } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { AprovadosTable } from "@/components/radar/AprovadosTable";
import { ProdutoDrawer } from "@/components/radar/ProdutoDrawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRadarProdutos } from "@/hooks/radar/useRadarProdutos";
import type { RadarProduto } from "@/types/radar";

export default function AprovadosPage() {
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<RadarProduto | null>(null);
  const { produtos } = useRadarProdutos();
  const totalAprovados = produtos.filter((p) => p.stage === "comprado" || p.stage === "aprovado").length;

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Produtos Aprovados</h1>
            {totalAprovados > 0 && (
              <Badge variant="secondary" className="ml-1">
                {totalAprovados} {totalAprovados === 1 ? "produto" : "produtos"}
              </Badge>
            )}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/radar">
              <Crosshair className="h-4 w-4 mr-2" />
              Voltar ao Radar
            </Link>
          </Button>
        </div>

        <AprovadosTable onVerProduto={setProdutoSelecionado} />

        <ProdutoDrawer
          produto={produtoSelecionado}
          open={produtoSelecionado !== null}
          onClose={() => setProdutoSelecionado(null)}
        />
      </div>
    </PageTransition>
  );
}

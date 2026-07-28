import { useState } from "react";
import { ShoppingCart, Crosshair } from "lucide-react";
import { Link } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { PageHeader } from "@/components/PageHeader";
import { AprovadosTable } from "@/components/radar/AprovadosTable";
import { ProdutoSheet } from "@/components/radar/ProdutoSheet";
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
        <PageHeader
          title="Produtos Aprovados"
          icon={ShoppingCart}
          badge={
            totalAprovados > 0 ? (
              <Badge variant="secondary">
                {totalAprovados} {totalAprovados === 1 ? "produto" : "produtos"}
              </Badge>
            ) : null
          }
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/radar">
                <Crosshair className="h-4 w-4 mr-2" />
                Voltar ao Radar
              </Link>
            </Button>
          }
        />

        <AprovadosTable onVerProduto={setProdutoSelecionado} />

        <ProdutoSheet
          produto={produtoSelecionado}
          open={produtoSelecionado !== null}
          onClose={() => setProdutoSelecionado(null)}
        />
      </div>
    </PageTransition>
  );
}

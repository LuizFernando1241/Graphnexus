import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { AprovadosTable } from "@/components/radar/AprovadosTable";
import { ProdutoDrawer } from "@/components/radar/ProdutoDrawer";
import type { RadarProduto } from "@/types/radar";

export default function AprovadosPage() {
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<RadarProduto | null>(null);

  return (
    <PageTransition>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Produtos Aprovados</h1>
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

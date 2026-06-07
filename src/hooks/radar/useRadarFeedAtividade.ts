import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getStageLabel } from "@/lib/radar/radarScore";
import type { PipelineStage } from "@/types/radar";

export interface RadarFeedItem {
  id: string;
  timestamp: string;
  tipo: "criacao" | "movimentacao" | "aprovacao" | "alteracao";
  nomeProduto: string;
  descricao: string;
  produtoId: string;
}

export function useRadarFeedAtividade(limite = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["radar-feed-atividade", user?.id, limite],
    queryFn: async (): Promise<RadarFeedItem[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("radar_historico")
        .select("id, timestamp, event, stage, field, new_value, produto_id")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false })
        .limit(limite);

      if (error) throw error;

      const produtoIds = [...new Set((data ?? []).map((r: any) => r.produto_id))];
      const { data: produtosData } = produtoIds.length
        ? await supabase
            .from("radar_produtos")
            .select("id, nome")
            .in("id", produtoIds)
        : { data: [] as any[] };

      const nomePorId: Record<string, string> = {};
      for (const p of (produtosData ?? []) as any[]) {
        nomePorId[p.id] = p.nome;
      }

      return ((data ?? []) as any[]).map((row): RadarFeedItem => {
        let tipo: RadarFeedItem["tipo"] = "alteracao";
        let descricao: string = row.event;

        if (row.event === "Produto criado") {
          tipo = "criacao";
          descricao = "Produto adicionado ao Radar";
        } else if (row.field === "stage") {
          tipo = row.new_value === "aprovado" ? "aprovacao" : "movimentacao";
          descricao = `Movido para ${getStageLabel(row.new_value as PipelineStage)}`;
        }

        return {
          id: row.id,
          timestamp: row.timestamp,
          tipo,
          nomeProduto: nomePorId[row.produto_id] ?? "Produto",
          descricao,
          produtoId: row.produto_id,
        };
      });
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  });
}

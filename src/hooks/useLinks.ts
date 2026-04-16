import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchEntityLinks, createEntityLink, deleteEntityLink } from "@/lib/api/links";
import { invalidateAllEntities } from "@/lib/cache";
import type { EntityType } from "@/types/entities";

export function useEntityLinks(entityId: string, entityType: EntityType) {
  return useQuery({
    queryKey: ["entity-links", entityId, entityType],
    queryFn: () => fetchEntityLinks(entityId, entityType),
    enabled: !!entityId,
  });
}

export function useCreateLink(entityId: string, entityType: EntityType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target: { type: EntityType; id: string; label?: string }) =>
      createEntityLink({
        source_type: entityType,
        source_id: entityId,
        target_type: target.type,
        target_id: target.id,
        label: target.label,
      }),
    onSuccess: (_data, target) => {
      queryClient.invalidateQueries({ queryKey: ["entity-links", entityId, entityType] });
      queryClient.invalidateQueries({ queryKey: ["entity-links", target.id, target.type] });
      invalidateAllEntities(queryClient, { exclude: ["tasks", "projects", "notes"] });
      toast.success("Link criado!");
    },
    onError: () => toast.error("Erro ao criar link (já existe?)"),
  });
}

export function useDeleteLink(entityId: string, entityType: EntityType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => deleteEntityLink(linkId),
    onSuccess: () => {
      // Invalidate broadly since we don't know both sides from just the linkId
      invalidateAllEntities(queryClient, { exclude: ["tasks", "projects", "notes"] });
      toast.success("Link removido");
    },
    onError: () => toast.error("Erro ao remover link"),
  });
}

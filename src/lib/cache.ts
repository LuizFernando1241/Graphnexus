import { QueryClient } from "@tanstack/react-query";

export function invalidateAllEntities(queryClient: QueryClient, options?: { exclude?: string[] }) {
  const exclude = options?.exclude || [];
  
  if (!exclude.includes("tasks")) queryClient.invalidateQueries({ queryKey: ["tasks"] });
  if (!exclude.includes("projects")) queryClient.invalidateQueries({ queryKey: ["projects"] });
  if (!exclude.includes("notes")) queryClient.invalidateQueries({ queryKey: ["notes"] });
  if (!exclude.includes("links")) {
    queryClient.invalidateQueries({ queryKey: ["links"] });
    queryClient.invalidateQueries({ queryKey: ["entity-links"] });
  }
  if (!exclude.includes("graph-data")) queryClient.invalidateQueries({ queryKey: ["graph-data"] });
  if (!exclude.includes("entity-titles")) queryClient.invalidateQueries({ queryKey: ["entity-titles"] });
  if (!exclude.includes("project-task-stats")) queryClient.invalidateQueries({ queryKey: ["project-task-stats"] });
}

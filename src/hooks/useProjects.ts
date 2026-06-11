import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjects, createProject, updateProject } from "@/lib/api/projects";
import {
  buildProjectTree,
  enrichTreeWithProgress,
  getProjectBreadcrumb,
  wouldCreateCycle,
} from "@/lib/projectProgress";
import type { Project, ProjectTree } from "@/types/entities";

/**
 * Loads all projects + computes the hierarchical tree with recursive progress.
 * Returns both the flat list (for backwards-compat) and the tree.
 */
export function useProjects(opts?: { showArchived?: boolean }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["projects", "tree", { showArchived: !!opts?.showArchived }],
    queryFn: async () => {
      const projects = await fetchProjects({ showArchived: opts?.showArchived });

      // Fetch task links for these projects
      const projectIds = projects.map((p) => p.id);
      const taskCountsByProjectId = new Map<string, { total: number; done: number }>();

      if (projectIds.length > 0) {
        const { data: links } = await supabase
          .from("entity_links")
          .select("source_id, target_id")
          .eq("source_type", "project")
          .eq("target_type", "task")
          .in("source_id", projectIds);

        const taskIds = Array.from(new Set((links ?? []).map((l) => l.target_id)));
        let tasksData: Array<{ id: string; status: string }> = [];
        if (taskIds.length > 0) {
          const { data } = await supabase
            .from("tasks")
            .select("id, status")
            .in("id", taskIds);
          tasksData = data ?? [];
        }

        const statusMap = new Map(tasksData.map((t) => [t.id, t.status]));
        for (const link of links ?? []) {
          const existing = taskCountsByProjectId.get(link.source_id) ?? { total: 0, done: 0 };
          existing.total += 1;
          if (statusMap.get(link.target_id) === "done") existing.done += 1;
          taskCountsByProjectId.set(link.source_id, existing);
        }
      }

      const tree = buildProjectTree(projects);
      enrichTreeWithProgress(tree, taskCountsByProjectId);

      return { flat: projects, tree };
    },
    staleTime: 1000 * 30,
  });

  const criarProjeto = useMutation({
    mutationFn: createProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const moverProjeto = useMutation({
    mutationFn: async ({
      projectId,
      novoParentId,
    }: {
      projectId: string;
      novoParentId: string | null;
    }) => {
      const flat = query.data?.flat ?? [];
      if (wouldCreateCycle(projectId, novoParentId, flat)) {
        throw new Error("Movimento criaria um ciclo na hierarquia");
      }
      return updateProject(projectId, { parent_id: novoParentId });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const flat = query.data?.flat ?? [];

  return {
    projects: flat,
    projectTree: query.data?.tree ?? ([] as ProjectTree[]),
    isLoading: query.isLoading,
    criarProjeto: criarProjeto.mutateAsync,
    moverProjeto: moverProjeto.mutateAsync,
    getBreadcrumb: useMemo(
      () => (projectId: string) => getProjectBreadcrumb(projectId, flat),
      [flat],
    ),
  };
}

export type { Project, ProjectTree };

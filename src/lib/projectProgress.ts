import type { Project, ProjectTree } from "@/types/entities";

/**
 * Build hierarchical tree from a flat list of projects.
 */
export function buildProjectTree(projects: Project[]): ProjectTree[] {
  const map = new Map<string, ProjectTree>();

  for (const project of projects) {
    map.set(project.id, {
      ...project,
      children: [],
      depth: 0,
      progressPercent: project.progressPercent ?? 0,
      totalTasksRecursive: project.totalTasksRecursive ?? 0,
      doneTasksRecursive: project.doneTasksRecursive ?? 0,
    });
  }

  const roots: ProjectTree[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function setDepth(node: ProjectTree, depth: number) {
    node.depth = depth;
    for (const child of node.children) setDepth(child, depth + 1);
  }
  for (const root of roots) setDepth(root, 0);

  return roots;
}

/**
 * Recursively compute progress for a node (sum of all descendant tasks).
 * Each task weighs equally regardless of depth.
 */
export function calcularProgressoRecursivo(
  node: ProjectTree,
  taskCountsByProjectId: Map<string, { total: number; done: number }>,
): { total: number; done: number; percent: number } {
  const diretas = taskCountsByProjectId.get(node.id) ?? { total: 0, done: 0 };
  let totalAcumulado = diretas.total;
  let doneAcumulado = diretas.done;

  for (const filho of node.children) {
    const res = calcularProgressoRecursivo(filho, taskCountsByProjectId);
    totalAcumulado += res.total;
    doneAcumulado += res.done;
  }

  const percent =
    totalAcumulado === 0
      ? 0
      : Math.round((doneAcumulado / totalAcumulado) * 100 * 10) / 10;

  node.totalTasksRecursive = totalAcumulado;
  node.doneTasksRecursive = doneAcumulado;
  node.progressPercent = percent;

  return { total: totalAcumulado, done: doneAcumulado, percent };
}

export function enrichTreeWithProgress(
  roots: ProjectTree[],
  taskCountsByProjectId: Map<string, { total: number; done: number }>,
): ProjectTree[] {
  for (const root of roots) {
    calcularProgressoRecursivo(root, taskCountsByProjectId);
  }
  return roots;
}

export function getAllDescendants(node: ProjectTree): ProjectTree[] {
  const result: ProjectTree[] = [];
  function collect(n: ProjectTree) {
    for (const child of n.children) {
      result.push(child);
      collect(child);
    }
  }
  collect(node);
  return result;
}

export function getProjectBreadcrumb(
  projectId: string,
  allProjects: Project[],
): Project[] {
  const map = new Map(allProjects.map((p) => [p.id, p]));
  const path: Project[] = [];
  let current = map.get(projectId);
  while (current) {
    path.unshift(current);
    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }
  return path;
}

/**
 * Check whether `candidateParentId` would create a cycle if assigned as parent of `projectId`.
 */
export function wouldCreateCycle(
  projectId: string,
  candidateParentId: string | null,
  allProjects: Project[],
): boolean {
  if (!candidateParentId) return false;
  if (candidateParentId === projectId) return true;
  const map = new Map(allProjects.map((p) => [p.id, p]));
  let current = map.get(candidateParentId);
  const seen = new Set<string>();
  while (current) {
    if (current.id === projectId) return true;
    if (seen.has(current.id)) return true;
    seen.add(current.id);
    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }
  return false;
}

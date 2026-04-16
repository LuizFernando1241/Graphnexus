import { lazy, Suspense, useRef, useCallback, useEffect, useState, useMemo } from "react";
import { Search, StickyNote, CheckSquare, FolderKanban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { GraphSkeleton } from "@/components/ui/page-skeleton";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { forceRadial } from "d3-force-3d";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import { supabase } from "@/integrations/supabase/client";
import type { EntityType } from "@/types/entities";

const ForceGraph3D = lazy(() => import("react-force-graph-3d"));

interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  color: string;
  emoji?: string | null;
  isOrphan?: boolean;
  linkCount?: number;
  content?: string | null;
  description?: string | null;
  x?: number;
  y?: number;
  z?: number;
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
}

interface GraphLink {
  source: string;
  target: string;
}

const TYPE_COLORS: Record<EntityType, string> = {
  note: "#7C3AED",
  task: "#3B82F6",
  project: "#10B981",
};

const TYPE_CONFIG: { type: EntityType; label: string; icon: React.ElementType; color: string }[] = [
  { type: "note", label: "Notas", icon: StickyNote, color: TYPE_COLORS.note },
  { type: "task", label: "Tarefas", icon: CheckSquare, color: TYPE_COLORS.task },
  { type: "project", label: "Projetos", icon: FolderKanban, color: TYPE_COLORS.project },
];

const ORPHAN_COLOR = "#3F3F46";
const ORPHAN_TEXT_COLOR = "rgba(244,244,248,0.3)";

async function fetchGraphData() {
  try {
    const [notes, tasks, projects, links] = await Promise.all([
      supabase.from("notes").select("id, title, emoji, color, content").eq("archived", false),
      supabase.from("tasks").select("id, title, description").eq("archived", false).neq("status", "cancelled"),
      supabase.from("projects").select("id, title, emoji, cover_color, description").eq("archived", false),
      supabase.from("entity_links").select("source_id, target_id"),
    ]);

    const linkCounts = new Map<string, number>();
    const connectedIds = new Set<string>();
    (links.data || []).forEach((l) => {
      connectedIds.add(l.source_id);
      connectedIds.add(l.target_id);
      linkCounts.set(l.source_id, (linkCounts.get(l.source_id) || 0) + 1);
      linkCounts.set(l.target_id, (linkCounts.get(l.target_id) || 0) + 1);
    });

    const nodes: GraphNode[] = [];
    const nodeIds = new Set<string>();

    (notes.data || []).forEach((n) => {
      nodes.push({ id: n.id, type: "note", label: n.title, color: n.color || TYPE_COLORS.note, emoji: n.emoji, content: n.content, isOrphan: !connectedIds.has(n.id), linkCount: linkCounts.get(n.id) || 0 });
      nodeIds.add(n.id);
    });
    (tasks.data || []).forEach((t) => {
      nodes.push({ id: t.id, type: "task", label: t.title, color: TYPE_COLORS.task, description: t.description, isOrphan: !connectedIds.has(t.id), linkCount: linkCounts.get(t.id) || 0 });
      nodeIds.add(t.id);
    });
    (projects.data || []).forEach((p) => {
      nodes.push({ id: p.id, type: "project", label: p.title, color: p.cover_color || TYPE_COLORS.project, emoji: p.emoji, description: p.description, isOrphan: !connectedIds.has(p.id), linkCount: linkCounts.get(p.id) || 0 });
      nodeIds.add(p.id);
    });

    const graphLinks: GraphLink[] = (links.data || [])
      .filter((l) => nodeIds.has(l.source_id) && nodeIds.has(l.target_id))
      .map((l) => ({ source: l.source_id, target: l.target_id }));

    return { nodes, links: graphLinks };
  } catch (error) {
    console.error("Erro ao carregar dados do grafo:", error);
    return { nodes: [], links: [] };
  }
}

export default function Graph() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hideOrphans, setHideOrphans] = useState(false);
  const [graphSearch, setGraphSearch] = useState("");
  const [visibleTypes, setVisibleTypes] = useState<Set<EntityType>>(new Set(["note", "task", "project"]));

  const toggleType = (type: EntityType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["graph-data"],
    queryFn: fetchGraphData,
  });

  const orphanCount = useMemo(() => data?.nodes.filter((n) => n.isOrphan).length ?? 0, [data]);

  const filteredData = useMemo(() => {
    if (!data) return data;
    const visibleNodeIds = new Set<string>();
    const nodes = data.nodes.filter((n) => {
      if (hideOrphans && n.isOrphan) return false;
      if (!visibleTypes.has(n.type)) return false;
      visibleNodeIds.add(n.id);
      return true;
    });
    const links = data.links.filter(
      (l) => {
        const srcId = typeof l.source === "string" ? l.source : (l.source as any).id;
        const tgtId = typeof l.target === "string" ? l.target : (l.target as any).id;
        return visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId);
      }
    );
    return { nodes, links };
  }, [data, hideOrphans, visibleTypes]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    if (!fgRef.current || !data) return;
    const fg = fgRef.current;
    fg.d3Force(
      "radial",
      forceRadial<GraphNode>(
        (node) => (node.isOrphan ? 300 : 0),
        0,
        0
      ).strength((node) => (node.isOrphan ? 0.1 : 0))
    );
    fg.d3ReheatSimulation();
  }, [data]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      const routes: Record<EntityType, string> = {
        note: "/notes",
        task: "/tasks",
        project: "/projects",
      };
      navigate(`${routes[node.type]}/${node.id}`);
    },
    [navigate]
  );

  const searchIndex = useMemo(() => {
    const index = new Map<string, string>();
    if (!data?.nodes) return index;
    data.nodes.forEach((node) => {
      const searchableText = [node.label, node.content, node.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      index.set(node.id, searchableText);
    });
    return index;
  }, [data?.nodes]);

  const nodeMatchesSearch = useCallback(
    (node: GraphNode): boolean => {
      if (!graphSearch.trim()) return true;
      const term = graphSearch.toLowerCase();
      const searchableText = searchIndex.get(node.id) || "";
      return searchableText.includes(term);
    },
    [graphSearch, searchIndex]
  );

  const nodeThreeObject = useCallback(
    (node: GraphNode) => {
      const group = new THREE.Group();
      if (hideOrphans && node.isOrphan) return group;

      const matchesSearch = nodeMatchesSearch(node);
      const isDimmed = graphSearch.trim() && !matchesSearch;
      const rawR = node.isOrphan ? 6 : 8 + (node.linkCount || 0) * 1.5;
      const r = Math.min(rawR, 24);

      // Main sphere (ultra smooth)
      const geometry = new THREE.SphereGeometry(r, 32, 32);
      // Flat color, no shadows (glow effect)
      const material = new THREE.MeshBasicMaterial({
        color: node.isOrphan ? ORPHAN_COLOR : node.color,
        transparent: true,
        opacity: isDimmed ? 0.05 : node.isOrphan ? 0.3 : 1,
      });
      const sphere = new THREE.Mesh(geometry, material);
      group.add(sphere);

      // Label text
      const label = node.emoji ? `${node.emoji} ${node.label}` : node.label;
      const truncated = label.length > 25 ? label.slice(0, 23) + "…" : label;
      
      const sprite = new SpriteText(truncated);
      sprite.color = node.isOrphan ? ORPHAN_TEXT_COLOR : "#F4F4F8";
      sprite.textHeight = 4;
      // Position label above the sphere tight
      sprite.position.y = r + 5;
      
      if (isDimmed) {
        sprite.material.opacity = 0.02;
      } else if (node.isOrphan) {
        sprite.material.opacity = 0.2;
      } else {
        sprite.material.opacity = 0.8;
      }
      
      group.add(sprite);
      return group;
    },
    [hideOrphans, graphSearch, nodeMatchesSearch]
  );

  if (isLoading) return <GraphSkeleton />;

  return (
    <PageTransition>
      <div ref={containerRef} className="relative w-full h-[calc(100vh-5rem)] rounded-lg overflow-hidden border border-border">
        {data && (
          <div className="absolute top-3 left-3 right-3 z-10 flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar no grafo..."
                value={graphSearch}
                onChange={(e) => setGraphSearch(e.target.value)}
                className="pl-9 bg-card/80 backdrop-blur-sm border-border"
                aria-label="Buscar no grafo"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Entity type filters */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card/80 backdrop-blur-sm px-2 py-1.5">
                {TYPE_CONFIG.map(({ type, label, icon: Icon, color }) => {
                  const active = visibleTypes.has(type);
                  return (
                    <Button
                      key={type}
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleType(type)}
                      className={`h-7 px-2 gap-1.5 text-xs transition-all ${
                        active ? "opacity-100" : "opacity-30 hover:opacity-60"
                      }`}
                      title={`${active ? "Ocultar" : "Mostrar"} ${label}`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{label}</span>
                    </Button>
                  );
                })}
              </div>

              {/* Orphan toggle */}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card/80 backdrop-blur-sm px-3 py-1.5">
                <Switch
                  id="show-orphans"
                  checked={!hideOrphans}
                  onCheckedChange={(v) => setHideOrphans(!v)}
                />
                <Label htmlFor="show-orphans" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  Órfãos ({orphanCount})
                </Label>
              </div>
            </div>
          </div>
        )}

        <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Carregando cosmos...</div>}>
          {filteredData && (
            <ForceGraph3D
              ref={fgRef}
              graphData={filteredData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="#0F0F13"
              linkColor={() => "rgba(255, 255, 255, 0.15)"}
              linkWidth={0.6}
              d3AlphaDecay={0.04}
              d3VelocityDecay={0.4}
              nodeThreeObject={nodeThreeObject as any}
              onNodeClick={handleNodeClick as any}
            />
          )}
        </Suspense>
      </div>
    </PageTransition>
  );
}

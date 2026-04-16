import { lazy, Suspense, useRef, useCallback, useEffect, useState, useMemo } from "react";
import { EyeOff, Eye, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageTransition } from "@/components/PageTransition";
import { GraphSkeleton } from "@/components/ui/page-skeleton";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { forceRadial } from "d3-force";
import { supabase } from "@/integrations/supabase/client";
import type { EntityType } from "@/types/entities";

const ForceGraph2D = lazy(() => import("react-force-graph-2d"));

interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  color: string;
  emoji?: string | null;
  isOrphan?: boolean;
  content?: string | null;
  description?: string | null;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
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

    const connectedIds = new Set<string>();
    (links.data || []).forEach((l) => {
      connectedIds.add(l.source_id);
      connectedIds.add(l.target_id);
    });

    const nodes: GraphNode[] = [];
    const nodeIds = new Set<string>();

    (notes.data || []).forEach((n) => {
      nodes.push({ id: n.id, type: "note", label: n.title, color: n.color || TYPE_COLORS.note, emoji: n.emoji, content: n.content, isOrphan: !connectedIds.has(n.id) });
      nodeIds.add(n.id);
    });
    (tasks.data || []).forEach((t) => {
      nodes.push({ id: t.id, type: "task", label: t.title, color: TYPE_COLORS.task, description: t.description, isOrphan: !connectedIds.has(t.id) });
      nodeIds.add(t.id);
    });
    (projects.data || []).forEach((p) => {
      nodes.push({ id: p.id, type: "project", label: p.title, color: p.cover_color || TYPE_COLORS.project, emoji: p.emoji, description: p.description, isOrphan: !connectedIds.has(p.id) });
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

  const { data, isLoading } = useQuery({
    queryKey: ["graph-data"],
    queryFn: fetchGraphData,
  });

  const orphanCount = useMemo(() => data?.nodes.filter((n) => n.isOrphan).length ?? 0, [data]);

  const filteredData = useMemo(() => {
    if (!data || !hideOrphans) return data;
    return { nodes: data.nodes.filter((n) => !n.isOrphan), links: data.links };
  }, [data, hideOrphans]);

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

  // Apply radial force: orphans pushed to outer orbit, connected nodes stay centered
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

  // Pre-compute searchable text index for O(1) lookup during render
  const searchIndex = useMemo(() => {
    const index = new Map<string, string>();
    if (!data?.nodes) return index;
    
    data.nodes.forEach((node) => {
      const searchableText = [
        node.label,
        node.content,
        node.description,
      ].filter(Boolean).join(" ").toLowerCase();
      index.set(node.id, searchableText);
    });
    return index;
  }, [data?.nodes]);

  // Helper function to check if node matches search (O(1) lookup)
  const nodeMatchesSearch = useCallback((node: GraphNode): boolean => {
    if (!graphSearch.trim()) return true;
    const term = graphSearch.toLowerCase();
    const searchableText = searchIndex.get(node.id) || "";
    return searchableText.includes(term);
  }, [graphSearch, searchIndex]);

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      // If hideOrphans is enabled and node is orphan, don't draw
      if (hideOrphans && node.isOrphan) return;

      const x = node.x || 0;
      const y = node.y || 0;
      const matchesSearch = nodeMatchesSearch(node);
      const isDimmed = graphSearch.trim() && !matchesSearch;
      const r = node.isOrphan ? 6 : 8;
      const fontSize = 11 / globalScale;

      // Dimmed nodes are very transparent
      ctx.globalAlpha = isDimmed ? 0.05 : (node.isOrphan ? 0.3 : 1);

      // Circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = node.isOrphan ? ORPHAN_COLOR : node.color;
      ctx.fill();

      // Border
      ctx.strokeStyle = isDimmed ? "rgba(255,255,255,0.02)" : (node.isOrphan ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.2)");
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();

      // Label
      const label = node.emoji ? `${node.emoji} ${node.label}` : node.label;
      const truncated = label.length > 20 ? label.slice(0, 18) + "…" : label;
      ctx.font = `${fontSize}px "DM Sans", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.globalAlpha = isDimmed ? 0.05 : 1;
      ctx.fillStyle = node.isOrphan ? ORPHAN_TEXT_COLOR : "#F4F4F8";
      ctx.fillText(truncated, x, y + r + 3 / globalScale);
    },
    [hideOrphans, graphSearch, nodeMatchesSearch]
  );

  if (isLoading) return <GraphSkeleton />;

  return (
    <PageTransition>
    <div ref={containerRef} className="relative w-full h-[calc(100vh-5rem)] rounded-lg overflow-hidden border border-border">
      {/* Search and filter overlay */}
      {data && (
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-col sm:flex-row gap-3 justify-between">
          {/* Search input */}
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

          {/* Orphan toggle */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card/80 backdrop-blur-sm px-3 py-2">
            <div className="flex items-center gap-2">
              <Switch
                id="show-orphans"
                checked={!hideOrphans}
                onCheckedChange={(v) => setHideOrphans(!v)}
              />
              <Label htmlFor="show-orphans" className="text-xs text-muted-foreground cursor-pointer">
                Mostrar órfãos
              </Label>
            </div>
            <span className="text-xs text-muted-foreground">
              ({orphanCount} cemitério)
            </span>
          </div>
        </div>
      )}

      <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Carregando visualização...</div>}>
        {filteredData && (
          <ForceGraph2D
            ref={fgRef}
            graphData={filteredData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#0F0F13"
            linkColor={() => "rgba(255, 255, 255, 0.85)"}
            linkWidth={2.5}
            d3AlphaDecay={0.04}
            d3VelocityDecay={0.4}
            nodeCanvasObject={nodeCanvasObject as any}
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.beginPath();
              ctx.arc(node.x || 0, node.y || 0, 12, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            onNodeClick={handleNodeClick as any}
            onNodeDragEnd={(node: any) => {
              node.fx = node.x;
              node.fy = node.y;
            }}
          />
        )}
      </Suspense>
    </div>
    </PageTransition>
  );
}

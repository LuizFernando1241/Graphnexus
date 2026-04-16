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
import { forceRadial, forceManyBody, forceLink } from "d3-force-3d";
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
  __spriteCache?: THREE.Object3D; // Cache to prevent memory leak
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
  
  // Destaque visual (Hover)
  const [hoverNode, setHoverNode] = useState<string | null>(null);

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
    if (!data) return null; // Retornar nulo se não houver dados
    
    const visibleNodeIds = new Set<string>();
    
    // Precisamos recriar os objetos completamente porque o useQuery faz cache dos dados.
    // O react-force-graph muta esses objetos injetando x,y,z e __spriteCache.
    // Se não limparmos ao remontar a página, as posições velhas e os WebGL contexts velhos quebram o canvas!
    const nodes = data.nodes
      .filter((n) => {
        if (hideOrphans && n.isOrphan) return false;
        if (!visibleTypes.has(n.type)) return false;
        visibleNodeIds.add(n.id);
        return true;
      })
      .map((n) => ({ 
        ...n, 
        x: undefined, y: undefined, z: undefined, // Limpa física antiga
        vx: undefined, vy: undefined, vz: undefined,
        __spriteCache: undefined // Limpa instâncias Three.js que pertenciam a um canvas destruído
      }));

    const links = data.links
      .filter((l) => {
        const srcId = typeof l.source === "object" ? l.source.id : l.source;
        const tgtId = typeof l.target === "object" ? l.target.id : l.target;
        return visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId);
      })
      .map((l) => ({
        // O react-force-graph troca as strings originais por referências de objeto.
        // Precisamos garantir que sempre passamos strings novas na remontagem.
        source: typeof l.source === "object" ? l.source.id : l.source,
        target: typeof l.target === "object" ? l.target.id : l.target
      }));

    return { nodes, links };
  }, [data, hideOrphans, visibleTypes]);

  const connectedNodes = useMemo(() => {
    if (!hoverNode || !filteredData) return new Set<string>();
    const connected = new Set<string>();
    connected.add(hoverNode);
    filteredData.links.forEach((l: any) => {
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      if (srcId === hoverNode) connected.add(tgtId);
      if (tgtId === hoverNode) connected.add(srcId);
    });
    return connected;
  }, [hoverNode, filteredData]);

  // ResizeObserver previne bugs no layout quando a barra lateral altera a largura
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, []);

  // Física e Luzes estilo Obsidian
  useEffect(() => {
    if (!fgRef.current || !data) return;
    const fg = fgRef.current;
    
    // Força de atração dos centros e repulsão das cargas (Estilo Obsidian)
    fg.d3Force("charge", forceManyBody().strength(-150)); 
    fg.d3Force("link", forceLink().distance(40));
    fg.d3Force(
      "radial",
      forceRadial<GraphNode>(
        (node) => (node.isOrphan ? 300 : 0),
        0,
        0
      ).strength((node) => (node.isOrphan ? 0.1 : 0.05))
    );
    
    // Adicionar iluminação para destacar as esferas (Modo Premium)
    const scene = fg.scene();
    if (scene && !scene.__hasPremiumLights) {
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(100, 200, 100);
      scene.add(ambientLight);
      scene.add(directionalLight);
      scene.__hasPremiumLights = true;
    }

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

  // Sincroniza a opacidade dos textos (Sprite) pois o react-force-graph-3d não re-avalia o nodeThreeObject constantemente
  useEffect(() => {
    if (!filteredData) return;
    
    filteredData.nodes.forEach((node) => {
      if (node.__spriteCache) {
        const sprite = node.__spriteCache as SpriteText;
        const matchesSearch = nodeMatchesSearch(node);
        const isDimmed = graphSearch.trim() && !matchesSearch;

        // Ocultar texto de nós isolados ou esmaecer pelo search
        if (hoverNode && !connectedNodes.has(node.id)) {
          sprite.material.opacity = 0;
        } else if (isDimmed) {
          sprite.material.opacity = 0.05;
        } else {
          sprite.material.opacity = node.isOrphan ? 0.3 : 0.9;
        }
      }
    });
  }, [hoverNode, connectedNodes, graphSearch, nodeMatchesSearch, filteredData]);

  // nodeThreeObject otimizado usando cache na propriedade `__spriteCache` para evitar Memory Leaks!
  const nodeThreeObject = useCallback(
    (node: GraphNode) => {
      if (hideOrphans && node.isOrphan) return new THREE.Group();

      const rawR = node.isOrphan ? 6 : 8 + (node.linkCount || 0) * 1.1; // Multiplicador 1.1
      const r = Math.min(rawR, 18); // Limite máximo reduzido para 18

      // Cache do SpriteText para não travar a memória (GPU Leak fix)
      if (!node.__spriteCache) {
        const label = node.emoji ? `${node.emoji} ${node.label}` : node.label;
        const truncated = label.length > 25 ? label.slice(0, 23) + "…" : label;

        const sprite = new SpriteText(truncated);
        sprite.color = node.isOrphan ? ORPHAN_TEXT_COLOR : "#F4F4F8";
        sprite.textHeight = node.isOrphan ? 3 : 4;
        sprite.position.y = r + 4; // Um pouco mais colado
        sprite.center.set(0.5, 0);

        // Define a opacidade inicial
        const matchesSearch = nodeMatchesSearch(node);
        const isDimmed = graphSearch.trim() && !matchesSearch;
        if (hoverNode && !connectedNodes.has(node.id)) {
          sprite.material.opacity = 0;
        } else if (isDimmed) {
          sprite.material.opacity = 0.05;
        } else {
          sprite.material.opacity = node.isOrphan ? 0.3 : 0.9;
        }

        node.__spriteCache = sprite;
      }
      
      return node.__spriteCache as SpriteText;
    },
    [hideOrphans, graphSearch, nodeMatchesSearch, hoverNode, connectedNodes]
  );

  if (isLoading) return <GraphSkeleton />;

  return (
    <PageTransition>
      <div ref={containerRef} className="relative w-full h-[calc(100vh-5rem)] rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-[#09090b]">
        {/* Painel Glassmorphism Flutuante */}
        {data && (
          <div className="absolute top-4 left-4 right-4 z-10 flex flex-col sm:flex-row gap-3 justify-between pointer-events-none">
            <div className="relative flex-1 max-w-md pointer-events-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                placeholder="Explorar cosmos..."
                value={graphSearch}
                onChange={(e) => setGraphSearch(e.target.value)}
                className="pl-9 bg-black/40 backdrop-blur-xl border-white/10 text-white placeholder:text-white/40 shadow-lg h-10 rounded-xl hover:bg-black/50 transition-colors focus-visible:ring-1 focus-visible:ring-white/20"
                aria-label="Buscar no grafo"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap pointer-events-auto">
              {/* Filtros de Tipos (Glassmorphism) */}
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl px-2 py-1.5 shadow-lg">
                {TYPE_CONFIG.map(({ type, label, icon: Icon, color }) => {
                  const active = visibleTypes.has(type);
                  return (
                    <Button
                      key={type}
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleType(type)}
                      className={`h-8 px-2.5 gap-2 text-xs transition-all rounded-lg ${
                        active ? "opacity-100 bg-white/5 text-white" : "opacity-40 hover:opacity-100 hover:bg-white/5 text-white/70"
                      }`}
                      title={`${active ? "Ocultar" : "Mostrar"} ${label}`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }} />
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline font-medium">{label}</span>
                    </Button>
                  );
                })}
              </div>

              {/* Botão de Órfãos */}
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl px-3 py-1.5 shadow-lg">
                <Switch
                  id="show-orphans"
                  checked={!hideOrphans}
                  onCheckedChange={(v) => setHideOrphans(!v)}
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="show-orphans" className="text-xs font-medium text-white/80 cursor-pointer whitespace-nowrap pt-0.5">
                  Órfãos ({orphanCount})
                </Label>
              </div>
            </div>
          </div>
        )}

        <Suspense fallback={<div className="flex items-center justify-center h-full text-white/50 bg-[#09090b]">Carregando universo...</div>}>
          {filteredData && (
            <ForceGraph3D
              ref={fgRef}
              graphData={filteredData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="#050505"
              
              // Ajustes Visuais Nativos Otimizados
              nodeColor={(node: any) => node.isOrphan ? ORPHAN_COLOR : node.color}
              nodeVal={(node: any) => {
                const rawR = node.isOrphan ? 6 : 8 + (node.linkCount || 0) * 1.1; // Tamanho base atualizado
                const r = Math.min(rawR, 18); // Limite máximo 18
                return Math.pow(r / 4, 3); // O 'react-force-graph' tira a raiz cúbica
              }}
              nodeOpacity={(node: any) => {
                if (hoverNode && !connectedNodes.has(node.id)) return 0.15;
                if (graphSearch.trim() && !nodeMatchesSearch(node)) return 0.15;
                return node.isOrphan ? 0.3 : 0.95;
              }}
              
              // Linhas Mais Brancas e Sólidas
              linkColor={() => "rgba(255, 255, 255, 0.45)"} // Opacidade mais alta ao invés de quase invisível
              linkWidth={(link: any) => {
                const srcId = typeof link.source === "object" ? link.source.id : link.source;
                const tgtId = typeof link.target === "object" ? link.target.id : link.target;
                if (hoverNode && (srcId === hoverNode || tgtId === hoverNode)) return 1.5;
                return 0.6;
              }}
              linkVisibility={(link: any) => {
                if (!hoverNode) return true;
                const srcId = typeof link.source === "object" ? link.source.id : link.source;
                const tgtId = typeof link.target === "object" ? link.target.id : link.target;
                return srcId === hoverNode || tgtId === hoverNode;
              }}
              
              // Partículas ativadas ao focar no hover (WOW Effect)
              linkDirectionalParticles={(link: any) => {
                if (!hoverNode) return 0;
                const srcId = typeof link.source === "object" ? link.source.id : link.source;
                const tgtId = typeof link.target === "object" ? link.target.id : link.target;
                return (srcId === hoverNode || tgtId === hoverNode) ? 3 : 0;
              }}
              linkDirectionalParticleSpeed={0.015}
              linkDirectionalParticleWidth={1.5}
              linkDirectionalParticleColor={() => "rgba(255,255,255,0.8)"}

              // Estendendo o mesh principal ao invés de recriar tudo
              nodeThreeObject={nodeThreeObject as any}
              nodeThreeObjectExtend={true}
              
              // Interatividade
              onNodeClick={handleNodeClick as any}
              onNodeHover={(node: any) => {
                setHoverNode(node ? node.id : null);
                if (containerRef.current) {
                  containerRef.current.style.cursor = node ? 'pointer' : 'default';
                }
              }}

              // Físicas secundárias
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />
          )}
        </Suspense>
      </div>
    </PageTransition>
  );
}

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
  __nodeObj?: THREE.Group; // Cache da malha 3D + Texto
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
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

// Criar geometrias com antecedência para economizar memória (Flyweight pattern)
const baseGeometry = new THREE.SphereGeometry(1, 24, 24);

export default function Graph() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hideOrphans, setHideOrphans] = useState(false);
  const [graphSearch, setGraphSearch] = useState("");
  const [visibleTypes, setVisibleTypes] = useState<Set<EntityType>>(new Set(["note", "task", "project"]));
  
  // Otimização de Performance Extrema: Hover Node não usa React State para evitar lag e renderização pesada
  const hoverNodeRef = useRef<string | null>(null);

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
    if (!data) return null;
    const visibleNodeIds = new Set<string>();
    
    // Nós mantemos a REFERÊNCIA exata dos clones do fetchGraphData
    // para evitar vazamento de memória e não "explodir" a física da D3
    const nodes = data.nodes.filter((n) => {
      if (hideOrphans && n.isOrphan) return false;
      if (!visibleTypes.has(n.type)) return false;
      visibleNodeIds.add(n.id);
      return true;
    });

    const links = data.links.filter((l) => {
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      return visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId);
    });

    return { nodes, links };
  }, [data, hideOrphans, visibleTypes]);

  // Observer com requestAnimationFrame para economizar CPU
  useEffect(() => {
    if (!containerRef.current) return;
    let animationFrameId: number;
    const observer = new ResizeObserver((entries) => {
      animationFrameId = requestAnimationFrame(() => {
        if (containerRef.current) {
          const { width, height } = entries[0].contentRect;
          setDimensions({ width, height });
        }
      });
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Motor de Física Estilo Obsidian
  useEffect(() => {
    if (!fgRef.current || !data) return;
    const fg = fgRef.current;
    
    fg.d3Force("charge", forceManyBody().strength(-140)); 
    fg.d3Force("link", forceLink().distance(45));
    fg.d3Force(
      "radial",
      forceRadial<GraphNode>(
        (node) => (node.isOrphan ? 250 : 0),
        0,
        0
      ).strength((node) => (node.isOrphan ? 0.08 : 0.02))
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

  // Criador de Malhas 100% customizado (Com Anti-Memory Leak e Correção de Texturas Edge/Hover)
  const nodeThreeObject = useCallback(
    (node: GraphNode) => {
      if (hideOrphans && node.isOrphan) return new THREE.Group();

      const rawR = node.isOrphan ? 4 : 6 + (node.linkCount || 0) * 1.1;
      const r = Math.min(rawR, 14);

      if (!node.__nodeObj) {
        const group = new THREE.Group();

        // 1. A Esfera - MeshBasicMaterial
        const color = node.isOrphan ? ORPHAN_COLOR : node.color;
        // MÁGICA DE PERFORMANCE E CORES AQUI (depthWrite: false evita bugs de transparência e cortes)
        const material = new THREE.MeshBasicMaterial({ 
          color, 
          transparent: true, 
          opacity: node.isOrphan ? 0.3 : 0.95,
          depthWrite: false 
        });
        const sphere = new THREE.Mesh(baseGeometry, material);
        sphere.scale.set(r, r, r);
        sphere.userData = { isSphere: true, defaultOpacity: node.isOrphan ? 0.3 : 0.95 };
        group.add(sphere);

        // 2. O Texto (Sprite)
        const label = node.emoji ? `${node.emoji} ${node.label}` : node.label;
        const truncated = label.length > 25 ? label.slice(0, 23) + "…" : label;

        const sprite = new SpriteText(truncated);
        sprite.color = node.isOrphan ? ORPHAN_TEXT_COLOR : "#F4F4F8";
        sprite.textHeight = node.isOrphan ? 3 : 4.5;
        sprite.position.y = r + 4;
        sprite.center.set(0.5, 0);
        
        // Corrige texto sendo engolido ou renderizado escuro por trás de outras esferas
        if (sprite.material) {
           sprite.material.depthWrite = false;
        }

        sprite.userData = { isText: true, defaultOpacity: node.isOrphan ? 0.3 : 0.95 };
        group.add(sprite);

        node.__nodeObj = group;
      }
      
      // Update sizes in case it changes, without recreating materials
      const sphereMesh = node.__nodeObj.children.find((c: any) => c.userData.isSphere) as THREE.Mesh;
      if (sphereMesh) sphereMesh.scale.set(r, r, r);
      
      return node.__nodeObj;
    },
    [hideOrphans]
  );

  // Atualizador manual ultra-rápido do estado visual (Roda sem renderizar o React!)
  const updateVisualState = useCallback((hoverJustChanged = false) => {
    if (!filteredData) return;

    // FIX: Ghost Hover (Quando muda os filtros enquanto está com mouse num nó)
    let hoverId = hoverNodeRef.current;
    if (hoverId) {
      const hoverNodeExists = filteredData.nodes.some(n => n.id === hoverId);
      if (!hoverNodeExists) {
         hoverNodeRef.current = null;
         hoverId = null;
      }
    }
    
    // Calcula conexões diretas do hover de forma rápida
    const connected = new Set<string>();
    if (hoverId) {
      connected.add(hoverId);
      for (const l of filteredData.links) {
        const srcId = typeof l.source === "object" ? (l.source as any).id : l.source;
        const tgtId = typeof l.target === "object" ? (l.target as any).id : l.target;
        if (srcId === hoverId) connected.add(tgtId);
        if (tgtId === hoverId) connected.add(srcId);
      }
    }

    filteredData.nodes.forEach((node) => {
      const group = node.__nodeObj;
      if (!group) return;

      const matchesSearch = nodeMatchesSearch(node);
      const isDimmedBySearch = graphSearch.trim() && !matchesSearch;
      const isDimmedByHover = hoverId && !connected.has(node.id);

      group.children.forEach((child) => {
        const c = child as THREE.Mesh | SpriteText;
        const defaultOp = c.userData.defaultOpacity;
        
        if (isDimmedByHover) {
          c.material.opacity = c.userData.isText ? 0 : 0.05;
        } else if (isDimmedBySearch) {
          c.material.opacity = 0.05;
        } else {
          c.material.opacity = defaultOp;
        }
      });
    });

    // Apenas pede para o WebGL recomputar linhas (pesado!) se o hover MUDAR,
    // caso seja apenas usuário digitando na barra de pesquisa a gente economiza CPU e não causa "stutter"
    if (hoverJustChanged && fgRef.current) {
        fgRef.current.linkColor(fgRef.current.linkColor());
        fgRef.current.linkWidth(fgRef.current.linkWidth());
        fgRef.current.linkDirectionalParticles(fgRef.current.linkDirectionalParticles());
    }
  }, [filteredData, graphSearch, nodeMatchesSearch]);

  // Hook que ouve apenas o State do Search para atualizar cores
  useEffect(() => {
    updateVisualState(false);
  }, [graphSearch, updateVisualState]);

  if (isLoading) return <GraphSkeleton />;

  return (
    <PageTransition>
      <div ref={containerRef} className="relative w-full h-[calc(100vh-5rem)] rounded-xl overflow-hidden shadow-2xl bg-[#09090b]">
        {/* Painel Glassmorphism Flutuante UI */}
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
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }} />
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline font-medium">{label}</span>
                    </Button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl px-3 py-1.5 shadow-lg">
                <Switch
                  id="show-orphans"
                  checked={!hideOrphans}
                  onCheckedChange={(v) => setHideOrphans(!v)}
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="show-orphans" className="text-xs font-medium text-white/80 cursor-pointer pt-0.5">
                  Órfãos ({orphanCount})
                </Label>
              </div>
            </div>
          </div>
        )}

        <Suspense fallback={<div className="flex items-center justify-center h-full text-white/50">Carregando universo...</div>}>
          {filteredData && (
            <ForceGraph3D
              ref={fgRef}
              graphData={filteredData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="#020203"
              
              nodeThreeObject={nodeThreeObject as any}
              
              linkColor={(link: any) => {
                 const srcId = typeof link.source === "object" ? link.source.id : link.source;
                 const tgtId = typeof link.target === "object" ? link.target.id : link.target;
                 const hoverId = hoverNodeRef.current;
                 if (hoverId && srcId !== hoverId && tgtId !== hoverId) {
                     return "rgba(255, 255, 255, 0.05)"; // Linhas esmaecem
                 }
                 return "rgba(255, 255, 255, 0.45)"; // Linhas normais e super brancas
              }}
              linkWidth={(link: any) => {
                const srcId = typeof link.source === "object" ? link.source.id : link.source;
                const tgtId = typeof link.target === "object" ? link.target.id : link.target;
                return (hoverNodeRef.current && (srcId === hoverNodeRef.current || tgtId === hoverNodeRef.current)) ? 1.5 : 0.6;
              }}
              
              // Efeito visual sutil de partículas
              linkDirectionalParticles={(link: any) => {
                const srcId = typeof link.source === "object" ? link.source.id : link.source;
                const tgtId = typeof link.target === "object" ? link.target.id : link.target;
                return (hoverNodeRef.current && (srcId === hoverNodeRef.current || tgtId === hoverNodeRef.current)) ? 3 : 0;
              }}
              linkDirectionalParticleSpeed={0.015}
              linkDirectionalParticleWidth={1.5}
              linkDirectionalParticleColor={() => "rgba(255,255,255,0.7)"}
              
              onNodeClick={handleNodeClick as any}
              onNodeHover={(node: any) => {
                 const newHoverId = node ? node.id : null;
                 if (hoverNodeRef.current !== newHoverId) {
                   hoverNodeRef.current = newHoverId;
                   updateVisualState(true); // Hover mudou => recalcular arestas visualmente
                 }
                 if (containerRef.current) {
                   containerRef.current.style.cursor = node ? 'pointer' : 'grab';
                 }
              }}

              enableNodeDrag={false}
              d3AlphaDecay={0.03}
              d3VelocityDecay={0.4}
            />
          )}
        </Suspense>
      </div>
    </PageTransition>
  );
}

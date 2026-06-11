import React, { lazy, Suspense, useRef, useCallback, useEffect, useState, useMemo, memo } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Search, StickyNote, CheckSquare, FolderKanban, Crosshair } from "lucide-react";
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
import type { ForceGraphMethods } from "react-force-graph-3d";

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
  __nodeObj?: THREE.Group;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

const TYPE_COLORS: Record<EntityType, string> = {
  note: "#7C3AED",
  task: "#3B82F6",
  project: "#10B981",
  product: "#F59E0B",
};

const TYPE_CONFIG = [
  { type: "note" as const, label: "Notas", icon: StickyNote, color: TYPE_COLORS.note },
  { type: "task" as const, label: "Tarefas", icon: CheckSquare, color: TYPE_COLORS.task },
  { type: "project" as const, label: "Projetos", icon: FolderKanban, color: TYPE_COLORS.project },
  { type: "product" as const, label: "Produtos", icon: Crosshair, color: TYPE_COLORS.product },
];

const ORPHAN_COLOR = "#3F3F46";
const ORPHAN_TEXT_COLOR = "rgba(244,244,248,0.3)";

async function fetchGraphData() {
  try {
    const [notes, tasks, projects, products, links] = await Promise.all([
      supabase.from("notes").select("id, title, emoji, color, content").eq("archived", false),
      supabase.from("tasks").select("id, title, description").eq("archived", false).neq("status", "cancelled"),
      supabase.from("projects").select("id, title, emoji, cover_color, description, parent_id").eq("archived", false),
      supabase.from("radar_produtos").select("id, nome, fornecedor, stage").neq("stage", "arquivado"),
      supabase.from("entity_links").select("source_id, source_type, target_id, target_type"),
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

    (products.data || []).forEach((p: { id: string; nome: string; fornecedor: string }) => {
      nodes.push({ id: p.id, type: "product", label: p.nome, color: TYPE_COLORS.product, description: p.fornecedor, isOrphan: !connectedIds.has(p.id), linkCount: linkCounts.get(p.id) || 0 });
      nodeIds.add(p.id);
    });

    const graphLinks: GraphLink[] = (links.data || [])
      .filter((l) => nodeIds.has(l.source_id) && nodeIds.has(l.target_id))
      .map((l) => ({ source: l.source_id, target: l.target_id }));

    // Hierarchy edges (parent → child) from projects.parent_id
    (projects.data || []).forEach((p: { id: string; parent_id?: string | null }) => {
      if (p.parent_id && nodeIds.has(p.parent_id) && nodeIds.has(p.id)) {
        graphLinks.push({ source: p.parent_id, target: p.id });
      }
    });

    return { nodes, links: graphLinks };
  } catch (error) {
    // Log apenas em desenvolvimento
    // eslint-disable-next-line no-console
    console.error("Erro ao carregar dados do grafo:", error);
    return { nodes: [], links: [] };
  }
}

// Criar geometria antecipadamente para performance superior
const baseGeometry = new THREE.SphereGeometry(1, 24, 24);

// Componente memoizado para botão de filtro de tipo
interface TypeFilterButtonProps {
  type: EntityType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isActive: boolean;
  onToggle: (type: EntityType) => void;
}

const TypeFilterButton = memo(function TypeFilterButton({
  type,
  label,
  icon: Icon,
  color,
  isActive,
  onToggle,
}: TypeFilterButtonProps) {
  const handleClick = useCallback(() => onToggle(type), [onToggle, type]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={`h-8 px-2.5 gap-2 text-xs transition-all rounded-lg ${
        isActive ? "opacity-100 bg-white/5 text-white" : "opacity-40 hover:opacity-100 hover:bg-white/5 text-white/70"
      }`}
    >
      <span className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }} />
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline font-medium">{label}</span>
    </Button>
  );
});

// Componente memoizado para os controles do grafo
interface GraphControlsProps {
  searchValue: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  visibleTypes: Set<EntityType>;
  onToggleType: (type: EntityType) => void;
  hideOrphans: boolean;
  onToggleOrphans: (checked: boolean) => void;
  orphanCount: number;
}

const GraphControls = memo(function GraphControls({
  searchValue,
  onSearchChange,
  visibleTypes,
  onToggleType,
  hideOrphans,
  onToggleOrphans,
  orphanCount,
}: GraphControlsProps) {
  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex flex-col sm:flex-row gap-3 justify-between pointer-events-none">
      <div className="relative flex-1 max-w-md pointer-events-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Explorar cosmos..."
          value={searchValue}
          onChange={onSearchChange}
          className="pl-9 bg-black/40 backdrop-blur-xl border-white/10 text-white placeholder:text-white/40 shadow-lg h-10 rounded-xl hover:bg-black/50 transition-colors focus-visible:ring-1 focus-visible:ring-white/20"
          aria-label="Buscar no grafo"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap pointer-events-auto">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl px-2 py-1.5 shadow-lg">
          {TYPE_CONFIG.map(({ type, label, icon, color }) => (
            <TypeFilterButton
              key={type}
              type={type}
              label={label}
              icon={icon}
              color={color}
              isActive={visibleTypes.has(type)}
              onToggle={onToggleType}
            />
          ))}
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl px-3 py-1.5 shadow-lg">
          <Switch
            id="show-orphans"
            checked={!hideOrphans}
            onCheckedChange={onToggleOrphans}
            className="data-[state=checked]:bg-primary"
          />
          <Label htmlFor="show-orphans" className="text-xs font-medium text-white/80 cursor-pointer pt-0.5">
            Órfãos ({orphanCount})
          </Label>
        </div>
      </div>
    </div>
  );
});

export default function Graph() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods>(undefined);
  
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hideOrphans, setHideOrphans] = useState(false);
  const [graphSearch, setGraphSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleTypes, setVisibleTypes] = useState<Set<EntityType>>(new Set(["note", "task", "project", "product"]));
  
  const hoverNodeRef = useRef<string | null>(null);

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearch(value);
  }, 150);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGraphSearch(value);
    debouncedSetSearch(value);
  }, [debouncedSetSearch]);

  const toggleType = useCallback((type: EntityType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["graph-data"],
    queryFn: fetchGraphData,
  });

  const orphanCount = useMemo(() => data?.nodes.filter((n) => n.isOrphan).length ?? 0, [data]);

  const filteredData = useMemo(() => {
    if (!data) return null;
    const visibleNodeIds = new Set<string>();
    
    const nodes = data.nodes.filter((n) => {
      if (hideOrphans && n.isOrphan) return false;
      if (!visibleTypes.has(n.type)) return false;
      visibleNodeIds.add(n.id);
      return true;
    });

    const links = data.links.filter((l) => {
      const sourceId = typeof l.source === "object" ? l.source.id : l.source;
      const targetId = typeof l.target === "object" ? l.target.id : l.target;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });

    return { nodes, links };
  }, [data, hideOrphans, visibleTypes]);

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

  // Configurar forças quando o grafo é montado/remontado
  const forcesConfigured = useRef(false);
  useEffect(() => {
    if (!fgRef.current || forcesConfigured.current) return;
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
    forcesConfigured.current = true;
    
    // Resetar flag quando componente desmonta para reconfigurar no próximo mount
    return () => {
      forcesConfigured.current = false;
    };
  }, []);

  const handleNodeClick = useCallback(
    (node: object) => {
      const gNode = node as GraphNode;
      if (!gNode.type || !gNode.id) return;

      if (gNode.type === "product") {
        navigate("/radar", { state: { selecionarProdutoId: gNode.id } });
        return;
      }
      const routes: Record<Exclude<EntityType, "product">, string> = {
        note: "/notes",
        task: "/tasks",
        project: "/projects",
      };
      navigate(`${routes[gNode.type as Exclude<EntityType, "product">]}/${gNode.id}`);
    },
    [navigate]
  );

  const searchIndex = useMemo(() => {
    const index = new Map<string, string>();
    if (!data?.nodes) return index;
    for (const node of data.nodes) {
      const searchableText = [node.label, node.content, node.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      index.set(node.id, searchableText);
    }
    return index;
  }, [data?.nodes]);

  const nodeMatchesSearch = useCallback(
    (node: GraphNode): boolean => {
      if (!debouncedSearch.trim()) return true;
      const term = debouncedSearch.toLowerCase();
      const searchableText = searchIndex.get(node.id) || "";
      return searchableText.includes(term);
    },
    [debouncedSearch, searchIndex]
  );

  // Cache global de objetos Three.js por node id
  const nodeObjCache = useRef<Map<string, THREE.Group>>(new Map());
  const emptyGroup = useMemo(() => new THREE.Group(), []);
  
  // Limpar cache quando dados mudam para evitar vazamento de memória
  useEffect(() => {
    // Dispose materiais e geometrias antigas
    nodeObjCache.current.forEach((group) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material?.dispose();
        }
      });
    });
    nodeObjCache.current.clear();
  }, [data]);

  const nodeThreeObject = useCallback(
    (nodeObj: object) => {
      const node = nodeObj as GraphNode;
      if (hideOrphans && node.isOrphan) return emptyGroup;

      // Cache key inclui propriedades visuais para invalidação correta
      const cacheKey = `${node.id}-${node.label}-${node.emoji || ''}-${node.color}-${node.isOrphan}-${node.linkCount || 0}`;
      
      const cached = nodeObjCache.current.get(cacheKey);
      if (cached) {
        node.__nodeObj = cached;
        return cached;
      }

      const rawR = node.isOrphan ? 4 : 6 + (node.linkCount || 0) * 1.1;
      const r = Math.min(rawR, 14);

      const group = new THREE.Group();
      const color = node.isOrphan ? ORPHAN_COLOR : node.color;
      
      const material = new THREE.MeshBasicMaterial({ 
        color, 
        transparent: true, 
        opacity: node.isOrphan ? 0.3 : 0.95,
        depthWrite: false 
      });
      
      const sphere = new THREE.Mesh(baseGeometry, material);
      sphere.scale.set(r, r, r);
      sphere.userData = { isSphere: true, defaultOpacity: node.isOrphan ? 0.3 : 0.95, nodeId: node.id };
      group.add(sphere);

      const label = node.emoji ? `${node.emoji} ${node.label}` : node.label;
      const truncated = label.length > 25 ? label.slice(0, 23) + "…" : label;

      const sprite = new SpriteText(truncated);
      sprite.color = node.isOrphan ? ORPHAN_TEXT_COLOR : "#F4F4F8";
      sprite.textHeight = node.isOrphan ? 3 : 4.5;
      sprite.position.y = r + 4;
      sprite.center.set(0.5, 0);
      
      if (sprite.material) {
         sprite.material.depthWrite = false;
      }

      sprite.userData = { isText: true, defaultOpacity: node.isOrphan ? 0.3 : 0.95, nodeId: node.id };
      group.add(sprite);

      node.__nodeObj = group;
      nodeObjCache.current.set(cacheKey, group);
      return group;
    },
    [hideOrphans, emptyGroup]
  );

  const updateVisualState = useCallback((hoverJustChanged = false) => {
    if (!filteredData) return;

    let hoverId = hoverNodeRef.current;
    if (hoverId) {
      const hoverNodeExists = filteredData.nodes.some(n => n.id === hoverId);
      if (!hoverNodeExists) {
         hoverNodeRef.current = null;
         hoverId = null;
      }
    }
    
    const connected = new Set<string>();
    if (hoverId) {
      connected.add(hoverId);
      for (const l of filteredData.links) {
        const srcId = typeof l.source === "object" ? (l.source as GraphNode).id : String(l.source);
        const tgtId = typeof l.target === "object" ? (l.target as GraphNode).id : String(l.target);
        if (srcId === hoverId) connected.add(tgtId);
        if (tgtId === hoverId) connected.add(srcId);
      }
    }

    const hasSearch = debouncedSearch.trim().length > 0;
    const searchTerm = hasSearch ? debouncedSearch.toLowerCase() : "";

    for (const node of filteredData.nodes) {
      const group = node.__nodeObj;
      if (!group) continue;

      let matchesSearch = true;
      if (hasSearch) {
        const searchableText = searchIndex.get(node.id) || "";
        matchesSearch = searchableText.includes(searchTerm);
      }
      const isDimmedBySearch = hasSearch && !matchesSearch;
      const isDimmedByHover = hoverId && !connected.has(node.id);

      for (const child of group.children) {
        const c = child as THREE.Mesh | SpriteText;
        const defaultOp = Number(c.userData.defaultOpacity);
        
        let targetOpacity = defaultOp;
        if (isDimmedByHover) {
          targetOpacity = c.userData.isText ? 0 : 0.05;
        } else if (isDimmedBySearch) {
          targetOpacity = 0.05;
        }

        const material = Array.isArray(c.material) ? c.material[0] : c.material;
        if (material) {
          material.opacity = targetOpacity;
        }
      }
    }

    // NOTA: Nao precisamos forcar refresh do ForceGraph3D aqui.
    // Os callbacks linkColorCallback, linkWidthCallback e linkParticlesCallback
    // ja leem hoverNodeRef.current dinamicamente durante a animacao.
    // Forcar refresh causava travamento com muitos nós.
  }, [filteredData, debouncedSearch, searchIndex]);

  useEffect(() => {
    updateVisualState(false);
  }, [debouncedSearch, updateVisualState]);

  // Callbacks do ForceGraph3D - SEM useCallback para permitir leitura atualizada da ref
  // ForceGraph3D chama esses callbacks durante animacao, useCallback nao traz beneficio aqui
  const linkColorCallback = (linkObj: object) => {
    const link = linkObj as GraphLink;
    const srcId = typeof link.source === "object" ? (link.source as GraphNode).id : String(link.source);
    const tgtId = typeof link.target === "object" ? (link.target as GraphNode).id : String(link.target);
    const hoverId = hoverNodeRef.current;
    if (hoverId && srcId !== hoverId && tgtId !== hoverId) {
      return "rgba(255, 255, 255, 0.05)";
    }
    return "rgba(255, 255, 255, 0.45)";
  };

  const linkWidthCallback = (linkObj: object) => {
    const link = linkObj as GraphLink;
    const srcId = typeof link.source === "object" ? (link.source as GraphNode).id : String(link.source);
    const tgtId = typeof link.target === "object" ? (link.target as GraphNode).id : String(link.target);
    return (hoverNodeRef.current && (srcId === hoverNodeRef.current || tgtId === hoverNodeRef.current)) ? 1.5 : 0.6;
  };

  const linkParticlesCallback = (linkObj: object) => {
    const link = linkObj as GraphLink;
    const srcId = typeof link.source === "object" ? (link.source as GraphNode).id : String(link.source);
    const tgtId = typeof link.target === "object" ? (link.target as GraphNode).id : String(link.target);
    return (hoverNodeRef.current && (srcId === hoverNodeRef.current || tgtId === hoverNodeRef.current)) ? 3 : 0;
  };

  const handleNodeHover = useCallback((nodeObj: object | null) => {
    const node = nodeObj as GraphNode | null;
    const newHoverId = node ? node.id : null;
    if (hoverNodeRef.current !== newHoverId) {
      hoverNodeRef.current = newHoverId;
      updateVisualState(true);
    }
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'grab';
    }
  }, [updateVisualState]);

  // Memoizar constantes para evitar re-render
  const linkParticleColor = useMemo(() => () => "rgba(255,255,255,0.7)", []);
  const handleToggleOrphans = useCallback((v: boolean) => setHideOrphans(!v), []);

  if (isLoading) return <GraphSkeleton />;

  return (
    <PageTransition>
      <div ref={containerRef} className="relative w-full h-[calc(100vh-5rem)] rounded-xl overflow-hidden shadow-2xl bg-[#09090b]">
        {data && (
          <GraphControls
            searchValue={graphSearch}
            onSearchChange={handleSearchChange}
            visibleTypes={visibleTypes}
            onToggleType={toggleType}
            hideOrphans={hideOrphans}
            onToggleOrphans={handleToggleOrphans}
            orphanCount={orphanCount}
          />
        )}

        <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Carregando universo...</div>}>
          {filteredData && (
            <ForceGraph3D
              ref={fgRef as React.RefObject<ForceGraphMethods>}
              graphData={filteredData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="#020203"
              
              nodeThreeObject={nodeThreeObject}
              
              linkColor={linkColorCallback}
              linkWidth={linkWidthCallback}
              linkDirectionalParticles={linkParticlesCallback}
              linkDirectionalParticleSpeed={0.015}
              linkDirectionalParticleWidth={1.5}
              linkDirectionalParticleColor={linkParticleColor}
              
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}

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

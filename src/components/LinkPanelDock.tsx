import { LinkPanel } from "@/components/LinkPanel";
import { RelatedSuggestions } from "@/components/RelatedSuggestions";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { EntityType } from "@/types/entities";
import type { EmbedEntityType } from "@/lib/api/embedding";

function toEmbedType(t: EntityType): EmbedEntityType | null {
  if (t === "note" || t === "task" || t === "project") return t;
  if (t === "product") return "produto";
  return null;
}

interface LinkPanelDockProps {
  entityId: string;
  entityType: EntityType;
}

const LINKPANEL_MIN = 220;
const LINKPANEL_MAX = 560;
const LINKPANEL_DEFAULT = 288;

/**
 * Desktop: resizable dock (drag the left edge) with persisted width.
 * Mobile/Tablet: full-width stacked panel below the main content.
 */
export function LinkPanelDock({ entityId, entityType }: LinkPanelDockProps) {
  const [width, setWidth] = useLocalStorage<number>(
    "ui:linkpanel-width",
    LINKPANEL_DEFAULT,
  );

  const embedType = toEmbedType(entityType);

  return (
    <>
      {/* Mobile / tablet: stacked, full width */}
      <div className="w-full lg:hidden flex flex-col gap-3">
        {embedType && <RelatedSuggestions entityType={embedType} entityId={entityId} />}
        <LinkPanel entityId={entityId} entityType={entityType} />
      </div>

      {/* Desktop: resizable, sticky */}
      <div className="hidden lg:flex shrink-0 sticky top-0 self-start max-h-[calc(100vh-2rem)]">
        <ResizeHandle
          side="left"
          width={width}
          onChange={setWidth}
          min={LINKPANEL_MIN}
          max={LINKPANEL_MAX}
          ariaLabel="Redimensionar painel de links"
        />
        <div
          className="overflow-y-auto hidden-scrollbar flex flex-col gap-3"
          style={{ width: `${width}px` }}
        >
          {embedType && <RelatedSuggestions entityType={embedType} entityId={entityId} />}
          <LinkPanel entityId={entityId} entityType={entityType} />
        </div>
      </div>
    </>
  );
}

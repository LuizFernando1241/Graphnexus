import { LinkPanel } from '@/components/LinkPanel'
import type { RadarProduto } from '@/types/radar'

interface PainelConexoesProps {
  produto: RadarProduto
}

/**
 * Conexões do produto — agora usa o mesmo painel de links do restante do app
 * (notas, tarefas, projetos), consumindo `entity_links` via LinkPanel/LinkPicker.
 */
export function PainelConexoes({ produto }: PainelConexoesProps) {
  if (!produto.id) {
    return (
      <p className="text-sm text-muted-foreground">
        Salve o produto para poder criar conexões.
      </p>
    )
  }

  return <LinkPanel entityId={produto.id} entityType="product" />
}

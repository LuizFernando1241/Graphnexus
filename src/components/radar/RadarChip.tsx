import { useEffect, useState } from 'react'
import { Crosshair } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { ScoreBadge } from './ScoreBadge'
import type { DecisionBadge } from '@/types/radar'

interface RadarChipProps {
  entityType: 'note' | 'task' | 'project'
  entityId: string
}

interface ProdutoInfo {
  id: string
  nome: string
  decision: DecisionBadge
  scoreTotal: number
}

export function RadarChip({ entityType, entityId }: RadarChipProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [produto, setProduto] = useState<ProdutoInfo | null>(null)

  useEffect(() => {
    if (!user || !entityId) return
    let mounted = true

    ;(async () => {
      const { data: link } = await supabase
        .from('radar_entity_links')
        .select('produto_id')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!link || !mounted) return

      const { data: p } = await supabase
        .from('radar_produtos')
        .select('id, nome, decision, score_total')
        .eq('id', link.produto_id)
        .maybeSingle()

      if (p && mounted) {
        setProduto({
          id: p.id,
          nome: p.nome,
          decision: p.decision as DecisionBadge,
          scoreTotal: p.score_total ?? 0,
        })
      }
    })()

    return () => {
      mounted = false
    }
  }, [user, entityId, entityType])

  if (!produto) return null

  return (
    <button
      type="button"
      onClick={() => navigate('/radar')}
      className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 hover:bg-muted px-2 py-0.5 text-xs transition-colors"
      title={`Produto no Radar: ${produto.nome}`}
    >
      <Crosshair className="w-3 h-3 text-muted-foreground" />
      <span className="max-w-[120px] truncate text-muted-foreground">
        {produto.nome}
      </span>
      <ScoreBadge decision={produto.decision} size="sm" />
    </button>
  )
}

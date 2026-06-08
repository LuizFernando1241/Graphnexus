import { useMemo } from 'react'
import { gerarSinais } from '@/lib/radar/radarSinais'
import { useRadarProdutos } from './useRadarProdutos'

export function useRadarSinais() {
  const { produtos, isLoading } = useRadarProdutos()

  const sinais = useMemo(() => gerarSinais(produtos), [produtos])
  const urgentes = useMemo(() => sinais.filter((s) => s.urgente), [sinais])

  return { sinais, urgentes, total: sinais.length, isLoading }
}

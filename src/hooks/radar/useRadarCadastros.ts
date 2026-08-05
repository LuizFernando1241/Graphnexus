import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export interface EmpresaSolicitante {
  id: string
  nome: string
  cnpj?: string
  responsavel?: string
  email?: string
  telefone?: string
  endereco?: string
  isDefault: boolean
}

export interface FornecedorCadastro {
  id: string
  nome: string
  empresa?: string
  cnpj?: string
  contato?: string
  email?: string
  telefone?: string
  endereco?: string
  observacoes?: string
}

export type EmpresaInput = Omit<EmpresaSolicitante, 'id' | 'isDefault'> & { isDefault?: boolean }
export type FornecedorInput = Omit<FornecedorCadastro, 'id'>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEmpresa(row: any): EmpresaSolicitante {
  return {
    id: row.id,
    nome: row.nome ?? '',
    cnpj: row.cnpj ?? undefined,
    responsavel: row.responsavel ?? undefined,
    email: row.email ?? undefined,
    telefone: row.telefone ?? undefined,
    endereco: row.endereco ?? undefined,
    isDefault: !!row.is_default,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFornecedor(row: any): FornecedorCadastro {
  return {
    id: row.id,
    nome: row.nome ?? '',
    empresa: row.empresa ?? undefined,
    cnpj: row.cnpj ?? undefined,
    contato: row.contato ?? undefined,
    email: row.email ?? undefined,
    telefone: row.telefone ?? undefined,
    endereco: row.endereco ?? undefined,
    observacoes: row.observacoes ?? undefined,
  }
}

export function useEmpresasSolicitantes() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = ['radar-empresas', user?.id]

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!user) return [] as EmpresaSolicitante[]
      const { data, error } = await db
        .from('radar_empresas')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('nome')
      if (error) throw error
      return (data ?? []).map(mapEmpresa)
    },
    enabled: !!user,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: key })

  const criar = useMutation({
    mutationFn: async (input: EmpresaInput) => {
      if (!user) throw new Error('Não autenticado')
      if (input.isDefault) {
        await db.from('radar_empresas').update({ is_default: false }).eq('user_id', user.id)
      }
      const { data, error } = await db
        .from('radar_empresas')
        .insert({
          user_id: user.id,
          nome: input.nome,
          cnpj: input.cnpj ?? null,
          responsavel: input.responsavel ?? null,
          email: input.email ?? null,
          telefone: input.telefone ?? null,
          endereco: input.endereco ?? null,
          is_default: !!input.isDefault,
        })
        .select()
        .single()
      if (error) throw error
      return mapEmpresa(data)
    },
    onSuccess: invalidate,
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: EmpresaInput }) => {
      if (!user) throw new Error('Não autenticado')
      if (input.isDefault) {
        await db.from('radar_empresas').update({ is_default: false }).eq('user_id', user.id)
      }
      const { data, error } = await db
        .from('radar_empresas')
        .update({
          nome: input.nome,
          cnpj: input.cnpj ?? null,
          responsavel: input.responsavel ?? null,
          email: input.email ?? null,
          telefone: input.telefone ?? null,
          endereco: input.endereco ?? null,
          is_default: !!input.isDefault,
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return mapEmpresa(data)
    },
    onSuccess: invalidate,
  })

  const remover = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Não autenticado')
      const { error } = await db.from('radar_empresas').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return {
    empresas: query.data ?? [],
    isLoading: query.isLoading,
    criarEmpresa: criar.mutateAsync,
    atualizarEmpresa: atualizar.mutateAsync,
    removerEmpresa: remover.mutateAsync,
    isSalvando: criar.isPending || atualizar.isPending,
  }
}

export function useFornecedoresCadastro() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = ['radar-fornecedores', user?.id]

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!user) return [] as FornecedorCadastro[]
      const { data, error } = await db
        .from('radar_fornecedores')
        .select('*')
        .eq('user_id', user.id)
        .order('nome')
      if (error) throw error
      return (data ?? []).map(mapFornecedor)
    },
    enabled: !!user,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: key })

  const payload = (input: FornecedorInput) => ({
    nome: input.nome,
    empresa: input.empresa ?? null,
    cnpj: input.cnpj ?? null,
    contato: input.contato ?? null,
    email: input.email ?? null,
    telefone: input.telefone ?? null,
    endereco: input.endereco ?? null,
    observacoes: input.observacoes ?? null,
  })

  const criar = useMutation({
    mutationFn: async (input: FornecedorInput) => {
      if (!user) throw new Error('Não autenticado')
      const { data, error } = await db
        .from('radar_fornecedores')
        .insert({ user_id: user.id, ...payload(input) })
        .select()
        .single()
      if (error) throw error
      return mapFornecedor(data)
    },
    onSuccess: invalidate,
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: FornecedorInput }) => {
      if (!user) throw new Error('Não autenticado')
      const { data, error } = await db
        .from('radar_fornecedores')
        .update(payload(input))
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return mapFornecedor(data)
    },
    onSuccess: invalidate,
  })

  const remover = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Não autenticado')
      const { error } = await db.from('radar_fornecedores').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return {
    fornecedores: query.data ?? [],
    isLoading: query.isLoading,
    criarFornecedor: criar.mutateAsync,
    atualizarFornecedor: atualizar.mutateAsync,
    removerFornecedor: remover.mutateAsync,
    isSalvando: criar.isPending || atualizar.isPending,
  }
}

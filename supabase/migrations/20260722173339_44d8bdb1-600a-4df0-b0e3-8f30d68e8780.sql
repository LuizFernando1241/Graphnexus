
ALTER TABLE public.radar_produtos
  ADD COLUMN IF NOT EXISTS decisao_final text;

-- Backfill: produtos em 'decisao' viram 'aguardando_decisao' (fila de análise)
UPDATE public.radar_produtos
  SET stage = 'aguardando_decisao'
  WHERE stage = 'decisao';

-- Backfill: produtos 'aprovado' viram 'comprado' (aparecem na página Aprovados)
UPDATE public.radar_produtos
  SET stage = 'comprado'
  WHERE stage = 'aprovado';

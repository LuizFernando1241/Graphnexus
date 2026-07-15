
ALTER TABLE public.radar_produtos
  ADD COLUMN IF NOT EXISTS valores_custom JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.radar_parametros
  ADD COLUMN IF NOT EXISTS pilares_extras JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS descartes_extras JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pilares_visibilidade JSONB NOT NULL DEFAULT '{}'::jsonb;

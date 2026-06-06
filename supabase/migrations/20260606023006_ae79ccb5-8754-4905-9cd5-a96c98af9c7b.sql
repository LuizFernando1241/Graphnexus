
CREATE TABLE public.radar_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  link_ml TEXT,
  preco_venda NUMERIC,
  custo NUMERIC,
  margem NUMERIC,
  visitas_mes NUMERIC,
  vendas_mes NUMERIC,
  concorrentes_full INTEGER,
  is_lancamento BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes TEXT,
  stage TEXT NOT NULL DEFAULT 'prospeccao',
  decisao_motivo TEXT,
  quantidade_pedir INTEGER,
  status_compra TEXT NOT NULL DEFAULT 'a_comprar',
  score_total NUMERIC NOT NULL DEFAULT 0,
  decision TEXT NOT NULL DEFAULT 'descarte',
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_produtos TO authenticated;
GRANT ALL ON public.radar_produtos TO service_role;
ALTER TABLE public.radar_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_produtos" ON public.radar_produtos
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.radar_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.radar_produtos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stage TEXT,
  event TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_historico TO authenticated;
GRANT ALL ON public.radar_historico TO service_role;
ALTER TABLE public.radar_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_historico" ON public.radar_historico
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.radar_parametros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  weights JSONB NOT NULL DEFAULT '{"margem":20,"ticket":20,"demanda":20,"visitas":20,"concorrentes":20}'::jsonb,
  decisao_thresholds JSONB NOT NULL DEFAULT '{"cautela":20,"viavel":30,"excelente":40}'::jsonb,
  auto_descarte JSONB NOT NULL DEFAULT '{"ticketMinimo":30,"faturamentoMinimo":100}'::jsonb,
  faixas JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_parametros TO authenticated;
GRANT ALL ON public.radar_parametros TO service_role;
ALTER TABLE public.radar_parametros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_parametros" ON public.radar_parametros
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.radar_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.radar_produtos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_entity_links TO authenticated;
GRANT ALL ON public.radar_entity_links TO service_role;
ALTER TABLE public.radar_entity_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_entity_links" ON public.radar_entity_links
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER radar_produtos_updated_at
  BEFORE UPDATE ON public.radar_produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER radar_parametros_updated_at
  BEFORE UPDATE ON public.radar_parametros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX radar_produtos_user_idx ON public.radar_produtos(user_id);
CREATE INDEX radar_historico_produto_idx ON public.radar_historico(produto_id);
CREATE INDEX radar_entity_links_produto_idx ON public.radar_entity_links(produto_id);

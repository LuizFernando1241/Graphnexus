CREATE TABLE public.radar_empresas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cnpj text,
  responsavel text,
  email text,
  telefone text,
  endereco text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_empresas TO authenticated;
GRANT ALL ON public.radar_empresas TO service_role;
ALTER TABLE public.radar_empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_empresas" ON public.radar_empresas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER radar_empresas_updated_at BEFORE UPDATE ON public.radar_empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.radar_fornecedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  empresa text,
  cnpj text,
  contato text,
  email text,
  telefone text,
  endereco text,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_fornecedores TO authenticated;
GRANT ALL ON public.radar_fornecedores TO service_role;
ALTER TABLE public.radar_fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_fornecedores" ON public.radar_fornecedores FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER radar_fornecedores_updated_at BEFORE UPDATE ON public.radar_fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_radar_empresas_user ON public.radar_empresas(user_id);
CREATE INDEX idx_radar_fornecedores_user ON public.radar_fornecedores(user_id);

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================
-- entity_embeddings
-- =============================================
CREATE TABLE public.entity_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('note','task','project','produto')),
  entity_id uuid NOT NULL,
  content_hash text NOT NULL,
  content_preview text,
  embedding vector(1536) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX entity_embeddings_user_idx ON public.entity_embeddings(user_id);
CREATE INDEX entity_embeddings_type_idx ON public.entity_embeddings(entity_type);
CREATE INDEX entity_embeddings_vec_idx ON public.entity_embeddings
  USING hnsw (embedding vector_cosine_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_embeddings TO authenticated;
GRANT ALL ON public.entity_embeddings TO service_role;
ALTER TABLE public.entity_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entity_embeddings_own" ON public.entity_embeddings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- link_suggestions
-- =============================================
CREATE TABLE public.link_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('note','task','project','produto')),
  source_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('note','task','project','produto')),
  target_id uuid NOT NULL,
  score numeric NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Canonical pair to avoid mirrored duplicates (a->b and b->a)
CREATE UNIQUE INDEX link_suggestions_pair_uidx ON public.link_suggestions (
  user_id,
  LEAST(source_type || ':' || source_id::text, target_type || ':' || target_id::text),
  GREATEST(source_type || ':' || source_id::text, target_type || ':' || target_id::text)
);
CREATE INDEX link_suggestions_user_status_idx ON public.link_suggestions(user_id, status);
CREATE INDEX link_suggestions_source_idx ON public.link_suggestions(source_type, source_id);
CREATE INDEX link_suggestions_target_idx ON public.link_suggestions(target_type, target_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_suggestions TO authenticated;
GRANT ALL ON public.link_suggestions TO service_role;
ALTER TABLE public.link_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "link_suggestions_own" ON public.link_suggestions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_link_suggestions_updated_at
  BEFORE UPDATE ON public.link_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- match_entities: similarity search for current user
-- =============================================
CREATE OR REPLACE FUNCTION public.match_entities(
  query_embedding vector(1536),
  match_count int DEFAULT 10,
  exclude_type text DEFAULT NULL,
  exclude_id uuid DEFAULT NULL
)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  content_preview text,
  similarity float
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    e.entity_type,
    e.entity_id,
    e.content_preview,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.entity_embeddings e
  WHERE e.user_id = auth.uid()
    AND (exclude_type IS NULL OR exclude_id IS NULL OR NOT (e.entity_type = exclude_type AND e.entity_id = exclude_id))
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

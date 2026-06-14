CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_entity_embedding(
  p_entity_type text,
  p_entity_id uuid,
  p_content_hash text,
  p_content_preview text,
  p_embedding double precision[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  embedding_dims integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_entity_type NOT IN ('note', 'task', 'project', 'produto') THEN
    RAISE EXCEPTION 'Invalid entity_type';
  END IF;

  embedding_dims := COALESCE(array_length(p_embedding, 1), 0);
  IF embedding_dims <> 1536 THEN
    RAISE EXCEPTION 'Invalid embedding dimensions: expected 1536, got %', embedding_dims;
  END IF;

  INSERT INTO public.entity_embeddings (
    user_id,
    entity_type,
    entity_id,
    content_hash,
    content_preview,
    embedding,
    updated_at
  )
  VALUES (
    auth.uid(),
    p_entity_type,
    p_entity_id,
    p_content_hash,
    p_content_preview,
    p_embedding::extensions.vector(1536),
    now()
  )
  ON CONFLICT (entity_type, entity_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    content_hash = EXCLUDED.content_hash,
    content_preview = EXCLUDED.content_preview,
    embedding = EXCLUDED.embedding,
    updated_at = now()
  WHERE public.entity_embeddings.user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_entity_embedding(text, uuid, text, text, double precision[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_entity_embedding(text, uuid, text, text, double precision[]) TO service_role;

CREATE OR REPLACE FUNCTION public.match_entities(
  query_embedding extensions.vector(1536),
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
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

GRANT EXECUTE ON FUNCTION public.match_entities(extensions.vector, int, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_entities(extensions.vector, int, text, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
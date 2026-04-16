import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateAllEntities } from "@/lib/cache";

export function useAutoTriage() {
  const queryClient = useQueryClient();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    supabase.rpc("auto_triage_tasks").then(({ error }) => {
      if (!error) {
        invalidateAllEntities(queryClient);
      }
    });
  }, [queryClient]);
}

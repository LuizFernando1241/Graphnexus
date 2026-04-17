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

    supabase
      .rpc("auto_triage_tasks")
      .then(({ error }) => {
        if (error) {
          console.error("auto_triage_tasks RPC error:", error);
          return;
        }
        invalidateAllEntities(queryClient);
      })
      .then(undefined, (err) => {
        console.error("auto_triage_tasks unexpected error:", err);
      });
  }, [queryClient]);
}

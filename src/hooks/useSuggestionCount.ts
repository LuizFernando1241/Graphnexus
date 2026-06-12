import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePendingSuggestionCount() {
  return useQuery({
    queryKey: ["link-suggestions-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("link_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

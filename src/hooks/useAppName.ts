import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAppName() {
  const q = useQuery({
    queryKey: ["app-name"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("app_name")
        .maybeSingle();
      if (error) throw error;
      return data?.app_name ?? "";
    },
  });
  return (q.data ?? "").trim() || "IndicaPro";
}

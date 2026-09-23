import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useWalletSummary(enabled = true) {
  return useQuery({
    queryKey: ["wallet-summary"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wallet_summary");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        available: Number(row?.available_cents ?? 0),
        pending: Number(row?.pending_cents ?? 0),
        total: Number(row?.total_received_cents ?? 0),
        withdrawing: Number(row?.withdrawing_cents ?? 0),
      };
    },
  });
}

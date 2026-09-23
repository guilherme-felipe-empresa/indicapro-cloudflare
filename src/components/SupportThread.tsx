import { Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/money";

export type SupportMessage = {
  id: string;
  sender_type: string;
  message: string;
  is_internal: boolean;
  attachment_path: string | null;
  attachment_name: string | null;
  created_at: string;
};

async function openAttachment(path: string) {
  const { data } = await supabase.storage
    .from("support-attachments")
    .createSignedUrl(path, 60);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
}

export function SupportThread({
  messages,
  viewer = "user",
}: {
  messages: SupportMessage[];
  viewer?: "user" | "admin";
}) {
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const fromAdmin = m.sender_type === "admin";
        const mine = viewer === "admin" ? fromAdmin : !fromAdmin;
        return (
          <li key={m.id} className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] min-w-0 rounded-2xl px-4 py-3 text-sm",
                m.is_internal
                  ? "border border-dashed border-amber-500/60 bg-amber-500/10 text-foreground"
                  : mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
              )}
            >
              <p className="mb-1 text-[11px] font-semibold opacity-80">
                {m.is_internal
                  ? "Nota interna"
                  : fromAdmin
                    ? viewer === "admin"
                      ? "Suporte (você)"
                      : "Suporte"
                    : viewer === "admin"
                      ? "Usuário"
                      : "Você"}
              </p>
              <p className="whitespace-pre-wrap break-words">{m.message}</p>
              {m.attachment_path && (
                <button
                  type="button"
                  onClick={() => void openAttachment(m.attachment_path!)}
                  className="mt-2 flex items-center gap-1.5 text-xs underline underline-offset-2"
                >
                  <Paperclip className="size-3.5" />
                  {m.attachment_name ?? "Anexo"}
                </button>
              )}
              <p className="mt-1.5 text-[11px] opacity-70">{formatDate(m.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

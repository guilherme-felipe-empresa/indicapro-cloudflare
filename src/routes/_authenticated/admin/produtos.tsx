import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { commissionCents, formatBRL, parseBRLToCents, type CommissionType } from "@/lib/money";
import type { Product } from "@/components/ProductCard";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Administração IndicaPro" },
      { name: "description", content: "Cadastre e edite produtos, preços, comissões e status." },
      { property: "og:title", content: "Produtos — Administração IndicaPro" },
      { property: "og:description", content: "Cadastre e edite produtos, preços e comissões." },
    ],
  }),
  component: AdminProducts,
});

type FormState = {
  name: string;
  description: string;
  image_url: string;
  category: string;
  price: string;
  commission_type: CommissionType;
  commission: string;
  active: boolean;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  image_url: "",
  category: "",
  price: "",
  commission_type: "fixed",
  commission: "",
  active: true,
};

const CATEGORIAS_SUGERIDAS = [
  "Assinaturas",
  "Cursos",
  "Infoprodutos",
  "Serviços",
  "Produtos físicos",
  "Aplicativos",
];

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

function AdminProducts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    if (uploading) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 10 MB.");
      return;
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) {
      toast.error("Não foi possível enviar a foto.");
      return;
    }
    setForm((f) => ({ ...f, image_url: `/api/public/product-image/${path}` }));
    toast.success("Foto enviada!");
  }

  const list = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const categoriasExistentes = Array.from(
    new Set([
      ...(list.data ?? []).map((p) => (p.category ?? "").trim()).filter(Boolean),
      ...CATEGORIAS_SUGERIDAS,
    ]),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  function startNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function startEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description,
      image_url: p.image_url ?? "",
      category: p.category ?? "",
      price: (p.price_cents / 100).toFixed(2).replace(".", ","),
      commission_type: p.commission_type,
      commission:
        p.commission_type === "fixed"
          ? (p.commission_value / 100).toFixed(2).replace(".", ",")
          : (p.commission_value / 100).toString().replace(".", ","),
      active: p.active,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const price_cents = parseBRLToCents(form.price);
    const commission_value =
      form.commission_type === "fixed"
        ? parseBRLToCents(form.commission)
        : Math.round(Number(form.commission.replace(",", ".")) * 100);
    if (!form.name.trim() || price_cents <= 0) {
      toast.error("Informe nome e preço válidos.");
      return;
    }
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      image_url: form.image_url.trim() || null,
      category: form.category.trim() || "Geral",
      price_cents,
      commission_type: form.commission_type,
      commission_value,
      active: form.active,
    };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase
          .from("products")
          .insert({ ...payload, slug: `${slugify(form.name)}-${Date.now().toString(36).slice(-4)}` });
    setBusy(false);
    if (error) { toast.error("Não foi possível salvar o produto."); return; }
    toast.success(editing ? "Produto atualizado!" : "Produto cadastrado!");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function toggleActive(p: Product) {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) { toast.error("Não foi possível alterar o status."); return; }
    toast.success(p.active ? "Produto desativado." : "Produto ativado.");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function confirmDelete() {
    const p = toDelete;
    if (!p || deleting) return;
    setDeleting(true);
    const { data, error } = await supabase.rpc("admin_delete_product", { _id: p.id });
    setDeleting(false);
    setToDelete(null);
    if (error) {
      const msg = String(error.message || "");
      if (msg.includes("histórico")) {
        toast.error("Este produto já tem indicações ou vendas. Ele foi desativado no lugar de apagado.");
      } else {
        toast.error("Não foi possível excluir o produto.");
      }
    } else {
      const prefix = "/api/public/product-image/";
      if (typeof data === "string" && data.startsWith(prefix)) {
        await supabase.storage.from("product-images").remove([data.slice(prefix.length)]);
      }
      toast.success("Produto excluído.");
    }
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="h-12 w-full sm:w-auto" onClick={startNew}>
            Novo produto
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p-name">Nome</Label>
              <Input id="p-name" className="h-12" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">Descrição</Label>
              <Textarea id="p-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-cat">Categoria</Label>
              <Input
                id="p-cat"
                className="h-12"
                list="categorias-existentes"
                placeholder="Ex.: Assinaturas"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="categorias-existentes">
                {categoriasExistentes.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-2">
                {categoriasExistentes.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: c }))}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Escolha uma categoria existente ou digite uma nova. Se deixar em branco, o produto
                entra em "Geral".
              </p>
            </div>
            <div className="space-y-2">
              <Label>Foto do produto</Label>
              {form.image_url ? (
                <div className="flex items-center gap-3">
                  <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <img src={form.image_url} alt="Pré-visualização" className="size-full object-cover" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => setForm({ ...form, image_url: "" })}
                  >
                    Remover foto
                  </Button>
                </div>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadImage(f);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                className="h-12 w-full"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? "Enviando foto..." : form.image_url ? "Trocar foto" : "Escolher foto"}
              </Button>
              <Label htmlFor="p-img" className="text-xs text-muted-foreground">
                Ou cole o endereço de uma imagem da internet
              </Label>
              <Input id="p-img" className="h-12" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-price">Preço (R$)</Label>
              <Input id="p-price" inputMode="decimal" className="h-12" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de comissão</Label>
              <Select
                value={form.commission_type}
                onValueChange={(v) => setForm({ ...form, commission_type: v as CommissionType })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-comm">
                {form.commission_type === "fixed" ? "Comissão (R$)" : "Comissão (%)"}
              </Label>
              <Input id="p-comm" inputMode="decimal" className="h-12" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="p-active">Produto ativo</Label>
              <Switch id="p-active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <Button type="submit" className="h-12 w-full" disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {list.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : list.data && list.data.length > 0 ? (
        <div className="space-y-3">
          {list.data.map((p) => (
            <div key={p.id} className="surface-card flex gap-3 p-3">
              <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" className="size-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.name}</p>
                {p.category ? (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {p.category}
                  </p>
                ) : null}
                <p className="text-sm font-semibold">{formatBRL(p.price_cents)}</p>
                <p className="text-xs text-muted-foreground">
                  Comissão:{" "}
                  {p.commission_type === "fixed"
                    ? formatBRL(p.commission_value)
                    : `${p.commission_value / 100}% (${formatBRL(commissionCents(p.price_cents, p.commission_type, p.commission_value))})`}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" className="h-9" onClick={() => startEdit(p)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="secondary" className="h-9" onClick={() => toggleActive(p)}>
                    {p.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-9"
                    onClick={() => setToDelete(p)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="surface-card p-6 text-center text-sm text-muted-foreground">
          Nenhum produto cadastrado.
        </p>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.name} será apagado de vez. Se ele já tiver indicações ou vendas, não será
              possível apagar e ele ficará apenas desativado, para preservar o histórico de
              comissões.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

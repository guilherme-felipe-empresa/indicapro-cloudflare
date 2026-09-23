alter table public.products add column if not exists category text not null default 'Geral';
create index if not exists products_category_idx on public.products (category);
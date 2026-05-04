-- ============================================================
-- Supersale.ph — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. STORES
create table if not exists stores (
  id         text primary key,           -- e.g. "SM-IMUS-001"
  name       text not null,
  address    text,
  created_at timestamptz default now()
);

-- 2. DEALS  (discount catalog per store)
create table if not exists deals (
  id           bigint generated always as identity primary key,
  store_id     text references stores(id) on delete cascade,
  name         text not null,
  category     text default 'General',
  emoji        text default '🛒',
  sale_price   numeric(10,2) not null,
  orig_price   numeric(10,2) not null,
  photo_url    text,                      -- Supabase Storage public URL
  aisle        text,
  published    boolean default true,
  created_at   timestamptz default now()
);

-- 3. RESTOCK REQUESTS (customer demand signals)
create table if not exists restock_requests (
  id           bigint generated always as identity primary key,
  store_id     text references stores(id) on delete cascade,
  product_name text not null,
  quantity     int default 1 check (quantity between 1 and 5),
  phone        text not null,
  restocked    boolean default false,
  restocked_at timestamptz,
  created_at   timestamptz default now()
);

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table stores           enable row level security;
alter table deals             enable row level security;
alter table restock_requests  enable row level security;

-- Stores: public read
create policy "stores_public_read" on stores
  for select using (true);

-- Deals: public read (published only)
create policy "deals_public_read" on deals
  for select using (published = true);

-- Deals: anyone can insert (staff upload — add auth later)
create policy "deals_public_insert" on deals
  for insert with check (true);

-- Deals: update by same store (for restocking toggle)
create policy "deals_update" on deals
  for update using (true);

-- Requests: anyone can insert (customers)
create policy "requests_public_insert" on restock_requests
  for insert with check (true);

-- Requests: public read (for dashboard)
create policy "requests_public_read" on restock_requests
  for select using (true);

-- Requests: update (mark as restocked)
create policy "requests_update" on restock_requests
  for update using (true);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_deals_store      on deals (store_id, created_at desc);
create index if not exists idx_requests_store   on restock_requests (store_id, product_name);
create index if not exists idx_requests_product on restock_requests (product_name, restocked);

-- ============================================================
-- Seed: sample stores
-- ============================================================
insert into stores (id, name, address) values
  ('SM-IMUS-001',    'SM Hypermarket – Imus',         'SM City Imus, Emilio Aguinaldo Hwy, Imus, Cavite'),
  ('SM-CAVITE-02',   'SM Savemore – Bacoor',          'Molino Blvd, Bacoor, Cavite'),
  ('PUREGOLD-IMUS',  'Puregold – Imus',               'Bayan Luma, Imus, Cavite'),
  ('ROBINSONS-CIV',  'Robinsons Supermarket – Dasmariñas', 'Robinsons Place Dasmariñas, Cavite')
on conflict (id) do nothing;

-- ============================================================
-- Supabase Storage: create bucket for shelf photos
-- (Run this once, or create via Dashboard > Storage)
-- ============================================================
-- insert into storage.buckets (id, name, public)
-- values ('shelf-photos', 'shelf-photos', true)
-- on conflict do nothing;

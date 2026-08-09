-- ============================================================
-- foodie: schema for restaurants, menu items, and orders
-- Run this first in Supabase SQL Editor, then run supabase_seed.sql
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists restaurants (
  id text primary key,                 -- short slug, e.g. 'milan'
  name text not null,
  area text not null,
  cuisine text not null,
  rating numeric(2,1) not null default 4.0,
  delivery_time text not null,
  price_for_two int not null,
  emoji text default '🍽️',
  created_at timestamptz default now()
);

create table if not exists menu_items (
  id text primary key,                 -- slug, e.g. 'milan_dal_makhani'
  restaurant_id text not null references restaurants(id) on delete cascade,
  name text not null,
  price int,                           -- null when has_size = true
  veg boolean not null default true,
  has_size boolean not null default false,
  size_prices jsonb,                   -- e.g. {"S":99,"M":129,"L":159}
  aliases text[] not null default '{}', -- spoken variants for voice matching
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text references restaurants(id),
  total int not null,
  status text not null default 'placed',
  created_at timestamptz default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_id text references menu_items(id),
  item_name text not null,
  size text,
  qty int not null,
  unit_price int not null
);

-- ---- Row Level Security ----
-- Demo-friendly policies: anyone can read the menu, anyone can place an order.
-- Tighten this before this is ever a real production app with real payments.
alter table restaurants enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "public read restaurants" on restaurants
  for select using (true);

create policy "public read menu_items" on menu_items
  for select using (true);

create policy "public insert orders" on orders
  for insert with check (true);

create policy "public read orders" on orders
  for select using (true);

create policy "public insert order_items" on order_items
  for insert with check (true);

create policy "public read order_items" on order_items
  for select using (true);

-- Helpful index for the common "get everything for this restaurant" query
create index if not exists idx_menu_items_restaurant on menu_items(restaurant_id);
create index if not exists idx_order_items_order on order_items(order_id);

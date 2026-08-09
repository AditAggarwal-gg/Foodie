-- ============================================================
-- foodie: auth upgrade — run this once in Supabase SQL Editor
-- Adds order ownership so "My Orders" only shows a user's own history.
-- Safe to run even if you already have orders/order_items data —
-- existing rows just get user_id = null (treated as guest orders).
-- ============================================================

alter table orders add column if not exists user_id uuid references auth.users(id);

-- Replace the old "anyone can read/write everything" policies with ownership-aware ones.
drop policy if exists "public insert orders" on orders;
drop policy if exists "public read orders" on orders;
drop policy if exists "public insert order_items" on order_items;
drop policy if exists "public read order_items" on order_items;

-- Orders: a signed-in user can only insert/read their own orders.
-- Guests (not signed in) can still place an order with user_id = null,
-- but won't be able to read it back later (no identity to match against) —
-- which is expected: order history requires being signed in.
create policy "insert own or guest orders" on orders
  for insert with check (user_id is null or auth.uid() = user_id);

create policy "read own orders" on orders
  for select using (auth.uid() = user_id);

-- Order items: visibility follows the parent order's ownership.
create policy "insert items for own or guest orders" on order_items
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.user_id is null or auth.uid() = o.user_id)
    )
  );

create policy "read items for own orders" on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and auth.uid() = o.user_id
    )
  );

-- ============================================================
-- 訂位管理系統 — Supabase 建表 SQL
-- 使用方式:貼進 Supabase → SQL Editor → Run
-- ============================================================

-- 1. 使用者資料 (linked to Supabase Auth)
create table profiles (
  id   uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz default now()
);

-- 新使用者登入時自動建立 profile
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'staff'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. 菜單
create table menus (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- 3. 菜色
create table menu_items (
  id         uuid primary key default gen_random_uuid(),
  menu_id    uuid references menus(id) on delete cascade not null,
  name       text not null,
  price      integer not null default 0,
  sort_order integer not null default 0,
  note       text
);

-- 4. 訂單
create table orders (
  id            uuid primary key default gen_random_uuid(),
  order_date    date not null default current_date,
  confirmed     boolean default false,
  time_text     text,
  table_no      text,
  customer_name text,
  unit_price    integer not null default 0,
  quantity      integer not null default 1,
  adjustments   jsonb default '[]'::jsonb,  -- [{name, amount}]
  phone         text,
  note          text,
  menu_id       uuid references menus(id) on delete set null,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- updated_at 自動更新
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

-- 5. Row Level Security (只有登入的使用者可以存取)
alter table profiles  enable row level security;
alter table orders    enable row level security;
alter table menus     enable row level security;
alter table menu_items enable row level security;

create policy "profiles: 登入使用者可讀取"
  on profiles for select to authenticated using (true);
create policy "profiles: 只能更新自己"
  on profiles for update to authenticated using (auth.uid() = id);

create policy "orders: 登入使用者完整存取"
  on orders for all to authenticated using (true) with check (true);

create policy "menus: 登入使用者完整存取"
  on menus for all to authenticated using (true) with check (true);

create policy "menu_items: 登入使用者完整存取"
  on menu_items for all to authenticated using (true) with check (true);

-- 6. 預設菜單
insert into menus (name, is_default) values ('標準喜宴菜單', true);

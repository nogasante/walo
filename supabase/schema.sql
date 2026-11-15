-- Walɔ: Supabase schema for the optional backup and the daily AI budget.
--
-- This file is the source of truth for project yceufknddlcrezefaivi. Before it existed, the
-- table, its row-level security policies and the storage policies were dashboard-only state:
-- they could not be reviewed, diffed, or restored if the project was ever recreated.
--
-- It describes the project as it actually is (checked on 14 Nov 2026): the table and policies
-- were created in the dashboard, then written down here. Apply it in the Supabase dashboard
-- (SQL Editor -> paste -> Run) or with the Supabase CLI. It is idempotent: running it twice
-- changes nothing and never duplicates a policy.
--
-- Nothing here contains a secret. The browser uses only the publishable key in app/data/app.json.

-- ---------------------------------------------------------------------------
-- 1. Fields: one row per field per person, plus one "settings" row per person
--    (app/data/app.json -> backup.settings_id) that keeps the main crop choice.
--    id is a uuid because js/store.js generates field ids with crypto.randomUUID().
-- ---------------------------------------------------------------------------

create table if not exists public.fields (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         uuid        not null,                    -- the field's uid from crypto.randomUUID(), or the settings id
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,      -- a removed field stays as a tombstone so it stays removed
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- A field record must stay small: photos live in the bucket, not in this row.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fields_data_size' and conrelid = 'public.fields'::regclass
  ) then
    alter table public.fields add constraint fields_data_size check (pg_column_size(data) < 200000);
  end if;
end $$;

alter table public.fields enable row level security;

-- Four policies, all "your own rows only". No policy grants anything to anon:
-- an unauthenticated request sees and writes nothing.
drop policy if exists "fields: owner can read"   on public.fields;
drop policy if exists "fields: owner can add"    on public.fields;
drop policy if exists "fields: owner can change" on public.fields;
drop policy if exists "fields: owner can remove" on public.fields;

create policy "fields: owner can read" on public.fields
  for select to authenticated using (auth.uid() = user_id);

create policy "fields: owner can add" on public.fields
  for insert to authenticated with check (auth.uid() = user_id);

create policy "fields: owner can change" on public.fields
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "fields: owner can remove" on public.fields
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Field photos: a private bucket, one folder per person: <user id>/<field uid>/<photo>.jpg
--    js/sync.js writes exactly that path, so the first folder is the owner.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('field-photos', 'field-photos', false, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png'];

drop policy if exists "field-photos: owner can read"    on storage.objects;
drop policy if exists "field-photos: owner can upload"  on storage.objects;
drop policy if exists "field-photos: owner can replace" on storage.objects;
drop policy if exists "field-photos: owner can delete"  on storage.objects;

create policy "field-photos: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'field-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "field-photos: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'field-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "field-photos: owner can replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'field-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'field-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "field-photos: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'field-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 3. Daily AI budget: a hard cap on Gemini calls across all server instances.
--
--    Why this exists: the per-IP limit in api/diagnose.js and api/help.js lives in the memory of
--    one warm serverless instance, so N instances allow N times the limit and a restarted instance
--    forgets everything. The key is a real bill. This counter survives restarts and is shared.
--
--    The cap is a CONSTANT INSIDE THE FUNCTION, never an argument: the browser holds the publishable
--    key and can call this function, so a cap supplied by the caller would be a cap an attacker sets.
--
--    Trade-off, stated plainly: anyone who can call this function can spend the day's budget and
--    stop AI answers for everyone else until midnight UTC. That is a cheaper failure than an
--    unbounded bill, and the per-IP limit still runs first.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_budget (
  day  date    primary key,
  hits integer not null default 0
);

alter table public.ai_budget enable row level security;
-- No policies on purpose: nobody reads or writes this table directly. Only the function below may
-- (it runs as its owner), so row-level security keeps it closed to anon and authenticated alike.

create or replace function public.walo_ai_hit()
returns table (allowed boolean, used integer, cap integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Change this one number to raise or lower the daily cap for the whole project.
  v_cap  constant integer := 400;
  v_used integer;
begin
  -- keep the table small; it is a counter, not a history
  delete from public.ai_budget where day < (now() at time zone 'utc')::date - 7;

  insert into public.ai_budget as b (day, hits)
  values ((now() at time zone 'utc')::date, 1)
  on conflict (day) do update set hits = b.hits + 1
  returning b.hits into v_used;

  return query select v_used <= v_cap, v_used, v_cap;
end;
$$;

revoke all on function public.walo_ai_hit() from public;
grant execute on function public.walo_ai_hit() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Checks you can run after applying this file
-- ---------------------------------------------------------------------------
--   select * from public.walo_ai_hit();            -- allowed=t, used=1, cap=400
--   select relname, relrowsecurity from pg_class where relname in ('fields', 'ai_budget');
--     -- both should be t
--   select tablename, policyname from pg_policies where schemaname = 'public';
--     -- exactly four, all "fields: owner can ..."
--   select id, public from storage.buckets where id = 'field-photos';
--     -- public = f

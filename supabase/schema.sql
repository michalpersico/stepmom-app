-- Matches hosted migration stepmom_private_object_store. Do not rerun on a populated project.
create table public.stepmom_objects (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
alter table public.stepmom_objects enable row level security;
revoke all on public.stepmom_objects from anon, authenticated;
grant select,insert,update,delete on public.stepmom_objects to service_role;

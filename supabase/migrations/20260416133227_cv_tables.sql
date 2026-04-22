create table user_cv_defaults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  header jsonb not null default '{}',
  sections jsonb not null default '{}',
  section_titles jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint user_cv_defaults_user_id_unique unique (user_id)
);

-- Auto-update updated_at
create or replace function update_user_cv_defaults_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_cv_defaults_updated_at
before update on user_cv_defaults
for each row
execute function update_user_cv_defaults_updated_at();

-- RLS
alter table user_cv_defaults enable row level security;

create policy "Users can read own cv defaults"
  on user_cv_defaults for select
  using (auth.uid() = user_id);

create policy "Users can insert own cv defaults"
  on user_cv_defaults for insert
  with check (auth.uid() = user_id);

create policy "Users can update own cv defaults"
  on user_cv_defaults for update
  using (auth.uid() = user_id);

create policy "Users can delete own cv defaults"
  on user_cv_defaults for delete
  using (auth.uid() = user_id);

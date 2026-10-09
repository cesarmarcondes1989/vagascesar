-- Radar de Vagas · schema inicial
-- Rode no Supabase: SQL Editor → New query → cole tudo → Run.

create extension if not exists "pgcrypto";

-- Perfil (1 linha por usuário)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  description text,
  levels text[] default '{}',
  cv_file_name text,
  cv_text text,
  extracted_skills text[] default '{}',
  suggested_roles jsonb default '[]'::jsonb,
  search_prefs jsonb,
  updated_at timestamptz not null default now()
);

-- Vagas salvas (estruturadas pela IA)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  external_id text not null,
  title text not null,
  company text not null,
  city text,
  region text,
  mode text,
  source text,
  posted text,
  salary text,
  url text,
  match int,
  summary text,
  resp text[] default '{}',
  req text[] default '{}',
  dif text[] default '{}',
  benef text[] default '{}',
  keywords text[] default '{}',
  strengths text[] default '{}',
  gaps text[] default '{}',
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

-- Candidatura (1 por vaga)
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  stage text not null default 'salva',
  custom_stage text,
  cv_extras text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Histórico de fases (inclui reprovação com justificativa e aprendizados)
create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  stage text not null,
  custom_stage text,
  event_date date not null default current_date,
  note text,
  reason text,
  lessons jsonb,
  created_at timestamptz not null default now()
);

-- Versões do CV sob medida
create table if not exists public.cv_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now()
);

-- Conversa com o copiloto
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  options jsonb,
  chosen int,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_app on public.application_events (application_id, event_date);
create index if not exists idx_chat_app on public.chat_messages (application_id, created_at);
create index if not exists idx_cv_app on public.cv_versions (application_id, created_at desc);

-- RLS: cada usuário só enxerga e altera o que é dele
do $$
declare t text;
begin
  foreach t in array array['profiles','jobs','applications','application_events','cv_versions','chat_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

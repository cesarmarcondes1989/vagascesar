-- Radar de Vagas · 0003
-- 1) Garante o "sem login" (idempotente: pode rodar mesmo se a 0002 já rodou).
-- 2) Guarda a última busca no perfil, para não perder os resultados ao sair da tela.

do $$
declare t text;
begin
  foreach t in array array['profiles','jobs','applications','application_events','cv_versions','chat_messages'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_user_id_fkey');
    execute format('alter table public.%I alter column user_id set default %L::uuid', t, '00000000-0000-0000-0000-000000000001');
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
  end loop;
end $$;

alter table public.profiles add column if not exists last_search jsonb;

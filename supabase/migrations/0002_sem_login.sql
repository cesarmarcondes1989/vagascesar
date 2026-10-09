-- Radar de Vagas · remove a dependência do login (Supabase Auth).
-- O app agora fala com o banco só pelo servidor, com a service role key, e todas as linhas
-- pertencem a um dono fixo. Rode no SQL Editor depois da 0001.

do $$
declare t text;
begin
  foreach t in array array['profiles','jobs','applications','application_events','cv_versions','chat_messages'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_user_id_fkey');
    execute format('alter table public.%I alter column user_id set default %L::uuid', t, '00000000-0000-0000-0000-000000000001');
  end loop;
end $$;

-- RLS continua ligado e sem políticas para o público: a chave anon não lê nada.
-- A service role (usada só no servidor) ignora RLS.
do $$
declare t text;
begin
  foreach t in array array['profiles','jobs','applications','application_events','cv_versions','chat_messages'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
  end loop;
end $$;

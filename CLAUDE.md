# CLAUDE.md · Radar de vagas

App pessoal (single-user) do Cesar: busca vagas com IA, gera CV sob medida, copiloto de candidatura e funil de candidaturas com aprendizados de reprovação. Textos da UI em **português do Brasil**.

## Comandos
- `npm run dev`: dev server
- `npm run build`: build de produção (rode antes de dar push)
- `npm run lint` / `npx tsc --noEmit`

## Arquitetura
- `src/app/page.tsx`: **Minhas vagas** (tela inicial, kanban + reprovações). Server component.
- `src/app/perfil`, `src/app/buscar`, `src/app/candidatura/[id]`: página server (carrega do Supabase) + `*Client.tsx` (interação).
- `src/app/api/**`: route handlers. Todos usam `requireUser()` de `src/lib/supabase/server.ts`, que devolve o client com service role e o dono fixo `OWNER_ID` (app single-user, **sem login**).
- `src/lib/ai.ts`: **todas** as chamadas ao Claude. Padrão: `structured()` força uma tool call e devolve JSON tipado. Modelo via `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`). PDF do CV vai como bloco `document` base64.
- `src/lib/jobs-source.ts`: SerpAPI Google Jobs. Sem `SERPAPI_KEY` → vagas demo. Consultas = cargos × locais, limitadas por `MAX_QUERIES_PER_SEARCH`.
- `src/lib/constants.ts`: regiões de SP e cidades, fontes, fases (`STAGES`, `FLOW`, `COLS`).
- `src/middleware.ts`: só ativa se `APP_PASSWORD` existir: senha simples via cookie (`src/lib/gate.ts`). Sem Supabase Auth (o magic link estourava o limite de e-mails).
- `supabase/migrations/`: schema. Tabelas: `profiles`, `jobs`, `applications`, `application_events`, `cv_versions`, `chat_messages`. RLS ligado sem políticas (acesso só via service role no servidor); `user_id` = `OWNER_ID`. **Mudou schema? Crie nova migration numerada**, não edite a 0001.

- `src/lib/health.ts` + `src/components/SetupBanner.tsx`: checa env, chave errada (anon no lugar da service role) e migrations pendentes; aviso no topo de toda tela.
- Perfil salva sozinho (autosave ~1s). A última busca fica em `profiles.last_search`; cargos digitados à mão entram em `suggested_roles`.

## Design
- Paleta azul, **sem preto** (pedido explícito): tokens em `src/app/globals.css` (`brand` #1D4ED8, `brand-deep` #1E3A8A, `ink` #0F1E3D só para texto). Laranja (`warn`) só para alertas: reprovação, gaps, "aposta ousada".
- Fontes: IBM Plex Sans/Mono + Space Grotesk (display), via `@fontsource` (não usar `next/font/google`).
- Classes utilitárias de componente: `.btn`, `.btn-ghost`, `.chip`, `.chip-on`, `.card`, `.field`, `.lbl`, `.eyebrow`, `.kw`, `.h1`.
- Protótipo de referência: `docs/prototipo-radar.dc.html` (todas as telas, dados fictícios).

## Regras
- Nunca invente dados da pessoa nos prompts: números desconhecidos viram `[colchetes]`.
- Chaves só em env vars (Vercel / `.env.local`). Nunca commitar segredos.
- Rotas que chamam IA têm `export const maxDuration`.

## Roadmap (próximos passos)
- [ ] Busca agendada diária (Vercel Cron) com alerta de vagas novas acima de X% de aderência
- [ ] Usar aprendizados das reprovações para ajustar o `match` de vagas parecidas
- [ ] Exportar CV em .docx
- [ ] Editar/excluir eventos do histórico; arquivar candidaturas
- [ ] Streaming na resposta do copiloto
- [ ] Ler as páginas públicas da Gupy direto como fonte extra

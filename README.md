# Radar · vagas

App pessoal para buscar vagas com IA, montar o CV sob medida para cada uma e acompanhar as candidaturas até o fim, incluindo o que aprender com cada reprovação.

**Stack:** Next.js 15 (App Router) · Tailwind v4 · Supabase (Postgres + Auth + RLS) · Claude API · SerpAPI Google Jobs · Vercel

## Fluxo

1. **Minhas vagas** (`/`): tela inicial. Quadro por fase (Salvas → Aplicadas → Entrevistas → Proposta → Reprovadas) e painel com os aprendizados das reprovações.
2. **Perfil** (`/perfil`): sobe o CV em PDF (o Claude lê direto o PDF), descrição livre, senioridade. A IA sugere cargos.
3. **Buscar** (`/buscar`): checkbox de cargos, regiões de SP / cidades, fontes, modelo de trabalho. Busca no Google Jobs, o Claude estrutura cada vaga (resumo, responsabilidades, requisitos, benefícios, pontos fortes, gaps, aderência). "Salvar" grava no Supabase e abre a candidatura.
4. **Candidatura** (`/candidatura/[id]`):
   - **CV sob medida**: gerado pela IA para a vaga, com cobertura de palavras-chave e impressão em PDF.
   - **Copiloto**: chat que devolve 3 versões de resposta; as boas vão pro CV.
   - **Status & histórico**: fases (inclusive "Fase X" com nome livre), datas, notas. Em "Reprovado", a justificativa vira aprendizados gerados pela IA.

## Colocar no ar (≈10 min)

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. **SQL Editor → New query**, cole `supabase/migrations/0001_init.sql` e rode.
3. Rode também `supabase/migrations/0002_sem_login.sql` (o app não usa login do Supabase).
4. **Project Settings → API**: copie *Project URL* e a chave *service_role* (secreta).

### 2. Chaves
- Claude: [console.anthropic.com](https://console.anthropic.com) → API Keys
- SerpAPI: [serpapi.com](https://serpapi.com) (plano grátis ~100 buscas/mês). Opcional: sem ela o app roda em **modo demo**.

### 3. Vercel
1. **Add New → Project →** importe `cesarmarcondes1989/vagascesar`.
2. Em **Environment Variables**, cadastre as variáveis de `.env.example`.
3. Deploy. A cada `git push` na `main` sai um deploy novo.

## Rodar local

```bash
cp .env.example .env.local   # preencha
npm install
npm run dev
```

## Custos e limites
- Cada busca faz até 8 consultas ao SerpAPI (`MAX_QUERIES_PER_SEARCH` em `src/lib/constants.ts`) e manda até 30 vagas para o Claude estruturar.
- Sem login. O banco só é acessado pelo servidor com a service role key; RLS fica ligado sem políticas, então a chave pública não lê nada.
- Quem tiver a URL abre o app. Para fechar, defina `APP_PASSWORD` na Vercel (senha simples, sem e-mail).

## Fontes de vagas
LinkedIn, Glassdoor e Indeed não oferecem API aberta e proíbem raspagem. O Google Jobs (via SerpAPI) agrega anúncios desses sites e de Gupy, Catho, Vagas.com etc., e cada vaga traz o link para candidatura no site original.

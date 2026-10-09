import Anthropic from "@anthropic-ai/sdk";
import type { ChatOption, CvContent, Profile, StructuredJob, SuggestedRole } from "./types";
import type { RawJob } from "./jobs-source";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

let _client: Anthropic | null = null;
function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");
  if (!_client) _client = new Anthropic();
  return _client;
}

const SYSTEM_BASE = `Você é o motor de IA do "Radar", um app pessoal de busca de vagas e preparação de candidaturas de um executivo brasileiro.
Escreva sempre em português do Brasil, direto, sem enrolação e sem clichês de RH.
Nunca invente números, empresas ou fatos sobre a pessoa: quando faltar um dado, use um marcador entre colchetes, como [R$ X] ou [N pessoas].`;

type JsonSchema = Record<string, unknown>;

/** Calls Claude forcing a single tool call, and returns that tool's input as typed JSON. */
async function structured<T>(opts: {
  system?: string;
  content: Anthropic.MessageParam["content"];
  tool: string;
  description: string;
  schema: JsonSchema;
  maxTokens?: number;
}): Promise<T> {
  // Some models reject a forced tool_choice ("tool"/"any"), so we use "auto" with a single
  // tool plus an explicit instruction, and fall back to parsing JSON from the text.
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system:
      SYSTEM_BASE +
      (opts.system ? `\n\n${opts.system}` : "") +
      `\n\nIMPORTANTE: responda SEMPRE chamando a ferramenta "${opts.tool}" com o resultado completo. Não escreva texto fora dela.`,
    messages: [{ role: "user", content: opts.content }],
    tools: [{ name: opts.tool, description: opts.description, input_schema: opts.schema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: "auto" },
  });

  const block = res.content.find((b) => b.type === "tool_use" && b.name === opts.tool);
  if (block && block.type === "tool_use") return block.input as T;

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const parsed = extractJson(text);
  if (parsed) return parsed as T;
  throw new Error("A IA não devolveu o formato esperado. Tente de novo.");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

const str = { type: "string" };
const strArr = { type: "array", items: { type: "string" } };

export function profileText(p: Partial<Profile> | null) {
  if (!p) return "(perfil vazio)";
  return [
    `Senioridade alvo: ${(p.levels ?? []).join(", ") || "não informada"}`,
    `Descrição livre: ${p.description || "(vazia)"}`,
    `Competências extraídas do CV: ${(p.extracted_skills ?? []).join(", ") || "(nenhuma)"}`,
    `CV (texto): ${(p.cv_text || "(sem CV)").slice(0, 12000)}`,
  ].join("\n");
}

/* ---------- 1. Ler o CV em PDF ---------- */
export async function extractCv(pdfBase64: string) {
  return structured<{ cv_text: string; skills: string[] }>({
    tool: "salvar_cv",
    description: "Salva o conteúdo do currículo lido.",
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
      {
        type: "text",
        text: "Leia este currículo. Devolva o texto completo, limpo e organizado (cv_text), e de 6 a 12 competências-chave curtas (skills, 2 a 5 palavras cada).",
      },
    ],
    schema: {
      type: "object",
      properties: { cv_text: str, skills: strArr },
      required: ["cv_text", "skills"],
    },
    maxTokens: 8000,
  });
}

/* ---------- 2. Sugerir cargos ---------- */
export async function suggestRoles(p: Partial<Profile>) {
  const out = await structured<{ roles: SuggestedRole[] }>({
    tool: "sugerir_cargos",
    description: "Lista de cargos sugeridos para buscar vagas.",
    system:
      "Sugira de 6 a 8 títulos de cargo como aparecem em anúncios de vaga no Brasil. Inclua 1 ou 2 apostas ousadas (wild=true): um passo acima ou um salto de setor. match = aderência de 0 a 100. why = uma frase curta explicando a aderência, falando com a pessoa (você).",
    content: [{ type: "text", text: profileText(p) }],
    schema: {
      type: "object",
      properties: {
        roles: {
          type: "array",
          items: {
            type: "object",
            properties: { title: str, match: { type: "integer" }, why: str, wild: { type: "boolean" } },
            required: ["title", "match", "why", "wild"],
          },
        },
      },
      required: ["roles"],
    },
  });
  return out.roles.sort((a, b) => (b.match ?? 0) - (a.match ?? 0));
}

/* ---------- 3. Estruturar vagas e calcular aderência ---------- */
export type StructuredPart = Omit<StructuredJob, "external_id" | "source" | "url" | "region" | "demo"> & { id: string };

export async function structureJobs(
  p: Partial<Profile>,
  raws: RawJob[],
  onChunk?: (done: number, total: number, jobsDone: number, results: StructuredPart[]) => void,
): Promise<StructuredPart[]> {
  if (raws.length === 0) return [];
  const chunks: RawJob[][] = [];
  for (let i = 0; i < raws.length; i += 4) chunks.push(raws.slice(i, i + 4));

  let chunksDone = 0;
  let jobsDone = 0;
  const results = await Promise.all(
    chunks.map((chunk) =>
      structured<{ jobs: StructuredPart[] }>({
        tool: "estruturar_vagas",
        description: "Vagas estruturadas e avaliadas contra o perfil.",
        system: `Para cada anúncio, extraia a estrutura completa da vaga e avalie contra o perfil da pessoa.
- Use só o que está no anúncio; se um campo não aparece, devolva lista vazia (ou "não divulgado" para salário).
- mode: "Presencial", "Híbrido" ou "Remoto" (inferir do texto; se não houver pista, "Presencial").
- resp, req, dif, benef: itens curtos (até 12 palavras).
- keywords: 8 termos que um ATS procuraria.
- strengths: 2 pontos em que o perfil brilha nesta vaga. gaps: 2 pontos onde vão apertar, cada um com uma dica prática.
- match: 0–100, honesto. Penalize senioridade ou setor desalinhado.
- Devolva o mesmo id recebido.`,
        content: [
          {
            type: "text",
            text: `PERFIL:\n${profileText(p)}\n\nANÚNCIOS:\n${chunk
              .map(
                (r) =>
                  `### id=${r.externalId}\nTítulo: ${r.title}\nEmpresa: ${r.company}\nLocal: ${r.location}\nPublicado: ${r.posted ?? "?"}\nSalário: ${r.salary ?? "?"}\nExtras: ${r.extensions.join(" · ")}\nDescrição:\n${r.description.slice(0, 3500)}`,
              )
              .join("\n\n")}`,
          },
        ],
        schema: {
          type: "object",
          properties: {
            jobs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: str, title: str, company: str, city: str, mode: str, posted: str, salary: str,
                  match: { type: "integer" }, summary: str,
                  resp: strArr, req: strArr, dif: strArr, benef: strArr, keywords: strArr, strengths: strArr, gaps: strArr,
                },
                required: ["id", "title", "company", "city", "mode", "match", "summary", "resp", "req", "dif", "benef", "keywords", "strengths", "gaps"],
              },
            },
          },
          required: ["jobs"],
        },
        maxTokens: 12000,
      }).then((r) => {
        chunksDone += 1;
        jobsDone += chunk.length;
        onChunk?.(chunksDone, chunks.length, jobsDone, r.jobs);
        return r.jobs;
      }),
    ),
  );
  return results.flat();
}

/* ---------- 4. CV sob medida ---------- */
export async function tailorCv(p: Partial<Profile>, job: StructuredJob, extras: string[]) {
  return structured<CvContent>({
    tool: "montar_cv",
    description: "CV adaptado para a vaga.",
    system: `Monte o CV mais assertivo possível para ESTA vaga, a partir do CV real da pessoa.
- headline: 1 linha de posicionamento alinhada ao título da vaga.
- summary: 3–4 frases, linguagem do setor da empresa, sem adjetivos vazios.
- keywords: as palavras-chave da vaga; inCv=true se já aparecem (ou equivalente) no CV, false se você está incluindo.
- bullets: 5–7 conquistas reescritas para a vaga, começando por verbo e com número. Use só fatos do CV ou das respostas extras; números desconhecidos viram [colchetes].
- notes: 2–4 orientações curtas do que a pessoa deve preencher ou ajustar.`,
    content: [
      {
        type: "text",
        text: `PERFIL:\n${profileText(p)}\n\nRESPOSTAS QUE A PESSOA MANDOU PRO CV:\n${extras.join("\n") || "(nenhuma)"}\n\nVAGA:\n${jobText(job)}`,
      },
    ],
    schema: {
      type: "object",
      properties: {
        headline: str,
        summary: str,
        keywords: { type: "array", items: { type: "object", properties: { t: str, inCv: { type: "boolean" } }, required: ["t", "inCv"] } },
        bullets: strArr,
        notes: strArr,
      },
      required: ["headline", "summary", "keywords", "bullets", "notes"],
    },
    maxTokens: 6000,
  });
}

/* ---------- 5. Copiloto ---------- */
export async function copilot(
  p: Partial<Profile>,
  job: StructuredJob,
  stage: string,
  history: { role: "user" | "assistant"; content: string }[],
  message: string,
) {
  return structured<{ text: string; options: ChatOption[] }>({
    tool: "responder",
    description: "Resposta do copiloto com até 3 versões de resposta.",
    system: `Você é o copiloto de candidatura. A pessoa vai te contar resultados, colar perguntas de recrutadores ou pedir ajuda.
- text: sua resposta curta (1–3 frases): o que observar, o que falta, qual a armadilha.
- options: 3 versões diferentes de resposta que a pessoa pode usar, com rótulo curto em CAIXA ALTA (ex.: "OBJETIVA · PRO CV", "STAR · PRA ENTREVISTA", "OUSADA").
- cv=true só nas versões que fazem sentido como bullet de currículo.
- Conecte sempre com requisitos e responsabilidades reais desta vaga. Seja provocativo quando ajudar, nunca arrogante.
- Fase atual da candidatura: ${stage}.`,
    content: [
      {
        type: "text",
        text: `PERFIL:\n${profileText(p)}\n\nVAGA:\n${jobText(job)}\n\nCONVERSA ATÉ AQUI:\n${
          history.map((h) => `${h.role === "user" ? "PESSOA" : "COPILOTO"}: ${h.content}`).join("\n") || "(início)"
        }\n\nNOVA MENSAGEM DA PESSOA:\n${message}`,
      },
    ],
    schema: {
      type: "object",
      properties: {
        text: str,
        options: {
          type: "array",
          items: { type: "object", properties: { label: str, text: str, cv: { type: "boolean" } }, required: ["label", "text", "cv"] },
        },
      },
      required: ["text", "options"],
    },
  });
}

/* ---------- 6. Aprendizados da reprovação ---------- */
export async function rejectionLessons(p: Partial<Profile>, job: StructuredJob, reason: string, timeline: string) {
  const out = await structured<{ lessons: string[] }>({
    tool: "aprendizados",
    description: "Aprendizados acionáveis a partir da reprovação.",
    system:
      "A pessoa foi reprovada nesta vaga. Gere 3 aprendizados acionáveis e específicos para as próximas candidaturas (o que mudar no CV, no discurso ou no filtro de vagas). Sem consolo genérico. Se não houver justificativa, oriente como obtê-la.",
    content: [
      {
        type: "text",
        text: `PERFIL:\n${profileText(p)}\n\nVAGA:\n${jobText(job)}\n\nHISTÓRICO:\n${timeline}\n\nJUSTIFICATIVA DA REPROVAÇÃO:\n${reason || "(não informada)"}`,
      },
    ],
    schema: { type: "object", properties: { lessons: strArr }, required: ["lessons"] },
    maxTokens: 1500,
  });
  return out.lessons;
}

function jobText(j: StructuredJob) {
  return [
    `${j.title} · ${j.company} · ${j.city} · ${j.mode}`,
    `Resumo: ${j.summary}`,
    `Responsabilidades: ${j.resp.join("; ")}`,
    `Requisitos: ${j.req.join("; ")}`,
    `Diferenciais: ${j.dif.join("; ")}`,
    `Palavras-chave: ${j.keywords.join(", ")}`,
    `Pontos fortes do perfil: ${j.strengths.join("; ")}`,
    `Gaps: ${j.gaps.join("; ")}`,
  ].join("\n");
}

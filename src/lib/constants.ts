export const REGIONS = [
  { id: "campinas", label: "RM Campinas", cities: ["Campinas", "Hortolândia", "Paulínia", "Valinhos", "Sumaré", "Indaiatuba", "Americana"] },
  { id: "sorocaba", label: "RM Sorocaba", cities: ["Sorocaba", "Itu", "Salto", "Votorantim", "Boituva"] },
  { id: "vale", label: "Vale do Paraíba (SJC)", cities: ["São José dos Campos", "Taubaté", "Jacareí", "Guaratinguetá"] },
  { id: "jundiai", label: "Jundiaí", cities: ["Jundiaí", "Itupeva", "Louveira", "Várzea Paulista"] },
  { id: "grandesp", label: "Grande São Paulo", cities: ["São Paulo", "Barueri", "Osasco", "Santo André", "São Bernardo do Campo", "Guarulhos"] },
  { id: "piracicaba", label: "Piracicaba", cities: ["Piracicaba", "Limeira", "Rio Claro"] },
  { id: "baixada", label: "Baixada Santista", cities: ["Santos", "São Vicente", "Guarujá", "Cubatão"] },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

export const SOURCES = ["LinkedIn", "Gupy", "Indeed", "Glassdoor", "Catho", "Vagas.com", "InfoJobs", "Outras"] as const;
export const MODES = ["Presencial", "Híbrido", "Remoto"] as const;
export const LEVELS = ["Gerência", "Head", "Diretoria", "C-level"] as const;

export const STAGES = [
  { id: "salva", label: "Salva" },
  { id: "aplicada", label: "Aplicada" },
  { id: "triagem", label: "Triagem" },
  { id: "rh", label: "Entrevista RH" },
  { id: "gestor", label: "Entrevista gestor" },
  { id: "case", label: "Case / painel" },
  { id: "outra", label: "Fase X (outra)" },
  { id: "proposta", label: "Proposta" },
  { id: "aprovado", label: "Aprovado" },
  { id: "reprovado", label: "Reprovado" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const FLOW: StageId[] = ["salva", "aplicada", "triagem", "rh", "gestor", "case", "proposta", "aprovado"];

export const COLS: { label: string; stages: StageId[] }[] = [
  { label: "Salvas", stages: ["salva"] },
  { label: "Aplicadas", stages: ["aplicada", "triagem"] },
  { label: "Em entrevistas", stages: ["rh", "gestor", "case", "outra"] },
  { label: "Proposta / aprovado", stages: ["proposta", "aprovado"] },
  { label: "Reprovadas", stages: ["reprovado"] },
];

export function stageLabel(id: string, custom?: string | null) {
  if (id === "outra" && custom) return custom;
  return STAGES.find((s) => s.id === id)?.label ?? id;
}

export function fmtDate(d?: string | null) {
  if (!d) return "";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
}

export const QUICK_PROMPTS = [
  "Me faz a pergunta mais difícil dessa vaga",
  "Como respondo pretensão salarial?",
  "Por que estou saindo do emprego atual?",
  "Resume meu maior resultado em 2 linhas",
];

/** Cap on SerpAPI calls per search, to protect the free quota. */
export const MAX_QUERIES_PER_SEARCH = 8;

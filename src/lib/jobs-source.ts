import { MAX_QUERIES_PER_SEARCH, REGIONS, SOURCES } from "./constants";

export type RawJob = {
  externalId: string;
  title: string;
  company: string;
  location: string;
  via: string;
  source: string;
  description: string;
  extensions: string[];
  posted?: string;
  salary?: string;
  url: string;
  region: string | null;
};

type Place = { label: string; region: string | null };

export function buildPlaces(regions: string[], cities: string[]): Place[] {
  const places: Place[] = [];
  for (const id of regions) {
    const r = REGIONS.find((x) => x.id === id);
    if (r) places.push({ label: r.cities[0], region: r.id });
  }
  for (const c of cities) {
    const r = REGIONS.find((x) => (x.cities as readonly string[]).some((cc) => cc.toLowerCase() === c.toLowerCase()));
    places.push({ label: c, region: r?.id ?? null });
  }
  return places;
}

export function detectSource(via: string, applyTitles: string[]) {
  const hay = [via, ...applyTitles].join(" ").toLowerCase();
  const hit = SOURCES.find((s) => s !== "Outras" && hay.includes(s.toLowerCase().replace(".com", "")));
  return hit ?? "Outras";
}

/** Builds the role × place queries, capped to protect the API quota. */
export function buildQueries(roles: string[], places: Place[]) {
  const queries: { q: string; place: Place }[] = [];
  for (const role of roles) for (const place of places) queries.push({ q: `${role} ${place.label} SP`, place });
  return queries.slice(0, MAX_QUERIES_PER_SEARCH);
}

type SerpJob = {
  job_id: string;
  title: string;
  company_name: string;
  location?: string;
  via?: string;
  description?: string;
  extensions?: string[];
  detected_extensions?: { posted_at?: string; salary?: string; work_from_home?: boolean };
  apply_options?: { title: string; link: string }[];
  share_link?: string;
};

export async function searchJobs(roles: string[], regions: string[], cities: string[]) {
  const places = buildPlaces(regions, cities);
  const queries = buildQueries(roles, places);
  const key = process.env.SERPAPI_KEY;
  if (!key) return { jobs: demoJobs(regions, cities), demo: true, queries: queries.length };

  const results = await Promise.all(
    queries.map(async ({ q, place }) => {
      const url = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(q)}&gl=br&hl=pt&api_key=${key}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return [] as RawJob[];
      const data = (await res.json()) as { jobs_results?: SerpJob[] };
      return (data.jobs_results ?? []).map<RawJob>((j) => {
        const via = (j.via ?? "").replace(/^via\s+/i, "");
        const applyTitles = (j.apply_options ?? []).map((a) => a.title);
        return {
          externalId: j.job_id,
          title: j.title,
          company: j.company_name,
          location: j.location ?? place.label,
          via,
          source: detectSource(via, applyTitles),
          description: j.description ?? "",
          extensions: j.extensions ?? [],
          posted: j.detected_extensions?.posted_at,
          salary: j.detected_extensions?.salary,
          url: j.apply_options?.[0]?.link ?? j.share_link ?? "",
          region: place.region,
        };
      });
    }),
  );

  const seen = new Set<string>();
  const jobs = results.flat().filter((j) => (seen.has(j.externalId) ? false : (seen.add(j.externalId), true)));
  return { jobs, demo: false, queries: queries.length };
}

/** Sample listings used while SERPAPI_KEY is not configured, so the whole flow can be tested. */
function demoJobs(regions: string[], cities: string[]): RawJob[] {
  const all: RawJob[] = [
    {
      externalId: "demo-1", title: "Head de Produtos Digitais", company: "Vetor Aeroespacial (demo)", location: "São José dos Campos, SP",
      via: "LinkedIn", source: "LinkedIn", region: "vale", posted: "há 2 dias", url: "https://www.linkedin.com/jobs/", extensions: ["Tempo integral", "Híbrido"],
      description: "Liderar o portfólio de produtos digitais para clientes de aviação, do discovery à monetização. Responsável pelo P&L dos produtos digitais e metas de receita recorrente. Liderar PMs, designers e squads com parceiros. Requisitos: 10+ anos em produto digital, 5+ liderando líderes; B2B industrial ou aeroespacial; modelos de receita recorrente; inglês fluente. Diferenciais: MRO/pós-venda, IA generativa. Benefícios: bônus, saúde, previdência.",
    },
    {
      externalId: "demo-2", title: "Diretor(a) de Transformação Digital", company: "Orbe Energia (demo)", location: "Campinas, SP",
      via: "Gupy", source: "Gupy", region: "campinas", posted: "há 5 dias", url: "https://portal.gupy.io/", extensions: ["Tempo integral"],
      description: "Conduzir a agenda de transformação digital de geradora e distribuidora. Montar o plano diretor, criar escritório de dados & IA, levar decisões de investimento ao conselho, gerir orçamento e fornecedores. Requisitos: transformação em indústria regulada, governança de dados, gestão de mudança, inglês avançado. Modelo híbrido. PLR, saúde sem coparticipação.",
    },
    {
      externalId: "demo-3", title: "Head de Dados & IA", company: "Nimbus Saúde (demo)", location: "Sorocaba, SP",
      via: "Indeed", source: "Indeed", region: "sorocaba", posted: "há 1 dia", url: "https://br.indeed.com/", extensions: ["Presencial"],
      description: "Estruturar a área de dados e IA de rede hospitalar: plataforma, governança, LGPD, casos de uso com retorno. Requisitos: liderança de times de dados, cloud AWS/Azure, modelos em produção. Presencial em Sorocaba.",
    },
    {
      externalId: "demo-4", title: "Head de Serviços Digitais & Pós-venda", company: "Ferro & Faísca (demo)", location: "Jundiaí, SP",
      via: "Catho", source: "Catho", region: "jundiai", posted: "há 3 semanas", url: "https://www.catho.com.br/", extensions: ["Híbrido"],
      description: "Transformar o pós-venda de equipamentos industriais em serviços digitais: monitoramento remoto, manutenção preditiva, portal do cliente, precificação de contratos de serviço. Liderar suporte técnico e customer success. Requisitos: pós-venda/serviços industriais, IoT, contratos de serviço.",
    },
  ];
  const cityLow = cities.map((c) => c.toLowerCase());
  const filtered = all.filter((j) => (j.region && regions.includes(j.region)) || cityLow.some((c) => j.location.toLowerCase().includes(c)));
  return filtered.length ? filtered : all;
}

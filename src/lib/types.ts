export type SuggestedRole = {
  title: string;
  match: number | null;
  why: string;
  wild: boolean;
};

export type Profile = {
  user_id: string;
  description: string | null;
  levels: string[] | null;
  cv_file_name: string | null;
  cv_text: string | null;
  extracted_skills: string[] | null;
  suggested_roles: SuggestedRole[] | null;
  search_prefs: SearchPrefs | null;
  last_search: LastSearch | null;
};

export type SearchMeta = { demo: boolean; queries: number; found: number; broadened: boolean; afterSource: number };
export type LastSearch = { at: string; jobs: StructuredJob[]; meta: SearchMeta };

export type SearchPrefs = {
  roles: string[];
  regions: string[];
  cities: string[];
  sources: string[];
  modes: string[];
};

/** A job as returned by the search (structured by Claude), before or after saving. */
export type StructuredJob = {
  external_id: string;
  title: string;
  company: string;
  city: string;
  region: string | null;
  mode: string;
  source: string;
  posted: string | null;
  salary: string | null;
  url: string;
  match: number;
  summary: string;
  resp: string[];
  req: string[];
  dif: string[];
  benef: string[];
  keywords: string[];
  strengths: string[];
  gaps: string[];
  demo?: boolean;
};

export type JobRow = StructuredJob & { id: string; created_at: string };

export type Application = {
  id: string;
  job_id: string;
  stage: string;
  custom_stage: string | null;
  cv_extras: string[];
  created_at: string;
  updated_at: string;
};

export type AppEvent = {
  id: string;
  application_id: string;
  stage: string;
  custom_stage: string | null;
  event_date: string;
  note: string | null;
  reason: string | null;
  lessons: string[] | null;
  created_at: string;
};

export type ChatOption = { label: string; text: string; cv: boolean };

export type ChatMessage = {
  id: string;
  application_id: string;
  role: "user" | "assistant";
  content: string;
  options: ChatOption[] | null;
  chosen: number | null;
  created_at: string;
};

export type CvContent = {
  headline: string;
  summary: string;
  keywords: { t: string; inCv: boolean }[];
  bullets: string[];
  notes: string[];
};

export type CvVersion = { id: string; application_id: string; content: CvContent; created_at: string };

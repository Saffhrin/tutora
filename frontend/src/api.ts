export type Topic = { id: string; name: string; description: string; prerequisites: string[]; mastery: number; evidence_count: number };
export type Source = { id: string; title: string; kind: 'text' | 'pdf' | 'slides' | 'video' | 'image'; status: 'ready' | 'processing' | 'failed'; unit_count: number; created_at: string; error?: string };
export type Location = { page?: number; slide?: number; timestamp_seconds?: number };
export type Unit = { id: string; source_id: string; text: string; topic_id: string; topic_name: string; location: Location; visual_description?: string };
export type Citation = { unit_id: string; source_id: string; source_title: string; excerpt: string; location: Location; url: string };
export type DashboardData = { learner: { name: string }; stats: { sources: number; units: number; topics: number; assessments: number }; topics: Topic[]; recent_sessions: { id: string; created_at?: string; completed?: boolean; score?: number; question_count?: number }[]; recommendations: { topic_id: string; title: string; reason: string }[]; provider: { enabled: boolean; model: string }; disclaimer: string };
export type Question = { id: string; prompt: string; kind: string; options?: string[]; topic_id: string; topic_name: string; difficulty: string; source: Citation };
export type Assessment = { id: string; questions: Question[]; notice?: string };
export type Report = { id: string; score: number; correct: number; total: number; feedback: { question_id: string; prompt: string; student_answer: string; correct: boolean; expected_answer: string; explanation: string; citation: Citation; topic_name: string }[]; weak_topics: { id: string; name: string; mastery: number }[]; mastery_changes: { topic_id: string; name: string; before: number; after: number }[]; misconceptions: string[] };
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((item: { msg?: string }) => item.msg).join('; ') : body?.error || `Request failed (${response.status}). Please try again.`);
  }
  return response.json();
}
export const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const percent = (value: number) => `${Math.round(value * 100)}%`;
export function locationLabel(location: Location = {}) {
  if (location.page != null) return `Page ${location.page}`;
  if (location.slide != null) return `Slide ${location.slide}`;
  if (location.timestamp_seconds != null) return `${Math.floor(location.timestamp_seconds / 60)}:${String(Math.floor(location.timestamp_seconds % 60)).padStart(2, '0')}`;
  return 'Source passage';
}
export function sourceLink(citation: Citation) { return `/library?source=${encodeURIComponent(citation.source_id)}&unit=${encodeURIComponent(citation.unit_id)}`; }
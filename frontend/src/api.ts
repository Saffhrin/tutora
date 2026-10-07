export type Topic = { id: string; name: string; description: string; prerequisites: string[]; mastery: number; evidence_count: number; unit_count?: number; auto?: boolean };
export type Source = { id: string; title: string; kind: 'text' | 'pdf' | 'slides' | 'video' | 'image' | 'audio'; status: 'ready' | 'processing' | 'failed'; unit_count: number; created_at: string; error?: string | null };
export type Location = { page?: number; slide?: number; timestamp_seconds?: number; label?: string };
export type Unit = { id: string; source_id: string; text: string; topic_id: string | null; topic_name: string | null; location: Location; visual_description?: string | null; source_title?: string | null };
export type Citation = { unit_id: string; source_id: string; source_title: string; excerpt: string; location: Location; location_label?: string; url: string };
export type Stats = { sources: number; units: number; topics: number; assessments: number; answered_questions: number; correct_answers: number; mean_mastery: number };
export type DashboardData = { learner: { name: string }; stats: Stats; topics: Topic[]; recommendations: { topic_id: string; title: string; reason: string; mastery: number }[]; provider: { enabled: boolean; model: string }; disclaimer: string };
export type Question = { id: string; prompt: string; kind: 'mcq' | 'short' | 'numerical'; options?: string[]; topic_id: string | null; topic_name: string; difficulty: string; origin: string; source: Citation | null };
export type ChatReply = { answer: string; grounded: boolean; citations: Citation[]; suggested_questions: string[]; mode: string };
export type ChatMessage = { id: string; role: 'student' | 'tutor'; content: string; citations: Citation[]; mode: string | null; created_at: number };
export type AssessmentSummary = { id: string; completed: boolean; score: number | null; question_count: number; diagnostic: boolean; created_at: number };
export type FeedbackItem = { question_id: string; prompt: string; student_answer: string; correct: boolean; expected_answer: string; explanation: string; citation: Citation | null; topic_name: string | null; topic_id: string | null; difficulty: string };
export type Report = { id: string; score: number; correct: number; total: number; feedback: FeedbackItem[]; weak_topics: { id: string; name: string; mastery: number }[]; mastery_changes: { topic_id: string; name: string; before: number; after: number; evidence?: number }[]; misconceptions: string[] };
export type Assessment = { id: string; questions: Question[]; notice?: string };
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
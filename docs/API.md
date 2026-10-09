# Tutora API contract

Base `/api`. JSON unless noted. Single local learner; no authentication in MVP.

Local ports are configurable and conflict-tolerant: the API prefers `TUTORA_API_PORT` (8000)
and the Vite dev server `TUTORA_WEB_PORT` (5173), each moving to the next free port when a
different project already listens there (`backend/ports.py`, `scripts/dev.sh`). The dev server
proxies `/api` to the API port, so the UI always talks to this backend, never the other one.

- `GET /dashboard`: `{learner: {name}, stats: {sources, units, topics, assessments}, topics: Topic[], recent_sessions: [], recommendations: [{topic_id,title,reason}], provider: {enabled,model}, disclaimer}`.
- Topic: `{id, name, description, prerequisites: string[], mastery: number (0..1), evidence_count: number}`.
- `GET /sources`: Source[]. Source: `{id,title,kind: 'text'|'pdf'|'slides'|'video'|'image',status:'ready'|'processing'|'failed',unit_count,created_at,error?}`.
- `POST /sources/upload`: multipart `file`. Returns Source. Extraction is synchronous for MVP. Max 50MB.
- `POST /sources/text`: `{title,text}` -> Source.
- `GET /sources/{id}`: `{source: Source,units: Unit[]}`.
- `GET /sources/{id}/file`: serves original with correct content type.
- Unit: `{id,source_id,text,topic_id,topic_name,location: {page?,slide?,timestamp_seconds?},visual_description?}`.
- `GET /topics`: Topic[].
- `POST /chat`: `{message,topic_id?:string}` -> `{answer,grounded:boolean,citations:Citation[],suggested_questions:string[],mode:'extractive'|'gemini'}`.
- `GET /chat/history`: last 40 messages as `[{id,role:'student'|'tutor',content,citations,mode,created_at}]`, oldest first. Used to restore the tutor transcript.
- Citation: `{unit_id,source_id,source_title,excerpt,location,url}`. url points to frontend `/library?source=ID&unit=ID` (viewer opens unit and exact location; original asset endpoint may have #page=N or #t=N).
- `POST /assessments`: `{topic_ids:string[],count:number (1..10),difficulty:'adaptive'|'easy'|'medium'|'hard',kind:'mixed'|'mcq'|'short'|'numerical',diagnostic?:boolean}` -> `{id,questions:Question[],notice?:string}`. Empty topic_ids means all. Question: `{id,prompt,kind,options?:string[],topic_id,topic_name,difficulty,source:Citation}`. Never expose answer keys before submission.
- `POST /assessments/{id}/submit`: `{answers:{[questionId]:string}}` -> `{id,score,correct,total,feedback:[{question_id,prompt,student_answer,correct,expected_answer,explanation,citation,topic_name}],weak_topics:[{id,name,mastery}],mastery_changes:[{topic_id,name,before,after}],misconceptions:string[]}`. score 0..1. Submission is idempotent.
- `GET /assessments`: `[{id,created_at,completed,score?,question_count}]`.
- `GET /assessments/{id}/questions`: re-serves a generated assessment (same shape as creation, answer keys still hidden) so the UI can resume after a reload.
- `GET /health`: `{status:'ok'}`. The Vite dev server probes this at startup: if the proxy target
  answers `/api/*` but not this shape, it warns that another project owns the port, and the UI shows
  *“Something answered on port N, but it is not the Tutora API”* instead of foreign data.

## Extraction module contract (Python)

`backend/ingestion.py`: `extract_file(path: pathlib.Path, original_name: str) -> list[dict]`. Each unit `{text:str,location:dict,visual_description?:str,topic_name?:str}`. Raises ValueError with user-facing actionable errors. PDF pages, PPTX slides, text paragraphs use deterministic local parsing. Gemini optional for image understanding/audio/video, must preserve location. `backend/provider.py` exposes `is_enabled() -> bool`, `model_name() -> str`, `generate_json(prompt: str) -> dict` and may provide multimodal helpers. API keys server-side via GEMINI_API_KEY. No imports from app/db in these modules.
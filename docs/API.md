# Tutora API contract

Base `/api`. JSON unless noted. Single local learner; no authentication in MVP.

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
- Citation: `{unit_id,source_id,source_title,excerpt,location,url}`. url points to frontend `/library?source=ID&unit=ID` (viewer opens unit and exact location; original asset endpoint may have #page=N or #t=N).
- `POST /assessments`: `{topic_ids:string[],count:number (1..10),difficulty:'adaptive'|'easy'|'medium'|'hard',kind:'mixed'|'mcq'|'short'|'numerical',diagnostic?:boolean}` -> `{id,questions:Question[],notice?:string}`. Empty topic_ids means all. Question: `{id,prompt,kind,options?:string[],topic_id,topic_name,difficulty,source:Citation}`. Never expose answer keys before submission.
- `POST /assessments/{id}/submit`: `{answers:{[questionId]:string}}` -> `{id,score,correct,total,feedback:[{question_id,prompt,student_answer,correct,expected_answer,explanation,citation,topic_name}],weak_topics:[{id,name,mastery}],mastery_changes:[{topic_id,name,before,after}],misconceptions:string[]}`. score 0..1. Submission is idempotent.
- `GET /assessments`: `[{id,created_at,completed,score?,question_count}]`.
- `GET /health`: `{status:'ok'}`.

## Extraction module contract (Python)

`backend/ingestion.py`: `extract_file(path: pathlib.Path, original_name: str) -> list[dict]`. Each unit `{text:str,location:dict,visual_description?:str,topic_name?:str}`. Raises ValueError with user-facing actionable errors. PDF pages, PPTX slides, text paragraphs use deterministic local parsing. Gemini optional for image understanding/audio/video, must preserve location. `backend/provider.py` exposes `is_enabled() -> bool`, `model_name() -> str`, `generate_json(prompt: str) -> dict` and may provide multimodal helpers. API keys server-side via GEMINI_API_KEY. No imports from app/db in these modules.
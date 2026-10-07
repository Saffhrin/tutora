import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, RefreshCw, Target, XCircle } from 'lucide-react';
import { api, post, percent, type Question, type Report, type Topic } from '../api';
import Citation from '../components/Citation';

type Created = { id: string; questions: Question[]; notice?: string | null };

export default function Practice({ onChanged }: { onChanged: () => void }) {
  const [params, setParams] = useSearchParams();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [kind, setKind] = useState('mixed');
  const [difficulty, setDifficulty] = useState('adaptive');
  const [assessment, setAssessment] = useState<Created | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Topic[]>('/topics')
      .then((data) => {
        setTopics(data);
        const preselect = params.get('topic');
        setSelected(preselect ? [preselect] : []);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const existing = params.get('assessment');
    if (existing) {
      // resume a quiz created from the dashboard diagnostic button
      api<{ questions: Question[]; notice?: string | null }>(`/assessments/${existing}/questions`)
        .then((data) => setAssessment({ id: existing, ...data }))
        .catch(() => undefined);
    }
  }, []);

  const generate = async (diagnostic = false) => {
    setBusy(true);
    setError('');
    setReport(null);
    setAnswers({});
    try {
      const created = await post<Created>('/assessments', {
        topic_ids: diagnostic ? [] : selected,
        count, kind, difficulty, diagnostic,
      });
      setAssessment(created);
      setParams({ assessment: created.id });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      setAssessment(null);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!assessment) return;
    setBusy(true);
    setError('');
    try {
      const result = await post<Report>(`/assessments/${assessment.id}/submit`, { answers });
      setReport(result);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const answeredCount = useMemo(
    () => (assessment ? assessment.questions.filter((question) => (answers[question.id] ?? '').trim()).length : 0),
    [assessment, answers],
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Adaptive assessment</p>
          <h1>Practice & mock exams</h1>
          <p className="lede">
            Pick a scope; questions are tagged to a topic, a source location and a difficulty. Items are
            never reused across assessments, and each answer comes back with cited feedback.
          </p>
        </div>
        <button className="ghost" onClick={() => generate(true)} disabled={busy}>
          <Target size={16} /> Diagnostic quiz (all topics)
        </button>
      </header>

      {error && <div className="banner warn">{error}</div>}

      {!assessment && (
        <section className="card">
          <h2>Choose your scope</h2>
          <div className="topic-picker">
            {topics.map((topic) => (
              <label key={topic.id} className={selected.includes(topic.id) ? 'pick active' : 'pick'}>
                <input
                  type="checkbox"
                  checked={selected.includes(topic.id)}
                  onChange={(event) => setSelected((current) => event.target.checked
                    ? [...current, topic.id]
                    : current.filter((id) => id !== topic.id))}
                />
                <span>{topic.name}</span>
                <small>{topic.evidence_count === 0 ? 'no evidence' : `${percent(topic.mastery)} mastery`}</small>
              </label>
            ))}
          </div>
          <div className="controls">
            <label>Questions
              <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </label>
            <label>Type
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="mixed">Mixed</option>
                <option value="mcq">Multiple choice</option>
                <option value="short">Short answer</option>
                <option value="numerical">Numerical</option>
              </select>
            </label>
            <label>Difficulty
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="adaptive">Adaptive (weakest topics first)</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <button className="primary" onClick={() => generate(false)} disabled={busy}>
              <ClipboardList size={16} /> {busy ? 'Generating…' : 'Generate assessment'}
            </button>
          </div>
          <p className="muted small">
            {selected.length === 0 ? 'No topic selected = every topic in your library.' : `${selected.length} topic(s) selected.`}
          </p>
        </section>
      )}

      {assessment && !report && (
        <section className="card">
          {assessment.notice && <div className="banner quiet">{assessment.notice}</div>}
          <h2>{assessment.questions.length} questions</h2>
          <ol className="questions">
            {assessment.questions.map((question, index) => (
              <li key={question.id}>
                <div className="question-head">
                  <b>Q{index + 1}</b>
                  <span className="chip">{question.topic_name}</span>
                  <span className="chip alt">{question.difficulty}</span>
                  <span className="chip alt">{question.kind}</span>
                  <span className="chip alt">{question.origin === 'gemini' ? 'AI-generated, verified' : 'reviewed bank'}</span>
                </div>
                <p>{question.prompt}</p>
                {question.kind === 'mcq' ? (
                  <div className="options">
                    {(question.options ?? []).map((option) => (
                      <label key={option} className={answers[question.id] === option ? 'option active' : 'option'}>
                        <input
                          type="radio"
                          name={question.id}
                          checked={answers[question.id] === option}
                          onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    className="answer"
                    placeholder={question.kind === 'numerical' ? 'Numeric answer' : 'Your answer'}
                    value={answers[question.id] ?? ''}
                    onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                  />
                )}
                {question.source && (
                  <details>
                    <summary>Source location (hidden until you answer)</summary>
                    <Citation citation={question.source} />
                  </details>
                )}
              </li>
            ))}
          </ol>
          <div className="controls">
            <button className="primary" onClick={submit} disabled={busy || answeredCount === 0}>
              Submit {answeredCount} answer{answeredCount === 1 ? '' : 's'}
            </button>
            <button className="ghost" onClick={() => { setAssessment(null); setAnswers({}); setParams({}); }}>
              <RefreshCw size={14} /> New scope
            </button>
          </div>
        </section>
      )}

      {report && (
        <section className="card">
          <h2>Report · {percent(report.score)} ({report.correct}/{report.total})</h2>
          <div className="columns">
            <div>
              <h3>Mastery updates</h3>
              <ul className="history">
                {report.mastery_changes.map((change) => (
                  <li key={change.topic_id}>
                    <span>{change.name}</span>
                    <b className={change.after >= change.before ? 'up' : 'down'}>
                      {percent(change.before)} → {percent(change.after)}
                    </b>
                  </li>
                ))}
              </ul>
              <h3>Weak topics</h3>
              <ul className="history">
                {report.weak_topics.map((topic) => (
                  <li key={topic.id}><span>{topic.name}</span><b>{percent(topic.mastery)}</b></li>
                ))}
              </ul>
              {report.misconceptions.length > 0 && (
                <>
                  <h3>Likely misconceptions</h3>
                  <ul className="misconceptions">
                    {report.misconceptions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </>
              )}
            </div>
            <div>
              <h3>Cited feedback</h3>
              <ul className="feedback">
                {report.feedback.map((item, index) => (
                  <li key={item.question_id} className={item.correct ? 'ok' : 'no'}>
                    <div className="question-head">
                      {item.correct ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                      <b>Q{index + 1}</b>
                      <span className="chip">{item.topic_name}</span>
                    </div>
                    <p>{item.prompt}</p>
                    <p className="muted small">
                      You answered “{item.student_answer || '—'}”. Expected: <b>{item.expected_answer}</b>
                    </p>
                    <p className="small">{item.explanation}</p>
                    {item.citation && <Citation citation={item.citation} />}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="controls">
            <button className="primary" onClick={() => generate(false)} disabled={busy}>
              <RefreshCw size={14} /> Another set (new questions)
            </button>
            <button className="ghost" onClick={() => { setAssessment(null); setReport(null); setAnswers({}); setParams({}); }}>
              Change scope
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
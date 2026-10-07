import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardCheck, FileStack, Layers, Play, Target } from 'lucide-react';
import { api, post, percent, type AssessmentSummary, type DashboardData, type Topic } from '../api';
import Mastery from '../components/Mastery';

export default function Dashboard({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<AssessmentSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api<DashboardData>('/dashboard').then(setData).catch((e) => setError(e.message));
    api<AssessmentSummary[]>('/assessments').then(setHistory).catch(() => undefined);
  }, []);

  const startDiagnostic = async () => {
    setBusy(true);
    setError('');
    try {
      const created = await post<{ id: string }>('/assessments', { diagnostic: true, count: 6, kind: 'mixed', difficulty: 'adaptive', topic_ids: [] });
      onChanged();
      navigate(`/practice?assessment=${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <div className="banner warn">{error}</div>;
  if (!data) return <div className="loading">Loading your learner model…</div>;

  const graded = data.topics.filter((topic) => topic.evidence_count > 0);
  const weakest = [...data.topics].sort((a, b) => a.mastery - b.mastery)[0];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Personalized tutoring · Track D</p>
          <h1>Welcome back, {data.learner.name}</h1>
          <p className="lede">
            {graded.length === 0
              ? 'Your learner model has no graded evidence yet. Start with a short diagnostic quiz — the tutor will keep refusing anything your material does not cover.'
              : `Mastery is estimated from ${data.stats.answered_questions} graded answers across ${data.stats.topics} topics. Weakest right now: ${weakest?.name}.`}
          </p>
        </div>
        <button className="primary" onClick={startDiagnostic} disabled={busy}>
          <Target size={16} /> {busy ? 'Building quiz…' : 'Start diagnostic quiz'}
        </button>
      </header>

      {error && <div className="banner warn">{error}</div>}

      <section className="stats">
        <Stat icon={FileStack} label="Sources" value={data.stats.sources} />
        <Stat icon={Layers} label="Content units" value={data.stats.units} />
        <Stat icon={BookOpen} label="Topics" value={data.stats.topics} />
        <Stat icon={ClipboardCheck} label="Assessments" value={data.stats.assessments} />
        <Stat icon={Target} label="Mean mastery" value={data.stats.answered_questions ? percent(data.stats.mean_mastery) : '—'} />
      </section>

      <div className="columns">
        <section className="card">
          <h2>Topic mastery</h2>
          <p className="muted">Bayesian knowledge tracing over graded quiz answers only.</p>
          <ul className="topic-list">
            {data.topics.map((topic: Topic) => (
              <li key={topic.id}>
                <div className="topic-row">
                  <strong>{topic.name}</strong>
                  <span className="muted small">{topic.unit_count ?? 0} units</span>
                </div>
                <Mastery value={topic.mastery} evidence={topic.evidence_count} />
                {topic.prerequisites.length > 0 && (
                  <small className="muted">Prerequisites: {topic.prerequisites.join(' → ')}</small>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>What to study next</h2>
          <p className="muted">Recommendations are ordered by evidence-weighted weakness.</p>
          <ol className="reco">
            {data.recommendations.map((item) => (
              <li key={item.topic_id}>
                <strong>{item.title}</strong>
                <span>{item.reason}</span>
                <button className="ghost" onClick={() => navigate(`/practice?topic=${item.topic_id}`)}>
                  Practice this topic
                </button>
              </li>
            ))}
          </ol>
          <div className="divider" />
          <h3>Recent assessments</h3>
          {history.length === 0 && <p className="muted">No assessments yet.</p>}
          <ul className="history">
            {history.slice(0, 5).map((item) => (
              <li key={item.id}>
                <span>{item.diagnostic ? 'Diagnostic' : 'Practice'} · {item.question_count} questions</span>
                <b>{item.completed && item.score != null ? percent(item.score) : 'in progress'}</b>
              </li>
            ))}
          </ul>
          <div className="divider" />
          <p className="disclaimer">{data.disclaimer}</p>
          <p className="muted small">
            Tutor engine: {data.provider.enabled ? `Gemini (${data.provider.model}) writing over retrieved excerpts` : 'offline extractive mode (verbatim citations, no generated prose)'}.
          </p>
          <button className="ghost" onClick={() => navigate('/tutor')}><Play size={14} /> Open the grounded tutor</button>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof FileStack; label: string; value: string | number }) {
  return (
    <div className="stat">
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
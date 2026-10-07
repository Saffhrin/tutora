import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Network } from 'lucide-react';
import { api, percent, type Topic } from '../api';
import Mastery from '../components/Mastery';

export default function CourseMap() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Topic[]>('/topics').then(setTopics).catch((e) => setError(e.message));
  }, []);

  const roots = topics.filter((topic) => topic.prerequisites.length === 0);
  const byName = (name: string) => topics.find((topic) => topic.name === name);
  const maxDepth = (topic: Topic, seen: string[] = []): number => {
    if (seen.includes(topic.id)) return 0;
    const parents = topic.prerequisites.map(byName).filter(Boolean) as Topic[];
    return parents.length === 0 ? 0 : 1 + Math.max(...parents.map((parent) => maxDepth(parent, [...seen, topic.id])));
  };
  const depth = (topic: Topic) => maxDepth(topic);

  if (error) return <div className="banner warn">{error}</div>;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Visual course flow</p>
          <h1>Topic & prerequisite map</h1>
          <p className="lede">
            Prerequisites come from the topic metadata; mastery colours come from your graded evidence.
            Auto-grouped topics from your own uploads are marked.
          </p>
        </div>
      </header>

      <section className="card">
        <h2><Network size={16} /> Learning path</h2>
        {topics.length === 0 && <p className="muted">No topics yet — upload material first.</p>}
        <div className="map">
          {[...topics].sort((a, b) => depth(a) - depth(b)).map((topic) => (
            <div key={topic.id} className="map-node" style={{ marginLeft: `${depth(topic) * 48}px` }}>
              <div className="map-card">
                <div className="topic-row">
                  <strong>{topic.name}</strong>
                  {topic.auto && <span className="chip alt">auto</span>}
                </div>
                <Mastery value={topic.mastery} evidence={topic.evidence_count} />
                <p className="muted small">{topic.description}</p>
                {topic.prerequisites.length > 0 && (
                  <p className="small prerequisites">
                    {topic.prerequisites.map((name) => (
                      <span key={name}>{name} <ArrowRight size={11} /></span>
                    ))}
                    <b>{topic.name}</b>
                  </p>
                )}
                <Link className="ghost" to={`/practice?topic=${topic.id}`}>Practice →</Link>
              </div>
            </div>
          ))}
        </div>
        <div className="divider" />
        <h3>Foundation topics</h3>
        <ul className="history">
          {roots.map((topic) => (
            <li key={topic.id}><span>{topic.name}</span><b>{topic.evidence_count === 0 ? 'no evidence' : percent(topic.mastery)}</b></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
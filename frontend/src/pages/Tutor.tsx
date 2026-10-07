import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CornerDownLeft, ShieldCheck, ShieldOff, Sparkles } from 'lucide-react';
import { api, post, type ChatMessage, type ChatReply, type Topic } from '../api';
import Citation from '../components/Citation';

type Entry = { role: 'student' | 'tutor'; content: string; citations: ChatReply['citations']; grounded?: boolean; mode?: string };

export default function Tutor() {
  const [messages, setMessages] = useState<Entry[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [scope, setScope] = useState('');
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Topic[]>('/topics').then(setTopics).catch(() => undefined);
    api<ChatMessage[]>('/chat/history')
      .then((history) => {
        setMessages(history.map((item) => ({
          role: item.role, content: item.content, citations: item.citations,
          grounded: item.role === 'tutor' ? item.citations.length > 0 : undefined, mode: item.mode ?? undefined,
        })));
      })
      .catch(() => undefined);
    post<ChatReply>('/chat', { message: 'What does this course cover?' })
      .then((reply) => setSuggestions(reply.suggested_questions))
      .catch(() => undefined);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setDraft('');
    setError('');
    setMessages((current) => [...current, { role: 'student', content: question, citations: [] }]);
    setBusy(true);
    try {
      const reply = await post<ChatReply>('/chat', { message: question, topic_id: scope || null });
      setMessages((current) => [...current, {
        role: 'tutor', content: reply.answer, citations: reply.citations,
        grounded: reply.grounded, mode: reply.mode,
      }]);
      setSuggestions(reply.suggested_questions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Source grounding</p>
          <h1>Grounded tutor</h1>
          <p className="lede">
            Answers are written only over retrieved excerpts of your material, and each claim links to
            the exact page, slide or timestamp. Anything outside the material is declined instead of
            guessed.
          </p>
        </div>
        <label className="scope">
          <span>Scope</span>
          <select value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="">All topics</option>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
          </select>
        </label>
      </header>

      <section className="chat">
        {messages.length === 0 && (
          <div className="chat-empty">
            <Sparkles size={20} />
            <h2>Ask about your own material</h2>
            <p className="muted">Try “How do I compute mean squared error?” or “What is the learning rate for?”</p>
          </div>
        )}
        {messages.map((message, index) => (
          <article key={index} className={`bubble ${message.role} ${message.role === 'tutor' ? (message.grounded ? 'grounded' : 'declined') : ''}`}>
            {message.role === 'tutor' && (
              <span className={`badge ${message.grounded ? 'good' : 'warn'}`}>
                {message.grounded ? <><ShieldCheck size={13} /> Source-backed</> : <><ShieldOff size={13} /> Declined — not in your material</>}
              </span>
            )}
            <p>{message.content}</p>
            {message.citations.length > 0 && (
              <div className="citations">
                {message.citations.map((citation) => <Citation key={citation.unit_id} citation={citation} />)}
              </div>
            )}
            {message.mode && <small className="muted tiny">engine: {message.mode}</small>}
          </article>
        ))}
        {busy && <div className="bubble tutor"><p className="muted">Retrieving from your library…</p></div>}
        <div ref={endRef} />
      </section>

      {error && <div className="banner warn">{error}</div>}

      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((question) => (
            <button key={question} className="chip-button" onClick={() => ask(question)}>{question}</button>
          ))}
        </div>
      )}

      <form
        className="composer"
        onSubmit={(event) => { event.preventDefault(); ask(draft); }}
      >
        <input
          value={draft}
          placeholder="Ask something from your lectures, textbook or slides…"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="primary" type="submit" disabled={busy || !draft.trim()}>
          <CornerDownLeft size={16} /> Ask
        </button>
      </form>
      <p className="muted small">
        The tutor cannot see the internet, only your library. Ask <Link to="/library">Library</Link> for what is indexed.
      </p>
    </div>
  );
}
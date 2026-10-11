import { useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Lightbulb, RotateCcw, Volume2 } from 'lucide-react';
import { api, percent, type RevisionCard, type RevisionPayload, type SchedulePayload } from '../api';
import Citation from '../components/Citation';

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.98;
  window.speechSynthesis.speak(utterance);
}

export default function Revision() {
  const [deck, setDeck] = useState<RevisionPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [plan, setPlan] = useState<SchedulePayload | null>(null);
  const [examDate, setExamDate] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<RevisionPayload>('/revision?count=8')
      .then((data) => { setDeck(data); setIndex(0); })
      .catch((e) => setError(e.message));
    api<SchedulePayload>('/schedule?days=7').then(setPlan).catch(() => undefined);
  }, []);

  const card: RevisionCard | null = deck?.cards[Math.min(index, Math.max(0, (deck?.cards.length ?? 1) - 1))] ?? null;
  const total = deck?.cards.length ?? 0;

  const buildPlan = async () => {
    setBusy(true);
    setError('');
    try {
      const query = new URLSearchParams({ days: '7', minutes_per_day: String(minutes) });
      if (examDate) query.set('exam_date', examDate);
      setPlan(await api<SchedulePayload>(`/schedule?${query.toString()}`));
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
          <p className="eyebrow">Targeted revision</p>
          <h1>Weak topics, flashcards and a study plan</h1>
          <p className="lede">
            Everything here comes from your own graded evidence: the cards quote the weakest topics
            verbatim (with the exact source location), and the plan spreads them over the days you have
            left, revisiting the weakest material most often.
          </p>
        </div>
        <span className="chip"><Lightbulb size={13} /> based on mastery</span>
      </header>

      {error && <div className="banner warn">{error}</div>}

      <section className="card">
        <h2><Lightbulb size={16} /> Flashcards from your weakest topics</h2>
        {deck && deck.topics.length > 0 && (
          <div className="suggestions">
            {deck.topics.map((topic) => (
              <span key={topic.id} className="chip">{topic.name} · {percent(topic.mastery)}</span>
            ))}
          </div>
        )}
        {!card && <p className="muted">No cards yet — upload material and take a quiz so the learner model has evidence.</p>}
        {card && (
          <>
            <article className="bubble tutor">
              <span className="badge good">{card.topic_name} · mastery {percent(card.mastery)}</span>
              <p><b>{card.front}</b></p>
              {flipped && <p>{card.back}</p>}
              {flipped && <div className="citations"><Citation citation={card.citation} /></div>}
            </article>
            <div className="controls">
              <button className="ghost" onClick={() => { setIndex((current) => Math.max(0, current - 1)); setFlipped(false); }} disabled={index === 0}>
                <ChevronLeft size={14} /> Previous
              </button>
              <button className="primary" onClick={() => setFlipped((value) => !value)}>
                <RotateCcw size={14} /> {flipped ? 'Hide answer' : 'Show cited answer'}
              </button>
              <button className="ghost" onClick={() => speak(`${card.front}. ${card.back}`)}>
                <Volume2 size={14} /> Listen
              </button>
              <button className="ghost" onClick={() => { setIndex((current) => Math.min(total - 1, current + 1)); setFlipped(false); }} disabled={index >= total - 1}>
                Next <ChevronRight size={14} />
              </button>
              <span className="muted small">card {total === 0 ? 0 : index + 1} / {total}</span>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2><Calendar size={16} /> Study plan</h2>
        <div className="controls">
          <label className="scope">
            <span>Exam date</span>
            <input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
          </label>
          <label className="scope">
            <span>Minutes per day</span>
            <input type="number" min={5} max={240} value={minutes} onChange={(event) => setMinutes(Number(event.target.value) || 30)} />
          </label>
          <button className="primary" onClick={buildPlan} disabled={busy}>
            <Calendar size={14} /> {busy ? 'Building…' : 'Build plan'}
          </button>
        </div>
        {plan && (
          <p className="muted small">
            {plan.exam_date ? `Exam on ${plan.exam_date} (${plan.days_until_exam} days left). ` : 'No exam date set. '}
            {plan.method}
          </p>
        )}
        <ul className="history">
          {plan?.plan.map((day) => (
            <li key={day.date}>
              <span>
                <b>{day.date}</b> · {day.minutes} min · {day.items.map((item) => item.name).join(', ')}
                <br />
                <small className="muted">{day.items.map((item) => `${item.name}: ${item.reason}`).join(' · ')}</small>
              </span>
              <button className="ghost" onClick={() => speak(day.items.map((item) => item.name).join(', '))}>
                <Volume2 size={13} /> Listen
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

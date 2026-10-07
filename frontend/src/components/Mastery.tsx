import { percent } from '../api';

export default function Mastery({ value, evidence }: { value: number; evidence?: number }) {
  const level = evidence === 0 ? 'unknown' : value >= 0.7 ? 'high' : value >= 0.4 ? 'mid' : 'low';
  return (
    <div className="mastery">
      <div className={`mastery-bar ${level}`}>
        <span style={{ width: `${Math.max(4, Math.round(value * 100))}%` }} />
      </div>
      <small>
        {evidence === 0 ? 'no evidence yet' : `${percent(value)} · ${evidence} graded`}
      </small>
    </div>
  );
}
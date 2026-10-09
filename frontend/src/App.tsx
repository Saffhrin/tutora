import { useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, LayoutDashboard, Library, Network, Sparkles, WifiOff } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import LibraryPage from './pages/Library';
import Tutor from './pages/Tutor';
import Practice from './pages/Practice';
import CourseMap from './pages/CourseMap';
import { api, looksLikeDashboard, type DashboardData } from './api';
import ErrorBoundary from './components/ErrorBoundary';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/library', label: 'Library', icon: Library, end: false },
  { to: '/tutor', label: 'Tutor', icon: GraduationCap, end: false },
  { to: '/practice', label: 'Practice', icon: BookOpen, end: false },
  { to: '/map', label: 'Course map', icon: Network, end: false },
];

const API_PORT = import.meta.env.TUTORA_API_PORT ?? '8000';

export type Status = { online: boolean; provider: DashboardData['provider'] | null; foreign: boolean };

export default function App() {
  const [status, setStatus] = useState<Status>({ online: true, provider: null, foreign: false });
  const navigate = useNavigate();
  const location = useLocation();

  const refresh = useCallback(() => {
    api<DashboardData>('/dashboard')
      .then((data) => {
        // Something answered on this port, but a Tutora dashboard carries a learner,
        // stats, topics and recommendations. If it does not, another project owns the
        // port the proxy targets and we must say so instead of rendering foreign data.
        const looksLikeTutora = looksLikeDashboard(data);
        setStatus(looksLikeTutora
          ? { online: true, provider: data.provider ?? null, foreign: false }
          : { online: false, provider: null, foreign: true });
      })
      .catch(() => setStatus({ online: false, provider: null, foreign: false }));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand" onClick={() => navigate('/')}>
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span>
            <strong>Tutora</strong>
            <em>A little more understanding, every day.</em>
          </span>
        </div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className={`pill ${status.provider?.enabled ? 'pill-good' : 'pill-quiet'}`}>
            {status.provider?.enabled
              ? <>Gemini: {status.provider.model}</>
              : <><WifiOff size={13} /> Offline mode: local extraction + extractive tutor</>}
          </div>
          <p>Every answer is cited to a page, slide or timestamp — or refused.</p>
        </div>
      </aside>
      <main>
        {!status.online && (
          <div className="banner warn">
            {status.foreign ? (
              <>
                Something answered on port {API_PORT}, but it is not the Tutora API — another project
                is probably using that port. Stop it, or start Tutora with{' '}
                <code>./scripts/dev.sh</code>, which picks free ports for both servers.
              </>
            ) : (
              <>
                The Tutora API is not reachable on port {API_PORT}. Start it with{' '}
                <code>python -m backend.main</code> (it skips to a free port automatically) or{' '}
                <code>./scripts/dev.sh</code> for API and UI together.
              </>
            )}
          </div>
        )}
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard onChanged={refresh} />} />
            <Route path="/library" element={<LibraryPage onChanged={refresh} />} />
            <Route path="/tutor" element={<Tutor />} />
            <Route path="/practice" element={<Practice onChanged={refresh} />} />
            <Route path="/map" element={<CourseMap />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}
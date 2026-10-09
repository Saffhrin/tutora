/*
 * UI smoke test: renders the real App in a DOM with three API situations and fails
 * if the page cannot come up or names the wrong port. Run with `npm run test:ui`.
 *
 * It guards the exact failure modes seen when another project owns 8000/5173:
 *  - the injected API port must survive Vite/esbuild (a bare identifier left behind
 *    would throw at render time and blank the page),
 *  - a foreign API must be reported, not rendered,
 *  - a missing API must show the "not reachable" banner.
 */
const { execFileSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE = path.join(ROOT, 'node_modules', '.cache', 'tutora-smoke', 'app.cjs');
const API_PORT = '8123';

mkdirSync(path.dirname(BUNDLE), { recursive: true });
execFileSync(path.join(ROOT, 'node_modules', '.bin', 'esbuild'), [
  path.join(ROOT, 'frontend', 'src', 'App.tsx'),
  '--bundle', '--format=cjs', '--platform=node', '--jsx=automatic',
  `--outfile=${BUNDLE}`,
  `--define:import.meta.env.TUTORA_API_PORT="${API_PORT}"`,
  '--define:process.env.NODE_ENV="production"',
  '--external:react', '--external:react-dom', '--external:react-dom/client',
  '--external:react-router-dom', '--external:react/jsx-runtime', '--external:lucide-react',
], { stdio: 'pipe' });

const React = require('react');
const { createRoot } = require('react-dom/client');
const { BrowserRouter } = require('react-router-dom');
const App = require(BUNDLE).default;

const DASHBOARD = {
  learner: { name: 'Student' },
  stats: { sources: 1, units: 7, topics: 3, assessments: 0, answered_questions: 0, correct_answers: 0, mean_mastery: 0.2 },
  topics: [],
  recommendations: [],
  provider: { enabled: false, model: 'offline' },
  disclaimer: 'Sample material only.',
};

function render(fetchImpl) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://127.0.0.1:5173/',
    pretendToBeVisual: true,
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.fetch = fetchImpl;
  createRoot(document.getElementById('root')).render(
    React.createElement(BrowserRouter, null, React.createElement(App)),
  );
  return new Promise((resolve) => setTimeout(() => {
    const text = document.body.textContent.replace(/\s+/g, ' ');
    dom.window.close();
    resolve(text);
  }, 400));
}

const checks = [];
const check = (name, ok) => {
  checks.push([name, !!ok]);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
};

(async () => {
  const offline = await render(() => Promise.reject(new Error('ECONNREFUSED')));
  check('API down: page renders with the "not reachable" banner',
    offline.includes('The Tutora API is not reachable on port ' + API_PORT));
  check('API down: banner names python -m backend.main', offline.includes('python -m backend.main'));

  const foreign = await render(() => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve({ hello: 'another project' }),
  }));
  check('foreign API: reported instead of rendered',
    foreign.includes(`Something answered on port ${API_PORT}, but it is not the Tutora API`));
  check('foreign API: no blank page (navigation still there)', foreign.includes('Course map'));

  // Another project's HTML page must also be reported, not mistaken for a dead API.
  const html = await render(() => Promise.resolve({
    ok: true, status: 200, json: () => Promise.reject(new SyntaxError('Unexpected token <')),
  }));
  check('non-JSON answer: still reported as not-Tutora',
    html.includes(`Something answered on port ${API_PORT}, but it is not the Tutora API`));

  const healthy = await render(() => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(DASHBOARD),
  }));
  check('real API: no warning banner', !healthy.includes('not reachable on port')
    && !healthy.includes('but it is not the Tutora API'));
  check('real API: dashboard rendered', healthy.includes('Dashboard') && healthy.includes('Course map'));

  const failed = checks.filter(([, ok]) => !ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} UI checks passed`);
  process.exit(failed.length ? 1 : 0);
})();

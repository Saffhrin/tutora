/* One-off runtime check: render the real App with the API unreachable.
 * Fails if the injected API port is missing (the bug that broke the banner). */
const { JSDOM } = require('/tmp/verify/node_modules/jsdom');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:5173/',
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = false;
global.fetch = () => Promise.reject(new Error('connection refused')); // API is down

const React = require('react');
const { createRoot } = require('react-dom/client');
const { BrowserRouter } = require('react-router-dom');
const App = require('./app.cjs').default;

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(BrowserRouter, null, React.createElement(App)));

setTimeout(() => {
  const text = document.body.textContent.replace(/\s+/g, ' ');
  const checks = [
    ['page rendered (brand present)', /Tutora/.test(text)],
    ['offline banner rendered', /The Tutora API is not reachable on port/.test(text)],
    ['banner names the proxied API port', text.includes('not reachable on port 8123')],
    ['banner suggests python -m backend.main', text.includes('python -m backend.main')],
    ['no undefined identifier error', !/is not defined|ReferenceError/.test(text)],
  ];
  let failed = 0;
  for (const [name, good] of checks) {
    if (!good) failed += 1;
    console.log(`${good ? 'PASS' : 'FAIL'} ${name}`);
  }
  console.log('\nrendered text excerpt:', text.slice(0, 260));
  process.exit(failed ? 1 : 0);
}, 400);

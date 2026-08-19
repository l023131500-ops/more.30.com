/**
 * app.js — נקודת הכניסה: אתחול הנתונים, תפריט ניווט וניתוב בין המסכים.
 */
import { store } from './store.js';
import { el, clear, toastErr } from './ui.js';
import * as calendarView from './views/calendar.js';
import * as saleView from './views/sale.js';
import * as pastView from './views/past.js';
import * as reportsView from './views/reports.js';
import * as campaignsView from './views/campaigns.js';
import * as settingsView from './views/settings.js';

const ROUTES = {
  calendar:  { title: 'לוח שנה — דשבורד מרכזי', icon: '📅', label: 'לוח שנה', view: calendarView },
  sale:      { title: 'ניהול יום מכירה', icon: '🛒', label: 'יום מכירה', view: saleView, hidden: true },
  past:      { title: 'מכירות קודמות ומאגר לקוחות', icon: '📚', label: 'מכירות קודמות', view: pastView },
  reports:   { title: 'דוחות', icon: '📊', label: 'דוחות', view: reportsView },
  campaigns: { title: 'צינתוקים והודעות', icon: '📞', label: 'צינתוקים', view: campaignsView },
  settings:  { title: 'הגדרות', icon: '⚙️', label: 'הגדרות', view: settingsView },
};

let current = { route: 'calendar', params: {} };

function parseHash() {
  const h = (location.hash || '#/calendar').replace(/^#\/?/, '');
  const [route, query] = h.split('?');
  const params = {};
  if (query) for (const [k, v] of new URLSearchParams(query)) params[k] = v;
  return { route: ROUTES[route] ? route : 'calendar', params };
}

export function navigate(route, params = {}) {
  const qs = new URLSearchParams(params).toString();
  location.hash = `#/${route}${qs ? '?' + qs : ''}`;
}

function renderNav() {
  const nav = el('nav.nav');
  for (const [key, r] of Object.entries(ROUTES)) {
    if (r.hidden) continue;
    nav.appendChild(el('a', {
      class: current.route === key ? 'active' : '',
      onclick: () => navigate(key),
    }, [el('span.ico', { text: r.icon }), r.label]));
  }
  return nav;
}

function renderShell() {
  const S = store.state.settings;
  document.body.innerHTML = '';
  const contentEl = el('div.content#content');
  const titleEl = el('h2', { text: ROUTES[current.route].title });

  const sidebar = el('aside.sidebar', {}, [
    el('div.brand', {}, [
      el('h1', { text: S.orgName || 'אופטיקה לכל כיס' }),
      el('p', { text: S.subtitle || '' }),
    ]),
    renderNav(),
    el('div.sidebar-foot', { text: 'מערכת ניהול מכירות משקפיים' }),
  ]);

  document.body.appendChild(el('div.app', {}, [
    sidebar,
    el('main.main', {}, [
      el('header.topbar', {}, [
        titleEl,
        el('div.spacer'),
        el('button.btn.sm', { text: '📅 לוח שנה', onclick: () => navigate('calendar') }),
        el('button.btn.sm', { text: '📊 דוחות', onclick: () => navigate('reports') }),
      ]),
      contentEl,
    ]),
  ]));
  return contentEl;
}

function renderRoute() {
  current = parseHash();
  const content = renderShell();
  try {
    ROUTES[current.route].view.render(content, navigate, current.params);
  } catch (e) {
    console.error(e);
    clear(content);
    content.appendChild(el('div.card', {}, [
      el('h3', {}, ['אירעה שגיאה']),
      el('div.card-body', {}, [
        el('p', { text: e.message }),
        el('pre', { text: e.stack || '', style: { fontSize: '11px', direction: 'ltr', overflow: 'auto' } }),
      ]),
    ]));
    toastErr('אירעה שגיאה: ' + e.message);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', renderRoute);

(async function boot() {
  await store.init();
  if (!location.hash) location.hash = '#/calendar';
  renderRoute();
  // חשיפה לצורכי איתור תקלות ובדיקות
  window.__app = { store, navigate, loadDemo: settingsView.loadDemo };
})();

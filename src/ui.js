/**
 * ui.js — עזרי ממשק: יצירת אלמנטים, מודאלים, טוסטים, פורמט מספרים ותאריכים.
 */
import { store } from './store.js';
import { dayInfo } from './hebcal.js';

/* --------------------------- יצירת אלמנטים --------------------------- */

/** el('div.card#id', {onclick}, [children]) */
export function el(spec, props = {}, children = []) {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
  const tag = m[1] || 'div';
  const node = document.createElement(tag);
  const mods = (m[2] || '').match(/[.#][\w-]+/g) || [];
  for (const mod of mods) {
    if (mod[0] === '.') node.classList.add(mod.slice(1));
    else node.id = mod.slice(1);
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'class') node.className += (node.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = !!v;
    else if (k === 'disabled') node.disabled = !!v;
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

/* ------------------------------ פורמט ------------------------------ */

export function money(n) {
  const cur = store.state.settings.currency || '₪';
  const v = Number(n) || 0;
  return cur + v.toLocaleString('he-IL', { maximumFractionDigits: 2 });
}
export function numFmt(n, d = 0) {
  return (Number(n) || 0).toLocaleString('he-IL', { maximumFractionDigits: d, minimumFractionDigits: d });
}
export function pct(n) { return (Number(n) || 0).toFixed(1) + '%'; }

/** תאריך מלא: יום, עברי + לועזי */
export function fullDate(iso) {
  const d = dayInfo(iso);
  return `יום ${d.weekdayLabel}, ${d.hebLabelFull} · ${d.gregLabel}`;
}
export function shortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${+d}/${+m}/${y}`;
}

/* ------------------------------ טוסט ------------------------------ */

let toastBox;
export function toast(msg, kind = '') {
  if (!toastBox) {
    toastBox = el('div.toasts');
    document.body.appendChild(toastBox);
  }
  const t = el('div.toast' + (kind ? '.' + kind : ''), { text: msg });
  toastBox.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; }, 3200);
  setTimeout(() => t.remove(), 3600);
}
export const toastOk = (m) => toast(m, 'ok');
export const toastErr = (m) => toast(m, 'err');

/* ------------------------------ מודאל ------------------------------ */

/**
 * openModal({ title, body(HTMLElement), buttons:[{label,kind,onClick(close)}], size })
 * מחזיר פונקציית סגירה.
 */
export function openModal({ title, body, buttons = [], size = '', onClose }) {
  const back = el('div.modal-back');
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  const foot = el('div.modal-foot');
  for (const b of buttons) {
    foot.appendChild(el('button.btn' + (b.kind ? '.' + b.kind : ''), {
      text: b.label,
      onclick: () => b.onClick ? b.onClick(close) : close(),
    }));
  }
  foot.appendChild(el('div.spacer'));
  foot.appendChild(el('button.btn.ghost', { text: 'סגירה', onclick: close }));

  const modal = el('div.modal' + (size ? '.' + size : ''), {}, [
    el('div.modal-head', {}, [el('h3', { text: title })]),
    el('div.modal-body', {}, [body]),
    foot,
  ]);
  back.appendChild(modal);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.body.appendChild(back);
  const first = modal.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 40);
  return close;
}

export function confirmDialog(message, onYes, opts = {}) {
  openModal({
    title: opts.title || 'אישור פעולה',
    size: 'narrow',
    body: el('p', { text: message, style: { margin: '4px 0', lineHeight: '1.6' } }),
    buttons: [
      { label: opts.yes || 'אישור', kind: opts.danger ? 'danger' : 'primary', onClick: (c) => { c(); onYes(); } },
    ],
  });
}

export function promptDialog(label, value, onOk, opts = {}) {
  const input = el(opts.multiline ? 'textarea.input' : 'input.input', { value: value || '' });
  openModal({
    title: opts.title || label,
    size: 'narrow',
    body: el('div.field', {}, [el('label', { text: label }), input]),
    buttons: [{ label: 'שמירה', kind: 'primary', onClick: (c) => { c(); onOk(input.value); } }],
  });
}

/* ------------------------------ שדות ------------------------------ */

export function field(label, input) {
  return el('div.field', {}, [el('label', { text: label }), input]);
}

export function textInput(value, onInput, props = {}) {
  return el('input.input', { value: value ?? '', ...props, oninput: (e) => onInput(e.target.value) });
}

export function numberInput(value, onInput, props = {}) {
  return el('input.input', {
    type: 'number', step: 'any', value: value ?? '', ...props,
    oninput: (e) => onInput(e.target.value === '' ? '' : parseFloat(e.target.value)),
  });
}

export function selectInput(value, options, onChange, props = {}) {
  const s = el('select.input', { ...props, onchange: (e) => onChange(e.target.value) });
  for (const o of options) {
    const val = typeof o === 'object' ? o.value : o;
    const lbl = typeof o === 'object' ? o.label : o;
    s.appendChild(el('option', { value: val, text: lbl, selected: String(val) === String(value ?? '') }));
  }
  s.value = value ?? '';
  return s;
}

export function checkInput(checked, onChange, props = {}) {
  return el('input', { type: 'checkbox', checked: !!checked, ...props, onchange: (e) => onChange(e.target.checked) });
}

export function dateInput(value, onChange, props = {}) {
  return el('input.input', { type: 'date', value: value || '', ...props, onchange: (e) => onChange(e.target.value) });
}

/* ------------------------------ קבצים ------------------------------ */

/** פותח בורר קבצים ומחזיר Promise<File[]> */
export function pickFile(accept, multiple = false) {
  return new Promise((resolve) => {
    const inp = el('input', { type: 'file', accept: accept || '', style: { display: 'none' } });
    if (multiple) inp.multiple = true;
    inp.onchange = () => { resolve(Array.from(inp.files || [])); inp.remove(); };
    document.body.appendChild(inp);
    inp.click();
  });
}

/* ------------------------------ גרפים ------------------------------ */

/** גרף עמודות פשוט. data: [{label, value, color?}] */
export function barChart(data, formatter = numFmt) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return el('div.chart', {}, data.map((d) => el('div.bar', {}, [
    el('div.val', { text: formatter(d.value) }),
    el('div.fill' + (d.color ? '.' + d.color : ''), { style: { height: (Math.abs(d.value) / max * 130) + 'px' } }),
    el('div.lbl', { text: d.label, title: d.label }),
  ])));
}

export function emptyState(text, icon = '📋') {
  return el('div.empty', {}, [el('div.ico', { text: icon }), el('div', { text })]);
}

export function kpi(label, value, sub, kind = '') {
  return el('div.kpi' + (kind ? '.' + kind : ''), {}, [
    el('div.label', { text: label }),
    el('div.value', { text: value }),
    sub ? el('div.sub', { text: sub }) : null,
  ]);
}

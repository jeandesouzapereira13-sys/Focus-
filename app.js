/* Focus — aplicativo de produtividade gamificado (PWA, 100% local) */
'use strict';

const APP_VERSION = '1.0.0';
const SCHEMA = 1;

/* =========================================================
   Utilidades e datas (sempre na data local do aparelho)
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmtN = (n) => Number(n || 0).toLocaleString('pt-BR');
const dateKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
const weekday = (k) => parseKey(k).getDay();
const isKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && !isNaN(parseKey(k));
const isTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
function todayKey() {
  const h = (S && S.settings && S.settings.dayStartHour) || 0;
  return dateKey(new Date(Date.now() - h * 3600e3));
}
const WD1 = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WD3 = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtLong = (k) => cap(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseKey(k)));
const fmtShort = (k) => { const d = parseKey(k); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); };
const fmtFull = (k) => { const d = parseKey(k); return d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear(); };
function relLabel(k) {
  const t = todayKey(); const d = diffDays(t, k);
  if (d === 0) return 'Hoje'; if (d === 1) return 'Amanhã'; if (d === -1) return 'Ontem';
  return cap(WD3[weekday(k)]) + ', ' + fmtShort(k);
}
const diasW = (n) => (n === 1 ? 'dia' : 'dias');
const fmtTime = (ts) => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

/* =========================================================
   Constantes
   ========================================================= */
const KINDS = { simples: 'Simples', media: 'Média', importante: 'Importante', dificil: 'Difícil', habito: 'Hábito' };
const PRIOS = ['Baixa', 'Normal', 'Alta'];
const DEFAULT_CATS = [
  { id: 'pessoal', name: 'Pessoal' }, { id: 'profissional', name: 'Profissional' }, { id: 'espiritual', name: 'Espiritual' },
  { id: 'fisico', name: 'Físico' }, { id: 'intelectual', name: 'Intelectual' }, { id: 'social', name: 'Social' }, { id: 'outros', name: 'Outros' }
];
const LEVEL_NAMES = ['Iniciante', 'Consistente', 'Disciplinado', 'Focado', 'Imparável', 'Determinado', 'Resiliente', 'Constante', 'Inabalável', 'Mestre', 'Referência', 'Lendário'];
const LEVEL_MSGS = [
  'Todo caminho começa com a primeira tarefa.', 'Você está aparecendo todos os dias.', 'A rotina começa a trabalhar a seu favor.',
  'Atenção onde ela importa.', 'O ritmo agora é seu.', 'Escolhas firmes, dia após dia.', 'Você volta mais forte depois dos dias difíceis.',
  'Constância virou identidade.', 'Nada tira você do caminho.', 'Disciplina como estilo de vida.', 'Seu exemplo inspira.', 'Poucos chegam até aqui.'
];
const CHEERS = ['Mais uma vitória.', 'Progresso registrado.', 'Você está construindo consistência.', 'Um passo de cada vez.', 'Feito.'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const XP_MIN = 1, XP_MAX = 200;

const defaultSettings = () => ({
  name: '', dailyGoal: 60,
  xp: { simples: 10, media: 20, importante: 30, dificil: 50, habito: 15 },
  theme: 'dark', animations: true, dayStartHour: 0, sortMode: 'prioridade', groupByPeriod: false
});
const defaultState = () => ({
  schema: SCHEMA, app: 'focus', createdAt: Date.now(),
  settings: defaultSettings(),
  categories: DEFAULT_CATS.map((c) => ({ ...c })),
  tasks: [], occ: {}, ledger: [], goals: [], challenges: [], days: {},
  meta: { maxSeenTs: Date.now() }
});

/* =========================================================
   Armazenamento local (IndexedDB + cópia em localStorage)
   ========================================================= */
const LS_KEY = 'focus-state-v1';
const Store = {
  mode: 'none', db: null,
  async init() {
    try { this.db = await idbOpen(); this.mode = 'idb'; } catch (e) { this.db = null; }
    let lsOK = false;
    try { localStorage.setItem('__focus_t', '1'); localStorage.removeItem('__focus_t'); lsOK = true; } catch (e) { /* indisponível */ }
    this.lsOK = lsOK;
    if (!this.db) this.mode = lsOK ? 'ls' : 'none';
  },
  async read() {
    let raw = null;
    if (this.db) { try { raw = await idbReq('readonly', (st) => st.get('state')); } catch (e) { raw = null; } }
    if (!raw && this.lsOK) { try { raw = localStorage.getItem(LS_KEY); } catch (e) { raw = null; } }
    return raw;
  },
  async write(json) {
    if (this.mode === 'none') throw new Error('Armazenamento indisponível');
    if (this.db) await idbReq('readwrite', (st) => st.put(json, 'state'));
    if (this.lsOK) {
      try { localStorage.setItem(LS_KEY, json); }
      catch (e) { if (!this.db) throw e; /* com IndexedDB ativo, a cópia extra é opcional */ }
    }
  },
  async writeExtra(key, value) { if (this.db) await idbReq('readwrite', (st) => st.put(value, key)); }
};
function idbOpen() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('sem IndexedDB'));
    let r;
    try { r = indexedDB.open('focus', 1); } catch (e) { return rej(e); }
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('bloqueado'));
  });
}
function idbReq(mode, fn) {
  return new Promise((res, rej) => {
    let tx;
    try { tx = Store.db.transaction('kv', mode); } catch (e) { return rej(e); }
    const req = fn(tx.objectStore('kv'));
    let val;
    req.onsuccess = () => { val = req.result; };
    tx.oncomplete = () => res(val);
    tx.onerror = () => rej(tx.error || req.error);
    tx.onabort = () => rej(tx.error || new Error('transação abortada'));
  });
}

let S = null;               // estado
let saveChain = Promise.resolve();
let saveError = null;
let memo = null;            // caches derivados

function normalize(d) {
  const base = defaultState();
  if (!d || typeof d !== 'object') return base;
  const s = { ...base, ...d };
  s.settings = { ...base.settings, ...(d.settings || {}) };
  s.settings.xp = { ...base.settings.xp, ...((d.settings && d.settings.xp) || {}) };
  s.categories = Array.isArray(d.categories) && d.categories.length ? d.categories.filter((c) => c && c.id && c.name) : base.categories;
  if (!s.categories.some((c) => c.id === 'outros')) s.categories.push({ id: 'outros', name: 'Outros' });
  s.tasks = Array.isArray(d.tasks) ? d.tasks.filter((t) => t && t.id && t.title) : [];
  s.tasks.forEach((t) => {
    t.recur = t.recur && t.recur.type ? t.recur : { type: 'none', days: [] };
    t.recur.days = Array.isArray(t.recur.days) ? t.recur.days : [];
    t.skips = Array.isArray(t.skips) ? t.skips : [];
    t.xp = clamp(parseInt(t.xp, 10) || 10, XP_MIN, XP_MAX);
    t.priority = [0, 1, 2].includes(t.priority) ? t.priority : 1;
  });
  s.occ = d.occ && typeof d.occ === 'object' ? d.occ : {};
  s.ledger = Array.isArray(d.ledger) ? d.ledger.filter((e) => e && typeof e.delta === 'number' && isKey(e.date)) : [];
  s.goals = Array.isArray(d.goals) ? d.goals : [];
  s.goals.forEach((g) => { g.steps = Array.isArray(g.steps) ? g.steps : []; g.linked = Array.isArray(g.linked) ? g.linked : []; });
  s.challenges = Array.isArray(d.challenges) ? d.challenges : [];
  s.challenges.forEach((c) => { c.checkins = c.checkins && typeof c.checkins === 'object' ? c.checkins : {}; c.freqDays = Array.isArray(c.freqDays) ? c.freqDays : []; });
  s.days = d.days && typeof d.days === 'object' ? d.days : {};
  s.meta = { ...base.meta, ...(d.meta || {}) };
  s.schema = SCHEMA; s.app = 'focus';
  return s;
}

/* Persiste o estado. Escritas são serializadas em fila para evitar condições de corrida. */
function commit() {
  memo = null;
  if (Date.now() > (S.meta.maxSeenTs || 0)) S.meta.maxSeenTs = Date.now();
  const json = JSON.stringify(S);
  saveChain = saveChain
    .then(() => Store.write(json))
    .then(() => { if (saveError) { saveError = null; updateBanner(); } })
    .catch((e) => {
      saveError = e;
      updateBanner();
      toast('Não foi possível salvar. ' + storageErrText(e), { err: true });
    });
  return saveChain;
}
function storageErrText(e) {
  const n = (e && e.name) || '';
  if (n === 'QuotaExceededError' || /quota/i.test(String(e && e.message))) return 'O armazenamento do aparelho está cheio.';
  return 'O armazenamento está indisponível neste modo de navegação.';
}

/* =========================================================
   Domínio: tarefas, ocorrências, XP
   ========================================================= */
const catName = (id) => (S.categories.find((c) => c.id === id) || { name: 'Outros' }).name;
const taskById = (id) => S.tasks.find((t) => t.id === id);
const occKey = (taskId, date) => taskId + '@' + date;

function appliesOn(t, date) {
  if (t.deleted) return false;
  if (date < t.date) return false;
  if (t.endDate && date > t.endDate) return false;
  if (t.skips.includes(date)) return false;
  switch (t.recur.type) {
    case 'none': return date === t.date;
    case 'daily': return true;
    case 'days': return t.recur.days.includes(weekday(date));
    case 'weekly': return weekday(date) === weekday(t.date);
    default: return false;
  }
}
function recurLabel(t) {
  switch (t.recur.type) {
    case 'daily': return 'Todo dia';
    case 'days': return t.recur.days.slice().sort().map((d) => cap(WD3[d])).join(', ');
    case 'weekly': return 'Toda ' + WD3[weekday(t.date)];
    default: return '';
  }
}

function getMemo() {
  if (memo) return memo;
  const xpBy = {}; const occBy = {};
  let total = 0;
  for (const e of S.ledger) { xpBy[e.date] = (xpBy[e.date] || 0) + e.delta; total += e.delta; }
  for (const [k, o] of Object.entries(S.occ)) { (occBy[o.date] || (occBy[o.date] = [])).push([k, o]); }
  memo = { xpBy, occBy, total, items: {} };
  return memo;
}
const totalXP = () => getMemo().total;
const xpOn = (d) => getMemo().xpBy[d] || 0;
const goalOf = (d) => (S.days[d] && S.days[d].goal) || S.settings.dailyGoal;
const metOn = (d) => goalOf(d) > 0 && xpOn(d) >= goalOf(d);
const dayRec = (d) => S.days[d] || (S.days[d] = {});

function dayItems(date) {
  const m = getMemo();
  if (m.items[date]) return m.items[date];
  const out = []; const seen = new Set();
  for (const t of S.tasks) {
    if (!appliesOn(t, date)) continue;
    const key = occKey(t.id, date); const o = S.occ[key]; seen.add(key);
    out.push({
      key, taskId: t.id, date, title: o ? o.title : t.title, cat: o ? o.cat : t.cat, time: t.time, priority: t.priority,
      recurring: t.recur.type !== 'none', recurText: recurLabel(t), xp: o ? o.xp : t.xp, done: !!o,
      moved: t.movedTo || null, orphan: false, created: t.createdAt || 0
    });
  }
  for (const [key, o] of m.occBy[date] || []) {
    if (seen.has(key)) continue;
    out.push({ key, taskId: o.taskId, date, title: o.title, cat: o.cat, time: '', priority: 1, recurring: !!o.recurring, recurText: '',
      xp: o.xp, done: true, moved: null, orphan: true, created: o.at || 0 });
  }
  m.items[date] = sortItems(out, date);
  return m.items[date];
}
function sortItems(items, date) {
  const mode = S.settings.sortMode;
  const pr = (S.days[date] && S.days[date].prio) || [];
  const ord = (S.days[date] && S.days[date].order) || [];
  const tm = (x) => x.time || '99:99';
  const byPrio = (a, b) => (pr.includes(b.key) - pr.includes(a.key)) || (b.priority - a.priority) || tm(a).localeCompare(tm(b)) || (a.created - b.created);
  let cmp = byPrio;
  if (mode === 'horario') cmp = (a, b) => tm(a).localeCompare(tm(b)) || (b.priority - a.priority) || (a.created - b.created);
  if (mode === 'manual') {
    const ix = (x) => { const i = ord.indexOf(x.key); return i < 0 ? 1e6 : i; };
    cmp = (a, b) => (ix(a) - ix(b)) || byPrio(a, b);
  }
  return items.slice().sort(cmp);
}
function dayStats(date) {
  const items = dayItems(date);
  const total = items.length; const done = items.filter((i) => i.done).length;
  const avail = items.filter((i) => !i.done && !i.moved && !i.orphan).reduce((s, i) => s + i.xp, 0);
  return { items, total, done, pending: total - done, pct: total ? Math.round((done / total) * 100) : 0, earned: xpOn(date), avail };
}

/* Proteções contra recompensas indevidas */
function clockOK() { return Date.now() >= (S.meta.maxSeenTs || 0) - 10 * 60e3; }
function canComplete(date) {
  const t = todayKey(); const dd = diffDays(date, t);
  if (dd < 0) return 'Tarefas de dias futuros só podem ser concluídas no próprio dia.';
  if (dd > 1) return 'Só é possível concluir tarefas de hoje e de ontem. Dias anteriores ficam para consulta.';
  if (!clockOK()) return 'O relógio do aparelho parece ter voltado no tempo. Ajuste a data e a hora para continuar pontuando.';
  return null;
}

/* =========================================================
   Níveis e sequências
   ========================================================= */
const needFor = (n) => Math.round((100 * Math.pow(n, 1.35)) / 10) * 10 + 50; // XP do nível n para n+1
function levelInfo(xp) {
  let lvl = 1, rest = Math.max(0, xp);
  while (rest >= needFor(lvl)) { rest -= needFor(lvl); lvl++; }
  const need = needFor(lvl);
  return { level: lvl, name: levelName(lvl), into: rest, need, toNext: need - rest, pct: Math.round((rest / need) * 100), msg: LEVEL_MSGS[Math.min(lvl - 1, LEVEL_MSGS.length - 1)] };
}
function levelName(n) {
  if (n <= LEVEL_NAMES.length) return LEVEL_NAMES[n - 1];
  const k = n - LEVEL_NAMES.length + 1;
  return 'Lendário ' + (ROMAN[k] || k);
}
function currentStreak() {
  const t = todayKey();
  let d = metOn(t) ? t : addDays(t, -1); let n = 0;
  while (metOn(d) && n < 5000) { n++; d = addDays(d, -1); }
  return n;
}
function streakRuns() {
  const dates = Object.keys(getMemo().xpBy).filter(metOn).sort();
  const runs = [];
  for (const d of dates) {
    const last = runs[runs.length - 1];
    if (last && addDays(last.end, 1) === d) { last.end = d; last.len++; } else runs.push({ start: d, end: d, len: 1 });
  }
  return runs;
}

/* =========================================================
   Ações principais (XP com garantia de não duplicar)
   ========================================================= */
const busy = new Set();
function toggleOcc(key) {
  if (busy.has(key)) return;
  busy.add(key); setTimeout(() => busy.delete(key), 350);
  const [taskId, date] = key.split('@');
  const o = S.occ[key];
  const t = taskById(taskId);
  const lvlBefore = levelInfo(totalXP()).level;
  const block = canComplete(date);
  if (block) { toast(block); return; }
  if (o) {
    // desmarcar: reverte exatamente o XP concedido nesta ocorrência
    S.ledger.push({ id: uid(), ts: Date.now(), date, delta: -o.xp, kind: 'undo', label: o.title, key });
    delete S.occ[key];
    commit(); render();
    toast('Conclusão desfeita. −' + o.xp + ' XP');
    return;
  }
  if (!t || !appliesOn(t, date)) { toast('Esta tarefa não está disponível nesta data.'); return; }
  if (t.movedTo) { toast('Esta tarefa foi transferida para ' + relLabel(t.movedTo).toLowerCase() + '.'); return; }
  const wasMet = metOn(date);
  if (!(S.days[date] && S.days[date].goal)) dayRec(date).goal = S.settings.dailyGoal;
  S.occ[key] = { taskId, date, at: Date.now(), xp: t.xp, title: t.title, cat: t.cat, recurring: t.recur.type !== 'none' };
  S.ledger.push({ id: uid(), ts: Date.now(), date, delta: t.xp, kind: 'task', label: t.title, key });
  commit();
  UI.pop = key; UI.floatXP = { key, xp: t.xp };
  render();
  const st = dayStats(date);
  const lvlAfter = levelInfo(totalXP()).level;
  checkGoalsAuto();
  if (lvlAfter > lvlBefore) { celebrate(lvlAfter); return; }
  if (st.total && st.done === st.total) toast('Dia concluído.');
  else if (!wasMet && metOn(date)) toast('Meta diária de XP atingida.');
  else toast(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
}

/* =========================================================
   Metas e desafios
   ========================================================= */
function linkedCount(g) {
  const from = dateKey(new Date(g.createdAt || 0));
  let n = 0;
  for (const o of Object.values(S.occ)) if (g.linked.includes(o.taskId) && o.date >= from) n++;
  return n;
}
function goalProgress(g) {
  let cur = 0, tgt = 1;
  if (g.mode === 'steps') { tgt = g.steps.length || 1; cur = g.steps.filter((s) => s.done).length; if (!g.steps.length) tgt = 1; }
  else if (g.mode === 'value') { tgt = g.target || 1; cur = g.current || 0; }
  else if (g.mode === 'linked') { tgt = g.target || 1; cur = linkedCount(g); }
  const pct = g.status === 'done' ? 100 : clamp(Math.round((cur / tgt) * 100), 0, 100);
  return { cur, tgt, pct, full: cur >= tgt && !(g.mode === 'steps' && !g.steps.length) };
}
const goalLate = (g) => g.status !== 'done' && g.deadline && g.deadline < todayKey();
function checkGoalsAuto() {
  let changed = false;
  for (const g of S.goals) {
    if (g.status === 'done' || !g.autoComplete) continue;
    if (goalProgress(g).full) { g.status = 'done'; g.doneAt = Date.now(); changed = true; toast('Meta concluída: ' + g.title); }
  }
  if (changed) { commit(); render(); }
}
function chDays(c) {
  const out = []; let d = c.start;
  for (let i = 0; i < 400 && d <= c.end; i++) {
    if (c.freq === 'daily' || c.freqDays.includes(weekday(d))) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}
function chMet(c, d) {
  if (c.criterion === 'checkin') return !!c.checkins[d];
  if (c.criterion === 'xp') return metOn(d);
  if (c.criterion === 'task') return !!S.occ[occKey(c.taskId, d)];
  return false;
}
function chStatus(c) {
  const days = chDays(c); const t = todayKey();
  const met = days.filter((d) => d <= t && chMet(c, d)).length;
  const req = Math.max(1, Math.ceil((days.length * (c.reqPct || 100)) / 100));
  const left = days.filter((d) => d > t || (d === t && !chMet(c, d))).length;
  let st = 'ativo';
  if (met >= req) st = 'concluido';
  else if (t > c.end) st = 'encerrado';
  else if (t < c.start) st = 'agendado';
  else if (met + left < req) st = 'inviavel';
  return { days, met, req, total: days.length, st, pct: clamp(Math.round((met / req) * 100), 0, 100) };
}

/* =========================================================
   Interface: infraestrutura
   ========================================================= */
const UI = { tab: 'inicio', filter: 'todas', dayView: null, reorder: false, metasSeg: 'metas', goalFilter: 'andamento', evoMonth: null, evoRange: 'semana', pop: null, floatXP: null, prevW: {}, prevN: {}, ledgerMore: false };

function go(tab) {
  if (UI.tab === tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  UI.tab = tab; UI.reorder = false; render(); window.scrollTo(0, 0);
}
function render() {
  if (!S) return;
  const v = $('#view');
  v.innerHTML = VIEWS[UI.tab]();
  $$('#tabbar [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === UI.tab));
  $('#fab').hidden = !(UI.tab === 'inicio' || UI.tab === 'dia') || UI.reorder;
  afterRender(v);
}
function afterRender(root) {
  const anim = S.settings.animations;
  $$('[data-w]', root).forEach((el) => {
    const id = el.dataset.id; const w = el.dataset.w + '%';
    if (!anim) { el.style.width = w; return; }
    el.style.width = (id && UI.prevW[id] != null ? UI.prevW[id] : '0%');
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = w; }));
    if (id) UI.prevW[id] = w;
  });
  $$('[data-count]', root).forEach((el) => {
    const id = el.dataset.id; const to = Number(el.dataset.count); const from = id && UI.prevN[id] != null ? UI.prevN[id] : to;
    if (id) UI.prevN[id] = to;
    if (!anim || from === to) { el.textContent = fmtN(to); return; }
    const t0 = performance.now(); const dur = 450;
    const step = (now) => { const p = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - p, 3); el.textContent = fmtN(Math.round(from + (to - from) * e)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  if (UI.floatXP && anim) {
    const row = root.querySelector('.task[data-k="' + CSS.escape(UI.floatXP.key) + '"]');
    if (row) { const f = document.createElement('span'); f.className = 'floatxp'; f.textContent = '+' + UI.floatXP.xp + ' XP'; row.appendChild(f); setTimeout(() => f.remove(), 1000); }
  }
  UI.floatXP = null;
  setTimeout(() => { UI.pop = null; }, 0);
}

/* Toasts */
function toast(msg, opts = {}) {
  const box = $('#toasts');
  while (box.children.length) box.firstChild.remove();
  box.classList.toggle('top', sheets.length > 0);
  const el = document.createElement('div');
  el.className = 'toast' + (opts.err ? ' err' : '');
  el.innerHTML = '<span>' + esc(msg) + '</span>';
  if (opts.action) {
    const b = document.createElement('button'); b.textContent = opts.action.label;
    b.onclick = () => { opts.action.fn(); hide(); }; el.appendChild(b);
  }
  box.appendChild(el);
  let gone = false;
  const hide = () => { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  setTimeout(hide, opts.action ? 5000 : opts.err ? 4500 : 2200);
}

/* Celebração de nível */
function celebrate(lvl) {
  const info = levelInfo(totalXP());
  const c = $('#celebrate');
  c.innerHTML = '<div class="cbox" role="dialog" aria-label="Novo nível"><div class="ring"><svg viewBox="0 0 110 110"><circle class="bgc" cx="55" cy="55" r="48"/><circle class="fg" cx="55" cy="55" r="48"/></svg><b>' + lvl + '</b></div>' +
    '<div class="ck1">Novo nível desbloqueado</div><div class="ck2">' + esc(info.name) + '</div><div class="ck3">' + esc(info.msg) + '</div></div>';
  c.hidden = false;
  const close = () => { c.hidden = true; c.onclick = null; };
  c.onclick = close;
  setTimeout(close, 3200);
}

/* Banner de armazenamento / relógio */
function updateBanner() {
  const b = $('#banner'); const msgs = [];
  if (Store.mode === 'none') msgs.push('O armazenamento local está indisponível (por exemplo, em navegação privada). Nada do que você fizer será salvo.');
  else if (saveError) msgs.push('As últimas alterações não foram salvas. ' + storageErrText(saveError) + ' Exporte um backup em Ajustes.');
  if (S && !clockOK()) msgs.push('A data do aparelho está anterior ao último uso. A pontuação fica pausada até o relógio ser corrigido.');
  b.hidden = !msgs.length; b.textContent = msgs.join(' ');
}

/* Sheets (janelas inferiores) */
const sheets = [];
function openSheet({ title, body, onMount, onClose }) {
  const root = $('#sheetRoot');
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
  sh.innerHTML = '<div class="grip"></div><div class="sh-h"><h3>' + esc(title) + '</h3><button class="close" data-close aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="sh-b">' + body + '</div>';
  root.append(scrim, sh);
  const entry = { scrim, sh, onClose };
  sheets.push(entry);
  scrim.onclick = () => closeSheet(entry);
  sh.querySelector('[data-close]').onclick = () => closeSheet(entry);
  document.body.style.overflow = 'hidden';
  if (onMount) onMount(sh.querySelector('.sh-b'), () => closeSheet(entry));
  return entry;
}
function closeSheet(entry) {
  entry = entry || sheets[sheets.length - 1];
  if (!entry || entry.closing) return;
  entry.closing = true;
  const i = sheets.indexOf(entry); if (i >= 0) sheets.splice(i, 1);
  entry.sh.classList.add('closing'); entry.scrim.classList.add('closing');
  const rm = () => { entry.sh.remove(); entry.scrim.remove(); };
  if (S && S.settings.animations) setTimeout(rm, 200); else rm();
  if (!sheets.length) document.body.style.overflow = '';
  if (entry.onClose) entry.onClose();
}
function confirmSheet({ title, text, ok = 'Confirmar', danger = false, extra = null }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const btns = (extra ? extra.map((x, i) => '<button class="btn block ' + (x.danger ? 'danger' : '') + '" data-x="' + i + '">' + esc(x.label) + '</button>').join('') : '') +
      (extra ? '' : '<button class="btn block ' + (danger ? 'danger' : 'pri') + '" data-ok>' + esc(ok) + '</button>') +
      '<button class="btn block ghost" data-no>Cancelar</button>';
    openSheet({
      title, body: (text ? '<p class="sub" style="margin-bottom:16px">' + text + '</p>' : '') + '<div style="display:grid;gap:8px">' + btns + '</div>',
      onMount: (b, close) => {
        b.querySelector('[data-no]').onclick = () => { finish(false); close(); };
        const okb = b.querySelector('[data-ok]'); if (okb) okb.onclick = () => { finish(true); close(); };
        $$('[data-x]', b).forEach((x) => { x.onclick = () => { finish(extra[+x.dataset.x].value); close(); }; });
      },
      onClose: () => finish(false)
    });
  });
}

/* =========================================================
   Componentes
   ========================================================= */
const ICON = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8L8 13.6l-4.3-4 5.8-.7z"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
};
function taskRow(it, o = {}) {
  const cls = ['task'];
  if (it.done) cls.push('done');
  if (it.orphan || it.moved) cls.push('ro');
  if (UI.pop === it.key) cls.push('pop');
  const meta = ['<span>' + esc(catName(it.cat)) + '</span>'];
  if (it.time) meta.push('<span>' + it.time + '</span>');
  if (it.priority === 2) meta.push('<span class="hi">Alta prioridade</span>');
  if (it.recurring && it.recurText) meta.push('<span>' + esc(it.recurText) + '</span>');
  if (it.moved) meta.push('<span>Transferida para ' + esc(relLabel(it.moved).toLowerCase()) + '</span>');
  if (it.orphan) meta.push('<span>Excluída</span>');
  const ck = it.orphan || it.moved
    ? '<span class="ck"><span>' + ICON.check + '</span></span>'
    : '<button class="ck" data-a="toggle" data-k="' + esc(it.key) + '" aria-label="' + (it.done ? 'Desmarcar ' : 'Concluir ') + esc(it.title) + '" aria-pressed="' + it.done + '"><span>' + ICON.check + '</span></button>';
  const body = it.orphan
    ? '<div class="body"><div class="tt">' + esc(it.title) + '</div><div class="meta">' + meta.join('') + '</div></div>'
    : '<button class="body" data-a="editTask" data-id="' + esc(it.taskId) + '" data-d="' + it.date + '"><div class="tt">' + esc(it.title) + '</div><div class="meta">' + meta.join('') + '</div></button>';
  let tail = '<span class="xp">' + (it.done ? '+' : '') + it.xp + ' XP</span>';
  if (o.reorder) {
    tail = '<div class="mv"><button data-a="move" data-k="' + esc(it.key) + '" data-dir="-1" ' + (o.idx === 0 ? 'disabled' : '') + ' aria-label="Mover para cima">' + ICON.up + '</button>' +
      '<button data-a="move" data-k="' + esc(it.key) + '" data-dir="1" ' + (o.idx === o.len - 1 ? 'disabled' : '') + ' aria-label="Mover para baixo">' + ICON.down + '</button></div>';
  } else if (o.star && !it.orphan) {
    const on = ((S.days[it.date] && S.days[it.date].prio) || []).includes(it.key);
    tail = '<span class="xp">' + (it.done ? '+' : '') + it.xp + '</span><button class="star ' + (on ? 'on' : '') + '" data-a="prio" data-k="' + esc(it.key) + '" aria-label="' + (on ? 'Remover das prioridades' : 'Marcar como prioridade') + '">' + ICON.star + '</button>';
  }
  return '<div class="' + cls.join(' ') + '" data-k="' + esc(it.key) + '">' + ck + body + tail + '</div>';
}
function segBar(st, id) {
  if (!st.total) return '<div class="segs cont"><span data-w="0" data-id="' + id + '"></span></div>';
  if (st.total > 24) return '<div class="segs cont"><span data-w="' + st.pct + '" data-id="' + id + '"></span></div>';
  let h = '<div class="segs" aria-hidden="true">';
  for (let i = 0; i < st.total; i++) h += '<i class="' + (i < st.done ? 'on' : '') + (UI.pop && i === st.done - 1 ? ' pop' : '') + '"></i>';
  return h + '</div>';
}
function levelCard() {
  const L = levelInfo(totalXP());
  return '<div class="level"><div class="lv-n num">' + L.level + '</div><div class="lv-row"><span class="lv-name">' + esc(L.name) + '</span><span class="lv-xp"><b class="num" data-count="' + totalXP() + '" data-id="tot">' + fmtN(totalXP()) + '</b> XP</span></div>' +
    '<div><div class="bar"><span data-w="' + L.pct + '" data-id="lvl"></span></div><div class="tiny" style="margin-top:5px">' + fmtN(L.toNext) + ' XP para o nível ' + (L.level + 1) + '</div></div></div>';
}
function dayPanel(date) {
  const st = dayStats(date);
  const closed = S.days[date] && S.days[date].closed;
  return '<section class="daypanel" aria-label="Progresso do dia"><div class="dp-head"><div class="dp-pct num">' + st.pct + '<small>%</small></div>' +
    '<div class="dp-count"><b>' + st.done + '</b> de <b>' + st.total + '</b> concluídas<br>' + st.pending + ' pendente' + (st.pending === 1 ? '' : 's') + '</div></div>' +
    segBar(st, 'seg-' + date) +
    '<div class="dp-xp"><span class="earned"><b class="num" data-count="' + st.earned + '" data-id="earn-' + date + '">' + fmtN(st.earned) + '</b>XP hoje · meta ' + goalOf(date) + '</span><span><b class="num">' + fmtN(st.avail) + '</b>XP disponíveis</span></div>' +
    (closed ? '<div class="closedtag">' + ICON.check.replace('<svg', '<svg style="width:16px;height:16px"') + ' Dia encerrado às ' + fmtTime(closed.at) + '</div>' : '') +
    '</section>';
}

/* =========================================================
   Telas
   ========================================================= */
const VIEWS = {};

VIEWS.inicio = () => {
  const t = todayKey();
  const h = new Date().getHours();
  const sauda = (h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + (S.settings.name ? ', ' + esc(S.settings.name) : '') + '.';
  const L = levelInfo(totalXP());
  const st = dayStats(t);
  const f = UI.filter;
  let items = st.items;
  if (f === 'pendentes') items = items.filter((i) => !i.done);
  else if (f === 'concluidas') items = items.filter((i) => i.done);
  else if (f.startsWith('cat:')) items = items.filter((i) => i.cat === f.slice(4));
  const usedCats = [...new Set(st.items.map((i) => i.cat))];
  const chips = [['todas', 'Todas'], ['pendentes', 'Pendentes'], ['concluidas', 'Concluídas']].concat(usedCats.map((c) => ['cat:' + c, catName(c)]))
    .map(([k, l]) => '<button class="chip ' + (f === k ? 'on' : '') + '" data-a="filter" data-f="' + esc(k) + '">' + esc(l) + '</button>').join('');
  const streak = currentStreak();
  let list;
  if (!st.total) list = '<div class="empty"><b>Seu dia está livre.</b>Toque em “Nova tarefa” para criar a primeira vitória de hoje.</div>';
  else if (!items.length) list = '<div class="empty">Nenhuma tarefa neste filtro.</div>';
  else list = '<div class="list">' + items.map((i) => taskRow(i)).join('') + '</div>';
  return '<header class="top"><div><h1 class="brand">Focus<i></i></h1><div class="date">' + fmtLong(t) + '</div><div class="greet">' + sauda + '</div></div>' +
    '<button class="lvlchip" data-tab="evolucao" aria-label="Nível ' + L.level + '"><b>' + L.level + '</b>' + esc(L.name) + '</button></header>' +
    levelCard() + dayPanel(t) +
    (streak ? '<p class="tiny" style="margin:8px 4px 0">Sequência: <b class="num" style="color:var(--tx)">' + streak + '</b> dia' + (streak === 1 ? '' : 's') + ' atingindo a meta diária.</p>' : '') +
    '<div class="chips" role="tablist">' + chips + '</div>' + list +
    (st.total ? '<div class="actions" style="margin-top:18px"><button class="btn ghost block" data-a="closeDay" data-d="' + t + '">Fechamento do dia</button></div>' : '');
};

VIEWS.dia = () => {
  const today = todayKey();
  const d = UI.dayView || today;
  const st = dayStats(d);
  const pr = ((S.days[d] && S.days[d].prio) || []).map((k) => st.items.find((i) => i.key === k)).filter(Boolean);
  let prioHtml = '<div class="prio">';
  for (let i = 0; i < 3; i++) {
    prioHtml += pr[i] ? taskRow(pr[i], { star: true }) : '<div class="slot"><b>' + (i + 1) + '</b>' + (i === pr.length ? 'Toque na estrela de uma tarefa para defini-la como prioridade.' : 'Livre') + '</div>';
  }
  prioHtml += '</div>';
  const others = st.items.filter((i) => !pr.includes(i));
  let list = '';
  if (UI.reorder) {
    list = '<div class="list">' + st.items.map((it, idx) => taskRow(it, { reorder: true, idx, len: st.items.length })).join('') + '</div>';
  } else if (!others.length) {
    list = st.total ? '<p class="tiny">Todas as tarefas do dia estão nas prioridades.</p>' : '<div class="empty"><b>Nada planejado.</b>Adicione tarefas, hábitos ou use o planejamento rápido.</div>';
  } else if (S.settings.groupByPeriod) {
    const groups = [['Manhã', (t) => t && t < '12:00'], ['Tarde', (t) => t && t >= '12:00' && t < '18:00'], ['Noite', (t) => t && t >= '18:00'], ['Sem horário', (t) => !t]];
    list = groups.map(([name, fn]) => { const g = others.filter((i) => fn(i.time)); return g.length ? '<div class="group-h">' + name + '</div><div class="list">' + g.map((i) => taskRow(i, { star: true })).join('') + '</div>' : ''; }).join('');
  } else list = '<div class="list">' + others.map((i) => taskRow(i, { star: true })).join('') + '</div>';
  const sortOpts = [['prioridade', 'Prioridade'], ['horario', 'Horário'], ['manual', 'Personalizada']];
  return '<h1 class="title">Meu dia</h1>' +
    '<div class="datenav"><button class="dn" data-a="dayNav" data-n="-1" aria-label="Dia anterior">' + ICON.left + '</button>' +
    '<button class="dl" data-a="pickDay"><span>' + esc(relLabel(d)) + '</span><small>' + fmtFull(d) + '</small></button>' +
    '<button class="dn" data-a="dayNav" data-n="1" aria-label="Próximo dia">' + ICON.right + '</button></div>' +
    (d !== today ? '<p class="tiny" style="margin:-6px 0 12px;text-align:center"><button class="link" data-a="dayNav" data-n="0">Voltar para hoje</button></p>' : '') +
    '<div class="kv" style="margin-bottom:6px"><div><div class="k">XP conquistado</div><div class="v num">' + fmtN(st.earned) + '<small>/ ' + goalOf(d) + '</small></div></div>' +
    '<div><div class="k">XP disponível</div><div class="v num">' + fmtN(st.avail) + '</div></div></div>' +
    (UI.reorder ? '' : '<h2>Três prioridades</h2>' + prioHtml) +
    '<div class="spread" style="margin:26px 0 10px"><h2 style="margin:0">' + (UI.reorder ? 'Reorganizar' : 'Tarefas e hábitos') + '</h2>' +
    (st.total > 1 ? '<button class="link" data-a="reorder">' + (UI.reorder ? 'Concluir' : 'Reorganizar') + '</button>' : '') + '</div>' +
    (UI.reorder ? '' : '<div class="chips" style="margin-top:0">' + sortOpts.map(([k, l]) => '<button class="chip ' + (S.settings.sortMode === k ? 'on' : '') + '" data-a="sort" data-s="' + k + '">' + l + '</button>').join('') +
      '<button class="chip ' + (S.settings.groupByPeriod ? 'on' : '') + '" data-a="groupPeriod">Por período</button></div>') +
    list +
    (UI.reorder ? '' : '<div class="actions" style="margin-top:20px"><button class="btn sm" data-a="quickPlan" data-d="' + (d === today ? addDays(today, 1) : d) + '">Planejar ' + (d === today ? 'amanhã' : 'este dia') + '</button>' +
      '<button class="btn sm" data-a="copyDay" data-d="' + d + '">Copiar tarefas</button>' +
      '<button class="btn sm" data-a="newHabit" data-d="' + d + '">Novo hábito</button>' +
      (d <= today && st.total ? '<button class="btn sm" data-a="closeDay" data-d="' + d + '">Fechamento</button>' : '') + '</div>');
};

VIEWS.metas = () => {
  const seg = '<div class="seg" style="margin:12px 0 4px"><button class="' + (UI.metasSeg === 'metas' ? 'on' : '') + '" data-a="metasSeg" data-s="metas">Metas</button><button class="' + (UI.metasSeg === 'desafios' ? 'on' : '') + '" data-a="metasSeg" data-s="desafios">Desafios</button></div>';
  return '<h1 class="title">Metas</h1>' + seg + (UI.metasSeg === 'metas' ? goalsView() : challengesView());
};
function goalsView() {
  const t = todayKey();
  const act = S.goals.filter((g) => g.status !== 'done');
  const upcoming = act.filter((g) => g.deadline && diffDays(t, g.deadline) <= 30).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 4);
  const f = UI.goalFilter;
  const filt = { andamento: (g) => g.status !== 'done' && !goalLate(g), atrasadas: goalLate, concluidas: (g) => g.status === 'done', todas: () => true }[f];
  const list = S.goals.filter(filt).sort((a, b) => (b.priority - a.priority) || (a.deadline || '9').localeCompare(b.deadline || '9'));
  const counts = { andamento: S.goals.filter((g) => g.status !== 'done' && !goalLate(g)).length, atrasadas: S.goals.filter(goalLate).length, concluidas: S.goals.filter((g) => g.status === 'done').length };
  let h = '';
  if (upcoming.length) {
    h += '<h2>Próximos prazos</h2><div class="card">' + upcoming.map((g) => {
      const dd = diffDays(t, g.deadline);
      const when = dd < 0 ? '<span class="badge red">' + (-dd) + 'd de atraso</span>' : dd === 0 ? '<span class="badge acc">Hoje</span>' : '<span class="badge">em ' + dd + 'd</span>';
      return '<div class="spread" style="padding:6px 0"><span>' + esc(g.title) + '</span>' + when + '</div>';
    }).join('') + '</div>';
  }
  h += '<div class="chips">' + [['andamento', 'Em andamento'], ['atrasadas', 'Atrasadas'], ['concluidas', 'Concluídas'], ['todas', 'Todas']]
    .map(([k, l]) => '<button class="chip ' + (f === k ? 'on' : '') + '" data-a="goalFilter" data-f="' + k + '">' + l + (counts[k] ? ' ' + counts[k] : '') + '</button>').join('') + '</div>';
  if (!S.goals.length) h += '<div class="empty"><b>Defina sua primeira meta.</b>Ler 5 livros, fazer as primeiras 10 vendas, treinar 30 dias… divida em etapas e acompanhe.</div>';
  else if (!list.length) h += '<div class="empty">Nenhuma meta neste filtro.</div>';
  h += list.map(goalCard).join('');
  h += '<div class="actions"><button class="btn pri block" data-a="newGoal">' + ICON.plus.replace('<svg', '<svg style="width:18px;height:18px;stroke-width:2.4"') + 'Nova meta</button></div>';
  return h;
}
function goalCard(g) {
  const p = goalProgress(g);
  const hz = { curto: 'Curto prazo', medio: 'Médio prazo', longo: 'Longo prazo' }[g.horizon] || '';
  const meta = ['<span>' + esc(catName(g.cat)) + '</span>', hz ? '<span>' + hz + '</span>' : ''];
  if (g.deadline) meta.push('<span class="' + (goalLate(g) ? 'late' : '') + '">' + (goalLate(g) ? 'Atrasada · ' : 'Prazo ') + fmtShort(g.deadline) + '</span>');
  if (g.priority === 2) meta.push('<span style="color:var(--warn)">Alta prioridade</span>');
  const sub = g.mode === 'steps' ? p.cur + ' de ' + g.steps.length + ' etapas' : g.mode === 'value' ? fmtN(p.cur) + ' de ' + fmtN(p.tgt) + ' ' + esc(g.unit || '') : p.cur + ' de ' + p.tgt + ' conclusões';
  return '<button class="goal ' + (g.status === 'done' ? 'done' : '') + '" data-a="openGoal" data-id="' + g.id + '"><div class="spread"><span class="gt">' + esc(g.title) + '</span>' +
    (g.status === 'done' ? '<span class="badge acc">Concluída</span>' : p.full ? '<span class="badge acc">100%</span>' : '') + '</div>' +
    '<div class="gm">' + meta.join('') + '</div><div class="gp"><div class="bar"><span data-w="' + p.pct + '" data-id="g-' + g.id + '"></span></div><b>' + p.pct + '%</b></div>' +
    '<div class="tiny" style="margin-top:6px">' + sub + '</div></button>';
}
function challengesView() {
  const t = todayKey();
  const list = S.challenges.slice().sort((a, b) => (chStatus(a).st === 'ativo' ? 0 : 1) - (chStatus(b).st === 'ativo' ? 0 : 1) || b.createdAt - a.createdAt);
  const streak = currentStreak(); const best = Math.max(0, ...streakRuns().map((r) => r.len));
  let h = '<div class="kv" style="margin-top:14px"><div><div class="k">Sequência atual</div><div class="v num">' + streak + '<small>' + diasW(streak) + '</small></div></div><div><div class="k">Melhor sequência</div><div class="v num">' + best + '<small>' + diasW(best) + '</small></div></div></div>' +
    '<p class="tiny" style="margin:8px 4px 0">A sequência conta os dias em que você atingiu a meta diária de ' + S.settings.dailyGoal + ' XP. Perdeu um dia? Ela recomeça a partir do próximo.</p>';
  h += '<h2>Seus desafios</h2>';
  if (!list.length) h += '<div class="empty"><b>Nenhum desafio ainda.</b>Crie um desafio de 7, 21, 30 ou 66 dias e acompanhe dia a dia.</div>';
  for (const c of list) {
    const s = chStatus(c);
    const badge = { ativo: '<span class="badge">Em andamento</span>', concluido: '<span class="badge acc">Concluído</span>', encerrado: '<span class="badge">Encerrado</span>', agendado: '<span class="badge">Começa ' + fmtShort(c.start) + '</span>', inviavel: '<span class="badge red">Recomece quando quiser</span>' }[s.st];
    const dots = s.days.map((d) => '<i class="' + (chMet(c, d) ? 'ok' : d > t ? 'fut' : d === t ? 'fut' : 'miss') + '" title="' + d + '"></i>').join('');
    const canCheck = c.criterion === 'checkin' && s.days.includes(t) && !c.checkins[t] && s.st !== 'encerrado';
    const yd = addDays(t, -1);
    const canCheckY = c.criterion === 'checkin' && s.days.includes(yd) && !c.checkins[yd] && yd >= c.start;
    h += '<div class="card"><button class="card tap" style="padding:0;margin:0;background:none" data-a="openCh" data-id="' + c.id + '"><div class="spread"><h3>' + esc(c.name) + '</h3>' + badge + '</div>' +
      (c.objective ? '<p class="sub" style="margin-top:4px">' + esc(c.objective) + '</p>' : '') +
      '<div class="dots">' + dots + '</div><div class="tiny">' + s.met + ' de ' + s.req + ' dias necessários · ' + critLabel(c) + '</div></button>' +
      ((canCheck || canCheckY) ? '<div class="actions">' + (canCheck ? '<button class="btn sm pri" data-a="checkin" data-id="' + c.id + '" data-d="' + t + '">Registrar hoje</button>' : '') +
        (canCheckY ? '<button class="btn sm" data-a="checkin" data-id="' + c.id + '" data-d="' + yd + '">Registrar ontem</button>' : '') + '</div>' : '') + '</div>';
  }
  h += '<div class="actions"><button class="btn pri block" data-a="newCh">' + ICON.plus.replace('<svg', '<svg style="width:18px;height:18px;stroke-width:2.4"') + 'Novo desafio</button></div>';
  return h;
}
function critLabel(c) {
  if (c.criterion === 'xp') return 'atingir a meta diária de XP';
  if (c.criterion === 'task') { const t = taskById(c.taskId); return 'concluir “' + esc(t ? t.title : 'tarefa excluída') + '”'; }
  return 'registro manual';
}

VIEWS.evolucao = () => {
  const t = todayKey();
  const total = totalXP(); const L = levelInfo(total);
  const doneAll = Object.keys(S.occ).length;
  const runs = streakRuns(); const best = Math.max(0, ...runs.map((r) => r.len));
  let h = '<h1 class="title">Evolução</h1><p class="sub" style="margin-bottom:14px">Nível ' + L.level + ', ' + esc(L.name) + '. ' + esc(L.msg) + '</p>';
  h += '<div class="kv"><div><div class="k">XP total</div><div class="v num">' + fmtN(total) + '</div></div><div><div class="k">Tarefas concluídas</div><div class="v num">' + fmtN(doneAll) + '</div></div>' +
    '<div><div class="k">Sequência atual</div><div class="v num">' + currentStreak() + '<small>' + diasW(currentStreak()) + '</small></div></div><div><div class="k">Melhor sequência</div><div class="v num">' + best + '<small>' + diasW(best) + '</small></div></div></div>';

  // Últimos 7 dias
  const days7 = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  h += '<h2>Últimos 7 dias</h2><div class="card">' + barChart(days7.map((d) => ({ label: WD1[weekday(d)], v: xpOn(d), met: metOn(d), goal: goalOf(d) })), true);
  const rates = days7.map((d) => dayStats(d)).filter((s) => s.total);
  const avgRate = rates.length ? Math.round(rates.reduce((a, s) => a + s.pct, 0) / rates.length) : null;
  const sumW = days7.reduce((a, d) => a + xpOn(d), 0);
  const prevW = days7.reduce((a, d) => a + xpOn(addDays(d, -7)), 0);
  h += '<div class="spread tiny" style="margin-top:10px"><span>' + fmtN(sumW) + ' XP na semana' + (prevW || sumW ? ' (' + (sumW >= prevW ? '+' : '−') + fmtN(Math.abs(sumW - prevW)) + ' vs. anterior)' : '') + '</span><span>' +
    (avgRate == null ? 'Sem tarefas registradas' : 'Conclusão média ' + avgRate + '%') + '</span></div></div>';

  // Semanas e meses
  const seg = '<div class="seg" style="margin-bottom:10px"><button class="' + (UI.evoRange === 'semana' ? 'on' : '') + '" data-a="evoRange" data-r="semana">Semanas</button><button class="' + (UI.evoRange === 'mes' ? 'on' : '') + '" data-a="evoRange" data-r="mes">Meses</button></div>';
  let series = [];
  if (UI.evoRange === 'semana') {
    const mon = addDays(t, -((weekday(t) + 6) % 7));
    for (let i = 7; i >= 0; i--) { const s = addDays(mon, -7 * i); let v = 0; for (let j = 0; j < 7; j++) v += xpOn(addDays(s, j)); series.push({ label: fmtShort(s).split(' ')[0] + '/' + (parseKey(s).getMonth() + 1), v }); }
  } else {
    const d0 = parseKey(t);
    for (let i = 5; i >= 0; i--) { const m = new Date(d0.getFullYear(), d0.getMonth() - i, 1, 12); const pre = m.getFullYear() + '-' + pad(m.getMonth() + 1); let v = 0; for (const [k, x] of Object.entries(getMemo().xpBy)) if (k.startsWith(pre)) v += x; series.push({ label: MONTHS[m.getMonth()].slice(0, 3), v }); }
  }
  h += '<h2>Evolução ' + (UI.evoRange === 'semana' ? 'semanal' : 'mensal') + '</h2>' + seg + '<div class="card">' + barChart(series, false) + '</div>';

  // Calendário de consistência
  const mk = UI.evoMonth || t.slice(0, 7);
  const [yy, mm] = mk.split('-').map(Number);
  const first = new Date(yy, mm - 1, 1, 12); const ndays = new Date(yy, mm, 0).getDate();
  let cal = '<div class="cal">' + WD1.map((w) => '<div class="wd">' + w + '</div>').join('');
  for (let i = 0; i < first.getDay(); i++) cal += '<div class="pad"></div>';
  for (let dd = 1; dd <= ndays; dd++) {
    const k = yy + '-' + pad(mm) + '-' + pad(dd);
    const x = xpOn(k); const g = goalOf(k);
    let lv = ''; if (x > 0) lv = x >= g ? 'l3' : x >= g / 2 ? 'l2' : 'l1';
    cal += '<button class="' + lv + (k === t ? ' today' : '') + (k > t ? ' fut' : '') + '" data-a="dayDetail" data-d="' + k + '" aria-label="' + fmtFull(k) + ', ' + x + ' XP">' + dd + '</button>';
  }
  cal += '</div><div class="legend"><span><i style="background:var(--s1);box-shadow:inset 0 0 0 1px var(--s3)"></i>Sem XP</span><span><i style="background:color-mix(in srgb,var(--ac) 22%,var(--s1))"></i>Início</span><span><i style="background:color-mix(in srgb,var(--ac) 50%,var(--s1))"></i>Metade da meta</span><span><i style="background:var(--ac)"></i>Meta atingida</span></div>';
  const prevM = (() => { const d = new Date(yy, mm - 2, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); })();
  const nextM = (() => { const d = new Date(yy, mm, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); })();
  h += '<h2>Consistência</h2><div class="card"><div class="datenav" style="margin:0 0 12px"><button class="dn" data-a="evoMonth" data-m="' + prevM + '" aria-label="Mês anterior">' + ICON.left + '</button><div class="dl">' + cap(MONTHS[mm - 1]) + ' de ' + yy + '</div>' +
    '<button class="dn" data-a="evoMonth" data-m="' + nextM + '" aria-label="Próximo mês" ' + (nextM > t.slice(0, 7) ? 'disabled style="opacity:.3"' : '') + '>' + ICON.right + '</button></div>' + cal + '</div>';

  // Categorias
  const since = addDays(t, -29); const byCat = {};
  for (const o of Object.values(S.occ)) if (o.date >= since && o.date <= t) byCat[o.cat] = (byCat[o.cat] || 0) + 1;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]); const maxC = cats.length ? cats[0][1] : 1;
  h += '<h2>Categorias (30 dias)</h2><div class="card">' + (cats.length ? cats.map(([c, n]) => '<div class="hbar"><span>' + esc(catName(c)) + '</span><div class="bar"><span data-w="' + Math.round((n / maxC) * 100) + '"></span></div><b>' + n + '</b></div>').join('') : '<p class="tiny" style="margin:0">Conclua tarefas para ver em quais áreas você mais avança.</p>') + '</div>';

  // Sequências
  h += '<h2>Histórico de sequências</h2><div class="card">' + (runs.length ? runs.slice(-8).reverse().map((r) => '<div class="spread" style="padding:6px 0"><span>' + fmtShort(r.start) + (r.len > 1 ? ' a ' + fmtShort(r.end) : '') + '</span><b class="num">' + r.len + ' dia' + (r.len > 1 ? 's' : '') + '</b></div>').join('') : '<p class="tiny" style="margin:0">Atinja a meta diária de XP para iniciar uma sequência.</p>') + '</div>';

  // Metas concluídas
  const gd = S.goals.filter((g) => g.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  h += '<h2>Metas concluídas</h2><div class="card">' + (gd.length ? gd.slice(0, 10).map((g) => '<div class="spread" style="padding:6px 0"><span>' + esc(g.title) + '</span><span class="tiny">' + (g.doneAt ? fmtShort(dateKey(new Date(g.doneAt))) : '') + '</span></div>').join('') : '<p class="tiny" style="margin:0">Nenhuma meta concluída ainda.</p>') + '</div>';

  // Histórico de XP
  const led = S.ledger.slice().reverse(); const show = UI.ledgerMore ? led.slice(0, 300) : led.slice(0, 15);
  h += '<h2>Histórico de XP</h2><div class="card ledger">' + (show.length ? show.map((e) => '<div><span><span>' + esc(e.label) + '</span><span class="d"> ' + (e.kind === 'undo' ? 'desmarcada' : e.kind === 'revert' ? 'estorno' : 'concluída') + ' · ' + fmtShort(e.date) + '</span></span><b class="' + (e.delta >= 0 ? 'pos' : 'neg') + '">' + (e.delta >= 0 ? '+' : '−') + Math.abs(e.delta) + ' XP</b></div>').join('') : '<p class="tiny" style="margin:0">Cada ponto ganho ou revertido aparece aqui.</p>') +
    (led.length > show.length ? '<div style="border:0;justify-content:center"><button class="link" data-a="ledgerMore">Mostrar mais</button></div>' : '') + '</div>';
  return h;
};
function barChart(data, withGoal) {
  const W = 340, H = 150, top = 14, bot = 22, n = data.length, gap = 8;
  const maxV = Math.max(1, ...data.map((d) => d.v), ...(withGoal ? data.map((d) => d.goal) : []));
  const bw = (W - gap * (n - 1)) / n; const ch = H - top - bot;
  let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gráfico de XP">';
  data.forEach((d, i) => {
    const x = i * (bw + gap); const bh = d.v > 0 ? Math.max(3, (d.v / maxV) * ch) : 0;
    s += '<rect class="b' + (d.met ? ' met' : '') + '" x="' + x.toFixed(1) + '" y="' + (top + ch - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4"/>';
    if (d.v > 0) s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (top + ch - bh - 4).toFixed(1) + '" text-anchor="middle">' + d.v + '</text>';
    s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(d.label) + '</text>';
  });
  if (withGoal) { const g = data[data.length - 1].goal; const y = top + ch - (g / maxV) * ch; s += '<line class="gl" x1="0" x2="' + W + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>'; }
  return s + '</svg>' + (data.every((d) => !d.v) ? '<p class="tiny" style="margin:6px 0 0">Ainda não há XP registrado neste período.</p>' : '');
}

VIEWS.ajustes = () => {
  const s = S.settings;
  const sw = (id, on) => '<label class="switch"><input type="checkbox" id="' + id + '" ' + (on ? 'checked' : '') + '><span></span></label>';
  const xpRows = Object.keys(KINDS).map((k) => '<div class="setrow"><span>' + KINDS[k] + '</span><input class="inp num" type="number" inputmode="numeric" min="1" max="200" data-xpk="' + k + '" value="' + s.xp[k] + '"></div>').join('');
  const cats = S.categories.map((c) => '<div class="catrow"><input class="inp" data-cat="' + c.id + '" value="' + esc(c.name) + '" maxlength="24" aria-label="Nome da categoria">' +
    (c.id === 'outros' ? '<span class="iconbtn" style="opacity:.3" aria-hidden="true">' + ICON.trash + '</span>' : '<button class="iconbtn" data-a="delCat" data-id="' + c.id + '" aria-label="Excluir categoria ' + esc(c.name) + '">' + ICON.trash + '</button>') + '</div>').join('');
  const hours = [0, 1, 2, 3, 4, 5].map((h) => '<option value="' + h + '" ' + (s.dayStartHour === h ? 'selected' : '') + '>' + (h === 0 ? 'À meia-noite' : 'Às ' + pad(h) + ':00') + '</option>').join('');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return '<h1 class="title">Ajustes</h1>' +
    '<h2>Perfil</h2><div class="card"><div class="field" style="margin:0"><label for="setName">Seu nome (opcional)</label><input class="inp" id="setName" maxlength="30" autocomplete="given-name" value="' + esc(s.name) + '" placeholder="Como quer ser chamado"></div></div>' +
    '<h2>Pontuação</h2><div class="card"><div class="setrow"><span>Meta diária de XP</span><input class="inp num" type="number" inputmode="numeric" min="10" max="2000" id="setGoal" value="' + s.dailyGoal + '"></div>' + xpRows +
    '<p class="note">Valores padrão ao criar tarefas. Mudanças não alteram XP já conquistado.</p></div>' +
    '<h2>Categorias</h2><div class="card" id="catBox">' + cats + '<div class="catrow"><input class="inp" id="newCat" maxlength="24" placeholder="Nova categoria"><button class="iconbtn" data-a="addCat" aria-label="Adicionar categoria">' + ICON.plus + '</button></div></div>' +
    '<h2>Aparência</h2><div class="card"><div class="setrow"><span>Tema claro</span>' + sw('setLight', s.theme === 'light') + '</div><div class="setrow"><span>Animações</span>' + sw('setAnim', s.animations) + '</div></div>' +
    '<h2>Dia</h2><div class="card"><div class="setrow"><span>O dia começa</span><select class="inp" id="setStart">' + hours + '</select></div><p class="note">Útil se você costuma dormir depois da meia-noite: tarefas feitas antes desse horário contam para o dia anterior.</p></div>' +
    '<h2>Backup</h2><div class="card"><p class="sub" style="margin-bottom:12px">Seus dados ficam apenas neste aparelho. Exporte um backup com frequência e guarde-o no app Arquivos ou no iCloud Drive.</p>' +
    '<div style="display:grid;gap:8px"><button class="btn block" data-a="export">Exportar backup</button><button class="btn block" data-a="import">Importar backup</button></div>' +
    '<p class="note">Último backup: ' + (S.meta.lastExport ? fmtShort(dateKey(new Date(S.meta.lastExport))) + ' às ' + fmtTime(S.meta.lastExport) : 'nunca') + '</p></div>' +
    '<h2>Restaurar</h2><div class="card" style="display:grid;gap:8px"><button class="btn block" data-a="resetSettings">Restaurar configurações padrão</button><button class="btn block danger" data-a="wipe">Apagar todos os dados</button></div>' +
    '<h2>Sobre</h2><div class="card"><p class="sub">Focus ' + APP_VERSION + '. Funciona offline, sem conta e sem anúncios. Nada é enviado para servidores; os dados não são sincronizados entre aparelhos.</p>' +
    '<p class="note">Armazenamento: ' + ({ idb: 'IndexedDB', ls: 'localStorage', none: 'indisponível' }[Store.mode]) + (S.meta.persisted ? ', persistente' : '') + '. ' + (standalone ? 'Aberto como aplicativo.' : 'Aberto no navegador. Para instalar: Compartilhar › Adicionar à Tela de Início.') + '</p></div>';
};

/* =========================================================
   Formulários
   ========================================================= */
function catOptions(sel) { return S.categories.map((c) => '<option value="' + c.id + '" ' + (c.id === sel ? 'selected' : '') + '>' + esc(c.name) + '</option>').join(''); }

function taskForm({ id = null, date = null, habit = false } = {}) {
  const t = id ? taskById(id) : null;
  if (id && !t) { toast('Tarefa não encontrada.'); return; }
  const today = todayKey();
  const f = t ? JSON.parse(JSON.stringify(t)) : {
    title: '', desc: '', cat: 'pessoal', kind: habit ? 'habito' : 'simples', xp: S.settings.xp[habit ? 'habito' : 'simples'],
    date: date || today, time: '', priority: 1, recur: { type: habit ? 'daily' : 'none', days: [] }
  };
  const ctxDate = date || today;
  const doneLocked = t && t.recur.type === 'none' && !!S.occ[occKey(t.id, t.date)];
  const anyDone = t && Object.values(S.occ).some((o) => o.taskId === t.id);
  const body =
    '<div class="field"><input class="inp big" id="fTitle" maxlength="80" placeholder="O que você vai fazer?" value="' + esc(f.title) + '" autocomplete="off" enterkeyhint="done"><div class="errmsg" id="eTitle" hidden></div></div>' +
    '<div class="field"><span class="lbl">Tipo e pontuação</span><div class="opt acc" id="fKind">' + Object.keys(KINDS).map((k) => '<button type="button" data-o="' + k + '" class="' + (f.kind === k ? 'on' : '') + '">' + KINDS[k] + ' ' + S.settings.xp[k] + '</button>').join('') + '</div></div>' +
    '<div class="grid2"><div class="field"><label for="fXp">XP</label><input class="inp num" id="fXp" type="number" inputmode="numeric" min="1" max="200" value="' + f.xp + '"></div>' +
    '<div class="field"><label for="fCat">Categoria</label><select class="inp" id="fCat">' + catOptions(f.cat) + '</select></div></div>' +
    '<div class="grid2"><div class="field"><label for="fDate">' + (f.recur.type === 'none' ? 'Data' : 'Começa em') + '</label><input class="inp" id="fDate" type="date" value="' + f.date + '" ' + (doneLocked ? 'disabled' : '') + '></div>' +
    '<div class="field"><label for="fTime">Horário (opcional)</label><input class="inp" id="fTime" type="time" value="' + (f.time || '') + '"></div></div>' +
    (doneLocked ? '<p class="note" style="margin-top:-8px;margin-bottom:12px">Tarefa concluída: a data fica fixa para não gerar pontos em dobro.</p>' : '') +
    '<div class="field"><span class="lbl">Repetir</span><div class="opt" id="fRec">' + [['none', 'Não'], ['daily', 'Todo dia'], ['days', 'Dias da semana'], ['weekly', 'Semanal']].map(([k, l]) => '<button type="button" data-o="' + k + '" class="' + (f.recur.type === k ? 'on' : '') + '" ' + (doneLocked && k !== 'none' ? 'disabled style="opacity:.35"' : '') + '>' + l + '</button>').join('') + '</div>' +
    '<div class="opt" id="fDays" style="margin-top:8px" ' + (f.recur.type === 'days' ? '' : 'hidden') + '>' + [1, 2, 3, 4, 5, 6, 0].map((d) => '<button type="button" class="wd ' + (f.recur.days.includes(d) ? 'on' : '') + '" data-o="' + d + '" aria-label="' + WD3[d] + '">' + WD1[d] + '</button>').join('') + '</div><div class="errmsg" id="eDays" hidden></div></div>' +
    '<div class="field"><span class="lbl">Prioridade</span><div class="opt" id="fPrio">' + PRIOS.map((l, i) => '<button type="button" data-o="' + i + '" class="' + (f.priority === i ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div>' +
    '<details class="more" ' + (f.desc ? 'open' : '') + '><summary>Descrição</summary><div class="field"><textarea class="inp" id="fDesc" maxlength="500" placeholder="Detalhes opcionais">' + esc(f.desc || '') + '</textarea></div></details>' +
    (anyDone ? '<p class="note" style="margin-bottom:12px">Alterações de XP valem para as próximas conclusões. O XP já conquistado não muda.</p>' : '') +
    '<button class="btn pri block" id="fSave">' + (t ? 'Salvar alterações' : 'Criar tarefa') + '</button>' +
    (t ? '<button class="btn block danger" id="fDel" style="margin-top:8px">Excluir tarefa</button>' : '');

  openSheet({
    title: t ? 'Editar tarefa' : habit ? 'Novo hábito' : 'Nova tarefa', body,
    onMount: (b, close) => {
      const opt = (box, fn) => box.addEventListener('click', (e) => { const x = e.target.closest('[data-o]'); if (!x || x.disabled) return; fn(x.dataset.o, x); });
      const single = (box, v) => $$('[data-o]', box).forEach((x) => x.classList.toggle('on', x.dataset.o === String(v)));
      opt($('#fKind', b), (k) => {
        f.kind = k; single($('#fKind', b), k); $('#fXp', b).value = S.settings.xp[k];
        if (k === 'habito' && f.recur.type === 'none' && !doneLocked) { f.recur.type = 'daily'; single($('#fRec', b), 'daily'); $('#fDays', b).hidden = true; $('label[for="fDate"]', b).textContent = 'Começa em'; }
      });
      opt($('#fRec', b), (k) => { f.recur.type = k; single($('#fRec', b), k); $('#fDays', b).hidden = k !== 'days'; $('label[for="fDate"]', b).textContent = k === 'none' ? 'Data' : 'Começa em'; if (k === 'days' && !f.recur.days.length) { f.recur.days = [weekday(ctxDate)]; single($('#fDays', b), ''); $$('[data-o="' + weekday(ctxDate) + '"]', $('#fDays', b)).forEach((x) => x.classList.add('on')); } });
      opt($('#fDays', b), (d, x) => { d = +d; const i = f.recur.days.indexOf(d); if (i >= 0) f.recur.days.splice(i, 1); else f.recur.days.push(d); x.classList.toggle('on', i < 0); });
      opt($('#fPrio', b), (p) => { f.priority = +p; single($('#fPrio', b), p); });
      if (!t) setTimeout(() => $('#fTitle', b).focus(), 280);
      $('#fTitle', b).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#fSave', b).click(); } });
      $('#fSave', b).onclick = () => {
        const title = $('#fTitle', b).value.trim().replace(/\s+/g, ' ');
        const xp = parseInt($('#fXp', b).value, 10);
        const dt = $('#fDate', b).value; const tm = $('#fTime', b).value;
        let ok = true;
        const err = (id, msg) => { const e = $('#' + id, b); e.textContent = msg; e.hidden = !msg; };
        err('eTitle', ''); err('eDays', ''); $('#fTitle', b).classList.remove('err');
        if (!title) { err('eTitle', 'Dê um nome à tarefa.'); $('#fTitle', b).classList.add('err'); ok = false; }
        if (!(xp >= XP_MIN && xp <= XP_MAX)) { toast('O XP deve ficar entre ' + XP_MIN + ' e ' + XP_MAX + '.'); ok = false; }
        if (!isKey(dt)) { toast('Escolha uma data válida.'); ok = false; }
        if (tm && !isTime(tm)) { toast('Horário inválido.'); ok = false; }
        if (f.recur.type === 'days' && !f.recur.days.length) { err('eDays', 'Escolha pelo menos um dia da semana.'); ok = false; }
        if (!ok) return;
        const data = { title, desc: $('#fDesc', b).value.trim(), cat: $('#fCat', b).value, kind: f.kind, xp, date: doneLocked ? t.date : dt, time: tm || '', priority: f.priority,
          recur: { type: f.recur.type, days: f.recur.type === 'days' ? f.recur.days.slice().sort() : [] } };
        if (t) { Object.assign(t, data); t.updatedAt = Date.now(); toast('Tarefa atualizada.'); }
        else { S.tasks.push({ id: uid(), createdAt: Date.now(), skips: [], endDate: null, deleted: false, movedTo: null, ...data }); toast(data.recur.type === 'none' ? 'Tarefa criada.' : 'Hábito criado.'); }
        commit(); close(); render();
      };
      if (t) $('#fDel', b).onclick = () => deleteTask(t, ctxDate, close);
    }
  });
}

async function deleteTask(t, ctxDate, closeForm) {
  const snapshot = JSON.parse(JSON.stringify(t));
  let reverted = false;
  if (t.recur.type !== 'none') {
    const choice = await confirmSheet({
      title: 'Excluir hábito', text: 'As ocorrências já concluídas continuam no seu histórico, com o XP conquistado.',
      extra: [{ label: 'Só em ' + relLabel(ctxDate).toLowerCase(), value: 'one' }, { label: 'Desta data em diante', value: 'future', danger: true }]
    });
    if (!choice) return;
    if (choice === 'one') { if (!t.skips.includes(ctxDate)) t.skips.push(ctxDate); }
    else { if (ctxDate <= t.date) t.deleted = true; else t.endDate = addDays(ctxDate, -1); }
  } else {
    const o = S.occ[occKey(t.id, t.date)];
    if (o) {
      const choice = await confirmSheet({
        title: 'Excluir tarefa concluída', text: 'Esta tarefa rendeu ' + o.xp + ' XP. Escolha o que fazer com esses pontos.',
        extra: [{ label: 'Excluir e manter o XP', value: 'keep' }, { label: 'Excluir e estornar ' + o.xp + ' XP', value: 'revert', danger: true }]
      });
      if (!choice) return;
      if (choice === 'revert') {
        S.ledger.push({ id: uid(), ts: Date.now(), date: o.date, delta: -o.xp, kind: 'revert', label: o.title, key: occKey(t.id, t.date) });
        delete S.occ[occKey(t.id, t.date)];
        reverted = true;
      }
      t.deleted = true; t.deletedAt = Date.now();
    } else {
      const ok = await confirmSheet({ title: 'Excluir tarefa?', text: '“' + esc(t.title) + '” será removida.', ok: 'Excluir', danger: true });
      if (!ok) return;
      t.deleted = true; t.deletedAt = Date.now();
    }
  }
  commit(); if (closeForm) closeForm(); render();
  if (reverted) { toast('Tarefa excluída e XP estornado.'); return; }
  toast('Tarefa excluída.', { action: { label: 'Desfazer', fn: () => {
    const cur = taskById(snapshot.id); if (!cur) return;
    Object.assign(cur, snapshot); commit(); render(); toast('Exclusão desfeita.');
  } } });
}

function goalForm(id) {
  const g = id ? S.goals.find((x) => x.id === id) : null;
  const f = g ? JSON.parse(JSON.stringify(g)) : { title: '', desc: '', cat: 'pessoal', horizon: 'curto', deadline: '', priority: 1, mode: 'steps', steps: [], target: 10, current: 0, unit: '', linked: [], autoComplete: false };
  const tasks = S.tasks.filter((t) => !t.deleted && !t.endDate);
  const body =
    '<div class="field"><input class="inp big" id="gTitle" maxlength="80" placeholder="Qual é a meta?" value="' + esc(f.title) + '"><div class="errmsg" id="eG" hidden></div></div>' +
    '<div class="field"><textarea class="inp" id="gDesc" maxlength="500" placeholder="Por que ela importa? (opcional)">' + esc(f.desc) + '</textarea></div>' +
    '<div class="grid2"><div class="field"><label for="gCat">Categoria</label><select class="inp" id="gCat">' + catOptions(f.cat) + '</select></div>' +
    '<div class="field"><label for="gDead">Prazo (opcional)</label><input class="inp" id="gDead" type="date" value="' + (f.deadline || '') + '"></div></div>' +
    '<div class="field"><span class="lbl">Horizonte</span><div class="opt" id="gHz">' + [['curto', 'Curto'], ['medio', 'Médio'], ['longo', 'Longo']].map(([k, l]) => '<button type="button" data-o="' + k + '" class="' + (f.horizon === k ? 'on' : '') + '">' + l + ' prazo</button>').join('') + '</div></div>' +
    '<div class="field"><span class="lbl">Prioridade</span><div class="opt" id="gPr">' + PRIOS.map((l, i) => '<button type="button" data-o="' + i + '" class="' + (f.priority === i ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div>' +
    '<div class="field"><span class="lbl">Como medir o progresso</span><div class="opt acc" id="gMode">' + [['steps', 'Etapas'], ['value', 'Valor numérico'], ['linked', 'Conclusões de tarefas']].map(([k, l]) => '<button type="button" data-o="' + k + '" class="' + (f.mode === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div>' +
    '<div id="mSteps" class="field"><label for="gSteps">Etapas (uma por linha)</label><textarea class="inp" id="gSteps" rows="4" placeholder="Ler o livro 1&#10;Ler o livro 2">' + esc(f.steps.map((s) => s.text).join('\n')) + '</textarea></div>' +
    '<div id="mValue" class="grid2"><div class="field"><label for="gTarget">Alvo</label><input class="inp num" id="gTarget" type="number" inputmode="decimal" min="1" value="' + (f.target || 10) + '"></div><div class="field"><label for="gUnit">Unidade</label><input class="inp" id="gUnit" maxlength="20" placeholder="vendas, km…" value="' + esc(f.unit || '') + '"></div></div>' +
    '<div id="mLinkedT" class="field"><label for="gTargetL">Número de conclusões necessárias</label><input class="inp num" id="gTargetL" type="number" inputmode="numeric" min="1" value="' + (f.target || 30) + '"><p class="note">Conta cada conclusão das tarefas relacionadas desde a criação da meta.</p></div>' +
    '<div class="field"><span class="lbl">Tarefas relacionadas</span>' + (tasks.length ? '<div class="opt" id="gLinked">' + tasks.map((t) => '<button type="button" data-o="' + t.id + '" class="' + (f.linked.includes(t.id) ? 'on' : '') + '">' + esc(t.title) + '</button>').join('') + '</div>' : '<p class="note">Crie tarefas ou hábitos para relacioná-los a esta meta.</p>') + '<div class="errmsg" id="eL" hidden></div></div>' +
    '<div class="setrow" style="margin-bottom:14px"><span>Concluir automaticamente ao chegar a 100%</span><label class="switch"><input type="checkbox" id="gAuto" ' + (f.autoComplete ? 'checked' : '') + '><span></span></label></div>' +
    '<button class="btn pri block" id="gSave">' + (g ? 'Salvar meta' : 'Criar meta') + '</button>';
  openSheet({
    title: g ? 'Editar meta' : 'Nova meta', body,
    onMount: (b, close) => {
      const single = (box, v) => $$('[data-o]', box).forEach((x) => x.classList.toggle('on', x.dataset.o === String(v)));
      const showMode = () => { $('#mSteps', b).hidden = f.mode !== 'steps'; $('#mValue', b).hidden = f.mode !== 'value'; $('#mLinkedT', b).hidden = f.mode !== 'linked'; };
      showMode();
      b.addEventListener('click', (e) => {
        const x = e.target.closest('[data-o]'); if (!x) return; const box = x.parentElement; const v = x.dataset.o;
        if (box.id === 'gHz') { f.horizon = v; single(box, v); }
        if (box.id === 'gPr') { f.priority = +v; single(box, v); }
        if (box.id === 'gMode') { f.mode = v; single(box, v); showMode(); }
        if (box.id === 'gLinked') { const i = f.linked.indexOf(v); if (i >= 0) f.linked.splice(i, 1); else f.linked.push(v); x.classList.toggle('on', i < 0); }
      });
      if (!g) setTimeout(() => $('#gTitle', b).focus(), 280);
      $('#gSave', b).onclick = () => {
        const title = $('#gTitle', b).value.trim();
        const e1 = $('#eG', b), e2 = $('#eL', b); e1.hidden = e2.hidden = true;
        if (!title) { e1.textContent = 'Dê um nome à meta.'; e1.hidden = false; return; }
        const dead = $('#gDead', b).value; if (dead && !isKey(dead)) { toast('Prazo inválido.'); return; }
        let steps = f.steps;
        if (f.mode === 'steps') {
          const lines = $('#gSteps', b).value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 50);
          if (!lines.length) { toast('Adicione pelo menos uma etapa.'); return; }
          steps = lines.map((text) => { const old = f.steps.find((s) => s.text === text); return old || { id: uid(), text, done: false }; });
        }
        let target = f.target;
        if (f.mode === 'value') { target = parseFloat($('#gTarget', b).value); if (!(target > 0)) { toast('Defina um alvo maior que zero.'); return; } }
        if (f.mode === 'linked') { target = parseInt($('#gTargetL', b).value, 10); if (!(target > 0)) { toast('Defina quantas conclusões são necessárias.'); return; } if (!f.linked.length) { e2.textContent = 'Escolha ao menos uma tarefa relacionada.'; e2.hidden = false; return; } }
        const data = { title, desc: $('#gDesc', b).value.trim(), cat: $('#gCat', b).value, deadline: dead || '', horizon: f.horizon, priority: f.priority, mode: f.mode, steps, target, unit: $('#gUnit', b).value.trim(), linked: f.linked.slice(), autoComplete: $('#gAuto', b).checked };
        if (g) Object.assign(g, data); else S.goals.push({ id: uid(), createdAt: Date.now(), status: 'active', current: 0, ...data });
        commit(); close(); render(); toast(g ? 'Meta atualizada.' : 'Meta criada.'); checkGoalsAuto();
      };
    }
  });
}

function goalDetail(id) {
  const g = S.goals.find((x) => x.id === id); if (!g) return;
  const build = () => {
    const p = goalProgress(g);
    let h = (g.desc ? '<p class="sub" style="margin-bottom:12px">' + esc(g.desc) + '</p>' : '') +
      '<div class="spread" style="margin-bottom:8px"><span class="dp-pct num" style="font-size:48px">' + p.pct + '<small>%</small></span>' + (g.status === 'done' ? '<span class="badge acc">Concluída</span>' : goalLate(g) ? '<span class="badge red">Atrasada</span>' : '') + '</div>' +
      '<div class="bar" style="height:8px;margin-bottom:16px"><span style="width:' + p.pct + '%"></span></div>';
    if (g.mode === 'steps') h += '<span class="lbl">Etapas</span><div class="steps">' + g.steps.map((s) => '<div class="step task ' + (s.done ? 'done' : '') + '" style="background:none;padding:4px 0"><button class="ck" data-step="' + s.id + '" aria-label="Alternar etapa"><span>' + ICON.check + '</span></button><span class="st">' + esc(s.text) + '</span></div>').join('') + '</div>';
    if (g.mode === 'value') h += '<span class="lbl">Progresso: ' + fmtN(g.current || 0) + ' de ' + fmtN(g.target) + ' ' + esc(g.unit || '') + '</span><div class="row" style="margin:6px 0 14px"><button class="btn" data-dv="-1" aria-label="Diminuir">−1</button><input class="inp num" id="gCur" type="number" inputmode="decimal" value="' + (g.current || 0) + '" style="text-align:center"><button class="btn" data-dv="1" aria-label="Aumentar">+1</button></div>';
    if (g.mode === 'linked') h += '<p class="sub" style="margin-bottom:12px">' + p.cur + ' de ' + p.tgt + ' conclusões das tarefas relacionadas.</p>';
    if (g.linked.length) h += '<span class="lbl">Tarefas relacionadas</span><div class="card" style="background:var(--s2)">' + g.linked.map((tid) => { const t = taskById(tid); const n = Object.values(S.occ).filter((o) => o.taskId === tid).length; return '<div class="spread" style="padding:4px 0"><span>' + esc(t ? t.title : 'Tarefa excluída') + '</span><span class="tiny">' + n + '× concluída</span></div>'; }).join('') + '</div>';
    if (g.status !== 'done' && p.full && !g.autoComplete) h += '<p class="note" style="margin:10px 2px">Progresso completo. Marque a meta como concluída quando sentir que ela foi cumprida.</p>';
    h += '<div style="display:grid;gap:8px;margin-top:14px">' + (g.status === 'done' ? '<button class="btn block" data-ga="reopen">Reabrir meta</button>' : '<button class="btn pri block" data-ga="done">Marcar como concluída</button>') +
      '<button class="btn block" data-ga="edit">Editar</button><button class="btn block danger" data-ga="del">Excluir meta</button></div>';
    return h;
  };
  openSheet({
    title: g.title, body: '<div id="gd">' + build() + '</div>',
    onMount: (b, close) => {
      const refresh = () => { $('#gd', b).innerHTML = build(); render(); };
      b.addEventListener('click', async (e) => {
        const st = e.target.closest('[data-step]');
        if (st) { const s = g.steps.find((x) => x.id === st.dataset.step); s.done = !s.done; s.doneAt = s.done ? Date.now() : null; commit(); checkGoalsAuto(); refresh(); if (s.done) toast('Etapa concluída.'); return; }
        const dv = e.target.closest('[data-dv]');
        if (dv) { g.current = Math.max(0, (Number(g.current) || 0) + Number(dv.dataset.dv)); commit(); checkGoalsAuto(); refresh(); return; }
        const a = e.target.closest('[data-ga]'); if (!a) return;
        if (a.dataset.ga === 'done') { g.status = 'done'; g.doneAt = Date.now(); commit(); close(); render(); toast('Meta concluída. Grande conquista.'); }
        if (a.dataset.ga === 'reopen') { g.status = 'active'; g.doneAt = null; g.autoComplete = false; commit(); refresh(); toast('Meta reaberta.'); }
        if (a.dataset.ga === 'edit') { close(); setTimeout(() => goalForm(g.id), 220); }
        if (a.dataset.ga === 'del') { if (await confirmSheet({ title: 'Excluir meta?', text: '“' + esc(g.title) + '” e suas etapas serão removidas. Tarefas relacionadas e XP não mudam.', ok: 'Excluir', danger: true })) { S.goals = S.goals.filter((x) => x.id !== g.id); commit(); close(); render(); toast('Meta excluída.'); } }
      });
      b.addEventListener('change', (e) => { if (e.target.id === 'gCur') { const v = parseFloat(e.target.value); if (!(v >= 0)) { toast('Informe um número válido.'); e.target.value = g.current || 0; return; } g.current = v; commit(); checkGoalsAuto(); refresh(); } });
    }
  });
}

function challengeForm(id) {
  const c = id ? S.challenges.find((x) => x.id === id) : null;
  const t0 = todayKey();
  const f = c ? JSON.parse(JSON.stringify(c)) : { name: '', objective: '', start: t0, duration: 21, freq: 'daily', freqDays: [], criterion: 'checkin', taskId: '', reqPct: 100 };
  const tasks = S.tasks.filter((t) => !t.deleted && t.recur.type !== 'none' && !t.endDate);
  const durs = [7, 14, 21, 30, 66];
  const custom = !durs.includes(f.duration);
  const body =
    '<div class="field"><input class="inp big" id="cName" maxlength="60" placeholder="Nome do desafio" value="' + esc(f.name) + '"></div>' +
    '<div class="field"><input class="inp" id="cObj" maxlength="140" placeholder="Objetivo (opcional)" value="' + esc(f.objective) + '"></div>' +
    '<div class="field"><span class="lbl">Duração</span><div class="opt acc" id="cDur">' + durs.map((d) => '<button type="button" data-o="' + d + '" class="' + (f.duration === d ? 'on' : '') + '">' + d + ' dias</button>').join('') + '<button type="button" data-o="custom" class="' + (custom ? 'on' : '') + '">Outro</button></div>' +
    '<input class="inp num" id="cCustom" type="number" inputmode="numeric" min="2" max="365" value="' + f.duration + '" style="margin-top:8px" ' + (custom ? '' : 'hidden') + ' aria-label="Duração em dias"></div>' +
    '<div class="field"><label for="cStart">Início</label><input class="inp" id="cStart" type="date" value="' + f.start + '"></div>' +
    '<div class="field"><span class="lbl">Frequência</span><div class="opt" id="cFreq"><button type="button" data-o="daily" class="' + (f.freq === 'daily' ? 'on' : '') + '">Todos os dias</button><button type="button" data-o="days" class="' + (f.freq === 'days' ? 'on' : '') + '">Dias específicos</button></div>' +
    '<div class="opt" id="cDays" style="margin-top:8px" ' + (f.freq === 'days' ? '' : 'hidden') + '>' + [1, 2, 3, 4, 5, 6, 0].map((d) => '<button type="button" class="wd ' + (f.freqDays.includes(d) ? 'on' : '') + '" data-o="' + d + '">' + WD1[d] + '</button>').join('') + '</div></div>' +
    '<div class="field"><span class="lbl">Como um dia conta</span><div class="opt" id="cCrit"><button type="button" data-o="checkin" class="' + (f.criterion === 'checkin' ? 'on' : '') + '">Registro manual</button><button type="button" data-o="xp" class="' + (f.criterion === 'xp' ? 'on' : '') + '">Meta diária de XP</button>' + (tasks.length ? '<button type="button" data-o="task" class="' + (f.criterion === 'task' ? 'on' : '') + '">Concluir um hábito</button>' : '') + '</div>' +
    '<select class="inp" id="cTask" style="margin-top:8px" ' + (f.criterion === 'task' ? '' : 'hidden') + '>' + tasks.map((t) => '<option value="' + t.id + '" ' + (t.id === f.taskId ? 'selected' : '') + '>' + esc(t.title) + '</option>').join('') + '</select></div>' +
    '<div class="field"><span class="lbl">Para concluir, cumprir</span><div class="opt" id="cReq">' + [100, 90, 80].map((p) => '<button type="button" data-o="' + p + '" class="' + (f.reqPct === p ? 'on' : '') + '">' + (p === 100 ? 'Todos os dias' : p + '% dos dias') + '</button>').join('') + '</div></div>' +
    '<button class="btn pri block" id="cSave">' + (c ? 'Salvar desafio' : 'Começar desafio') + '</button>';
  openSheet({
    title: c ? 'Editar desafio' : 'Novo desafio', body,
    onMount: (b, close) => {
      const single = (box, v) => $$('[data-o]', box).forEach((x) => x.classList.toggle('on', x.dataset.o === String(v)));
      b.addEventListener('click', (e) => {
        const x = e.target.closest('[data-o]'); if (!x) return; const box = x.parentElement; const v = x.dataset.o;
        if (box.id === 'cDur') { single(box, v); $('#cCustom', b).hidden = v !== 'custom'; if (v !== 'custom') f.duration = +v; }
        if (box.id === 'cFreq') { f.freq = v; single(box, v); $('#cDays', b).hidden = v !== 'days'; }
        if (box.id === 'cDays') { const d = +v; const i = f.freqDays.indexOf(d); if (i >= 0) f.freqDays.splice(i, 1); else f.freqDays.push(d); x.classList.toggle('on', i < 0); }
        if (box.id === 'cCrit') { f.criterion = v; single(box, v); $('#cTask', b).hidden = v !== 'task'; }
        if (box.id === 'cReq') { f.reqPct = +v; single(box, v); }
      });
      $('#cSave', b).onclick = () => {
        const name = $('#cName', b).value.trim(); if (!name) { toast('Dê um nome ao desafio.'); return; }
        const start = $('#cStart', b).value; if (!isKey(start)) { toast('Escolha a data de início.'); return; }
        let dur = f.duration; if (!$('#cCustom', b).hidden) dur = parseInt($('#cCustom', b).value, 10);
        if (!(dur >= 2 && dur <= 365)) { toast('A duração deve ficar entre 2 e 365 dias.'); return; }
        if (f.freq === 'days' && !f.freqDays.length) { toast('Escolha os dias da semana.'); return; }
        const taskId = f.criterion === 'task' ? $('#cTask', b).value : '';
        if (f.criterion === 'task' && !taskId) { toast('Escolha o hábito.'); return; }
        const data = { name, objective: $('#cObj', b).value.trim(), start, duration: dur, end: addDays(start, dur - 1), freq: f.freq, freqDays: f.freqDays.slice(), criterion: f.criterion, taskId, reqPct: f.reqPct };
        if (c) Object.assign(c, data); else S.challenges.push({ id: uid(), createdAt: Date.now(), checkins: {}, ...data });
        commit(); close(); render(); toast(c ? 'Desafio atualizado.' : 'Desafio iniciado.');
      };
    }
  });
}
function challengeDetail(id) {
  const c = S.challenges.find((x) => x.id === id); if (!c) return;
  const s = chStatus(c);
  openSheet({
    title: c.name,
    body: (c.objective ? '<p class="sub" style="margin-bottom:10px">' + esc(c.objective) + '</p>' : '') +
      '<p class="sub">' + fmtFull(c.start) + ' a ' + fmtFull(c.end) + '. ' + s.met + ' de ' + s.req + ' dias necessários (' + s.total + ' programados).</p>' +
      (s.st === 'inviavel' || s.st === 'encerrado' ? '<p class="note" style="margin:10px 2px">Sem problema. O histórico fica registrado e você pode recomeçar hoje.</p>' : '') +
      '<div style="display:grid;gap:8px;margin-top:16px">' + (s.st !== 'concluido' ? '<button class="btn pri block" data-ca="restart">Recomeçar a partir de hoje</button>' : '') +
      '<button class="btn block" data-ca="edit">Editar</button><button class="btn block danger" data-ca="del">Excluir desafio</button></div>',
    onMount: (b, close) => b.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-ca]'); if (!a) return;
      if (a.dataset.ca === 'restart') {
        S.challenges.push({ ...JSON.parse(JSON.stringify(c)), id: uid(), createdAt: Date.now(), checkins: {}, start: todayKey(), end: addDays(todayKey(), c.duration - 1) });
        commit(); close(); render(); toast('Desafio recomeçado. Dia 1.');
      }
      if (a.dataset.ca === 'edit') { close(); setTimeout(() => challengeForm(c.id), 220); }
      if (a.dataset.ca === 'del') { if (await confirmSheet({ title: 'Excluir desafio?', text: 'O registro deste desafio será removido.', ok: 'Excluir', danger: true })) { S.challenges = S.challenges.filter((x) => x.id !== c.id); commit(); close(); render(); toast('Desafio excluído.'); } }
    })
  });
}

function closeDaySheet(date) {
  const st = dayStats(date);
  const rec = S.days[date] || {};
  const tomorrow = addDays(todayKey(), 1);
  const habits = st.items.filter((i) => i.recurring); const habitsDone = habits.filter((i) => i.done).length;
  const stepsToday = S.goals.reduce((n, g) => n + g.steps.filter((s) => s.done && s.doneAt && dateKey(new Date(s.doneAt)) === date).length, 0);
  const goalsToday = S.goals.filter((g) => g.doneAt && dateKey(new Date(g.doneAt)) === date).length;
  const movable = st.items.filter((i) => !i.done && !i.recurring && !i.moved && !i.orphan);
  const pend = st.items.filter((i) => !i.done);
  const body =
    '<p class="sub" style="margin-bottom:12px">' + fmtLong(date) + (rec.closed ? '. Encerrado às ' + fmtTime(rec.closed.at) : '') + '</p>' +
    '<div class="kv"><div><div class="k">XP conquistado</div><div class="v num">' + st.earned + '</div></div><div><div class="k">Conclusão</div><div class="v num">' + st.pct + '<small>%</small></div></div>' +
    '<div><div class="k">Concluídas</div><div class="v num">' + st.done + '</div></div><div><div class="k">Pendentes</div><div class="v num">' + st.pending + '</div></div></div>' +
    '<div class="card" style="margin-top:8px;background:var(--s2)"><div class="spread" style="padding:3px 0"><span>Hábitos cumpridos</span><b class="num">' + habitsDone + ' de ' + habits.length + '</b></div>' +
    '<div class="spread" style="padding:3px 0"><span>Meta diária de XP</span><b>' + (metOn(date) ? 'Atingida' : st.earned + ' de ' + goalOf(date)) + '</b></div>' +
    '<div class="spread" style="padding:3px 0"><span>Etapas de metas concluídas</span><b class="num">' + stepsToday + '</b></div>' +
    (goalsToday ? '<div class="spread" style="padding:3px 0"><span>Metas concluídas</span><b class="num">' + goalsToday + '</b></div>' : '') + '</div>' +
    (pend.length ? '<span class="lbl" style="margin-top:14px">Pendentes</span>' + pend.map((i) => {
      const mov = movable.includes(i);
      return '<label class="setrow" style="padding:9px 2px"><span>' + esc(i.title) + '<span class="tiny"> ' + (i.recurring ? 'hábito' : i.moved ? 'transferida' : '') + '</span></span>' +
        (mov ? '<span class="row tiny">Levar para amanhã <input type="checkbox" data-mv="' + i.taskId + '" style="width:20px;height:20px;accent-color:var(--ac)"></span>' : '') + '</label>';
    }).join('') + (movable.length ? '<p class="note">Pendentes continuam registradas neste dia. Ao levar para amanhã, uma cópia é criada.</p>' : '') : '') +
    '<div class="field" style="margin-top:16px"><label for="cdNote">O que posso melhorar amanhã?</label><textarea class="inp" id="cdNote" maxlength="600" placeholder="Opcional">' + esc((rec.closed && rec.closed.note) || '') + '</textarea></div>' +
    '<button class="btn pri block" id="cdOk">' + (rec.closed ? 'Salvar' : 'Encerrar o dia') + '</button>';
  openSheet({
    title: 'Fechamento do dia', body,
    onMount: (b, close) => {
      $('#cdOk', b).onclick = () => {
        const ids = $$('[data-mv]', b).filter((x) => x.checked).map((x) => x.dataset.mv);
        let moved = 0;
        for (const id of ids) {
          const t = taskById(id); if (!t || t.movedTo) continue;
          const target = date >= todayKey() ? addDays(date, 1) : tomorrow;
          if (!existsOn(target, t.title)) S.tasks.push({ ...JSON.parse(JSON.stringify(t)), id: uid(), createdAt: Date.now(), date: target, movedTo: null, skips: [] });
          t.movedTo = target; memo = null; moved++;
        }
        const r = dayRec(date);
        r.closed = { at: (r.closed && r.closed.at) || Date.now(), note: $('#cdNote', b).value.trim() };
        commit(); close(); render();
        toast(st.total && st.done === st.total ? 'Dia concluído.' : moved ? moved + ' tarefa' + (moved > 1 ? 's' : '') + ' levada' + (moved > 1 ? 's' : '') + ' para amanhã.' : 'Dia encerrado. Amanhã é uma nova fase.');
      };
    }
  });
}
function existsOn(date, title) { const n = title.trim().toLowerCase(); return dayItems(date).some((i) => !i.recurring && i.title.trim().toLowerCase() === n); }

function copyDaySheet(from) {
  const t = todayKey();
  const src = dayItems(from).filter((i) => !i.recurring && !i.orphan);
  if (!src.length) { toast('Não há tarefas únicas para copiar neste dia. Hábitos já se repetem sozinhos.'); return; }
  openSheet({
    title: 'Copiar tarefas',
    body: '<p class="sub" style="margin-bottom:14px">Copia as tarefas únicas de ' + esc(relLabel(from).toLowerCase()) + '. Tarefas com o mesmo nome no dia de destino não são duplicadas.</p>' +
      '<div class="field"><label for="cpTo">Para o dia</label><input class="inp" type="date" id="cpTo" value="' + (from === addDays(t, 1) ? addDays(from, 1) : from < t ? t : addDays(from, 1)) + '"></div>' +
      '<div class="setrow" style="margin-bottom:14px"><span>Somente as pendentes</span><label class="switch"><input type="checkbox" id="cpPend" checked><span></span></label></div>' +
      '<button class="btn pri block" id="cpOk">Copiar</button>',
    onMount: (b, close) => {
      $('#cpOk', b).onclick = () => {
        const to = $('#cpTo', b).value; if (!isKey(to)) { toast('Escolha uma data.'); return; }
        if (to === from) { toast('Escolha um dia diferente.'); return; }
        const onlyP = $('#cpPend', b).checked; let n = 0, skip = 0;
        for (const i of src) {
          if (onlyP && i.done) continue;
          const tk = taskById(i.taskId); if (!tk) continue;
          if (existsOn(to, tk.title)) { skip++; continue; }
          S.tasks.push({ ...JSON.parse(JSON.stringify(tk)), id: uid(), createdAt: Date.now(), date: to, movedTo: null, skips: [], deleted: false });
          memo = null; n++;
        }
        commit(); close(); render();
        toast(n ? n + ' copiada' + (n > 1 ? 's' : '') + (skip ? ', ' + skip + ' já existia' + (skip > 1 ? 'm' : '') : '') + '.' : 'Nada novo para copiar.');
      };
    }
  });
}

function quickPlanSheet(date) {
  openSheet({
    title: 'Planejar ' + relLabel(date).toLowerCase(),
    body: '<p class="sub" style="margin-bottom:12px">Escreva uma tarefa por linha. Você ajusta detalhes depois, se quiser.</p>' +
      '<div class="field"><textarea class="inp" id="qpText" rows="6" placeholder="Treinar 40 minutos&#10;Enviar proposta&#10;Ler 20 páginas"></textarea></div>' +
      '<div class="grid2"><div class="field"><label for="qpCat">Categoria</label><select class="inp" id="qpCat">' + catOptions('pessoal') + '</select></div>' +
      '<div class="field"><label for="qpKind">Tipo</label><select class="inp" id="qpKind">' + Object.keys(KINDS).filter((k) => k !== 'habito').map((k) => '<option value="' + k + '">' + KINDS[k] + ' (' + S.settings.xp[k] + ' XP)</option>').join('') + '</select></div></div>' +
      '<button class="btn pri block" id="qpOk">Adicionar ao dia</button>',
    onMount: (b, close) => {
      setTimeout(() => $('#qpText', b).focus(), 280);
      $('#qpOk', b).onclick = () => {
        const lines = [...new Set($('#qpText', b).value.split('\n').map((s) => s.trim().replace(/\s+/g, ' ').slice(0, 80)).filter(Boolean))];
        if (!lines.length) { toast('Escreva pelo menos uma tarefa.'); return; }
        const kind = $('#qpKind', b).value; const cat = $('#qpCat', b).value; let n = 0;
        for (const title of lines) {
          if (existsOn(date, title)) continue;
          S.tasks.push({ id: uid(), createdAt: Date.now() + n, title, desc: '', cat, kind, xp: S.settings.xp[kind], date, time: '', priority: 1, recur: { type: 'none', days: [] }, skips: [], endDate: null, deleted: false, movedTo: null });
          memo = null; n++;
        }
        commit(); close(); UI.dayView = date; render();
        toast(n ? n + ' tarefa' + (n > 1 ? 's' : '') + ' planejada' + (n > 1 ? 's' : '') + '.' : 'Essas tarefas já estavam no dia.');
      };
    }
  });
}

function dayDetailSheet(date) {
  const st = dayStats(date); const rec = S.days[date] || {};
  const t = todayKey();
  const body = (date > t ? '<p class="sub">Dia futuro. ' + st.total + ' tarefa' + (st.total === 1 ? '' : 's') + ' planejada' + (st.total === 1 ? '' : 's') + '.</p>' :
    !st.total && !st.earned ? '<p class="sub">Sem registros neste dia.</p>' :
      '<div class="kv"><div><div class="k">XP</div><div class="v num">' + st.earned + '<small>/ ' + goalOf(date) + '</small></div></div><div><div class="k">Conclusão</div><div class="v num">' + (st.total ? st.pct + '<small>%</small>' : '—') + '</div></div></div>') +
    (st.items.length ? '<div class="list" style="margin-top:12px">' + st.items.map((i) => taskRow(i)).join('') + '</div>' : '') +
    (rec.closed && rec.closed.note ? '<span class="lbl" style="margin-top:14px">Anotação do fechamento</span><div class="card" style="background:var(--s2)">' + esc(rec.closed.note) + '</div>' : '') +
    '<button class="btn block" style="margin-top:14px" data-open-day="' + date + '">Abrir em Meu dia</button>';
  openSheet({
    title: fmtLong(date), body,
    onMount: (b, close) => b.addEventListener('click', (e) => {
      if (e.target.closest('[data-open-day]')) { close(); UI.dayView = date; UI.tab = 'dia'; render(); window.scrollTo(0, 0); }
      if (e.target.closest('[data-a="editTask"]')) close();
    })
  });
}

/* =========================================================
   Backup
   ========================================================= */
async function exportBackup() {
  const payload = JSON.stringify({ app: 'focus', schema: SCHEMA, version: APP_VERSION, exportedAt: new Date().toISOString(), data: S }, null, 1);
  const name = 'focus-backup-' + todayKey() + '.json';
  const markDone = () => { S.meta.lastExport = Date.now(); commit(); render(); };
  try {
    const file = new File([payload], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Backup do Focus' });
      markDone(); toast('Backup exportado.'); return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') { toast('Exportação cancelada.'); return; }
  }
  try {
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    markDone(); toast('Backup salvo em Downloads.');
  } catch (e) {
    openSheet({ title: 'Copiar backup', body: '<p class="sub" style="margin-bottom:10px">Não foi possível gerar o arquivo. Copie o texto abaixo e salve em uma nota.</p><textarea class="inp" rows="8" readonly>' + esc(payload) + '</textarea>' });
  }
}
function importBackup() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('Arquivo grande demais para ser um backup do Focus.', { err: true }); return; }
    let parsed;
    try { parsed = JSON.parse(await file.text()); } catch (e) { toast('Este arquivo não é um backup válido (JSON ilegível).', { err: true }); return; }
    const d = parsed && parsed.app === 'focus' ? parsed.data : null;
    if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.ledger) || typeof d.occ !== 'object') { toast('Este arquivo não é um backup do Focus.', { err: true }); return; }
    const when = parsed.exportedAt ? new Date(parsed.exportedAt) : null;
    const ok = await confirmSheet({
      title: 'Importar backup?',
      text: 'Backup' + (when && !isNaN(when) ? ' de ' + fmtFull(dateKey(when)) : '') + ' com ' + d.tasks.length + ' tarefas e ' + d.goals.length + ' metas. Os dados atuais deste aparelho serão substituídos.',
      ok: 'Substituir e importar', danger: true
    });
    if (!ok) return;
    const n = normalize(d);
    n.meta.maxSeenTs = Math.min(n.meta.maxSeenTs || 0, Date.now());
    S = n; applyTheme(); await commit();
    if (!saveError) { render(); toast('Backup importado.'); }
  };
  inp.click();
}

/* =========================================================
   Ações (delegação de eventos)
   ========================================================= */
const A = {
  toggle: (d) => toggleOcc(d.k),
  newTask: () => taskForm({ date: UI.tab === 'dia' ? (UI.dayView || todayKey()) : todayKey() }),
  newHabit: (d) => taskForm({ date: d.d, habit: true }),
  editTask: (d) => taskForm({ id: d.id, date: d.d }),
  filter: (d) => { UI.filter = d.f; render(); },
  closeDay: (d) => closeDaySheet(d.d),
  dayNav: (d) => { const n = +d.n; UI.dayView = n === 0 ? null : addDays(UI.dayView || todayKey(), n); if (UI.dayView === todayKey()) UI.dayView = null; UI.reorder = false; render(); },
  pickDay: () => {
    const inp = document.createElement('input'); inp.type = 'date'; inp.value = UI.dayView || todayKey();
    inp.style.cssText = 'position:fixed;opacity:0;top:50%;left:50%;width:1px;height:1px'; document.body.appendChild(inp);
    inp.onchange = () => { if (isKey(inp.value)) { UI.dayView = inp.value === todayKey() ? null : inp.value; render(); } inp.remove(); };
    inp.onblur = () => setTimeout(() => inp.remove(), 500);
    if (inp.showPicker) { try { inp.showPicker(); } catch (e) { inp.focus(); inp.click(); } } else { inp.focus(); inp.click(); }
  },
  prio: (d) => {
    const date = d.k.split('@')[1]; const r = dayRec(date); r.prio = r.prio || [];
    const i = r.prio.indexOf(d.k);
    if (i >= 0) r.prio.splice(i, 1); else { if (r.prio.length >= 3) { toast('Máximo de 3 prioridades. Remova uma antes.'); return; } r.prio.push(d.k); toast('Prioridade definida.'); }
    commit(); render();
  },
  sort: (d) => { S.settings.sortMode = d.s; commit(); render(); },
  groupPeriod: () => { S.settings.groupByPeriod = !S.settings.groupByPeriod; commit(); render(); },
  reorder: () => { UI.reorder = !UI.reorder; render(); },
  move: (d) => {
    const date = d.k.split('@')[1]; const keys = dayItems(date).map((i) => i.key);
    const i = keys.indexOf(d.k); const j = i + Number(d.dir); if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    dayRec(date).order = keys; S.settings.sortMode = 'manual'; commit(); render();
  },
  copyDay: (d) => copyDaySheet(d.d),
  quickPlan: (d) => quickPlanSheet(d.d),
  metasSeg: (d) => { UI.metasSeg = d.s; render(); },
  goalFilter: (d) => { UI.goalFilter = d.f; render(); },
  newGoal: () => goalForm(null),
  openGoal: (d) => goalDetail(d.id),
  newCh: () => challengeForm(null),
  openCh: (d) => challengeDetail(d.id),
  checkin: (d) => {
    const c = S.challenges.find((x) => x.id === d.id); if (!c) return;
    const block = canComplete(d.d); if (block) { toast(block); return; }
    c.checkins[d.d] = Date.now(); commit(); render();
    const s = chStatus(c);
    if (s.st === 'concluido' && !c.celebrated) { c.celebrated = true; commit(); toast('Desafio concluído: ' + c.name + '.'); } else toast('Dia registrado. ' + s.met + ' de ' + s.req + '.');
  },
  evoRange: (d) => { UI.evoRange = d.r; render(); },
  evoMonth: (d) => { if (d.m > todayKey().slice(0, 7)) return; UI.evoMonth = d.m; render(); },
  dayDetail: (d) => dayDetailSheet(d.d),
  ledgerMore: () => { UI.ledgerMore = true; render(); },
  export: () => exportBackup(),
  import: () => importBackup(),
  addCat: () => {
    const inp = $('#newCat'); const name = inp.value.trim();
    if (!name) { toast('Digite o nome da categoria.'); inp.focus(); return; }
    if (S.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) { toast('Essa categoria já existe.'); return; }
    if (S.categories.length >= 20) { toast('Limite de 20 categorias.'); return; }
    S.categories.splice(S.categories.length - 1, 0, { id: 'c' + uid(), name }); commit(); render(); toast('Categoria adicionada.');
  },
  delCat: async (d) => {
    const c = S.categories.find((x) => x.id === d.id); if (!c) return;
    const used = S.tasks.filter((t) => t.cat === c.id && !t.deleted).length + S.goals.filter((g) => g.cat === c.id).length;
    const ok = await confirmSheet({ title: 'Excluir “' + esc(c.name) + '”?', text: used ? used + ' item(ns) passarão para “Outros”. O histórico mantém os registros.' : 'Nenhuma tarefa usa esta categoria.', ok: 'Excluir', danger: true });
    if (!ok) return;
    S.tasks.forEach((t) => { if (t.cat === c.id) t.cat = 'outros'; });
    S.goals.forEach((g) => { if (g.cat === c.id) g.cat = 'outros'; });
    Object.values(S.occ).forEach((o) => { if (o.cat === c.id) o.cat = 'outros'; });
    S.categories = S.categories.filter((x) => x.id !== c.id); commit(); render(); toast('Categoria excluída.');
  },
  resetSettings: async () => {
    if (!(await confirmSheet({ title: 'Restaurar configurações?', text: 'Meta diária, pontuação padrão, tema e preferências voltam ao padrão. Tarefas, metas, XP e categorias são mantidos.', ok: 'Restaurar' }))) return;
    S.settings = defaultSettings(); applyTheme(); commit(); render(); toast('Configurações restauradas.');
  },
  wipe: () => {
    openSheet({
      title: 'Apagar todos os dados',
      body: '<p class="sub" style="margin-bottom:14px">Tarefas, metas, desafios, XP e histórico serão apagados deste aparelho. Isso não pode ser desfeito. Exporte um backup antes, se quiser guardar algo.</p>' +
        '<div class="field"><label for="wipeTxt">Digite APAGAR para confirmar</label><input class="inp" id="wipeTxt" autocomplete="off" autocapitalize="characters"></div><button class="btn block danger" id="wipeOk" disabled>Apagar tudo</button>',
      onMount: (b, close) => {
        const i = $('#wipeTxt', b), k = $('#wipeOk', b);
        i.oninput = () => { k.disabled = i.value.trim().toUpperCase() !== 'APAGAR'; };
        k.onclick = async () => { S = defaultState(); applyTheme(); await commit(); close(); UI.tab = 'inicio'; render(); toast('Todos os dados foram apagados.'); };
      }
    });
  }
};

/* Configurações: campos com salvamento ao alterar */
document.addEventListener('change', (e) => {
  const el = e.target; if (!S || UI.tab !== 'ajustes' || el.closest('.sheet')) return;
  if (el.id === 'setName') { S.settings.name = el.value.trim().slice(0, 30); commit(); toast('Nome salvo.'); }
  else if (el.id === 'setGoal') {
    const v = parseInt(el.value, 10);
    if (!(v >= 10 && v <= 2000)) { toast('A meta diária deve ficar entre 10 e 2000 XP.'); el.value = S.settings.dailyGoal; return; }
    S.settings.dailyGoal = v; commit(); toast('Meta diária salva. Vale a partir dos próximos registros.');
  } else if (el.dataset.xpk) {
    const v = parseInt(el.value, 10);
    if (!(v >= XP_MIN && v <= XP_MAX)) { toast('Use um valor entre ' + XP_MIN + ' e ' + XP_MAX + ' XP.'); el.value = S.settings.xp[el.dataset.xpk]; return; }
    S.settings.xp[el.dataset.xpk] = v; commit(); toast('Pontuação salva.');
  } else if (el.dataset.cat) {
    const c = S.categories.find((x) => x.id === el.dataset.cat); const v = el.value.trim();
    if (!v) { el.value = c.name; toast('O nome não pode ficar vazio.'); return; }
    if (S.categories.some((x) => x !== c && x.name.toLowerCase() === v.toLowerCase())) { el.value = c.name; toast('Já existe uma categoria com esse nome.'); return; }
    c.name = v.slice(0, 24); commit(); toast('Categoria renomeada.');
  } else if (el.id === 'setLight') { S.settings.theme = el.checked ? 'light' : 'dark'; applyTheme(); commit(); }
  else if (el.id === 'setAnim') { S.settings.animations = el.checked; applyTheme(); commit(); }
  else if (el.id === 'setStart') { S.settings.dayStartHour = clamp(parseInt(el.value, 10) || 0, 0, 5); commit(); render(); toast('Início do dia atualizado.'); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'newCat') { e.preventDefault(); A.addCat(); }
  if (e.key === 'Escape' && sheets.length) closeSheet();
});
document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { if (sheets.length && !tab.closest('.sheet')) return; while (sheets.length) closeSheet(); go(tab.dataset.tab); return; }
  const el = e.target.closest('[data-a]'); if (!el || !S) return;
  const fn = A[el.dataset.a];
  if (fn) { e.preventDefault(); if (el.closest('.sheet') && el.dataset.a === 'editTask') setTimeout(() => fn(el.dataset, el, e), 220); else fn(el.dataset, el, e); }
});

/* =========================================================
   Tema, virada do dia e inicialização
   ========================================================= */
function applyTheme() {
  document.documentElement.dataset.theme = S.settings.theme === 'light' ? 'light' : 'dark';
  document.body.classList.toggle('noanim', !S.settings.animations);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = S.settings.theme === 'light' ? '#F2F2EF' : '#000000';
}
let lastDay = null;
function tick() {
  if (!S) return;
  const t = todayKey();
  if (lastDay && t !== lastDay) { memo = null; if (UI.dayView === t) UI.dayView = null; if (!sheets.length) render(); }
  lastDay = t; updateBanner();
}

async function boot() {
  await Store.init();
  let raw = null, loadErr = null;
  try { raw = await Store.read(); } catch (e) { loadErr = e; }
  if (raw) {
    try { S = normalize(JSON.parse(raw)); }
    catch (e) {
      loadErr = e;
      try { await Store.writeExtra('corrupt-' + Date.now(), raw); } catch (e2) { /* sem cópia */ }
      S = defaultState();
    }
  } else S = defaultState();
  applyTheme();
  lastDay = todayKey();
  if (!raw && Store.mode !== 'none') commit();
  render(); updateBanner();
  if (loadErr) toast('Não foi possível ler os dados salvos. Uma cópia foi preservada; importe um backup se tiver um.', { err: true });
  if (navigator.storage && navigator.storage.persist) {
    try { const p = await navigator.storage.persisted() || await navigator.storage.persist(); if (p !== S.meta.persisted) { S.meta.persisted = p; commit(); } } catch (e) { /* opcional */ }
  }
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  window.addEventListener('focus', tick);
  registerSW();
}

let updateRequested = false;
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const ask = (w) => toast('Nova versão do Focus disponível.', { action: { label: 'Atualizar', fn: () => { updateRequested = true; w.postMessage('skipWaiting'); } } });
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
    });
  }).catch(() => { /* sem offline nesta origem */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Só recarrega quando o usuário pediu a atualização (nunca na primeira instalação)
    if (updateRequested && !reloaded) { reloaded = true; location.reload(); }
  });
}

window.addEventListener('error', (e) => { console.error(e.error || e.message); });
boot();

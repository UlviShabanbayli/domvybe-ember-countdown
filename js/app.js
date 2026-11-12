// DV85 EMBER COUNTDOWN · the timer, the sale states, input, the scheduler and the test hook (window.__ember).
import { Forge } from './forge.js';
import { buildAtlas, buildSoot, CAP } from './atlas.js';

const $ = (s) => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const KEY_END = 'dv85.v1.end', KEY_REMIND = 'dv85.v1.remind';
const SHOWCASE = (2 * 86400 + 14 * 3600 + 37 * 60 + 9) * 1000 + 650;   // a first visit opens on 02:14:37:09
const PREVIEW = 12 * 1000 + 650;
const FLOOR = [0.38, 0.38, 0.40, 0.41, 0.43, 0.45, 0.48, 0.52];        // resting heat per position: old units run cooler
const POUR = 0.34, TAU = 2.5;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const portrait = matchMedia('(max-width: 700px), (orientation: portrait) and (max-width: 1100px)');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

const el = {
  hero: $('#top'), fx: $('#fx'), metal: $('#metal'), count: $('#count'), clip: $('#dg-clip'), dh: $('#dh'), read: $('#timer-read'),
  pill: $('#pill-t'), lede: $('#lede-a'), ends: $('#ends'), shop: $('#shop'), remind: $('#remind'), remindT: $('#remind-t'),
  ctas: $('#ctas'), form: $('#remind-form'), email: $('#email'), set: $('#set'), cancel: $('#cancel'), msg: $('#remind-msg'),
  preview: $('#preview'), previewT: $('#preview-t'), toast: $('#toast'), live: $('#live'),
  digits: [...document.querySelectorAll('.count .dg')], colons: [...document.querySelectorAll('.count .col')],
};

// ---------------- time ----------------
const S = {
  liveEnd: 0, end: 0, preview: false, ended: false, endedAt: -99, str: '', left: -1,
  slots: Array.from({ length: 8 }, () => ({ d: 0, old: -1, changedAt: -999, pourAt: -99, introAt: -99, oldHeat: 0.5, boost: 0, intro: false })),
  fin: 0, pulseAt: -99, ptr: { x: -9999, y: -9999, str: 0, last: -99, px: 0, py: 0, pt: 0 },
  holdT: null, holdNow: null, lastInput: 0, rate: 'full', sleeping: false, frames: 0,
  geo: null, reminded: store.get(KEY_REMIND) === '1',
};
const clock = () => (S.holdT !== null ? S.holdT : performance.now() / 1000);
const nowMs = () => (S.holdNow !== null ? S.holdNow : Date.now());
const pad2 = (v) => String(v).padStart(2, '0');
function split(sec) {
  const d = Math.min(99, Math.floor(sec / 86400)), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return { d, h, m, s, str: pad2(d) + pad2(h) + pad2(m) + pad2(s) };
}
function initEnd() {
  const stored = +store.get(KEY_END);
  S.liveEnd = stored > 0 ? stored : Date.now() + SHOWCASE;
  if (!(stored > 0)) store.set(KEY_END, String(S.liveEnd));
  S.end = S.liveEnd;
  const left = parseFloat(qs.get('left'));
  if (left >= 0) { S.preview = true; S.end = Date.now() + left * 1000 + 650; }
  else if (qs.has('preview')) { S.preview = true; S.end = Date.now() + PREVIEW; }
  el.ends.textContent = endLabel(S.liveEnd);
}
function endLabel(ms) {
  const d = new Date(ms), now = new Date();
  const h = d.getHours(), m = d.getMinutes();
  const time = h === 0 && m === 0 ? 'midnight' : `${(h % 12) || 12}:${pad2(m)} ${h < 12 ? 'am' : 'pm'}`;
  const sameDay = d.toDateString() === now.toDateString();
  const day = sameDay ? 'tonight' : d.toLocaleDateString('en-GB', { weekday: 'long' });
  return sameDay ? `Ends tonight at ${time}.` : `Ends ${day} at ${time}.`;
}

// heat of a slot at clock time t (0 cold … 1.16 white-hot)
function heatOf(i, t) {
  const sl = S.slots[i];
  if (sl.intro && t < sl.introAt) return 0.04;
  const age = t - sl.changedAt;
  let H = FLOOR[i] + (1.08 - FLOOR[i]) * Math.exp(-age / TAU);
  if (sl.intro) H = Math.max(H, FLOOR[i] + (1.12 - FLOOR[i]) * Math.exp(-Math.max(0, t - sl.introAt) / 0.95));
  H = Math.min(1.1, H + S.fin * (i >= 6 ? 0.2 : 0.16));
  const cold = S.ended ? smooth(0.25, 4.5, t - S.endedAt) : 0;
  return H * (1 - cold) + 0.035 * cold;
}
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

// ---------------- the DOM side of a tick ----------------
let svgNS = 'http://www.w3.org/2000/svg';
const clipNodes = [];  // per slot: { now: <text>, old: <text> }
function buildClip() {
  el.clip.textContent = '';
  clipNodes.length = 0;
  for (let i = 0; i < 8; i++) {
    const mk = () => { const t = document.createElementNS(svgNS, 'text'); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', "'Abril Fatface', Georgia, serif"); el.clip.appendChild(t); return t; };
    clipNodes.push({ now: mk(), old: mk() });
  }
  for (let c = 0; c < 3; c++) for (let k = 0; k < 2; k++) { const ci = document.createElementNS(svgNS, 'circle'); ci.dataset.c = c; ci.dataset.k = k; el.clip.appendChild(ci); }
}
function placeClip() {
  const g = S.geo; if (!g) return;
  clipNodes.forEach((n, i) => {
    const vis = g.slots[i] !== null;
    for (const t of [n.now, n.old]) {
      t.setAttribute('font-size', g.F.toFixed(2));
      if (vis) { t.setAttribute('x', (g.slots[i] - g.off[0]).toFixed(2)); t.setAttribute('y', (g.base - g.off[1]).toFixed(2)); }
    }
    n.now.setAttribute('display', vis ? 'inline' : 'none');
    n.now.textContent = String(S.slots[i].d);
    n.old.setAttribute('display', 'none');
  });
  el.clip.querySelectorAll('circle').forEach((ci) => {
    const c = +ci.dataset.c, k = +ci.dataset.k, x = g.colons[c];
    if (x === null) { ci.setAttribute('display', 'none'); return; }
    ci.setAttribute('display', 'inline');
    ci.setAttribute('cx', (x - g.off[0]).toFixed(2)); ci.setAttribute('cy', (g.base - (k ? 0.20 : 0.52) * g.F - g.off[1]).toFixed(2));
    ci.setAttribute('r', (0.055 * g.F).toFixed(2));
  });
}
const setText = (n, v) => { if (n.textContent !== v) n.textContent = v; };
function setDomDigits(str) { el.digits.forEach((dg, i) => { dg.firstChild.textContent = str[i]; }); }

let lastAnnounce = '';
function announce(text) { if (text === lastAnnounce) return; lastAnnounce = text; el.live.textContent = text; }
function plural(n, w) { return `${n} ${w}${n === 1 ? '' : 's'}`; }

function onSecond(sec, t, first) {
  const p = split(sec);
  if (p.str !== S.str) {
    for (let i = 0; i < 8; i++) {
      const nd = +p.str[i], sl = S.slots[i];
      if (!first && S.str && +S.str[i] === nd) continue;
      if (!first && S.str) {
        sl.old = +S.str[i]; sl.oldHeat = heatOf(i, t); sl.changedAt = t;
        const live = !reduced.matches && !S.sleeping;
        sl.pourAt = live ? t : -99;
        if (live && clipNodes[i] && S.geo && S.geo.slots[i] !== null) { clipNodes[i].old.textContent = String(sl.old); clipNodes[i].old.setAttribute('display', 'inline'); }
      }
      sl.d = nd;
      if (clipNodes[i]) clipNodes[i].now.textContent = String(nd);
    }
    S.str = p.str; setDomDigits(p.str);
  }
  setText(el.read, S.ended ? 'The Ember Sale has ended' : `${plural(p.d, 'day')}, ${plural(p.h, 'hour')}, ${plural(p.m, 'minute')} and ${plural(p.s, 'second')} left in the Ember Sale`);
  setText(el.dh, `${plural(p.d, 'day')} · ${plural(p.h, 'hour')} ·`);
  const final = !S.ended && sec <= 10 && sec > 0;
  el.hero.classList.toggle('final', final);
  if (final && sec !== S.left) S.pulseAt = t;
  setText(el.pill, S.ended ? 'The Ember Sale · ended' : final ? 'Final seconds · up to 40% off' : 'The Ember Sale · up to 40% off');
  if (!first) {
    if (sec === 60) announce('One minute left in the Ember Sale.');
    if (sec === 10) announce('Ten seconds left in the Ember Sale.');
  }
  S.left = sec;
}

function setEnded(on, t) {
  if (on === S.ended) return;
  S.ended = on; S.endedAt = on ? t : -99;
  el.hero.classList.toggle('ended', on);
  el.lede.textContent = on ? 'The Ember Sale has ended.' : 'Every skillet and Dutch oven, poured in Sheffield.';
  el.ends.textContent = on ? 'Be first to hear about the next one.' : endLabel(S.liveEnd);
  el.shop.setAttribute('aria-disabled', on ? 'true' : 'false');
  el.shop.textContent = on ? 'Sale ended' : 'Shop the sale';
  if (on) el.shop.removeAttribute('href'); else el.shop.setAttribute('href', '#skillets');
  if (on) el.shop.setAttribute('role', 'link');
  else el.shop.removeAttribute('role');
  el.shop.tabIndex = 0;
  remindLabel();
  if (on) announce('The Ember Sale has ended.');
}

function tickTimer(t, first = false) {
  const rem = S.end - nowMs();
  const sec = Math.max(0, Math.ceil(rem / 1000));
  if (sec !== S.left || first) onSecond(sec, t, first);
  if (rem <= 0 && !S.ended) { setEnded(true, t); onSecond(0, t, false); }
  const target = (!S.ended && sec <= 10 && sec > 0) ? 1 : 0;
  S.fin += (target - S.fin) * (reduced.matches ? 1 : 0.06);
  if (Math.abs(target - S.fin) < 0.002) S.fin = target;
}

// ages of a just-opened timer: how long ago each digit really changed (the heat ladder of the first screen)
function seedAges(t) {
  const rem = S.end - nowMs(), sec = Math.max(0, Math.ceil(rem / 1000)), frac = Math.max(0, sec - rem / 1000);
  const cur = split(sec).str;
  for (let i = 0; i < 8; i++) {
    let j = 0;
    while (j < 600 && split(sec + j + 1).str[i] === cur[i]) j++;
    S.slots[i].changedAt = t - (j + frac);
  }
}

// ---------------- layout ----------------
function layout() {
  const hr = el.hero.getBoundingClientRect(), cr = el.count.getBoundingClientRect(), mr = el.metal.getBoundingClientRect();
  const F = parseFloat(getComputedStyle(el.count).fontSize);
  const slots = el.digits.map((d) => { if (!d.offsetParent) return null; const r = d.getBoundingClientRect(); return r.left + r.width / 2 - hr.left; });
  const colons = el.colons.map((c) => { if (!c.offsetParent) return null; const r = c.getBoundingClientRect(); return r.left + r.width / 2 - hr.left; });
  const vis = slots.filter((x) => x !== null);
  S.geo = {
    F, base: cr.bottom - hr.top, slots, colons, span0: vis[0] - 0.33 * F, span1: vis[vis.length - 1] + 0.33 * F,
    off: [mr.left - hr.left, mr.top - hr.top], band: [cr.top - hr.top - 0.35 * F, cr.bottom - hr.top + 0.08 * F],
  };
  if (forge) { forge.resize(); placeClip(); }
  wake();
}

// ---------------- rendering ----------------
let forge = null;
const U = { heats: new Float32Array(8), ptr: [0, 0, 0], amb: [0, 0, 0], frame: {}, slot: new Float32Array(32), aux: new Float32Array(32), colon: new Float32Array(12), change: new Float32Array(8), splash: new Float32Array(8), oldHeat: new Float32Array(8) };
function frameUniforms(t) {
  const g = S.geo, cold = S.ended ? smooth(0.25, 4.5, t - S.endedAt) : 0;
  const heats = U.heats;
  let avg = 0, n = 0;
  for (let i = 0; i < 8; i++) {
    const sl = S.slots[i], vis = g.slots[i] !== null;
    const H = heatOf(i, t); heats[i] = H;
    const pour = sl.pourAt > -50 ? Math.min(1, (t - sl.pourAt) / POUR) : 1;
    const introPour = sl.intro ? Math.min(1, Math.max(0, (t - sl.introAt) / POUR)) : 1;
    const flash = Math.exp(-Math.max(0, t - Math.max(sl.pourAt, sl.introAt)) * 5.5) * (sl.pourAt > -50 || sl.intro ? 1 : 0) * (1 - cold);
    const flame = (smooth(0.82, 1.12, H) + S.fin * (i >= 6 ? 0.85 : 0.4) + sl.boost * 1.6) * (1 - cold);
    const o = i * 4;
    U.slot[o] = vis ? g.slots[i] : -9999; U.slot[o + 1] = vis ? sl.d : -1; U.slot[o + 2] = H; U.slot[o + 3] = flame;
    U.aux[o] = flash; U.aux[o + 1] = sl.boost * (1 - cold); U.aux[o + 2] = Math.min(pour, introPour); U.aux[o + 3] = introPour < 1 ? -1 : sl.old;
    U.change[i] = Math.max(sl.pourAt, sl.introAt);
    U.splash[i] = i === 7 ? 0.32 + 0.5 * S.fin : i === 6 ? 0.75 : 1.0;
    U.oldHeat[i] = sl.oldHeat;
    if (vis) { avg += H; n++; }
  }
  for (let c = 0; c < 3; c++) {
    const x = g.colons[c];
    const o = c * 4;
    U.colon[o] = x === null ? -9999 : x; U.colon[o + 1] = x === null ? 0 : 1; U.colon[o + 2] = 0.85 * Math.max(0.28, (heats[c * 2 + 1] + heats[c * 2 + 2]) * 0.5 * 0.92) * (1 - cold) + 0.03 * cold; U.colon[o + 3] = 0;
  }
  avg = n ? avg / n : 0;
  const pulse = S.fin > 0 ? Math.exp(-Math.max(0, t - S.pulseAt) * 3.2) : 0;
  const flare = S.ended ? Math.exp(-Math.max(0, t - S.endedAt) * 1.5) : 0;
  const fr = U.frame;
  U.ptr[0] = S.ptr.x; U.ptr[1] = S.ptr.y; U.ptr[2] = S.ptr.str;
  const k = (1 - cold), a = avg;
  U.amb[0] = 0.10 * a * k + 0.004; U.amb[1] = 0.040 * a * k + 0.004; U.amb[2] = 0.012 * a * k + 0.004;
  Object.assign(fr, {
    t, slot: U.slot, aux: U.aux, colon: U.colon, change: U.change, splash: U.splash, oldHeat: U.oldHeat,
    F: g.F, base: g.base, span0: g.span0, span1: g.span1, fin: S.fin, pulse, cold, flare, off: g.off,
    endT: S.ended ? S.endedAt : 1e7, ptr: U.ptr, amb: U.amb,
  });
  return fr;
}
function draw(t) {
  if (!forge || !S.geo) return;
  // the old digit leaves the clip once its pour is done
  S.slots.forEach((sl, i) => {
    if (sl.pourAt > -50 && t - sl.pourAt >= POUR) { sl.pourAt = -99; if (clipNodes[i]) clipNodes[i].old.setAttribute('display', 'none'); }
    if (sl.intro && t - sl.introAt > 3) sl.intro = false;
  });
  forge.render(frameUniforms(t));
  S.frames++;
}

// ---------------- scheduler: full rate while something moves fast, 60/30 fps otherwise, sleeps at rest ----------------
let raf = 0, lastDraw = -1, lastT = 0, visible = true, onscreen = true, rmTimer = 0;
function frame(now) {
  raf = 0;
  const t = clock();
  const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
  tickTimer(t);
  // pointer bellows decay
  S.ptr.str *= Math.exp(-dt / 0.45);
  for (const sl of S.slots) sl.boost *= Math.exp(-dt / 1.3);
  const ptrActive = t - S.ptr.last < 1.2 || S.ptr.str > 0.02;
  const settledEnd = S.ended && t - S.endedAt > 7 && !ptrActive;
  if (settledEnd && S.holdT === null) { draw(t); S.rate = 'sleep'; S.sleeping = true; return; }
  const busy = ptrActive || S.fin > 0.01 || (S.ended && t - S.endedAt < 7) || S.slots.some((sl) => sl.intro);
  const quiet = t - S.lastInput > 20;
  S.rate = busy ? 'full' : quiet ? '30' : '60';
  const minDt = busy ? 0 : quiet ? 1 / 30 - 0.004 : 1 / 60 - 0.004;
  if (t - lastDraw >= minDt || S.holdT !== null) { draw(t); lastDraw = t; }
  if (visible && onscreen) raf = requestAnimationFrame(frame);
  else { S.sleeping = true; S.rate = 'sleep'; }
}
function wake() {
  if (!forge || reduced.matches) { if (forge) staticFrame(); return; }
  if (!visible || !onscreen) return;
  S.sleeping = false;
  if (!raf) { lastT = clock(); raf = requestAnimationFrame(frame); }
}
// the next moment the shown digits change: the countdown's own second boundary (the end carries +650 ms), not the wall clock's
const toNextSecond = () => ((S.end - nowMs()) % 1000 + 1000) % 1000 + 30;
// reduced motion: no loop; one frame per second (digits change, nothing moves)
function staticFrame() {
  clearTimeout(rmTimer);
  S.sleeping = true; S.rate = 'static';
  const t = 40.0;
  tickTimer(clock(), false);
  S.slots.forEach((sl) => { sl.pourAt = -99; sl.intro = false; });
  clipNodes.forEach((n) => n.old.setAttribute('display', 'none'));
  if (S.geo) forge.render(frameUniforms(t));
  S.frames++;
  if (!S.ended || S.holdT !== null) rmTimer = setTimeout(staticFrame, toNextSecond());
}
// the same timer without WebGL
function domTimer() { clearTimeout(rmTimer); tickTimer(clock()); rmTimer = setTimeout(domTimer, toNextSecond()); }

// ---------------- input ----------------
function onPointer(e) {
  if (reduced.matches || !S.geo) return;
  const t = clock(), x = e.pageX, y = e.pageY;
  const p = S.ptr, dtp = Math.max(0.008, t - p.pt);
  const sp = Math.hypot(x - p.px, y - p.py) / dtp;
  p.px = x; p.py = y; p.pt = t;
  const g = S.geo;
  const near = y > g.band[0] - 0.8 * g.F && y < g.band[1] + 0.4 * g.F && x > g.span0 - g.F && x < g.span1 + g.F;
  if (!near) return;
  p.x = x; p.y = y; p.last = t; S.lastInput = t;
  p.str = Math.min(1, p.str + Math.min(0.35, sp * 0.00045 + 0.02));
  if (y > g.band[0] && y < g.band[1]) {
    let k = -1, best = 1e9;
    g.slots.forEach((cx, i) => { if (cx === null) return; const d = Math.abs(x - cx); if (d < best) { best = d; k = i; } });
    if (k >= 0 && best < 0.45 * g.F) S.slots[k].boost = Math.min(0.55, S.slots[k].boost + Math.min(0.08, sp * 0.00008));
  }
  wake();
}

let toastT = 0;
function toast(text) { el.toast.textContent = text; el.toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('on'), 2600); }

function remindLabel() {
  el.remind.setAttribute('aria-pressed', S.reminded ? 'true' : 'false');
  el.remindT.textContent = S.reminded ? (S.ended ? 'We’ll tell you first' : 'We’ll remind you') : (S.ended ? 'Notify me of the next sale' : 'Remind me');
}
function openForm(on) {
  el.ctas.dataset.mode = on ? 'form' : 'main';
  el.form.hidden = !on;
  el.remind.setAttribute('aria-expanded', on ? 'true' : 'false');
  if (on) { el.email.value = ''; el.email.removeAttribute('aria-invalid'); el.form.classList.remove('err'); setMsg(''); el.email.focus(); }
  else el.remind.focus();
}
function setMsg(text, kind = '') {
  el.msg.className = 'msg' + (kind ? ' ' + kind : '');
  el.msg.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  el.msg.textContent = text;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function submit(e) {
  e.preventDefault();
  const v = el.email.value.trim();
  el.form.classList.remove('err'); void el.form.offsetWidth;
  if (!v || !EMAIL.test(v)) {
    el.email.setAttribute('aria-invalid', 'true'); el.form.classList.add('err');
    setMsg(!v ? 'Enter your email and we’ll remind you before it ends.' : 'That email looks incomplete. Check the part after the @.', 'err');
    el.email.focus(); return;
  }
  el.email.removeAttribute('aria-invalid');
  el.set.disabled = true; el.set.textContent = 'Setting…'; el.form.setAttribute('aria-busy', 'true');
  setTimeout(() => {
    el.set.disabled = false; el.set.textContent = 'Remind me'; el.form.removeAttribute('aria-busy');
    S.reminded = true; store.set(KEY_REMIND, '1');      // the address itself is never stored
    remindLabel(); openForm(false);
    setMsg(S.ended ? 'Done. We’ll tell you first when the next sale opens.' : 'Done. We’ll email you an hour before it ends.', 'ok');
  }, qs.has('fast') ? 60 : 650);
}

function bind() {
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('pointerdown', onPointer, { passive: true });
  el.remind.addEventListener('click', () => {
    if (S.reminded) { S.reminded = false; store.del(KEY_REMIND); remindLabel(); setMsg('Reminder cancelled.'); return; }
    openForm(true);
  });
  el.form.addEventListener('submit', submit);
  el.cancel.addEventListener('click', () => { openForm(false); setMsg(''); });
  el.form.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); openForm(false); setMsg(''); } });
  el.email.addEventListener('input', () => { if (el.email.getAttribute('aria-invalid') && EMAIL.test(el.email.value.trim())) { el.email.removeAttribute('aria-invalid'); el.form.classList.remove('err'); setMsg(''); } });
  el.shop.addEventListener('click', (e) => {
    e.preventDefault();
    if (el.shop.getAttribute('aria-disabled') === 'true') { toast('The Ember Sale has ended. Prices are back to normal.'); return; }
    toast('Demo store · the shop itself is not part of this component.');
  });
  el.shop.addEventListener('keydown', (e) => { if ((e.key === ' ') && el.shop.getAttribute('role') === 'link') { e.preventDefault(); el.shop.click(); } });
  document.querySelectorAll('.links a, .cart, .logo').forEach((a) => a.addEventListener('click', (e) => { if (a.classList.contains('logo')) return; e.preventDefault(); toast('Demo store · navigation is not part of this component.'); }));
  el.preview.addEventListener('click', () => setPreview(!S.preview));
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) wake(); });
  new IntersectionObserver((es) => { onscreen = es[0].isIntersecting; if (onscreen) wake(); }).observe(el.hero);
  let rz = 0; addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(layout); });
  portrait.addEventListener('change', layout);
  reduced.addEventListener('change', () => { if (reduced.matches) staticFrame(); else { clearTimeout(rmTimer); wake(); } });
}

function setPreview(on) {
  const t = clock();
  S.preview = on;
  S.end = on ? nowMs() + PREVIEW : S.liveEnd;
  el.previewT.textContent = on ? 'Back to the live sale' : 'Preview the final 10 seconds';
  if (S.ended && !(S.end - nowMs() <= 0)) setEnded(false, t);
  S.lastInput = t;
  tickTimer(t);
  announce(on ? 'Preview: the final seconds of the sale.' : 'Back to the live sale.');
  if (!forge) return domTimer();
  wake(); if (reduced.matches) staticFrame();
}

// ---------------- boot ----------------
let readyResolve; const ready = new Promise((r) => (readyResolve = r));
window.__ember = {
  ready, S, get forge() { return forge; },
  state() {
    return { digits: S.str, left: S.left, final: S.fin, isFinal: el.hero.classList.contains('final'), ended: S.ended, preview: S.preview,
      reminded: S.reminded, fx: !!forge, rate: S.rate, sleeping: S.sleeping, frames: S.frames, draws: forge ? { ...forge.draws } : null,
      pouring: S.slots.map((s) => s.pourAt > -50), heat: S.slots.map((_, i) => +heatOf(i, clock()).toFixed(3)), boost: S.slots.map((s) => +s.boost.toFixed(3)) };
  },
  setLeft(sec) { S.preview = true; S.end = nowMs() + sec * 1000 + 650; el.previewT.textContent = 'Back to the live sale'; if (S.ended) setEnded(false, clock()); tickTimer(clock()); wake(); },
  hold(on) {
    if (on) { S.holdT = clock(); S.holdNow = nowMs(); }
    else { const dt = performance.now() / 1000 - S.holdT; S.holdT = null; S.holdNow = null; void dt; wake(); }
    if (forge && S.geo && on) draw(S.holdT);
  },
  layout,
};

async function boot() {
  initEnd();
  try {
    await Promise.all([document.fonts.load("400 100px 'Abril Fatface'"), document.fonts.load("italic 600 30px 'Playfair Display'"), document.fonts.load("800 19px 'Playfair Display'"), document.fonts.load("500 13px 'Inter'")]);
  } catch (e) {}
  remindLabel();
  const t = clock();
  tickTimer(t, true);
  seedAges(t);
  if (S.preview) el.previewT.textContent = 'Back to the live sale';
  if (!document.documentElement.classList.contains('no-fx')) {
    forge = new Forge(el.fx, el.metal);
    if (!forge.init(buildAtlas(), buildSoot())) { forge = null; document.documentElement.classList.add('no-fx'); }
  }
  bind();
  if (forge) {
    buildClip();
    forge.fx.onlost = forge.mt.onlost = () => { document.documentElement.classList.add('no-fx'); cancelAnimationFrame(raf); raf = 0; domTimer(); };
    forge.fx.onrestored = forge.mt.onrestored = () => {
      if (forge.fx.lost || forge.mt.lost) return;
      try { forge.setup(); document.documentElement.classList.remove('no-fx'); clearTimeout(rmTimer); layout(); } catch (e) {}
    };
    layout();
    // the first second: every digit is poured, left to right
    if (!reduced.matches && !qs.has('nointro')) {
      const t0 = clock() + 0.15;
      S.slots.forEach((sl, i) => { sl.intro = true; sl.introAt = t0 + i * 0.085; sl.old = -1; });
    }
    if (reduced.matches) staticFrame(); else wake();
  } else {
    layout(); domTimer();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => readyResolve(true)));
}
boot();

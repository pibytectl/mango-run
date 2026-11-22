// What the browser remembers between runs: per mission the best score, the best time, how many runs, and
// which of its three goals were ever met; plus the galabeya the player picked. Storage can be blocked (private
// mode): every read and write is wrapped, and the game then simply plays without records.
const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

export function bestStars(m) { return Math.max(0, Math.min(3, +get('saidi.best.' + m) || 0)); }
export function getRec(m) {
  let r = null;
  try { r = JSON.parse(get('saidi.rec.' + m) || 'null'); } catch (e) { r = null; }
  if (!r || typeof r !== 'object') r = {};
  return { score: +r.score || 0, time: +r.time || 0, runs: +r.runs || 0, goals: [0, 1, 2].map((i) => !!(r.goals && r.goals[i])) };
}
// a finished run: { score, time (s), stars: [bool x3] }. Returns what was new about it.
export function saveRun(m, run) {
  const prev = getRec(m), n = run.stars.filter(Boolean).length, starsBefore = bestStars(m);
  const rec = {
    score: Math.max(prev.score, run.score), time: prev.time ? Math.min(prev.time, run.time) : run.time, runs: prev.runs + 1,
    goals: prev.goals.map((g, i) => g || !!run.stars[i]),
  };
  set('saidi.rec.' + m, JSON.stringify(rec));
  set('saidi.best.' + m, String(Math.max(n, starsBefore)));
  const costume = n === 3 && starsBefore < 3 ? COSTUMES.find((c) => c.need === m) || null : null;
  return { prev, rec, first: prev.runs === 0, newScore: prev.runs > 0 && run.score > prev.score, newTime: prev.runs > 0 && run.time < prev.time, costume };
}

// Galabeyas: three stars on a mission open one. `robe` and `stripe` feed the same recolour the townspeople use.
export const COSTUMES = [
  { id: 'own', ar: 'الأصلية', en: 'Classic' },
  { id: 'eid', need: 1, robe: 0xe6e0d0, ar: 'بتاعة العيد', en: 'Eid white' },
  { id: 'nile', need: 2, robe: 0x25456e, stripe: 0x9db7d8, ar: 'النيلي', en: 'Nile blue' },
  { id: 'boss', need: 3, robe: 0x2b2a2e, stripe: 0xd9a640, ar: 'كبير الشارع', en: 'Street boss' },
];
export const costumeOpen = (c) => !c.need || bestStars(c.need) >= 3;
export function getCostume() {
  const c = COSTUMES.find((x) => x.id === get('saidi.costume'));
  return c && costumeOpen(c) ? c : COSTUMES[0];
}
// the next open galabeya after the current one (the title's pill cycles through them)
export function nextCostume() {
  const open = COSTUMES.filter(costumeOpen), i = open.indexOf(getCostume());
  const c = open[(i + 1) % open.length];
  set('saidi.costume', c.id);
  return c;
}

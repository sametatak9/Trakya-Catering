/* eslint-disable @typescript-eslint/no-explicit-any */
// Demo sunucusu: supabase-js'nin yaptığı HTTP isteklerini (PostgREST + GoTrue) tarayıcı içinde yanıtlar.
// createClient(..., { global: { fetch: demoFetch } }) ile bağlanır; ağa hiç çıkılmaz.
import { DemoError, Engine, pkOf, type DemoDb, type Row } from './engine';
import { DEMO_VERSION, buildSeed } from './seed';
import { DEMO_USERS, demoEmail } from './users';

const STORE_KEY = 'tc_demo_db';

function loadDb(): DemoDb {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const db = JSON.parse(raw) as DemoDb;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
      // Her gün taze senaryo: tarihler "bugün"e göre kurulur
      if (db.version === DEMO_VERSION && db.seededOn === today) return db;
    }
  } catch { /* bozuk kayıt: yeniden kur */ }
  const db = buildSeed();
  saveDb(db);
  return db;
}
function saveDb(db: DemoDb) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* kota dolu / gizli pencere: bellekte devam */ }
}
export function resetDemo() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* yok say */ }
}

let engine: Engine | null = null;
let currentUser: string | null = null;
function getEngine() {
  if (!engine) engine = new Engine(loadDb(), () => currentUser);
  return engine;
}

// ---------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const pgError = (code: string, message: string, status = 400) => json({ code, message, details: null, hint: null }, status);

function b64url(s: string) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decodeB64url(s: string) { return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))); }

function userFor(userId: string) {
  const m = DEMO_USERS.find((u) => u.user_id === userId);
  if (!m) return null;
  return {
    id: m.user_id, aud: 'authenticated', role: 'authenticated', email: demoEmail(m.role), email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email' }, user_metadata: { full_name: m.full_name }, created_at: '2026-01-01T00:00:00Z', updated_at: new Date().toISOString(),
  };
}
function sessionFor(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const token = [b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), b64url(JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', exp, demo: true })), 'demo'].join('.');
  return { access_token: token, token_type: 'bearer', expires_in: 60 * 60 * 24 * 30, expires_at: exp, refresh_token: `demo-refresh-${userId}`, user: userFor(userId) };
}
function userFromAuthHeader(h: string | null): string | null {
  const tok = h?.replace(/^Bearer\s+/i, '') ?? '';
  const part = tok.split('.')[1];
  if (!part) return null;
  try { return (JSON.parse(decodeB64url(part)) as { sub?: string }).sub ?? null; } catch { return null; }
}

// ---------------------------------------------------------------------
// PostgREST filtreleri
// ---------------------------------------------------------------------
function coerce(sample: unknown, v: string): unknown {
  if (v === 'null') return null;
  if (typeof sample === 'number') return Number(v);
  if (typeof sample === 'boolean') return v === 'true';
  return v;
}
function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0; let q = false; let cur = '';
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (!q && ch === '(') depth++;
    if (!q && ch === ')') depth--;
    if (!q && depth === 0 && ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
const unquote = (s: string) => s.replace(/^"(.*)"$/, '$1');
function likeToRegex(p: string, ci: boolean) {
  const esc = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*');
  return new RegExp(`^${esc}$`, ci ? 'i' : '');
}

type Pred = (r: Row) => boolean;
function predicate(col: string, expr: string): Pred {
  let neg = false;
  if (expr.startsWith('not.')) { neg = true; expr = expr.slice(4); }
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot); const raw = expr.slice(dot + 1);
  const p: Pred = (r) => {
    const v = r[col];
    switch (op) {
      case 'eq': return v === coerce(v, raw) || String(v) === raw;
      case 'neq': return !(v === coerce(v, raw) || String(v) === raw);
      case 'gt': return v != null && v > coerce(v, raw)!;
      case 'gte': return v != null && v >= coerce(v, raw)!;
      case 'lt': return v != null && v < coerce(v, raw)!;
      case 'lte': return v != null && v <= coerce(v, raw)!;
      case 'is': return raw === 'null' ? v == null : raw === 'true' ? v === true : raw === 'false' ? v === false : false;
      case 'in': {
        const vals = splitTop(raw.replace(/^\(/, '').replace(/\)$/, '')).map(unquote);
        return vals.some((x) => String(v) === x);
      }
      case 'like': return v != null && likeToRegex(raw, false).test(String(v));
      case 'ilike': return v != null && likeToRegex(raw, true).test(String(v));
      case 'cs': { const vals = raw.replace(/^\{/, '').replace(/\}$/, '').split(',').map(unquote); return Array.isArray(v) && vals.every((x) => v.includes(x)); }
      default: return true;
    }
  };
  return neg ? (r) => !p(r) : p;
}
function orPredicate(expr: string): Pred {
  const parts = splitTop(expr.replace(/^\(/, '').replace(/\)$/, ''));
  const preds = parts.map((part) => {
    if (part.startsWith('and(')) { const inner = splitTop(part.slice(4, -1)).map(parseCond); return (r: Row) => inner.every((f) => f(r)); }
    return parseCond(part);
  });
  return (r) => preds.some((f) => f(r));
}
function parseCond(c: string): Pred {
  const i = c.indexOf('.');
  return predicate(c.slice(0, i), c.slice(i + 1));
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function applyQuery(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows;
  for (const [k, v] of params) {
    if (RESERVED.has(k)) continue;
    if (k === 'or') out = out.filter(orPredicate(v));
    else if (k === 'and') { const ps = splitTop(v.slice(1, -1)).map(parseCond); out = out.filter((r) => ps.every((f) => f(r))); }
    else out = out.filter(predicate(k, v));
  }
  return out;
}
function applyOrder(rows: Row[], params: URLSearchParams): Row[] {
  const order = params.get('order');
  let out = rows;
  if (order) {
    const keys = order.split(',').map((o) => { const [col, dir, nulls] = o.split('.'); return { col, desc: dir === 'desc', nullsFirst: nulls === 'nullsfirst' }; });
    out = [...rows].sort((a, b) => {
      for (const k of keys) {
        const x = a[k.col]; const y = b[k.col];
        if (x == null && y == null) continue;
        if (x == null) return k.nullsFirst ? -1 : 1;
        if (y == null) return k.nullsFirst ? 1 : -1;
        const c = typeof x === 'string' ? x.localeCompare(String(y), 'tr') : x < y ? -1 : x > y ? 1 : 0;
        if (c !== 0) return k.desc ? -c : c;
      }
      return 0;
    });
  }
  const offset = Number(params.get('offset') ?? 0); const limit = params.get('limit');
  if (offset || limit) out = out.slice(offset, limit ? offset + Number(limit) : undefined);
  return out;
}
function project(rows: Row[], select: string | null): Row[] {
  if (!select || select.trim() === '*') return rows.map((r) => ({ ...r }));
  const cols = splitTop(select).map((c) => c.trim()).filter(Boolean);
  if (cols.includes('*')) return rows.map((r) => ({ ...r }));
  return rows.map((r) => Object.fromEntries(cols.map((c) => { const [alias, src] = c.includes(':') ? c.split(':') : [c, c]; return [alias, r[src]]; })));
}

// ---------------------------------------------------------------------
// İstek yönlendirme
// ---------------------------------------------------------------------
async function handle(url: URL, init: RequestInit & { headers: Headers }): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const path = url.pathname;
  const bodyText = typeof init.body === 'string' ? init.body : '';
  const body = bodyText ? JSON.parse(bodyText) : null;

  // --- Auth (GoTrue)
  if (path.startsWith('/auth/v1/')) {
    const ep = path.slice('/auth/v1/'.length);
    if (ep === 'token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const u = DEMO_USERS.find((x) => demoEmail(x.role) === String(body?.email ?? '').toLowerCase());
        if (!u) return json({ error: 'invalid_grant', error_description: 'Demo kullanıcısı bulunamadı', code: 'invalid_credentials', msg: 'Demo kullanıcısı bulunamadı' }, 400);
        return json(sessionFor(u.user_id));
      }
      if (grant === 'refresh_token') {
        const uid = String(body?.refresh_token ?? '').replace('demo-refresh-', '');
        return userFor(uid) ? json(sessionFor(uid)) : json({ error: 'invalid_grant', msg: 'Oturum geçersiz' }, 400);
      }
    }
    if (ep === 'user') {
      const uid = userFromAuthHeader(init.headers.get('Authorization'));
      const u = uid ? userFor(uid) : null;
      return u ? json(u) : json({ code: 401, msg: 'Oturum yok' }, 401);
    }
    if (ep === 'logout') return new Response(null, { status: 204 });
    if (ep === 'signup') return json({ code: 422, msg: 'Demoda yeni hesap açılmaz; bir rol seçerek girin.', error_code: 'signup_disabled' }, 422);
    return json({});
  }

  if (!path.startsWith('/rest/v1/')) return json({ message: 'Demo: bilinmeyen adres' }, 404);
  currentUser = userFromAuthHeader(init.headers.get('Authorization'));
  const e = getEngine();
  const name = path.slice('/rest/v1/'.length);
  const accept = init.headers.get('Accept') ?? '';
  const prefer = init.headers.get('Prefer') ?? '';
  const wantsSingle = accept.includes('vnd.pgrst.object');
  const params = url.searchParams;

  const respondRows = (rows: Row[], status = 200) => {
    if (wantsSingle) {
      if (rows.length !== 1) return pgError('PGRST116', `JSON object requested, multiple (or no) rows returned (${rows.length})`, 406);
      return json(rows[0], status);
    }
    return json(rows, status);
  };

  try {
    if (name.startsWith('rpc/')) {
      const fn = name.slice(4);
      const args = method === 'GET' ? Object.fromEntries(params) : (body ?? {});
      const result = e.rpc(fn, args);
      saveDb(e.db);
      return json(result);
    }

    const view = e.view(name);
    if (method === 'GET' || method === 'HEAD') {
      const base = view ?? e.rows(name);
      return respondRows(project(applyOrder(applyQuery(base, params), params), params.get('select')));
    }
    if (view) return pgError('42501', 'Görünüm üzerinde yazma yapılamaz', 405);

    const returning = prefer.includes('return=representation');
    let changed: Row[] = [];
    if (method === 'POST') {
      const upsert = prefer.includes('resolution=merge-duplicates');
      const conflict = params.get('on_conflict')?.split(',') ?? [pkOf(name)];
      const list = Array.isArray(body) ? body : [body];
      const snapshot = JSON.stringify(e.db.t);
      try { changed = list.map((r: Row) => e.insert(name, r, { upsert, onConflict: conflict })); }
      catch (err) { e.db.t = JSON.parse(snapshot); throw err; }
    } else if (method === 'PATCH') {
      const targets = applyQuery(e.rows(name), params);
      changed = targets.map((t) => e.patch(name, t, body ?? {}));
    } else if (method === 'DELETE') {
      const targets = applyQuery(e.rows(name), params);
      changed = targets.map((t) => ({ ...e.remove(name, t) }));
    }
    saveDb(e.db);
    if (!returning) return new Response(null, { status: method === 'POST' ? 201 : 204 });
    return respondRows(project(changed, params.get('select')), method === 'POST' ? 201 : 200);
  } catch (err) {
    if (err instanceof DemoError) return pgError(err.code, err.message, err.status);
    console.error('[demo]', err);
    return pgError('XX000', err instanceof Error ? err.message : 'Demo hatası', 500);
  }
}

export const demoFetch: typeof fetch = async (input, init) => {
  const req = input instanceof Request ? input : null;
  const url = new URL(req ? req.url : String(input));
  const headers = new Headers(init?.headers ?? req?.headers);
  let body = init?.body;
  if (body == null && req && req.method !== 'GET') body = await req.text();
  // Gerçek ağ hissi için çok kısa gecikme
  await new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
  return handle(url, { ...init, method: init?.method ?? req?.method, body, headers });
};

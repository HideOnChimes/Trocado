// Servidor do app de finanças.
// - Guarda a chave do Pluggy e o banco de dados (server/data).
// - Serve o site (web/dist) e a API em /api.
// - Padrão: só escuta em 127.0.0.1, sem login. Na nuvem: HOST=0.0.0.0 e APP_PASSWORD obrigatória.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pluggy from 'pluggy-sdk';
import { getKv, openDb, setKv, tx, upsert } from './db.mjs';
import { seedDemo } from './demo.mjs';
import { market } from './market.mjs';
import { brDate, syncAll } from './sync.mjs';

const { PluggyClient } = pluggy;
const here = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3333);
const HOST = process.env.HOST || '127.0.0.1';
const APP_PASSWORD = process.env.APP_PASSWORD || '';
/** Escutando fora do próprio computador. */
const PUBLIC = !/^(127\.0\.0\.1|localhost|::1)$/.test(HOST);
/** Com senha definida, toda a API exige sessão. */
const AUTH = APP_PASSWORD !== '';
const CLIENT_ID = process.env.PLUGGY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET || '';
const ENV_ITEM_IDS = (process.env.PLUGGY_ITEM_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const DEMO = !CLIENT_ID || !CLIENT_SECRET;
const DIST = path.join(here, '..', 'web', 'dist');
const SYNC_EVERY_MS = 6 * 3600_000;

// Fecha por padrão: exposto na rede sem senha forte, não sobe.
if ((PUBLIC && !AUTH) || (AUTH && APP_PASSWORD.length < 12)) {
  console.error('Defina APP_PASSWORD com pelo menos 12 caracteres. Sem ela o servidor só pode rodar em HOST=127.0.0.1.');
  process.exit(1);
}

const client = DEMO ? null : new PluggyClient({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });

let db;
if (DEMO) {
  db = openDb(':memory:');
  seedDemo(db);
} else {
  fs.mkdirSync(path.join(here, 'data'), { recursive: true });
  db = openDb(path.join(here, 'data', 'financas.db'));
}

const DEFAULT_SETTINGS = { savingsTargetPct: 20, monthlyIncome: null, emergencyMonths: 6 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- validação de entrada ----------
// Mesma normalização que o site usa para montar a chave do estabelecimento:
// sem acento, só letras, palavras de 2+ letras. "UBER *TRIP 1234" vira "uber trip".
const fold = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .join(' ');

function text(value, name, max = 80) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, `Campo inválido: ${name}`);
  return value.trim();
}
function money(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new HttpError(400, `Valor inválido: ${name}`);
  return Math.round(n * 100) / 100;
}
function requireUuid(id) {
  if (!UUID.test(id)) throw new HttpError(400, 'ID inválido');
  return id;
}

async function readJson(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Envie JSON');
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) throw new HttpError(413, 'Corpo grande demais');
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
}

// ---------- leitura ----------
function readData() {
  const rules = db.prepare('SELECT id, pattern, category FROM rules ORDER BY id').all();
  const transactions = db
    .prepare('SELECT * FROM transactions ORDER BY date DESC, id')
    .all()
    .map((t) => {
      // Categoria final: sua escolha > sua regra > categoria automática.
      let category = t.user_category;
      if (!category) {
        const folded = fold(`${t.merchant ?? ''} ${t.description}`);
        category = rules.find((r) => folded.includes(r.pattern))?.category ?? t.auto_category;
      }
      return {
        id: t.id,
        accountId: t.account_id,
        date: t.date,
        description: t.description,
        merchant: t.merchant,
        amount: t.amount,
        category,
        autoCategory: t.auto_category,
        manual: !!t.user_category,
        note: t.note,
        ignored: !!t.ignored,
        pending: !!t.pending,
        instN: t.inst_n,
        instTotal: t.inst_total,
      };
    });

  return {
    demo: DEMO,
    today: brDate(),
    syncedAt: getKv(db, 'syncedAt', null),
    settings: { ...DEFAULT_SETTINGS, ...getKv(db, 'settings', {}) },
    items: db.prepare('SELECT id, bank, color, status, last_updated_at AS lastUpdatedAt, error FROM items ORDER BY bank').all(),
    accounts: db.prepare('SELECT id, item_id AS itemId, type, subtype, name, number, balance, credit_limit AS creditLimit, available_limit AS availableLimit, due_date AS dueDate FROM accounts ORDER BY type, name').all(),
    investments: db.prepare('SELECT id, item_id AS itemId, name, type, subtype, balance, invested, profit, rate, rate_type AS rateType, annual_rate AS annualRate, due_date AS dueDate, issuer FROM investments ORDER BY balance DESC').all(),
    transactions,
    rules,
    budgets: Object.fromEntries(db.prepare('SELECT category, amount FROM budgets').all().map((b) => [b.category, b.amount])),
    categoryKinds: Object.fromEntries(db.prepare('SELECT category, kind FROM category_kinds').all().map((k) => [k.category, k.kind])),
    goals: db.prepare('SELECT id, name, target, saved, deadline, created_at AS createdAt FROM goals ORDER BY id').all(),
    dismissed: db.prepare('SELECT key FROM dismissed').all().map((d) => d.key),
    snapshots: db.prepare('SELECT date, cash, card_debt AS cardDebt, invested FROM snapshots ORDER BY date').all(),
  };
}

// ---------- sincronização ----------
let syncing = null;
function sync() {
  if (DEMO) return Promise.resolve({ errors: [] });
  syncing ??= syncAll(db, client, ENV_ITEM_IDS).finally(() => {
    syncing = null;
  });
  return syncing;
}

// ---------- login e sessão ----------
const SESSION_MS = 30 * 86400_000;
const LOGIN_MAX_FAILS = 8;
const LOGIN_WINDOW_MS = 15 * 60_000;
// shortcut: limite global, não por IP (atrás do proxy o IP visto é o do proxy e o cabeçalho de IP é forjável).
// Alguém errando de propósito trava o seu login por 15 min; trocar por IP confiável se isso virar problema.
let loginFails = [];

const sha256 = (s) => crypto.createHash('sha256').update(s).digest();
const sessionCookie = (token, maxAgeSeconds) => `sessao=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;

function hasSession(req) {
  const token = /(?:^|;\s*)sessao=([0-9a-f]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  if (!token) return false;
  // O banco guarda só o hash do token: quem ler o arquivo não consegue montar o cookie.
  return getKv(db, 'sessions', {})[sha256(token).toString('hex')] > Date.now();
}

/** Confere a senha e devolve o token de uma sessão nova. */
function login(password) {
  const now = Date.now();
  loginFails = loginFails.filter((at) => at > now - LOGIN_WINDOW_MS);
  if (loginFails.length >= LOGIN_MAX_FAILS) throw new HttpError(429, 'Muitas tentativas. Espere 15 minutos.');
  // Compara os hashes: timingSafeEqual exige tamanhos iguais e não revela onde a senha difere.
  if (typeof password !== 'string' || !crypto.timingSafeEqual(sha256(password), sha256(APP_PASSWORD))) {
    loginFails.push(now);
    throw new HttpError(401, 'Senha incorreta');
  }
  loginFails = [];
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = Object.fromEntries(Object.entries(getKv(db, 'sessions', {})).filter(([, expiresAt]) => expiresAt > now));
  sessions[sha256(token).toString('hex')] = now + SESSION_MS;
  setKv(db, 'sessions', sessions);
  return token;
}

// ---------- rotas da API ----------
// handler(match, body, ctx): ctx.headers recebe cabeçalhos extras da resposta (ex.: Set-Cookie).
const routes = [
  ['POST', /^\/api\/login$/, (_m, body, ctx) => {
    if (AUTH) ctx.headers['Set-Cookie'] = sessionCookie(login(body.password), SESSION_MS / 1000);
    return { ok: true };
  }],
  ['POST', /^\/api\/logout$/, (_m, _body, ctx) => {
    // Um usuário só: sair derruba todas as sessões (serve também para celular perdido).
    setKv(db, 'sessions', {});
    ctx.headers['Set-Cookie'] = sessionCookie('', 0);
    return { ok: true };
  }],
  ['GET', /^\/api\/session$/, () => ({ auth: AUTH })],

  ['GET', /^\/api\/data$/, () => readData()],
  ['GET', /^\/api\/market$/, () => market()],

  ['POST', /^\/api\/sync$/, async () => {
    const result = await sync();
    return { ...result, data: readData() };
  }],

  ['POST', /^\/api\/connect-token$/, async () => {
    if (DEMO) throw new HttpError(409, 'Modo demonstração: coloque PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET em server/.env e reinicie.');
    return client.createConnectToken(undefined, { clientUserId: 'eu', avoidDuplicates: true });
  }],

  ['POST', /^\/api\/items$/, async (_m, body) => {
    if (DEMO) throw new HttpError(409, 'Modo demonstração');
    const id = requireUuid(String(body.id || ''));
    if (!db.prepare('SELECT 1 FROM items WHERE id = ?').get(id)) upsert.item(db, { id, bank: 'Conectando…', status: 'UPDATING' });
    await sync();
    return readData();
  }],

  ['DELETE', /^\/api\/items\/([^/]+)$/, async ([, id]) => {
    if (DEMO) throw new HttpError(409, 'Modo demonstração');
    requireUuid(id);
    // Apaga a conexão no Pluggy. Se ele já não a conhece (404), segue limpando só aqui.
    await client.deleteItem(id).catch((err) => {
      if (err?.code !== 404) throw err;
    });
    tx(db, () => {
      const accounts = db.prepare('SELECT id FROM accounts WHERE item_id = ?').all(id);
      for (const a of accounts) db.prepare('DELETE FROM transactions WHERE account_id = ?').run(a.id);
      db.prepare('DELETE FROM accounts WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM investments WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
      db.prepare('DELETE FROM kv WHERE key = ?').run(`synced:${id}`);
    });
    return readData();
  }],

  ['PATCH', /^\/api\/transactions\/([^/]+)$/, ([, id], body) => {
    if (!db.prepare('SELECT 1 FROM transactions WHERE id = ?').get(id)) throw new HttpError(404, 'Transação não encontrada');
    if ('category' in body) db.prepare('UPDATE transactions SET user_category = ? WHERE id = ?').run(body.category ? text(body.category, 'categoria', 40) : null, id);
    if ('note' in body) db.prepare('UPDATE transactions SET note = ? WHERE id = ?').run(body.note ? text(body.note, 'nota', 200) : null, id);
    if ('ignored' in body) db.prepare('UPDATE transactions SET ignored = ? WHERE id = ?').run(body.ignored ? 1 : 0, id);
    return readData();
  }],

  ['POST', /^\/api\/rules$/, (_m, body) => {
    const pattern = fold(text(body.pattern, 'texto da regra', 60));
    if (pattern.length < 3) throw new HttpError(400, 'Regra precisa de pelo menos 3 letras');
    db.prepare('INSERT INTO rules (pattern, category) VALUES (?, ?) ON CONFLICT(pattern) DO UPDATE SET category = excluded.category').run(pattern, text(body.category, 'categoria', 40));
    return readData();
  }],
  ['DELETE', /^\/api\/rules\/(\d+)$/, ([, id]) => {
    db.prepare('DELETE FROM rules WHERE id = ?').run(Number(id));
    return readData();
  }],

  ['PUT', /^\/api\/budgets$/, (_m, body) => {
    const category = text(body.category, 'categoria', 40);
    const amount = money(body.amount, 'limite');
    if (amount === 0) db.prepare('DELETE FROM budgets WHERE category = ?').run(category);
    else db.prepare('INSERT INTO budgets (category, amount) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET amount = excluded.amount').run(category, amount);
    return readData();
  }],

  ['PUT', /^\/api\/category-kinds$/, (_m, body) => {
    const kind = ['essencial', 'estilo'].includes(body.kind) ? body.kind : null;
    if (!kind) throw new HttpError(400, 'Tipo inválido');
    db.prepare('INSERT INTO category_kinds (category, kind) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET kind = excluded.kind').run(text(body.category, 'categoria', 40), kind);
    return readData();
  }],

  ['POST', /^\/api\/goals$/, (_m, body) => {
    const deadline = body.deadline && /^\d{4}-\d{2}(-\d{2})?$/.test(body.deadline) ? body.deadline : null;
    db.prepare('INSERT INTO goals (name, target, saved, deadline, created_at) VALUES (?, ?, ?, ?, ?)').run(text(body.name, 'nome', 60), money(body.target, 'alvo'), money(body.saved ?? 0, 'guardado'), deadline, brDate());
    return readData();
  }],
  ['PATCH', /^\/api\/goals\/(\d+)$/, ([, id], body) => {
    if ('saved' in body) db.prepare('UPDATE goals SET saved = ? WHERE id = ?').run(money(body.saved, 'guardado'), Number(id));
    if ('target' in body) db.prepare('UPDATE goals SET target = ? WHERE id = ?').run(money(body.target, 'alvo'), Number(id));
    return readData();
  }],
  ['DELETE', /^\/api\/goals\/(\d+)$/, ([, id]) => {
    db.prepare('DELETE FROM goals WHERE id = ?').run(Number(id));
    return readData();
  }],

  ['POST', /^\/api\/dismiss$/, (_m, body) => {
    db.prepare('INSERT OR REPLACE INTO dismissed (key, at) VALUES (?, ?)').run(text(body.key, 'chave', 120), brDate());
    return readData();
  }],

  ['PUT', /^\/api\/settings$/, (_m, body) => {
    const current = { ...DEFAULT_SETTINGS, ...getKv(db, 'settings', {}) };
    if ('savingsTargetPct' in body) current.savingsTargetPct = Math.min(90, Math.max(0, Number(body.savingsTargetPct) || 0));
    if ('monthlyIncome' in body) current.monthlyIncome = body.monthlyIncome ? money(body.monthlyIncome, 'renda') : null;
    if ('emergencyMonths' in body) current.emergencyMonths = Math.min(24, Math.max(1, Math.round(Number(body.emergencyMonths) || 6)));
    setKv(db, 'settings', current);
    return readData();
  }],
];

// ---------- site estático ----------
const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  let file = path.resolve(DIST, rel);
  // Nunca sai da pasta do site; rota desconhecida cai no index.html.
  if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Site ainda não foi gerado. Rode "npm run build" na pasta do projeto.');
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...SECURITY_HEADERS,
  });
  fs.createReadStream(file).pipe(res);
}

// ---------- servidor ----------
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers });
    res.end(JSON.stringify(body));
  };

  try {
    const host = req.headers.host || '';
    const origin = req.headers.origin;
    if (PUBLIC) {
      // Nuvem: a página que chama tem de ser a do próprio domínio (CSRF). Escrita sem Origin não passa:
      // todo navegador atual manda Origin em POST/PUT/PATCH/DELETE.
      const isWrite = req.method !== 'GET' && req.method !== 'HEAD';
      const sameSite = origin !== undefined && origin.replace(/^https?:\/\//, '') === host;
      if (origin === undefined && isWrite) throw new HttpError(403, 'Origem não permitida');
      if (origin !== undefined && !sameSite) throw new HttpError(403, 'Origem não permitida');
    } else {
      // Local: só aceita chamadas feitas para localhost e vindas de página local.
      // Bloqueia site malicioso tentando ler seus dados pelo navegador (DNS rebinding / CSRF).
      if (!LOCAL_HOST.test(host)) throw new HttpError(403, 'Acesso apenas local');
      if (origin && !LOCAL_HOST.test(origin.replace(/^https?:\/\//, ''))) throw new HttpError(403, 'Origem não permitida');
    }

    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Método não permitido');
      return serveStatic(url.pathname, res);
    }

    // Um ponto só de checagem: nenhuma rota de dados roda sem sessão quando há senha.
    if (AUTH && url.pathname !== '/api/login' && !hasSession(req)) throw new HttpError(401, 'Faça login');

    for (const [method, pattern, handler] of routes) {
      const match = req.method === method && url.pathname.match(pattern);
      if (!match) continue;
      const body = method === 'GET' || method === 'DELETE' ? {} : await readJson(req);
      const ctx = { headers: {} };
      return send(200, await handler(match, body, ctx), ctx.headers);
    }
    throw new HttpError(404, 'Rota não encontrada');
  } catch (err) {
    // Erros do SDK do Pluggy trazem o status HTTP em err.code. 401/403 dele (chave do Pluggy recusada)
    // viram 502: para o site, 401 significa "faça login".
    const upstream = Number.isInteger(err?.code) && err.code >= 400 && err.code < 600 ? err.code : 500;
    const status = err instanceof HttpError ? err.status : upstream === 401 || upstream === 403 ? 502 : upstream;
    if (status >= 500) console.error(`${req.method} ${url.pathname}:`, err?.message || err);
    send(status, { error: err?.message || 'Erro interno' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Finanças em http://${PUBLIC ? HOST : 'localhost'}:${PORT}${DEMO ? '  (MODO DEMONSTRAÇÃO: dados falsos, nada é salvo)' : ''}`);
  if (!DEMO) {
    const run = () => sync().then((r) => r.errors.length && console.error('Sincronização com erros:', r.errors)).catch((e) => console.error('Sincronização falhou:', e?.message || e));
    run();
    setInterval(run, SYNC_EVERY_MS).unref();
  }
});

// Banco local (SQLite embutido no Node). Guarda o histórico para sempre,
// mesmo que o banco/Pluggy só devolva os últimos meses.
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, bank TEXT NOT NULL, color TEXT, status TEXT NOT NULL,
  last_updated_at TEXT, error TEXT
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL, type TEXT NOT NULL, subtype TEXT, name TEXT NOT NULL,
  number TEXT, balance REAL NOT NULL, credit_limit REAL, available_limit REAL, due_date TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL, date TEXT NOT NULL, description TEXT NOT NULL,
  amount REAL NOT NULL,            -- saída negativa, entrada positiva
  auto_category TEXT NOT NULL,     -- categoria vinda do banco/Pluggy
  pending INTEGER NOT NULL DEFAULT 0,
  merchant TEXT, inst_n INTEGER, inst_total INTEGER,
  user_category TEXT, note TEXT, ignored INTEGER NOT NULL DEFAULT 0  -- escolhas suas: nunca sobrescritas pela sincronização
);
CREATE INDEX IF NOT EXISTS tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS tx_account ON transactions(account_id, date);
CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, subtype TEXT,
  balance REAL NOT NULL, invested REAL, profit REAL, rate REAL, rate_type TEXT, annual_rate REAL,
  due_date TEXT, issuer TEXT
);
CREATE TABLE IF NOT EXISTS rules (id INTEGER PRIMARY KEY AUTOINCREMENT, pattern TEXT NOT NULL UNIQUE, category TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS budgets (category TEXT PRIMARY KEY, amount REAL NOT NULL);
CREATE TABLE IF NOT EXISTS category_kinds (category TEXT PRIMARY KEY, kind TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, target REAL NOT NULL, saved REAL NOT NULL DEFAULT 0,
  deadline TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dismissed (key TEXT PRIMARY KEY, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS snapshots (date TEXT PRIMARY KEY, cash REAL NOT NULL, card_debt REAL NOT NULL, invested REAL NOT NULL);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/** Roda fn dentro de uma transação SQL: ou grava tudo, ou nada. */
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getKv(db, key, fallback) {
  const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
}

export function setKv(db, key, value) {
  db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
}

export const upsert = {
  item: (db, i) =>
    db.prepare(`INSERT INTO items (id, bank, color, status, last_updated_at, error) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET bank = excluded.bank, color = excluded.color, status = excluded.status,
        last_updated_at = excluded.last_updated_at, error = excluded.error`)
      .run(i.id, i.bank, i.color ?? null, i.status, i.lastUpdatedAt ?? null, i.error ?? null),

  account: (db, a) =>
    db.prepare(`INSERT INTO accounts (id, item_id, type, subtype, name, number, balance, credit_limit, available_limit, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET item_id = excluded.item_id, type = excluded.type, subtype = excluded.subtype, name = excluded.name,
        number = excluded.number, balance = excluded.balance, credit_limit = excluded.credit_limit,
        available_limit = excluded.available_limit, due_date = excluded.due_date`)
      .run(a.id, a.itemId, a.type, a.subtype ?? null, a.name, a.number ?? null, a.balance, a.creditLimit ?? null, a.availableLimit ?? null, a.dueDate ?? null),

  // Atualiza só o que vem do banco. user_category, note e ignored ficam intactos.
  transaction: (db, t) =>
    db.prepare(`INSERT INTO transactions (id, account_id, date, description, amount, auto_category, pending, merchant, inst_n, inst_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, date = excluded.date, description = excluded.description,
        amount = excluded.amount, auto_category = excluded.auto_category, pending = excluded.pending, merchant = excluded.merchant,
        inst_n = excluded.inst_n, inst_total = excluded.inst_total`)
      .run(t.id, t.accountId, t.date, t.description, t.amount, t.autoCategory, t.pending ? 1 : 0, t.merchant ?? null, t.instN ?? null, t.instTotal ?? null),

  investment: (db, v) =>
    db.prepare(`INSERT INTO investments (id, item_id, name, type, subtype, balance, invested, profit, rate, rate_type, annual_rate, due_date, issuer)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET item_id = excluded.item_id, name = excluded.name, type = excluded.type, subtype = excluded.subtype,
        balance = excluded.balance, invested = excluded.invested, profit = excluded.profit, rate = excluded.rate,
        rate_type = excluded.rate_type, annual_rate = excluded.annual_rate, due_date = excluded.due_date, issuer = excluded.issuer`)
      .run(v.id, v.itemId, v.name, v.type, v.subtype ?? null, v.balance, v.invested ?? null, v.profit ?? null, v.rate ?? null, v.rateType ?? null, v.annualRate ?? null, v.dueDate ?? null, v.issuer ?? null),
};

/** Retrato do patrimônio no dia: um por dia, o último vence. */
export function snapshotToday(db, date) {
  const cash = db.prepare("SELECT COALESCE(SUM(balance), 0) v FROM accounts WHERE type = 'BANK'").get().v;
  const cardDebt = db.prepare("SELECT COALESCE(SUM(balance), 0) v FROM accounts WHERE type = 'CREDIT'").get().v;
  const invested = db.prepare('SELECT COALESCE(SUM(balance), 0) v FROM investments').get().v;
  db.prepare(`INSERT INTO snapshots (date, cash, card_debt, invested) VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET cash = excluded.cash, card_debt = excluded.card_debt, invested = excluded.invested`).run(date, cash, cardDebt, invested);
}

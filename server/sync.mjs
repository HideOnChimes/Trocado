// Puxa dados do Pluggy e grava no banco local.
import { getKv, setKv, snapshotToday, tx, upsert } from './db.mjs';

/** Categorias de movimentação interna: não são gasto nem receita. */
export const INTERNAL = { TRANSFER: 'Transferência própria', BILL: 'Pagamento de fatura', INVEST: 'Investimentos' };

const INTERNAL_RULES = [
  [/same person transfer/i, INTERNAL.TRANSFER],
  [/credit card payment/i, INTERNAL.BILL],
  [/^investments?$/i, INTERNAL.INVEST],
];
// Rede de segurança para pagamento de fatura que chegou sem categoria.
const BILL_PAYMENT = /pag(amento|to)\.?\s.*(fatura|recebido)/i;
// Parcela escrita na descrição de compra no cartão: "LOJA X PARC 03/10", "PARCELA 3 DE 10"
// ou "LOJA X 3/10" no fim do texto. Só no fim, para não confundir com data no meio da descrição.
const INSTALLMENT = /parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})|\s(\d{1,2})\/(\d{1,2})$/i;

/** Data no fuso de Brasília (UTC-3, sem horário de verão) como AAAA-MM-DD. */
export function brDate(d = new Date()) {
  return new Date(new Date(d).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

function monthsAgo(n) {
  const [y, m] = brDate().split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return d.toISOString().slice(0, 10);
}

async function loadCategories(client) {
  try {
    const page = await client.fetchCategories();
    return new Map(page.results.map((c) => [c.id, { en: c.description, pt: c.descriptionTranslated || c.description, parentId: c.parentId || null }]));
  } catch (err) {
    console.error('Falha ao carregar categorias do Pluggy:', err?.message || err);
    return new Map();
  }
}

function classify(categories, t) {
  if (BILL_PAYMENT.test(t.description || '')) return INTERNAL.BILL;
  const chain = [];
  for (let id = t.categoryId, guard = 0; id && guard < 6; guard++) {
    const c = categories.get(id);
    if (!c) break;
    chain.push(c);
    id = c.parentId;
  }
  for (const c of chain) for (const [re, name] of INTERNAL_RULES) if (re.test(c.en)) return name;
  if (chain.length) return chain[chain.length - 1].pt;
  for (const [re, name] of INTERNAL_RULES) if (re.test(t.category || '')) return name;
  return t.category || 'Outros';
}

function installment(t, isCard) {
  const meta = t.creditCardMetadata;
  if (meta?.totalInstallments > 1 && meta.installmentNumber) return [meta.installmentNumber, meta.totalInstallments];
  const m = isCard && t.type === 'DEBIT' ? INSTALLMENT.exec(t.description || '') : null;
  if (m) {
    const n = Number(m[1] ?? m[3]);
    const total = Number(m[2] ?? m[4]);
    if (total > 1 && total <= 48 && n >= 1 && n <= total) return [n, total];
  }
  return [null, null];
}

function toRow(t, categories, isCard) {
  const abs = Math.abs(t.amountInAccountCurrency ?? t.amount);
  const [instN, instTotal] = installment(t, isCard);
  return {
    id: t.id,
    accountId: t.accountId,
    date: brDate(t.date),
    description: t.description,
    amount: t.type === 'DEBIT' ? -abs : abs, // sinal normalizado para conta e cartão
    autoCategory: classify(categories, t),
    pending: t.status === 'PENDING',
    merchant: t.merchant?.name || t.merchant?.businessName || null,
    instN,
    instTotal,
  };
}

/**
 * Sincroniza todos os itens conhecidos.
 * Primeira vez: 12 meses de histórico. Depois: últimos 90 dias (cobre correções e pendentes).
 */
export async function syncAll(db, client, extraItemIds = []) {
  const known = db.prepare('SELECT id FROM items').all().map((r) => r.id);
  const ids = [...new Set([...known, ...extraItemIds])];
  const categories = await loadCategories(client);
  const today = brDate();
  const errors = [];

  for (const id of ids) {
    try {
      const first = !getKv(db, `synced:${id}`, false);
      const from = monthsAgo(first ? 12 : 3);
      const [item, accountsPage] = await Promise.all([client.fetchItem(id), client.fetchAccounts(id)]);
      const accounts = accountsPage.results;
      const lists = await Promise.all(accounts.map((a) => client.fetchAllTransactions(a.id, { dateFrom: from, dateTo: today })));
      // Nem todo banco/conector entrega investimentos: falha aqui não derruba o resto.
      const investments = await client.fetchInvestments(id).then((p) => p.results).catch(() => []);

      tx(db, () => {
        upsert.item(db, {
          id: item.id,
          bank: item.connector?.name ?? 'Banco',
          color: item.connector?.primaryColor ? `#${String(item.connector.primaryColor).replace('#', '')}` : null,
          status: item.status,
          lastUpdatedAt: item.lastUpdatedAt ? new Date(item.lastUpdatedAt).toISOString() : null,
          error: item.error?.message ?? null,
        });
        accounts.forEach((a, i) => {
          upsert.account(db, {
            id: a.id,
            itemId: a.itemId,
            type: a.type,
            subtype: a.subtype,
            name: a.marketingName || a.name,
            number: a.number ? String(a.number).slice(-4) : null,
            balance: a.balance,
            creditLimit: a.creditData?.creditLimit,
            availableLimit: a.creditData?.availableCreditLimit,
            dueDate: a.creditData?.balanceDueDate ? brDate(a.creditData.balanceDueDate) : null,
          });
          const rows = lists[i].map((t) => toRow(t, categories, a.type === 'CREDIT'));
          const seen = new Set(rows.map((r) => r.id));
          // Pendente que sumiu da resposta virou lançamento definitivo com outro id: remove a sobra.
          for (const old of db.prepare('SELECT id FROM transactions WHERE account_id = ? AND date >= ? AND pending = 1').all(a.id, from)) {
            if (!seen.has(old.id)) db.prepare('DELETE FROM transactions WHERE id = ?').run(old.id);
          }
          rows.forEach((r) => upsert.transaction(db, r));
        });
        db.prepare('DELETE FROM investments WHERE item_id = ?').run(id);
        for (const v of investments) {
          if (v.status === 'TOTAL_WITHDRAWAL') continue;
          upsert.investment(db, {
            id: v.id,
            itemId: id,
            name: v.name,
            type: v.type,
            subtype: v.subtype,
            balance: v.balance,
            invested: v.amountOriginal ?? v.amount,
            profit: v.amountProfit,
            rate: v.rate,
            rateType: v.rateType,
            annualRate: v.annualRate ?? v.fixedAnnualRate,
            dueDate: v.dueDate ? brDate(v.dueDate) : null,
            issuer: v.issuer,
          });
        }
        setKv(db, `synced:${id}`, true);
      });
    } catch (err) {
      const msg = err?.message || 'Erro inesperado';
      errors.push({ id, error: msg });
      const row = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
      if (row) db.prepare("UPDATE items SET status = 'ERROR', error = ? WHERE id = ?").run(msg, id);
      else upsert.item(db, { id, bank: 'Conexão com problema', status: 'ERROR', error: msg });
    }
  }

  snapshotToday(db, today);
  setKv(db, 'syncedAt', new Date().toISOString());
  return { errors };
}

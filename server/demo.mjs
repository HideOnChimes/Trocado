// Dados falsos e determinísticos para ver o app funcionando sem chave do Pluggy.
// Nada aqui é dado real. Ficam só em memória: fechou o servidor, sumiu.
import { setKv, tx, upsert } from './db.mjs';
import { brDate, INTERNAL } from './sync.mjs';

const MONTHS = 12;
const CARD = 'demo-roxo-cartao';
const ROXO = 'demo-roxo-conta';
const LARANJA = 'demo-laranja-conta';

// Gerador pseudoaleatório com semente: mesmo mês devolve sempre os mesmos lançamentos.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');
const round = (n) => Math.round(n * 100) / 100;

// [descrição, categoria, valor, dia, conta]
const FIXED = [
  ['SALARIO EMPRESA LTDA', 'Renda', 6800, 5, LARANJA],
  ['ALUGUEL IMOBILIARIA CENTRAL', 'Moradia', -1900, 6, LARANJA],
  ['CONDOMINIO ED. JARDINS', 'Moradia', -420, 10, LARANJA],
  ['INTERNET FIBRA', 'Contas de casa', -119.9, 12, LARANJA],
  ['OPERADORA CELULAR', 'Contas de casa', -59.9, 15, LARANJA],
  ['TARIFA PACOTE DE SERVICOS', 'Tarifas e juros', -29.9, 2, LARANJA],
  ['TRANSFERENCIA ENTRE CONTAS', INTERNAL.TRANSFER, -2000, 6, LARANJA],
  ['TRANSFERENCIA ENTRE CONTAS', INTERNAL.TRANSFER, 2000, 6, ROXO],
  ['MUSICBOX PREMIUM', 'Serviços digitais', -21.9, 14, CARD],
  ['CLOUDDRIVE 200GB', 'Serviços digitais', -9.9, 18, CARD],
  ['ACADEMIA FITCLUB', 'Saúde', -99, 3, CARD],
  ['LINGUAAPP PREMIUM', 'Educação', -34.9, 21, CARD],
  ['JORNAL DIGITAL', 'Serviços digitais', -19.9, 9, CARD],
];

// [descrição, categoria, valor base, conta, peso]
const VARIABLE = [
  ['SUPERMERCADO BOM PRECO', 'Mercado', -210, CARD, 4],
  ['HORTIFRUTI DA ESQUINA', 'Mercado', -48, ROXO, 2],
  ['ICOMIDA DELIVERY', 'Alimentação', -46, CARD, 9],
  ['RESTAURANTE SABOR CASEIRO', 'Alimentação', -62, CARD, 3],
  ['CAFE EXPRESSO', 'Alimentação', -12, ROXO, 6],
  ['PADARIA PAO QUENTE', 'Alimentação', -16, ROXO, 4],
  ['APP CORRIDA', 'Transporte', -22, CARD, 6],
  ['POSTO BANDEIRA', 'Transporte', -170, CARD, 2],
  ['DROGARIA SAUDE', 'Saúde', -54, CARD, 2],
  ['LOJA ONLINE MEGA', 'Compras', -130, CARD, 2],
  ['CINEMA CENTER', 'Lazer', -52, CARD, 1],
  ['BAR DO ZE', 'Lazer', -85, CARD, 2],
];

// Compras parceladas: [descrição, categoria, parcela, total de parcelas, começou há N meses, dia]
const PLANS = [
  ['LOJA ELETRO NOTEBOOK', 'Compras', 349.9, 10, 4, 11],
  ['MOVEIS CASA SOFA', 'Compras', 280, 6, 2, 19],
  ['CLINICA ODONTO', 'Saúde', 250, 3, 8, 16],
];

function monthRows(year, month, back, todayKey) {
  const rand = rng(year * 100 + month);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const rows = [];
  const push = (description, category, amount, day, accountId, extra = {}) => {
    const date = `${year}-${pad(month)}-${pad(Math.min(day, days))}`;
    if (date > todayKey) return;
    rows.push({ id: `demo-${year}${pad(month)}-${rows.length}`, accountId, date, description, amount: round(amount), autoCategory: category, pending: false, ...extra });
  };

  for (const [d, c, a, day, acc] of FIXED) push(d, c, a, day, acc);
  push('COMPANHIA DE ENERGIA', 'Contas de casa', -(150 + rand() * 90), 10, LARANJA);
  // Assinatura que ficou mais cara nos últimos 3 meses.
  push('STREAMFLIX', 'Serviços digitais', back < 3 ? -44.9 : -39.9, 15, CARD);
  // Aporte: pulado em alguns meses, para o app ter o que apontar.
  if (![2, 5, 9].includes(back)) push('APLICACAO CDB', INTERNAL.INVEST, -500, 7, LARANJA);
  if (rand() < 0.3) push('PIX RECEBIDO FREELA', 'Renda', 600 + rand() * 900, 20, ROXO);
  if (back === 2) push('JUROS ROTATIVO CARTAO', 'Tarifas e juros', -87.4, 9, CARD);
  if (back === 0) push('INGRESSOS SHOW ARENA', 'Lazer', -380, 4, CARD);

  for (const [d, c, value, total, startedBack, day] of PLANS) {
    const n = startedBack - back + 1;
    if (n >= 1 && n <= total) push(`${d} PARC ${pad(n)}/${pad(total)}`, c, -value, day, CARD, { instN: n, instTotal: total });
  }

  const pool = VARIABLE.flatMap((v) => Array(v[4]).fill(v));
  const count = 30 + Math.floor(rand() * 8);
  let cardTotal = 0;
  for (let i = 0; i < count; i++) {
    const [d, c, base, acc] = pool[Math.floor(rand() * pool.length)];
    const amount = base * (0.6 + rand() * 0.8);
    if (acc === CARD) cardTotal += -amount;
    push(d, c, amount, 1 + Math.floor(rand() * days), acc);
  }
  push('PAGAMENTO DE FATURA', INTERNAL.BILL, -(1700 + cardTotal * 0.4), 8, ROXO);
  return rows;
}

/** Enche o banco (em memória) com 12 meses de movimentação falsa. */
export function seedDemo(db) {
  const today = brDate();
  const [ty, tm] = today.split('-').map(Number);

  tx(db, () => {
    upsert.item(db, { id: 'demo-roxo', bank: 'Banco Roxo (demo)', color: '#7b2ff7', status: 'UPDATED', lastUpdatedAt: new Date().toISOString() });
    upsert.item(db, { id: 'demo-laranja', bank: 'Banco Laranja (demo)', color: '#ec7000', status: 'UPDATED', lastUpdatedAt: new Date().toISOString() });

    upsert.account(db, { id: ROXO, itemId: 'demo-roxo', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta corrente', number: '4821', balance: 1412.57 });
    upsert.account(db, { id: CARD, itemId: 'demo-roxo', type: 'CREDIT', subtype: 'CREDIT_CARD', name: 'Cartão de crédito', number: '9034', balance: 2486.3, creditLimit: 8000, availableLimit: 5513.7, dueDate: `${ty}-${pad(tm)}-28` });
    upsert.account(db, { id: LARANJA, itemId: 'demo-laranja', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta corrente', number: '1177', balance: 4250.12 });
    upsert.account(db, { id: 'demo-laranja-poupanca', itemId: 'demo-laranja', type: 'BANK', subtype: 'SAVINGS_ACCOUNT', name: 'Poupança', number: '1178', balance: 2300 });

    upsert.investment(db, { id: 'demo-inv-cdb', itemId: 'demo-laranja', name: 'CDB Banco Laranja 110% CDI', type: 'FIXED_INCOME', subtype: 'CDB', balance: 12480.35, invested: 11200, profit: 1280.35, rate: 110, rateType: 'CDI', dueDate: `${ty + 2}-03-15`, issuer: 'Banco Laranja' });
    upsert.investment(db, { id: 'demo-inv-selic', itemId: 'demo-laranja', name: 'Tesouro Selic 2029', type: 'FIXED_INCOME', subtype: 'TREASURY', balance: 8150.9, invested: 7600, profit: 550.9, rate: 100, rateType: 'SELIC', dueDate: '2029-03-01', issuer: 'Tesouro Nacional' });
    upsert.investment(db, { id: 'demo-inv-fundo', itemId: 'demo-laranja', name: 'Fundo Multimercado Alfa', type: 'MUTUAL_FUND', subtype: 'MULTIMARKET_FUND', balance: 3904.1, invested: 4000, profit: -95.9 });
    upsert.investment(db, { id: 'demo-inv-etf', itemId: 'demo-laranja', name: 'ETF Ibovespa', type: 'ETF', balance: 2750.4, invested: 2400, profit: 350.4 });

    for (let back = MONTHS - 1; back >= 0; back--) {
      const d = new Date(Date.UTC(ty, tm - 1 - back, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      monthRows(y, m, back, today).forEach((r) => upsert.transaction(db, r));
      // Retrato mensal do patrimônio, crescendo devagar até hoje.
      const date = back === 0 ? today : `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
      const wobble = rng(y * 100 + m + 7)();
      db.prepare('INSERT OR REPLACE INTO snapshots (date, cash, card_debt, invested) VALUES (?, ?, ?, ?)').run(
        date,
        round(7962.69 - back * 110 + wobble * 900),
        round(2486.3 - 300 + wobble * 600),
        round(27285.75 - back * 640 - wobble * 300),
      );
    }
    db.prepare('INSERT OR REPLACE INTO snapshots (date, cash, card_debt, invested) VALUES (?, 7962.69, 2486.3, 27285.75)').run(today);
    setKv(db, 'syncedAt', new Date().toISOString());
  });
}

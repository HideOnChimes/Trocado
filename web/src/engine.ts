// Motor de análise: transforma transações cruas nos números que o app mostra.
// Funções puras, sem React. Tudo recalcula quando os dados mudam.
import { brl, dayOf, daysInMonth, fold, monthLabel, monthOf, pct, shiftMonth } from './format.ts';
import type { Account, Data, Kind, Tx } from './types.ts';

/** Movimentação interna: não é gasto nem receita. */
export const INTERNAL = { TRANSFER: 'Transferência própria', BILL: 'Pagamento de fatura', INVEST: 'Investimentos' } as const;
const INTERNAL_SET = new Set<string>(Object.values(INTERNAL));
export const isInternal = (category: string) => INTERNAL_SET.has(category);

const ESSENTIAL = /moradia|aluguel|contas|mercado|sa[uú]de|transporte|educa|imposto|seguro|tarifa|juros/i;
const FEES = /tarifa|juros|multa|\biof\b|anuidade|encargo/i;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Chave do estabelecimento: junta "LOJA X PARC 03/10" e "LOJA X PARC 04/10", "UBER *TRIP 1234" e "UBER *TRIP 9876". */
export function merchantKey(t: Pick<Tx, 'merchant' | 'description'>): string {
  return fold(t.merchant || t.description)
    .replace(/parc(ela)?\.?\s*\d+\s*(\/|de)\s*\d+/g, ' ')
    .replace(/\d+\s*\/\s*\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 3)
    .join(' ');
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
function cleanName(description: string) {
  return titleCase(description.replace(/\s*parc(ela)?\.?\s*\d+\s*(\/|de)\s*\d+/i, '').replace(/\s+\d+\/\d+$/, '').trim());
}

export type Spend = {
  tx: Tx;
  /** Gasto positivo; estorno no cartão negativo. */
  value: number;
  key: string;
  month: string;
  /** Conta fixa, assinatura ou parcela: já estava comprometido antes do mês começar. */
  fixed: boolean;
};

export type Recurring = {
  key: string;
  name: string;
  category: string;
  /** Valor da cobrança mais recente. */
  amount: number;
  day: number;
  months: number;
  lastDate: string;
  paidThisMonth: boolean;
  subscription: boolean;
  annual: number;
  /** Aumento de preço detectado. */
  creep: { from: number; to: number } | null;
};

export type Plan = {
  key: string;
  name: string;
  category: string;
  amount: number;
  paid: number;
  total: number;
  remaining: number;
  remainingTotal: number;
  endMonth: string;
  paidThisMonth: boolean;
};

export type MonthStats = { month: string; income: number; spend: number; fixed: number; flex: number; invested: number; fees: number; byCategory: Record<string, number> };

export type CategoryRow = {
  category: string;
  kind: Kind;
  /** Gasto no mês atual até hoje. */
  mtd: number;
  /** Média dos 3 meses fechados anteriores. */
  avg3: number;
  /** Quanto você costuma ter gasto até este dia do mês. */
  usualByNow: number;
  /** Projeção de fechamento: gasto até hoje + o que costuma vir no resto do mês. */
  projected: number;
  budget: number | null;
};

export type Insight = { id: string; tone: 'good' | 'warn' | 'info'; title: string; text: string };

export type Analysis = ReturnType<typeof analyze>;

export function analyze(data: Data) {
  const today = data.today;
  const month = monthOf(today);
  const day = dayOf(today);
  const dim = daysInMonth(month);
  const cards = new Set(data.accounts.filter((a) => a.type === 'CREDIT').map((a) => a.id));
  const live = data.transactions.filter((t) => !t.ignored);

  // ---------- gastos, receitas, aportes ----------
  const spends: Spend[] = [];
  const incomes: Tx[] = [];
  const investMoves: Tx[] = [];
  for (const t of live) {
    if (t.category === INTERNAL.INVEST && !cards.has(t.accountId)) investMoves.push(t);
    if (isInternal(t.category)) continue;
    if (t.amount > 0 && !cards.has(t.accountId)) incomes.push(t);
    else spends.push({ tx: t, value: -t.amount, key: merchantKey(t), month: monthOf(t.date), fixed: false });
  }

  // ---------- recorrentes (contas fixas e assinaturas) ----------
  const windowStart = shiftMonth(month, -5);
  const byKey = new Map<string, Spend[]>();
  for (const s of spends) {
    if (s.tx.instTotal || s.value <= 0 || s.month < windowStart || !s.key) continue;
    const list = byKey.get(s.key);
    if (list) list.push(s);
    else byKey.set(s.key, [s]);
  }

  const recurring: Recurring[] = [];
  for (const [key, list] of byKey) {
    const perMonth = new Map<string, Spend[]>();
    for (const s of list) perMonth.set(s.month, [...(perMonth.get(s.month) ?? []), s]);
    if (perMonth.size < 3) continue;
    const singles = [...perMonth.values()].filter((m) => m.length === 1).map((m) => m[0]);
    // Recorrente = uma cobrança por mês, em dia parecido, com valor parecido, e ainda ativa.
    if (singles.length < 3 || singles.length / perMonth.size < 0.75) continue;
    const days = singles.map((s) => dayOf(s.tx.date));
    if (Math.max(...days) - Math.min(...days) > 8) continue;
    const values = singles.map((s) => s.value);
    const mid = median(values);
    if ((Math.max(...values) - Math.min(...values)) / mid > 0.5) continue;
    const ordered = [...singles].sort((a, b) => (a.tx.date < b.tx.date ? 1 : -1));
    const last = ordered[0];
    if (last.month < shiftMonth(month, -1)) continue;

    const earlier = ordered.slice(1).map((s) => s.value);
    const before = median(earlier);
    const stableBefore = earlier.length >= 2 && (Math.max(...earlier) - Math.min(...earlier)) / before < 0.1;
    // Mesmo critério do Rocket Money: sobe mais de 5% e mais de R$ 2.
    const creep = stableBefore && last.value > before * 1.05 && last.value - before > 2 ? { from: before, to: last.value } : null;
    const fixedPrice = (Math.max(...values) - Math.min(...values)) / mid < 0.15 || !!creep;

    recurring.push({
      key,
      name: cleanName(last.tx.merchant || last.tx.description),
      category: last.tx.category,
      amount: last.value,
      day: Math.round(median(days)),
      months: perMonth.size,
      lastDate: last.tx.date,
      paidThisMonth: last.month === month,
      subscription: fixedPrice && cards.has(last.tx.accountId),
      annual: last.value * 12,
      creep,
    });
  }
  recurring.sort((a, b) => b.amount - a.amount);
  const recurringKeys = new Set(recurring.map((r) => r.key));

  // ---------- compras parceladas ----------
  const planGroups = new Map<string, Spend[]>();
  for (const s of spends) {
    if (!s.tx.instTotal || !s.tx.instN) continue;
    const key = `${s.key}|${s.tx.instTotal}|${Math.round(s.value)}`;
    planGroups.set(key, [...(planGroups.get(key) ?? []), s]);
  }
  const plans: Plan[] = [];
  for (const [key, list] of planGroups) {
    const last = list.reduce((a, b) => (a.tx.date > b.tx.date ? a : b));
    const paid = last.tx.instN!;
    const total = last.tx.instTotal!;
    const remaining = total - paid;
    // Ativa = ainda falta parcela e a última apareceu neste mês ou no anterior.
    if (remaining <= 0 || last.month < shiftMonth(month, -1)) continue;
    plans.push({
      key,
      name: cleanName(last.tx.description),
      category: last.tx.category,
      amount: last.value,
      paid,
      total,
      remaining,
      remainingTotal: remaining * last.value,
      endMonth: shiftMonth(last.month, remaining),
      paidThisMonth: last.month === month,
    });
  }
  plans.sort((a, b) => b.remainingTotal - a.remainingTotal);

  for (const s of spends) s.fixed = !!s.tx.instTotal || recurringKeys.has(s.key);

  // ---------- resumo por mês ----------
  const monthKeys = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
  const stats = new Map<string, MonthStats>(monthKeys.map((m) => [m, { month: m, income: 0, spend: 0, fixed: 0, flex: 0, invested: 0, fees: 0, byCategory: {} }]));
  for (const s of spends) {
    const st = stats.get(s.month);
    if (!st) continue;
    st.spend += s.value;
    if (s.fixed) st.fixed += s.value;
    else st.flex += s.value;
    st.byCategory[s.tx.category] = (st.byCategory[s.tx.category] ?? 0) + s.value;
    if (FEES.test(s.tx.category) || FEES.test(s.tx.description)) st.fees += s.value;
  }
  for (const t of incomes) {
    const st = stats.get(monthOf(t.date));
    if (st) st.income += t.amount;
  }
  // Aporte = saída da conta para investimento; resgate entra negativo.
  for (const t of investMoves) {
    const st = stats.get(monthOf(t.date));
    if (st) st.invested += -t.amount;
  }
  const months = monthKeys.map((m) => stats.get(m)!);
  const current = stats.get(month)!;
  // Meses fechados com movimento, do mais recente para o mais antigo.
  const closed = months.slice(0, -1).filter((m) => m.spend > 0 || m.income > 0).reverse();
  const last3 = closed.slice(0, 3);

  // ---------- ritmo do mês ----------
  // Acumulado do gasto livre (sem contas fixas e parcelas, que só fariam degraus no gráfico).
  const cumulative = (m: string, onlyFlex = true) => {
    const perDay = Array<number>(32).fill(0);
    for (const s of spends) if (s.month === m && (!onlyFlex || !s.fixed)) perDay[dayOf(s.tx.date)] += s.value;
    for (let d = 1; d <= 31; d++) perDay[d] += perDay[d - 1];
    return perDay;
  };
  const curCum = cumulative(month);
  const prevCums = last3.map((m) => ({ cum: cumulative(m.month), total: m.flex }));
  const flexSpent = current.flex;
  const usualFlexByNow = avg(prevCums.map((p) => p.cum[Math.min(day, 31)]));
  const usualFlexRest = avg(prevCums.map((p) => p.total - p.cum[Math.min(day, 31)]));
  // Projeção pelo seu padrão dos últimos meses, não por regra de três (que erra feio no começo do mês).
  const projectedFlex = flexSpent + usualFlexRest;
  const avgFlex3 = avg(last3.map((m) => m.flex));
  const lastMonthCum = prevCums[0]?.cum ?? null;

  // ---------- livre para gastar ----------
  const typicalIncome = median(last3.map((m) => m.income));
  const expectedIncome = data.settings.monthlyIncome ?? Math.max(typicalIncome, current.income);
  const saveTarget = (expectedIncome * data.settings.savingsTargetPct) / 100;
  const fixedPaid = current.fixed;
  const fixedPending = sum(recurring.filter((r) => !r.paidThisMonth).map((r) => r.amount)) + sum(plans.filter((p) => !p.paidThisMonth).map((p) => p.amount));
  const fixedExpected = fixedPaid + fixedPending;
  // Pague-se primeiro: a meta de investimento sai antes de sobrar dinheiro para gastar.
  const flexBudget = expectedIncome - saveTarget - fixedExpected;
  const left = flexBudget - flexSpent;
  const daysLeft = dim - day + 1;
  const free = {
    expectedIncome,
    saveTarget,
    fixedExpected,
    fixedPending,
    flexBudget,
    flexSpent,
    left,
    daysLeft,
    perDay: Math.max(0, left) / daysLeft,
    avgFlex3,
    projectedFlex,
    usualFlexByNow,
  };

  const pace = Array.from({ length: dim }, (_, i) => {
    const d = i + 1;
    return {
      day: d,
      atual: d <= day ? curCum[d] : null,
      anterior: lastMonthCum ? lastMonthCum[d] : null,
      limite: flexBudget > 0 ? (flexBudget * d) / dim : null,
    };
  });

  // ---------- categorias ----------
  const kindOf = (category: string): Kind => data.categoryKinds[category] ?? (ESSENTIAL.test(category) ? 'essencial' : 'estilo');
  const catCum = (m: string, category: string, upTo: number) => sum(spends.filter((s) => s.month === m && s.tx.category === category && dayOf(s.tx.date) <= upTo).map((s) => s.value));
  const allCategories = new Set<string>([...Object.keys(current.byCategory), ...last3.flatMap((m) => Object.keys(m.byCategory)), ...Object.keys(data.budgets)]);
  const categories: CategoryRow[] = [...allCategories]
    .map((category) => {
      const mtd = current.byCategory[category] ?? 0;
      const avg3 = avg(last3.map((m) => m.byCategory[category] ?? 0));
      const usualByNow = avg(last3.map((m) => catCum(m.month, category, day)));
      return { category, kind: kindOf(category), mtd, avg3, usualByNow, projected: mtd + Math.max(0, avg3 - usualByNow), budget: data.budgets[category] ?? null };
    })
    .filter((c) => c.mtd > 0 || c.avg3 > 0 || c.budget != null)
    .sort((a, b) => Math.max(b.mtd, b.avg3) - Math.max(a.mtd, a.avg3));

  const essentialMonthly = avg(last3.map((m) => sum(Object.entries(m.byCategory).filter(([c]) => kindOf(c) === 'essencial').map(([, v]) => v))));
  const avgSpend = avg(closed.slice(0, 6).map((m) => m.spend));
  const avgInvested = avg(closed.slice(0, 6).map((m) => m.invested));

  // ---------- patrimônio ----------
  const cash = sum(data.accounts.filter((a) => a.type === 'BANK').map((a) => a.balance));
  const checking = sum(data.accounts.filter((a) => a.type === 'BANK' && a.subtype !== 'SAVINGS_ACCOUNT').map((a) => a.balance));
  const cardDebt = sum(data.accounts.filter((a) => a.type === 'CREDIT').map((a) => a.balance));
  const invested = sum(data.investments.map((v) => v.balance));
  const netWorth = cash + invested - cardDebt;
  // Reserva = dinheiro em conta + renda fixa. Conservador: fundos e bolsa ficam de fora.
  const reserve = cash + sum(data.investments.filter((v) => v.type === 'FIXED_INCOME').map((v) => v.balance));
  const emergency = { reserve, essentialMonthly, months: essentialMonthly > 0 ? reserve / essentialMonthly : 0, targetMonths: data.settings.emergencyMonths };
  // "Saldo real": o que sobra na conta corrente depois do que já está comprometido neste mês.
  const trueBalance = checking - fixedPending - cardDebt;
  // Quanto dá para investir agora sem apertar: saldo real menos uma semana de gasto livre de folga.
  const buffer = (avgFlex3 / 30) * 7;
  const investNow = Math.max(0, Math.floor((trueBalance - buffer) / 50) * 50);
  const investGap = Math.max(0, saveTarget - current.invested);
  // Independência financeira: 25x o gasto anual (regra dos 4%).
  const fiNumber = avgSpend * 12 * 25;

  // ---------- sinais do mês ----------
  const projectedSpend = fixedExpected + projectedFlex;
  const health = [
    { ok: projectedSpend <= expectedIncome, label: 'Gastar menos do que ganha', detail: `Projeção: ${brl(projectedSpend, { cents: false })} de ${brl(expectedIncome, { cents: false })}` },
    { ok: current.invested > 0, label: 'Investir neste mês', detail: current.invested > 0 ? `${brl(current.invested, { cents: false })} aportados` : `Meta: ${brl(saveTarget, { cents: false })}` },
    { ok: current.fees < 0.01, label: 'Zero juros e tarifas', detail: current.fees > 0 ? `${brl(current.fees)} até agora` : 'Nenhum até agora' },
  ];

  // ---------- avisos ----------
  const insights: Insight[] = [];
  const push = (id: string, tone: Insight['tone'], title: string, text: string) => {
    const full = `${month}:${id}`;
    if (!data.dismissed.includes(full)) insights.push({ id: full, tone, title, text });
  };

  if (current.invested <= 0 && saveTarget > 0 && day >= 6) {
    const perDayInvest = saveTarget / 30;
    push('aporte', 'warn', 'Aporte do mês ainda não saiu', `Sua meta é ${brl(saveTarget, { cents: false })} (${brl(perDayInvest, { cents: false })} por dia).${investNow >= 50 ? ` Pelo saldo de hoje, dá para mandar ${brl(Math.min(investNow, saveTarget), { cents: false })} agora.` : ''}`);
  } else if (current.invested >= saveTarget && saveTarget > 0) {
    push('aporte-ok', 'good', 'Meta de investimento batida', `${brl(current.invested, { cents: false })} aportados neste mês, ${pct((current.invested / expectedIncome) * 100)} da renda.`);
  }

  for (const c of categories) {
    if (c.kind !== 'estilo' && c.usualByNow === 0) continue;
    const diff = c.mtd - c.usualByNow;
    if (diff > 80 && c.mtd > c.usualByNow * 1.3) {
      push(`cat-up:${c.category}`, 'warn', `${c.category} acima do seu normal`, `${brl(c.mtd, { cents: false })} até hoje. Nesta altura do mês você costuma estar em ${brl(c.usualByNow, { cents: false })}.`);
    } else if (diff < -80 && c.mtd < c.usualByNow * 0.7 && c.kind === 'estilo') {
      push(`cat-down:${c.category}`, 'good', `${c.category} abaixo do seu normal`, `${brl(-diff, { cents: false })} a menos que o habitual para esta altura do mês.`);
    }
  }

  for (const r of recurring) {
    if (r.creep) push(`creep:${r.key}`, 'warn', `${r.name} ficou mais caro`, `De ${brl(r.creep.from)} para ${brl(r.creep.to)} por mês: ${brl((r.creep.to - r.creep.from) * 12)} a mais por ano.`);
  }

  // Estabelecimento visitado muitas vezes no mês: o valor anual costuma surpreender.
  const visits = new Map<string, { n: number; total: number; name: string }>();
  for (const s of spends) {
    if (s.month !== month || s.fixed || s.value <= 0) continue;
    const v = visits.get(s.key) ?? { n: 0, total: 0, name: cleanName(s.tx.merchant || s.tx.description) };
    v.n++;
    v.total += s.value;
    visits.set(s.key, v);
  }
  const frequent = [...visits.entries()].filter(([, v]) => v.n >= 6 && v.total >= 150).sort((a, b) => b[1].total - a[1].total)[0];
  if (frequent) {
    const [key, v] = frequent;
    const yearly = (v.total / day) * 365;
    push(`freq:${key}`, 'info', `${v.name}: ${v.n} vezes neste mês`, `${brl(v.total, { cents: false })} até hoje. Nesse ritmo são ${brl(yearly, { cents: false })} por ano, ou ${pct((yearly / 12 / Math.max(1, saveTarget)) * 100)} da sua meta mensal de investimento.`);
  }

  const small = spends.filter((s) => s.month === month && !s.fixed && s.value > 0 && s.value < 25);
  if (small.length >= 8 && sum(small.map((s) => s.value)) > 120) {
    push('small', 'info', `${small.length} compras pequenas`, `Abaixo de R$ 25 cada, somaram ${brl(sum(small.map((s) => s.value)), { cents: false })} neste mês.`);
  }

  const fees12 = sum(months.map((m) => m.fees));
  if (current.fees > 0 || fees12 > 100) {
    push('fees', current.fees > 0 ? 'warn' : 'info', 'Juros e tarifas', `${brl(current.fees)} neste mês, ${brl(fees12)} em 12 meses. É dinheiro que dá para zerar: pacote de serviços gratuito, fatura paga em dia.`);
  }

  // Parcela acabando = aumento de aporte sem sentir no bolso (Save More Tomorrow).
  for (const p of plans) {
    if (p.remaining <= 2) push(`plan-end:${p.key}`, 'good', `${p.name} termina em ${monthLabel(p.endMonth)}`, `Libera ${brl(p.amount)} por mês. Redirecione para investimento antes de se acostumar com a folga.`);
  }

  if (checking > avgSpend * 1.5 && avgSpend > 0) {
    const idle = checking - avgSpend;
    push('idle', 'info', 'Dinheiro parado na conta corrente', `${brl(idle, { cents: false })} acima de um mês de gastos está rendendo zero.`);
  }

  if (trueBalance < 0) {
    push('true-balance', 'warn', 'Saldo não cobre o que falta pagar', `Conta corrente ${brl(checking, { cents: false })}; fatura aberta e contas fixas a vencer somam ${brl(cardDebt + fixedPending, { cents: false })}.`);
  }

  const toneOrder = { warn: 0, good: 1, info: 2 };
  insights.sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone]);

  return {
    today,
    month,
    day,
    daysInMonth: dim,
    spends,
    incomes,
    months,
    current,
    closed,
    recurring,
    plans,
    free,
    pace,
    categories,
    kindOf,
    insights,
    health,
    wealth: { cash, checking, cardDebt, invested, netWorth, trueBalance, fiNumber, passiveMonthly: (invested * 0.04) / 12 },
    emergency,
    invest: { thisMonth: current.invested, target: saveTarget, gap: investGap, now: Math.min(investNow, investGap || investNow), avgInvested, avgSpend, savingsRate: expectedIncome > 0 ? (expectedIncome - projectedSpend) / expectedIncome : 0 },
    /** Compromissos de parcelas por mês futuro. */
    planSchedule: Array.from({ length: 12 }, (_, i) => {
      const m = shiftMonth(month, i + 1);
      return { month: m, total: sum(plans.filter((p) => p.endMonth >= m).map((p) => p.amount)) };
    }).filter((x) => x.total > 0),
  };
}

// ---------- mascote ----------

export type Mood = 'feliz' | 'neutro' | 'preocupado' | 'bravo';

/** Valor em reais inteiros, como os personagens falam. */
const money = (v: number) => brl(v, { cents: false });

/** Humor, fala e selo do mascote na tela inicial, pelo ritmo do gasto livre contra o plano do mês. */
export function mascotMood(a: Analysis): { mood: Mood; line: string; chip: string } {
  const { free, invest, day, daysInMonth: dim } = a;
  if (free.expectedIncome <= 0) return { mood: 'neutro', line: 'Ainda não conheço sua renda. Me dá uns dias de extrato.', chip: 'Sem plano ainda' };
  if (free.left < 0) return { mood: 'bravo', line: `Estourou ${money(-free.left)} do plano. Até o dia ${dim} é modo economia.`, chip: 'Estourou' };
  // Quanto o gasto livre está à frente do plano espalhado igual pelos dias do mês.
  const ahead = free.flexSpent - (free.flexBudget * day) / dim;
  if (ahead > free.flexBudget * 0.1) return { mood: 'preocupado', line: `${money(ahead)} à frente do ritmo. O delivery pode esperar.`, chip: 'Acima do ritmo' };
  if (invest.gap > 0 && day >= 6) return { mood: 'neutro', line: `Gasto no ritmo. Falta o aporte: ${money(invest.gap)} esperando.`, chip: 'No ritmo' };
  const line = day < 6 ? `Mês novo, ${money(free.left)} livres. Vai com calma que dura.` : 'No ritmo e com aporte feito. Assim eu fico sem assunto.';
  return { mood: 'feliz', line, chip: 'No ritmo' };
}

/** Humor e fala do Alucard (cartão): juros, uso do limite e parcelas ainda por vir. */
export function cardMood(a: Analysis, accounts: Account[]): { mood: Mood; line: string } {
  const cards = accounts.filter((acc) => acc.type === 'CREDIT');
  if (!cards.length) return { mood: 'neutro', line: 'Nenhum cartão conectado. Estou de folga no caixão.' };
  const limit = cards.reduce((total, acc) => total + (acc.creditLimit ?? 0), 0);
  const usage = limit > 0 ? a.wealth.cardDebt / limit : 0;
  const plansLeft = a.plans.reduce((total, p) => total + p.remainingTotal, 0);
  if (a.current.fees > 0) return { mood: 'bravo', line: `${brl(a.current.fees)} em juros e tarifas neste mês. Juro é sangue: não me dê esse gosto.` };
  if (usage >= 0.7) return { mood: 'bravo', line: `Fatura em ${pct(usage * 100)} do limite. Até eu acho exagero.` };
  if (plansLeft > a.free.expectedIncome * 0.5) return { mood: 'preocupado', line: `${money(plansLeft)} em parcelas mordendo os próximos meses.` };
  return { mood: 'feliz', line: `Fatura em ${money(a.wealth.cardDebt)}${limit > 0 ? `, ${pct(usage * 100)} do limite` : ''}. Sob controle.` };
}

/** Humor e fala do Warren Bufê (cofrinho dos investimentos): aporte do mês contra a meta. */
export function investMood(a: Analysis): { mood: Mood; line: string } {
  const { invest, day } = a;
  if (invest.target <= 0) return { mood: 'neutro', line: 'Defina uma meta de investimento em Ajustes. Do resto cuido eu.' };
  if (invest.thisMonth >= invest.target) return { mood: 'feliz', line: `Aporte do mês feito: ${money(invest.thisMonth)}. Os juros compostos agradecem.` };
  if (invest.now >= 50) return { mood: 'neutro', line: `Tem ${money(invest.now)} parado na conta. O lugar dele é aqui.` };
  if (invest.thisMonth <= 0 && day > 20) return { mood: 'bravo', line: `Dia ${day} e nenhum aporte. Cofrinho vazio não rende.` };
  return { mood: 'preocupado', line: `Faltam ${money(invest.gap)} para a meta do mês.` };
}

// ---------- simuladores ----------

/**
 * Juro real (acima da inflação) usado em projeções longas: 4% ao ano.
 * De propósito abaixo do juro real de hoje, que está alto e não dura décadas.
 */
export const LONG_RUN_REAL = 4;

/** Valor futuro com aporte mensal e juros compostos mensais. */
export function futureValue(start: number, monthly: number, annualRatePct: number, years: number): number {
  const r = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
  const n = Math.round(years * 12);
  if (r === 0) return start + monthly * n;
  return start * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r);
}

/** Anos até juntar `target`, ou null se nunca chega. */
export function yearsToTarget(start: number, monthly: number, annualRatePct: number, target: number): number | null {
  if (start >= target) return 0;
  const r = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
  if (r <= 0) return monthly > 0 ? (target - start) / monthly / 12 : null;
  const top = target * r + monthly;
  const bottom = start * r + monthly;
  if (bottom <= 0 || top <= 0) return null;
  return Math.log(top / bottom) / Math.log(1 + r) / 12;
}

/** Imposto de renda regressivo da renda fixa (Lei 11.033/2004), sobre o rendimento. */
export function fixedIncomeTax(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

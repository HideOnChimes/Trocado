// Motor de análise: transforma transações cruas nos números que o app mostra.
// Funções puras, sem React. Tudo recalcula quando os dados mudam.
import { brl, dayIn, dayOf, daysBetween, daysInMonth, fold, monthLabel, monthOf, pct, shiftDay, shiftMonth, shortDate } from './format.ts';
import type { Account, Data, Investment, Kind, Market, Tx } from './types.ts';

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
  /** Mês e dia dentro do mês do app (que pode começar em outro dia que não o 1). */
  month: string;
  day: number;
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
  /** Cobrada no cartão: entra na fatura, não sai direto da conta. */
  onCard: boolean;
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
  /** Limite digitado pela pessoa. */
  budget: number | null;
  /** O que passa do mês anterior para este: positivo se sobrou, negativo se estourou. */
  carry: number;
  /** Limite que vale neste mês: `budget + carry`. */
  limit: number | null;
};

export type Insight = { id: string; tone: 'good' | 'warn' | 'info'; title: string; text: string };

/** Saída prevista da conta corrente: conta fixa ou fatura do cartão. */
export type Outflow = { date: string; name: string; amount: number };

/** Estimativa do saldo da conta corrente, dia a dia, de hoje até a véspera do próximo salário. */
export type Forecast = {
  payday: string;
  /** O salário deste mês já devia ter entrado e não apareceu: a previsão vai até o seguinte. */
  late: boolean;
  days: { date: string; balance: number }[];
  /** Ponto mais baixo do caminho. */
  min: { date: string; balance: number };
  outflows: Outflow[];
  /** Gasto do dia a dia que costuma sair da conta (não do cartão), por dia. */
  dailySpend: number;
};

export type Analysis = ReturnType<typeof analyze>;

type Salary = { day: number; amount: number };

/** Entrada a partir desta fração do salário típico conta como o salário do mês. */
const PAYCHECK_SHARE = 0.6;
/** Salários que caem a até tantos dias um do outro são o mesmo dia de pagamento. */
const PAYDAY_SPREAD = 10;
/** Até este dia do mês, um salário pode ser o do fim do mês anterior que escorregou na virada. */
const TURN_OF_MONTH = 5;
/** Por quantos dias depois do salário o aviso "invista primeiro" fica no topo. */
const PAY_FIRST_DAYS = 5;
/** Quantos dias para trás entram na média do gasto diário da previsão. */
const FORECAST_WINDOW = 90;

/** Salário típico: a maior entrada de cada mês; dia e valor pela mediana. Null se não há padrão em pelo menos 2 meses. */
function typicalSalary(paychecks: Tx[]): Salary | null {
  if (paychecks.length < 2) return null;
  const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
  let days = paychecks.map((t) => dayOf(t.date)).sort((x, y) => x - y);
  // Quem recebe na virada do mês cai ora no dia 30, ora no dia 1: os primeiros dias contam como continuação do mês anterior.
  if (spread(days) > PAYDAY_SPREAD) days = days.map((d) => (d <= TURN_OF_MONTH ? d + 31 : d)).sort((x, y) => x - y);
  // Um mês fora do padrão (férias, 13º adiantado) não derruba os outros dois: ficam os dois dias mais próximos.
  if (days.length === 3 && spread(days) > PAYDAY_SPREAD) days = days[1] - days[0] <= days[2] - days[1] ? days.slice(0, 2) : days.slice(1);
  if (spread(days) > PAYDAY_SPREAD) return null;
  const day = Math.round(median(days));
  return { day: day > 31 ? day - 31 : day, amount: median(paychecks.map((t) => t.amount)) };
}

/** Data do próximo salário. `paychecks` são as entradas do tamanho do salário. */
function nextPayday(today: string, salary: Salary, paychecks: Tx[]): { date: string; late: boolean } {
  const month = monthOf(today);
  const expected = dayIn(month, salary.day);
  // Recebido = entrou salário de alguns dias antes do dia esperado até hoje (cobre adiantamento e virada de mês).
  const received = paychecks.some((t) => t.date >= shiftDay(expected, -PAYDAY_SPREAD) && t.date <= today);
  if (!received && expected >= today) return { date: expected, late: false };
  return { date: dayIn(shiftMonth(month, 1), salary.day), late: !received };
}

/** Anda o saldo dia a dia, de hoje até a véspera do salário, tirando o gasto diário habitual e as saídas previstas. */
function forecastBalance(today: string, payday: { date: string; late: boolean }, start: number, dailySpend: number, outflows: Outflow[]): Forecast {
  const upcoming = outflows.filter((o) => o.date > today && o.date < payday.date).sort((x, y) => (x.date < y.date ? -1 : 1));
  const days = [{ date: today, balance: start }];
  for (let d = shiftDay(today, 1); d < payday.date; d = shiftDay(d, 1)) {
    const out = dailySpend + sum(upcoming.filter((o) => o.date === d).map((o) => o.amount));
    days.push({ date: d, balance: days[days.length - 1].balance - out });
  }
  const min = days.reduce((low, p) => (p.balance < low.balance ? p : low));
  return { payday: payday.date, late: payday.late, days, min, outflows: upcoming, dailySpend };
}

export function analyze(data: Data) {
  const today = data.today;
  // O mês do app começa no dia escolhido em Ajustes. Deslocar a data para trás faz esse ciclo coincidir com um mês do calendário:
  // daqui em diante `month` e `day` são os do ciclo. Datas mostradas ao usuário e a previsão até o salário continuam reais.
  const startDay = data.settings.monthStartDay;
  const shifted = new Map<string, string>();
  const inCycle = (date: string) => {
    if (startDay === 1) return date;
    // As mesmas datas se repetem em centenas de lançamentos: desloca cada uma só uma vez.
    let moved = shifted.get(date);
    if (!moved) shifted.set(date, (moved = shiftDay(date, 1 - startDay)));
    return moved;
  };
  const month = monthOf(inCycle(today));
  const day = dayOf(inCycle(today));
  const dim = daysInMonth(month);
  const cycle = { start: shiftDay(`${month}-01`, startDay - 1), end: shiftDay(`${shiftMonth(month, 1)}-01`, startDay - 2) };
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
    else spends.push({ tx: t, value: -t.amount, key: merchantKey(t), month: monthOf(inCycle(t.date)), day: dayOf(inCycle(t.date)), fixed: false });
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
      onCard: cards.has(last.tx.accountId),
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
    const st = stats.get(monthOf(inCycle(t.date)));
    if (st) st.income += t.amount;
  }
  // Aporte = saída da conta para investimento; resgate entra negativo.
  for (const t of investMoves) {
    const st = stats.get(monthOf(inCycle(t.date)));
    if (st) st.invested += -t.amount;
  }
  const months = monthKeys.map((m) => stats.get(m)!);
  const current = stats.get(month)!;
  // Meses fechados com movimento, do mais recente para o mais antigo.
  const closed = months.slice(0, -1).filter((m) => m.spend > 0 || m.income > 0).reverse();
  const last3 = closed.slice(0, 3);
  // O mês do calendário logo antes deste, tenha ou não movimento (`closed[0]` pula meses vazios).
  const previous = months[months.length - 2];
  const previousActive = previous.spend > 0 || previous.income > 0;

  // ---------- ritmo do mês ----------
  // Acumulado do gasto livre (sem contas fixas e parcelas, que só fariam degraus no gráfico).
  const cumulative = (m: string, onlyFlex = true) => {
    const perDay = Array<number>(32).fill(0);
    for (const s of spends) if (s.month === m && (!onlyFlex || !s.fixed)) perDay[s.day] += s.value;
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
  const catCum = (m: string, category: string, upTo: number) => sum(spends.filter((s) => s.month === m && s.tx.category === category && s.day <= upTo).map((s) => s.value));
  const allCategories = new Set<string>([...Object.keys(current.byCategory), ...last3.flatMap((m) => Object.keys(m.byCategory)), ...Object.keys(data.budgets)]);
  const categories: CategoryRow[] = [...allCategories]
    .map((category) => {
      const mtd = current.byCategory[category] ?? 0;
      const avg3 = avg(last3.map((m) => m.byCategory[category] ?? 0));
      const usualByNow = avg(last3.map((m) => catCum(m.month, category, day)));
      const budget = data.budgets[category] ?? null;
      // Sobra ou estouro do mês passado passa para este, se o limite já existia lá. No máximo um limite inteiro, para os dois lados.
      const existed = (data.budgetSince[category] ?? month) < month;
      const carry = budget != null && existed && previousActive ? Math.max(-budget, Math.min(budget, budget - (previous.byCategory[category] ?? 0))) : 0;
      return { category, kind: kindOf(category), mtd, avg3, usualByNow, projected: mtd + Math.max(0, avg3 - usualByNow), budget, carry, limit: budget == null ? null : budget + carry };
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

  // ---------- salário e pague-se primeiro ----------
  const paychecks = last3.map((m) => incomes.filter((t) => monthOf(inCycle(t.date)) === m.month).sort((x, y) => y.amount - x.amount)[0]).filter((t) => t !== undefined);
  const salary = typicalSalary(paychecks);
  const salaryEntries = salary ? incomes.filter((t) => t.amount >= salary.amount * PAYCHECK_SHARE) : [];
  // Nos dias seguintes ao salário, o que falta da meta do mês vira o primeiro aviso.
  const justPaid = salaryEntries.some((t) => t.date <= today && t.date >= shiftDay(today, -PAY_FIRST_DAYS));
  const payFirst = justPaid && investGap > 0 ? investGap : null;

  // ---------- comprometido nos próximos meses ----------
  const fixedMonthly = sum(recurring.map((r) => r.amount));
  const commitments = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(month, i + 1);
    const installments = sum(plans.filter((p) => p.endMonth >= m).map((p) => p.amount));
    const total = fixedMonthly + installments;
    return { month: m, fixed: fixedMonthly, installments, total, share: expectedIncome > 0 ? total / expectedIncome : 0 };
  });

  // ---------- saldo até o próximo salário ----------
  // Vencendo hoje ou atrasada, e ainda em aberto: conta como se saísse amanhã (o saldo de hoje já é o do banco).
  const tomorrow = shiftDay(today, 1);
  const soon = (due: string) => (due > today ? due : tomorrow);
  const calendarMonth = monthOf(today);
  const outflows: Outflow[] = [];
  for (const r of recurring) {
    if (r.onCard) continue; // as do cartão já estão dentro da fatura
    // Em aberto neste mês do calendário se a última cobrança caiu antes dele (o mês do app pode começar em outro dia).
    if (monthOf(r.lastDate) < calendarMonth) outflows.push({ date: soon(dayIn(calendarMonth, r.day)), name: r.name, amount: r.amount });
    outflows.push({ date: dayIn(shiftMonth(calendarMonth, 1), r.day), name: r.name, amount: r.amount });
  }
  for (const acc of data.accounts) {
    // Vencimento que já passou fica de fora: a fatura foi paga ou o banco ainda não informou a próxima data.
    if (acc.type === 'CREDIT' && acc.dueDate && acc.dueDate >= today && acc.balance > 0) outflows.push({ date: soon(acc.dueDate), name: `Fatura ${acc.name}`, amount: acc.balance });
  }
  // Gasto do dia a dia que sai da conta (o do cartão só pesa no vencimento da fatura), pela média dos últimos dias.
  // Em datas reais, para a previsão não mudar com o dia em que o mês do app começa.
  const windowFrom = shiftDay(today, -FORECAST_WINDOW);
  const recentFlex = spends.filter((s) => !s.fixed && !cards.has(s.tx.accountId) && s.tx.date >= windowFrom && s.tx.date < today);
  // Com menos histórico que a janela, divide pelos dias que o app conhece (do lançamento mais antigo até hoje), não pela janela inteira.
  const oldest = live.reduce((min, t) => (t.date < min ? t.date : min), today);
  const knownDays = Math.min(FORECAST_WINDOW, Math.max(1, daysBetween(oldest, today)));
  const dailySpend = Math.max(0, sum(recentFlex.map((s) => s.value))) / knownDays;
  const forecast = salary ? forecastBalance(today, nextPayday(today, salary, salaryEntries), checking, dailySpend, outflows) : null;

  // ---------- fechamento do mês anterior ----------
  const earlier = months[months.length - 3];
  // Limites e meta são os de hoje: o app não guarda o valor que valia no mês passado.
  const judged = Object.entries(data.budgets).filter(([category]) => (data.budgetSince[category] ?? month) <= previous.month);
  const closingTarget = (previous.income * data.settings.savingsTargetPct) / 100;
  const closing = previousActive
    ? {
        month: previous.month,
        income: previous.income,
        spend: previous.spend,
        invested: previous.invested,
        left: previous.income - previous.spend - previous.invested,
        /** Gasto contra o mês de antes; null se o mês de antes não tem movimento. */
        spendDiff: earlier.spend > 0 || earlier.income > 0 ? previous.spend - earlier.spend : null,
        top: Object.entries(previous.byCategory).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([category, value]) => ({ category, value })),
        fees: previous.fees,
        limits: { kept: judged.filter(([category, budget]) => (previous.byCategory[category] ?? 0) <= budget).length, total: judged.length },
        investTarget: closingTarget,
        investHit: closingTarget > 0 && previous.invested >= closingTarget,
      }
    : null;

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

  if (payFirst) {
    push('pay-first', 'warn', 'Salário caiu: invista primeiro', `Separe ${brl(payFirst, { cents: false })} agora, antes de gastar: é o que falta da meta do mês.${investNow >= 50 ? ` Pelo saldo de hoje, dá para mandar ${brl(Math.min(investNow, payFirst), { cents: false })} já.` : ''}`);
  } else if (current.invested <= 0 && saveTarget > 0 && day >= 6) {
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

  if (forecast && forecast.min.balance < 0) {
    push('short', 'warn', 'Vai faltar antes do salário', `Pela estimativa, a conta corrente chega a ${brl(forecast.min.balance, { cents: false })} em ${shortDate(forecast.min.date)}. O salário está previsto para ${shortDate(forecast.payday)}.`);
  }

  const toneOrder = { warn: 0, good: 1, info: 2 };
  insights.sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone]);

  return {
    today,
    month,
    day,
    daysInMonth: dim,
    /** Primeiro e último dia do mês do app, em datas reais. */
    cycle,
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
    salary,
    payFirst,
    /** Fixos e parcelas já contratados em cada um dos próximos 6 meses. */
    commitments,
    forecast,
    closing,
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
  if (free.left < 0) return { mood: 'bravo', line: `Estourou ${money(-free.left)} do plano. Até o dia ${dayOf(a.cycle.end)} é modo economia.`, chip: 'Estourou' };
  // Quanto o gasto livre está à frente do plano espalhado igual pelos dias do mês.
  const ahead = free.flexSpent - (free.flexBudget * day) / dim;
  if (ahead > free.flexBudget * 0.1) return { mood: 'preocupado', line: `${money(ahead)} à frente do ritmo. O delivery pode esperar.`, chip: 'Acima do ritmo' };
  if (a.payFirst) return { mood: 'neutro', line: `Salário caiu. ${money(a.payFirst)} para o investimento antes de qualquer coisa.`, chip: 'No ritmo' };
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
  if (invest.thisMonth <= 0 && day > 20) return { mood: 'bravo', line: `Dia ${dayOf(a.today)} e nenhum aporte. Cofrinho vazio não rende.` };
  return { mood: 'preocupado', line: `Faltam ${money(invest.gap)} para a meta do mês.` };
}

/** Frase do Tostão sobre o mês que fechou. */
export function closingLine(c: NonNullable<Analysis['closing']>): string {
  const name = monthLabel(c.month, true);
  if (c.left < 0) return `Em ${name} saiu ${money(-c.left)} a mais do que entrou. Mês novo, conta nova.`;
  if (c.invested <= 0) return `Em ${name} sobrou ${money(c.left)} e nada foi investido. Sobra parada não rende.`;
  if (c.investTarget > 0 && !c.investHit) return `Em ${name} você investiu ${money(c.invested)} de ${money(c.investTarget)} da meta e sobrou ${money(c.left)}. Dava para ter mandado mais.`;
  return `Em ${name} você investiu ${money(c.invested)} e ainda sobrou ${money(c.left)}. Assim eu gosto.`;
}

// ---------- carteira ----------

/** Acima disto, um número no campo de taxa não é juro fixo ao ano (é percentual de um índice). */
const MAX_FIXED_RATE = 30;

/** Quanto um investimento rende ao ano hoje, em % bruto, pela taxa contratada. Null quando não há taxa (fundos, ações, ETFs). */
export function annualYield(v: Pick<Investment, 'rate' | 'rateType' | 'annualRate'>, market: Pick<Market, 'cdi' | 'selic' | 'ipca12'>): number | null {
  const index = fold(v.rateType ?? '');
  if (v.rate && index.includes('cdi')) return (v.rate * market.cdi) / 100;
  if (v.rate && index.includes('selic')) return (v.rate * market.selic) / 100;
  // IPCA + taxa: os dois se compõem, não se somam. A taxa pode vir num campo ou no outro.
  // `rate` só serve de taxa fixa se for plausível: 100 ali quer dizer "100% do índice", não 100% ao ano.
  const rateAsFixed = (index.includes('ipca') || index.includes('pre')) && v.rate != null && v.rate <= MAX_FIXED_RATE ? v.rate : null;
  const fixed = v.annualRate ?? rateAsFixed;
  if (fixed != null && index.includes('ipca')) return ((1 + market.ipca12 / 100) * (1 + fixed / 100) - 1) * 100;
  return fixed ?? null;
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

export type Verdict = 'cabe' | 'aperta' | 'nao';

const MAX_INSTALLMENTS = 48;

/**
 * "Posso comprar?": o efeito de uma compra à vista (sai da conta agora) contra a mesma compra parcelada no cartão.
 * Null se o preço é zero ou a renda ainda é desconhecida.
 */
export function simulatePurchase(a: Analysis, price: number, installments: number, monthlyRatePct: number) {
  const { free, invest, forecast, commitments } = a;
  if (price <= 0 || free.expectedIncome <= 0) return null;
  const n = Math.min(MAX_INSTALLMENTS, Math.max(1, Math.round(installments) || 1));
  const rate = Math.max(0, monthlyRatePct) / 100;
  // Tabela Price: parcelas iguais com juros compostos.
  const installment = rate > 0 && n > 1 ? (price * rate) / (1 - Math.pow(1 + rate, -n)) : price / n;
  const total = installment * n;

  // À vista cabe se não passa do que sobra para gastar no mês; aperta se só cabe deixando de investir o que falta da meta.
  const leftAfter = free.left - price;
  const minAfter = forecast ? forecast.min.balance - price : null;
  const overdraws = minAfter != null && minAfter < 0;
  const cashVerdict: Verdict = overdraws ? 'nao' : leftAfter >= 0 ? 'cabe' : leftAfter >= -invest.gap ? 'aperta' : 'nao';

  // Parcelado: o que já está contratado só diminui com o tempo, então o mês mais apertado é o próximo.
  const committed = commitments[0].total + installment;
  const tightest = free.expectedIncome - free.saveTarget - committed;
  const planVerdict: Verdict = tightest >= free.avgFlex3 ? 'cabe' : tightest >= 0 ? 'aperta' : 'nao';

  return {
    installments: n,
    installment,
    total,
    interest: total - price,
    cash: { leftAfter, minAfter, verdict: cashVerdict },
    /** `tightest`: o que sobra para o dia a dia no mês mais apertado; `usual`: o que a pessoa costuma gastar no dia a dia. */
    plan: { tightest, usual: free.avgFlex3, shareAfter: committed / free.expectedIncome, endMonth: shiftMonth(a.month, n), verdict: planVerdict },
    /** Quanto o valor viraria investido por 10 anos, em dinheiro de hoje. */
    tenYears: futureValue(price, 0, LONG_RUN_REAL, 10),
    /** A compra em meses da meta de investimento. */
    goalMonths: free.saveTarget > 0 ? price / free.saveTarget : null,
  };
}

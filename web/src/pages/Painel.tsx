import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { closingLine, mascotMood, type Analysis, type Forecast, type Mood } from '../engine.ts';
import { brl, monthLabel, pct, shortDate } from '../format.ts';
import { Mascote } from '../Mascote.tsx';
import { api, useStore } from '../store.tsx';
import { Card, chart, compact, Empty, money0, Progress, Stat } from '../ui.tsx';

/** Cor da barra de ritmo e do selo, pelo humor do Tostão. */
const MOOD_COLOR: Record<Mood, string> = { feliz: 'var(--green)', neutro: 'var(--green)', preocupado: 'var(--amber)', bravo: 'var(--red)' };

/** Saldo previsto da conta corrente até a véspera do salário: menor ponto, linha do caminho e as próximas contas. */
function UntilPayday({ forecast }: { forecast: Forecast }) {
  const { days, min, outflows, dailySpend } = forecast;
  const short = min.balance < 0;
  // Linha desenhada à mão em SVG: o Recharts só é montado dentro de "Mais números".
  const top = Math.max(...days.map((p) => p.balance), 0);
  const bottom = Math.min(min.balance, 0);
  const y = (v: number) => 4 + (1 - (v - bottom) / (top - bottom || 1)) * 40;
  const x = (i: number) => (i / (days.length - 1)) * 300;
  return (
    <>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <span className={`big ${short ? 'red' : ''}`} style={{ whiteSpace: 'nowrap' }}>{brl(min.balance, { cents: false })}</span>
        <span className="muted small">{days.length > 1 ? `menor saldo no caminho, em ${shortDate(min.date)}` : `saldo de hoje; o salário está previsto para ${forecast.payday === days[0].date ? 'hoje' : 'amanhã'}`}</span>
      </div>
      {forecast.late ? <p className="amber small" style={{ marginTop: 6 }}>O salário deste mês ainda não apareceu. A conta abaixo vai até o próximo.</p> : null}
      {days.length > 1 ? (
        <svg viewBox="0 0 300 48" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 48, margin: '10px 0' }} role="img" aria-label={`Saldo previsto de ${brl(days[0].balance, { cents: false })} hoje a ${brl(days[days.length - 1].balance, { cents: false })} na véspera do salário`}>
          <line x1="0" x2="300" y1={y(0)} y2={y(0)} style={{ stroke: 'var(--border)' }} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <polyline points={days.map((p, i) => `${x(i)},${y(p.balance)}`).join(' ')} fill="none" style={{ stroke: short ? 'var(--red)' : 'var(--blue)' }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
      {outflows.slice(0, 4).map((o, i) => (
        // A mesma conta pode aparecer duas vezes no mesmo dia (a atrasada e a do mês seguinte): o índice desempata.
        <div key={`${o.date}:${o.name}:${i}`} className="row between line">
          <div>
            <div>{o.name}</div>
            <div className="muted small">{shortDate(o.date)}</div>
          </div>
          <span>{brl(-o.amount, { cents: false })}</span>
        </div>
      ))}
      {outflows.length > 4 ? <div className="muted small line">e mais {outflows.length - 4} até o salário</div> : null}
      <p className="muted small" style={{ marginTop: 10 }}>
        Estimativa: saldo da conta corrente, menos as contas fixas que saem da conta, a fatura do cartão no vencimento e {brl(dailySpend, { cents: false })} por dia de gasto habitual. Entradas além do salário não entram na conta.
      </p>
    </>
  );
}

/** Por quantos dias do mês novo o fechamento do anterior fica à vista no Início; depois vai para "Mais números". */
const CLOSING_DAYS = 10;

/** Como fechou o mês anterior: entrou, gastou, investiu, sobrou, e o que pesou. */
function Closing({ closing }: { closing: NonNullable<Analysis['closing']> }) {
  const { spendDiff, limits } = closing;
  const figures = [
    { label: 'Entrou', value: closing.income, hint: null },
    { label: 'Gastou', value: closing.spend, hint: spendDiff != null ? `${brl(Math.abs(spendDiff), { cents: false })} ${spendDiff > 0 ? 'a mais' : 'a menos'} que no mês anterior` : null },
    { label: 'Investiu', value: closing.invested, hint: closing.investTarget > 0 ? (closing.investHit ? 'meta batida' : `a meta era ${brl(closing.investTarget, { cents: false })}`) : null },
    { label: 'Sobrou', value: closing.left, hint: null },
  ];
  return (
    <Card title={`Como fechou ${monthLabel(closing.month)}`}>
      <p style={{ marginBottom: 12 }}>{closingLine(closing)}</p>
      <div className="grid g4">
        {figures.map((f) => (
          <div key={f.label}>
            <div className="label">{f.label}</div>
            <div className={`big ${f.value < 0 ? 'red' : ''}`}>{brl(f.value, { cents: false })}</div>
            {f.hint ? <div className="muted small">{f.hint}</div> : null}
          </div>
        ))}
      </div>
      <div className="divider" />
      {closing.top.map((c) => (
        <div key={c.category} className="row between line">
          <span>{c.category}</span>
          <span>{brl(c.value, { cents: false })}</span>
        </div>
      ))}
      <p className="muted small" style={{ marginTop: 10 }}>
        {limits.total > 0 ? `${limits.kept} de ${limits.total} tetos cumpridos. ` : ''}
        {closing.fees > 0 ? `${brl(closing.fees)} em juros e tarifas.` : 'Nenhum juro ou tarifa.'}
      </p>
    </Card>
  );
}

export function Painel() {
  const { data, a, run } = useStore();
  const { free, wealth, invest } = a;
  const over = free.left < 0;
  // Se passou do plano: quanto dá para gastar por dia e ainda fechar o mês sem gastar mais do que ganha.
  const breakEvenPerDay = Math.max(0, free.expectedIncome - free.fixedExpected - free.flexSpent) / free.daysLeft;
  const lastMonthByNow = a.pace[a.day - 1]?.anterior ?? null;
  const diffLast = lastMonthByNow != null ? free.flexSpent - lastMonthByNow : null;
  const talk = mascotMood(a);
  // Gráficos só são montados quando "Mais números" abre: fechado, o Recharts mediria tamanho zero.
  const [showMore, setShowMore] = useState(false);

  const worth = data.snapshots.map((s) => ({ date: s.date, valor: s.cash + s.invested - s.cardDebt }));
  const bars = a.months.filter((m) => m.income > 0 || m.spend > 0).map((m) => ({ mes: monthLabel(m.month, true), Receitas: Math.round(m.income), Gastos: Math.round(m.spend), Investido: Math.round(Math.max(0, m.invested)) }));
  const account = [
    { label: 'Entra', hint: 'renda do mês', value: free.expectedIncome },
    { label: 'Investir primeiro', hint: `${pct(data.settings.savingsTargetPct)} da renda`, value: -free.saveTarget },
    { label: 'Fixos e parcelas', hint: free.fixedPending > 0 ? `falta pagar ${brl(free.fixedPending, { cents: false })}` : 'tudo pago', value: -free.fixedExpected },
    { label: 'Dia a dia', hint: 'gasto livre até hoje', value: -free.flexSpent },
  ];

  return (
    <div className="stack">
      <section className="card center home">
        <Mascote mood={talk.mood} size={148} />
        <p className="bubble">{talk.line}</p>
        <div className="label">Pode gastar</div>
        <div className="huge">{brl(Math.max(0, free.left))}</div>
        {/* Barra de ritmo: o que já foi do gasto livre; o risco marca onde o plano estaria hoje (0.99: no último dia ele ainda aparece). */}
        <div className="pace">
          <Progress value={free.flexSpent} max={free.flexBudget} mark={Math.min(a.day / a.daysInMonth, 0.99)} color={MOOD_COLOR[talk.mood]} />
        </div>
        <div className="row between small">
          <strong style={{ color: MOOD_COLOR[talk.mood] }}>{talk.chip}</strong>
          <span className="muted">
            {brl(free.flexSpent, { cents: false })} de {brl(free.flexBudget, { cents: false })}
          </span>
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>
          {free.daysLeft} dias · {brl(over ? breakEvenPerDay : free.perDay, { cents: false })} por dia · o risco na barra é hoje
        </div>
        {over ? (
          <p className="small" style={{ marginTop: 10 }}>
            Passou {brl(-free.left, { cents: false })} do plano. Ficando em até {brl(breakEvenPerDay, { cents: false })} por dia, o mês ainda fecha sem gastar mais do que entra.
          </p>
        ) : null}
      </section>

      <Card title="O mês em uma conta">
        {account.map((line) => (
          <div key={line.label} className="row between line">
            <div>
              <div>{line.label}</div>
              <div className="muted small">{line.hint}</div>
            </div>
            <span>{brl(line.value, { cents: false, sign: true })}</span>
          </div>
        ))}
        <div className="row between line total">
          <strong>Sobra para gastar</strong>
          <strong className={over ? 'red' : 'green'}>{brl(free.left, { cents: false })}</strong>
        </div>
      </Card>

      {a.closing && a.day <= CLOSING_DAYS ? <Closing closing={a.closing} /> : null}

      <Card title="Até o próximo salário" right={a.forecast ? <span className="muted small">{shortDate(a.forecast.payday)}</span> : undefined}>
        {a.forecast ? <UntilPayday forecast={a.forecast} /> : <Empty>Ainda não achei o dia do seu salário. Preciso de 2 meses com uma entrada grande na conta, em dia parecido.</Empty>}
      </Card>

      <Card title="Seu mês em 3 sinais">
        <div className="stack" style={{ gap: 12 }}>
          {a.health.map((h) => (
            <div key={h.label} className="row">
              <span className={`check ${h.ok ? 'ok' : 'no'}`} aria-hidden>{h.ok ? '✓' : '·'}</span>
              <div className="grow">
                <div>{h.label}</div>
                <div className="muted small">{h.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Aporte do mês">
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <span className="big">{brl(invest.thisMonth, { cents: false })}</span>
          <span className="muted">de {brl(invest.target, { cents: false })}</span>
        </div>
        <div style={{ margin: '10px 0' }}>
          <Progress value={invest.thisMonth} max={invest.target} color="var(--green)" />
        </div>
        <p className="muted small">Meta: {pct(data.settings.savingsTargetPct)} da renda, separados antes de gastar.</p>
        {invest.gap > 0 && invest.now >= 50 ? (
          <p style={{ marginTop: 10 }}>
            Pelo saldo de hoje dá para mandar <strong className="green">{brl(invest.now, { cents: false })}</strong> agora sem apertar o resto do mês.
          </p>
        ) : invest.gap > 0 ? (
          <p style={{ marginTop: 10 }} className="muted">Faltam {brl(invest.gap, { cents: false })}. Hoje o saldo real não comporta; o próximo salário resolve.</p>
        ) : (
          <p style={{ marginTop: 10 }} className="green">Meta do mês cumprida.</p>
        )}
        <div className="divider" />
        <a href="#investir">Ver carteira e simuladores</a>
      </Card>

      <Card title="O que merece atenção" right={<span className="muted small">{a.insights.length || 'nada'} agora</span>}>
        {a.insights.length === 0 ? <p className="muted">Nada fora do normal neste mês.</p> : null}
        {a.insights.map((i) => (
          <div key={i.id} className="insight">
            <span className={`dot ${i.tone}`} />
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{i.title}</div>
              <div className="muted">{i.text}</div>
            </div>
            <button className="btn sm" onClick={() => run(api.dismiss(i.id))} aria-label={`Dispensar aviso: ${i.title}`}>Ok, vi</button>
          </div>
        ))}
      </Card>

      <details className="more" onToggle={(e) => setShowMore(e.currentTarget.open)}>
        <summary className="btn">Mais números</summary>
        {showMore ? (
          <div className="stack" style={{ marginTop: 12 }}>
      {a.closing && a.day > CLOSING_DAYS ? <Closing closing={a.closing} /> : null}
      <div className="grid g4">
        <Stat
          label="Gasto livre até hoje"
          value={brl(free.flexSpent, { cents: false })}
          hint={diffLast != null ? `${brl(Math.abs(diffLast), { cents: false })} ${diffLast > 0 ? 'a mais' : 'a menos'} que mês passado nesta data` : undefined}
          tone={diffLast != null && diffLast < 0 ? 'green' : undefined}
        />
        <Stat label="Sua média de gasto livre" value={`${brl(free.avgFlex3, { cents: false })}/mês`} hint={`Projeção deste mês: ${brl(free.projectedFlex, { cents: false })}`} />
        <Stat label="Saldo real da conta" value={brl(wealth.trueBalance, { cents: false })} tone={wealth.trueBalance < 0 ? 'amber' : undefined} hint="Conta corrente menos fatura aberta e fixos a vencer" />
        <Stat label="Patrimônio líquido" value={brl(wealth.netWorth, { cents: false })} hint={`Equivale a ${brl(wealth.passiveMonthly, { cents: false })}/mês de renda para sempre`} />
      </div>

      <Card title="Ritmo dos gastos livres" right={<span className="muted small">sem fixos e parcelas</span>}>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={a.pace} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis dataKey="day" stroke={chart.axis} tickLine={false} fontSize={12} interval={3} />
              <YAxis stroke={chart.axis} tickLine={false} axisLine={false} fontSize={12} width={44} tickFormatter={compact} />
              <Tooltip contentStyle={chart.tooltip} formatter={money0} labelFormatter={(d) => `Dia ${d}`} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line name="Plano do mês" dataKey="limite" stroke={chart.muted} strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
              <Line name="Mês passado" dataKey="anterior" stroke={chart.axis} dot={false} strokeWidth={1.5} />
              <Line name="Este mês" dataKey="atual" stroke={chart.blue} dot={false} strokeWidth={3} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Receitas, gastos e investimento">
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={bars} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis dataKey="mes" stroke={chart.axis} tickLine={false} fontSize={12} />
              <YAxis stroke={chart.axis} tickLine={false} axisLine={false} fontSize={12} width={44} tickFormatter={compact} />
              <Tooltip contentStyle={chart.tooltip} formatter={money0} cursor={{ fill: chart.cursor }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="Receitas" fill={chart.green} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Gastos" fill={chart.red} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Investido" fill={chart.blue} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Patrimônio líquido">
        {worth.length < 2 ? (
          <p className="muted">O gráfico aparece depois de alguns dias de uso: o app guarda um retrato do patrimônio a cada atualização.</p>
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={worth} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="worth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.green} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={chart.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chart.grid} vertical={false} />
                <XAxis dataKey="date" stroke={chart.axis} tickLine={false} fontSize={12} tickFormatter={(d: string) => monthLabel(d.slice(0, 7), true)} minTickGap={30} />
                <YAxis stroke={chart.axis} tickLine={false} axisLine={false} fontSize={12} width={44} tickFormatter={compact} domain={['auto', 'auto']} />
                <Tooltip contentStyle={chart.tooltip} formatter={money0} />
                <Area name="Patrimônio" dataKey="valor" stroke={chart.green} strokeWidth={2} fill="url(#worth)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
          </div>
        ) : null}
      </details>
    </div>
  );
}

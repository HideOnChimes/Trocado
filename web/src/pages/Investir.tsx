import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { annualYield, fixedIncomeTax, futureValue, investMood, LONG_RUN_REAL, yearsToTarget } from '../engine.ts';
import { brl, pct, shortDate, toNumber } from '../format.ts';
import { MascoteFala } from '../Mascote.tsx';
import { useStore } from '../store.tsx';
import { Card, chart, compact, Empty, money0, palette, Progress, Stat } from '../ui.tsx';

const TYPE: Record<string, string> = { FIXED_INCOME: 'Renda fixa', MUTUAL_FUND: 'Fundos', EQUITY: 'Ações', ETF: 'ETFs', SECURITY: 'Previdência', COE: 'COE', OTHER: 'Outros' };
const FGC_LIMIT = 250_000;
const yearsText = (y: number | null) => (y == null ? 'não chega nesse ritmo' : y < 1 ? 'menos de 1 ano' : `${y.toFixed(1).replace('.', ',')} anos`);

export function Investir() {
  const { data, a, market } = useStore();
  const { invest, wealth } = a;
  const cdi = market?.cdi ?? 13.65;
  const ipca = market?.ipca12 ?? 4.63;
  const realRate = ((1 + cdi / 100) / (1 + ipca / 100) - 1) * 100;

  const [monthly, setMonthly] = useState(String(Math.round(invest.target)));
  const [years, setYears] = useState('10');
  const [cdiPct, setCdiPct] = useState('100');
  const [cut, setCut] = useState('200');

  const warren = investMood(a);

  // ---------- carteira ----------
  const byType = new Map<string, number>();
  for (const v of data.investments) byType.set(TYPE[v.type] ?? 'Outros', (byType.get(TYPE[v.type] ?? 'Outros') ?? 0) + v.balance);
  const allocation = [...byType.entries()].sort((x, y) => y[1] - x[1]);
  const profit = data.investments.reduce((s, v) => s + (v.profit ?? 0), 0);
  const applied = data.investments.reduce((s, v) => s + (v.invested ?? 0), 0);
  // Quanto cada investimento rende ao ano hoje e quanto disso fica acima da inflação.
  const rates = { cdi, selic: market?.selic ?? cdi, ipca12: ipca };
  const aboveInflation = (yearly: number) => ((1 + yearly / 100) / (1 + ipca / 100) - 1) * 100;

  // FGC cobre até R$ 250 mil por CPF e instituição. Tesouro não entra (garantia é do governo).
  const byIssuer = new Map<string, number>();
  for (const v of data.investments) {
    if (v.type !== 'FIXED_INCOME' || !v.issuer || /tesouro/i.test(`${v.issuer} ${v.name}`)) continue;
    byIssuer.set(v.issuer, (byIssuer.get(v.issuer) ?? 0) + v.balance);
  }
  const overFgc = [...byIssuer.entries()].filter(([, total]) => total > FGC_LIMIT);

  // ---------- simulador de aporte ----------
  const m = toNumber(monthly);
  const y = Math.min(50, Math.max(1, Math.round(toNumber(years))));
  const rate = (cdi * toNumber(cdiPct)) / 100;
  const series = Array.from({ length: y + 1 }, (_, i) => ({ ano: i, Aportado: Math.round(wealth.invested + m * 12 * i), Total: Math.round(futureValue(wealth.invested, m, rate, i)) }));
  const gross = futureValue(wealth.invested, m, rate, y);
  const contributed = wealth.invested + m * 12 * y;
  const tax = Math.max(0, gross - contributed) * fixedIncomeTax(y * 365);
  const net = gross - tax;
  const netToday = net / Math.pow(1 + ipca / 100, y);

  // ---------- independência financeira ----------
  const fiNow = yearsToTarget(wealth.invested, Math.max(0, invest.avgInvested), LONG_RUN_REAL, wealth.fiNumber);
  const fiTarget = yearsToTarget(wealth.invested, invest.target, LONG_RUN_REAL, wealth.fiNumber);

  // ---------- custo de um gasto ----------
  const c = toNumber(cut);

  return (
    <div className="stack">
      <MascoteFala character="warren" mood={warren.mood} line={warren.line} />

      <div className="grid g4">
        <Stat label="Total investido" value={brl(wealth.invested, { cents: false })} hint={profit ? `${brl(profit, { cents: false, sign: true })} de rendimento acumulado` : undefined} />
        <Stat label="Aporte deste mês" value={brl(invest.thisMonth, { cents: false })} tone={invest.thisMonth >= invest.target && invest.target > 0 ? 'green' : undefined} hint={`Meta ${brl(invest.target, { cents: false })} (${pct(data.settings.savingsTargetPct)} da renda)`} />
        <Stat label="Aporte médio" value={`${brl(invest.avgInvested, { cents: false })}/mês`} hint="Últimos 6 meses fechados" />
        <Stat label="Sobra projetada do mês" value={pct(invest.savingsRate * 100)} tone={invest.savingsRate < 0 ? 'amber' : 'green'} hint="Da renda, depois de todos os gastos previstos" />
      </div>

      <Card title="Carteira">
        {data.investments.length === 0 ? <Empty>Nenhum investimento veio dos bancos conectados. Nem toda instituição compartilha a carteira pelo Open Finance.</Empty> : (
          <>
            <div className="seg" role="img" aria-label="Distribuição da carteira">
              {allocation.map(([label, v], i) => <div key={label} style={{ width: `${(v / wealth.invested) * 100}%`, background: palette[i % palette.length] }} />)}
            </div>
            <div className="legend" style={{ margin: '10px 0 6px' }}>
              {allocation.map(([label, v], i) => <span key={label}><i style={{ background: palette[i % palette.length] }} />{label} {pct((v / wealth.invested) * 100)}</span>)}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Investimento</th><th>Tipo</th><th>Taxa</th><th>Vencimento</th><th className="right">Rendimento</th><th className="right">Saldo</th></tr>
                </thead>
                <tbody>
                  {data.investments.map((v) => {
                    const yearly = annualYield(v, rates);
                    return (
                    <tr key={v.id}>
                      <td>{v.name}</td>
                      <td className="muted">{TYPE[v.type] ?? 'Outros'}</td>
                      <td className="muted">
                        {v.rate && v.rateType ? `${v.rate}% ${v.rateType}` : v.annualRate ? `${pct(v.annualRate, 1)} a.a.` : '—'}
                        {yearly != null ? <div className="small">hoje {pct(yearly, 1)} ao ano · {pct(aboveInflation(yearly), 1)} acima da inflação</div> : null}
                      </td>
                      <td className="muted">{shortDate(v.dueDate)}</td>
                      <td className={`right ${v.profit != null && v.profit < 0 ? 'amber' : 'green'}`}>{v.profit != null ? brl(v.profit, { sign: true, cents: false }) : '—'}</td>
                      <td className="right" style={{ fontWeight: 600 }}>{brl(v.balance, { cents: false })}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>
              {applied > 0 ? `Rendimento acumulado: ${brl(profit, { cents: false, sign: true })}, ${pct((profit / applied) * 100, 1)} sobre os ${brl(applied, { cents: false })} aplicados. ` : ''}
              "Hoje ao ano" é bruto, pela taxa contratada e pelas taxas do Banco Central (inflação de {pct(ipca, 1)} em 12 meses). Fundos, ações e ETFs não têm taxa contratada. Imposto e taxas pagos nos investimentos ainda não aparecem: o app não recebe essas movimentações.
            </p>
            {overFgc.map(([issuer, total]) => (
              <p key={issuer} className="amber small" style={{ marginTop: 10 }}>
                {issuer}: {brl(total, { cents: false })} em renda fixa. O FGC cobre até R$ 250 mil por instituição; o que passa disso fica sem garantia.
              </p>
            ))}
          </>
        )}
      </Card>

      <div className="grid hero">
        <Card title="Quanto vira se você aportar todo mês">
          <div className="row wrap" style={{ alignItems: 'flex-end', marginBottom: 12 }}>
            <label className="field">Aporte mensal (R$)<input className="input num" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></label>
            <label className="field">Por quantos anos<input className="input num" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} /></label>
            <label className="field">Rendendo (% do CDI)<input className="input num" inputMode="decimal" value={cdiPct} onChange={(e) => setCdiPct(e.target.value)} /></label>
            <span className="muted small">Parte do que você já tem: {brl(wealth.invested, { cents: false })}</span>
          </div>
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={chart.grid} vertical={false} />
                <XAxis dataKey="ano" stroke={chart.axis} tickLine={false} fontSize={12} tickFormatter={(v) => `${v}a`} />
                <YAxis stroke={chart.axis} tickLine={false} axisLine={false} fontSize={12} width={56} tickFormatter={compact} />
                <Tooltip contentStyle={chart.tooltip} formatter={money0} labelFormatter={(v) => `Ano ${v}`} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Area name="Com juros" dataKey="Total" stroke={chart.green} fill={chart.green} fillOpacity={0.2} strokeWidth={2} />
                <Area name="Só o aportado" dataKey="Aportado" stroke={chart.axis} fill={chart.axis} fillOpacity={0.15} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid g3" style={{ marginTop: 12 }}>
            <div><div className="label">Bruto em {y} anos</div><div className="big">{brl(gross, { cents: false })}</div></div>
            <div><div className="label">Líquido de IR ({pct(fixedIncomeTax(y * 365) * 100, 1)} sobre o ganho)</div><div className="big green">{brl(net, { cents: false })}</div></div>
            <div><div className="label">Em dinheiro de hoje</div><div className="big">{brl(netToday, { cents: false })}</div></div>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            Supõe CDI de {pct(cdi, 2)} a.a. e inflação de {pct(ipca, 2)} constantes, o que não vai acontecer: serve para comparar cenários, não para prever. IR pela tabela regressiva da renda fixa.
          </p>
        </Card>

        <div className="stack">
          <Card title="Independência financeira">
            <div className="row between" style={{ alignItems: 'baseline' }}>
              <span className="big">{pct(wealth.fiNumber > 0 ? (wealth.invested / wealth.fiNumber) * 100 : 0, 1)}</span>
              <span className="muted">de {brl(wealth.fiNumber, { cents: false })}</span>
            </div>
            <div style={{ margin: '10px 0' }}><Progress value={wealth.invested} max={wealth.fiNumber} color="var(--green)" /></div>
            <p className="small">No aporte médio atual: <strong>{yearsText(fiNow)}</strong></p>
            <p className="small">Batendo a meta mensal: <strong className="green">{yearsText(fiTarget)}</strong></p>
            <p className="muted small" style={{ marginTop: 8 }}>
              Alvo = 25 vezes seu gasto anual ({brl(invest.avgSpend, { cents: false })}/mês); prazos supõem {LONG_RUN_REAL}% ao ano acima da inflação. Cada R$ 100 a menos de gasto mensal derruba o alvo em R$ 30 mil e ainda libera R$ 100 para aportar.
            </p>
          </Card>

          <Card title="Quanto custa um gasto mensal">
            <label className="field">Gasto por mês (R$)<input className="input num" inputMode="decimal" value={cut} onChange={(e) => setCut(e.target.value)} /></label>
            <table className="table" style={{ marginTop: 8 }}>
              <tbody>
                {[1, 5, 10, 20].map((n) => (
                  <tr key={n}>
                    <td className="muted">{n === 1 ? '1 ano' : `${n} anos`}</td>
                    <td className="right" style={{ fontWeight: 600 }}>{brl(futureValue(0, c, LONG_RUN_REAL, n), { cents: false })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small" style={{ marginTop: 6 }}>Se fosse investido em vez de gasto, rendendo {LONG_RUN_REAL}% ao ano acima da inflação. Em dinheiro de hoje.</p>
          </Card>
        </div>
      </div>

      <Card title="Taxas de referência" right={<span className="muted small">{market ? (market.live ? 'Banco Central, hoje' : 'Banco Central fora do ar: valores de nov/2026') : 'carregando'}</span>}>
        {market ? (
          <div className="grid g4">
            <div><div className="label">Selic</div><div className="big">{pct(market.selic, 2)}</div><div className="muted small">ao ano</div></div>
            <div><div className="label">CDI</div><div className="big">{pct(market.cdi, 2)}</div><div className="muted small">ao ano · juro real {pct(realRate, 1)}</div></div>
            <div><div className="label">Inflação (IPCA)</div><div className="big">{pct(market.ipca12, 2)}</div><div className="muted small">12 meses · poupança rende {pct((Math.pow(1 + market.poupancaMes / 100, 12) - 1) * 100, 1)} a.a.</div></div>
            <div><div className="label">Rotativo do cartão</div><div className="big amber">{pct(market.rotativoMes, 1)}</div><div className="muted small">ao mês · {pct((Math.pow(1 + market.rotativoMes / 100, 12) - 1) * 100)} ao ano</div></div>
          </div>
        ) : <Empty>Buscando taxas…</Empty>}
        {market ? (
          <p className="muted small" style={{ marginTop: 12 }}>
            R$ 1.000 por 12 meses: na poupança viram {brl(1000 * Math.pow(1 + market.poupancaMes / 100, 12), { cents: false })}; em CDB 100% do CDI, {brl(1000 + 1000 * (market.cdi / 100) * (1 - fixedIncomeTax(365)), { cents: false })} líquidos; devendo no rotativo, a dívida vai a {brl(1000 * Math.pow(1 + market.rotativoMes / 100, 12), { cents: false })}. Quitar cartão vem antes de investir.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

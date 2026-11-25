import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cardMood, futureValue, LONG_RUN_REAL } from '../engine.ts';
import { brl, monthLabel } from '../format.ts';
import { MascoteFala } from '../Mascote.tsx';
import { api, useStore } from '../store.tsx';
import { Card, chart, compact, Empty, money0, Stat } from '../ui.tsx';

export function Recorrentes() {
  const { data, a, run } = useStore();
  const subs = a.recurring.filter((r) => r.subscription);
  const bills = a.recurring.filter((r) => !r.subscription);
  const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0);

  // Revisão trimestral: reconfirmar cada assinatura de tempos em tempos é o que mais gera cancelamento.
  const [y, m] = a.month.split('-').map(Number);
  const quarter = `${y}T${Math.ceil(m / 3)}`;
  const reviewKey = (key: string) => `rev:${quarter}:${key}`;
  const pending = subs.filter((s) => !data.dismissed.includes(reviewKey(s.key)));

  const monthlyFixed = sum(a.recurring.map((r) => r.amount)) + sum(a.plans.map((p) => p.amount));
  const openPlans = sum(a.plans.map((p) => p.remainingTotal));
  const card = cardMood(a, data.accounts);
  const schedule = a.planSchedule.map((s) => ({ mes: monthLabel(s.month, true), Parcelas: Math.round(s.total) }));

  return (
    <div className="stack">
      <MascoteFala character="alucard" mood={card.mood} line={card.line}>
        <div className="muted small">Fatura aberta {brl(a.wealth.cardDebt, { cents: false })} · parcelas a vencer {brl(openPlans, { cents: false })}</div>
      </MascoteFala>

      <div className="grid g4">
        <Stat label="Comprometido por mês" value={brl(monthlyFixed, { cents: false })} hint={a.free.expectedIncome > 0 ? `${Math.round((monthlyFixed / a.free.expectedIncome) * 100)}% da renda, antes de qualquer escolha` : undefined} />
        <Stat label="Assinaturas por ano" value={brl(sum(subs.map((s) => s.annual)), { cents: false })} hint={`${subs.length} ativas`} />
        <Stat label="Ainda a pagar em parcelas" value={brl(openPlans, { cents: false })} hint={`${a.plans.length} compras parceladas`} />
        <Stat label="Falta pagar neste mês" value={brl(a.free.fixedPending, { cents: false })} hint="Fixos e parcelas que ainda não caíram" />
      </div>

      <Card title="Assinaturas" right={<span className={`badge ${pending.length ? 'amber' : 'green'}`}>{pending.length ? `${pending.length} para revisar neste trimestre` : 'revisão do trimestre feita'}</span>}>
        {subs.length === 0 ? <Empty>Nenhuma cobrança fixa mensal no cartão foi detectada ainda. O app precisa de 3 meses de histórico.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Assinatura</th>
                  <th className="right">Por mês</th>
                  <th className="right">Por ano</th>
                  <th className="right">Em 10 anos, se investido</th>
                  <th className="right">Ainda vale a pena?</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const reviewed = data.dismissed.includes(reviewKey(s.key));
                  return (
                    <tr key={s.key}>
                      <td>
                        <div>{s.name}</div>
                        <div className="muted small row wrap" style={{ gap: 6 }}>
                          <span>{s.category} · todo dia {s.day}</span>
                          {s.creep ? <span className="badge amber">subiu de {brl(s.creep.from)} para {brl(s.creep.to)}</span> : null}
                        </div>
                      </td>
                      <td className="right">{brl(s.amount)}</td>
                      <td className="right" style={{ fontWeight: 600 }}>{brl(s.annual, { cents: false })}</td>
                      <td className="right muted">{brl(futureValue(0, s.amount, LONG_RUN_REAL, 10), { cents: false })}</td>
                      <td className="right">
                        {reviewed ? <span className="badge green">mantida</span> : <button className="btn sm" onClick={() => run(api.dismiss(reviewKey(s.key)))}>Sim, manter</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small" style={{ marginTop: 10 }}>
          A coluna de 10 anos supõe rendimento de {LONG_RUN_REAL}% ao ano acima da inflação, em dinheiro de hoje. Cancelar é no site do serviço; aqui você só registra a decisão.
        </p>
      </Card>

      <Card title="Contas fixas">
        {bills.length === 0 ? <Empty>Nenhuma conta mensal detectada ainda.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Conta</th><th>Categoria</th><th className="right">Dia</th><th className="right">Último valor</th><th className="right">Neste mês</th></tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.key}>
                    <td>{b.name}</td>
                    <td className="muted">{b.category}</td>
                    <td className="right muted">{b.day}</td>
                    <td className="right" style={{ fontWeight: 600 }}>{brl(b.amount)}</td>
                    <td className="right"><span className={`badge ${b.paidThisMonth ? 'green' : ''}`}>{b.paidThisMonth ? 'paga' : 'a vencer'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid hero">
        <Card title="Compras parceladas">
          {a.plans.length === 0 ? <Empty>Nenhuma parcela em aberto.</Empty> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Compra</th><th className="right">Parcela</th><th className="right">Valor</th><th className="right">Falta pagar</th><th className="right">Termina</th></tr>
                </thead>
                <tbody>
                  {a.plans.map((p) => (
                    <tr key={p.key}>
                      <td>{p.name}</td>
                      <td className="right muted">{p.paid}/{p.total}</td>
                      <td className="right">{brl(p.amount)}</td>
                      <td className="right" style={{ fontWeight: 600 }}>{brl(p.remainingTotal, { cents: false })}</td>
                      <td className="right" style={{ textTransform: 'capitalize' }}>{monthLabel(p.endMonth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Parcelas já contratadas nos próximos meses">
          {schedule.length === 0 ? <Empty>Nada comprometido.</Empty> : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={schedule} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="mes" stroke={chart.axis} tickLine={false} fontSize={12} />
                  <YAxis stroke={chart.axis} tickLine={false} axisLine={false} fontSize={12} width={44} tickFormatter={compact} />
                  <Tooltip contentStyle={chart.tooltip} formatter={money0} cursor={{ fill: chart.cursor }} />
                  <Bar dataKey="Parcelas" fill={chart.amber} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="muted small" style={{ marginTop: 8 }}>Cada degrau que desce é dinheiro liberando. Bom momento para subir o aporte no mesmo valor.</p>
        </Card>
      </div>
    </div>
  );
}

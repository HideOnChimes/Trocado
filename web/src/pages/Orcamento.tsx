import { brl, pct } from '../format.ts';
import { api, useStore } from '../store.tsx';
import { Card, MoneyInput, Progress } from '../ui.tsx';

export function Orcamento() {
  const { data, a, run } = useStore();
  const income = a.free.expectedIncome;

  // Divisão 50/30/20 pela média dos últimos 3 meses fechados.
  const essential = a.categories.filter((c) => c.kind === 'essencial').reduce((s, c) => s + c.avg3, 0);
  const lifestyle = a.categories.filter((c) => c.kind === 'estilo').reduce((s, c) => s + c.avg3, 0);
  const investedAvg = Math.max(0, a.invest.avgInvested);
  const rest = Math.max(0, income - essential - lifestyle - investedAvg);
  const share = (v: number) => (income > 0 ? (v / income) * 100 : 0);
  const split = [
    { label: 'Essenciais', value: essential, target: 50, color: 'var(--accent)' },
    { label: 'Estilo de vida', value: lifestyle, target: 30, color: 'var(--amber)' },
    { label: 'Investido', value: investedAvg, target: 20, color: 'var(--green)' },
    { label: 'Sobra sem destino', value: rest, target: 0, color: 'var(--muted)' },
  ];

  const budgeted = a.categories.filter((c) => c.budget != null);
  // Tetos funcionam melhor em poucas categorias de estilo de vida, um pouco abaixo da média.
  const candidates = a.categories.filter((c) => c.kind === 'estilo' && c.budget == null && c.avg3 >= 100).slice(0, 3);
  const suggest = async () => {
    for (const c of candidates) await run(api.setBudget(c.category, Math.max(10, Math.floor((c.avg3 * 0.85) / 10) * 10)));
  };

  return (
    <div className="stack">
      <Card title="Para onde vai sua renda" right={<span className="muted small">média dos últimos 3 meses · renda {brl(income, { cents: false })}</span>}>
        <div className="seg" role="img" aria-label="Divisão da renda">
          {split.map((s) => <div key={s.label} style={{ width: `${share(s.value)}%`, background: s.color }} />)}
        </div>
        <div className="grid g4" style={{ marginTop: 14 }}>
          {split.map((s) => (
            <div key={s.label}>
              <div className="legend"><span><i style={{ background: s.color }} />{s.label}</span></div>
              <div className="big">{pct(share(s.value))}</div>
              <div className="muted small">{brl(s.value, { cents: false })}/mês{s.target ? ` · referência ${s.target}%` : ''}</div>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          Referência 50/30/20: metade para o essencial, 30% para estilo de vida, 20% investidos. Não é regra; serve para ver de onde dá para tirar.
        </p>
      </Card>

      <Card
        title="Tetos por categoria"
        right={candidates.length && budgeted.length < 3 ? <button className="btn sm primary" onClick={suggest}>Sugerir {candidates.length} tetos</button> : undefined}
      >
        <p className="muted small" style={{ marginBottom: 10 }}>
          Poucos tetos, só no que é escolha sua, um pouco abaixo da sua média: é o formato que mais reduz gasto. O risco na barra mostra onde você costuma estar nesta altura do mês.
        </p>
        {a.categories.map((c) => {
          const max = c.budget ?? Math.max(c.avg3, c.mtd);
          const overBudget = c.budget != null && c.mtd > c.budget;
          const willOver = c.budget != null && !overBudget && c.projected > c.budget;
          return (
            <div key={c.category} className="item">
              <div className="row between">
                <strong>{c.category}</strong>
                <span>
                  <strong>{brl(c.mtd, { cents: false })}</strong>{' '}
                  <span className="muted small">{c.budget != null ? `de ${brl(c.budget, { cents: false })}` : `· média ${brl(c.avg3, { cents: false })}`}</span>
                </span>
              </div>
              <div style={{ margin: '8px 0 4px' }}>
                <Progress value={c.mtd} max={max} mark={max > 0 ? c.usualByNow / max : undefined} color={overBudget ? 'var(--amber)' : c.budget != null ? 'var(--green)' : 'var(--muted)'} />
              </div>
              <div className="muted small">
                {c.budget == null
                  ? `costuma estar em ${brl(c.usualByNow, { cents: false })} nesta data`
                  : overBudget
                    ? `passou ${brl(c.mtd - c.budget, { cents: false })} do teto`
                    : willOver
                      ? `restam ${brl(c.budget - c.mtd, { cents: false })} · no ritmo habitual fecha em ${brl(c.projected, { cents: false })}`
                      : `restam ${brl(c.budget - c.mtd, { cents: false })}`}
              </div>
              <div className="row between" style={{ marginTop: 8 }}>
                <button className="btn sm" title="Trocar entre essencial e estilo de vida" onClick={() => run(api.setKind(c.category, c.kind === 'essencial' ? 'estilo' : 'essencial'))}>
                  {c.kind === 'essencial' ? 'Essencial' : 'Estilo de vida'}
                </button>
                <MoneyInput label={`Teto de ${c.category}`} value={c.budget} placeholder="sem teto" onCommit={(v) => run(api.setBudget(c.category, v))} />
              </div>
            </div>
          );
        })}
      </Card>

      {data.rules.length ? (
        <p className="muted small">{data.rules.length} regra(s) de categoria ativas. Gerencie em <a href="#contas">Contas e ajustes</a>.</p>
      ) : null}
    </div>
  );
}

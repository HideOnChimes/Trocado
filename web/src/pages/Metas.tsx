import { useState, type FormEvent } from 'react';
import { brl, monthOf, shortDate, toNumber } from '../format.ts';
import { api, useStore } from '../store.tsx';
import type { Goal } from '../types.ts';
import { Card, Empty, Progress } from '../ui.tsx';

function monthsUntil(from: string, deadline: string): number {
  const [fy, fm] = monthOf(from).split('-').map(Number);
  const [ty, tm] = deadline.slice(0, 7).split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function GoalRow({ goal }: { goal: Goal }) {
  const { data, run } = useStore();
  const [add, setAdd] = useState('');
  const missing = Math.max(0, goal.target - goal.saved);
  const months = goal.deadline ? monthsUntil(data.today, goal.deadline) : null;
  const perMonth = months != null && months > 0 ? missing / months : null;
  const done = missing === 0;

  const deposit = (e: FormEvent) => {
    e.preventDefault();
    const v = toNumber(add);
    if (v > 0) run(api.patchGoal(goal.id, { saved: goal.saved + v })).then(() => setAdd(''));
  };

  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
      <div className="row between wrap">
        <div>
          <strong>{goal.name}</strong>
          {goal.deadline ? <span className="muted small"> · até {shortDate(goal.deadline)}</span> : null}
        </div>
        <div>
          <strong>{brl(goal.saved, { cents: false })}</strong> <span className="muted">de {brl(goal.target, { cents: false })}</span>
        </div>
      </div>
      <div style={{ margin: '8px 0' }}>
        <Progress value={goal.saved} max={goal.target} color="var(--green)" />
      </div>
      <div className="row between wrap">
        <span className="muted small">
          {done
            ? 'Meta alcançada.'
            : perMonth != null
              ? `Faltam ${brl(missing, { cents: false })}: ${brl(perMonth, { cents: false })} por mês (${brl(perMonth / 30, { cents: false })} por dia) em ${months} meses.`
              : months != null && months <= 0
                ? `Faltam ${brl(missing, { cents: false })}. O prazo chegou; ajuste a data ou o valor.`
                : `Faltam ${brl(missing, { cents: false })}.`}
        </span>
        <form className="row" onSubmit={deposit}>
          <input className="input num" inputMode="decimal" placeholder="valor" value={add} onChange={(e) => setAdd(e.target.value)} aria-label={`Valor guardado para ${goal.name}`} />
          <button className="btn sm" type="submit">Guardei</button>
          <button className="btn sm danger" type="button" onClick={() => window.confirm(`Excluir a meta "${goal.name}"?`) && run(api.removeGoal(goal.id))}>Excluir</button>
        </form>
      </div>
    </div>
  );
}

export function Metas() {
  const { data, a, run } = useStore();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const e = a.emergency;
  const targetReserve = e.essentialMonthly * e.targetMonths;

  const create = (ev: FormEvent) => {
    ev.preventDefault();
    const t = toNumber(target);
    if (!name.trim() || t <= 0) return;
    run(api.addGoal({ name: name.trim(), target: t, saved: 0, deadline: deadline || null })).then((ok) => {
      if (ok) {
        setName('');
        setTarget('');
        setDeadline('');
      }
    });
  };

  return (
    <div className="stack">
      <Card title="Reserva de emergência" right={<span className={`badge ${e.months >= e.targetMonths ? 'green' : 'amber'}`}>{e.months.toFixed(1).replace('.', ',')} de {e.targetMonths} meses</span>}>
        <div className="row between wrap" style={{ alignItems: 'baseline' }}>
          <span className="big">{brl(e.reserve, { cents: false })}</span>
          <span className="muted">alvo {brl(targetReserve, { cents: false })}</span>
        </div>
        <div style={{ margin: '10px 0' }}>
          <Progress value={e.reserve} max={targetReserve} color="var(--green)" />
        </div>
        <p className="muted small">
          Conta: saldo em conta e poupança mais renda fixa, dividido pelos seus gastos essenciais ({brl(e.essentialMonthly, { cents: false })}/mês). Fundos e bolsa ficam de fora porque podem estar em baixa justo quando você precisar.
          {e.months >= e.targetMonths ? ' Reserva completa: o que entrar a partir de agora pode ir para investimentos de prazo mais longo.' : ` Faltam ${brl(Math.max(0, targetReserve - e.reserve), { cents: false })}. Até completar, prefira Tesouro Selic ou CDB com liquidez diária.`}
        </p>
      </Card>

      <Card title="Suas metas">
        {data.goals.length === 0 ? <Empty>Nenhuma meta ainda. Dar nome, valor e data a um objetivo é o que faz o dinheiro chegar lá.</Empty> : null}
        {data.goals.map((g) => <GoalRow key={g.id} goal={g} />)}
        {data.goals.length > 0 ? <p className="muted small" style={{ marginTop: 8 }}>O valor guardado é você quem informa: o banco não diz para qual meta o dinheiro foi.</p> : null}
        {data.goals.length > 1 ? <p className="muted small" style={{ marginTop: 8 }}>Dica: concentrar o aporte em uma meta por vez costuma render mais do que dividir entre várias.</p> : null}

        <div className="divider" />
        <form className="row wrap" onSubmit={create} style={{ alignItems: 'flex-end' }}>
          <label className="field grow">Nome<input className="input" value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Ex.: Entrada do apartamento" maxLength={60} required /></label>
          <label className="field">Valor alvo (R$)<input className="input num" inputMode="decimal" value={target} onChange={(ev) => setTarget(ev.target.value)} required /></label>
          <label className="field">Até quando<input className="input" type="month" value={deadline} min={monthOf(data.today)} onChange={(ev) => setDeadline(ev.target.value)} /></label>
          <button className="btn primary" type="submit">Criar meta</button>
        </form>
      </Card>
    </div>
  );
}

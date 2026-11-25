import { dateTime } from '../format.ts';
import { api, useStore } from '../store.tsx';

const LINKS = [
  { key: 'recorrentes', title: 'Fixos e parcelas', hint: 'Assinaturas, contas do mês e parcelas em aberto' },
  { key: 'metas', title: 'Metas', hint: 'Reserva de emergência e objetivos' },
  { key: 'contas', title: 'Contas e ajustes', hint: 'Bancos conectados, meta de investimento, regras' },
];

/** Telas que não cabem na barra inferior. */
export function Mais() {
  const { data, busy, run } = useStore();
  return (
    <div className="stack">
      {LINKS.map((l) => (
        <a key={l.key} className="card row between link-card" href={`#${l.key}`}>
          <div>
            <strong>{l.title}</strong>
            <div className="muted small">{l.hint}</div>
          </div>
          <span aria-hidden>›</span>
        </a>
      ))}
      <div className="row between muted small">
        <span>Atualizado: {dateTime(data.syncedAt)}</span>
        {!data.demo ? (
          <button className="btn sm" disabled={busy} onClick={() => run(api.sync())}>
            {busy ? 'Atualizando…' : 'Atualizar agora'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

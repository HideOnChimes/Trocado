import { useMemo, useState } from 'react';
import { INTERNAL, isInternal, merchantKey } from '../engine.ts';
import { brl, dayLabel, fold, monthLabel, monthOf, shiftMonth } from '../format.ts';
import { api, useStore } from '../store.tsx';
import type { Tx } from '../types.ts';
import { Empty } from '../ui.tsx';

const NEW = '__nova__';

export function Transacoes() {
  const { data, run } = useStore();
  // O extrato anda por mês do calendário, mesmo quando o mês do app começa em outro dia.
  const thisMonth = monthOf(data.today);
  const [month, setMonth] = useState(thisMonth);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  // Lançamento aberto: mostra a troca de categoria e o botão de ignorar.
  const [open, setOpen] = useState<string | null>(null);
  // Depois de recategorizar à mão, oferece transformar em regra para as próximas.
  const [offer, setOffer] = useState<{ key: string; category: string } | null>(null);

  const oldest = data.transactions.length ? monthOf(data.transactions[data.transactions.length - 1].date) : thisMonth;
  const accountLabel = useMemo(() => {
    const bank = new Map(data.items.map((i) => [i.id, i.bank]));
    return new Map(data.accounts.map((acc) => [acc.id, `${bank.get(acc.itemId) ?? ''} · ${acc.name}`]));
  }, [data.items, data.accounts]);

  const categories = useMemo(() => {
    const set = new Set<string>([...Object.values(INTERNAL), 'Outros']);
    for (const t of data.transactions) set.add(t.category);
    return [...set].sort((x, y) => x.localeCompare(y, 'pt-BR'));
  }, [data.transactions]);

  const rows = useMemo(() => {
    const q = fold(query.trim());
    return data.transactions.filter((t) => monthOf(t.date) === month && (!filter || t.category === filter) && (!q || fold(`${t.description} ${t.category} ${t.note ?? ''}`).includes(q)));
  }, [data.transactions, month, query, filter]);

  const total = rows.filter((t) => !t.ignored && !isInternal(t.category)).reduce((s, t) => s + t.amount, 0);

  const changeCategory = async (t: Tx, value: string) => {
    let category: string | null = value;
    if (value === NEW) {
      category = window.prompt('Nome da nova categoria:')?.trim() || null;
      if (!category) return;
    }
    if (value === '') category = null; // volta para a automática
    const ok = await run(api.patchTx(t.id, { category }));
    const key = merchantKey(t);
    if (ok && category && key.length >= 3) setOffer({ key, category });
  };

  return (
    <div className="stack">
      <div className="card row wrap">
        <button className="btn" aria-label="Mês anterior" disabled={month <= oldest} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <strong style={{ minWidth: 90, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(month)}</strong>
        <button className="btn" aria-label="Próximo mês" disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        <input className="input grow" placeholder="Buscar descrição, categoria ou nota" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar" />
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span className="muted small">{rows.length} lançamentos · saldo {brl(total, { sign: true })}</span>
      </div>

      {offer ? (
        <div className="banner row between wrap" style={{ marginBottom: 0 }}>
          <span>Classificar sempre <strong>“{offer.key}”</strong> como <strong>{offer.category}</strong>? Vale para lançamentos passados e futuros.</span>
          <span className="row">
            <button className="btn sm primary" onClick={() => run(api.addRule(offer.key, offer.category)).then(() => setOffer(null))}>Criar regra</button>
            <button className="btn sm" onClick={() => setOffer(null)}>Só esta</button>
          </span>
        </div>
      ) : null}

      <div className="card">
        {rows.length === 0 ? <Empty>{query || filter ? 'Nada encontrado com esse filtro.' : 'Sem transações neste mês.'}</Empty> : null}
        {rows.map((t, i) => {
          const header = rows[i - 1]?.date !== t.date;
          const internal = isInternal(t.category);
          const expanded = open === t.id;
          return [
            header ? <div key={`d-${t.date}`} className="day">{dayLabel(t.date, data.today)}</div> : null,
            <div key={t.id} className={`item ${t.ignored ? 'dim' : ''}`}>
              <button className="item-head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : t.id)}>
                <div className="grow">
                  <div className="ellipsis">{t.description}</div>
                  <div className="muted small ellipsis">{t.category} · {accountLabel.get(t.accountId) ?? ''}</div>
                </div>
                <strong style={{ whiteSpace: 'nowrap', color: internal || t.ignored ? 'var(--muted)' : t.amount > 0 ? 'var(--green)' : undefined }}>{brl(t.amount, { sign: true })}</strong>
              </button>
              {t.instTotal || t.pending || internal || t.ignored ? (
                <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                  {t.instTotal ? <span className="badge">parcela {t.instN}/{t.instTotal}</span> : null}
                  {t.pending ? <span className="badge amber">pendente</span> : null}
                  {internal ? <span className="badge">não conta como gasto</span> : null}
                  {t.ignored ? <span className="badge">ignorada</span> : null}
                </div>
              ) : null}
              {expanded ? (
                <div className="row" style={{ marginTop: 10 }}>
                  <select className="input grow" value={t.category} onChange={(e) => changeCategory(t, e.target.value)} aria-label={`Categoria de ${t.description}`}>
                    {categories.includes(t.category) ? null : <option>{t.category}</option>}
                    {categories.map((c) => <option key={c}>{c}</option>)}
                    <option value={NEW}>Nova categoria…</option>
                    {t.manual ? <option value="">Voltar para automática ({t.autoCategory})</option> : null}
                  </select>
                  <button className="btn sm" title="Tira o lançamento de todos os cálculos" onClick={() => run(api.patchTx(t.id, { ignored: !t.ignored }))}>{t.ignored ? 'Considerar' : 'Ignorar'}</button>
                </div>
              ) : null}
            </div>,
          ];
        })}
      </div>
    </div>
  );
}

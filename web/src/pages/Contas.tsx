import { useState } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';
import { brl, dateTime, shortDate, toNumber } from '../format.ts';
import { api, useStore } from '../store.tsx';
import type { Data, Item } from '../types.ts';
import { Card, Empty, MoneyInput } from '../ui.tsx';

const STATUS: Record<string, { label: string; tone: string }> = {
  UPDATED: { label: 'em dia', tone: 'green' },
  UPDATING: { label: 'atualizando', tone: 'amber' },
  WAITING_USER_INPUT: { label: 'aguardando você', tone: 'amber' },
  WAITING_USER_ACTION: { label: 'aguardando você', tone: 'amber' },
  LOGIN_ERROR: { label: 'reconectar', tone: 'red' },
  OUTDATED: { label: 'desatualizado', tone: 'amber' },
  ERROR: { label: 'erro', tone: 'red' },
};

/** O servidor aceita até este dia: todo mês tem dia 28. */
const MAX_START_DAY = 28;

/** Baixa todos os lançamentos num CSV que o Excel em português abre direto: ponto e vírgula, vírgula decimal, acentos. */
function exportCsv(data: Data) {
  const accounts = new Map(data.accounts.map((acc) => [acc.id, acc]));
  const banks = new Map(data.items.map((item) => [item.id, item.bank]));
  // Texto que começa com = + - @ (ou tabulação e retorno de linha) viraria fórmula no Excel: o apóstrofo na frente desarma.
  const cell = (text: string) => `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  const rows = data.transactions.map((t) => {
    const acc = accounts.get(t.accountId);
    return [
      t.date,
      cell(t.description),
      cell(t.category),
      t.amount.toFixed(2).replace('.', ','),
      cell(acc?.name ?? ''),
      cell((acc && banks.get(acc.itemId)) ?? ''),
      t.instTotal ? `${t.instN} de ${t.instTotal}` : '',
      t.ignored ? 'sim' : '',
    ].join(';');
  });
  const csv = ['data;descrição;categoria;valor;conta;banco;parcela;ignorado', ...rows].join('\r\n');
  // O marcador no começo (BOM) faz o Excel ler os acentos certo.
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `trocado-lancamentos-${data.today}.csv`;
  link.click();
  // Soltar o endereço na hora pode cortar o download em navegador mais lento.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Contas() {
  const { data, a, busy, run, auth, logout } = useStore();
  const [token, setToken] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [pctText, setPctText] = useState(String(data.settings.savingsTargetPct));
  const [monthsText, setMonthsText] = useState(String(data.settings.emergencyMonths));
  const [startText, setStartText] = useState(String(data.settings.monthStartDay));

  const connect = async () => {
    setConnectError(null);
    try {
      setToken((await api.connectToken()).accessToken);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Falha ao iniciar a conexão');
    }
  };

  const remove = (item: Item) => {
    if (window.confirm(`Remover ${item.bank}?\n\nA conexão é apagada no Pluggy e o histórico desse banco sai do app. Para voltar, será preciso conectar de novo.`)) run(api.removeItem(item.id));
  };

  return (
    <div className="stack">
      {data.demo ? (
        <Card title="Como ligar nos seus bancos de verdade">
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
            <li>Crie conta em <strong>meu.pluggy.ai</strong> e conecte ali cada banco (o login acontece no próprio banco, via Open Finance).</li>
            <li>Crie conta em <strong>dashboard.pluggy.ai</strong>, crie uma aplicação e ative o conector <strong>MeuPluggy</strong> nela.</li>
            <li>Copie o client id e o client secret para o arquivo <code>server/.env</code> (na nuvem: para os segredos da hospedagem) e reinicie o servidor.</li>
            <li>Volte aqui e clique em <strong>Conectar banco</strong>, uma vez por banco.</li>
          </ol>
          <p className="muted small" style={{ marginTop: 10 }}>Detalhes no LEIAME.md. Gratuito para uso pessoal; os dados atualizam uma vez por dia.</p>
        </Card>
      ) : null}

      <Card
        title="Bancos conectados"
        right={!data.demo ? (
          <span className="row">
            <button className="btn sm" disabled={busy} onClick={() => run(api.sync())}>{busy ? 'Atualizando…' : 'Atualizar agora'}</button>
            <button className="btn sm primary" onClick={connect}>Conectar banco</button>
          </span>
        ) : undefined}
      >
        {connectError ? <p className="red small" style={{ marginBottom: 10 }}>{connectError}</p> : null}
        {data.items.length === 0 ? <Empty>Nenhum banco conectado ainda.</Empty> : null}
        {data.items.map((item) => {
          const status = STATUS[item.status] ?? { label: item.status.toLowerCase(), tone: '' };
          const accounts = data.accounts.filter((acc) => acc.itemId === item.id);
          return (
            <div key={item.id} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
              <div className="row between wrap">
                <div className="row">
                  <span style={{ width: 12, height: 12, borderRadius: 6, background: item.color ?? 'var(--accent)' }} />
                  <strong>{item.bank}</strong>
                  <span className={`badge ${status.tone}`}>{status.label}</span>
                </div>
                <div className="row">
                  <span className="muted small">banco sincronizado em {dateTime(item.lastUpdatedAt)}</span>
                  {!data.demo ? <button className="btn sm danger" onClick={() => remove(item)}>Remover</button> : null}
                </div>
              </div>
              {item.error ? <p className="red small" style={{ marginTop: 6 }}>{item.error}</p> : null}
              {accounts.map((acc) => (
                <div key={acc.id} className="row between small" style={{ padding: '6px 0 0 22px' }}>
                  <span className="muted">
                    {acc.type === 'CREDIT' ? 'Cartão' : acc.subtype === 'SAVINGS_ACCOUNT' ? 'Poupança' : 'Conta'} · {acc.name}
                    {acc.number ? ` · final ${acc.number}` : ''}
                    {acc.type === 'CREDIT' && acc.availableLimit != null ? ` · limite livre ${brl(acc.availableLimit, { cents: false })}` : ''}
                  </span>
                  <span style={{ fontWeight: 600 }} className={acc.type === 'CREDIT' && acc.balance > 0 ? 'amber' : ''}>
                    {brl(acc.balance)}{acc.type === 'CREDIT' ? ' em fatura' : ''}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </Card>

      <Card title="Ajustes do plano">
        <div className="grid g3">
          <label className="field">
            Meta de investimento (% da renda)
            <input
              className="input num"
              inputMode="numeric"
              value={pctText}
              onChange={(e) => setPctText(e.target.value)}
              onBlur={() => run(api.setSettings({ savingsTargetPct: Number(pctText) || 0 }))}
            />
            <span>Hoje: {brl(a.free.saveTarget, { cents: false })} por mês, separados antes do "livre para gastar".</span>
          </label>
          <label className="field">
            Renda mensal líquida (R$)
            <MoneyInput label="Renda mensal" value={data.settings.monthlyIncome} placeholder="automática" onCommit={(v) => run(api.setSettings({ monthlyIncome: v || null }))} />
            <span>Vazio = o app usa a mediana das entradas dos últimos 3 meses ({brl(a.free.expectedIncome, { cents: false })}).</span>
          </label>
          <label className="field">
            Reserva de emergência (meses)
            <input
              className="input num"
              inputMode="numeric"
              value={monthsText}
              onChange={(e) => setMonthsText(e.target.value)}
              onBlur={() => run(api.setSettings({ emergencyMonths: Number(monthsText) || 6 }))}
            />
            <span>Referência comum: 6 meses com renda fixa (CLT), 12 com renda variável.</span>
          </label>
          <label className="field">
            Dia em que seu mês começa
            <input
              className="input num"
              inputMode="numeric"
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              onBlur={() => run(api.setSettings({ monthStartDay: toNumber(startText) || 1 })).then(() => setStartText(String(Math.min(MAX_START_DAY, Math.max(1, Math.round(toNumber(startText) || 1))))))}
            />
            <span>
              1 = mês do calendário; até {MAX_START_DAY}. Com outro dia, "pode gastar", limites e fechamento contam desse dia até a véspera dele no mês seguinte.
              {a.salary ? ` Seu salário costuma cair no dia ${a.salary.day}.` : ''} Hoje o mês do app vai de {shortDate(a.cycle.start)} a {shortDate(a.cycle.end)}.
            </span>
          </label>
        </div>
      </Card>

      <Card title="Regras de categoria">
        {data.rules.length === 0 ? (
          <Empty>Nenhuma regra. Ao trocar a categoria de uma transação, o app oferece criar uma.</Empty>
        ) : (
          <table className="table">
            <tbody>
              {data.rules.map((r) => (
                <tr key={r.id}>
                  <td>Descrição contém <strong>“{r.pattern}”</strong></td>
                  <td>→ {r.category}</td>
                  <td className="right"><button className="btn sm danger" onClick={() => run(api.removeRule(r.id))}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <p className="muted small">
        Seus dados ficam só no servidor que você controla (arquivo server/data/financas.db). A senha do banco nunca passa pelo app: a autorização é feita no próprio banco.
      </p>
      <div className="row wrap">
        <button className="btn" onClick={() => exportCsv(data)}>Exportar lançamentos (CSV)</button>
        {auth ? <button className="btn danger" onClick={logout}>Sair de todos os aparelhos</button> : null}
      </div>

      {token ? (
        <PluggyConnect
          connectToken={token}
          includeSandbox={false}
          language="pt"
          theme="dark"
          onSuccess={({ item }) => {
            setToken(null);
            run(api.addItem(item.id));
          }}
          onError={(e) => setConnectError(e?.message || 'A conexão com o banco falhou')}
          onClose={() => setToken(null)}
        />
      ) : null}
    </div>
  );
}

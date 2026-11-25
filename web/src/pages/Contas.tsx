import { useState } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';
import { brl, dateTime } from '../format.ts';
import { api, useStore } from '../store.tsx';
import type { Item } from '../types.ts';
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

export function Contas() {
  const { data, a, busy, run, auth, logout } = useStore();
  const [token, setToken] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [pctText, setPctText] = useState(String(data.settings.savingsTargetPct));
  const [monthsText, setMonthsText] = useState(String(data.settings.emergencyMonths));

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
      {auth ? (
        <button className="btn danger" onClick={logout}>Sair de todos os aparelhos</button>
      ) : null}

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

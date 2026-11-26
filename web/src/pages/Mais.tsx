import { dateTime } from '../format.ts';
import { api, useStore } from '../store.tsx';
import { Card } from '../ui.tsx';

const LINKS = [
  { key: 'recorrentes', title: 'Fixos e parcelas', hint: 'Assinaturas, contas do mês e parcelas em aberto' },
  { key: 'metas', title: 'Metas', hint: 'Reserva de emergência e objetivos' },
  { key: 'contas', title: 'Contas e ajustes', hint: 'Bancos conectados, meta de investimento, regras' },
];

// O que o app obtém ou calcula sem ninguém digitar e o que só existe se a pessoa informar.
// Texto fixo: confira com server/sync.mjs, server/market.mjs e engine.ts quando mudar o que o app busca ou calcula.
const AUTOMATIC = [
  'Saldos, lançamentos da conta e compras no cartão',
  'Fatura atual, limite e vencimento do cartão',
  'Parcelas: as que o banco informa ou que dá para ler na descrição da compra',
  'Investimentos, quando o banco informa',
  'Categoria de cada lançamento (sua correção e suas regras valem mais)',
  'Assinaturas e contas fixas que se repetem há 3 meses ou mais, e aumento de preço',
  'Renda do mês, pelas entradas dos últimos meses (ou a que você fixar)',
  'Reserva de emergência, juros e tarifas pagos, taxas do Banco Central',
];
const MANUAL = [
  { key: 'contas', text: 'Conectar cada banco, e reconectar se ele pedir' },
  { key: 'contas', text: 'Meta de investimento, meses de reserva e, se quiser, o valor da sua renda' },
  { key: 'orcamento', text: 'Tetos por categoria (o app sugere) e o que é essencial ou estilo de vida' },
  { key: 'metas', text: 'Metas: nome, valor, prazo e quanto já guardou' },
  { key: 'transacoes', text: 'Corrigir categoria errada, criar regra ou ignorar um lançamento. Aporte só conta se sair da conta como Investimentos' },
];

/** Telas que não cabem na barra inferior, e o que é automático ou manual no app. */
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
      <Card title="O que o app pega sozinho">
        {/* A div de fora faz o primeiro item não ganhar linha em cima, como no cartão de baixo. */}
        <div>
          {AUTOMATIC.map((text) => (
            <div key={text} className="insight">
              <span className="dot good" />
              <span>{text}</span>
            </div>
          ))}
        </div>
        {/* Na demonstração nada sincroniza: a frase seria mentira. */}
        {data.demo ? null : <p className="muted small" style={{ marginTop: 12 }}>O app busca de 6 em 6 horas; o banco renova os dados uma vez por dia. Na primeira vez vêm 12 meses de histórico.</p>}
      </Card>
      <Card title="O que depende de você">
        {MANUAL.map((m) => (
          <a key={m.text} className="insight link-card" href={`#${m.key}`}>
            <span className="dot warn" />
            <span className="grow">{m.text}</span>
            <span aria-hidden>›</span>
          </a>
        ))}
        <p className="muted small" style={{ marginTop: 12 }}>Dinheiro vivo e conta em banco não conectado não aparecem.</p>
      </Card>
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

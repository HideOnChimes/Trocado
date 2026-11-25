import { useEffect, useState } from 'react';
import { Contas } from './pages/Contas.tsx';
import { Investir } from './pages/Investir.tsx';
import { Mais } from './pages/Mais.tsx';
import { Metas } from './pages/Metas.tsx';
import { Orcamento } from './pages/Orcamento.tsx';
import { Painel } from './pages/Painel.tsx';
import { Recorrentes } from './pages/Recorrentes.tsx';
import { Transacoes } from './pages/Transacoes.tsx';
import { Vitrine } from './pages/Vitrine.tsx';
import { StoreProvider, useStore } from './store.tsx';

// Telas com `icon` (traço SVG 24x24) aparecem na barra inferior; as outras abrem pela tela Mais.
const PAGES = [
  { key: 'painel', label: 'Início', Page: Painel, icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { key: 'transacoes', label: 'Extrato', Page: Transacoes, icon: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6' },
  { key: 'orcamento', label: 'Limites', Page: Orcamento, icon: 'M4 17a8 8 0 1 1 16 0M12 17l4-6' },
  { key: 'investir', label: 'Investir', Page: Investir, icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { key: 'mais', label: 'Mais', Page: Mais, icon: 'M5 12h.01M12 12h.01M19 12h.01' },
  { key: 'recorrentes', label: 'Fixos e parcelas', Page: Recorrentes },
  { key: 'metas', label: 'Metas', Page: Metas },
  { key: 'contas', label: 'Contas e ajustes', Page: Contas },
  { key: 'vitrine', label: 'Personagens', Page: Vitrine },
] as const;

type PageKey = (typeof PAGES)[number]['key'];

const fromHash = (): PageKey => PAGES.find((p) => `#${p.key}` === location.hash)?.key ?? 'painel';

function Shell() {
  const { data, error, clearError } = useStore();
  const [page, setPage] = useState(fromHash);

  useEffect(() => {
    const onHash = () => setPage(fromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const current = PAGES.find((p) => p.key === page)!;
  const { Page } = current;
  const inTab = 'icon' in current;
  // Sem banco conectado só fazem sentido as telas que levam a conectar um (e a vitrine, que não usa dados).
  const blocked = data.items.length === 0 && !['contas', 'mais', 'vitrine'].includes(page);

  return (
    <div className="shell">
      <main className="main">
        {data.demo ? (
          <div className="banner">
            <strong>Modo demonstração.</strong> Bancos e valores são falsos e nada é salvo. Para usar seus dados reais, veja o passo a passo em <a href="#contas">Contas e ajustes</a>.
          </div>
        ) : null}
        {error ? (
          <div className="banner error row between">
            <span>{error}</span>
            <button className="btn sm" onClick={clearError}>Fechar</button>
          </div>
        ) : null}
        <div className="head">
          <h1>{current.label}</h1>
          {inTab ? null : <a className="btn sm" href="#mais">‹ Mais</a>}
        </div>
        {blocked ? (
          // Sem banco conectado não há o que calcular: melhor dizer isso do que mostrar uma tela de zeros.
          <section className="card" style={{ textAlign: 'center', padding: 40 }}>
            <h2 style={{ marginBottom: 8 }}>Nenhum banco conectado ainda</h2>
            <p className="muted" style={{ marginBottom: 16 }}>Conecte suas contas pelo Open Finance e o app monta tudo sozinho, sem lançamento manual.</p>
            <a className="btn primary" href="#contas">Conectar banco</a>
          </section>
        ) : (
          <Page />
        )}
      </main>

      <nav className="tabs" aria-label="Seções">
        {PAGES.map((p) => {
          if (!('icon' in p)) return null;
          const on = p.key === page || (p.key === 'mais' && !inTab);
          return (
            <button key={p.key} className={`tab ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => (location.hash = p.key)}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={p.key === 'mais' ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={p.icon} />
              </svg>
              {p.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

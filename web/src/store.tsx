import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { analyze, type Analysis } from './engine.ts';
import { maskValues } from './format.ts';
import { Login } from './Login.tsx';
import type { Data, Kind, Market } from './types.ts';

/** Erro da API com o status HTTP: 401 leva à tela de login. */
class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Sem resposta do servidor. Sem internet ou servidor desligado?', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json?.error || `Erro ${res.status}`, res.status);
  return json as T;
}

// Toda alteração devolve o retrato completo dos dados; a tela só troca o estado.
export const api = {
  data: () => call<Data>('GET', '/data'),
  market: () => call<Market>('GET', '/market'),
  login: (password: string) => call<{ ok: true }>('POST', '/login', { password }),
  logout: () => call<{ ok: true }>('POST', '/logout', {}),
  session: () => call<{ auth: boolean }>('GET', '/session'),
  sync: () => call<{ errors: { id: string; error: string }[]; data: Data }>('POST', '/sync', {}).then((r) => r.data),
  connectToken: () => call<{ accessToken: string }>('POST', '/connect-token', {}),
  addItem: (id: string) => call<Data>('POST', '/items', { id }),
  removeItem: (id: string) => call<Data>('DELETE', `/items/${id}`),
  patchTx: (id: string, patch: { category?: string | null; note?: string | null; ignored?: boolean }) => call<Data>('PATCH', `/transactions/${encodeURIComponent(id)}`, patch),
  addRule: (pattern: string, category: string) => call<Data>('POST', '/rules', { pattern, category }),
  removeRule: (id: number) => call<Data>('DELETE', `/rules/${id}`),
  setBudget: (category: string, amount: number) => call<Data>('PUT', '/budgets', { category, amount }),
  setKind: (category: string, kind: Kind) => call<Data>('PUT', '/category-kinds', { category, kind }),
  addGoal: (goal: { name: string; target: number; saved: number; deadline: string | null }) => call<Data>('POST', '/goals', goal),
  patchGoal: (id: number, patch: { saved?: number; target?: number }) => call<Data>('PATCH', `/goals/${id}`, patch),
  removeGoal: (id: number) => call<Data>('DELETE', `/goals/${id}`),
  dismiss: (key: string) => call<Data>('POST', '/dismiss', { key }),
  setSettings: (patch: Partial<Data['settings']>) => call<Data>('PUT', '/settings', patch),
};

type Store = {
  data: Data;
  a: Analysis;
  market: Market | null;
  busy: boolean;
  error: string | null;
  /** Executa uma alteração e atualiza a tela com o resultado. */
  run: (action: Promise<Data>) => Promise<boolean>;
  clearError: () => void;
  /** O servidor exige senha: mostra o botão Sair. */
  auth: boolean;
  logout: () => void;
  /** Modo "esconder valores": todo valor em reais aparece como bolinhas. */
  hidden: boolean;
  toggleHidden: () => void;
};

const Ctx = createContext<Store | null>(null);
const HIDDEN_KEY = 'trocado:esconder';


export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [auth, setAuth] = useState(false);

  const run = useCallback(async (action: Promise<Data>) => {
    setBusy(true);
    try {
      setData(await action);
      setError(null);
      return true;
    } catch (e) {
      // Sessão ausente ou vencida: volta para a tela de login em vez de mostrar erro.
      if (e instanceof ApiError && e.status === 401) setNeedLogin(true);
      else setError(e instanceof Error ? e.message : 'Erro inesperado');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const load = useCallback(() => {
    run(api.data());
    api.market().then(setMarket).catch(() => setMarket(null));
    api.session().then((s) => setAuth(s.auth)).catch(() => setAuth(false));
  }, [run]);

  useEffect(load, [load]);

  const logout = useCallback(() => {
    // Mesmo se a chamada falhar, a tela some: sem sessão válida o servidor não entrega mais nada.
    api.logout().catch(() => {}).then(() => {
      setData(null);
      setNeedLogin(true);
    });
  }, []);

  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleHidden = useCallback(() => setHidden((was) => !was), []);
  // A escolha é do aparelho, não da conta: quem esconde no ônibus não quer escondido no PC de casa.
  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '');
    } catch {
      // Sem armazenamento (aba anônima): vale só até fechar.
    }
  }, [hidden]);

  // `analyze` escreve valores dentro de frases: o modo esconder precisa estar ligado antes, e a análise é refeita ao trocar.
  const a = useMemo(() => {
    maskValues(hidden);
    return data ? analyze(data) : null;
  }, [data, hidden]);
  const clearError = useCallback(() => setError(null), []);

  if (needLogin) {
    return (
      <Login
        onSubmit={async (password) => {
          await api.login(password);
          setNeedLogin(false);
          load();
        }}
      />
    );
  }
  if (!data || !a) {
    return (
      <div style={{ padding: 40 }}>
        {error ? <div className="banner error">{error}</div> : <p className="muted">Carregando…</p>}
        {error ? <button className="btn" onClick={() => run(api.data())}>Tentar de novo</button> : null}
      </div>
    );
  }
  return <Ctx.Provider value={{ data, a, market, busy, error, run, clearError, auth, logout, hidden, toggleHidden }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const store = useContext(Ctx);
  if (!store) throw new Error('useStore fora do StoreProvider');
  return store;
}

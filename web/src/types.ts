// Formato dos dados devolvidos por GET /api/data.

export type Item = { id: string; bank: string; color: string | null; status: string; lastUpdatedAt: string | null; error: string | null };

export type Account = {
  id: string;
  itemId: string;
  type: 'BANK' | 'CREDIT';
  subtype: string | null;
  name: string;
  number: string | null;
  balance: number;
  creditLimit: number | null;
  availableLimit: number | null;
  dueDate: string | null;
};

export type Investment = {
  id: string;
  itemId: string;
  name: string;
  type: string;
  subtype: string | null;
  balance: number;
  invested: number | null;
  profit: number | null;
  rate: number | null;
  rateType: string | null;
  annualRate: number | null;
  dueDate: string | null;
  issuer: string | null;
};

export type Tx = {
  id: string;
  accountId: string;
  /** AAAA-MM-DD */
  date: string;
  description: string;
  merchant: string | null;
  /** Saída negativa, entrada positiva. */
  amount: number;
  category: string;
  autoCategory: string;
  /** Categoria escolhida à mão. */
  manual: boolean;
  note: string | null;
  /** Fora de todas as contas do app. */
  ignored: boolean;
  pending: boolean;
  instN: number | null;
  instTotal: number | null;
};

export type Goal = { id: number; name: string; target: number; saved: number; deadline: string | null; createdAt: string };
export type Rule = { id: number; pattern: string; category: string };
export type Snapshot = { date: string; cash: number; cardDebt: number; invested: number };
export type Settings = { savingsTargetPct: number; monthlyIncome: number | null; emergencyMonths: number };
export type Kind = 'essencial' | 'estilo';

export type Data = {
  demo: boolean;
  today: string;
  syncedAt: string | null;
  settings: Settings;
  items: Item[];
  accounts: Account[];
  investments: Investment[];
  transactions: Tx[];
  rules: Rule[];
  budgets: Record<string, number>;
  categoryKinds: Record<string, Kind>;
  goals: Goal[];
  dismissed: string[];
  snapshots: Snapshot[];
};

export type Market = { selic: number; cdi: number; ipca12: number; poupancaMes: number; rotativoMes: number; parceladoMes: number; live: boolean; asOf: string };

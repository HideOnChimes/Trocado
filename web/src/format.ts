const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const pad = (n: number) => String(n).padStart(2, '0');

// Modo "esconder valores": estado do módulo porque todo valor do app sai por `brl`. Só o store liga e desliga.
let masked = false;
export const maskValues = (on: boolean) => {
  masked = on;
};
export const valuesMasked = () => masked;
const MASK = 'R$ •••';

/** R$ 1.234,56. Com cents=false arredonda para reais inteiros. No modo "esconder valores" devolve bolinhas. */
export function brl(value: number, opts: { sign?: boolean; cents?: boolean } = {}): string {
  if (masked) return MASK;
  const cents = opts.cents ?? true;
  const abs = Math.abs(value);
  const [int, dec] = (cents ? abs.toFixed(2) : String(Math.round(abs))).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 ? '-' : opts.sign && value > 0 ? '+' : '';
  return `${sign}R$ ${grouped}${cents ? `,${dec}` : ''}`;
}

/** Número digitado à brasileira ("1.234,5"). Sem vírgula, o ponto só é milhar se vier antes de exatamente 3 algarismos: "1.000" é mil, "110.5" é cento e dez e meio. Texto que não é número vira 0. */
export function toNumber(text: string): number {
  const s = text.trim();
  const plain = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\.(?=\d{3}(\D|$))/g, '');
  return Number(plain) || 0;
}

export function pct(value: number, digits = 0): string {
  return `${value.toFixed(digits).replace('.', ',')}%`;
}

// Datas trafegam como texto AAAA-MM-DD (dia) e AAAA-MM (mês): sem fuso, sem surpresa.
export const monthOf = (day: string) => day.slice(0, 7);
export const dayOf = (day: string) => Number(day.slice(8, 10));

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Dia AAAA-MM-DD deslocado em `delta` dias. */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Quantos dias vão de `from` até `to` (AAAA-MM-DD). */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** Dia `d` do mês AAAA-MM; se o mês é mais curto, fica no último dia. */
export const dayIn = (month: string, d: number) => `${month}-${pad(Math.min(d, daysInMonth(month)))}`;

export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split('-').map(Number);
  return short ? MONTHS[m - 1] : `${MONTHS[m - 1]} ${y}`;
}

export function dayLabel(day: string, today?: string): string {
  if (day === today) return 'Hoje';
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]}, ${d} ${MONTHS[m - 1]}`;
}

export function shortDate(day: string | null): string {
  if (!day) return '—';
  const [y, m, d] = day.split('-').map(Number);
  return d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`;
}

export function dateTime(iso: string | null): string {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Texto sem acento e em minúsculas, para busca e agrupamento. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

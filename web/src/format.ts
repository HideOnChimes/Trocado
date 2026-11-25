const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const pad = (n: number) => String(n).padStart(2, '0');

/** R$ 1.234,56. Com cents=false arredonda para reais inteiros. */
export function brl(value: number, opts: { sign?: boolean; cents?: boolean } = {}): string {
  const cents = opts.cents ?? true;
  const abs = Math.abs(value);
  const [int, dec] = (cents ? abs.toFixed(2) : String(Math.round(abs))).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 ? '-' : opts.sign && value > 0 ? '+' : '';
  return `${sign}R$ ${grouped}${cents ? `,${dec}` : ''}`;
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

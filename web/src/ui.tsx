import { useEffect, useState, type ReactNode } from 'react';
import { brl } from './format.ts';

export const chart = {
  grid: '#2e323a',
  axis: '#9a9fa8',
  green: '#2fca85',
  red: '#ff6166',
  amber: '#f0a92b',
  blue: '#6f93ff',
  muted: '#868b95',
  cursor: 'rgba(255, 255, 255, 0.06)',
  tooltip: { background: '#24272e', border: '1px solid #2e323a', borderRadius: 12, color: '#f1f0ea', fontSize: 13 },
};
export const palette = ['#6f93ff', '#2fca85', '#f0a92b', '#ff6166', '#a78bfa', '#2cc3d6', '#ff8a57', '#8cc63f'];

/** Formata valor para tooltip e eixo dos gráficos. */
export const money0 = (v: unknown) => brl(Number(v) || 0, { cents: false });
export const compact = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1).replace('.', ',')} mi` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} mil` : String(Math.round(v)));

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card">
      {title ? (
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2>{title}</h2>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'green' | 'red' | 'amber'; hint?: ReactNode }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`big ${tone ?? ''}`} style={{ marginTop: 4 }}>{value}</div>
      {hint ? <div className="muted small" style={{ marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

/** Barra de progresso. `mark` desenha um risco (0 a 1), ex.: onde você costuma estar. */
export function Progress({ value, max, color, mark }: { value: number; max: number; color?: string; mark?: number }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="track">
      <div className="fill" style={{ width: `${ratio * 100}%`, background: color }} />
      {mark != null && mark > 0 && mark < 1 ? <div className="mark" style={{ left: `${mark * 100}%` }} /> : null}
    </div>
  );
}

/** Campo de valor em reais: só grava ao sair do campo ou apertar Enter. */
export function MoneyInput({ value, onCommit, placeholder, label }: { value: number | null; onCommit: (v: number) => void; placeholder?: string; label: string }) {
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => setText(value ? String(value) : ''), [value]);
  const commit = () => {
    const n = Number(text.replace(/\./g, '').replace(',', '.'));
    const next = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
    if (next !== (value ?? 0)) onCommit(next);
  };
  return (
    <input
      className="input num"
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder ?? '—'}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted" style={{ padding: '18px 0', textAlign: 'center' }}>{children}</p>;
}

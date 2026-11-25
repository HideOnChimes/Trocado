import { useState, type FormEvent } from 'react';
import { Mascote } from './Mascote.tsx';

/** Tela de senha. `onSubmit` rejeita com a mensagem do servidor quando a senha não passa. */
export function Login({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="login" onSubmit={submit}>
      <Mascote mood={error ? 'bravo' : 'neutro'} size={128} />
      <h1>Tostão</h1>
      <p className="muted">Seu dinheiro, sem lançamento manual.</p>
      <input className="input" type="password" autoComplete="current-password" placeholder="Senha" aria-label="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error ? <p className="red small" role="alert">{error}</p> : null}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}

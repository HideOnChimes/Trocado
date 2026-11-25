import type { Mood } from '../engine.ts';
import { Mascote, NAMES, type Character } from '../Mascote.tsx';

const CHARACTERS: { character: Character; hint: string }[] = [
  { character: 'tostao', hint: 'A moeda. Comenta o ritmo do mês no Início.' },
  { character: 'alucard', hint: 'O cartão vampiro. Vigia fatura e juros em Fixos e parcelas.' },
  { character: 'warren', hint: 'O cofrinho de cartola. Cobra o aporte em Investir.' },
];
const MOODS: Mood[] = ['feliz', 'neutro', 'preocupado', 'bravo'];

/** Os três personagens em todos os humores, para ver o que os números do dia não mostram. Toque neles. */
export function Vitrine() {
  return (
    <div className="stack">
      {CHARACTERS.map(({ character, hint }) => (
        <section key={character} className="card">
          <h2>{NAMES[character]}</h2>
          <p className="muted small">{hint}</p>
          <div className="grid cast">
            {MOODS.map((mood) => (
              <div key={mood} className="muted small">
                <Mascote character={character} mood={mood} size={72} />
                {mood}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

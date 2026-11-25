import { useId, useState, type ReactNode } from 'react';
import type { Mood } from './engine.ts';

// Três personagens no mesmo sistema (viewBox 0..120), desenhados a partir dos esboços do dono do app:
// uma forma dominante, cor chapada e poucos traços de rosto.
// Tostão é a moeda facetada de óculos escuros, Alucard o cartão de capa, Warren Bufê o saco de dinheiro de cartola.
// Paleta comum: tinta, branco e uma cor de assinatura para cada um.
// A personalidade está no movimento, todo em index.css (seção "mascotes"); aqui só formas e classes.

export type Character = 'tostao' | 'alucard' | 'warren';

/** Nome de cada personagem, para a tela e para o leitor de tela. */
export const NAMES: Record<Character, string> = { tostao: 'Tostão', alucard: 'Alucard', warren: 'Warren Bufê' };

const INK = '#16181d';
const YELLOW = '#ffc21a';
const YELLOW_DARK = '#e0a200';
const RED = '#e5383b';
/** Cinza da tarja magnética do cartão. */
const STRIPE = '#c9ccd3';
const PINK = '#ff9db2';
const SNOUT = '#ff7c98';

/** Traço de tinta de ponta redonda, usado em bocas, sobrancelhas e braço. */
const STROKE = { fill: 'none', stroke: INK, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

type EyesProps = {
  mood: Mood;
  left: number;
  right: number;
  y: number;
  color: string;
  /** Olhar de repouso em meia-lua inclinada (o "maldosinho" do Alucard) em vez de bolinha. */
  sly?: boolean;
};

/** Meia-lua de tampa reta; `tilt` positivo abaixa a ponta de dentro (cara de mau). */
function lid(x: number, y: number, radius: number, tilt: number) {
  return <path d={`M${x - radius} ${y}a${radius} ${radius} 0 0 0 ${2 * radius} 0z`} transform={`rotate(${tilt} ${x} ${y})`} />;
}

/** Olhos do Alucard e do Warren: o humor aparece neles. */
function Eyes({ mood, left, right, y, color, sly = false }: EyesProps) {
  let shapes: ReactNode;
  if (mood === 'feliz') {
    shapes = <path d={`M${left - 6} ${y + 3}q6-10 12 0M${right - 6} ${y + 3}q6-10 12 0`} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />;
  } else if (mood === 'bravo' || (sly && mood === 'neutro')) {
    const tilt = mood === 'bravo' ? 26 : 14;
    shapes = (
      <>
        {lid(left, y - 2, 7, tilt)}
        {lid(right, y - 2, 7, -tilt)}
      </>
    );
  } else {
    // Preocupado: olhinho miúdo. Neutro: oval em pé.
    const [rx, ry] = mood === 'preocupado' ? [3.6, 3.6] : [4.5, 7];
    shapes = (
      <>
        <ellipse cx={left} cy={y} rx={rx} ry={ry} />
        <ellipse cx={right} cy={y} rx={rx} ry={ry} />
      </>
    );
  }
  return (
    <g className="m-look">
      <g className="m-eyes" fill={color}>
        {shapes}
      </g>
    </g>
  );
}

/** O que cada humor acrescenta em volta do personagem: brilho, gota de suor ou fumaça. */
function Aura({ mood }: { mood: Mood }) {
  if (mood === 'feliz') {
    return (
      <g fill={YELLOW}>
        <path className="m-spark" d="M10 16l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" />
        <path className="m-spark late" d="M108 6l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" />
      </g>
    );
  }
  if (mood === 'preocupado') return <path className="m-sweat" d="M10 14q6 10 0 13q-6-3 0-13z" fill="#4da3ff" />;
  if (mood === 'bravo') {
    return (
      <g className="m-steam" fill="#c4c8cf">
        <circle cx="12" cy="16" r="6" />
        <circle className="late" cx="108" cy="16" r="6" />
      </g>
    );
  }
  return null;
}

// Heptágono do Tostão (ponta para cima, base reta): a face e o friso de dentro. A borda grossa arredonda os cantos.
const COIN = 'M60 20L91.3 35.1 99 68.9 77.4 96H42.6L21 68.9 28.7 35.1z';
const COIN_RING = 'M60 31L83.5 42.3 89.3 67.6 73.1 88H46.9L30.7 67.6 36.5 42.3z';
const LENS_LEFT = 'M38 49h28l-3 14H42z';
const LENS_RIGHT = 'M70 49h28l-4 14H73z';
const TOSTAO_MOUTH: Record<Mood, string> = {
  feliz: 'M57 75q8 10 16 0z',
  neutro: 'M61 77q7 5 13-2',
  preocupado: 'M59 79q3.5-4 7 0t7 0',
  bravo: 'M59 81q7-6 14 0',
};

/** Faixa de brilho de uma lente; `x` é onde ela começa, logo à esquerda da lente. As duas andam juntas. */
function glare(x: number) {
  return <path className="m-glare" d={`M${x} 66l10-20h6l-10 20zM${x + 11} 66l10-20h3l-10 20z`} fill="#fff" fillOpacity="0.6" />;
}

/** Heptágono: moeda facetada vista de lado, de óculos escuros com a haste reta e o gancho da orelha, um braço solto e o outro girando uma moedinha no ar. Os óculos escondem os olhos; o humor vai na boca. */
function Tostao({ mood }: { mood: Mood }) {
  // Um recorte por lente, com id próprio: a vitrine mostra vários Tostões na mesma página.
  const id = useId();
  return (
    <g transform="translate(0 5)">
      <clipPath id={`${id}-l`}>
        <path d={LENS_LEFT} />
      </clipPath>
      <clipPath id={`${id}-r`}>
        <path d={LENS_RIGHT} />
      </clipPath>
      <path d="M17 74q-8 4-6 14" {...STROKE} strokeWidth="4" />
      <path d={COIN} transform="translate(-7 0)" fill={YELLOW_DARK} stroke={YELLOW_DARK} strokeWidth="6" strokeLinejoin="round" />
      {/* Emenda a ponta de cima da lateral com a da face. */}
      <path d="M53 20H60" fill="none" stroke={YELLOW_DARK} strokeWidth="6" strokeLinecap="round" />
      <path d={COIN} fill={YELLOW} stroke={YELLOW} strokeWidth="6" strokeLinejoin="round" />
      <path d={COIN_RING} fill="none" stroke={YELLOW_DARK} strokeWidth="3" strokeLinejoin="round" />
      {/* Olhos ficam atrás das lentes; só aparecem quando os óculos escorregam (preocupado). */}
      <circle cx="52" cy="56" r="2.6" fill={INK} />
      <circle cx="84" cy="56" r="2.6" fill={INK} />
      <g className="m-shades">
        <path d="M40 51H8q-5 0-5 7" {...STROKE} strokeWidth="3" />
        <path d={LENS_LEFT + LENS_RIGHT} fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <rect x="64" y="50" width="9" height="3" fill={INK} />
        <g clipPath={`url(#${id}-l)`}>{glare(12)}</g>
        <g clipPath={`url(#${id}-r)`}>{glare(44)}</g>
      </g>
      {mood === 'bravo' ? <path d="M40 43l22 4M98 43l-22 4" {...STROKE} strokeWidth="3.5" /> : null}
      <path d={TOSTAO_MOUTH[mood]} {...STROKE} fill={mood === 'feliz' ? INK : 'none'} strokeWidth="3.5" />
      <path d="M101 78q8 0 9-10" {...STROKE} strokeWidth="4" />
      <circle className="m-toss" cx="110" cy="62" r="5.5" fill={YELLOW} stroke={YELLOW_DARK} strokeWidth="2" />
    </g>
  );
}

/** Retângulo: cartão preto que paira, com a tarja magnética cinza no meio e as presas saindo dela. A capa vermelha fica atrás: da gola só aparecem as pontas nos lados, curtas e arredondadas, e a capa desce 2 px mais larga que o cartão, com a barra em gomos. */
function Alucard({ mood }: { mood: Mood }) {
  return (
    <>
      <path d="M12.5 59Q12.5 56.5 15 57.5Q37 65 60 64Q83 65 105 57.5Q107.5 56.5 107.5 59Q107.5 67.5 102 73H18Q12.5 67.5 12.5 59z" fill={RED} />
      <path className="m-cape" d="M18 73V90.5a5.25 3.5 0 0 0 10.5 0a5.25 3.5 0 0 0 10.5 0a5.25 3.5 0 0 0 10.5 0a5.25 3.5 0 0 0 10.5 0a5.25 3.5 0 0 0 10.5 0a5.25 3.5 0 0 0 10.5 0a5.25 3.5 0 0 0 10.5 0a5.25 3.5 0 0 0 10.5 0V73z" fill={RED} />
      <rect x="20" y="34" width="80" height="54" rx="9" fill={INK} />
      <Eyes mood={mood} left={46} right={74} y={52} color="#fff" sly />
      <rect x="20" y="62" width="80" height="9" fill={STRIPE} />
      <path d="M51 71l3.5 8 3.5-8zM62 71l3.5 8 3.5-8z" fill="#fff" />
    </>
  );
}

/** Saco de dinheiro: corpo rosa simétrico de base reta e pescoço no meio. A amarra do saco é a cartola, toda preta (copa de topo reto e aba). Monóculo grande, focinho, bigode em duas gotas, gravata e rabo em laço de porco. */
function Warren({ mood }: { mood: Mood }) {
  return (
    <>
      <path className="m-tail" d="M100 86C114 86 122 80 120 72C118 64 109 64 109 71C109 77 118 78 123 70" fill="none" stroke={PINK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M50 44C30 48 12 68 12 88C12 102 22 108 36 108H84C98 108 108 102 108 88C108 68 90 48 70 44z" fill={PINK} />
      <g className="m-hat">
        <g transform="rotate(8 60 44)">
          <path d="M51 45L48.5 20Q48 17 51 17H71Q74 17 73.5 20L71 45z" fill={INK} />
          <rect x="40" y="41" width="40" height="7" rx="3.5" fill={INK} />
        </g>
      </g>
      <Eyes mood={mood} left={44} right={76} y={70} color={INK} />
      <g className="m-monocle" fill="none" stroke={INK}>
        <circle cx="76" cy="70" r="12" strokeWidth="2.5" fill="#fff" fillOpacity="0.35" />
        <path d="M86 78q6 9 3 20" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <ellipse cx="58" cy="82" rx="11" ry="8" fill={SNOUT} />
      <circle cx="54.5" cy="82" r="1.8" fill={INK} />
      <circle cx="61.5" cy="82" r="1.8" fill={INK} />
      {/* Bigode: uma gota de cada lado, redonda perto do focinho e afinando até a ponta virada para cima. */}
      <path
        className="m-stache"
        d="M60 92C60 85 70 84 74 89C78 93 82 92 86 88C84 96 76 100 68 99C63 98.5 60 96 60 92zM56 92C56 85 46 84 42 89C38 93 34 92 30 88C32 96 40 100 48 99C53 98.5 56 96 56 92z"
        fill={INK}
      />
      <path d="M58 103l-6-4v8zM58 103l6-4v8z" fill={INK} />
    </>
  );
}

// Gesto de cada um ao toque: a moeda gira, o cartão "passa", o cofrinho tira a cartola.
const CAST: Record<Character, { tap: string; Body: (props: { mood: Mood }) => ReactNode }> = {
  tostao: { tap: 'tap-flip', Body: Tostao },
  alucard: { tap: 'tap-swipe', Body: Alucard },
  warren: { tap: 'tap-hat', Body: Warren },
};

export function Mascote({ character = 'tostao', mood, size = 96 }: { character?: Character; mood: Mood; size?: number }) {
  const [taps, setTaps] = useState(0);
  const { tap, Body } = CAST[character];
  return (
    <button type="button" className="mascote-btn" aria-label={`${NAMES[character]}, humor ${mood}. Toque para ver a reação.`} onClick={() => setTaps((n) => n + 1)}>
      {/* A key muda a cada toque para a animação do gesto recomeçar do zero. */}
      <svg key={taps} className={`mascote c-${character} mood-${mood} ${taps ? tap : ''}`} viewBox="0 0 120 120" width={size} height={size} aria-hidden>
        <ellipse className="m-shadow" cx="60" cy="114" rx="26" ry="3.5" fill={INK} opacity="0.1" />
        <Aura mood={mood} />
        <g className="m-body">
          <Body mood={mood} />
        </g>
      </svg>
    </button>
  );
}

/** Cartão com o personagem de uma área e a fala dele; `children` vai embaixo da fala. */
export function MascoteFala({ character, mood, line, children }: { character: Character; mood: Mood; line: string; children?: ReactNode }) {
  return (
    <section className="card talk">
      <Mascote character={character} mood={mood} size={96} />
      <div className="grow">
        <p className="bubble side">{line}</p>
        {children}
      </div>
    </section>
  );
}

// Gera os ícones PNG do app (óculos e sorriso do Tostão, amarelos sobre preto) sem dependência externa.
// Uso: node web/scripts/icons.mjs   (rode de novo só se mudar o desenho)
// O favicon.svg tem o mesmo desenho escrito à mão: mudou aqui, mude lá.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = [22, 24, 29];
const YELLOW = [255, 194, 26];
const CENTER = [51, 62]; // ponto do desenho que vai para o meio do ícone
const SCALE = 0.94;
const SAFE_RADIUS = 48; // 40% de 120: fora desse círculo o sistema pode recortar o ícone (maskable)

const CURVE_STEPS = 12; // retas por curva

/** Curva quadrática em pontos, como o `q` do SVG. */
function curve([x0, y0], [cx, cy], [x1, y1]) {
  return Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
    const t = i / CURVE_STEPS;
    const a = (1 - t) ** 2;
    const b = 2 * t * (1 - t);
    return [a * x0 + b * cx + t * t * x1, a * y0 + b * cy + t * t * y1];
  });
}

// Medidas dos óculos e da boca de web/src/Mascote.tsx (viewBox 0..120).
// Cada forma: pontos ligados por um traço de pontas redondas; `fill` fecha a forma e pinta o miolo.
const SHAPES = [
  { pts: [[40, 51], ...curve([8, 51], [3, 51], [3, 58])], width: 3 }, // haste com o gancho da orelha
  { pts: [[38, 49], [66, 49], [63, 63], [42, 63]], width: 3, fill: true }, // lentes
  { pts: [[70, 49], [98, 49], [94, 63], [73, 63]], width: 3, fill: true },
  { pts: [[64, 51.5], [73, 51.5]], width: 3 }, // ponte
  { pts: curve([61, 77], [68, 82], [74, 75]), width: 3.5 }, // sorriso
];

for (const { pts, width } of SHAPES) {
  for (const [x, y] of pts) {
    assert(SCALE * (Math.hypot(x - CENTER[0], y - CENTER[1]) + width / 2) <= SAFE_RADIUS, `ponto ${x},${y} fora da zona segura`);
  }
}

// Lados de cada forma como pares de pontos, calculados uma vez; a fechada ganha o lado do último ponto de volta ao primeiro.
for (const shape of SHAPES) {
  const closed = shape.pts.map((a, i) => [a, shape.pts[(i + 1) % shape.pts.length]]);
  shape.sides = shape.fill ? closed : closed.slice(0, -1);
}

/** O ponto está a meio traço de algum lado? */
function onStroke(px, py, { sides, width }) {
  return sides.some(([[ax, ay], [bx, by]]) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy) <= width / 2;
  });
}

/** Regra par-ímpar: o ponto está dentro se uma linha dele para a direita cruza um número ímpar de lados. */
function inFill(px, py, { sides }) {
  let crossings = 0;
  for (const [[ax, ay], [bx, by]] of sides) {
    if (ay > py !== by > py && px < ax + ((py - ay) / (by - ay)) * (bx - ax)) crossings++;
  }
  return crossings % 2 === 1;
}

const inside = (px, py, shape) => onStroke(px, py, shape) || (shape.fill && inFill(px, py, shape));

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(zlib.crc32(body), body.length + 4);
  return out;
}

function png(size) {
  const SS = 4; // amostras por eixo, para suavizar as bordas
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // pixel -> coordenada do desenho
          const u = (((x + (sx + 0.5) / SS) / size - 0.5) * 120) / SCALE + CENTER[0];
          const v = (((y + (sy + 0.5) / SS) / size - 0.5) * 120) / SCALE + CENTER[1];
          const color = SHAPES.some((s) => inside(u, v, s)) ? YELLOW : BG;
          for (let c = 0; c < 3; c++) acc[c] += color[c];
        }
      }
      for (let c = 0; c < 3; c++) raw[row + 1 + x * 3 + c] = Math.round(acc[c] / (SS * SS));
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(OUT, name), png(size));
  console.log(name, size);
}

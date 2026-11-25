// Gera os ícones PNG do app (Tostão, a moeda amarela, sobre fundo escuro) sem dependência externa.
// Uso: node web/scripts/icons.mjs   (rode de novo só se mudar o desenho)
// shortcut: o ícone ainda é o Tostão redondo de olhos; o do app virou octógono de óculos. Refazer aqui quando o desenho fechar.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = [22, 24, 29];
const INK = [22, 24, 29];
const YELLOW = [255, 194, 26];
const RING = [232, 169, 0];

// Retângulo arredondado: [x, y, largura, altura, raio, cor]. Círculo = raio igual à metade do lado. Pintados em ordem.
const SHAPES = [
  [16, 14, 88, 88, 44, YELLOW], // moeda
  [24.5, 22.5, 71, 71, 35.5, RING], // friso
  [27.5, 25.5, 65, 65, 32.5, YELLOW],
  [42.5, 49, 9, 14, 4.5, INK], // olhos
  [68.5, 49, 9, 14, 4.5, INK],
];

function inside(px, py, [x, y, w, h, r]) {
  const dx = Math.max(Math.abs(px - (x + w / 2)) - (w / 2 - r), 0);
  const dy = Math.max(Math.abs(py - (y + h / 2)) - (h / 2 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

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
  const scale = 0.62; // mascote ocupa 62% do ícone: sobra margem para o recorte do sistema (maskable)
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // pixel -> coordenada do desenho (0..120), centralizado
          const u = (((x + (sx + 0.5) / SS) / size - 0.5) / scale + 0.5) * 120;
          const v = (((y + (sy + 0.5) / SS) / size - 0.5) / scale + 0.5) * 120 + 4;
          let color = BG;
          for (const s of SHAPES) if (inside(u, v, s)) color = s[5];
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

// Taxas de referência do Banco Central (API pública SGS, sem chave).
// Usadas nos simuladores: quanto rende investir, quanto custa o rotativo do cartão.
const SERIES = {
  selic: 432, // Selic meta, % a.a.
  cdi: 4389, // CDI anualizado base 252, % a.a.
  ipca12: 13522, // IPCA acumulado em 12 meses, %
  poupancaMes: 196, // poupança, % a.m.
  rotativoMes: 25477, // juros do rotativo do cartão, % a.m.
  parceladoMes: 25478, // juros do parcelamento de fatura, % a.m.
};

// Valores de novembro/2026, usados só se a API do BC estiver fora do ar.
const FALLBACK = { selic: 13.75, cdi: 13.65, ipca12: 4.63, poupancaMes: 0.62, rotativoMes: 15.29, parceladoMes: 9.37 };
const TTL_MS = 12 * 3600_000;

let cache = null;

function parseBrDate(s) {
  const [d, m, y] = s.split('/').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getTime();
}

const brDay = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

async function latest(code) {
  // Consulta por intervalo terminando hoje. O atalho "ultimos/N" não serve: a Selic meta (432)
  // já vem preenchida até o próximo Copom, e os N últimos podem ser todos datas futuras.
  // 200 dias cobrem as séries mensais, que saem com 2 a 3 meses de atraso.
  const end = new Date();
  const start = new Date(end.getTime() - 200 * 86400_000);
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${brDay(start)}&dataFinal=${brDay(end)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok || !String(res.headers.get('content-type')).includes('json')) throw new Error(`BCB ${code}: HTTP ${res.status}`);
  const now = Date.now();
  // A ordem da resposta varia: ordena e fica com o valor mais recente que não esteja no futuro.
  const rows = (await res.json())
    .map((r) => ({ at: parseBrDate(r.data), value: Number(r.valor) }))
    .filter((r) => Number.isFinite(r.value) && r.at <= now)
    .sort((a, b) => b.at - a.at);
  if (!rows.length) throw new Error(`BCB ${code}: sem dados`);
  return rows[0].value;
}

export async function market() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const entries = await Promise.all(
    Object.entries(SERIES).map(async ([key, code]) => {
      try {
        return [key, await latest(code), true];
      } catch {
        return [key, FALLBACK[key], false];
      }
    }),
  );
  const data = {
    ...Object.fromEntries(entries.map(([k, v]) => [k, v])),
    // false = pelo menos uma taxa veio do valor guardado, não do BC.
    live: entries.every(([, , ok]) => ok),
    asOf: new Date().toISOString(),
  };
  // Só guarda em cache quando veio tudo do BC; senão tenta de novo na próxima chamada.
  if (data.live) cache = { at: Date.now(), data };
  return data;
}

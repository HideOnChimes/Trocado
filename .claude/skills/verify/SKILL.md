---
name: verify
description: Como subir e verificar o Trocado (app de finanças): build, checagens baratas, ferramentas de E2E e mapa de features. Use antes de dar uma mudança como pronta.
---
# Verificar o Trocado

## Subir o app
- Na raiz: `npm run build` (tsc -b + vite, gera `web/dist`) e depois `npm start` (serve API + `web/dist` em http://localhost:3333).
- Sem `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` em `server/.env` o servidor sobe em **modo demo** (dados falsos, nada salvo). Não ler nem editar `server/.env`.
- Sem `APP_PASSWORD` não há tela de senha; `Login.tsx` só é visto por leitura do código.

## Checagens baratas
- `npm run build`: tipos + bundle; o tamanho do JS sai no log do vite.
- `npx oxlint` em `web/`: hoje 5 avisos antigos em `ui.tsx`/`store.tsx`.
- `curl -s localhost:3333/api/data` (modo demo) e `curl -s localhost:3333/` (título, nome do JS do build).
- Ícones: `node web/scripts/icons.mjs` (~20 s, Node 24) regenera os três PNG byte a byte e falha (assert) se o desenho sair da zona segura. Para não tocar em `web/public`, copie o script para `<tmp>/scripts/` e ele escreve em `<tmp>/public/`.
- Bundle da base: copie `.verify-loop/<tarefa>/base/web` para fora, ligue `node_modules` por junção a `web/node_modules` e rode `npx vite build --outDir <tmp>`.

## E2E
- ferramenta: browser pane apontando para http://localhost:3333 (servidor subido à mão, ver acima).
- navegação por hash: `#painel` (Início), `#transacoes`, `#orcamento`, `#investir`, `#mais`, `#recorrentes`, `#metas`, `#contas`. Hash desconhecido cai no Início. Não existe mais tela de personagens.
- mapa de features: `features.md` (nesta pasta, quando existir).

## Pegadinhas
- A prévia do app (`preview_start` com `.claude/launch.json`) sobe o servidor da **pasta antiga de rascunho**, não desta. Nesta pasta o que funcionou foi `npm run build` + `npm start` na raiz.
- Porta 3333 pode já estar ocupada por um servidor desta pasta: confira com `curl` antes de subir outro, e não derrube o que já está rodando.
- `npm install` em `server/` reescreve o nome em `server/package-lock.json`; desfazer se a tarefa não mexe no servidor.
- "Tostão" é o personagem (moeda, `aria-label` do mascote); o app é "Trocado". Não fazer replace global.

# Tostão

App de controle financeiro para o telefone, feito para gastar menos e investir mais. Os dados vêm dos
seus bancos pelo Open Finance (via Pluggy): nada de lançamento manual. É um site que se instala na
tela inicial do celular (abre em tela cheia, com ícone) e roda num servidor seu.

```
web/      o app (Vite + React)
server/   servidor: guarda a chave do Pluggy, o banco de dados e entrega o app
Dockerfile, fly.toml   para publicar na nuvem
```

Três personagens comentam o seu mês: **Tostão** (a moeda, tela inicial), **Alucard** (o cartão vampiro,
em Fixos e parcelas) e **Warren Bufê** (o cofrinho de cartola e monóculo, em Investir). Toque neles.

## Rodar no computador

```
npm run build     # gera o app (primeira vez e depois de mexer em web/)
npm start         # abre em http://localhost:3333
```

Sem chaves do Pluggy sobe em **modo demonstração**: 12 meses de dados falsos, nada é salvo.
Sem `APP_PASSWORD` não há login e o servidor só responde ao próprio computador.

## Publicar na nuvem (para usar no telefone, de qualquer lugar)

Não testado nesta máquina (sem Docker e sem CLI do Fly aqui). Passos para o Fly.io; qualquer
hospedagem que rode um `Dockerfile` com volume serve (Railway, por exemplo).

1. Crie conta em https://fly.io e instale o `flyctl` (https://fly.io/docs/flyctl/install/).
2. Em `fly.toml`, troque `app = "troque-este-nome"` por um nome só seu.
3. No terminal, na pasta do projeto:
   ```
   fly auth login
   fly apps create <nome>
   fly volumes create dados --region gru --size 1
   fly secrets set APP_PASSWORD=<senha com 12+ caracteres> PLUGGY_CLIENT_ID=<id> PLUGGY_CLIENT_SECRET=<segredo>
   fly deploy
   ```
4. Abra `https://<nome>.fly.dev` no celular, entre com a senha e instale:
   - **iPhone (Safari):** Compartilhar > Adicionar à Tela de Início.
   - **Android (Chrome):** menu ⋮ > Instalar app (ou Adicionar à tela inicial).

Custo: máquina pequena (256 MB) mais 1 GB de volume, alguns dólares por mês; a máquina desliga
sozinha quando ninguém usa e liga no primeiro acesso, então costuma sair menos. Confira o preço atual
no site do Fly. Sem as chaves do Pluggy o app publicado sobe em modo demonstração.

## Ligar nos bancos de verdade (Meu Pluggy, gratuito para uso pessoal)

1. Crie conta em https://meu.pluggy.ai e conecte ali cada banco (Nubank, Itaú, Bradesco, Santander,
   Inter, C6...). O login acontece no próprio banco, via Open Finance.
2. Crie conta em https://dashboard.pluggy.ai (começa um teste de 15 dias; segundo o Pluggy, a leitura
   via Meu Pluggy continua depois).
3. No dashboard, crie uma aplicação e ative o conector **MeuPluggy** nela.
4. Ponha `client_id` e `client_secret` em `server/.env` (local) ou em `fly secrets set` (nuvem).
5. No app: **Mais** > **Contas e ajustes** > **Conectar banco** > **MeuPluggy**. Uma vez por banco.

Plano B, se o passo 5 falhar no celular: autorize pelo "Demo application" do dashboard, copie o ID do
item criado e defina `PLUGGY_ITEM_IDS`.

Na primeira sincronização o app busca 12 meses. Depois atualiza a cada 6 horas e toda vez que o
servidor liga (o Meu Pluggy renova os dados uma vez por dia). O histórico fica em
`server/data/financas.db` para sempre.

## Telas

| Tela | Para quê |
|---|---|
| **Início** | "Pode gastar": quanto sobra do gasto livre do mês, já com investimento e fixos separados, e a barra de ritmo (o risco é hoje). Tostão comenta. O mês em uma conta, 3 sinais, aporte, avisos; gráficos em "Mais números". |
| **Extrato** | Busca, troca de categoria (toque no lançamento), regra "classificar sempre assim", ignorar. |
| **Limites** | Divisão da renda (essencial / estilo de vida / investido) e tetos em poucas categorias. |
| **Investir** | Warren Bufê cobra o aporte. Carteira, simulador com IR, independência financeira, taxas do Banco Central. |
| **Mais > Fixos e parcelas** | Alucard vigia fatura e juros. Assinaturas e contas detectadas sozinhas, aumento de preço, parcelas. |
| **Mais > Metas** | Reserva de emergência em meses e metas com valor e prazo. |
| **Mais > Contas e ajustes** | Bancos conectados, meta de investimento, regras, sair. |
| **Mais > Personagens** | Vitrine: os três personagens em todos os humores. |

## Como as contas são feitas

- **Gasto**: saída de conta e compra no cartão. Ficam de fora transferência entre contas suas,
  pagamento de fatura (as compras já contaram) e aplicação/resgate de investimento. Estorno no cartão
  abate o gasto da categoria.
- **Pode gastar** = renda do mês − meta de investimento − fixos e parcelas − gasto livre até hoje.
  Renda = mediana das entradas dos 3 últimos meses fechados (ou o valor que você fixar em Ajustes).
- **Ritmo**: gasto livre até hoje contra o plano do mês espalhado igual pelos dias. Mais de 10% do
  plano à frente = "acima do ritmo".
- **Fixo / assinatura**: mesma cobrança, uma vez por mês, em dia e valor parecidos, por 3 meses ou
  mais. Assinatura = valor fixo no cartão. **Aumento de preço**: subiu mais de 5% e mais de R$ 2.
- **Projeção do mês**: gasto até hoje + o que você costuma gastar no resto do mês (média de 3 meses).
- **Aporte**: saída de conta classificada como Investimentos.
- **Reserva de emergência**: saldo em conta + renda fixa, dividido pelos gastos essenciais mensais.
- **Independência financeira**: 25 vezes o gasto anual; prazos com 4% ao ano acima da inflação.
- **Simulador**: CDI e IPCA atuais do Banco Central, IR pela tabela regressiva (22,5% a 15%).

As escolhas de desenho (número único comparado ao seu passado, investir antes de gastar, poucos tetos,
revisão de assinaturas) vêm de pesquisa: Levi 2025, Thaler e Benartzi 2004, Lukas e Howard 2023,
Gargano e Rossi 2024, Einav et al. 2025.

A mesma pesquisa desaconselha tom de bronca (Gladstone et al. 2021). Os mascotes julgam mesmo assim:
foi escolha do dono do app, que pediu "mascote que me julga". Sequência de dias e comparação com
outras pessoas continuam de fora.

## Segurança

- **Local (padrão):** só escuta em `127.0.0.1` e recusa chamadas que não venham de página local.
- **Nuvem (`HOST=0.0.0.0`):** não sobe sem `APP_PASSWORD` de 12+ caracteres. Toda a API exige sessão;
  o cookie é `HttpOnly; Secure; SameSite=Strict` e vale 30 dias; o banco guarda só o hash da sessão.
  8 senhas erradas em 15 minutos travam o login por 15 minutos (para todo mundo, inclusive você).
  Chamadas vindas de outro site são recusadas. "Sair de todos os aparelhos" derruba todas as sessões.
- `server/.env` (chaves) e `server/data/` (seus dados) ficam fora do repositório e fora da imagem Docker.
- A senha do banco nunca passa pelo app: a autorização é feita no próprio banco.
- Na nuvem seus dados financeiros ficam no servidor da hospedagem, protegidos pela sua senha: use uma
  senha longa e única.

## Limites

- Ainda não testado com conta Pluggy real nem publicado: categorias, parcelas, investimentos e o
  fluxo de conexão dentro do app instalado podem precisar de ajuste.
- Sem modo offline: o app precisa do servidor para abrir os dados.
- Detecção de recorrentes precisa de 3 meses de histórico.
- Aporte só é reconhecido se o banco classificar a saída como investimento; se não, troque a
  categoria no Extrato e crie a regra.
- Metas têm valor guardado informado à mão.
- Não é recomendação de investimento: os simuladores comparam cenários, não preveem retorno.

## Mexer nos mascotes

Formas em `web/src/Mascote.tsx`, movimento em `web/src/index.css` (seção "mascotes"), falas em
`web/src/engine.ts` (`mascotMood`, `cardMood`, `investMood`). Ícones do app: `node web/scripts/icons.mjs`.

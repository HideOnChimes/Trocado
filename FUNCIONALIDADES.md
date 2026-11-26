# Trocado: o que tem, como usa, o que falta

Feito em 26/11/2026 a partir de três levantamentos: leitura do código tela por tela, pesquisa de
funcionalidades de outros apps e pesquisa de como apresentar (fontes no fim). Serve para a gente
decidir junto o que fica, o que muda e o que entra. Nada aqui foi aplicado no app ainda.

Legenda: **sozinho** = o app faz sem você; **você** = depende de você.

## 0. O que já saiu desta lista (feito em 26/11/2026)

A lista das seções 1 a 4 é a foto de antes. Depois dela entraram no app:

| Função | Onde fica | Como usa |
|---|---|---|
| **Até o próximo salário** (sozinho) | Início | Estima o saldo da conta corrente dia a dia até o salário: menor saldo no caminho, próximas contas e fatura. Avisa "vai faltar" se ficar negativo. É estimativa. |
| **Pague-se primeiro** (sozinho) | Início | Nos 5 dias depois de o salário cair, o primeiro aviso é quanto investir agora; o Tostão fala disso. |
| **Comprometido nos próximos meses** (sozinho) | Mais > Fixos e parcelas | Gráfico de 6 meses com fixos e parcelas já contratados e quanto isso é da renda. |
| **Posso comprar?** (você) | Mais > Fixos e parcelas | Digite valor, parcelas e juros ao mês: compara à vista com parcelado e diz se cabe, aperta ou não cabe, com o custo de deixar de investir. |
| **Teto que passa para o mês seguinte** (sozinho) | Limites | O que sobrou ou estourou de um teto no mês passado soma ou desconta do teto deste mês (só para teto que já existia no mês passado). |
| **Fechamento do mês** (sozinho) | Início | Nos 10 primeiros dias do mês aparece "Como fechou [mês]": entrou, gastou, investiu, sobrou, maiores categorias. Depois fica dentro de "Mais números". |
| **Mês que começa no dia do salário** (você) | Mais > Contas e ajustes | "Dia em que seu mês começa": de 1 a 28. O app passa a contar o mês desse dia até a véspera dele no mês seguinte. O extrato continua por mês do calendário. |
| **Esconder valores** (você) | Botão de olho no topo de toda tela | Todo valor em reais vira "R$ •••". Fica guardado no aparelho. |
| **Exportar lançamentos** (você) | Mais > Contas e ajustes | Baixa um arquivo que abre no Excel com todos os lançamentos. |
| **Rendimento da carteira** (sozinho) | Investir | Cada investimento com taxa mostra quanto rende ao ano hoje e quanto fica acima da inflação; a carteira mostra o rendimento acumulado. |

Ficou de fora, com motivo: **imposto e taxas pagos nos investimentos** (o app não recebe essas
movimentações do banco; a confirmar com conta real) e **empréstimos e financiamentos** (você pediu
para deixar). O redesenho de PC e telefone da seção 4 continua esperando sua decisão.

---

## 1. O que o app tem hoje e como usar

### Início
| O que é | Como usa |
|---|---|
| **Tostão e a fala dele** (sozinho) | Comenta o mês: feliz, neutro, preocupado ("acima do ritmo") ou bravo ("estourou"). Toque nele e ele gira. |
| **Pode gastar** (sozinho) | Número grande: renda − meta de investimento − fixos e parcelas − o que já gastou no dia a dia. Nunca mostra negativo. |
| **Barra de ritmo** (sozinho) | Quanto do dinheiro do dia a dia já foi. O risco marca onde o plano estaria hoje. Embaixo: dias que faltam e quanto dá por dia. |
| **O mês em uma conta** (sozinho) | A conta aberta: entra, investir primeiro, fixos e parcelas, dia a dia, sobra. |
| **Seu mês em 3 sinais** (sozinho) | Três vistos: gastar menos do que ganha, investir no mês, zero juros e tarifas. |
| **Aporte do mês** (sozinho) | Quanto já investiu contra a meta, e se dá para mandar mais agora. |
| **O que merece atenção** (sozinho) | Até 11 tipos de aviso: categoria acima ou abaixo do normal, assinatura que ficou mais cara, mesma loja muitas vezes, muitas compras pequenas, juros e tarifas, parcela acabando, dinheiro parado na conta, saldo que não cobre o que falta pagar, aporte que não saiu, meta batida. "Ok, vi" esconde até o mês seguinte. |
| **Mais números** (você abre) | Botão que abre: gasto do dia a dia até hoje contra o mês passado, sua média, saldo real da conta, patrimônio, e três gráficos (ritmo dos gastos, 12 meses de receitas x gastos x investido, patrimônio). |

### Extrato
| O que é | Como usa |
|---|---|
| **Trocar de mês, buscar, filtrar por categoria** (você) | Setas do mês, campo de busca, lista de categorias. |
| **Lista por dia** (sozinho) | Cada lançamento com categoria, banco e conta. Selos: parcela 3/10, pendente, não conta como gasto, ignorada. |
| **Corrigir categoria** (você) | Toque no lançamento, escolha a categoria (ou crie uma). Dá para voltar para a automática. |
| **Regra "classificar sempre assim"** (você) | Depois de corrigir, o app pergunta se vale para sempre. Vale para o passado e o futuro. |
| **Ignorar / considerar** (você) | Tira o lançamento de todas as contas (ou devolve). |

### Limites
| O que é | Como usa |
|---|---|
| **Para onde vai sua renda** (sozinho) | Barra com essenciais, estilo de vida, investido e sobra, comparada à referência 50/30/20. |
| **Tetos por categoria** (você) | Digite um teto em qualquer categoria. A barra mostra o gasto do mês e onde você costuma estar nesta altura. |
| **Sugerir tetos** (você toca) | O app cria até 3 tetos, 15% abaixo da sua média, nas categorias de estilo de vida. |
| **Essencial ou estilo de vida** (você) | Botão em cada categoria. Muda a divisão da renda, a reserva e os avisos. |

### Investir
| O que é | Como usa |
|---|---|
| **Warren Bufê e a fala dele** (sozinho) | Cobra o aporte. Toque e ele tira a cartola. |
| **Quatro números** (sozinho) | Total investido, aporte do mês contra a meta, aporte médio de 6 meses, sobra projetada do mês. |
| **Carteira** (sozinho) | O que o banco informa: tipo, taxa, vencimento, rendimento, saldo. Avisa se passar de R$ 250 mil no mesmo emissor. |
| **Simulador de aporte mensal** (você) | Digite aporte, anos e % do CDI: mostra bruto, líquido de imposto e em dinheiro de hoje. |
| **Independência financeira** (sozinho) | Quanto falta para ter 25 vezes o gasto anual, e em quantos anos. |
| **Quanto custa um gasto mensal** (você) | Digite um gasto: mostra quanto viraria em 1, 5, 10 e 20 anos se fosse investido. |
| **Taxas de referência** (sozinho) | Selic, CDI, inflação, rotativo do cartão, direto do Banco Central. |

### Mais > Fixos e parcelas
| O que é | Como usa |
|---|---|
| **Alucard e a fala dele** (sozinho) | Fica bravo com juros ou fatura perto do limite. Toque e ele "passa" como cartão. |
| **Quatro números** (sozinho) | Comprometido por mês, assinaturas por ano, falta pagar em parcelas, falta pagar neste mês. |
| **Assinaturas** (sozinho) | Detectadas sozinhas: por mês, por ano, quanto viraria em 10 anos, e aviso se subiu de preço. |
| **"Ainda vale a pena?"** (você) | "Sim, manter" marca a assinatura como revisada no trimestre. |
| **Contas fixas e compras parceladas** (sozinho) | O que já pagou e o que falta, parcela N de T, quando termina. Gráfico das parcelas nos próximos meses. |

### Mais > Metas
| O que é | Como usa |
|---|---|
| **Reserva de emergência** (sozinho) | Conta + poupança + renda fixa, dividido pelos gastos essenciais: quantos meses você aguenta. |
| **Suas metas** (você) | Crie com nome, valor e prazo. "Guardei" soma ao valor guardado, que é digitado. Dá para excluir, não dá para editar. |

### Mais > Contas e ajustes
| O que é | Como usa |
|---|---|
| **Bancos conectados** (você conecta) | Conectar, atualizar agora, remover. Mostra estado de cada banco e contas. |
| **Ajustes do plano** (você) | Meta de investimento (%), renda mensal (vazio = o app calcula), meses de reserva. |
| **Regras de categoria** (você) | Lista das regras criadas, com excluir. |
| **Sair de todos os aparelhos** (você) | Só aparece quando o servidor tem senha. |

### Mais
Atalhos para as três telas acima, a lista "o que o app pega sozinho / o que depende de você" e o
horário da última atualização.

### Vale para todas as telas
Tela de senha (se o servidor tiver senha), modo demonstração (sem chave do banco: dados falsos),
aviso de "nenhum banco conectado", busca nos bancos a cada 6 horas.

---

## 2. Onde confunde (do mais grave ao menos)

1. **"Pode gastar" não mostra de onde vem e tem três nomes** ("Pode gastar", "Sobra para gastar", "livre para gastar"). Quando estoura, o número grande trava em R$ 0 e o bloco de baixo mostra negativo.
2. **Palavras difíceis sem explicação:** gasto livre, ritmo, sinais, aporte, teto, saldo real, patrimônio líquido, independência financeira, juro real, CDI, rotativo, FGC, mediana.
3. **Não tem primeiro uso guiado.** O app assume renda e meta de 20% sem perguntar. Na demonstração, o caminho para dados reais fala de arquivo de configuração e chave.
4. **Início tem coisa demais e nada se destaca.** O aporte aparece em três lugares. O visto "investir neste mês" acende com R$ 1.
5. **O mesmo risco na barra quer dizer coisas diferentes:** no Início é "o plano de hoje", em Limites é "onde você costuma estar".
6. **Limites, Início e Fixos se repetem**, e a aba chama "Limites" mas fala de "tetos". A divisão da renda diz "3 meses" e usa 6 no investido.
7. **Limites é uma lista longa:** toda categoria tem botão e campo, mesmo sem teto. O botão essencial/estilo de vida parece etiqueta.
8. **Coisas importantes escondidas em "Mais":** Metas e Fixos (onde mais se corta gasto). O Warren manda ir "em Ajustes", que não existe com esse nome.
9. **Ações sem retorno:** ajustes e tetos gravam sem dizer "salvo". Ignorar, manter, "ok, vi", guardei e excluir regra não pedem confirmação nem deixam desfazer.
10. **No Extrato, "saldo" não é saldo:** é a soma do mês filtrado. A busca procura em "nota", mas não há onde escrever nota.
11. **Investir mistura carteira, aula e simulador** numa tela só.
12. **Metas:** não dá para editar, e o valor guardado não se liga a nenhum dinheiro real.
13. **Telas vazias não dizem quando vão encher** (só assinaturas diz "3 meses").
14. **Nada avisa que dá para tocar nos personagens.**
15. **No PC não aproveita a tela:** coluna de telefone no meio, tabelas rolando de lado, gráficos pequenos.

---

## 3. O que poderia ter

### Vale fazer primeiro
| Funcionalidade | O que é | Por quê | Tamanho |
|---|---|---|---|
| **Saúde da conexão** | "Atualizado há X horas", aviso de banco desconectado, aviso de autorização vencendo | Dado errado ou parado é a reclamação número 1 em apps do tipo. A autorização do banco vence em 1 ano e o app pararia calado. | pequeno |
| **Fila "para conferir" e resumo da semana** | Lançamentos novos para você confirmar de um toque; uma vez por semana, o que mudou | Quem acompanha com regularidade gasta menos (estudo com dados de app). Categoria certa deixa os limites certos. | pequeno |
| **Comprometido nos próximos meses** | Soma das parcelas e fixos mês a mês, antes de você parcelar de novo | O app já tem os dados. Freia parcela nova. | pequeno |
| **Saldo até o próximo salário** | Projeção dia a dia com contas a vencer, com aviso de "vai faltar" | Evita rotativo e cheque especial. É o que os apps pagos cobram a mais. | médio |
| **"Pague-se primeiro"** | No dia do salário, lembrete com o valor do aporte já calculado | Automatizar o investimento é o que mais tem evidência de funcionar. O app não pode mover dinheiro, então o lembrete é o mais perto disso. | pequeno |
| **Aviso de rotativo e cheque especial** | Alerta quando entrar em juros caros | O app já mostra a taxa; falta o aviso na hora. | pequeno |
| **Metas ligadas a dinheiro real** | A meta acompanha uma caixinha ou investimento em vez de valor digitado | Tira o último lançamento manual do app. Falta confirmar como as caixinhas chegam do banco. | médio |
| **Avisos no telefone** | Notificação de gasto grande, limite em 80%, cobrança nova, fatura vencendo | Aviso que ninguém abre não existe. Precisa do servidor publicado. | médio |

### Vale fazer depois
- **Mês que começa no dia do salário:** para quem recebe dia 5 ou 20, o mês do calendário distorce o "pode gastar".
- **Sobra ou estouro do limite passa para o mês seguinte:** limite que zera todo mês perde força.
- **Rendimento da carteira contra CDI e inflação, e quanto pagou de imposto e taxa no ano.**
- **Empréstimos e financiamentos:** saldo devedor, custo total, parcelas restantes (sobe de prioridade se houver dívida).
- **Simulador "e se eu comprar isto?":** quanto atrasa a meta ou a independência.
- **Esconder valores** (para abrir em público) e **exportar seus dados**.
- **Fechamento do mês:** o mesmo resumo da semana, mensal.

### Baixa prioridade
Rebalancear carteira, "ano em revisão", conversa com inteligência artificial sobre seus dados,
resumo para a declaração de imposto, bens digitados à mão (carro, imóvel).

### Não fazer
- **Orçamento "todo real tem função":** exige ritual diário, contradiz "sem lançamento manual".
- **Cálculo de imposto de bolsa:** a B3 já oferece de graça, e erro tem consequência fiscal.
- **Medalhas e sequência de dias:** sem evidência de que mudam gasto.
- **Cancelar ou negociar contas, transferência automática:** exigem operação humana ou licença.
- **Casal, dividir despesas:** o app é de uma pessoa.
- **Dezenas de gráficos:** num experimento com 9 mil pessoas, mais uso do app não mudou o gasto.

### Um alerta sobre o número principal
Um estudo (Universidade do Arizona) indica que mostrar "quanto ainda pode gastar" pode empurrar o
gasto para cima. Só o resumo foi lido, é uma fonte só, então é sinal de atenção e não certeza. O
"Pode gastar" do Trocado já desconta o investimento antes, o que ajuda. Proposta: mostrar junto o
ritmo e o que falta investir, nunca o número sozinho.

---

## 4. Como apresentar

### O que os apps bem avaliados fazem em comum
1. Um número principal no topo, sempre com o ritmo do mês.
2. Uma fila de coisas para conferir.
3. O que vem pela frente (contas e parcelas).
4. Comparação com o mesmo dia do mês passado (não com o mês fechado).
5. O resto (gráficos, categorias, patrimônio) mora em telas próprias, não no Início.

### Regras para o Trocado
- **Um foco por tela.** Juntar "3 sinais" e "avisos" num bloco só, com até 3 itens, que some quando está vazio.
- **Mostrar a conta colada no número.** Logo abaixo de "Pode gastar": renda − investir − fixos − já gasto. Tocar abre a conta inteira. Número em que a pessoa não confia deixa de ser usado.
- **Um nome para cada coisa**, palavra do dia a dia. "Aporte" vira "investir este mês"; "teto" vira "limite"; "gasto livre" vira "gasto do dia a dia". O termo que sobrar ganha um "?" com uma frase.
- **Sempre valor e prazo concretos:** "faltam R$ 320 para 12 dias", não "73%".
- **Personagem:** uma frase por tela, sempre com um número real, ao lado do número principal e nunca na frente dele. Notícia ruim de verdade (conta atrasada) vira texto neutro.
- **Retorno em toda ação:** "Salvo · Desfazer" no rodapé.
- **Primeiro uso:** lista curta no Início até completar (conectar banco, conferir fixos, escolher quanto investir, criar uma meta). Depois some.
- **Tela vazia sempre diz o que falta e quando vai aparecer.**
- **Cor:** amarelo para uma coisa só por tela. Gasto sem cor, entrada com "+" e verde, vermelho só para "passou do limite".

### Estrutura proposta
**Telefone, 5 abas (as mesmas):** Início · Extrato · Limites · Investir · Mais.

**Início no telefone, de cima para baixo:**
1. Personagem pequeno + uma frase com número.
2. **Pode gastar** + a conta numa linha + "?".
3. Barra de ritmo: "dia 18 de 30, R$ 150 abaixo do plano".
4. **Para você ver:** até 3 itens (junta sinais e avisos).
5. Próximas contas e parcelas (7 dias).
6. Investir este mês: guardado X de Y.
7. Este mês contra o mesmo dia do mês passado, e "ver mais números".

**PC, menu lateral fixo:** Início · Extrato · Limites · Fixos e parcelas · Investir · Metas · (no rodapé) Contas e ajustes. Tudo que no telefone fica em "Mais" sobe para o menu.

**Início no PC, duas colunas:** à esquerda os itens 1 a 4 e o gráfico de ritmo sempre visível; à direita próximas contas, investir, comparação com o mês passado e as 5 maiores categorias.

**Extrato no PC:** tabela com filtros no topo (mês, conta, categoria, busca), valores alinhados à direita, detalhe do lançamento num painel ao lado.

**O que fica igual nos dois:** nomes, ordem do Início, a mesma conta no número principal, cores e lugar do personagem.

---

## 5. A confirmar com conta real
- Se o Meu Pluggy entrega faturas, empréstimos e movimentações de investimento (a documentação dele só garante contas e lançamentos).
- Como as caixinhas do Nubank e do Inter chegam (como investimento ou como conta).

## 6. Fontes principais
- Copilot Money, tela inicial: https://intercom.help/copilotmoney/en/articles/6045480-dashboard-tab-overview
- Monarch, guia e revisão de transações: https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-Guide
- YNAB, tela inicial: https://www.ynab.com/blog/8-ways-your-budget-just-got-better
- Nubank, como criou as abas: https://building.nubank.com/how-we-created-tabs/
- Nielsen Norman Group, menu escondido: https://www.nngroup.com/articles/hamburger-menus/
- Nielsen Norman Group, revelação progressiva: https://www.nngroup.com/articles/progressive-disclosure/
- Nielsen Norman Group, telas vazias: https://www.nngroup.com/articles/empty-state-interface-design/
- Zurb, por que produto financeiro perde confiança: https://zurb.com/blog/why-financial-products-work-but-still-lose-trust
- St Andrews, orçamento reduz gasto: https://news.st-andrews.ac.uk/archive/dont-abandon-your-budget-it-works-says-university-of-st-andrews-research/
- Experimento Clarity Money (uso não mudou gasto): https://finsights.guide/case-studies/GfCI1P8I/clarity-money-budgeting-experiment
- "Quanto sobra" pode aumentar gasto: https://behavioraleconomics.com/the-budgeting-app-trap-when-spending-information-backfires
- Thaler e Benartzi, poupar mais amanhã: https://www.anderson.ucla.edu/faculty/shlomo.benartzi/savemore.htm
- Pluggy, uso pessoal: https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use.md
- Material Design, tema escuro: https://m2.material.io/design/color/dark-theme

Limites da pesquisa: várias resenhas de apps são de sites que ganham comissão; dois estudos
acadêmicos não abriram e só o resumo foi usado; não achei material bom sobre as abas atuais de
Mobills e Organizze.

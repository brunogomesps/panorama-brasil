# Panorama Brasil

Painel web local com indicadores socioeconômicos dos 27 estados e das 5 regiões do Brasil, cruzados com as eleições presidenciais e de governador de **2002 a 2026**. Todos os dados vêm de fontes oficiais (IBGE, TSE, Ministério da Saúde, Banco Central). O visual e os modelos de análise seguem como referência os painéis da Cubo Três (politica.one, eleicoes.cubotres.com.br), com implementação própria.

Cada indicador diz **se subir é bom ou ruim** (polaridade): selo "↑ Maior é melhor", "↓ Menor é melhor" ou "Neutro" com a justificativa na dica, variações escritas como "melhorou/piorou", mapas com verde-azulado (melhor) e laranja (pior), rankings com 1º = melhor.

**Ver online:** https://brunogomesps.github.io/panorama-brasil/  
**Código:** https://github.com/brunogomesps/panorama-brasil

> **Aviso.** Projeto pessoal e independente, sem vínculo com partido, governo, instituto de pesquisa ou com a Cubo Três (usada só como referência visual). Os números vêm de fontes oficiais e cada conteúdo pesquisado traz a sua fonte. Encontrou um erro ou uma fonte melhor? Abra uma *issue* com o link.

## Como abrir

| Jeito | Como |
|---|---|
| Online | Link acima (GitHub Pages). Nada a instalar. |
| Mais simples, no computador | Abrir `web/index.html` no navegador (Chrome ou Edge). Funciona sem servidor. |
| Com servidor local | Dar dois cliques em `iniciar.bat` (precisa do Node.js) ou rodar `node server.js` e acessar http://localhost:8080 |

As fontes tipográficas (Raleway e Noto Sans) vêm do Google Fonts; sem internet, o painel usa as fontes do sistema. As bibliotecas (D3 7.9.0, ApexCharts 3.54.1, topojson-client 3.1.0) estão em `web/vendor/`.

## Abas

| Aba | O que responde |
|---|---|
| Início | Indicadores principais do Brasil, resultado de 2026, as 5 regiões lado a lado |
| Mapa e ranking | Mapa (ou cartograma em grade) e ranking dos estados para qualquer indicador e ano; convergência entre estados |
| Estados | Ficha completa da UF: pontos fortes e de atenção, posição em cada indicador, histórico eleitoral |
| Regiões | Evolução por região, convergência beta, peso de cada região na população, PIB e eleitorado |
| Séries históricas | Até 6 lugares no mesmo gráfico, valor ou base 100, quem melhorou e quem piorou; começa pela pior região e pelo pior estado do indicador |
| Eleições | Resultado por ano e turno, mapa de quem liderou, saldo de votos por estado, histórico 2002–2026, viradas, participação |
| Governadores | Eleitos em cada UF de 2002 a 2026, por partido ou campo político |
| Municípios | Voto de qualquer candidato (padrão: o 1º colocado) nos 5.570 municípios × PIB per capita, urbanização, setor público |
| Correlações | Matriz de correlação, dispersão com regressão, regressão múltipla, voto retrospectivo |
| Índice composto | Índice configurável (indicadores + pesos) que usa a polaridade para orientar cada indicador |
| Economia nacional | PIB, IPCA, Selic, câmbio, dívida, desemprego, salário mínimo real, por mandato |
| Propostas e entre turnos | Propostas de cada candidato antes do 1º turno, o que mudou entre os turnos e os atos do governo no período; situação de cada proposta do eleito (cumprida, em parte, não cumprida, em andamento) e desfecho de cada ato, com fonte |
| Balanço dos mandatos | Para cada mandato de 2003 a 2026: o que os dados oficiais e os fatos registrados mostram × o que o público disse nas pesquisas (Datafolha e outros institutos), e a correlação entre as duas leituras |
| Dados e método | Catálogo de indicadores com polaridade e fonte, CSV com tudo, limitações |

Todo filtro fica na URL (`#/explorar?ind=homicidios&ano=2024`): o botão de link copia a tela exatamente como está.

## Atualizar os dados

Na pasta `panorama-brasil`, com Python 3.10+ (só biblioteca padrão):

```
python scripts/fetch_ibge.py      # IBGE: SIDRA, malhas, localidades (~5 min)
python scripts/fetch_datasus.py   # Ministério da Saúde via TabNet (~4 min)
python scripts/fetch_bcb.py       # Banco Central (SGS)
python scripts/fetch_tse.py       # TSE (~5 min); apague data/cache/tse/ok_<ano>.json para refazer um ano
python scripts/build.py           # gera web/data/*.js
```

As propostas (`data/manual/propostas.json`) foram levantadas por pesquisa na web com uma fonte por item; o `build.py` só as converte.

## Testar

```
python tests/e2e_navegador.py
```

Abre todas as abas no Chrome (Playwright), nos temas claro e escuro e no celular (390 px), coleta erros de JavaScript, verifica rolagem horizontal e salva capturas em `tests/capturas/`.

## Estrutura

```
panorama-brasil/
├── scripts/            coletores (fetch_*.py), leitura de ZIP remoto (httpzip.py) e build.py
├── data/processed/     CSVs consolidados (formato longo)
├── data/geo/           malhas e localidades do IBGE
├── data/manual/        propostas, cumprimento, destaques e aprovação (pesquisa com fonte por item)
├── data/cache/         controle de coleta (fora do Git)
├── web/                o painel (index.html, css/, js/, vendor/, data/)
├── tests/              teste de navegador e capturas
├── .github/workflows/  publicação automática da pasta web/ no GitHub Pages
├── server.js           servidor local sem dependências
└── iniciar.bat         abre o painel no navegador
```

## Neutralidade

Nenhum padrão favorece partido, região ou estado:
- **Voto:** a medida padrão é o vencedor de cada eleição. "Candidato do governo" e "PT" (único partido em todos os 2º turnos) ficam como opções no seletor "Medir o voto por".
- **Seleções iniciais:** seguem critério objetivo (pior situação no indicador, estado mais populoso, eleição mais recente).

## Documentos

| Documento | Para quê |
|---|---|
| [CONTINUIDADE.md](CONTINUIDADE.md) | Ponto de partida numa sessão nova: histórico de pedidos, decisões, armadilhas, pendências |
| [DOCUMENTACAO.md](DOCUMENTACAO.md) | Arquitetura, fontes, métodos, polaridade, neutralidade, limitações |
| [CLAUDE.md](CLAUDE.md) | Regras para o agente (Claude Code) |
| [PADROES.md](PADROES.md) | Padrões, técnicas e skills do Claude Code usadas, para manter o mesmo nível nas atualizações |
| [PUBLICACAO.md](PUBLICACAO.md) | Como publicar no GitHub e hospedar de graça |

## Licença

O código está sob a [licença MIT](LICENSE). Os dados seguem os termos de cada fonte oficial (IBGE, TSE, Ministério da Saúde, Banco Central): ao reutilizar, cite a fonte original. As bibliotecas em `web/vendor/` mantêm as licenças dos autores: D3 (ISC), ApexCharts (MIT) e topojson-client (ISC).

# Panorama Brasil: documento de continuidade (sessão nova)

> **Estado em 27/10/2026: projeto concluído e testado** (48 telas no teste de navegador, `FALHAS: 0`). Preparado para publicação no GitHub e hospedagem gratuita: ver `PUBLICACAO.md`.
> Este é o ponto de partida para qualquer sessão futura. Resume tudo o que foi pedido, decidido, construído, conferido e corrigido.
> Detalhes técnicos em `DOCUMENTACAO.md`, uso em `README.md`, regras do agente em `CLAUDE.md`.

---

## 0. Como retomar numa sessão nova

1. Abra esta pasta (`.../Pessoal/Brasil/panorama-brasil`) no Claude Code.
2. Peça: *"Leia CONTINUIDADE.md, CLAUDE.md e DOCUMENTACAO.md do panorama-brasil antes de qualquer coisa."*
3. Confira se o painel abre: `node server.js` → http://localhost:8080 (ou dois cliques em `iniciar.bat`).
4. Antes de mudar qualquer coisa, rode `python tests/e2e_navegador.py`. Precisa terminar com `FALHAS: 0`.
5. Depois de qualquer mudança:
   - rode `python scripts/build.py` (se mexeu em dados ou no `build.py`);
   - rode o teste de novo;
   - **olhe as capturas** em `tests/capturas/`;
   - atualize este arquivo.

Primeira mensagem sugerida numa sessão nova:
```
Leia panorama-brasil/CONTINUIDADE.md, CLAUDE.md e DOCUMENTACAO.md. Rode o teste de navegador
para confirmar que está tudo verde e me diga o estado. Depois quero <pedido>.
```

---

## 1. O que é o projeto

**Panorama Brasil** é um painel web **local** (HTML + CSS + JavaScript puro, sem framework e sem build de front-end). Mostra indicadores socioeconômicos dos **27 estados, 5 regiões e do Brasil**, cruzados com as **eleições presidenciais e de governador de 2002 a 2026**.

- **Fontes:** só dados oficiais (IBGE, TSE, Ministério da Saúde, Banco Central). O conteúdo qualitativo (propostas, cumprimento, destaques de mandato, pesquisas de opinião) tem **uma fonte por item** e grau de confiança.
- **Referência visual e de análise:** os painéis da Cubo Três ([politica.one](https://politica.one/) e eleicoes.cubotres.com.br), com implementação própria. A análise técnica anterior desse painel fica fora deste repositório, numa pasta local do autor; o material de terceiros dela (capturas e evidências) não deve ser redistribuído. O projeto não tem vínculo com a Cubo Três.
- **Origem:** o projeto anterior, só do Nordeste (2005–2025), fica fora deste repositório (`panorama-nordeste.html`, na pasta-mãe local). O Panorama Brasil o substitui e amplia.
- **Usuário:** o autor do projeto, uso pessoal. Respostas sempre em **português do Brasil**.

---

## 2. Pedidos do usuário, em ordem, e como foram atendidos

| # | Pedido | Como ficou |
|---|---|---|
| 1 | Dashboard completo do Brasil (estados, regiões) com análises avançadas e correlação com as eleições **desde 2002**. Referência visual Cubo Três, sem focar só em política. Saída local (JS/Node/ApexCharts) | 14 abas, 54 indicadores, eleições 2002–2026 por UF e município, D3 + ApexCharts locais |
| 2 | Todo KPI e gráfico deve dizer se o indicador é **melhor alto ou baixo** (texto/dica) | Polaridade em todos os indicadores (seção 7) |
| 3 | Autorização para baixar todos os dados de fontes seguras | Coletores em `scripts/` (seção 4) |
| 4 | Propostas de cada candidato: antes do 1º turno, novas entre os turnos e o que o governo (presidente candidato) fez entre os turnos | Aba "Propostas e entre turnos", 230 itens com fonte |
| 5 | Dica em cada proposta: **cumprida, não cumprida, em parte, quando e como**. Aproveitar o espaço horizontal (tela de cerca de 1.900 px) | 101 itens verificados + status automáticos; layout em largura total (até 2.400 px) |
| 6 | Bug: botão segmentado não ficava destacado após o clique (Eleições e outras) | Corrigido na origem (`C.el` com `aria-*`) + checagem no teste |
| 7 | Nova aba com **destaques positivos e negativos de cada mandato**, sem viés e com fontes confiáveis, mais a **percepção do público** (pesquisas) e a correlação entre os dois | Aba "Balanço dos mandatos" |
| 8 | Documentar tudo antes de uma compactação do contexto | Este arquivo + memória persistente |
| 9 | Municípios: escolher o **candidato/partido** em vez de PT fixo | Seletor de candidato (padrão: 1º colocado) |
| 10 | Séries históricas: tirar o pré-filtro "NE e SE" (parecia viés) e usar **seleção automática pelo indicador** (pior região e pior estado) | `PB.selecaoAutomatica` |
| 11 | Verificar o mesmo tipo de viés nas outras páginas | Medidas de voto neutras (vencedor / governo / PT como opção) em todas as abas; Estados abre no mais populoso |
| 12 | Documentação completa para uma sessão futura | Este arquivo (versão atual) |
| 13 | Reformas no Balanço: incluir Teto de Gastos e reforma trabalhista (Temer) junto com a Previdência (Bolsonaro), "com as observações necessárias para o leitor" | As três como positivos, cada uma com `observacao` (expectativa de defensores, crítica, o que aconteceu depois) e `observacao_fontes` |
| 14 | Selic de 26,5% (Lula 1) e H1N1 (Lula 2): passar a "pontos neutros", para o leitor interpretar sem marca de viés | Nova categoria `neutros`, exibida como "◆ Pontos neutros (para a sua leitura)", com observação de contexto |
| 15 | Casos discutíveis de cumprimento: manter, com observação | Campo `observacao` nos 6 itens; selo "◆ leitura discutível" com a explicação na dica |
| 16 | Planejamento para publicar no GitHub e hospedar com link público e gratuito | `PUBLICACAO.md`, `.gitignore`, `.gitattributes`, `LICENSE` (MIT), workflow do GitHub Pages, README para o público, dados pessoais removidos dos documentos |

**Preferências do usuário, que valem para tudo:**
- polaridade sempre visível;
- fonte por item e confiança;
- nada de memória sem fonte;
- mesmo rigor para todos os governos;
- texto neutro;
- análise dupla (fato × percepção);
- usar toda a largura da tela;
- nenhum padrão que favoreça partido, região ou estado.

Ele elogiou especificamente o formato "fonte + confiança" das propostas.

---

## 3. Como rodar

| Tarefa | Comando (na pasta `panorama-brasil`) |
|---|---|
| Abrir o painel | `web/index.html` direto no navegador, **ou** `node server.js` → http://localhost:8080, **ou** `iniciar.bat` |
| Regerar os dados do navegador | `python scripts/build.py` (lê `data/processed` e `data/manual`, grava `web/data/*.js`) |
| Atualizar dados oficiais | `python scripts/fetch_ibge.py` (~5 min), `fetch_datasus.py` (~4 min), `fetch_bcb.py`, `fetch_tse.py` (~5 min; para refazer um ano, apague `data/cache/tse/ok_<ano>.json`); depois `build.py` |
| Testar | `python tests/e2e_navegador.py` (Playwright + Chrome do sistema; sobe o servidor sozinho na porta 8093) |
| `package.json` | `npm start` (servidor), `npm run build`, `npm run dados` (coletores + build) |

**Ambiente:**
- Windows 11, Python 3.12 (os coletores usam só a biblioteca padrão), Node 24, Playwright + Chrome.
- Na máquina do autor, a pasta fica no OneDrive: dados com ~60 MB e capturas de teste com ~26 MB (descartáveis e fora do Git).
- Um agente de pesquisa instalou `pypdf` no Python do usuário.
- As fontes Raleway e Noto Sans vêm do Google Fonts; sem internet, o painel usa as fontes do sistema.

---

## 4. Dados: fontes, coletores e saídas

### 4.1 Coletores (`scripts/`)
| Script | Fonte | Particularidades | Saída (`data/processed/`) |
|---|---|---|---|
| `fetch_tse.py` + `httpzip.py` | TSE dados abertos (`votacao_candidato_munzona`, `detalhe_votacao_munzona`) e **divulgação** (`resultados.tse.jus.br/oficial/ele2026`, eleições 6258 federal e 6260 estadual, para o 2º turno de 2026) | Lê só os CSVs necessários **dentro do ZIP remoto via HTTP Range** (ZIPs de 120 a 640 MB). CSV em latin-1 com `;`. Válidos = `QT_VOTOS_NOMINAIS_VALIDOS` (2022+) ou nominais. Cache em `data/cache/tse/ok_<ano>.json`. `mun-e006258-cm.json` dá a tabela oficial TSE→IBGE dos municípios | `tse_presidente_uf.csv`, `tse_presidente_mun.csv`, `tse_governador_uf.csv`, `tse_comparecimento_uf.csv`, `tse_comparecimento_mun.csv`, `tse_municipios.csv` |
| `fetch_ibge.py` | API de agregados v3 do SIDRA; malhas v3; localidades v1 | Tabelas e variáveis conferidas nos metadados (lista abaixo). `--series` atualiza só algumas | `ibge_series.csv` (longo: série, nível, código, período, valor) + `data/geo/*.json` |
| `fetch_datasus.py` | TabNet SIM (`obt10uf.def`) e SINASC (`nvuf.def`), por UF de residência, 2002–2024 | Lê o formulário e marca os filtros pelo rótulo. Homicídios = CID-10 X85–Y09 + Y35–Y36 (definição do Atlas da Violência) | `datasus_uf.csv` |
| `fetch_bcb.py` | SGS (433, 432, 3698, 7326, 13762, 4513, 1619) | Séries diárias em janelas de até 10 anos. Repete quando a API devolve HTML em vez de JSON | `bcb_anual.csv` |

Tabelas do SIDRA usadas:

| Tabela | Conteúdo |
|---|---|
| 6579 | População estimada |
| 202 | Censos 2000 e 2010 |
| 9923 | Censo 2022 e população urbana |
| 5938 | PIB e VAB, inclusive municipal |
| 4099 | Desocupação e subutilização (trimestral) |
| 5436 | Rendimento (trimestral; **sem 2020-T2 a 2022-T1**) |
| 4708 | Informalidade |
| 7435 | Gini |
| 7113 | Analfabetismo |
| 5817, 5877, 10660 | Pobreza (ODS) |
| 1685 | CEMPRE |
| 7362, 7360 | Projeção da população, revisão 2018 |

### 4.2 Consolidação (`scripts/build.py`)
- **Locais:** `BR`, regiões `N`, `NE`, **`SD` (Sudeste)**, `S`, `CO` e as 27 UFs. **Nunca use "SE" para região**: é Sergipe. A colisão já misturou os dados dos dois.
- **População anual:** estimativas + Censos. 2007 é interpolado. **2023 = Censo 2022**, como o IBGE fez no PIB per capita de 2023. A metodologia muda de 2023 para 2024, o que causa um salto.
- **PNAD trimestral → anual:** média com pelo menos 3 trimestres.
- **DataSUS:** taxas = contagem ÷ população. Regiões e Brasil = soma das UFs.
- **Governador:** só é descartada a candidatura barrada que não foi eleita. "RENÚNCIA" ou "CASSADO" podem ser fatos posteriores e não excluem o eleito.
- **Catálogo:** 54 indicadores, todos com `polaridade` (`maior` | `menor` | `neutro`), `porque`, `fonte` e `nota`.
- **Medidas de voto neutras:**
  - `voto_vencedor`: % do vencedor nacional no turno decisivo.
  - `voto_governo_t2`: % do candidato do governo federal (Serra 2002, Lula 2006, Dilma 2010/2014, Bolsonaro 2022, Lula 2026; 2018 não tem).
  - `voto_pt_t1` e `voto_pt_t2`: mantidas como opção.
  - Esquerda/direita foi descartada (ver seção 7).
- **Municípios (`web/data/municipios.js`):**
  - `PB_MUN[codIBGE] = {n, uf, pop, urb, pibpc, pibpc_ano, adm, agro, ind, e:{"ano_turno":[líder, válidos, %cand1, %cand2…]}, c:{ano: comparecimento}}`
  - `PB_MUN_META["ano_turno"]` = números dos candidatos com 2% ou mais no país naquele turno.
- **Saídas em `web/data/`** (carregadas por `<script>`, por isso funcionam em `file://`):
  - `painel.js` (`PB_DADOS`, 640 KB)
  - `geo.js` (`PB_GEO`, 1,5 MB)
  - `propostas.js` (`PB_PROPOSTAS`, 160 KB)
  - `mandatos.js` (`PB_MANDATOS`, 84 KB; gravado sempre, mesmo vazio, para não dar 404)
  - `municipios.js` (`PB_MUN` e `PB_MUN_META`, 3,9 MB; carregado só quando a aba Municípios é aberta)

### 4.3 Dados pesquisados (`data/manual/`)
Feitos por agentes de pesquisa na web, com fonte por item. O `build.py` só converte.

| Arquivo | Conteúdo | Regras |
|---|---|---|
| `propostas.json` | 7 eleições; candidatos (finalistas + relevantes do 1º turno); `propostas_1turno`, `propostas_entre_turnos`, `acoes_governo_entre_turnos`, `lacunas`. **Cada item tem `id`**: `<ano>-<número>-t1-<i>`, `<ano>-<número>-et-<i>` ou `<ano>-gov-<i>` | Resumo neutro de até 200 caracteres, URL e `confianca` (alta ou média). A EC 141/2026 está marcada como ato do Congresso. A LC 238/2026 é de 21/10 |
| `cumprimento_2002_2006.json`, `_2010_2014.json`, `_2018_2026.json` | Por `id`: `status`, `resumo` (até 240 caracteres), `quando`, `fonte`, `fonte_nome`, `confianca`. 101 itens: 56 propostas de eleitos e 45 atos | Status de propostas: `cumprida`, `parcial`, `nao_cumprida`, `em_andamento`, `nao_avaliavel`. Status de atos: `efetivado`, `parcial`, `revertido`, `em_andamento`, `nao_avaliavel`. O build acrescenta `nao_se_aplica` (candidato não eleito) e `aguardando_mandato` (eleito em 2026) |
| `destaques_2003_2014.json`, `destaques_2015_2026.json` | `mandatos.{lula1, lula2, dilma1, dilma2, temer, bolsonaro, lula3}.{positivos, negativos, neutros}`, cada item com `titulo`, `texto`, `tema`, `quando`, `fonte`, `fonte_nome`, `confianca` e, quando a leitura é controversa, `observacao` + `observacao_fontes[{url, nome}]` | Só fatos datados. Escândalo só entra com desfecho institucional. Mesmo rigor para todos. Contagem: 4+4 em geral; Temer tem 6 positivos (com as duas reformas); Lula 1 e Lula 2 têm 3 negativos + 1 neutro |
| `aprovacao.json` | `datafolha[116]` (ótimo/bom, regular, ruim/péssimo, data, fonte); `conferencia[29]` (CNI-Ibope, Ibope, Ipec, Ipsos-Ipec, Quaest); `percepcao[mandato]` (aprovou/reprovou por área); `lacunas` | Sem interpolação. Cerca de 25 datas são aproximadas (dia 15), anotadas em `fonte_nome` |

### 4.4 Conferências já feitas (não refazer sem motivo)
**Eleições (TSE):**
- Presidente 2002–2026 confere com o TSE (ex.: Lula 39.455.233 votos no 1º turno de 2002).
- 2026, 2º turno: Lula 51,79% × Flávio 48,21%.
- 2026, 1º turno: **Flávio 47,03% × Lula 45,16%**, pela divulgação oficial. A análise da Cubo Três dizia 47,26 × 45,39, o que está errado: faltavam 7 candidaturas no denominador.

**IBGE, Atlas e Banco Central:**
- PIB per capita de 2023: R$ 53.887 (IBGE: 53.886,67).
- Homicídios de 2017: 31,6 por 100 mil, igual ao Atlas.
- Homicídios absolutos: 65.602 em 2017 e 45.503 em 2019, iguais ao Atlas.
- IPCA: 12,53% em 2002, 10,67% em 2015, 4,83% em 2024.

**Aprovação:**
- Os 138 links abrem.
- Marcos: Lula 83% (nov/2010), Dilma 8% (ago/2015), Temer 3% (jun/2018), Bolsonaro 39% (dez/2022).

**Destaques:**
- 3 links 404 trocados.
- PIB de 2009 atualizado para o dado revisado (-0,1%).
- Homicídios de 2014 com o número atual do SIM (60.474).

---

## 5. Front-end (`web/`)

### 5.1 Arquitetura
- Scripts **clássicos** (não módulos ES, que não carregam em `file://`) com o namespace global `PB`. A ordem está em `index.html`.
- **Bibliotecas locais** em `web/vendor/`: D3 7.9.0, ApexCharts 3.54.1 e topojson-client 3.1.0.
- **Estado na URL:** `#/<pagina>?param=valor`. `PB.setParams` usa `replaceState`; `PB.ir` navega.
- **Contrato de página:** `PB.paginas[id] = { montar(alvo, params) }`.
- **`app.js`:** abas, tema claro/escuro (`localStorage`), copiar link e `PB.rerender()`.

| Arquivo | Papel |
|---|---|
| `js/util.js` | **Dados:** `PB.valor`, `PB.serie`, `PB.anosDe`, `PB.ultimoAno`, `PB.anoAte`. **Formatação pt-BR:** `PB.fmt`, `PB.fmtDelta`, `PB.num`, `PB.compacto`, `PB.minus`. **Polaridade:** `PB.pol.rotulo/compara/variacao/ordena/criterioRanking`. **Cores:** `PB.cor`, `PB.corRegiao`, `PB.corPartido`, `PB.coresCandidatos`, `PB.escala`. **Estatística (`PB.est`):** média, dp, cv, Pearson ponderado, Spearman, p-valor (t), MQO com pesos, VIF, CAGR, força. Também URL, CSV seguro (sem injeção de fórmula) e **`PB.selecaoAutomatica(ind)`** |
| `js/componentes.js` | `C.el` (cria elementos; `aria-*` booleano vira "true"/"false"; `--var` via `setProperty`), dica (mouse e teclado), `C.selo` (polaridade), `C.variacao`, `C.spark`, `C.kpi`, `C.cartao`, `C.alternaTabela`, `C.select`, `C.selectIndicador`, `C.segmentado` (radiogroup com setas), `C.anoSlider`, `C.tabela` (ordenável), `C.ranking`, `C.legendaEscala`, `C.estatisticas` |
| `js/mapa.js` | `PB.Mapa.uf` (coroplético ou grade 7×8; corrige o sentido dos anéis do IBGE) e `PB.Mapa.municipios` (TopoJSON, 5.570 polígonos) |
| `js/graficos.js` | `PB.G.linha` (eixo de **categorias** com os anos; preenche anos faltantes quando a série é quase anual), `PB.G.linhaTempo` (eixo de datas, para pesquisas; dica não compartilhada), `PB.G.barras` (`cores` = uma cor por barra), `PB.G.dispersao` (D3: reta de regressão recortada, eixo log 1-2-5, quadrantes, rótulos), `PB.G.limpa` |
| `js/eleicoes-util.js` | `PB.EL`: resultado, líder, cor do líder pela margem, cores fixas por candidato (`EL.cores(ano)`), governador, comparecimento e **medidas de voto** (`EL.MEDIDAS`, `EL.candMedida`, `EL.corMedida`, `EL.selectMedida`, `EL.cartaoVotoRegioes`, `EL.candidatosDaMedida`) |

### 5.2 Abas e parâmetros de URL
| Aba (`id`) | O que mostra | Parâmetros e padrões |
|---|---|---|
| Início (`inicio`) | 14 KPIs do Brasil com polaridade; resultado de 2026 (placar + cartograma); voto por região (com medida); 5 regiões × indicadores; "perguntas que o painel responde" | `voto` (padrão `vencedor`) |
| Mapa e ranking (`explorar`) | Mapa ou grade, ranking (1º = melhor), estatísticas, convergência sigma | `ind` (`homicidios`), `ano`, `escala` (`desempenho`/`quintis`/`continua`), `forma` (`mapa`/`grade`), `uf`, `reg` |
| Estados (`estados`) | KPIs, pontos fortes e de atenção (polaridade), todos os indicadores com posição, voto no estado (com medida), quem venceu | `uf` (padrão: **mais populoso**), `cmp`, `voto` |
| Regiões (`regioes`) | Linhas por região, ranking, convergência beta, peso das regiões | `ind` (`pib_pc_relativo`) |
| Séries históricas (`tendencias`) | Até 6 lugares + Brasil, valor ou base 100, quem melhorou e quem piorou | `ind` (`desocupacao`), `locs` (**sem `locs` = seleção automática: pior região + pior UF**), `modo` |
| Eleições (`eleicoes`) | Resultado: placar, mapa (líder ou % de um candidato), de onde vieram os votos, saldo por UF, tabela. Histórico 2002–26: mapa de calor, virada, regiões, tabela nacional. Participação | `vista`, `ano`, `turno`, `uf`, `mapa`, `forma`, `a`, `b`, `voto` |
| Governadores (`governadores`) | Grade UF × ano por partido ou campo, detalhe da disputa, contagem por campo, partidos | `cor` (`partido`/`espectro`), `sel` (`<ano>-<UF>`) |
| Municípios (`municipios`) | Mapa municipal e dispersão (5.570 pontos), busca | `ano`, `turno`, **`cand`** (padrão: 1º colocado), `uf`, `x` (`pibpc`/`urb`/`adm`/`agro`/`ind`/`pop`/`comp`), `q` |
| Correlações (`correlacoes`) | Matriz (Pearson ou Spearman), dispersão com regressão e resíduos, regressão múltipla (β padronizado, p, VIF, mapa de resíduos), voto retrospectivo (candidato do governo) | `ano` (padrão: mais recente), `metodo`, `x`, `y` (padrão `voto_vencedor`), `peso`, `preds`, `retro` |
| Índice composto (`indice`) | Índice com pesos, orientado pela polaridade | `preset`, `metodo` (`minmax`/`z`), `ano`, `pesos` (`id:peso,…`) |
| Economia nacional (`macro`) | BCB e IBGE com faixas de mandato; salário mínimo real; tabela por mandato | — |
| Propostas e entre turnos (`propostas`) | Propostas com selo de **situação** (dica com quando, como e fonte), placar de cumprimento, atos com **desfecho** | `ano`, `tema`, `sit` |
| Balanço dos mandatos (`mandatos`) | Fatos (indicadores do início ao fim, destaques automáticos, positivos, negativos e neutros pesquisados) × percepção (Datafolha + conferência, áreas); tabela fatos × percepção; aprovação 2003–26; correlação anual; aprovação × eleição | `m` (padrão `lula3`, o mandato atual), `corr` |
| Dados e método (`fontes`) | Catálogo com polaridade e justificativa, CSV de tudo, fontes, conferências, lacunas, como atualizar | — |

---

## 6. Testes (`tests/e2e_navegador.py`)
- **Passadas:** tema claro em 1440 px (30 rotas), escuro (6), celular em 390 px (7) e tela larga em 1920 px (5). Total: 48 telas.
- **A tela falha quando:**
  - tem erro de JavaScript, inclusive `console.error`;
  - tem rolagem horizontal no celular;
  - termina **sem nenhum cartão**;
  - tem um `.segmentado` sem **exatamente uma** opção marcada.
- O teste registra a pilha da primeira vez que um atributo SVG recebe "NaN".
- Erros que surgem só durante a captura de página inteira aparecem como `OK*`.
- Capturas em `tests/capturas/` (pode apagar); saída em `tests/saida_teste.txt`.
- Para cobrir uma tela nova, acrescente a rota em `ROTAS`.

---

## 7. Regras de design e neutralidade (não quebrar)

**Polaridade**
- Selo "↑ Maior é melhor", "↓ Menor é melhor" ou "Neutro", com a justificativa na dica.
- Variações com seta + valor + palavra ("melhorou/piorou").
- Mapas "vs. Brasil" em verde-azulado (melhor) e laranja (pior).
- Ranking com 1º = melhor.
- No índice composto, os indicadores "menor é melhor" entram invertidos.
- Indicadores **políticos são sempre neutros**.

**Cores**
- **Vermelho e azul são reservados aos partidos:** PT em vermelho; PSDB, PSL e PL em azul (num mesmo gráfico, o menor vai para âmbar).
- Melhor e pior usam sempre verde-azulado e laranja.
- Regiões: N `#0f8fa3`, NE `#eda100`, SD `#e87ba4`, S `#6e4fe3`, CO `#1baf7a`.
- Paletas validadas (daltonismo, luminosidade, contraste) com o validador da skill `dataviz`, nos temas claro e escuro.

**Neutralidade**
- Nenhum padrão favorece partido, região ou estado.
- **Medida de voto padrão = vencedor da eleição.** "Candidato do governo" e "PT" são opções; o PT continua porque é o único partido presente em todos os 2º turnos.
- Seleções automáticas usam critério objetivo: pior situação; maior valor quando o indicador é neutro; estado mais populoso.
- **Esquerda/direita descartadas como medida de voto:** a classificação editorial herdada da Cubo Três põe PSDB e MDB em "centro/outros", o que zeraria a "direita" de 2002 a 2014. A classificação segue só na aba Governadores (modo "campo político"), com aviso.

**Gráficos**
- Sem eixo duplo.
- ApexCharts sempre via `PB.G`.
- O título diz o que o gráfico mostra.
- Fonte em todo cartão.
- Botão Tabela ou CSV onde faz sentido.

**Layout**
- Largura total (`--largura-max: 2400px`).
- A partir de 1700 px: KPIs com `minmax(250px)` e mapas com altura máxima de 78vh.

---

## 8. Armadilhas já resolvidas (não reintroduzir)
| Problema | Solução |
|---|---|
| Região "SE" × Sergipe "SE" | Sudeste = `SD` (build, `PB.REGIOES`, tokens `--reg-SD`) |
| ApexCharts: `destroy()` não cancela o temporizador de resize (150 ms), o que gera SVG "NaN" ao trocar de aba | `_windowResize` sobrescrito e `clearTimeout` no `PB.G.limpa` |
| O eixo X numérico do Apex desalinha os anos e embaralha dados em `{x, y}` | Eixo de categorias em `G.linha` |
| Séries com datas diferentes no Apex desenham segmentos falsos até zero | Na percepção, os outros institutos aparecem só como marcadores (`largura: 0`, com `??` e não `\|\|`); dica não compartilhada |
| `aria-checked` booleano virava atributo vazio (a seleção nunca ficava destacada) | `C.el` grava "true"/"false" |
| `--cor` em objeto de estilo não era aplicado | `C.el` usa `setProperty` para `--*` |
| O `onload` do script passava o evento como "erro" (Municípios em branco) | `s.onload = () => cb()` |
| A busca de municípios cortava em 200 antes de ordenar | Ordena pela população e só depois corta |
| Rendimento da PNAD sem 2020–2021 | Média anual com pelo menos 3 trimestres; nota no indicador |
| Governador eleito com "RENÚNCIA" posterior era descartado | Só é descartado o indeferido ou cancelado que não foi eleito |
| IBGE, planalto.gov.br e sec.gov bloqueiam robôs (403 ou conexão encerrada) | Não é link quebrado; conferir por outra via |
| Heredoc do bash quebra com aspas, crases ou `\n` em textos longos | Usar a ferramenta Write num arquivo temporário e juntar com Python |
| `cat > arquivo` sem heredoc fica esperando o teclado | Nunca deixar `cat >` sem entrada |

---

## 9. Limitações e decisões em aberto

**Lacunas de dados**
- Sem comércio exterior: o Comex Stat estava fora do ar (503).
- A API do Atlas da Violência caiu; os homicídios vêm do SIM, com a mesma definição.
- Sem IDHM: não há API aberta.
- A PNAD começa em 2012.
- A demografia é **projetada** (IBGE, revisão 2018).
- As linhas de pobreza seguem os ODS e diferem das da SIS.
- Aprovação: o Datafolha de 2010 começa em março; a Quaest usa "positiva/negativa" (registrada nos campos ótimo/bom e ruim/péssimo); 2026 tem 7 das cerca de 11 rodadas.

**Decisões respondidas pelo usuário em 27/10/2026** (aplicadas; ver pedidos 13 a 15 na seção 2)
1. Reformas no Balanço: incluir as três (Teto, trabalhista, Previdência) como positivos, com observação.
2. Selic de 26,5% (Lula 1) e H1N1 (Lula 2): pontos neutros, com observação de contexto.
3. Casos discutíveis de cumprimento: classificação mantida, com observação explicando a outra leitura possível:
   - Alca: cumprida ("em parte" também se sustenta).
   - Pronatec: não cumprida ("em parte" também se sustenta).
   - Pacote anticorrupção: em parte ("não cumprida" também se sustenta).
   - Consignado do Auxílio Brasil: efetivado, com suspensão em 2023.
   - MP 509 e MP 656: marcadas como efetivadas, embora tenham mudado no Congresso.

**Resultados das análises (para referência)**
- Correlação anual da aprovação com a desocupação: **−0,54** (n = 14).
- Com o crescimento do PIB: **+0,49** (n = 23).
- Com IPCA, rendimento e homicídios: cerca de 0.
- Lula 3: 11 indicadores melhoraram e 1 piorou, mas a aprovação foi de 38% para 36% ("a aprovação caiu apesar de dados melhores").

---

## 10. Ideias de próximos passos (ainda não pedidas)
- **Publicação:** repositório https://github.com/brunogomesacotel-png/panorama-brasil (público), site https://brunogomesacotel-png.github.io/panorama-brasil/ via GitHub Pages (workflow `.github/workflows/pages.yml`). A cópia de trabalho com Git fica em `C:\Projetos\panorama-brasil`; a pasta antiga no OneDrive é só cópia. Para atualizar: build, teste, commit e push (`PUBLICACAO.md` §7).
- Comércio exterior pelo Comex Stat, quando a API voltar (exportações e importações por UF).
- Voto para governador por município (os dados do TSE já são baixados por UF; falta agregar por município no `fetch_tse.py`).
- Senado e Câmara: composição e hemiciclos, no estilo da Cubo Três.
- Atualização periódica: coletores + build. O Datafolha e os destaques precisam de pesquisa nova a partir de 2027.
- Dados municipais além do voto (ex.: homicídios por município via TabNet).
- Exportar a aba atual em PDF ou PNG.

---

## 11. Memória persistente
Pasta local de memória do Claude Code, fora do repositório (`~/.claude/projects/<projeto>/memory/`):
- `panorama-brasil-continuidade.md`: aponta para este arquivo.
- `panorama-brasil-regras.md`: preferências do usuário.

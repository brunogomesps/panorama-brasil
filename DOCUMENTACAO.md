# Panorama Brasil: documentação técnica

Coleta, consolidação, front-end, métodos de análise, polaridade e limitações. Estado em 27/10/2026.

## 1. Arquitetura

Separação entre produção e consumo de dados (mesmo padrão da Cubo Três): scripts Python baixam as fontes oficiais e geram arquivos prontos; o navegador só lê.

```
fontes oficiais ──► scripts/fetch_*.py ──► data/processed/*.csv ──► scripts/build.py ──► web/data/*.js ──► web/index.html
```

- **Sem framework e sem build de front-end:** HTML + CSS + JavaScript puro, em scripts clássicos com um namespace global `PB`. Assim o painel abre direto do arquivo (`file://`), onde módulos ES não carregam.
- **Dados como `<script>`:** `painel.js` (640 KB), `geo.js` (1,5 MB), `propostas.js` (160 KB) e `mandatos.js` (84 KB) carregam na abertura. `municipios.js` (3,9 MB, com `PB_MUN` e `PB_MUN_META`) só carrega quando a aba Municípios é aberta.
- **Bibliotecas locais:**
  - D3 7.9.0: mapas, cartograma, dispersão.
  - ApexCharts 3.54.1: linhas e barras.
  - topojson-client 3.1.0: malha municipal.

### Arquivos do front-end

| Arquivo | Papel |
|---|---|
| `js/util.js` | Acesso aos dados, formatação pt-BR, **polaridade** (`PB.pol`), escalas de cor, estatística (`PB.est`: Pearson, Spearman, MQO com pesos, p-valor pela distribuição t, VIF, CAGR), estado na URL, exportação CSV |
| `js/componentes.js` | Dica (mouse e teclado), selo de polaridade, KPI com minissérie, cartão com Tabela/CSV/ⓘ, filtros (select, segmentado com setas, slider), tabela ordenável, ranking, legendas |
| `js/mapa.js` | Mapa por UF (GeoJSON do IBGE com correção do sentido dos anéis), cartograma em grade 7×8 e mapa municipal (TopoJSON) |
| `js/graficos.js` | `linha` e `barras` (ApexCharts) e `dispersao` (D3, com reta de regressão, quadrantes e rótulos) |
| `js/eleicoes-util.js` | Líder por local, margem, cores fixas por candidato, intensidade pela margem |
| `js/paginas/*.js` | Uma página por aba: `PB.paginas[id].montar(alvo, params)` |
| `js/app.js` | Abas, rota pelo hash, tema claro/escuro, copiar link |

## 2. Fontes e coleta

| Script | Fonte | O que traz |
|---|---|---|
| `fetch_tse.py` | TSE: dados abertos (`votacao_candidato_munzona`, `detalhe_votacao_munzona`) lidos por **HTTP Range** dentro do ZIP; divulgação oficial (`resultados.tse.jus.br`) para o 2º turno de 2026 (eleições 6258 e 6260) | Presidente por UF e município (1º e 2º turnos), governador por UF, eleitorado, comparecimento, brancos, nulos; tabela oficial TSE → IBGE dos municípios |
| `fetch_ibge.py` | API de agregados v3 do SIDRA; malhas v3; localidades v1 | Tabelas 6579, 202, 9923 (população), 5938 (PIB e VAB), 4099 e 5436 (PNAD trimestral), 4708 (informalidade), 7435 (Gini), 7113 (analfabetismo), 5817/5877/10660 (pobreza ODS), 1685 (CEMPRE), 7362 e 7360 (Projeção da População 2018) |
| `fetch_datasus.py` | TabNet (SIM `obt10uf.def`, SINASC `nvuf.def`), por UF de residência, 2002–2024 | Óbitos totais, infantis, homicídios (X85–Y09 + Y35–Y36), homicídios de mulheres e de jovens de 15 a 29 anos, suicídios (X60–X84), trânsito (CID-BR 104); nascidos vivos, mães adolescentes, cesáreas, pré-natal com 7 ou mais consultas |
| `fetch_bcb.py` | SGS (433, 432, 3698, 7326, 13762, 4513, 1619) | IPCA, Selic, dólar, PIB real, dívida bruta e líquida, salário mínimo |

Cada tabela e variável do SIDRA foi conferida nos metadados oficiais antes do uso.

### Conferências feitas contra números publicados

| Item | Painel | Referência |
|---|---|---|
| Lula, 1º turno de 2002 | 39.455.233 votos (46,44%) | TSE |
| 2º turno de 2026 | Lula 51,79% × Flávio 48,21% | TSE / politica.one |
| 1º turno de 2026 | Flávio 47,03% × Lula 45,16% | Divulgação oficial do TSE (05/10/2026) |
| PIB per capita do Brasil, 2023 | R$ 53.887 | IBGE: R$ 53.886,67 |
| Homicídios por 100 mil, Brasil, 2017 | 31,6 | Atlas da Violência: 31,6 |
| IPCA 2015 | 10,67% | IBGE |

> A análise anterior da Cubo Três (feita fora deste repositório) registra 47,26% × 45,39% como resultado final do 1º turno de 2026. A divulgação oficial do TSE dá 47,03% × 45,16%. A razão entre os dois é a mesma; a diferença de cerca de 587 mil votos no denominador equivale à soma de 7 candidaturas menores. O painel usa o número oficial.

## 3. Consolidação (`build.py`)

- **Locais:** Brasil (`BR`), regiões `N`, `NE`, **`SD` (Sudeste)**, `S`, `CO` e as 27 UFs. O Sudeste não usa "SE" porque essa é a sigla de Sergipe; a colisão chegou a misturar os dados dos dois na primeira versão.
- **População anual:** estimativas do IBGE, Censos 2000, 2010 e 2022; 2007 interpolado (geométrica); 2023 = Censo 2022, como o IBGE fez no PIB per capita de 2023.
- **Taxas do DataSUS:** contagem ÷ população × 100 mil (ou mil). Regiões e Brasil = soma das UFs.
- **PNAD trimestral → anual:** média dos trimestres, com mínimo de 3. A tabela 5436 (rendimento) não tem 2020-T2 a 2022-T1.
- **Indicadores eleitorais por local e ano de eleição:** % do vencedor nacional (`voto_vencedor`), do candidato do governo federal no 2º turno (`voto_governo_t2`), do PT no 1º e no 2º turno, comparecimento, abstenção, brancos + nulos, margem do 2º turno e número efetivo de candidatos (Laakso-Taagepera).
- **Governador:** o eleito vem da situação de totalização (ELEITO). Os votos de candidaturas indeferidas que não se elegeram são descartados. Situações posteriores à eleição (renúncia, cassação) não excluem quem foi eleito.

## 4. Polaridade (melhor ou pior)

Definida no catálogo (`add(...)` em `build.py`) para cada um dos 54 indicadores, com uma frase de justificativa (`porque`). Valores:

- **`maior`:** maior é melhor. Exemplos: renda, esperança de vida, comparecimento, pré-natal.
- **`menor`:** menor é melhor. Exemplos: desocupação, informalidade, pobreza, Gini, homicídios, mortalidade infantil, analfabetismo, IPCA, dívida, cesáreas (com a nota da OMS).
- **`neutro`:** sem leitura de melhor ou pior. Exemplos: população, estrutura setorial, fecundidade, envelhecimento, câmbio, Selic e **todos os indicadores políticos** (voto por partido, brancos e nulos, margem, fragmentação).

Onde a polaridade aparece:

1. **Selo** em todo KPI, cartão, tabela e no catálogo, com a dica do porquê.
2. **Variação** com seta + valor + palavra ("melhorou/piorou/subiu/caiu"); a cor nunca é o único canal.
3. **Mapa "vs. Brasil":** escala divergente em torno do valor nacional, orientada pela polaridade (verde-azulado = melhor, laranja = pior). Quintis vão do laranja (20% piores) ao verde-azulado (20% melhores). Indicadores neutros usam um único matiz violeta.
4. **Ranking:** 1º = melhor; para neutros, a ordem é por valor e o painel diz isso.
5. **Ficha do estado:** faixa de pior a melhor e listas automáticas de pontos fortes e pontos de atenção.
6. **Dispersão:** os quadrantes são rotulados com "X melhor/pior que o Brasil".
7. **Índice composto:** indicadores em que menor é melhor entram invertidos.
8. **Dica do mapa:** posição ("12º de 27, 1º = melhor") e "melhor/pior que o Brasil".

As cores de melhor e pior evitam vermelho e azul, que são reservados à identidade partidária (PT vermelho; PSDB, PSL e PL azul).

## 4.1 Neutralidade dos padrões (sem partido, região ou estado preferido)

- **Medidas de voto:** o painel não destaca partido fixo. O seletor "Medir o voto por" existe na Início, em Estados, no histórico de Eleições e por região, e oferece:
  - **Vencedor da eleição** (padrão; indicador `voto_vencedor`);
  - **Candidato do governo federal** no 2º turno (`voto_governo_t2`: Serra 2002, Lula 2006, Dilma 2010/2014, Bolsonaro 2022, Lula 2026; não há em 2018);
  - **PT**, mantido como opção por ser o único partido em todos os 2º turnos (série contínua).
  As medidas de esquerda e direita no 1º turno foram testadas e **descartadas**: a classificação editorial herdada põe o PSDB em "centro/outros", e o voto de direita apareceria perto de zero de 2002 a 2014.
- **Cores do mapa de calor do histórico:** em cada ano, a cor do partido do candidato medido e a do adversário. A virada entre eleições usa escala neutra (violeta = subiu, âmbar = caiu).
- **Municípios:** o seletor de candidato mostra todos os que tiveram 2% ou mais no país no turno, e o padrão é o 1º colocado. `municipios.js` guarda, por município e eleição, `[líder, válidos, % de cada candidato de PB_MUN_META]`.
- **Séries históricas:** sem lugares na URL, a seleção é automática pelo indicador: Brasil + pior região + pior estado no último ano (indicador neutro: os de maior valor). Ela se refaz ao trocar de indicador e o texto explica o critério.
- **Outros padrões:**
  - Estados abre no estado mais populoso.
  - Correlações abrem na eleição mais recente, com Y = votos do vencedor.
  - O voto retrospectivo e o Balanço dos mandatos usam o candidato do governo.

## 5. Métodos de análise

| Análise | Método |
|---|---|
| Convergência sigma | Coeficiente de variação entre as 27 UFs, ano a ano |
| Convergência beta | Valor inicial × variação (ou crescimento anual composto, para valores monetários), com MQO |
| Correlação | Pearson (pesos opcionais pela população) ou Spearman; p-valor por t com n − 2 graus de liberdade; força: ≥ 0,7 forte, 0,4 a 0,7 moderada, 0,2 a 0,4 fraca |
| Regressão múltipla | MQO com até 5 preditores; coeficientes, β padronizado, erro-padrão, t, p, R², R² ajustado, VIF; mapa de resíduos |
| Voto retrospectivo | Painel UF × eleição (2006, 2010, 2014, 2022, 2026). X = variação do indicador nos 4 anos anteriores; Y = voto do candidato do governo federal no 2º turno; inclinação por eleição e geral |
| Municípios | Dispersão de até 5.570 pontos, eixo em log10 para PIB per capita e população, regressão, Pearson e Spearman |
| Índice composto | Padronização 0–100 (min-max entre UFs) ou escore z, orientada pela polaridade, média ponderada e reescala 0–100 |
| Eleições | Líder por UF com intensidade pela margem (< 5, 5–15, > 15 p.p.); mapa em quintis na cor do candidato; saldo de votos por UF; virada do PT entre duas eleições; participação |

Avisos exibidos no painel: correlação não é causalidade; falácia ecológica (estado ou município não é eleitor); com 27 observações, p > 0,05 pode ser acaso; índices compostos dependem das escolhas feitas.

## 6. Propostas e atos entre turnos

`data/manual/propostas.json` traz 230 itens: 156 propostas antes do 1º turno, 29 propostas novas entre os turnos e 45 atos do governo no período. Cada item tem tema, resumo neutro (até 200 caracteres), URL da fonte e confiança:

- **alta:** plano oficial, ato oficial ou mais de um veículo.
- **média:** um único veículo.

As lacunas de cada eleição são listadas na própria aba. O portal DivulgaCandContas bloqueia acesso automatizado, então os planos de governo vêm de cópias publicadas pela imprensa. A Emenda Constitucional 141/2026 aparece marcada como ato do Congresso, não do Executivo.

### 6.1 Cumprimento das propostas e desfecho dos atos

`data/manual/cumprimento_*.json` (um arquivo por período) traz, para cada `id` de `propostas.json`:

```json
{ "status": "...", "resumo": "o que foi feito, quando e como", "quando": "...", "fonte": "URL", "fonte_nome": "...", "confianca": "alta | media" }
```

Cobertura: 101 itens pesquisados, sendo 56 propostas de presidentes eleitos de 2002 a 2022 e 45 atos de governo entre os turnos. O `build.py` junta esses arquivos às propostas e marca dois status automáticos:
- **`nao_se_aplica`:** candidato não eleito.
- **`aguardando_mandato`:** eleito em 2026, com mandato a partir de 2027.

O vencedor de cada eleição vem do resultado do TSE.

| Situação | Critério |
|---|---|
| `cumprida` | Feita como proposta, dentro do mandato |
| `parcial` | Feita em parte, em escala menor, de outra forma ou fora do prazo |
| `nao_cumprida` | Não feita no mandato |
| `em_andamento` | Mandato em curso (2023–2026), ainda em execução ou tramitação |
| `nao_avaliavel` | Proposta vaga ou sem fonte firme |
| `efetivado` / `revertido` | Ato que vigorou (MP convertida em lei) / MP que perdeu a validade ou ato revogado |

**Regras da verificação:**
- Proposta composta é avaliada pela parte concreta verificável, e o resumo diz o que ficou sem checar.
- O mandato de Dilma iniciado em 2015 é avaliado até 31/08/2016.
- O mesmo critério vale para todos os governos.

**Pontos discutíveis registrados pelos pesquisadores.** Por decisão do usuário (27/10/2026), a classificação foi mantida e cada um ganhou o campo `observacao`, que explica a outra leitura possível. Na tela aparece o selo "◆ leitura discutível", com a observação na dica e também na dica da situação:
- Alca (2002): "cumprida", mas "parcial" também se sustenta.
- Pronatec (2014): "não cumprida", mas "parcial" também se sustenta.
- Pacote anticorrupção (2014): "parcial", mas "não cumprida" também se sustenta.
- Consignado do Auxílio Brasil (2022): "efetivado", com suspensão em 2023.
- MP 509 e MP 656: "efetivado", embora convertidas com mudanças.

### 6.2 Balanço dos mandatos (fatos × percepção)

Arquivos de dados:
- `data/manual/destaques_2003_2014.json` e `destaques_2015_2026.json`: fatos `positivos`, `negativos` e `neutros` por mandato (lula1, lula2, dilma1, dilma2, temer, bolsonaro, lula3), com fonte oficial ou imprensa de referência e confiança. Escândalos entram só com desfecho institucional.
  - **Reformas** (decisão do usuário, 27/10/2026): Teto de Gastos (EC 95/2016) e reforma trabalhista (Lei 13.467/2017) entram como positivos de Temer, com o mesmo critério da Reforma da Previdência (EC 103/2019) de Bolsonaro. As três têm `observacao` (o que os defensores esperavam, a principal crítica, o que aconteceu depois) e `observacao_fontes`.
  - **Pontos neutros:** a Selic de 26,5% (Lula 1) e a pandemia de H1N1 (Lula 2) saíram dos negativos e foram para `neutros`, com observação de contexto (inflação e câmbio de 2002; alcance mundial da pandemia e vacinação de 2010). A tela mostra "◆ Pontos neutros (para a sua leitura)" abaixo das duas colunas.
- `data/manual/aprovacao.json`: 116 pesquisas Datafolha de 2003 a 2026 (ótimo/bom, regular, ruim/péssimo, data de campo e fonte por ponto); 29 pontos de conferência (CNI-Ibope, Ibope, Ipec, Ipsos-Ipec, Quaest); percepção por área em cada mandato.

O `build.py` junta tudo em `web/data/mandatos.js`.

**Checagens feitas antes de publicar:**
- Os 138 links da aprovação abrem.
- Os marcos conferem: Lula 83% em nov/2010, Dilma 8% em ago/2015, Temer 3% em jun/2018, Bolsonaro 39% em dez/2022.
- Os links quebrados dos destaques foram trocados por fontes testadas.
- PIB de 2009 atualizado para o dado revisado (-0,1%).
- Os homicídios de 2017 e 2019 conferem com o SIM do painel.

**Método da página:**
- **Anos nos dados anuais:** 2016 vai para Temer (Dilma foi afastada em 12/05/2016). Ano-base = ano anterior ao mandato.
- **Indicadores de variação:** desocupação, rendimento, informalidade, pobreza, extrema pobreza, Gini, homicídios, mortalidade infantil, analfabetismo, dívida bruta e salário mínimo real (deflacionado pelo IPCA).
- **Indicadores de média:** PIB real e IPCA, comparando a média do mandato com a média de 2003 a 2025.
- **Destaques automáticos:** variação ÷ desvio-padrão histórico, orientada pela polaridade.
- **Fatos × percepção:** saldo de indicadores que melhoraram contra a variação da aprovação do início ao fim. Spearman entre mandatos (descritivo, n = 7).
- **Correlação anual:** aprovação média no ano × indicador do ano (Pearson), com os anos de maior resíduo.
- **Aprovação × eleição:** último Datafolha do ano até outubro × voto do candidato do governo no 2º turno.
- **Gráfico:** os outros institutos aparecem como pontos sem linha, porque o ApexCharts desenhava segmentos falsos em séries de datas com tamanhos diferentes.

**Resultados (Pearson, aprovação anual):**

| Indicador | r | n |
|---|---|---|
| Desocupação | −0,54 | 14 |
| Crescimento do PIB | +0,49 | 23 |
| Salário mínimo real | −0,40 | 23 |
| IPCA | −0,04 | 23 |
| Rendimento | −0,04 | 12 |
| Homicídios | −0,04 | 22 |

O sinal do salário mínimo real reflete tendência: o piso subiu ao longo do tempo, enquanto a aprovação média caiu depois de 2013. Não é um efeito causal.

## 7. Limitações conhecidas

- **Comércio exterior:** a API e os arquivos do Comex Stat estavam fora do ar (503) na coleta.
- **Atlas da Violência:** a API do Ipea não respondeu. As taxas de homicídio foram calculadas pelo SIM com a mesma definição do Atlas, mas podem diferir alguns décimos por causa da população usada.
- **IDHM:** não incluído, porque o Atlas Brasil não tem API aberta.
- **PNAD Contínua:** começa em 2012, então emprego, renda, Gini, pobreza e analfabetismo não cobrem 2002–2011.
- **Projeções:** esperança de vida, fecundidade, envelhecimento, idade mediana e razão de dependência vêm da projeção do IBGE (revisão 2018), não de observação ano a ano.
- **Linhas de pobreza:** as dos indicadores ODS não são as da Síntese de Indicadores Sociais (por exemplo, 26,5% e 4,7% no Brasil em 2024, contra 23,1% e 3,5% na SIS).
- **Classificação ideológica dos partidos:** é editorial e está documentada na aba Governadores.

## 8. Testes

`tests/e2e_navegador.py` cobre 48 telas: 30 rotas no tema claro em 1440 px, 6 no escuro, 7 no celular (390 px) e 5 na tela larga (1920 px). A última execução, em 27/10/2026, terminou com `FALHAS: 0`. O teste reprova a tela quando há:
- erro de JavaScript;
- rolagem horizontal no celular;
- aba sem nenhum cartão;
- controle segmentado sem exatamente uma opção marcada.

O teste registra a pilha de qualquer atributo SVG "NaN". Foi assim que se achou um temporizador de redimensionamento do ApexCharts que o `destroy()` não cancela, já corrigido em `graficos.js`.

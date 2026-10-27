# Padrões e técnicas do Panorama Brasil

Como este projeto foi construído e como mantê-lo igual em futuras atualizações. Vale para quem edita à mão e para o Claude Code.

| Documento | Papel |
|---|---|
| `CLAUDE.md` | Regras curtas e obrigatórias para o agente (lido automaticamente) |
| **`PADROES.md`** (este) | O porquê das regras, as técnicas usadas e as skills que as originaram |
| `DOCUMENTACAO.md` | Referência técnica: tabelas, métodos, fórmulas, conferências |
| `CONTINUIDADE.md` | Histórico de pedidos e decisões, estado atual, armadilhas |
| `PUBLICACAO.md` | GitHub, GitHub Pages e trabalho em outro computador |

---

## 1. Skills do Claude Code usadas no projeto

| Skill | Onde está | O que veio dela para o projeto |
|---|---|---|
| `dataviz` | **Embutida no Claude Code**: existe em qualquer computador com a extensão. Chame com `/dataviz` ou ela entra sozinha quando o pedido envolve gráfico | Escolher o gráfico pelo trabalho do dado; cor por função (categórica, sequencial, divergente, estado); **validar a paleta com script** em vez de no olho (`node scripts/validate_palette.js "<hex,...>" --mode light` e de novo `--mode dark`, na pasta da skill); marcas finas; dica (tooltip) por padrão; legenda + rótulo direto para não depender só da cor; modo escuro com tons próprios, validados contra o fundo escuro; olhar a captura no fim |
| `dashboards-web` | **Skill pessoal do autor**, fora do repositório (vem pelo kit de instalação, em `~/.claude/skills/`). Contém o padrão visual de outro contexto, que **não** se aplica aqui | Arquitetura "estático pré-gerado" (build → dados prontos → front sem build); estado na URL; contrato de página `montar(alvo, params)`; escolha de gráfico pela relação (FT Visual Vocabulary); barras a partir de zero, sem eixo duplo, título que diz o que mostra, botão Tabela/CSV; acessibilidade (teclado, `aria-*`, foco visível, `radiogroup` com setas, sem rolagem horizontal no celular); CSV sem injeção de fórmula; bibliotecas servidas localmente com licença conferida; teste Playwright com zero erro de JavaScript; **olhar as capturas**; documentar em README, DOCUMENTACAO e CLAUDE.md |

Sem a `dashboards-web` instalada, o projeto continua mantível: tudo o que ela trouxe está descrito neste arquivo. A paleta e a identidade visual próprias do Panorama Brasil estão em `web/css/tokens.css` (seção 5), não na skill.

Como pedir ao Claude Code para seguir o mesmo caminho:
```
Leia CONTINUIDADE.md, CLAUDE.md, PADROES.md e DOCUMENTACAO.md antes de qualquer coisa.
Para qualquer gráfico ou cor nova, use a skill dataviz e valide a paleta (claro e escuro).
Rode o teste de navegador antes e depois e me mostre as capturas que mudaram.
```

---

## 2. Arquitetura (e por que é assim)

```
fontes oficiais ──fetch_*.py──► data/processed/*.csv (formato longo)
pesquisa com fonte ──────────► data/manual/*.json
                                     │
                                build.py
                                     ▼
                     web/data/*.js (PB_DADOS, PB_GEO, PB_PROPOSTAS, PB_MANDATOS, PB_MUN)
                                     │
                     web/index.html + js/ + css/ + vendor/  ──►  navegador (file://, servidor local ou GitHub Pages)
```

- **Site estático, sem backend:** abre por `file://`, por `node server.js` ou hospedado de graça. Nada de banco, login ou API própria.
- **Dados como `<script>` (`window.PB_*`) e não `fetch` de JSON:** `fetch` não funciona em `file://`. O peso pesado (`municipios.js`) é carregado só quando a aba Municípios abre.
- **Scripts clássicos com o namespace global `PB`**, não módulos ES (que também não carregam em `file://`). A ordem dos `<script>` em `index.html` importa.
- **Sem framework e sem build de front-end:** HTML, CSS e JS puros. Bibliotecas versionadas em `web/vendor/` (D3 7.9.0, ApexCharts 3.54.1, topojson-client 3.1.0). **Não atualize o ApexCharts para 4.x sem checar a licença**, que mudou.
- **Python só com a biblioteca padrão** nos coletores e no build: roda em qualquer máquina com Python 3.10+.

---

## 3. Dados

### 3.1 Coletores (`scripts/fetch_*.py`)
- Uma fonte por script; saída em CSV **longo** (`serie, nivel, codigo, periodo, valor`) ou tabela simples em `data/processed/`.
- Repetir a requisição quando a API falha ou devolve HTML em vez de JSON (`get_json(url, tentativas=5)`).
- Cache e controle de progresso em `data/cache/` (fora do Git). Para refazer um ano do TSE, apague `data/cache/tse/ok_<ano>.json`.
- ZIPs grandes do TSE são lidos **por HTTP Range** (`httpzip.py`), baixando só os CSVs necessários. O TSE usa latin-1 com `;`.
- Antes de usar uma tabela do SIDRA, confira número e variável nos metadados (`/api/v3/agregados/{t}/metadados`).

### 3.2 Build (`scripts/build.py`)
- **Indicador novo sempre por `add(...)`:**
  ```python
  add("id", "Nome completo", "Tema", "unidade", "maior" | "menor" | "neutro",
      "Frase do porquê (o que significa subir).", "Fonte, tabela",
      valores, casas=1, nota="Limitação ou método, se houver.")
  ```
  Polaridade e `porque` são obrigatórios. Indicadores políticos são sempre `neutro`.
- Regiões: `N`, `NE`, **`SD` (Sudeste)**, `S`, `CO`. **Nunca "SE"**, que é Sergipe.
- Regiões e Brasil = soma das UFs (contagens) e razão recalculada (taxas), nunca média de taxas.
- Taxas por 100 mil usam a população anual do próprio build (`pop(loc, ano)`).
- Série trimestral → anual: média com pelo menos 3 trimestres.
- Nenhum número digitado à mão no HTML ou no JS: tudo passa pelo build.

### 3.3 Conferência
Todo dado novo é conferido contra um número-âncora publicado pela fonte (ex.: PIB per capita de 2023 = R$ 53.887; homicídios de 2017 = 65.602). A conferência vai para `DOCUMENTACAO.md`.

---

## 4. Conteúdo pesquisado (`data/manual/*.json`)

É a parte mais sensível do projeto. O protocolo:

| Regra | Como |
|---|---|
| Fonte por item | `fonte` (URL) + `fonte_nome` (veículo e data) |
| Grau de confiança | `confianca`: `alta` = fonte oficial ou duas fontes independentes; `media` = um veículo |
| Sem memória | Sem fonte firme → registrar em `lacunas` ou status `nao_avaliavel`. Nunca preencher de memória |
| Mesmo rigor para todos | Mesmos critérios e mesma quantidade de destaques por mandato, salvo decisão registrada |
| Texto neutro | Sem adjetivo de juízo. Opinião sempre atribuída ("o governo estimava…", "a oposição criticava…") |
| Escândalos | Só com desfecho institucional (denúncia, julgamento, parecer) |
| Leitura controversa | Campo **`observacao`** (até ~450 caracteres) + **`observacao_fontes[{url, nome}]`**: o que os defensores esperavam, a principal crítica e o que aconteceu depois |
| Fato sem sinal claro | Categoria **`neutros`** no Balanço ("◆ Pontos neutros, para a sua leitura"), com observação de contexto |
| Classificação discutível | Mantém o status e acrescenta `observacao` com a outra leitura possível (aparece o selo "◆ leitura discutível") |
| Links | Testar todos antes de publicar. IBGE, planalto.gov.br e sec.gov bloqueiam robôs: isso não é link quebrado; confirme por outra via |
| Resumos | Proposta até 200 caracteres; cumprimento até 240; destaque até ~240 |

Pesquisa nova costuma ser feita por um agente do Claude Code com essas regras no pedido, gravando um JSON intermediário; depois um script aplica o JSON aos arquivos de `data/manual/` e o `build.py` converte.

---

## 5. Visual

### 5.1 Polaridade em tudo
Selo "↑ Maior é melhor", "↓ Menor é melhor" ou "Neutro" com o porquê na dica; variações com seta + valor + palavra ("melhorou/piorou"); ranking com 1º = melhor; no índice composto, indicadores "menor é melhor" entram invertidos. Funções em `PB.pol` (`util.js`) e componentes `C.selo` e `C.variacao`.

### 5.2 Cores (`web/css/tokens.css`)
- Melhor/pior: **verde-azulado/laranja** (`--melhor`, `--pior`), nunca vermelho/verde.
- **Vermelho e azul são reservados aos partidos** (PT vermelho; PSDB, PSL e PL azul; num mesmo gráfico, o menor vai para âmbar).
- Regiões: N `#0f8fa3`, NE `#eda100`, SD `#e87ba4`, S `#6e4fe3`, CO `#1baf7a`.
- Neutros: `--neutro` e `--neutro-fundo`.
- Toda cor é token em `:root`, redefinida para o tema escuro. Paleta nova passa pelo validador da `dataviz` nos dois temas.

### 5.3 Gráficos
- ApexCharts sempre via `PB.G` (`graficos.js`), que destrói os gráficos e cancela o temporizador de resize ao trocar de aba.
- Linhas anuais com eixo de **categorias** (anos), não numérico.
- Séries de datas com tamanhos diferentes: só marcadores, sem linha.
- Mapas e dispersões em D3 (`mapa.js`, `PB.G.dispersao`).
- Sem eixo duplo; barras a partir de zero; título diz o que o gráfico mostra; **fonte em todo cartão**; botão Tabela ou CSV onde fizer sentido.

### 5.4 Layout e acessibilidade
- Largura total (`--largura-max: 2400px`); testar em 1440 px e 1920 px; a partir de 1700 px os KPIs e mapas se ajustam.
- `C.el` cria todos os elementos: `aria-*` booleano vira "true"/"false"; `--var` via `setProperty`. Não crie elementos com `innerHTML` a partir de dados; use `PB.esc` quando HTML for inevitável (dicas).
- Dicas abrem no mouse e no foco do teclado; `C.segmentado` é `radiogroup` com setas; sem rolagem horizontal no celular (390 px).

### 5.5 Neutralidade
Nenhum padrão favorece partido, região ou estado: medida de voto padrão = vencedor da eleição; seleções iniciais por critério objetivo (`PB.selecaoAutomatica`: pior situação; maior valor se neutro; estado mais populoso; eleição ou mandato mais recente). Não reintroduza esquerda/direita como medida de voto.

---

## 6. Front-end: como acrescentar uma aba

1. Crie `web/js/paginas/<id>.js` com `PB.paginas.<id> = { montar(alvo, params) { … } }`.
2. Inclua o `<script>` em `index.html` antes do `app.js` e a aba no menu.
3. Leia e grave filtros pela URL (`PB.setParams`); valide cada parâmetro e use padrão objetivo.
4. Use os componentes de `componentes.js` (`C.cartao`, `C.kpi`, `C.segmentado`, `C.selectIndicador`, `C.tabela`, `C.ranking`…), nunca HTML solto.
5. Acrescente a rota em `ROTAS` no teste (`tests/e2e_navegador.py`).

---

## 7. Testes e definição de pronto

Uma mudança só está pronta quando:
1. `python scripts/build.py` rodou (se mexeu em dados ou no build);
2. `python tests/e2e_navegador.py` terminou com **`FALHAS: 0`** (o resultado aparece no terminal);
3. as capturas em `tests/capturas/` foram **olhadas** (claro, escuro, celular, largo), principalmente as telas alteradas;
4. `CONTINUIDADE.md` foi atualizado (pedido, decisão, estado) e, se for o caso, `DOCUMENTACAO.md`, `README.md` e este arquivo;
5. o commit foi enviado (`git push`), o que republica o site.

O teste reprova a tela com erro de JavaScript (inclusive `console.error`), rolagem horizontal no celular, tela sem cartão ou `.segmentado` sem exatamente uma opção marcada.

---

## 8. Versionamento

- Comece com `git pull` e termine com `git push`, em qualquer computador.
- Commits pequenos, com mensagem em português dizendo o que mudou ("Atualiza PNAD do 3º tri/2026", "Nova aba: Senado").
- E-mail dos commits = o *noreply* do GitHub, configurado só neste repositório.
- Nunca faça commit de senha, token ou chave. O projeto não usa nenhum.
- Detalhes em `PUBLICACAO.md`.

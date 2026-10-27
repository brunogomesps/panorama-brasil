# Regras para o agente: Panorama Brasil

**Antes de qualquer tarefa,** leia `CONTINUIDADE.md`: estado, pedidos do usuário, decisões e armadilhas. Os detalhes técnicos estão em `DOCUMENTACAO.md`.

## Comunicação
- Responda e escreva sempre em português do Brasil.
- Relate o que foi verificado e o que ficou pendente, sem exagerar. Se não souber, diga.

## Dados
- Todo número vem de fonte oficial baixada por script (`scripts/fetch_*.py`). Nunca escreva valor à mão no HTML ou no JS.
- Antes de usar uma tabela do SIDRA, confirme número e variável nos metadados (`/api/v3/agregados/{t}/metadados`).
- Novo indicador: sempre pelo `add(...)` em `scripts/build.py`, com `polaridade` (`maior`, `menor` ou `neutro`), a frase `porque` e a `fonte`. Indicadores políticos são sempre `neutro`.
- Regiões: `N`, `NE`, `SD` (Sudeste), `S`, `CO`. **Nunca use "SE" para região**: é Sergipe.
- Conteúdo pesquisado (`data/manual/*.json`: propostas, cumprimento, destaques, aprovação) só entra com URL de fonte por item e confiança (`alta` = fonte oficial ou duas fontes; `media` = um veículo). Resumos neutros. Mesmo rigor para todos os governos. Sem fonte firme, registre como lacuna ou `nao_avaliavel`; nunca preencha de memória.
- Antes de publicar dados pesquisados, teste os links e confira os números-âncora. Os sites do IBGE, do Planalto e da SEC bloqueiam robôs, e isso não significa que o link esteja quebrado.

## Neutralidade (pedido explícito do usuário)
- Nenhum padrão pode favorecer partido, região ou estado.
- Medida de voto padrão = **vencedor da eleição** (`EL.MEDIDAS`). "Candidato do governo" e "PT" ficam como opções.
- Seleções iniciais seguem critério objetivo: `PB.selecaoAutomatica` (pior situação; maior valor se o indicador for neutro), estado mais populoso, eleição ou mandato mais recente.
- Não reintroduza medidas de esquerda/direita: a classificação editorial distorce a série histórica.

## Visual
- **Polaridade sempre visível:** selo, dica, "melhorou/piorou", ranking com 1º = melhor.
- **Cores:** melhor/pior em verde-azulado/laranja. Vermelho e azul são reservados aos partidos. Paletas novas passam pelo validador da skill `dataviz` (claro e escuro).
- **Layout:** largura total da tela (`--largura-max`); testar também em 1920 px.
- **Gráficos:** sem eixo duplo. ApexCharts sempre via `PB.G`, que destrói os gráficos e cancela o temporizador de resize ao trocar de aba. Linhas anuais usam eixo de categorias. Para séries de datas com tamanhos diferentes, use só marcadores.
- **Atributos:** `aria-*` sempre como "true"/"false" (o `C.el` já trata); variáveis CSS (`--cor`) via `setProperty` (o `C.el` já trata).

## Fluxo de trabalho
1. Rode `python scripts/build.py` se mexeu em dados ou no `build.py`.
2. Rode `python tests/e2e_navegador.py`. Precisa terminar com `FALHAS: 0`. Tela nova = rota nova em `ROTAS`.
3. Olhe as capturas em `tests/capturas/` (claro, escuro, celular e largo).
4. Atualize `CONTINUIDADE.md` e, se for o caso, `DOCUMENTACAO.md` e `README.md`.
5. Textos longos ou com aspas: use a ferramenta Write em arquivo temporário. O heredoc do bash quebra com aspas, crases ou `\n`.

(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el;
  PB.paginas = PB.paginas || {};

  const FONTES = [
    ["IBGE — SIDRA (API de agregados v3)", "https://servicodados.ibge.gov.br/api/docs/agregados?versao=3", "População, PIB, PNAD Contínua, CEMPRE, ODS, Censos e projeções"],
    ["IBGE — Malhas territoriais e localidades", "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3", "Contornos dos estados e municípios (qualidade mínima)"],
    ["TSE — Portal de dados abertos", "https://dadosabertos.tse.jus.br/", "Votação por candidato, município e zona; detalhe da votação (2002–2026, 1º turno)"],
    ["TSE — Divulgação de resultados", "https://resultados.tse.jus.br/", "2º turno de 2026 (totalização final), com a tabela oficial de código TSE → IBGE dos municípios"],
    ["Ministério da Saúde — TabNet (SIM e SINASC)", "http://tabnet.datasus.gov.br/", "Óbitos por causa (CID-10) e nascidos vivos, por UF de residência"],
    ["Banco Central — SGS", "https://www3.bcb.gov.br/sgspub/", "IPCA, Selic, câmbio, PIB real, dívida e salário mínimo"],
  ];
  const LACUNAS = [
    "Comércio exterior (Comex Stat) não entrou: a API e os arquivos do MDIC estavam fora do ar (erro 503) na coleta de 27/10/2026. O script de coleta pode ser estendido quando o serviço voltar.",
    "Atlas da Violência (Ipea): a API pública mudou de endereço e não respondeu. As taxas de homicídio foram calculadas direto do SIM/DataSUS com a mesma definição do Atlas (CID-10 X85–Y09 e Y35–Y36), por residência. Podem diferir alguns décimos das publicadas pelo Atlas, que usa outras estimativas de população.",
    "IDHM por UF não foi incluído: o Atlas Brasil (PNUD) não tem API aberta. No lugar, o painel oferece um índice composto configurável.",
    "PNAD Contínua começa em 2012: desocupação, rendimento, informalidade, Gini, pobreza e analfabetismo não têm dados para 2002–2011 na mesma metodologia.",
    "Esperança de vida, fecundidade, envelhecimento e idade mediana vêm da Projeção da População do IBGE (revisão 2018): são valores projetados, não observados ano a ano.",
    "Pobreza: os três indicadores seguem a definição dos indicadores ODS do IBGE (linhas internacional, nacional e regional). Os números diferem dos da Síntese de Indicadores Sociais, que usa outras linhas.",
    "População: 2007 é interpolado; 2023 repete o Censo 2022 (como o IBGE fez no PIB per capita de 2023). As estimativas de 2024 em diante usam nova metodologia, o que cria um salto de 2023 para 2024.",
    "Desocupação e rendimento anuais = média simples dos 4 trimestres. O IBGE divulga a média anual por outra conta; a diferença é de alguns décimos.",
    "Brasil nos dados do DataSUS = soma das UFs (exclui óbitos e nascimentos com residência ignorada).",
    "Municípios: o PIB per capita usa o último ano disponível (2023, ou 2021); os pesos setoriais usam o PIB de 2021 como denominador (inclui impostos). Municípios criados depois de 2002 não têm todas as eleições.",
    "Classificação esquerda/centro/direita dos partidos é editorial (mesma lógica usada pela Cubo Três) e está documentada na aba Governadores.",
  ];

  PB.paginas.fontes = {
    montar(alvo) {
      alvo.append(C.cabecalho("Dados e método", "De onde vem cada número", "Catálogo dos indicadores com fonte, período e a leitura de melhor ou pior (polaridade), além das limitações conhecidas."));
      const cc = C.cartao({ titulo: `Catálogo de indicadores (${PB.indicadores.length})`, sub: "A coluna Polaridade diz se subir é bom (↑), ruim (↓) ou se o indicador é neutro, e o porquê.", csv: () => baixarTudo() });
      const linhas = PB.indicadores.map((i) => ({ tema: i.tema, nome: i.nome, un: i.unidade, pol: i.polaridade, porque: i.porque, anos: i.anos[0] + "–" + i.anos[1], n: i.n_anos, fonte: i.fonte, nota: i.nota, _i: i }));
      cc.corpo.append(C.tabela([{ t: "Tema", k: "tema" }, { t: "Indicador", k: "nome" }, { t: "Unidade", k: "un" },
        { t: "Polaridade", k: "pol", fmt: (v, l) => C.selo(l._i, true) }, { t: "Por quê", k: "porque", fmt: (v) => el("span", { style: { whiteSpace: "normal", display: "block", minWidth: "260px" } }, v) },
        { t: "Período", k: "anos" }, { t: "Anos", k: "n", n: true }, { t: "Fonte", k: "fonte", fmt: (v) => el("span", { style: { whiteSpace: "normal", display: "block", minWidth: "240px" } }, v) }], linhas, { ordem: 0, desc: false }));
      cc.acoes.querySelector(".btn").textContent = "CSV com todos os dados";
      alvo.append(cc.cartao);

      const g = el("div", { class: "grade g2", style: { marginTop: "16px" } });
      alvo.append(g);
      const cf = C.cartao({ titulo: "Fontes oficiais", sub: "Coletadas por scripts em Python (pasta scripts/) em 27/10/2026, direto das APIs e arquivos públicos." });
      cf.corpo.append(el("ul", { style: { margin: 0, paddingLeft: "18px", fontSize: "13.5px" } }, ...FONTES.map(([n, u, d]) => el("li", { style: { marginBottom: "6px" } }, el("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, n), ": ", d))));
      cf.corpo.append(C.nota("Conferências feitas: totais nacionais de presidente 2002–2026 batem com o TSE (ex.: Lula 39.455.233 votos no 1º turno de 2002; 51,79% × 48,21% no 2º turno de 2026); PIB per capita do Brasil em 2023 = R$ 53.887 (IBGE: R$ 53.886,67); taxa de homicídios do Brasil em 2017 = 31,6 por 100 mil (Atlas da Violência: 31,6); IPCA 2015 = 10,67%."));
      g.append(cf.cartao);
      const cm = C.cartao({ titulo: "Como o painel lê melhor e pior", sub: "A polaridade é definida no catálogo (scripts/build.py) e usada em todas as telas." });
      cm.corpo.append(el("ul", { style: { margin: 0, paddingLeft: "18px", fontSize: "13.5px", lineHeight: 1.6 } },
        el("li", {}, "Selo em cada indicador: ↑ maior é melhor, ↓ menor é melhor ou neutro; a dica explica o motivo."),
        el("li", {}, "Variações dizem ", el("span", { class: "var bom" }, "melhorou"), " ou ", el("span", { class: "var ruim" }, "piorou"), " conforme a polaridade, nunca só pela seta."),
        el("li", {}, "Mapas em modo 'vs. Brasil' usam verde-azulado para melhor e laranja para pior; nunca vermelho e azul, reservados aos partidos."),
        el("li", {}, "Rankings sempre põem o melhor em 1º; indicadores neutros são ordenados do maior para o menor, e isso aparece escrito."),
        el("li", {}, "Indicadores políticos (voto por partido, brancos e nulos, margem) são neutros: o painel não os classifica."),
        el("li", {}, "No índice composto, os indicadores em que menor é melhor entram invertidos, para que 100 seja sempre a melhor situação.")));
      g.append(cm.cartao);

      const cl = C.cartao({ titulo: "Limitações e lacunas conhecidas" });
      cl.cartao.style.marginTop = "16px";
      cl.corpo.append(el("ul", { style: { margin: 0, paddingLeft: "18px", fontSize: "13.5px", lineHeight: 1.6 } }, ...LACUNAS.map((l) => el("li", {}, l))));
      alvo.append(cl.cartao);

      const ca = C.cartao({ titulo: "Como atualizar", sub: "Na pasta panorama-brasil, com Python 3.10+ (só biblioteca padrão):" });
      ca.cartao.style.marginTop = "16px";
      ca.corpo.append(el("pre", { style: { background: "var(--superficie-2)", padding: "10px 12px", borderRadius: "8px", overflow: "auto", fontSize: "12.5px", margin: 0 } },
        "python scripts/fetch_ibge.py      # IBGE (≈ 5 min)\npython scripts/fetch_datasus.py   # DataSUS TabNet (≈ 4 min)\npython scripts/fetch_bcb.py       # Banco Central\npython scripts/fetch_tse.py       # TSE (≈ 5 min; apague data/cache/tse/ok_<ano>.json para refazer um ano)\npython scripts/build.py           # gera web/data/*.js\n\nDepois: abra web/index.html, ou rode  node server.js  e acesse http://localhost:8080"));
      alvo.append(ca.cartao);

      function baixarTudo() {
        const linhas = [];
        PB.indicadores.forEach((i) => Object.entries(PB.D.valores[i.id]).forEach(([loc, s]) => Object.entries(s).forEach(([a, v]) => linhas.push([i.id, i.nome, i.unidade, PB.pol.rotulo(i), loc, PB.nomeLocal(loc), +a, v]))));
        PB.csv("panorama_brasil_todos_os_indicadores", ["id", "indicador", "unidade", "polaridade", "local", "nome do local", "ano", "valor"], linhas);
      }
    },
  };
})();

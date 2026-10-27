(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el, EL = PB.EL;
  PB.paginas = PB.paginas || {};

  const KPIS = ["populacao", "pib_per_capita", "desocupacao", "rendimento", "informalidade", "pobreza", "extrema_pobreza", "gini",
    "analfabetismo", "homicidios", "mortalidade_infantil", "esperanca_vida", "comparecimento", "macro_ipca"];
  const TABELA_REG = ["pib_pc_relativo", "desocupacao", "rendimento", "pobreza", "analfabetismo", "homicidios", "mortalidade_infantil", "voto_vencedor"];

  PB.paginas.inicio = {
    montar(alvo, p) {
      alvo.append(C.cabecalho("Panorama Brasil", "O Brasil em números, de 2002 a 2026",
        "Indicadores oficiais de economia, trabalho, pobreza, saúde, educação e violência dos 27 estados e 5 regiões, cruzados com as eleições presidenciais e de governador. Cada número tem fonte e diz se subir é bom ou ruim."));

      // Como ler a polaridade
      const exemplo = (pol) => C.selo({ polaridade: pol, porque: { maior: "Ex.: renda, esperança de vida.", menor: "Ex.: desemprego, homicídios, pobreza.", neutro: "Ex.: população, voto por partido." }[pol] });
      alvo.append(el("div", { class: "nota", style: { marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" } },
        el("strong", {}, "Como ler:"), exemplo("maior"), exemplo("menor"), exemplo("neutro"),
        el("span", {}, "Nas variações, "), el("span", { class: "var bom" }, "▲ melhorou"), el("span", {}, " e "), el("span", { class: "var ruim" }, "▼ piorou"),
        el("span", {}, " seguem a polaridade: queda do desemprego aparece como melhora. Passe o mouse no selo para ver o porquê.")));

      const kp = el("div", { class: "kpis" });
      KPIS.forEach((id) => PB.ind[id] && kp.append(C.kpi(id, "BR", { desde: 2002 })));
      const ck = C.cartao({ titulo: "Brasil: indicadores principais", sub: "Último ano disponível de cada fonte, variação sobre o ano anterior e desde o início da série. Clique para ver a série histórica.", fonte: "IBGE, Ministério da Saúde, TSE e Banco Central" });
      ck.corpo.append(kp);
      alvo.append(ck.cartao);

      const linha = el("div", { class: "grade g2", style: { marginTop: "16px" } });
      alvo.append(linha);

      // Última eleição
      const ano = EL.anos[EL.anos.length - 1];
      const turno = EL.temTurno(ano, 2) ? 2 : 1;
      const r = EL.resultado(ano, turno);
      const ce = C.cartao({ titulo: `Eleição presidencial de ${ano}: ${turno}º turno`, sub: "Quem liderou em cada estado. Tom mais forte = vantagem maior.", fonte: "TSE: dados abertos (1º turno) e divulgação oficial de resultados (2º turno de 2026)" });
      const cores = EL.cores(ano);
      const placar = el("div", { class: "placar", style: { marginBottom: "12px" } });
      r.candidatos.slice(0, turno === 2 ? 2 : 3).forEach((c, i) => {
        placar.append(el("div", { class: "cand", style: { "--cor": cores[c.nr] } },
          el("div", { class: "pos" }, i === 0 ? (turno === 2 ? "Eleito" : "1º lugar") : i + 1 + "º lugar"),
          el("div", { class: "nome" }, EL.nome(c)), el("div", { class: "partido" }, c.partido + " · " + c.nr),
          el("div", { class: "pct" }, PB.num(c.pct, 2) + "%"), el("div", { class: "votos" }, PB.inteiro(c.votos) + " votos válidos"),
          el("div", { class: "mini" }, el("span", { style: { width: c.pct + "%" } }))));
      });
      ce.corpo.append(placar);
      const mapa = el("div", { style: { maxWidth: "420px", margin: "0 auto", width: "100%" } });
      ce.corpo.append(mapa);
      PB.Mapa.uf(mapa, { forma: "grade", cor: (uf) => EL.corLider(ano, turno, uf), dica: (uf) => EL.dicaLider(ano, turno, uf), onclick: (uf) => PB.ir("eleicoes", { ano, turno, uf }),
        valorTexto: (uf) => { const l = EL.lider(ano, turno, uf); return l ? PB.num(l.pct, 0) + "%" : ""; } });
      ce.corpo.append(EL.legendaLider(ano, turno, PB.UFS));
      linha.append(ce.cartao);

      // Evolução do voto por região
      // medida neutra por padrão (vencedor da eleição); PT e candidato do governo como opções
      const medida = EL.MEDIDAS[(p || {}).voto] ? p.voto : "vencedor";
      const cv = EL.cartaoVotoRegioes(medida, (v) => { PB.setParams({ voto: v }); PB.rerender(); }, 440);
      linha.append(cv.cartao);
      cv.desenhar();
      cv.corpo.append(el("p", { class: "leitura" }, el("a", { href: "#/eleicoes?vista=historico" }, "Ver o histórico por estado →")));

      // Regiões × indicadores
      const cr = C.cartao({ titulo: "As cinco regiões lado a lado", sub: "Cor pela comparação com o Brasil: verde-azulado = melhor, laranja = pior. Indicadores neutros ficam sem cor.", fonte: "IBGE, Ministério da Saúde e TSE (último ano de cada indicador)" });
      const tab = el("table", { class: "tab" });
      const thead = el("thead", {}, el("tr", {}, el("th", {}, "Indicador"), ...["BR", ...PB.REGIOES].map((r) => el("th", { class: "n" }, PB.nomeLocal(r)))));
      const tbody = el("tbody");
      TABELA_REG.forEach((id) => {
        const ind = PB.ind[id];
        const a = PB.ultimoAno(id, false);
        const br = PB.valor(id, "BR", a);
        const tr = el("tr", {}, el("td", {}, el("div", { style: { fontWeight: 600 } }, ind.curto + " (" + a + ")"), C.selo(ind, true)));
        ["BR", ...PB.REGIOES].forEach((loc) => {
          const v = PB.valor(id, loc, a);
          const cmp = loc === "BR" ? 0 : PB.pol.compara(ind, v, br);
          const td = el("td", { class: "n", style: cmp ? { background: cmp > 0 ? "var(--melhor-fundo)" : "var(--pior-fundo)", color: cmp > 0 ? "var(--melhor)" : "var(--pior)", fontWeight: 700 } : {} }, PB.fmt(ind, v));
          td.setAttribute("data-dica", `${PB.nomeLocal(loc)}: ${PB.fmt(ind, v, true)}${cmp ? (cmp > 0 ? " · melhor que o Brasil" : " · pior que o Brasil") : ""}`);
          tr.append(td);
        });
        tbody.append(tr);
      });
      tab.append(thead, tbody);
      cr.corpo.append(el("div", { class: "tabela-caixa", style: { maxHeight: "none" } }, tab));
      cr.corpo.append(C.nota("Votos do vencedor da eleição é um indicador político: aparece sem cor de melhor ou pior."));
      cr.cartao.style.marginTop = "16px";
      alvo.append(cr.cartao);

      // Perguntas
      const perguntas = [
        ["explorar", "Onde o Brasil está melhor e pior?", "Mapa e ranking dos 27 estados para mais de 50 indicadores, com a leitura de melhor e pior em cada um."],
        ["correlacoes", "Renda, emprego e violência explicam o voto?", "Correlação, dispersão e regressão entre indicadores e o resultado eleitoral, por estado."],
        ["eleicoes", "Como cada estado votou de 2002 a 2026?", "Resultado por turno, mapa de quem liderou, viradas entre eleições e de onde vieram os votos."],
        ["municipios", "E nos 5.570 municípios?", "Voto por município cruzado com PIB per capita, urbanização e peso do setor público."],
        ["governadores", "Quem governou cada estado?", "Os governadores eleitos de 2002 a 2026, por partido e por campo político."],
        ["indice", "Qual estado tem a melhor situação geral?", "Monte um índice com os indicadores que importam para você, com pesos."],
        ["regioes", "As regiões estão ficando mais parecidas?", "Convergência entre estados: a distância entre ricos e pobres diminuiu?"],
        ["propostas", "O que cada candidato prometeu?", "Propostas antes do 1º turno, o que mudou entre os turnos e o que o governo fez no período."],
        ["macro", "Como a economia andou em cada mandato?", "PIB, inflação, juros, câmbio, dívida e salário mínimo de 2002 a 2026."],
      ];
      const cp = C.cartao({ titulo: "Perguntas que o painel responde" });
      cp.corpo.append(el("div", { class: "perguntas" }, ...perguntas.map(([p, t, d]) => el("a", { class: "pergunta", href: "#/" + p }, el("h3", {}, t), el("p", {}, d), el("span", { class: "ir" }, "Abrir →")))));
      cp.cartao.style.marginTop = "16px";
      alvo.append(cp.cartao);
    },
  };
})();

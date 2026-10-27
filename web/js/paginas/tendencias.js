(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el;
  PB.paginas = PB.paginas || {};
  const MAX = 6;
  const PALETA = ["#0f8fa3", "#eda100", "#e87ba4", "#6e4fe3", "#1baf7a", "#b0348f"];

  PB.paginas.tendencias = {
    montar(alvo, p) {
      const st = {
        ind: PB.ind[p.ind] ? p.ind : "desocupacao",
        locs: p.locs ? p.locs.split(",").filter((l) => PB.local[l]) : null,
        modo: p.modo || "valor",
      };
      // sem lugares na URL: seleção automática pelo indicador (pior região e pior estado), sem preferência fixa
      let auto = PB.selecaoAutomatica(st.ind);
      if (!st.locs || !st.locs.length) st.locs = auto.locs; else auto = { ...auto, texto: "" };
      const filtros = el("div", { class: "filtros" });
      const seletor = el("div", { class: "cartao", style: { marginBottom: "16px" } });
      const corpo = el("div");
      alvo.append(C.cabecalho("Séries históricas", "Como cada indicador evoluiu desde 2002", "Compare o Brasil, regiões e estados no mesmo gráfico. A tabela diz quem melhorou e quem piorou, conforme a polaridade do indicador."), filtros, seletor, corpo);
      const salva = () => PB.setParams({ ind: st.ind, locs: st.locs.join(","), modo: st.modo });
      filtros.append(
        C.selectIndicador("Indicador", st.ind, (v) => { st.ind = v; auto = PB.selecaoAutomatica(v); st.locs = auto.locs; salva(); chips(); desenha(); }),
        C.segmentado("Escala", [{ v: "valor", t: "Valor" }, { v: "base100", t: "Base 100", dica: "Primeiro ano comum = 100: compara o ritmo, não o nível" }], st.modo, (v) => { st.modo = v; salva(); desenha(); }),
        el("button", { class: "btn", type: "button", "data-dica": "Brasil + pior região + pior estado no último ano (ou os de maior valor, se o indicador for neutro)", onclick: () => { auto = PB.selecaoAutomatica(st.ind); st.locs = auto.locs; salva(); chips(); desenha(); } }, "Seleção automática"),
        el("button", { class: "btn", type: "button", onclick: () => { st.locs = ["BR"]; auto = { ...auto, texto: "" }; salva(); chips(); desenha(); } }, "Limpar seleção"),
      );
      const chips = () => {
        seletor.replaceChildren(el("p", { class: "sub", style: { margin: "0 0 8px" } }, `Escolha até ${MAX} lugares além do Brasil (clique para ligar ou desligar).`));
        if (auto.texto) seletor.append(el("p", { class: "leitura", style: { margin: "0 0 8px" } }, auto.texto));
        const grupo = (rot, ids) => el("div", { style: { display: "flex", gap: "8px", alignItems: "baseline", marginBottom: "6px", flexWrap: "wrap" } },
          el("strong", { style: { fontSize: "12px", minWidth: "92px", color: "var(--texto-3)" } }, rot),
          el("div", { class: "chips" }, ...ids.map((id) => {
            const on = st.locs.includes(id);
            const b = el("button", { class: "chip", type: "button", "aria-pressed": on, "data-dica": PB.nomeLocal(id) }, id === "BR" ? "Brasil" : PB.local[id].tipo === "regiao" ? PB.nomeLocal(id) : id);
            if (on) b.prepend(el("span", { class: "bolinha", style: { background: corDe(id) } }));
            b.addEventListener("click", () => {
              if (st.locs.includes(id)) st.locs = st.locs.filter((x) => x !== id);
              else if (st.locs.filter((x) => x !== "BR").length >= MAX && id !== "BR") { PB.aviso(`Máximo de ${MAX} lugares além do Brasil`); return; }
              else st.locs.push(id);
              auto = { ...auto, texto: "" };
              salva(); chips(); desenha();
            });
            return b;
          })));
        seletor.append(grupo("País", ["BR"]), grupo("Regiões", PB.REGIOES), ...PB.REGIOES.map((r) => grupo(PB.nomeLocal(r), PB.ufsDaRegiao(r))));
      };
      // a cor segue o lugar pela ordem em que entrou na seleção (estável enquanto ele estiver selecionado)
      const corDe = (id) => (id === "BR" ? PB.cor("--texto-3") : PALETA[st.locs.filter((x) => x !== "BR").indexOf(id) % PALETA.length]);

      const desenha = () => {
        PB.G.limpa();
        corpo.replaceChildren();
        const ind = PB.ind[st.ind];
        const locs = st.locs.filter((l) => PB.serie(st.ind, l).length);
        if (!locs.length) { corpo.append(C.vazio("Nenhum dos lugares escolhidos tem dado para este indicador.")); return; }
        // base 100 no primeiro ano comum a todos
        let baseAno = null;
        if (st.modo === "base100") {
          const comuns = PB.serie(st.ind, locs[0]).map((x) => x[0]).filter((a) => locs.every((l) => PB.valor(st.ind, l, a) != null && PB.valor(st.ind, l, a) !== 0));
          baseAno = comuns[0];
        }
        const series = locs.map((l) => {
          let d = PB.serie(st.ind, l);
          if (baseAno) { const b = PB.valor(st.ind, l, baseAno); d = d.filter(([a]) => a >= baseAno).map(([a, v]) => [a, (v / b) * 100]); }
          return { name: PB.nomeLocal(l), data: d, color: corDe(l), dash: l === "BR" ? 5 : 0 };
        });
        const anos = PB.anosDe(st.ind, false);
        const cg = C.cartao({ titulo: ind.nome, sub: (baseAno ? `Índice: ${baseAno} = 100. ` : PB.unidadeCurta(ind) + ". ") + "Linhas verticais = anos de eleição geral.", ind, fonte: ind.fonte,
          csv: () => PB.csv("serie_" + st.ind, ["Ano", ...locs.map(PB.nomeLocal)], anos.map((a) => [a, ...locs.map((l) => PB.valor(st.ind, l, a))])) });
        const gl = el("div");
        cg.corpo.append(gl);
        if (ind.nota) cg.corpo.append(C.nota(ind.nota));
        corpo.append(cg.cartao);
        PB.G.linha(gl, { series, ind: baseAno ? null : ind, base100: !!baseAno, altura: 380, xMin: anos[0], xMax: anos[anos.length - 1],
          anotacoes: PB.EL.anos.filter((a) => a >= anos[0] && a <= anos[anos.length - 1]).map((a) => ({ x: a })), linhasY: baseAno ? [{ y: 100, texto: baseAno + " = 100" }] : [] });
        C.alternaTabela(cg.acoes, gl, () => C.tabela([{ t: "Ano", k: "a" }, ...locs.map((l) => ({ t: l, k: l, n: true, fmt: (v) => PB.fmt(ind, v) }))],
          anos.map((a) => Object.fromEntries([["a", a], ...locs.map((l) => [l, PB.valor(st.ind, l, a)])])), { ordem: 0, desc: false }));

        // Resumo de variação por lugar
        const monetario = ["moeda", "moeda_grande", "int"].includes(ind.formato);
        const linhas = locs.map((l) => {
          const s = PB.serie(st.ind, l);
          const [a0, v0] = s[0], [a1, v1] = s[s.length - 1];
          const ord = PB.pol.ordena(ind, s.map(([a, v]) => [a, v]));
          return { l: PB.nomeLocal(l), a0, v0, a1, v1, d: v1 - v0, cagr: monetario ? PB.est.cagr(v0, v1, a1 - a0) : null, melhor: ord[0] && ord[0][0], pior: ord[ord.length - 1] && ord[ord.length - 1][0] };
        });
        const ct = C.cartao({ titulo: "Quem melhorou e quem piorou", sub: `Primeiro e último ano de cada série. ${PB.pol.rotulo(ind)}.`, fonte: ind.fonte });
        ct.cartao.style.marginTop = "16px";
        const cols = [{ t: "Lugar", k: "l" }, { t: "Início", k: "a0" }, { t: "Valor", k: "v0", n: true, fmt: (v) => PB.fmt(ind, v) }, { t: "Fim", k: "a1" }, { t: "Valor", k: "v1", n: true, fmt: (v) => PB.fmt(ind, v) },
          { t: "Variação", k: "d", n: true, fmt: (v) => C.variacao(ind, v) }];
        if (monetario) cols.push({ t: "Cresc. anual", k: "cagr", n: true, fmt: (v) => (v == null ? "–" : PB.num(v, 2) + "% a.a.") });
        if (ind.polaridade !== "neutro") cols.push({ t: "Melhor ano", k: "melhor" }, { t: "Pior ano", k: "pior" });
        else cols.push({ t: "Ano de maior valor", k: "melhor" }, { t: "Ano de menor valor", k: "pior" });
        ct.corpo.append(C.tabela(cols, linhas));
        if (monetario && ind.unidade === "R$") ct.corpo.append(C.nota("Valores nominais: parte do crescimento é inflação. Para comparar sem a inflação, use 'PIB per capita em relação ao Brasil' ou o rendimento real da PNAD."));
        corpo.append(ct.cartao);
      };
      chips();
      desenha();
    },
  };
})();

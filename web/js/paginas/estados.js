(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el, EL = PB.EL;
  PB.paginas = PB.paginas || {};

  /** posição de um local entre as UFs (1 = melhor) no último ano do indicador */
  PB.posicao = (id, uf, ano) => {
    const ind = PB.ind[id];
    ano = ano || PB.ultimoAno(id);
    const pares = PB.UFS.map((u) => [u, PB.valor(id, u, ano)]);
    const ord = PB.pol.ordena(ind, pares);
    const i = ord.findIndex((p) => p[0] === uf);
    return i < 0 ? null : { pos: i + 1, n: ord.length, ano, v: PB.valor(id, uf, ano), pctl: ord.length > 1 ? 1 - i / (ord.length - 1) : 0.5 };
  };

  PB.paginas.estados = {
    montar(alvo, p) {
      // Estado padrão: o mais populoso (critério objetivo, sem preferência regional)
      const maisPopuloso = PB.pol.ordena(PB.ind.populacao, PB.UFS.map((u) => [u, PB.valor("populacao", u, PB.ultimoAno("populacao"))]))[0][0];
      const st = { uf: PB.UFS.includes(p.uf) ? p.uf : maisPopuloso, cmp: PB.UFS.includes(p.cmp) ? p.cmp : "", voto: EL.MEDIDAS[p.voto] ? p.voto : "vencedor" };
      const filtros = el("div", { class: "filtros" });
      const corpo = el("div");
      alvo.append(C.cabecalho("Estados", "Ficha completa de cada estado", "Todos os indicadores do estado, a posição entre as 27 UFs (1º = melhor situação), a tendência e o histórico eleitoral."), filtros, corpo);
      const opUF = PB.REGIOES.map((r) => ({ grupo: PB.nomeLocal(r), itens: PB.ufsDaRegiao(r).map((u) => ({ v: u, t: PB.nomeLocal(u) + " (" + u + ")" })) }));
      filtros.append(
        C.select("Estado", opUF, st.uf, (v) => { st.uf = v; PB.setParams(st); desenha(); }),
        C.select("Comparar com", [{ v: "", t: "Ninguém (só Brasil)" }, ...opUF], st.cmp, (v) => { st.cmp = v; PB.setParams(st); desenha(); }),
      );

      const desenha = () => {
        PB.G.limpa();
        corpo.replaceChildren();
        const uf = st.uf, info = PB.local[uf];
        const anoPop = PB.ultimoAno("populacao");
        // Cabeçalho do estado
        const top = el("div", { class: "kpis", style: { marginBottom: "16px" } });
        ["populacao", "pib_per_capita", "desocupacao", "pobreza", "homicidios", "esperanca_vida"].forEach((id) => top.append(C.kpi(id, uf, { desde: 2002 })));
        const ca = C.cartao({ titulo: `${info.nome} · região ${PB.nomeLocal(info.regiao)}`, sub: `População de ${PB.compacto(PB.valor("populacao", uf, anoPop))} em ${anoPop}. Clique num indicador para ver a série.` });
        ca.corpo.append(top);
        corpo.append(ca.cartao);

        // Pontos fortes e de atenção (polaridade)
        const polares = PB.indicadores.filter((i) => i.polaridade !== "neutro" && i.tema !== "Macroeconomia" && !i.id.endsWith("_n"));
        const posicoes = polares.map((i) => ({ ind: i, ...PB.posicao(i.id, uf) })).filter((x) => x.pos);
        const fortes = [...posicoes].sort((a, b) => a.pos - b.pos).slice(0, 6);
        const fracos = [...posicoes].sort((a, b) => b.pos - a.pos).slice(0, 6);
        const g = el("div", { class: "grade g2", style: { marginTop: "16px" } });
        corpo.append(g);
        const lista = (itens, classe) => el("div", { class: "ranking" }, ...itens.map((x) => el("button", {
          class: "rk", type: "button", style: { gridTemplateColumns: "44px minmax(0,1fr) auto" },
          onclick: () => PB.ir("explorar", { ind: x.ind.id, uf, ano: x.ano }),
          "data-dica": `${x.ind.nome}: ${PB.fmt(x.ind, x.v, true)} (${x.ano}). ${PB.pol.rotulo(x.ind)}.`,
        }, el("span", { class: "selo " + classe }, x.pos + "º"), el("span", {}, x.ind.curto + " (" + x.ano + ")"), el("span", { class: "val" }, PB.fmt(x.ind, x.v)))));
        const cf = C.cartao({ titulo: "Pontos fortes", sub: "Indicadores em que o estado está entre os melhores do país (posição entre 27; 1º = melhor)." });
        cf.corpo.append(lista(fortes, "bom"));
        const cp = C.cartao({ titulo: "Pontos de atenção", sub: "Indicadores em que o estado está entre os piores do país." });
        cp.corpo.append(lista(fracos, "ruim"));
        g.append(cf.cartao, cp.cartao);

        // Ficha por tema
        const cfi = C.cartao({ titulo: "Todos os indicadores", sub: "Valor no último ano, posição entre as 27 UFs, faixa de pior a melhor e variação desde o início da série.", fonte: "Cada indicador tem a fonte no catálogo (aba Dados e método)",
          csv: () => PB.csv("ficha_" + uf, ["Tema", "Indicador", "Ano", "Valor", "Unidade", "Polaridade", "Posição", "Brasil"],
            PB.indicadores.filter((i) => i.tema !== "Macroeconomia").map((i) => { const a = PB.ultimoAno(i.id); const ps = PB.posicao(i.id, uf, a); return [i.tema, i.nome, a, PB.valor(i.id, uf, a), i.unidade, PB.pol.rotulo(i), ps ? ps.pos : "", PB.valor(i.id, "BR", a)]; })) });
        cfi.cartao.style.marginTop = "16px";
        const cab = el("div", { class: "ficha-linha", style: { fontWeight: 700, color: "var(--texto-3)", fontSize: "12px" } },
          el("span", {}, "Indicador"), el("span", { style: { textAlign: "right" } }, uf + (st.cmp ? " / " + st.cmp : "")), el("span", {}, "Pior ◀ posição ▶ melhor"), el("span", {}, "Variação na série"), el("span", { style: { textAlign: "right" } }, "Brasil"));
        cfi.corpo.append(cab);
        PB.temas.filter((t) => t !== "Macroeconomia").forEach((tema) => {
          const bloco = el("div", { class: "ficha-tema" }, el("h3", {}, tema));
          PB.indicadores.filter((i) => i.tema === tema).forEach((ind) => {
            const a = PB.ultimoAno(ind.id);
            const v = PB.valor(ind.id, uf, a);
            if (v == null) return;
            const ps = PB.posicao(ind.id, uf, a);
            const serie = PB.serie(ind.id, uf);
            const ini = serie[0];
            const vc = st.cmp ? PB.valor(ind.id, st.cmp, a) : null;
            const pctl = el("div", { class: "pctl" + (ind.polaridade === "neutro" ? " neutro" : ""), role: "img", "aria-label": ps ? `${ps.pos}º de ${ps.n}` : "" }, el("span", { style: { left: (ps ? ps.pctl * 100 : 50) + "%" } }));
            const linha = el("div", { class: "ficha-linha" },
              el("div", {}, el("div", { class: "nm" }, ind.curto + " (" + a + ")"), C.selo(ind, true)),
              el("div", { class: "vl" }, PB.fmt(ind, v), st.cmp ? el("div", { style: { fontWeight: 500, color: "var(--texto-3)" } }, st.cmp + ": " + PB.fmt(ind, vc)) : null),
              el("div", {}, pctl, el("div", { style: { fontSize: "11.5px", color: "var(--texto-3)", marginTop: "2px" } }, ps ? `${ps.pos}º de ${ps.n}` + (ind.polaridade === "neutro" ? " (por valor)" : "") : "")),
              el("div", {}, ini && ini[0] < a ? C.variacao(ind, v - ini[1], " desde " + ini[0]) : "–"),
              el("div", { class: "vl", style: { fontWeight: 500 } }, PB.fmt(ind, PB.valor(ind.id, "BR", a))));
            linha.style.cursor = "pointer";
            linha.addEventListener("click", () => PB.ir("tendencias", { ind: ind.id, locs: ["BR", PB.regiaoDe(uf), uf, st.cmp].filter(Boolean).join(",") }));
            bloco.append(linha);
          });
          if (bloco.children.length > 1) cfi.corpo.append(bloco);
        });
        corpo.append(cfi.cartao);

        // Eleições no estado
        const g3 = el("div", { class: "grade g2", style: { marginTop: "16px" } });
        corpo.append(g3);
        const MV = EL.medida(st.voto), indV = PB.ind[MV.ind];
        const cv = C.cartao({ titulo: "Voto para presidente no estado", sub: `${MV.t}: ${MV.desc}. % dos válidos no 2º turno.`, ind: indV, fonte: "TSE" });
        cv.corpo.append(el("div", { class: "filtros", style: { boxShadow: "none", border: 0, padding: "0 0 8px", margin: 0 } }, EL.selectMedida(st.voto, (v) => { st.voto = v; PB.setParams(st); desenha(); })));
        const gv = el("div");
        cv.corpo.append(gv, el("p", { class: "leitura" }, "Candidato em cada ano: " + EL.candidatosDaMedida(st.voto) + "."));
        g3.append(cv.cartao);
        const ser = [{ name: PB.nomeLocal(uf), data: PB.serie(MV.ind, uf), color: PB.cor("--marca") }, { name: "Brasil", data: PB.serie(MV.ind, "BR"), color: PB.cor("--texto-3"), dash: 5 }];
        if (st.cmp) ser.push({ name: PB.nomeLocal(st.cmp), data: PB.serie(MV.ind, st.cmp), color: PB.cor("--p-ambar") });
        PB.G.linha(gv, { series: ser, ind: indV, altura: 260, linhasY: [{ y: 50, texto: "50%" }], xMin: 2002, xMax: 2026 });
        const linhasEl = EL.anos.map((a) => {
          const t = EL.temTurno(a, 2) ? 2 : 1;
          const l = EL.lider(a, t, uf);
          const gov = EL.governador(a, uf);
          return { ano: a, venc: l ? EL.nome(l.cand) + " (" + l.cand.partido + ")" : "–", pct: l ? l.pct : null, gov: gov && gov.eleito ? PB.titulo(gov.eleito.nome) + " (" + gov.eleito.partido + ")" : "–", govpct: gov && gov.eleito ? gov.eleito.pct : null, t2: gov ? (gov.segundo_turno ? "sim" : "não") : "–" };
        });
        const ct = C.cartao({ titulo: "Quem venceu no estado", sub: "Presidente: mais votado no estado no turno final. Governador: eleito (1º ou 2º turno).", fonte: "TSE" });
        ct.corpo.append(C.tabela([{ t: "Ano", k: "ano" }, { t: "Presidente (mais votado no estado)", k: "venc" }, { t: "%", k: "pct", n: true, fmt: (v) => PB.num(v, 1) }, { t: "Governador eleito", k: "gov" }, { t: "%", k: "govpct", n: true, fmt: (v) => PB.num(v, 1) }, { t: "2º turno?", k: "t2" }], linhasEl, { ordem: 0, desc: false }));
        g3.append(ct.cartao);
      };
      desenha();
    },
  };
})();

(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el, EL = PB.EL;
  PB.paginas = PB.paginas || {};

  PB.paginas.governadores = {
    montar(alvo, p) {
      const st = { cor: p.cor || "partido", sel: p.sel || "" };
      const filtros = el("div", { class: "filtros" });
      const corpo = el("div");
      alvo.append(C.cabecalho("Governadores", "Quem foi eleito governador em cada estado", "Os governadores eleitos de 2002 a 2026 (1º ou 2º turno), por partido e por campo político. Clique numa célula para ver a disputa."), filtros, corpo);
      filtros.append(C.segmentado("Cor por", [{ v: "partido", t: "Partido" }, { v: "espectro", t: "Campo político", dica: "Classificação editorial: esquerda, direita e centro/outros" }], st.cor, (v) => { st.cor = v; PB.setParams(st); desenha(); }));

      const desenha = () => {
        PB.G.limpa();
        corpo.replaceChildren();
        const g = el("div", { class: "grade g-mapa" });
        corpo.append(g);
        const cg = C.cartao({ titulo: "Governadores eleitos, 2002 a 2026", sub: "Sigla do partido na data da eleição, nome e % dos votos válidos no turno decisivo.", fonte: "TSE, dados abertos e divulgação (2º turno de 2026)",
          csv: () => PB.csv("governadores", ["UF", "Ano", "Eleito", "Partido", "% válidos", "Teve 2º turno"], PB.UFS.flatMap((u) => EL.anos.map((a) => { const x = EL.governador(a, u); return [u, a, x && x.eleito ? PB.titulo(x.eleito.nome) : "", x && x.eleito ? x.eleito.partido : "", x && x.eleito ? x.eleito.pct : "", x ? (x.segundo_turno ? "sim" : "não") : ""]; }))) });
        const caixa = el("div", { class: "gov-grade" });
        const tab = el("table");
        tab.append(el("thead", {}, el("tr", {}, el("th", {}, "UF"), ...EL.anos.map((a) => el("th", {}, a)))));
        const tb = el("tbody");
        const corDe = (c) => (st.cor === "partido" ? PB.corPartido(c.partido) : PB.corEspectro(c.espectro));
        PB.REGIOES.forEach((r) => {
          tb.append(el("tr", {}, el("th", { colspan: EL.anos.length + 1, style: { paddingTop: "8px", color: "var(--texto-3)" } }, PB.nomeLocal(r))));
          PB.ufsDaRegiao(r).forEach((u) => {
            const tr = el("tr", {}, el("th", {}, u));
            EL.anos.forEach((a) => {
              const x = EL.governador(a, u);
              const e = x && x.eleito;
              if (!e) { tr.append(el("td", {}, "–")); return; }
              const bg = corDe(e);
              const chave = a + "-" + u;
              const td = el("td", { class: "c", tabindex: 0, role: "button", style: { background: bg, color: PB.textoSobre(bg), outline: st.sel === chave ? "3px solid var(--texto)" : null },
                "aria-label": `${PB.nomeLocal(u)}, ${a}: ${PB.titulo(e.nome)} (${e.partido}), ${PB.num(e.pct, 1)}%${x.segundo_turno ? ", eleito no 2º turno" : ", eleito no 1º turno"}`,
                "data-dica": `${PB.nomeLocal(u)} ${a}: ${PB.titulo(e.nome)} (${e.partido}) · ${PB.num(e.pct, 1)}% · ${x.segundo_turno ? "2º turno" : "1º turno"} · ${e.espectro}` },
              el("b", {}, e.partido + (x.segundo_turno ? " ²" : "")), el("span", {}, PB.titulo(e.nome).split(" ")[0] + " · " + PB.num(e.pct, 0) + "%"));
              const abre = () => { st.sel = chave; PB.setParams(st); desenha(); };
              td.addEventListener("click", abre);
              td.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abre(); } });
              tr.append(td);
            });
            tb.append(tr);
          });
        });
        tab.append(tb);
        caixa.append(tab);
        cg.corpo.append(caixa, el("p", { class: "leitura" }, "² = eleito no 2º turno."));
        if (st.cor === "espectro") cg.corpo.append(C.legendaCategorias([{ t: "Esquerda", cor: PB.corEspectro("esquerda") }, { t: "Centro / outros", cor: PB.corEspectro("centro") }, { t: "Direita", cor: PB.corEspectro("direita") }]),
          C.nota("Classificação editorial do partido (não do governador): esquerda = PT, PCdoB, PV, PSOL, REDE, PSB, PDT e menores; direita = PL/PR, PP/PPB, União/DEM/PFL, Republicanos/PRB, PSL, Novo, PSC, PTB, Podemos e menores; os demais (PSDB, MDB, PSD, Cidadania/PPS etc.) ficam em centro/outros."));
        g.append(cg.cartao);

        // Detalhe
        const lado = el("div", { class: "grade", style: { alignContent: "start" } });
        g.append(lado);
        if (st.sel) {
          const [a, u] = st.sel.split("-");
          const x = EL.governador(+a, u);
          const cd = C.cartao({ titulo: `${PB.nomeLocal(u)} · governador ${a}`, sub: x.segundo_turno ? "Houve 2º turno." : "Decidido no 1º turno.", fonte: "TSE" });
          Object.entries(x.turnos).forEach(([t, lista]) => {
            cd.corpo.append(el("h3", { style: { margin: "8px 0 4px" } }, t + "º turno"));
            lista.forEach((c) => {
              const cor = PB.corPartido(c.partido);
              cd.corpo.append(el("div", { class: "rk", style: { gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) 60px", cursor: "default" } },
                el("span", {}, el("strong", {}, PB.titulo(c.nome)), " ", el("span", { style: { color: "var(--texto-3)" } }, c.partido), c.eleito ? el("span", { class: "selo", style: { marginLeft: "6px" } }, "eleito") : null),
                el("span", { class: "trilho" }, el("span", { class: "barra", style: { width: (c.pct || 0) + "%", background: cor } })),
                el("span", { class: "val" }, PB.num(c.pct, 1) + "%")));
            });
          });
          lado.append(cd.cartao);
        }
        // Contagem por campo e alinhamento com o presidente
        const cc = C.cartao({ titulo: "Governadores por campo político", sub: "Número de estados por ano. Classificação editorial pelo partido.", fonte: "TSE" });
        const gc = el("div");
        cc.corpo.append(gc);
        lado.append(cc.cartao);
        const contar = (a, f) => PB.UFS.filter((u) => { const x = EL.governador(a, u); return x && x.eleito && f(x.eleito); }).length;
        PB.G.barras(gc, { categorias: EL.anos.map(String), empilhada: true, rotulos: true, altura: 280,
          series: [["esquerda", "Esquerda"], ["centro/outros", "Centro / outros"], ["direita", "Direita"]].map(([k, t]) => ({ name: t, color: PB.corEspectro(k === "centro/outros" ? "centro" : k), data: EL.anos.map((a) => contar(a, (e) => e.espectro === k)) })), fmt: (v) => PB.num(v, 0) });
        const alinh = EL.anos.map((a) => {
          const r = EL.resultado(a, EL.temTurno(a, 2) ? 2 : 1);
          const pp = r.candidatos[0].partido;
          return { a, pres: EL.nome(r.candidatos[0]) + " (" + pp + ")", n: contar(a, (e) => e.partido === pp) };
        });
        cc.corpo.append(C.tabela([{ t: "Ano", k: "a" }, { t: "Presidente eleito", k: "pres" }, { t: "Governadores do mesmo partido", k: "n", n: true }], alinh, { ordem: 0, desc: false }));

        // Partidos que mais elegeram
        const porPartido = {};
        EL.anos.forEach((a) => PB.UFS.forEach((u) => { const x = EL.governador(a, u); if (x && x.eleito) { const pp = x.eleito.partido; (porPartido[pp] = porPartido[pp] || {})[a] = ((porPartido[pp] || {})[a] || 0) + 1; } }));
        const linhas = Object.entries(porPartido).map(([pp, m]) => ({ pp, total: Object.values(m).reduce((s, v) => s + v, 0), ...Object.fromEntries(EL.anos.map((a) => ["a" + a, m[a] || null])) })).sort((a, b) => b.total - a.total);
        const ct = C.cartao({ titulo: "Partidos que mais elegeram governadores", sub: "Siglas como registradas em cada eleição (PMDB virou MDB; PFL virou DEM e depois União; PR virou PL; PRB virou Republicanos).", fonte: "TSE" });
        ct.cartao.style.marginTop = "16px";
        ct.corpo.append(C.tabela([{ t: "Partido", k: "pp" }, { t: "Total", k: "total", n: true }, ...EL.anos.map((a) => ({ t: String(a), k: "a" + a, n: true }))], linhas, { ordem: 1 }));
        corpo.append(ct.cartao);
      };
      desenha();
    },
  };
})();

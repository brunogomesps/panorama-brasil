(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el, EL = PB.EL;
  PB.paginas = PB.paginas || {};

  PB.paginas.regioes = {
    montar(alvo, p) {
      const st = { ind: PB.ind[p.ind] ? p.ind : "pib_pc_relativo" };
      const filtros = el("div", { class: "filtros" });
      const corpo = el("div");
      alvo.append(C.cabecalho("Regiões", "As cinco regiões e a distância entre elas", "Evolução por região, posição no último ano, convergência entre estados e o peso de cada região na população, na economia e no eleitorado."), filtros, corpo);
      filtros.append(C.selectIndicador("Indicador", st.ind, (v) => { st.ind = v; PB.setParams(st); desenha(); }, (i) => i.tema !== "Macroeconomia"));

      const desenha = () => {
        PB.G.limpa();
        corpo.replaceChildren();
        const ind = PB.ind[st.ind];
        const anos = PB.anosDe(st.ind, false);
        const g = el("div", { class: "grade g2" });
        corpo.append(g);

        const cl = C.cartao({ titulo: ind.nome + ": evolução por região", sub: PB.unidadeCurta(ind) + ". Linha tracejada = Brasil.", ind, fonte: ind.fonte });
        const gl = el("div");
        cl.corpo.append(gl);
        g.append(cl.cartao);
        const series = PB.REGIOES.map((r) => ({ name: PB.nomeLocal(r), data: PB.serie(st.ind, r), color: PB.corRegiao(r) }))
          .concat([{ name: "Brasil", data: PB.serie(st.ind, "BR"), color: PB.cor("--texto-3"), dash: 5 }]).filter((s) => s.data.length);
        if (series.length) PB.G.linha(gl, { series, ind, altura: 320, xMin: anos[0], xMax: anos[anos.length - 1] });
        else gl.append(C.vazio("Indicador sem dado por região."));
        if (ind.nota) cl.corpo.append(C.nota(ind.nota));

        const a = anos[anos.length - 1];
        const br = PB.valor(st.ind, "BR", a);
        const cb = C.cartao({ titulo: `Regiões em ${a}`, sub: PB.pol.criterioRanking(ind) + ".", ind, fonte: ind.fonte });
        const pares = PB.REGIOES.map((r) => [r, PB.valor(st.ind, r, a)]);
        const esc = PB.escala(ind, pares.map((x) => x[1]), "desempenho", br);
        const rk = C.ranking(ind, pares, { corDe: (v) => esc.cor(v), brasil: br, onclick: () => {} });
        rk.querySelectorAll(".uf").forEach((s) => (s.style.minWidth = "28px"));
        cb.corpo.append(rk);
        pares.forEach(([r, v]) => {
          const cmp = PB.pol.compara(ind, v, br);
          if (cmp) cb.corpo.append(el("div", { style: { fontSize: "12.5px", marginTop: "4px" } }, el("strong", {}, PB.nomeLocal(r) + ": "), el("span", { class: "var " + (cmp > 0 ? "bom" : "ruim") }, cmp > 0 ? "melhor que o Brasil" : "pior que o Brasil"), ` (${PB.fmt(ind, v, true)})`));
        });
        g.append(cb.cartao);

        // Convergência beta
        const anosUF = PB.anosDe(st.ind, true);
        const a0 = anosUF[0], a1 = anosUF[anosUF.length - 1];
        const monetario = ["moeda", "moeda_grande", "int"].includes(ind.formato);
        const pts = PB.UFS.map((u) => {
          const v0 = PB.valor(st.ind, u, a0), v1 = PB.valor(st.ind, u, a1);
          if (v0 == null || v1 == null) return null;
          const y = monetario ? PB.est.cagr(v0, v1, a1 - a0) : v1 - v0;
          return y == null ? null : { id: u, x: v0, y, rotulo: u, cor: PB.corRegiao(PB.regiaoDe(u)),
            dica: `<div class="t">${PB.esc(PB.nomeLocal(u))}</div>${a0}: ${PB.esc(PB.fmt(ind, v0, true))}<br>${a1}: ${PB.esc(PB.fmt(ind, v1, true))}<br>${monetario ? "Crescimento: " + PB.num(y, 2) + "% ao ano" : "Variação: " + PB.esc(PB.fmtDelta(ind, y))}` };
        }).filter(Boolean);
        const cc = C.cartao({ titulo: "Quem estava atrás avançou mais?", sub: `Cada ponto é um estado: valor em ${a0} (eixo horizontal) × ${monetario ? "crescimento anual médio" : "variação"} até ${a1} (eixo vertical).`, fonte: "Cálculo sobre " + ind.fonte,
          info: "Convergência beta: se a reta desce, os estados que começaram com valor menor cresceram mais e a distância entre eles tende a cair. Se sobe, os que já tinham mais avançaram mais (divergência)." });
        cc.cartao.style.marginTop = "16px";
        const gs = el("div");
        cc.corpo.append(gs);
        corpo.append(cc.cartao);
        if (pts.length > 4 && a1 > a0) {
          const m = PB.est.mqo(pts.map((q) => [q.x]), pts.map((q) => q.y));
          const r = PB.est.pearson(pts.map((q) => q.x), pts.map((q) => q.y));
          PB.G.dispersao(gs, { pontos: pts, xRot: `${ind.curto} em ${a0} (${PB.unidadeCurta(ind)})`, yRot: monetario ? `Crescimento anual ${a0}–${a1} (%)` : `Variação ${a0}–${a1}`, fx: (v) => PB.fmt(ind, v), fy: (v) => PB.num(v, 1), reta: { a: m.beta[0], b: m.beta[1] }, altura: 400, onclick: (u) => PB.ir("estados", { uf: u }) });
          cc.corpo.append(C.legendaCategorias(PB.REGIOES.map((r) => ({ t: PB.nomeLocal(r), cor: PB.corRegiao(r) }))));
          const conv = m.beta[1] < 0;
          const pv = PB.est.pCorrelacao(r, pts.length);
          cc.corpo.append(C.nota(`Inclinação ${conv ? "negativa" : "positiva"} (r = ${PB.num(r, 2)}, ${PB.est.forca(r)}${pv != null ? ", p = " + PB.num(pv, 3) : ""}): ${conv ? "sinal de convergência — os estados que começaram com valor menor tiveram " + (monetario ? "crescimento" : "variação") + " maior." : "sem convergência — os estados que já tinham valor maior avançaram mais."} ${ind.polaridade === "menor" ? "Atenção: neste indicador, valor menor é melhor." : ""}`));
        } else gs.append(C.vazio("Série insuficiente para medir convergência."));

        // Peso das regiões
        const anoPop = PB.ultimoAno("populacao"), anoPib = PB.ultimoAno("pib");
        const ultEl = EL.anos[EL.anos.length - 1];
        const comp = PB.D.eleicoes.comparecimento[ultEl][1];
        const peso = (fn) => { const t = PB.REGIOES.reduce((s, r) => s + (fn(r) || 0), 0); return PB.REGIOES.map((r) => ((fn(r) || 0) / t) * 100); };
        const linhas = [
          ["População " + anoPop, peso((r) => PB.valor("populacao", r, anoPop))],
          ["PIB " + anoPib, peso((r) => PB.valor("pib", r, anoPib))],
          ["Eleitorado " + ultEl, peso((r) => comp[r] && comp[r].aptos)],
          ["Empresas " + PB.ultimoAno("empresas_mil_hab"), peso((r) => (PB.valor("empresas_mil_hab", r, PB.ultimoAno("empresas_mil_hab")) || 0) * (PB.valor("populacao", r, PB.ultimoAno("empresas_mil_hab")) || 0))],
          ["Homicídios " + PB.ultimoAno("homicidios_n"), peso((r) => PB.valor("homicidios_n", r, PB.ultimoAno("homicidios_n")))],
        ];
        const cp = C.cartao({ titulo: "O peso de cada região", sub: "Participação no total do Brasil (%). Compare o peso na população com o peso na economia.", fonte: "IBGE, TSE e Ministério da Saúde" });
        cp.cartao.style.marginTop = "16px";
        const gp = el("div");
        cp.corpo.append(gp);
        corpo.append(cp.cartao);
        PB.G.barras(gp, { categorias: linhas.map((l) => l[0]), horizontal: true, empilhada: true, cem: true, rotulos: true, altura: 300,
          series: PB.REGIOES.map((r, i) => ({ name: PB.nomeLocal(r), data: linhas.map((l) => +l[1][i].toFixed(1)), color: PB.corRegiao(r) })), fmt: (v) => PB.num(v, 1) + "%" });
        const ne = linhas.map((l) => l[1][1]);
        cp.corpo.append(C.nota(`O Nordeste tem ${PB.num(ne[0], 1)}% da população e ${PB.num(ne[1], 1)}% do PIB; o Sudeste, ${PB.num(linhas[0][1][2], 1)}% da população e ${PB.num(linhas[1][1][2], 1)}% do PIB.`));
      };
      desenha();
    },
  };
})();

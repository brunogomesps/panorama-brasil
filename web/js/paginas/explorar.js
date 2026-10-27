(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el;
  PB.paginas = PB.paginas || {};

  /** dica padrão de uma UF para um indicador num ano (valor, posição, comparação com o Brasil) */
  PB.dicaUF = (ind, uf, ano, pares, br) => {
    const v = PB.valor(ind.id, uf, ano);
    if (v == null) return `<div class="t">${PB.esc(PB.nomeLocal(uf))}</div>sem dado em ${ano}`;
    const ord = PB.pol.ordena(ind, pares);
    const pos = ord.findIndex((p) => p[0] === uf) + 1;
    const cmp = PB.pol.compara(ind, v, br);
    const dif = br ? ((v - br) / Math.abs(br)) * 100 : null;
    let linhaBr = "";
    if (br != null) {
      linhaBr = `<br>Brasil: ${PB.esc(PB.fmt(ind, br, true))} · ${dif >= 0 ? "+" : "−"}${PB.num(Math.abs(dif), 1)}%`;
      if (cmp) linhaBr += ` · <b style="color:var(${cmp > 0 ? "--melhor" : "--pior"})">${cmp > 0 ? "melhor" : "pior"} que o Brasil</b>`;
    }
    return `<div class="t">${PB.esc(PB.nomeLocal(uf))} · ${ano}</div><b>${PB.esc(PB.fmt(ind, v, true))}</b>` +
      `<br>${pos}º de ${ord.length} <span class="l">(${PB.esc(PB.pol.criterioRanking(ind))})</span>${linhaBr}` +
      `<br><span class="l">Leitura: ${PB.esc(PB.pol.rotulo(ind).toLowerCase())}</span>`;
  };

  PB.paginas.explorar = {
    montar(alvo, p) {
      const st = {
        ind: PB.ind[p.ind] ? p.ind : "homicidios",
        escala: p.escala || "desempenho",
        forma: p.forma || "mapa",
        uf: p.uf || "",
        reg: p.reg || "",
      };
      const anosDe = () => PB.anosDe(st.ind, true);
      st.ano = +p.ano && anosDe().includes(+p.ano) ? +p.ano : PB.ultimoAno(st.ind);

      alvo.append(C.cabecalho("Mapa e ranking", "Onde cada estado está melhor e pior",
        "Escolha um indicador e um ano. O mapa e o ranking já dizem se o número alto é bom ou ruim, e comparam cada estado com o Brasil."));
      const filtros = el("div", { class: "filtros" });
      const corpo = el("div");
      alvo.append(filtros, corpo);

      const desenhaFiltros = () => {
        filtros.replaceChildren(
          C.selectIndicador("Indicador", st.ind, (v) => { st.ind = v; st.ano = PB.ultimoAno(v); salva(); desenhaFiltros(); desenha(); }, (i) => i.tema !== "Macroeconomia"),
          C.anoSlider("Ano", anosDe(), st.ano, (a) => { st.ano = a; salva(); desenha(); }),
          C.segmentado("Cores", [
            { v: "desempenho", t: "vs. Brasil", dica: "Verde-azulado = melhor que o Brasil; laranja = pior" },
            { v: "quintis", t: "Quintis", dica: "5 grupos com o mesmo número de estados" },
            { v: "continua", t: "Contínua", dica: "Escala proporcional ao valor" },
          ], st.escala, (v) => { st.escala = v; salva(); desenha(); }),
          C.segmentado("Forma", [{ v: "mapa", t: "Mapa" }, { v: "grade", t: "Grade", dica: "Cartograma: todo estado do mesmo tamanho, para a área não enganar" }], st.forma, (v) => { st.forma = v; salva(); desenha(); }),
          C.select("Região", [{ v: "", t: "Todas" }, ...PB.REGIOES.map((r) => ({ v: r, t: PB.nomeLocal(r) }))], st.reg, (v) => { st.reg = v; salva(); desenha(); }),
        );
      };
      const salva = () => PB.setParams({ ind: st.ind, ano: st.ano, escala: st.escala, forma: st.forma, uf: st.uf, reg: st.reg });

      const desenha = () => {
        PB.G.limpa();
        corpo.replaceChildren();
        const ind = PB.ind[st.ind];
        const ufs = st.reg ? PB.ufsDaRegiao(st.reg) : PB.UFS;
        const pares = ufs.map((u) => [u, PB.valor(st.ind, u, st.ano)]);
        const br = PB.valor(st.ind, "BR", st.ano);
        const esc = PB.escala(ind, pares.map((x) => x[1]), st.escala, br);
        const sel = (uf) => { st.uf = st.uf === uf ? "" : uf; salva(); desenha(); };

        const g = el("div", { class: "grade g-mapa" });
        corpo.append(g);
        const cm = C.cartao({
          titulo: `${ind.nome} · ${st.ano}`, ind,
          sub: `${PB.unidadeCurta(ind)}. ${st.reg ? "Região " + PB.nomeLocal(st.reg) + ". " : ""}Clique num estado para destacar; clique de novo para limpar.`,
          fonte: ind.fonte,
          info: "Cores 'vs. Brasil': divergente em torno do valor nacional, orientada pela polaridade do indicador. Quintis: cada cor reúne 1/5 dos estados. Indicadores neutros usam um só matiz (mais escuro = maior).",
          csv: () => PB.csv(`${ind.id}_${st.ano}`, ["UF", "Estado", "Região", ind.nome + " (" + ind.unidade + ")", "Posição (1 = " + (ind.polaridade === "neutro" ? "maior" : "melhor") + ")"],
            PB.pol.ordena(ind, pares).map(([u, v], i) => [u, PB.nomeLocal(u), PB.regiaoDe(u), v, i + 1])),
        });
        const mapa = el("div");
        cm.corpo.append(mapa);
        const mapaCor = (uf) => (ufs.includes(uf) ? (PB.valor(st.ind, uf, st.ano) == null ? null : esc.cor(PB.valor(st.ind, uf, st.ano))) : PB.cor("--superficie-3"));
        PB.Mapa.uf(mapa, {
          forma: st.forma, selecionado: st.uf, cor: mapaCor,
          dica: (uf) => PB.dicaUF(ind, uf, st.ano, pares, br), onclick: sel,
          valorTexto: st.forma === "grade" ? (uf) => (ufs.includes(uf) ? PB.fmt(ind, PB.valor(st.ind, uf, st.ano)) : "") : null,
        });
        cm.corpo.append(C.legendaEscala(ind, esc));
        if (ind.nota) cm.corpo.append(C.nota(ind.nota));
        C.alternaTabela(cm.acoes, mapa, () => C.tabela(
          [{ t: "UF", k: "uf" }, { t: "Estado", k: "nome" }, { t: "Valor", k: "v", n: true, fmt: (v) => PB.fmt(ind, v) }, { t: "vs. Brasil", k: "d", n: true, fmt: (v) => (v == null ? "–" : C.variacao(ind, v)) }],
          pares.map(([u, v]) => ({ uf: u, nome: PB.nomeLocal(u), v, d: v != null && br != null ? v - br : null })), { ordem: 2 }));
        g.append(cm.cartao);

        const cr = C.cartao({ titulo: "Ranking dos estados", sub: PB.pol.criterioRanking(ind) + ". A linha em itálico é o Brasil.", fonte: ind.fonte });
        cr.corpo.append(C.ranking(ind, pares, { corDe: (v) => esc.cor(v), brasil: br, destaque: st.uf, onclick: sel }));
        g.append(cr.cartao);

        // Estatísticas e desigualdade entre estados
        const g2 = el("div", { class: "grade g2", style: { marginTop: "16px" } });
        corpo.append(g2);
        const ce = C.cartao({ titulo: "Resumo entre os estados", sub: `${st.ano}. O coeficiente de variação mede o quanto os estados diferem entre si.`, fonte: ind.fonte });
        ce.corpo.append(C.estatisticas(ind, pares, br));
        if (st.uf) {
          const v = PB.valor(st.ind, st.uf, st.ano);
          const ord = PB.pol.ordena(ind, pares);
          const pos = ord.findIndex((x) => x[0] === st.uf) + 1;
          const serieUf = PB.serie(st.ind, st.uf);
          const ini = serieUf[0];
          const box = el("div", { class: "nota", style: { marginTop: "12px" } });
          box.append(el("strong", {}, PB.nomeLocal(st.uf) + ": "), `${PB.fmt(ind, v, true)} em ${st.ano}, ${pos}º de ${ord.length}. `);
          if (ini && ini[0] < st.ano && v != null) box.append(`Desde ${ini[0]}: `, C.variacao(ind, v - ini[1]), ". ");
          box.append(el("a", { href: `#/estados?uf=${st.uf}` }, "Ver a ficha completa do estado →"));
          ce.corpo.append(box);
        }
        g2.append(ce.cartao);

        const anos = PB.anosDe(st.ind, true);
        const cvs = anos.map((a) => {
          const vs = PB.UFS.map((u) => PB.valor(st.ind, u, a)).filter((v) => v != null);
          return [a, vs.length > 5 ? PB.est.cv(vs) : null];
        }).filter((x) => x[1] != null);
        const cc = C.cartao({ titulo: "Os estados estão ficando mais parecidos?", sub: "Coeficiente de variação entre as 27 UFs, ano a ano. Queda = convergência (estados mais próximos entre si).", fonte: "Cálculo sobre " + ind.fonte,
          info: "Coeficiente de variação = desvio-padrão ÷ média × 100. Mede dispersão relativa, independentemente da unidade. É uma medida de convergência sigma." });
        const gl = el("div");
        cc.corpo.append(gl);
        g2.append(cc.cartao);
        if (cvs.length > 1) {
          PB.G.linha(gl, { series: [{ name: "Coeficiente de variação entre UFs (%)", data: cvs, color: PB.cor("--marca") }], altura: 240, xMin: anos[0], xMax: anos[anos.length - 1] });
          const d = cvs[cvs.length - 1][1] - cvs[0][1];
          cc.corpo.append(C.nota(`De ${cvs[0][0]} a ${cvs[cvs.length - 1][0]} a dispersão ${d < 0 ? "caiu" : "subiu"} ${PB.num(Math.abs(d), 1)} pontos: os estados ficaram ${d < 0 ? "mais parecidos" : "mais diferentes"} neste indicador.`));
        } else gl.append(C.vazio("Série curta demais para medir a convergência."));
      };
      desenhaFiltros();
      desenha();
    },
  };
})();

(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el;
  PB.paginas = PB.paginas || {};

  // Mandatos presidenciais (Dilma até o afastamento definitivo em 31/08/2016)
  const MANDATOS = [
    { t: "Lula 1 e 2", de: 2003, ate: 2010, x0: 2002.5, x1: 2010.5 },
    { t: "Dilma", de: 2011, ate: 2016, x0: 2010.5, x1: 2016.67 },
    { t: "Temer", de: 2017, ate: 2018, x0: 2016.67, x1: 2018.5 },
    { t: "Bolsonaro", de: 2019, ate: 2022, x0: 2018.5, x1: 2022.5 },
    { t: "Lula 3", de: 2023, ate: 2026, x0: 2022.5, x1: 2026.5 },
  ];
  const GRAFICOS = [
    ["macro_pib_real", "--marca"], ["macro_ipca", "--p-pdt"], ["macro_selic", "--seq-5"], ["macro_cambio", "--reg-CO"],
    ["macro_divida_bruta", "--p-psb"], ["desocupacao", "--reg-N"],
  ];

  PB.paginas.macro = {
    montar(alvo) {
      alvo.append(C.cabecalho("Economia nacional", "A economia brasileira de 2002 a 2026", "PIB, inflação, juros, câmbio, dívida, emprego e salário mínimo, com os mandatos presidenciais sombreados. Cada gráfico diz se subir é bom ou ruim."));
      alvo.append(C.nota("Resultados econômicos dependem de fatores externos (crise de 2008–09, preço de commodities, pandemia de 2020) e de decisões de governos anteriores. As faixas de mandato ajudam a localizar o período, não atribuem causa."));
      const faixas = MANDATOS.map((m, i) => ({ de: m.x0, ate: m.x1, texto: m.t, cor: i % 2 ? PB.cor("--superficie-3") : PB.cor("--superficie-2") }));
      const g = el("div", { class: "grade g2", style: { marginTop: "16px" } });
      alvo.append(g);
      GRAFICOS.forEach(([id, cor]) => {
        const ind = PB.ind[id];
        if (!ind) return;
        const s = PB.serie(id, "BR").filter(([a]) => a >= 2002);
        const c = C.cartao({ titulo: ind.nome, sub: ind.unidade, ind, fonte: ind.fonte, csv: () => PB.csv(id, ["Ano", ind.nome], s) });
        const d = el("div");
        c.corpo.append(d);
        g.append(c.cartao);
        PB.G.linha(d, { series: [{ name: ind.curto, data: s, color: PB.cor(cor) }], ind, altura: 250, xMin: 2002, xMax: 2026, faixas, linhasY: id === "macro_pib_real" ? [{ y: 0, texto: "0%" }] : [] });
        if (ind.nota) c.corpo.append(C.nota(ind.nota));
      });

      // Salário mínimo nominal e real
      const sm = PB.serie("macro_salario_minimo", "BR");
      const ipca = Object.fromEntries(PB.serie("macro_ipca", "BR"));
      const anoRef = Math.max(...Object.keys(ipca).map(Number));
      const real = sm.map(([a, v]) => { let f = 1; for (let y = a + 1; y <= anoRef; y++) f *= 1 + (ipca[y] || 0) / 100; return [a, v * f]; }).filter(([a]) => a <= anoRef);
      const indSM = { ...PB.ind.macro_salario_minimo };
      const cs = C.cartao({ titulo: "Salário mínimo: nominal e real", sub: `Valor de dezembro. Real = corrigido pelo IPCA para preços de dezembro de ${anoRef}.`, ind: indSM, fonte: "Banco Central (SGS 1619 e 433); deflação calculada no painel" });
      const ds = el("div");
      cs.corpo.append(ds);
      g.append(cs.cartao);
      PB.G.linha(ds, { series: [{ name: "Nominal", data: sm, color: PB.cor("--texto-3"), dash: 5 }, { name: `Real (R$ de dez/${anoRef})`, data: real, color: PB.cor("--melhor") }], ind: indSM, altura: 250, xMin: 2002, xMax: 2026, faixas });
      const ganho = (real[real.length - 1][1] / real[0][1] - 1) * 100;
      cs.corpo.append(C.nota(`Ganho real de ${PB.num(ganho, 0)}% entre ${real[0][0]} e ${real[real.length - 1][0]}.`));

      // Rendimento real (PNAD)
      const ir = PB.ind.rendimento;
      const cr = C.cartao({ titulo: ir.nome, sub: "R$, média anual (PNAD Contínua, desde 2012).", ind: ir, fonte: ir.fonte });
      const dr = el("div");
      cr.corpo.append(dr);
      g.append(cr.cartao);
      PB.G.linha(dr, { series: [{ name: "Brasil", data: PB.serie("rendimento", "BR"), color: PB.cor("--reg-CO") }], ind: ir, altura: 250, xMin: 2002, xMax: 2026, faixas });

      // Médias por mandato
      const media = (id, m) => { const v = PB.serie(id, "BR").filter(([a]) => a >= m.de && a <= m.ate).map((x) => x[1]); return v.length ? PB.est.media(v) : null; };
      const fim = (id, m) => { const v = PB.serie(id, "BR").filter(([a]) => a <= m.ate); return v.length ? v[v.length - 1][1] : null; };
      const ini = (id, m) => { const v = PB.serie(id, "BR").filter(([a]) => a < m.de); return v.length ? v[v.length - 1][1] : null; };
      const linhas = MANDATOS.map((m) => ({
        t: `${m.t} (${m.de}–${m.ate})`, pib: media("macro_pib_real", m), ipca: media("macro_ipca", m), selic: fim("macro_selic", m),
        div: fim("macro_divida_bruta", m) != null && ini("macro_divida_bruta", m) != null ? fim("macro_divida_bruta", m) - ini("macro_divida_bruta", m) : null,
        des: fim("desocupacao", m) != null && ini("desocupacao", m) != null && m.de > 2012 ? fim("desocupacao", m) - ini("desocupacao", m) : null,
      }));
      const ct = C.cartao({ titulo: "Indicadores por mandato", sub: "Médias anuais no período; dívida e desocupação comparam o fim do mandato com o ano anterior ao início. 2026 ainda incompleto.", fonte: "Banco Central e IBGE" });
      ct.cartao.style.marginTop = "16px";
      const v = (id) => (x) => (x == null ? "–" : C.variacao(PB.ind[id], x));
      ct.corpo.append(C.tabela([{ t: "Mandato", k: "t" }, { t: "PIB real (média % a.a.) ↑", k: "pib", n: true, fmt: (x) => PB.num(x, 2) }, { t: "IPCA (média % a.a.) ↓", k: "ipca", n: true, fmt: (x) => PB.num(x, 2) }, { t: "Selic no fim (%)", k: "selic", n: true, fmt: (x) => PB.num(x, 2) },
        { t: "Dívida bruta (variação, p.p. do PIB) ↓", k: "div", n: true, fmt: v("macro_divida_bruta") }, { t: "Desocupação (variação, p.p.) ↓", k: "des", n: true, fmt: v("desocupacao") }], linhas, { ordem: 0, desc: false }));
      ct.corpo.append(C.nota("Dívida bruta do governo geral começa em 2006 na série do Banco Central; a desocupação da PNAD Contínua começa em 2012, por isso só aparece a partir de Dilma (variação 2012→2016 não incluída por falta do ano anterior ao mandato)."));
      alvo.append(ct.cartao);
    },
  };
})();

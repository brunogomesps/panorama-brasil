(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el, EL = PB.EL;
  PB.paginas = PB.paginas || {};

  const MATRIZ_PADRAO = ["voto_vencedor", "pib_pc_relativo", "rendimento", "desocupacao", "informalidade", "pobreza", "gini", "analfabetismo", "homicidios", "mortalidade_infantil", "urbanizacao", "vab_adm_publica_pct", "comparecimento"];
  const PREDITORES_PADRAO = ["pib_pc_relativo", "analfabetismo", "informalidade"];
  // Partido do governo federal na eleição e candidato que o representava no 2º turno
  const GOVERNO = { 2006: { pt: true, t: "Lula (PT), presidente" }, 2010: { pt: true, t: "Dilma (PT), candidata do governo Lula" }, 2014: { pt: true, t: "Dilma (PT), presidente" }, 2022: { pt: false, t: "Bolsonaro (PL), presidente" }, 2026: { pt: true, t: "Lula (PT), presidente" } };

  /** valor do indicador na UF no ano da eleição ou no último ano anterior com dado */
  const valAte = (id, loc, ano) => { const a = PB.anoAte(id, ano) ?? PB.anoMaisProximo(id, ano); return a == null ? null : PB.valor(id, loc, a); };
  const anoUsado = (id, ano) => PB.anoAte(id, ano) ?? PB.anoMaisProximo(id, ano);

  function corR(r) {
    if (r == null) return PB.cor("--sem-dado");
    const t = Math.min(1, Math.abs(r));
    return d3.interpolateRgb(PB.cor("--superficie-2"), r >= 0 ? PB.cor("--seq-5") : PB.cor("--p-ambar"))(t);
  }

  PB.paginas.correlacoes = {
    montar(alvo, p) {
      const st = {
        ano: EL.anos.includes(+p.ano) ? +p.ano : EL.anos[EL.anos.length - 1],
        metodo: p.metodo === "spearman" ? "spearman" : "pearson",
        x: PB.ind[p.x] ? p.x : "pib_pc_relativo",
        y: PB.ind[p.y] ? p.y : "voto_vencedor",
        peso: p.peso === "1",
        preds: (p.preds ? p.preds.split(",") : PREDITORES_PADRAO).filter((i) => PB.ind[i]),
        retro: PB.ind[p.retro] ? p.retro : "pib_pc_relativo",
      };
      const filtros = el("div", { class: "filtros" });
      const corpo = el("div");
      alvo.append(C.cabecalho("Correlações", "O que anda junto com o voto?", "Correlação, dispersão e regressão entre indicadores socioeconômicos e resultados eleitorais, com os 27 estados como unidade. Para cada eleição, cada indicador entra com o valor do próprio ano ou do último ano anterior disponível."), filtros, corpo);
      corpo.before(C.nota("Correlação não é causalidade, e estado não é eleitor: uma associação entre estados não diz como cada pessoa vota (falácia ecológica). Com 27 observações, resultados com p > 0,05 podem ser acaso.", true));
      const salva = () => PB.setParams({ ...st, peso: st.peso ? "1" : "", preds: st.preds.join(",") });
      filtros.append(
        C.segmentado("Eleição", EL.anos.map((a) => ({ v: a, t: String(a) })), st.ano, (v) => { st.ano = +v; salva(); desenha(); }),
        C.segmentado("Método", [{ v: "pearson", t: "Pearson", dica: "Relação linear entre os valores" }, { v: "spearman", t: "Spearman", dica: "Relação entre as posições (robusta a valores extremos)" }], st.metodo, (v) => { st.metodo = v; salva(); desenha(); }),
      );

      const desenha = () => {
        PB.G.limpa();
        corpo.replaceChildren();
        matriz(corpo, st, (x, y) => { st.x = x; st.y = y; salva(); desenha(); document.getElementById("bloco-dispersao").scrollIntoView({ behavior: "smooth" }); });
        dispersao(corpo, st, salva, desenha);
        regressao(corpo, st, salva, desenha);
        retrospectivo(corpo, st, salva, desenha);
      };
      desenha();
    },
  };

  function corr(st, a, b, w) {
    const pares = PB.UFS.map((u) => [valAte(a, u, st.ano), valAte(b, u, st.ano), w ? w(u) : 1]).filter((x) => x[0] != null && x[1] != null);
    const xs = pares.map((x) => x[0]), ys = pares.map((x) => x[1]);
    const r = st.metodo === "spearman" ? PB.est.spearman(xs, ys) : PB.est.pearson(xs, ys, w ? pares.map((x) => x[2]) : null);
    return { r, n: pares.length, p: PB.est.pCorrelacao(r, pares.length) };
  }

  function matriz(corpo, st, onclick) {
    const ids = MATRIZ_PADRAO.filter((i) => PB.ind[i]);
    const cm = C.cartao({ titulo: `Matriz de correlação entre os estados · ${st.ano}`, sub: `${st.metodo === "pearson" ? "Pearson" : "Spearman"}. Roxo = andam juntos (r > 0); âmbar = andam em sentidos opostos (r < 0). * = p < 0,05. Clique numa célula para ver a dispersão.`, fonte: "Cálculo sobre IBGE, Ministério da Saúde e TSE",
      info: "r varia de −1 a +1. |r| ≥ 0,7 forte; 0,4 a 0,7 moderada; 0,2 a 0,4 fraca. A cor mostra a força e o sentido da associação, não se ela é boa ou ruim." });
    const tab = el("table");
    const rot = (i) => PB.ind[i].curto + " (" + anoUsado(i, st.ano) + ")";
    tab.append(el("thead", {}, el("tr", {}, el("th", {}), ...ids.map((i) => el("th", { "data-dica": PB.ind[i].nome }, PB.ind[i].curto)))));
    const tb = el("tbody");
    const csv = [];
    ids.forEach((a) => {
      const tr = el("tr", {}, el("th", { "data-dica": PB.ind[a].nome + ". " + PB.pol.rotulo(PB.ind[a]) }, rot(a)));
      const lcsv = [rot(a)];
      ids.forEach((b) => {
        if (a === b) { tr.append(el("td", { style: { background: PB.cor("--superficie-3") } }, "—")); lcsv.push(1); return; }
        const { r, n, p } = corr(st, a, b);
        lcsv.push(r == null ? "" : +r.toFixed(3));
        const bg = corR(r);
        const td = el("td", { tabindex: 0, role: "button", style: { background: bg, color: PB.textoSobre(bg), fontWeight: p != null && p < 0.05 ? 700 : 400 },
          "data-dica": `${PB.ind[a].curto} × ${PB.ind[b].curto}: r = ${PB.num(r, 2)} (${PB.est.forca(r)}), n = ${n}, p = ${PB.num(p, 3)}`,
          "aria-label": `${PB.ind[a].curto} e ${PB.ind[b].curto}: r ${PB.num(r, 2)}` }, r == null ? "–" : PB.num(r, 2).replace("-", "−") + (p != null && p < 0.05 ? "*" : ""));
        td.addEventListener("click", () => onclick(a, b));
        td.addEventListener("keydown", (ev) => { if (ev.key === "Enter") onclick(a, b); });
        tr.append(td);
      });
      csv.push(lcsv);
      tb.append(tr);
    });
    tab.append(tb);
    cm.corpo.append(el("div", { class: "matriz" }, tab));
    cm.acoes.append(el("button", { class: "btn", type: "button", onclick: () => PB.csv(`correlacoes_${st.ano}_${st.metodo}`, ["", ...ids.map(rot)], csv) }, "CSV"));
    corpo.append(cm.cartao);
  }

  function dispersao(corpo, st, salva, redesenha) {
    const X = PB.ind[st.x], Y = PB.ind[st.y];
    const ax = anoUsado(st.x, st.ano), ay = anoUsado(st.y, st.ano);
    const pop = (u) => PB.valor("populacao", u, PB.anoAte("populacao", st.ano)) || 1;
    const dados = PB.UFS.map((u) => ({ u, x: valAte(st.x, u, st.ano), y: valAte(st.y, u, st.ano), w: pop(u) })).filter((d) => d.x != null && d.y != null);
    const filtros = el("div", { class: "filtros", style: { boxShadow: "none", marginBottom: "10px" } },
      C.selectIndicador("Eixo X", st.x, (v) => { st.x = v; salva(); redesenha(); }, (i) => i.tema !== "Macroeconomia"),
      C.selectIndicador("Eixo Y", st.y, (v) => { st.y = v; salva(); redesenha(); }, (i) => i.tema !== "Macroeconomia"),
      C.segmentado("Peso", [{ v: "0", t: "Cada UF = 1" }, { v: "1", t: "Pela população", dica: "Estados mais populosos pesam mais na reta" }], st.peso ? "1" : "0", (v) => { st.peso = v === "1"; salva(); redesenha(); }));
    const cd = C.cartao({ titulo: `${X.curto} (${ax}) × ${Y.curto} (${ay})`, sub: "Cada círculo é um estado (tamanho = população, cor = região). Reta = regressão linear.", fonte: X.fonte + " · " + Y.fonte });
    cd.cartao.id = "bloco-dispersao";
    cd.cartao.style.marginTop = "16px";
    cd.corpo.append(filtros);
    corpo.append(cd.cartao);
    if (dados.length < 5) { cd.corpo.append(C.vazio("Poucos estados com os dois indicadores neste ano.")); return; }
    const w = st.peso ? dados.map((d) => d.w) : null;
    const m = PB.est.mqo(dados.map((d) => [d.x]), dados.map((d) => d.y), w);
    const r = PB.est.pearson(dados.map((d) => d.x), dados.map((d) => d.y), w);
    const rs = PB.est.spearman(dados.map((d) => d.x), dados.map((d) => d.y));
    const pv = PB.est.pCorrelacao(r, dados.length);
    const maxPop = d3.max(dados, (d) => d.w);
    const g = el("div", { class: "grade g-mapa" });
    cd.corpo.append(g);
    const gs = el("div");
    g.append(gs);
    PB.G.dispersao(gs, {
      pontos: dados.map((d) => ({ id: d.u, x: d.x, y: d.y, rotulo: d.u, cor: PB.corRegiao(PB.regiaoDe(d.u)), r: 4 + Math.sqrt(d.w / maxPop) * 14,
        dica: `<div class="t">${PB.esc(PB.nomeLocal(d.u))}</div>${PB.esc(X.curto)}: ${PB.esc(PB.fmt(X, d.x, true))}<br>${PB.esc(Y.curto)}: ${PB.esc(PB.fmt(Y, d.y, true))}<br><span class="l">Esperado pela reta: ${PB.esc(PB.fmt(Y, m.beta[0] + m.beta[1] * d.x))}</span>` })),
      xRot: `${X.curto} (${PB.unidadeCurta(X)})`, yRot: `${Y.curto} (${PB.unidadeCurta(Y)})`, fx: (v) => PB.fmt(X, v), fy: (v) => PB.fmt(Y, v), reta: { a: m.beta[0], b: m.beta[1] }, altura: 470,
      quadrantes: { x: PB.valor(st.x, "BR", ax) ?? d3.median(dados, (d) => d.x), y: PB.valor(st.y, "BR", ay) ?? d3.median(dados, (d) => d.y), rotulos: rotulosQuadrantes(X, Y) },
      onclick: (u) => PB.ir("estados", { uf: u }) });
    const lado = el("div");
    g.append(lado);
    // Leitura em texto, com polaridade
    const sentido = m.beta[1] >= 0 ? "maior" : "menor";
    const leituraX = X.polaridade === "neutro" ? "" : ` (${X.polaridade === "maior" ? "valor maior = melhor" : "valor maior = pior"})`;
    lado.append(el("div", { class: "stats" },
      el("div", { class: "stat" }, el("div", { class: "r" }, "Correlação (r)"), el("div", { class: "v" }, PB.num(r, 2)), el("div", { class: "d" }, PB.est.forca(r))),
      el("div", { class: "stat" }, el("div", { class: "r" }, "R²"), el("div", { class: "v" }, PB.num(m.r2, 2)), el("div", { class: "d" }, PB.num(m.r2 * 100, 0) + "% da variação de Y")),
      el("div", { class: "stat" }, el("div", { class: "r" }, "p-valor"), el("div", { class: "v" }, PB.num(pv, 3)), el("div", { class: "d" }, pv < 0.05 ? "significativo a 5%" : "pode ser acaso")),
      el("div", { class: "stat" }, el("div", { class: "r" }, "Spearman"), el("div", { class: "v" }, PB.num(rs, 2)), el("div", { class: "d" }, "n = " + dados.length))));
    lado.append(C.nota(`Estados com ${PB.minus(X.curto)} mais alto${leituraX} tendem a ter ${PB.minus(Y.curto)} ${sentido}: cada ${PB.fmtDelta(X, 1).replace("+", "")} a mais em X se associa a ${PB.fmtDelta(Y, m.beta[1])} em Y, em média.`));
    // Resíduos: acima e abaixo do esperado
    const res = dados.map((d, i) => ({ u: d.u, e: m.res[i] })).sort((a, b) => b.e - a.e);
    const linhaRes = (x) => el("div", { class: "rk", style: { gridTemplateColumns: "46px minmax(0,1fr) 80px", cursor: "default" } }, el("span", { class: "uf" }, x.u), el("span", {}, PB.nomeLocal(x.u)), el("span", { class: "val" }, PB.fmtDelta(Y, x.e)));
    lado.append(el("h3", { style: { margin: "12px 0 4px", fontSize: "14px" } }, `Acima do esperado em ${PB.minus(Y.curto)}`), ...res.slice(0, 5).map(linhaRes),
      el("h3", { style: { margin: "12px 0 4px", fontSize: "14px" } }, "Abaixo do esperado"), ...res.slice(-5).reverse().map(linhaRes));
    lado.append(C.legendaCategorias(PB.REGIOES.map((rg) => ({ t: PB.nomeLocal(rg), cor: PB.corRegiao(rg) }))));
  }

  function rotulosQuadrantes(X, Y) {
    const xs = X.polaridade === "neutro" ? ["X menor", "X maior"] : X.polaridade === "maior" ? ["X pior", "X melhor"] : ["X melhor", "X pior"];
    const ys = Y.polaridade === "neutro" ? ["Y maior", "Y menor"] : Y.polaridade === "maior" ? ["Y melhor", "Y pior"] : ["Y pior", "Y melhor"];
    return [`${xs[0]}, ${ys[0]}`, `${xs[1]}, ${ys[0]}`, `${xs[0]}, ${ys[1]}`, `${xs[1]}, ${ys[1]}`].map((s) => s + " que o Brasil");
  }

  function regressao(corpo, st, salva, redesenha) {
    const Y = PB.ind[st.y];
    const cr = C.cartao({ titulo: `Regressão múltipla: o que explica ${PB.minus(Y.curto)} em ${st.ano}?`, sub: "Escolha até 5 indicadores. O coeficiente padronizado (β) permite comparar o peso de cada um; p < 0,05 indica efeito pouco provável de ser acaso.", fonte: "Cálculo por mínimos quadrados sobre os 27 estados",
      info: "VIF > 5 indica que os preditores estão muito correlacionados entre si (multicolinearidade): os coeficientes ficam instáveis. Com 27 estados, use poucos preditores." });
    cr.cartao.style.marginTop = "16px";
    corpo.append(cr.cartao);
    const opcoes = PB.indicadores.filter((i) => i.tema !== "Macroeconomia" && i.id !== st.y && !i.id.endsWith("_n") && i.tema !== "Eleições");
    const chips = el("div", { class: "chips", style: { marginBottom: "10px" } }, ...opcoes.map((i) => {
      const on = st.preds.includes(i.id);
      const b = el("button", { class: "chip", type: "button", "aria-pressed": on, "data-dica": i.nome }, i.curto);
      b.addEventListener("click", () => {
        if (on) st.preds = st.preds.filter((x) => x !== i.id);
        else if (st.preds.length >= 5) { PB.aviso("Use no máximo 5 preditores com 27 estados"); return; }
        else st.preds.push(i.id);
        salva(); redesenha();
      });
      return b;
    }));
    cr.corpo.append(chips);
    if (!st.preds.length) { cr.corpo.append(C.vazio("Escolha ao menos um indicador.")); return; }
    const linhas = PB.UFS.map((u) => ({ u, y: valAte(st.y, u, st.ano), xs: st.preds.map((i) => valAte(i, u, st.ano)) })).filter((l) => l.y != null && l.xs.every((v) => v != null));
    if (linhas.length < st.preds.length + 3) { cr.corpo.append(C.vazio("Poucos estados com todos os indicadores neste ano.")); return; }
    const X = linhas.map((l) => l.xs);
    const m = PB.est.mqo(X, linhas.map((l) => l.y));
    if (!m) { cr.corpo.append(C.vazio("Os preditores são redundantes (matriz singular). Remova algum.")); return; }
    const vif = PB.est.vif(X);
    const g = el("div", { class: "grade g-mapa" });
    cr.corpo.append(g);
    const tab = C.tabela([{ t: "Preditor", k: "n" }, { t: "Ano", k: "a" }, { t: "Coeficiente", k: "b", n: true, fmt: (v) => PB.num(v, 3) }, { t: "β padronizado", k: "bp", n: true, fmt: (v) => PB.num(v, 2) }, { t: "p-valor", k: "p", n: true, fmt: (v) => PB.num(v, 3), cls: (l) => (l.p < 0.05 ? "var bom" : "") }, { t: "VIF", k: "vif", n: true, fmt: (v) => (isFinite(v) ? PB.num(v, 1) : "∞"), cls: (l) => (l.vif > 5 ? "var ruim" : "") }],
      st.preds.map((i, j) => ({ n: PB.ind[i].curto, a: anoUsado(i, st.ano), b: m.beta[j + 1], bp: m.padr[j], p: m.p[j + 1], vif: vif[j] })), { ordem: 3 });
    const esq = el("div", {}, tab, el("div", { class: "stats", style: { marginTop: "10px" } },
      el("div", { class: "stat" }, el("div", { class: "r" }, "R²"), el("div", { class: "v" }, PB.num(m.r2, 2))),
      el("div", { class: "stat" }, el("div", { class: "r" }, "R² ajustado"), el("div", { class: "v" }, PB.num(m.r2aj, 2)), el("div", { class: "d" }, "desconta o número de preditores")),
      el("div", { class: "stat" }, el("div", { class: "r" }, "Estados"), el("div", { class: "v" }, linhas.length))));
    const forte = st.preds.map((i, j) => [i, m.padr[j], m.p[j + 1]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    esq.append(C.nota(`O preditor de maior peso é ${PB.minus(PB.ind[forte[0]].curto)} (β = ${PB.num(forte[1], 2)}${forte[2] < 0.05 ? ", significativo" : ", não significativo a 5%"}). Juntos, os ${st.preds.length} indicadores explicam ${PB.num(m.r2 * 100, 0)}% da variação entre os estados.`));
    g.append(esq);
    // Mapa dos resíduos
    const res = Object.fromEntries(linhas.map((l, i) => [l.u, m.res[i]]));
    const lim = d3.max(Object.values(res).map(Math.abs)) || 1;
    const corRes = (v) => (v == null ? null : d3.interpolateRgb(PB.cor("--div-0"), v >= 0 ? PB.cor("--seq-5") : PB.cor("--p-ambar"))(Math.min(1, Math.abs(v) / lim)));
    const mg = el("div");
    g.append(el("div", {}, el("h3", { style: { fontSize: "14px", marginBottom: "4px" } }, "Resíduos: o que o modelo não explica"), el("p", { class: "leitura" }, "Roxo = valor real acima do previsto; âmbar = abaixo."), mg));
    PB.Mapa.uf(mg, { forma: "grade", cor: (u) => corRes(res[u]), valorTexto: (u) => (res[u] == null ? "" : (res[u] >= 0 ? "+" : "−") + PB.num(Math.abs(res[u]), 1)),
      dica: (u) => (res[u] == null ? PB.nomeLocal(u) + ": sem dado" : `<div class="t">${PB.esc(PB.nomeLocal(u))}</div>Real: ${PB.esc(PB.fmt(Y, valAte(st.y, u, st.ano)))} · previsto: ${PB.esc(PB.fmt(Y, valAte(st.y, u, st.ano) - res[u]))}<br>Resíduo: ${PB.esc(PB.fmtDelta(Y, res[u]))}`) });
  }

  function retrospectivo(corpo, st, salva, redesenha) {
    const X = PB.ind[st.retro];
    const cr = C.cartao({ titulo: "Voto retrospectivo: a economia do estado explica o voto no candidato do governo?", sub: "Cada ponto é um estado numa eleição: variação do indicador nos 4 anos anteriores (eixo X) × votos do candidato do governo federal no 2º turno (eixo Y). 2018 fica de fora: o governo (MDB) não foi ao 2º turno.", fonte: "TSE e " + X.fonte,
      info: "Candidato do governo no 2º turno: " + Object.entries(GOVERNO).map(([a, g]) => a + ": " + g.t).join("; ") + "." });
    cr.cartao.style.marginTop = "16px";
    corpo.append(cr.cartao);
    cr.corpo.append(el("div", { class: "filtros", style: { boxShadow: "none" } }, C.selectIndicador("Indicador (variação em 4 anos)", st.retro, (v) => { st.retro = v; salva(); redesenha(); }, (i) => i.tema !== "Macroeconomia" && i.tema !== "Eleições" && !i.id.endsWith("_n"))));
    const coresAno = { 2006: PB.cor("--reg-N"), 2010: PB.cor("--reg-NE"), 2014: PB.cor("--reg-SD"), 2022: PB.cor("--reg-S"), 2026: PB.cor("--reg-CO") };
    const pts = [];
    const porAno = {};
    Object.entries(GOVERNO).forEach(([a, gv]) => {
      a = +a;
      const a1 = PB.anoAte(st.retro, a), a0 = a1 != null ? PB.anoAte(st.retro, a1 - 4) : null;
      if (a1 == null || a0 == null || a1 - a0 < 3) return;
      PB.UFS.forEach((u) => {
        const v1 = PB.valor(st.retro, u, a1), v0 = PB.valor(st.retro, u, a0);
        const y = PB.valor("voto_governo_t2", u, a); // candidato do governo federal no 2º turno
        if (v1 == null || v0 == null || y == null) return;
        const x = ["moeda", "moeda_grande", "int"].includes(X.formato) ? PB.est.cagr(v0, v1, a1 - a0) : v1 - v0;
        if (x == null) return;
        pts.push({ id: u + a, x, y, a, cor: coresAno[a], dica: `<div class="t">${PB.esc(PB.nomeLocal(u))} · ${a}</div>${PB.esc(X.curto)}: ${a0}→${a1} ${["moeda", "moeda_grande", "int"].includes(X.formato) ? PB.num(x, 2) + "% a.a." : PB.esc(PB.fmtDelta(X, x))}<br>Candidato do governo (${PB.esc(gv.t)}): ${PB.num(y, 1)}%` });
        (porAno[a] = porAno[a] || []).push([x, y]);
      });
    });
    if (pts.length < 10) { cr.corpo.append(C.vazio("Este indicador não tem série longa o bastante para comparar 4 anos antes de cada eleição (as séries da PNAD começam em 2012).")); return; }
    const g = el("div", { class: "grade g-mapa" });
    cr.corpo.append(g);
    const gs = el("div");
    g.append(gs);
    const m = PB.est.mqo(pts.map((q) => [q.x]), pts.map((q) => q.y));
    const monet = ["moeda", "moeda_grande", "int"].includes(X.formato);
    PB.G.dispersao(gs, { pontos: pts, xRot: `Variação de ${PB.minus(X.curto)} em 4 anos ${monet ? "(% ao ano)" : "(" + PB.unidadeCurta(X) + ")"}`, yRot: "Candidato do governo no 2º turno (% válidos)", fx: (v) => PB.num(v, 1), fy: (v) => PB.num(v, 0) + "%", reta: { a: m.beta[0], b: m.beta[1] }, altura: 420, quadrantes: { x: 0, y: 50 } });
    const tab = Object.entries(porAno).map(([a, xy]) => {
      const r = PB.est.pearson(xy.map((q) => q[0]), xy.map((q) => q[1]));
      const mm = PB.est.mqo(xy.map((q) => [q[0]]), xy.map((q) => q[1]));
      return { a: +a, gov: GOVERNO[a].t, r, b: mm ? mm.beta[1] : null, p: PB.est.pCorrelacao(r, xy.length), n: xy.length };
    });
    const lado = el("div", {}, C.tabela([{ t: "Eleição", k: "a" }, { t: "Candidato do governo", k: "gov" }, { t: "r", k: "r", n: true, fmt: (v) => PB.num(v, 2) }, { t: "Inclinação", k: "b", n: true, fmt: (v) => PB.num(v, 2) }, { t: "p", k: "p", n: true, fmt: (v) => PB.num(v, 3) }], tab, { ordem: 0, desc: false }),
      C.legendaCategorias(Object.keys(porAno).map((a) => ({ t: a, cor: coresAno[a] }))));
    const melhora = X.polaridade === "neutro" ? "subiu" : (X.polaridade === "maior") === true ? "subiu (melhorou)" : "subiu (piorou)";
    lado.append(C.nota(`Em conjunto (n = ${pts.length}): onde ${PB.minus(X.curto)} ${melhora} mais, o candidato do governo teve, em média, ${m.beta[1] >= 0 ? "mais" : "menos"} votos (inclinação ${PB.num(m.beta[1], 2)}, R² = ${PB.num(m.r2, 2)}). A diferença de nível entre eleições pesa muito: compare as inclinações dentro de cada ano na tabela.`));
    g.append(lado);
  }
})();

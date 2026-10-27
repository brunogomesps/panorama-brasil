/* Componentes de interface: dica (tooltip), selo de polaridade, KPI, cartão, filtros, tabela, ranking, legenda. */
(function () {
  "use strict";
  const PB = window.PB;
  const C = (PB.C = {});

  // ------------------------------------------------------------------ DOM
  C.el = (tag, attrs = {}, ...filhos) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      // aria-* precisa do texto "true"/"false" (o CSS e os leitores de tela leem o valor):
      // não pode ser omitido quando false nem virar atributo vazio quando true
      if (k.startsWith("aria-") && typeof v === "boolean") { e.setAttribute(k, String(v)); continue; }
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v; // só com conteúdo montado pelo próprio painel (já escapado)
      else if (k === "texto") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") {
        // variáveis CSS (--cor) só funcionam com setProperty; o resto pode ir direto
        for (const [p, x] of Object.entries(v)) { if (x == null) continue; if (p.startsWith("--")) e.style.setProperty(p, x); else e.style[p] = x; }
      }
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const f of filhos.flat()) if (f != null) e.append(f instanceof Node ? f : document.createTextNode(String(f)));
    return e;
  };
  const el = C.el;

  // ------------------------------------------------------------------ Dica
  const dica = document.getElementById("dica");
  C.mostraDica = (html, x, y) => {
    dica.innerHTML = html;
    dica.hidden = false;
    const r = dica.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    dica.style.left = Math.max(8, left) + "px";
    dica.style.top = Math.max(8, top) + "px";
  };
  C.escondeDica = () => { dica.hidden = true; };
  // Elementos com data-dica mostram o texto no mouse e no foco do teclado
  document.addEventListener("mouseover", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-dica]");
    if (t) C.mostraDica(t.getAttribute("data-dica-html") ? t.getAttribute("data-dica") : PB.esc(t.getAttribute("data-dica")), ev.clientX, ev.clientY);
  });
  document.addEventListener("mousemove", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-dica]");
    if (t && !dica.hidden) C.mostraDica(dica.innerHTML, ev.clientX, ev.clientY);
  });
  document.addEventListener("mouseout", (ev) => { if (ev.target.closest && ev.target.closest("[data-dica]")) C.escondeDica(); });
  document.addEventListener("focusin", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-dica]");
    if (t) { const r = t.getBoundingClientRect(); C.mostraDica(t.getAttribute("data-dica-html") ? t.getAttribute("data-dica") : PB.esc(t.getAttribute("data-dica")), r.left, r.bottom); }
  });
  document.addEventListener("focusout", C.escondeDica);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") C.escondeDica(); });

  // ------------------------------------------------------------ Polaridade
  const SETA = {
    maior: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5"/></svg>',
    menor: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v8M2.5 6.5 6 10l3.5-3.5"/></svg>',
    neutro: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8"/></svg>',
  };
  /** selo "↑ Maior é melhor" com a justificativa na dica */
  C.selo = (ind, compacto = false) => {
    const rot = compacto ? (ind.polaridade === "neutro" ? "Neutro" : ind.polaridade === "maior" ? "Maior é melhor" : "Menor é melhor") : PB.pol.rotulo(ind);
    const s = el("span", {
      class: "pol pol-" + ind.polaridade, tabindex: 0, role: "note",
      "aria-label": PB.pol.rotulo(ind) + ". " + ind.porque,
      "data-dica": `<div class="t">${PB.esc(PB.pol.rotulo(ind))}</div><div class="l">${PB.esc(ind.porque)}</div>`,
      "data-dica-html": "1",
    });
    s.innerHTML = SETA[ind.polaridade] + PB.esc(rot);
    return s;
  };
  /** texto de variação: "▲ +2,3 p.p. · melhorou" com a classe de cor certa */
  C.variacao = (ind, delta, sufixo = "") => {
    const v = PB.pol.variacao(ind, delta);
    const seta = delta > 0 ? "▲" : delta < 0 ? "▼" : "■";
    return el("span", { class: "var " + v.classe }, `${seta} ${PB.fmtDelta(ind, delta)}${v.texto ? " · " + v.texto : ""}${sufixo}`);
  };

  // ----------------------------------------------------------- Sparkline
  C.spark = (pts) => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "spark");
    svg.setAttribute("viewBox", "0 0 240 34");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    if (pts.length < 2) return svg;
    const x = d3.scaleLinear().domain(d3.extent(pts, (p) => p[0])).range([3, 237]);
    const y = d3.scaleLinear().domain(d3.extent(pts, (p) => p[1])).range([31, 3]);
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d3.line().x((d) => x(d[0])).y((d) => y(d[1]))(pts));
    const c = document.createElementNS(ns, "circle");
    const u = pts[pts.length - 1];
    c.setAttribute("cx", x(u[0])); c.setAttribute("cy", y(u[1])); c.setAttribute("r", 2.6);
    svg.append(p, c);
    return svg;
  };

  // ------------------------------------------------------------------ KPI
  /** cartão de indicador com valor, polaridade, variação e minissérie */
  C.kpi = (id, loc, opcoes = {}) => {
    const ind = PB.ind[id];
    const serie = PB.serie(id, loc).filter(([a]) => !opcoes.ate || a <= opcoes.ate);
    const card = el("button", { class: "kpi", type: "button", onclick: () => PB.ir("tendencias", { ind: id, locs: loc === "BR" ? "BR" : "BR," + loc }) });
    if (!serie.length) {
      card.append(el("div", { class: "kpi-nome" }, ind.curto), el("div", { class: "kpi-valor" }, "–"));
      return card;
    }
    const [ano, v] = serie[serie.length - 1];
    const ini = serie.find(([a]) => a >= (opcoes.desde || 0)) || serie[0];
    const ant = serie.length > 1 ? serie[serie.length - 2] : null;
    const topo = el("div", { class: "kpi-topo" }, el("div", { class: "kpi-nome" }, ind.curto), C.selo(ind, true));
    const valor = el("div", { class: "kpi-valor" });
    valor.append(PB.fmt(ind, v), " ");
    const un = ["moeda", "moeda_grande", "int"].includes(ind.formato) ? "" : ind.unidade;
    valor.append(el("small", {}, (un ? un + " · " : "") + ano));
    const linha = el("div", { class: "kpi-linha" });
    const txt = el("div", {});
    if (ant) txt.append(el("div", {}, C.variacao(ind, v - ant[1]), el("span", { class: "vs" }, " vs. " + ant[0])));
    if (ini && ini[0] !== ano && ini !== ant) {
      const d = v - ini[1];
      const vv = PB.pol.variacao(ind, d);
      txt.append(el("div", {}, el("span", { class: "var " + vv.classe }, `desde ${ini[0]}: ${PB.fmtDelta(ind, d)}${vv.texto ? " · " + vv.texto : ""}`)));
    }
    linha.append(txt, C.spark(serie));
    card.append(topo, valor, linha);
    card.setAttribute("aria-label", `${ind.nome}: ${PB.fmt(ind, v, true)} em ${ano}. ${PB.pol.rotulo(ind)}. Abrir a série histórica.`);
    return card;
  };

  // --------------------------------------------------------------- Cartão
  /**
   * Cartão com título, subtítulo, selo de polaridade, ações (Tabela/CSV/ⓘ) e fonte.
   * Retorna {cartao, corpo, acoes}.
   */
  C.cartao = ({ titulo, sub, ind, fonte, classe, info, csv }) => {
    const corpo = el("div", { class: "corpo" });
    const acoes = el("div", { class: "cartao-acoes" });
    if (info) acoes.append(el("button", { class: "btn-icone", type: "button", "aria-label": "Como ler", "data-dica": info }, el("span", { "aria-hidden": "true", style: { fontWeight: 700 } }, "i")));
    if (csv) acoes.append(el("button", { class: "btn", type: "button", onclick: csv, "data-dica": "Baixar os dados deste quadro em CSV" }, "CSV"));
    const titulos = el("div", { class: "titulos" }, el("h2", {}, titulo));
    if (sub) titulos.append(el("p", { class: "sub" }, sub));
    if (ind) {
      const linha = el("div", { style: { marginTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } }, C.selo(ind));
      titulos.append(linha);
    }
    const cartao = el("section", { class: "cartao " + (classe || "") }, el("div", { class: "cartao-cab" }, titulos, acoes), corpo);
    if (fonte) cartao.append(el("div", { class: "fonte", html: "<strong>Fonte:</strong> " + PB.esc(fonte) }));
    return { cartao, corpo, acoes };
  };

  /** botão que alterna entre o visual e a tabela de dados do quadro */
  C.alternaTabela = (acoes, visual, montaTabela) => {
    let tab = null;
    const b = el("button", { class: "btn", type: "button", "aria-pressed": "false" }, "Tabela");
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on);
      b.textContent = on ? "Gráfico" : "Tabela";
      if (on) { tab = montaTabela(); visual.after(tab); visual.hidden = true; }
      else { if (tab) tab.remove(); visual.hidden = false; }
    });
    acoes.prepend(b);
  };

  // --------------------------------------------------------------- Filtros
  C.select = (rotulo, opcoes, valor, onchange, classe) => {
    const s = el("select", { class: classe || "", "aria-label": rotulo });
    for (const o of opcoes) {
      if (o.grupo) {
        const g = el("optgroup", { label: o.grupo });
        o.itens.forEach((i) => g.append(el("option", { value: i.v, selected: String(i.v) === String(valor) }, i.t)));
        s.append(g);
      } else s.append(el("option", { value: o.v, selected: String(o.v) === String(valor) }, o.t));
    }
    s.addEventListener("change", () => onchange(s.value));
    return el("label", { class: "campo" }, el("span", {}, rotulo), s);
  };
  /** seleção de indicador agrupada por tema; filtro opcional */
  C.selectIndicador = (rotulo, valor, onchange, filtro = () => true) => {
    const grupos = PB.temas.map((t) => ({
      grupo: t,
      itens: PB.indicadores.filter((i) => i.tema === t && filtro(i)).map((i) => ({ v: i.id, t: i.nome + (i.polaridade === "maior" ? "  ↑" : i.polaridade === "menor" ? "  ↓" : "") })),
    })).filter((g) => g.itens.length);
    return C.select(rotulo, grupos, valor, onchange, "largo");
  };
  C.segmentado = (rotulo, opcoes, valor, onchange) => {
    const g = el("div", { class: "segmentado", role: "radiogroup", "aria-label": rotulo });
    const bts = opcoes.map((o) => {
      const b = el("button", { type: "button", role: "radio", "aria-checked": String(o.v) === String(valor), tabindex: String(o.v) === String(valor) ? 0 : -1, "data-dica": o.dica || null }, o.t);
      b.addEventListener("click", () => { bts.forEach((x) => { x.setAttribute("aria-checked", x === b); x.tabIndex = x === b ? 0 : -1; }); onchange(o.v); });
      return b;
    });
    g.addEventListener("keydown", (ev) => {
      if (!["ArrowLeft", "ArrowRight"].includes(ev.key)) return;
      const i = bts.findIndex((b) => b.getAttribute("aria-checked") === "true");
      const j = (i + (ev.key === "ArrowRight" ? 1 : -1) + bts.length) % bts.length;
      bts[j].click(); bts[j].focus(); ev.preventDefault();
    });
    g.append(...bts);
    return el("div", { class: "campo" }, el("span", {}, rotulo), g);
  };
  C.anoSlider = (rotulo, anos, valor, onchange) => {
    const out = el("strong", {}, valor);
    const r = el("input", { type: "range", min: 0, max: anos.length - 1, step: 1, value: Math.max(0, anos.indexOf(+valor)), "aria-label": rotulo, "aria-valuetext": String(valor) });
    r.addEventListener("input", () => { const a = anos[+r.value]; out.textContent = a; r.setAttribute("aria-valuetext", a); });
    r.addEventListener("change", () => onchange(anos[+r.value]));
    return el("label", { class: "campo" }, el("span", {}, rotulo, ": ", out), r);
  };

  // --------------------------------------------------------------- Tabela
  /** tabela ordenável. colunas: [{t, k, n (numérica), fmt, cls}] */
  C.tabela = (colunas, linhas, opcoes = {}) => {
    let ordem = opcoes.ordem || null, desc = opcoes.desc ?? true;
    const caixa = el("div", { class: "tabela-caixa" });
    const desenha = () => {
      const ls = [...linhas];
      if (ordem != null) {
        const c = colunas[ordem];
        ls.sort((a, b) => {
          const va = a[c.k], vb = b[c.k];
          if (va == null) return 1; if (vb == null) return -1;
          return (typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR")) * (desc ? -1 : 1);
        });
      }
      const thead = el("thead", {}, el("tr", {}, ...colunas.map((c, i) => {
        const th = el("th", { class: c.n ? "n" : "", "aria-sort": ordem === i ? (desc ? "descending" : "ascending") : "none", scope: "col" });
        th.append(el("button", { type: "button", onclick: () => { if (ordem === i) desc = !desc; else { ordem = i; desc = !!c.n; } desenha(); } }, c.t, ordem === i ? (desc ? " ▼" : " ▲") : ""));
        return th;
      })));
      const tbody = el("tbody", {}, ...ls.map((l) => el("tr", { class: l._classe || "" }, ...colunas.map((c) => {
        const v = l[c.k];
        const td = el("td", { class: (c.n ? "n " : "") + (c.cls ? c.cls(l) : "") });
        const conteudo = c.fmt ? c.fmt(v, l) : v == null ? "–" : v;
        if (conteudo instanceof Node) td.append(conteudo); else td.textContent = conteudo;
        return td;
      }))));
      caixa.replaceChildren(el("table", { class: "tab" }, thead, tbody));
    };
    desenha();
    return caixa;
  };

  // -------------------------------------------------------------- Ranking
  /**
   * Ranking em barras HTML (27 UFs + Brasil), do melhor para o pior conforme a polaridade.
   * pares: [[uf, valor]]; corDe(v) dá a cor da barra; ao clicar chama onclick(uf).
   */
  C.ranking = (ind, pares, { corDe, brasil, destaque, onclick } = {}) => {
    const ord = PB.pol.ordena(ind, pares);
    const vals = ord.map((p) => p[1]).concat(brasil != null ? [brasil] : []);
    const mn = Math.min(0, d3.min(vals)), mx = d3.max(vals);
    const x = (v) => ((v - mn) / (mx - mn || 1)) * 100;
    const caixa = el("div", {});
    caixa.append(el("p", { class: "rk-legenda" }, el("span", {}, PB.pol.criterioRanking(ind)), el("span", {}, ind.polaridade === "neutro" ? "" : "pior ↓ no fim")));
    const lista = el("div", { class: "ranking", role: "list" });
    let brPos = null;
    if (brasil != null) {
      brPos = ord.findIndex((p) => PB.pol.compara(ind, brasil, p[1]) > 0 || (ind.polaridade === "neutro" && brasil > p[1]));
      if (brPos < 0) brPos = ord.length;
    }
    ord.forEach(([uf, v], i) => {
      if (brPos === i) lista.append(linhaBR());
      const b = el("button", {
        class: "rk" + (uf === destaque ? " ativo" : ""), type: "button", role: "listitem",
        "aria-label": `${i + 1}º ${PB.nomeLocal(uf)}: ${PB.fmt(ind, v, true)}`,
        onclick: () => onclick && onclick(uf),
      },
      el("span", { class: "pos" }, i + 1 + "º"), el("span", { class: "uf" }, uf),
      el("span", { class: "trilho" }, el("span", { class: "barra", style: { width: x(v) + "%", background: corDe ? corDe(v) : "var(--marca)" } })),
      el("span", { class: "val" }, PB.fmt(ind, v)));
      b.setAttribute("data-dica", `${PB.nomeLocal(uf)}: ${PB.fmt(ind, v, true)} · ${i + 1}º de ${ord.length}`);
      lista.append(b);
    });
    if (brPos === ord.length) lista.append(linhaBR());
    function linhaBR() {
      return el("div", { class: "rk br", role: "listitem" }, el("span", { class: "pos" }, ""), el("span", { class: "uf" }, "BR"),
        el("span", { class: "trilho" }, el("span", { class: "barra", style: { width: x(brasil) + "%" } })), el("span", { class: "val" }, PB.fmt(ind, brasil)));
    }
    caixa.append(lista);
    return caixa;
  };

  // --------------------------------------------------------------- Legenda
  C.legendaEscala = (ind, esc) => {
    const cx = el("div", { class: "legenda" });
    if (!esc || !esc.cores) return cx;
    const rampa = el("div", { class: "rampa" });
    const cores = esc.tipo === "quintis" ? esc.cores : esc.cores;
    rampa.append(el("div", { class: "rampa-cores" }, ...cores.map((c) => el("span", { style: { background: c } }))));
    const rot = el("div", { class: "rampa-rot" });
    if (esc.tipo === "desempenho") {
      rot.innerHTML = `<i>◀ pior que o Brasil</i><span>${PB.esc(PB.fmt(ind, esc.ref))} (Brasil)</span><b>melhor ▶</b>`;
    } else if (esc.tipo === "quintis") {
      rot.innerHTML = `<i>◀ 20% piores</i><span>quintis</span><b>20% melhores ▶</b>`;
    } else if (esc.tipo === "continua") {
      rot.innerHTML = `<i>◀ pior ${PB.esc(esc.rotulos[0])}</i><b>${PB.esc(esc.rotulos[1])} melhor ▶</b>`;
    } else {
      rot.innerHTML = `<span>${PB.esc(esc.rotulos[0])}</span><span>maior valor (neutro) ▶ ${PB.esc(esc.rotulos[1])}</span>`;
    }
    rampa.append(rot);
    cx.append(rampa, el("span", { class: "item" }, el("span", { class: "sw", style: { background: PB.cor("--sem-dado") } }), "sem dado"));
    return cx;
  };
  C.legendaCategorias = (itens) => el("div", { class: "legenda" }, ...itens.map((i) => el("span", { class: "item" }, el("span", { class: "sw", style: { background: i.cor } }), i.t)));

  C.vazio = (txt) => el("div", { class: "vazio" }, txt);
  C.nota = (txt, alerta) => el("p", { class: "nota" + (alerta ? " alerta" : "") }, txt);
  C.cabecalho = (sobre, titulo, texto) => el("div", { class: "cabecalho-pagina" }, el("div", {}, el("p", { class: "sobrelinha" }, sobre), el("h1", {}, titulo), texto ? el("p", {}, texto) : null));

  /** linha de estatísticas descritivas entre as UFs, com leitura de polaridade */
  C.estatisticas = (ind, pares, brasil) => {
    const vs = pares.map((p) => p[1]).filter((v) => v != null);
    if (!vs.length) return el("div");
    const ord = PB.pol.ordena(ind, pares);
    const melhor = ord[0], pior = ord[ord.length - 1];
    const polar = ind.polaridade !== "neutro";
    const st = (r, v, d) => el("div", { class: "stat" }, el("div", { class: "r" }, r), el("div", { class: "v" }, v), d ? el("div", { class: "d" }, d) : null);
    const razao = Math.min(melhor[1], pior[1]) > 0 ? Math.max(melhor[1], pior[1]) / Math.min(melhor[1], pior[1]) : null;
    return el("div", { class: "stats" },
      st("Brasil", PB.fmt(ind, brasil)),
      st("Mediana das UFs", PB.fmt(ind, PB.est.mediana(vs))),
      st(polar ? "Melhor UF" : "Maior valor", PB.fmt(ind, melhor[1]), PB.nomeLocal(melhor[0])),
      st(polar ? "Pior UF" : "Menor valor", PB.fmt(ind, pior[1]), PB.nomeLocal(pior[0])),
      st("Distância entre extremos", razao ? PB.num(razao, 1) + "×" : PB.fmtDelta(ind, Math.abs(melhor[1] - pior[1])), "maior ÷ menor"),
      st("Desigualdade entre UFs", PB.num(PB.est.cv(vs), 1) + "%", "coeficiente de variação (menor = estados mais parecidos)"));
  };
})();

/* Gráficos: ApexCharts (linhas e barras) e D3 (dispersão com regressão). Sem eixo duplo. */
(function () {
  "use strict";
  const PB = window.PB;
  const C = PB.C;
  const G = (PB.G = {});
  let ativos = [];

  // O ApexCharts agenda o redesenho de um resize com setTimeout de 150 ms (_windowResize) e o
  // destroy() não cancela esse temporizador: se a aba muda nesse intervalo, o gráfico tenta se
  // redesenhar num elemento já fora da página e gera atributos "NaN" no SVG. Aqui o temporizador
  // é cancelado no limpa() e, por garantia, o callback ignora gráficos desconectados.
  ApexCharts.prototype._windowResize = function () {
    const ch = this;
    clearTimeout(ch.w.globals.resizeTimer);
    ch.w.globals.resizeTimer = setTimeout(() => {
      if (!ch.el || !ch.el.isConnected) return;
      ch.w.globals.resized = true;
      ch.w.globals.dataChanged = false;
      ch.ctx.update();
    }, 150);
  };

  G.limpa = () => { ativos.forEach((c) => { try { clearTimeout(c.w && c.w.globals.resizeTimer); c.destroy(); } catch (e) { /* gráfico já removido */ } }); ativos = []; };

  const reduzido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const escuro = () => {
    const t = document.documentElement.getAttribute("data-tema");
    return t ? t === "escuro" : matchMedia("(prefers-color-scheme: dark)").matches;
  };

  function base(extra) {
    const c = PB.cor;
    return {
      chart: {
        fontFamily: "Noto Sans, system-ui, sans-serif",
        foreColor: c("--texto-2"),
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: !reduzido(), speed: 300 },
        background: "transparent",
        parentHeightOffset: 0,
        // Redesenha pelo tamanho do contêiner (ResizeObserver, desligado no destroy) e não pelo
        // evento de janela: gráficos já destruídos reagiam ao resize da janela e geravam "NaN".
        redrawOnWindowResize: false,
        redrawOnParentResize: true,
        ...extra,
      },
      theme: { mode: escuro() ? "dark" : "light" },
      grid: { borderColor: c("--grade"), strokeDashArray: 3, padding: { left: 8, right: 12 } },
      dataLabels: { enabled: false },
      legend: { position: "top", horizontalAlign: "left", fontSize: "12.5px", markers: { size: 6 }, itemMargin: { horizontal: 8 } },
      tooltip: { theme: escuro() ? "dark" : "light" },
      states: { active: { filter: { type: "none" } } },
    };
  }

  function monta(alvo, opcoes) {
    alvo.replaceChildren();
    const div = C.el("div", { class: "grafico" });
    alvo.append(div);
    const ch = new ApexCharts(div, opcoes);
    ch.render();
    ativos.push(ch);
    return ch;
  }

  /**
   * Linhas no tempo.
   * op: { series:[{name, data:[[ano, v]], color, dash}], ind (para formatar), altura, anotacoes:[{x, texto}], faixas:[{de, ate, texto, cor}], yMin, base100 }
   */
  G.linha = (alvo, op) => {
    const ind = op.ind;
    const fy = (v) => (v == null ? "–" : op.base100 ? PB.num(v, 1) : ind ? PB.fmt(ind, v) : PB.num(v, 1));
    const o = base({ type: "line", height: op.altura || 320 });
    // Eixo de categorias com os anos que existem nos dados: o rótulo fica exatamente no ano
    // (o eixo numérico do Apex espalhava os rótulos por conta própria). Ano sem dado = lacuna.
    let anos = [...new Set(op.series.flatMap((s) => s.data.map((d) => d[0])))].filter((a) => (op.xMin == null || a >= op.xMin) && (op.xMax == null || a <= op.xMax)).sort((a, b) => a - b);
    // Série quase anual (≥ 60% dos anos): inclui os anos faltantes como lacuna, para o eixo não "pular"
    // (ex.: rendimento sem 2020–2021). Séries espaçadas (eleições de 4 em 4 anos) mantêm só os seus anos.
    if (anos.length > 2) {
      const total = anos[anos.length - 1] - anos[0] + 1;
      if (anos.length / total >= 0.6) anos = d3.range(anos[0], anos[anos.length - 1] + 1);
    }
    o.series = op.series.map((s) => { const m = new Map(s.data); return { name: s.name, data: anos.map((a) => (m.has(a) ? m.get(a) : null)) }; });
    o.colors = op.series.map((s) => s.color || PB.cor("--marca"));
    o.stroke = { width: op.series.map((s) => s.largura ?? 2.2), curve: "straight", dashArray: op.series.map((s) => s.dash || 0) };
    o.markers = { size: op.series.map((s) => (s.data.length < 16 ? 4 : 0)), strokeWidth: 1.5, strokeColors: PB.cor("--superficie"), hover: { size: 6 } };
    o.xaxis = { type: "category", categories: anos.map(String), tickPlacement: "on", labels: { rotate: 0, hideOverlappingLabels: true }, axisBorder: { color: PB.cor("--eixo") }, crosshairs: { show: true }, tooltip: { enabled: false } };
    o.yaxis = { labels: { formatter: fy }, min: op.yMin, max: op.yMax, forceNiceScale: true };
    o.legend.show = op.series.length > 1;
    o.tooltip.shared = true;
    o.tooltip.intersect = false;
    o.tooltip.y = { formatter: (v) => fy(v) };
    // anotações e faixas usam o rótulo da categoria; faixas vão do 1º ao último ano dentro do intervalo
    const cat = (a) => (anos.includes(a) ? String(a) : null);
    const primeiroDe = (x) => anos.find((a) => a >= x), ultimoAte = (x) => [...anos].reverse().find((a) => a <= x);
    const ann = { xaxis: [], yaxis: [] };
    (op.faixas || []).map((f) => ({ ...f, de: primeiroDe(f.de), ate: ultimoAte(f.ate) })).filter((f) => f.de != null && f.ate != null && f.de <= f.ate).forEach((f) => ann.xaxis.push({ x: String(f.de), x2: String(f.ate), fillColor: f.cor || PB.cor("--superficie-3"), opacity: 0.35, label: { text: f.texto, orientation: "horizontal", position: "top", offsetY: -2, style: { background: "transparent", color: PB.cor("--texto-3"), fontSize: "11px", borderWidth: 0 }, borderColor: "transparent" } }));
    (op.anotacoes || []).filter((a) => cat(a.x)).forEach((a) => ann.xaxis.push({ x: cat(a.x), borderColor: PB.cor("--eixo"), strokeDashArray: 4, label: { text: a.texto || "", orientation: "horizontal", style: { background: "transparent", color: PB.cor("--texto-3"), fontSize: "10.5px" }, borderColor: "transparent" } }));
    (op.linhasY || []).forEach((l) => ann.yaxis.push({ y: l.y, borderColor: PB.cor("--texto-3"), strokeDashArray: 4, label: { text: l.texto, position: "left", textAnchor: "start", style: { background: PB.cor("--superficie"), color: PB.cor("--texto-2"), fontSize: "11px" }, borderColor: "transparent" } }));
    o.annotations = ann;
    return monta(alvo, o);
  };

  /**
   * Linhas com eixo de datas (pesquisas de opinião, que têm data de campo e não ano).
   * op: { series:[{name, data:[[ms, y]], color, dash}], altura, yMin, yMax, fy, faixas:[{de: ms, ate: ms, texto, cor}], linhasY }
   */
  G.linhaTempo = (alvo, op) => {
    const fy = op.fy || ((v) => PB.num(v, 0) + "%");
    const o = base({ type: "line", height: op.altura || 320 });
    o.series = op.series.map((s) => ({ name: s.name, data: s.data.map(([x, y]) => ({ x, y })) }));
    o.colors = op.series.map((s) => s.color);
    o.stroke = { width: op.series.map((s) => s.largura ?? 2.2), curve: "straight", dashArray: op.series.map((s) => s.dash || 0) };
    o.markers = { size: op.series.map((s) => s.marcador ?? (s.data.length < 40 ? 3.5 : 0)), strokeWidth: 1, strokeColors: PB.cor("--superficie"), hover: { size: 6 } };
    o.xaxis = { type: "datetime", min: op.xMin, max: op.xMax, labels: { datetimeUTC: false, format: op.formatoX || "yyyy" }, axisBorder: { color: PB.cor("--eixo") }, tooltip: { enabled: false } };
    o.yaxis = { min: op.yMin ?? 0, max: op.yMax ?? 100, tickAmount: 5, labels: { formatter: fy } };
    o.legend.show = op.series.length > 1;
    // Séries com datas diferentes (institutos distintos): a dica compartilhada do Apex alinha pelo
    // índice, não pela data, e desenhava pontos falsos em zero. A dica mostra só o ponto sob o mouse.
    o.tooltip.shared = false;
    o.tooltip.intersect = true;
    o.tooltip.x = { format: "dd/MM/yyyy" };
    o.tooltip.y = { formatter: (v) => (v == null ? "–" : fy(v)) };
    o.annotations = {
      xaxis: (op.faixas || []).map((f) => ({ x: f.de, x2: f.ate, fillColor: f.cor || PB.cor("--superficie-3"), opacity: 0.3, label: { text: f.texto, orientation: "horizontal", position: "top", style: { background: "transparent", color: PB.cor("--texto-3"), fontSize: "11px" }, borderColor: "transparent" } })),
      yaxis: (op.linhasY || []).map((l) => ({ y: l.y, borderColor: PB.cor("--texto-3"), strokeDashArray: 4, label: { text: l.texto, position: "left", textAnchor: "start", style: { background: PB.cor("--superficie"), color: PB.cor("--texto-2"), fontSize: "11px" }, borderColor: "transparent" } })),
    };
    return monta(alvo, o);
  };

  /**
   * Barras (verticais ou horizontais, agrupadas ou empilhadas).
   * op: { categorias, series:[{name, data, color}], horizontal, empilhada, cem (100%), fmt, altura, rotulos }
   */
  G.barras = (alvo, op) => {
    const o = base({ type: "bar", height: op.altura || 320, stacked: !!op.empilhada, stackType: op.cem ? "100%" : undefined });
    const fmt = op.fmt || ((v) => PB.num(v, 1));
    o.series = op.series;
    o.colors = op.cores || op.series.map((s) => s.color);
    o.plotOptions = { bar: { distributed: !!op.cores, horizontal: !!op.horizontal, borderRadius: 3, borderRadiusApplication: "end", barHeight: "72%", columnWidth: "62%", dataLabels: { position: op.empilhada ? "center" : "top" } } };
    o.stroke = { show: true, width: 2, colors: [PB.cor("--superficie")] };
    const muitas = !op.horizontal && op.categorias.length > 14;
    o.xaxis = { categories: op.categorias, labels: { formatter: op.horizontal ? fmt : undefined, rotate: muitas ? -90 : 0, rotateAlways: muitas, trim: !muitas, hideOverlappingLabels: !muitas, style: { fontSize: muitas ? "10.5px" : "12px" } }, axisBorder: { color: PB.cor("--eixo") } };
    o.yaxis = { labels: { formatter: op.horizontal ? undefined : fmt, maxWidth: 180 } };
    o.legend.show = op.series.length > 1 && !op.cores;
    o.tooltip.y = { formatter: (v) => fmt(v) };
    if (op.rotulos) {
      o.dataLabels = { enabled: true, formatter: (v) => (op.cem ? PB.num(v, 0) + "%" : fmt(v)), style: { fontSize: "11px", fontWeight: 600, colors: [op.empilhada ? "#fff" : PB.cor("--texto")] }, offsetX: op.horizontal && !op.empilhada ? 22 : 0, dropShadow: { enabled: false } };
    }
    if (op.onclick) o.chart.events = { dataPointSelection: (e, ctx, cfg) => op.onclick(cfg.dataPointIndex, cfg.seriesIndex) };
    return monta(alvo, o);
  };

  /**
   * Dispersão em D3, com reta de regressão, rótulos e dica.
   * op: { pontos:[{id, x, y, rotulo, cor, r, dica}], xRot, yRot, fx, fy, reta:{a, b} , xLog, destacar(id), onclick(id), altura, quadrantes:{x, y, rotulos:[...4]} }
   */
  G.dispersao = (alvo, op) => {
    alvo.replaceChildren();
    const caixa = C.el("div", { class: "mapa-caixa" });
    alvo.append(caixa);
    const L = 760, A = op.altura || 460, m = { t: 16, r: 18, b: 46, l: 64 };
    const svg = d3.select(caixa).append("svg").attr("viewBox", `0 0 ${L} ${A}`).attr("role", "img").attr("aria-label", `Dispersão: ${op.xRot} × ${op.yRot}`);
    const pts = op.pontos.filter((p) => p.x != null && p.y != null && (!op.xLog || p.x > 0));
    if (!pts.length) { caixa.replaceChildren(C.vazio("Sem dados para os filtros escolhidos.")); return; }
    const xe = d3.extent(pts, (p) => p.x), ye = d3.extent(pts, (p) => p.y);
    const pad = (e, f = 0.06) => { const d = e[1] - e[0] || 1; return [e[0] - d * f, e[1] + d * f]; };
    const x = (op.xLog ? d3.scaleLog().domain([xe[0] * 0.9, xe[1] * 1.1]) : d3.scaleLinear().domain(pad(xe))).range([m.l, L - m.r]).nice();
    const y = d3.scaleLinear().domain(pad(ye)).range([A - m.b, m.t]).nice();
    const grade = PB.cor("--grade"), eixo = PB.cor("--eixo"), t2 = PB.cor("--texto-2"), t3 = PB.cor("--texto-3");
    // escala log: só marcas 1, 2 e 5 × 10^k, para os rótulos não se atropelarem
    const eixoX = d3.axisBottom(x).tickSize(-(A - m.t - m.b));
    const mantissa = (v) => Math.round(v / Math.pow(10, Math.floor(Math.log10(v))));
    if (op.xLog) eixoX.tickValues(x.ticks(10).filter((v) => [1, 2, 5].includes(mantissa(v)))).tickFormat((v) => PB.compacto(v));
    else eixoX.ticks(8).tickFormat(op.fx);
    const gx = svg.append("g").attr("transform", `translate(0,${A - m.b})`).call(eixoX);
    // recorte da área do gráfico (a reta de regressão não sai dos eixos)
    const idClip = "clip-" + Math.random().toString(36).slice(2, 8);
    svg.append("clipPath").attr("id", idClip).append("rect").attr("x", m.l).attr("y", m.t).attr("width", L - m.l - m.r).attr("height", A - m.t - m.b);
    const gy = svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(7).tickFormat(op.fy).tickSize(-(L - m.l - m.r)));
    [gx, gy].forEach((g) => { g.selectAll("line").attr("stroke", grade).attr("stroke-dasharray", "3 3"); g.select(".domain").attr("stroke", eixo); g.selectAll("text").attr("fill", t3).attr("font-size", 11.5); });
    svg.append("text").attr("x", (m.l + L - m.r) / 2).attr("y", A - 8).attr("text-anchor", "middle").attr("fill", t2).attr("font-size", 12.5).attr("font-weight", 600).text(op.xRot);
    svg.append("text").attr("transform", `translate(14,${(m.t + A - m.b) / 2}) rotate(-90)`).attr("text-anchor", "middle").attr("fill", t2).attr("font-size", 12.5).attr("font-weight", 600).text(op.yRot);
    if (op.quadrantes) {
      const q = op.quadrantes;
      svg.append("line").attr("x1", x(q.x)).attr("x2", x(q.x)).attr("y1", m.t).attr("y2", A - m.b).attr("stroke", t3).attr("stroke-dasharray", "2 4");
      svg.append("line").attr("x1", m.l).attr("x2", L - m.r).attr("y1", y(q.y)).attr("y2", y(q.y)).attr("stroke", t3).attr("stroke-dasharray", "2 4");
      if (q.rotulos) {
        const pos = [[m.l + 6, m.t + 12, "start"], [L - m.r - 6, m.t + 12, "end"], [m.l + 6, A - m.b - 8, "start"], [L - m.r - 6, A - m.b - 8, "end"]];
        q.rotulos.forEach((t, i) => t && svg.append("text").attr("x", pos[i][0]).attr("y", pos[i][1]).attr("text-anchor", pos[i][2]).attr("fill", t3).attr("font-size", 11).text(t));
      }
    }
    if (op.reta) {
      const [x0, x1] = x.domain();
      const xs = op.xLog ? d3.range(0, 41).map((i) => x0 * Math.pow(x1 / x0, i / 40)) : [x0, x1];
      const fx = (v) => op.reta.a + op.reta.b * (op.xLog ? Math.log10(v) : v);
      svg.append("path").attr("clip-path", `url(#${idClip})`).attr("d", d3.line().x((v) => x(v)).y((v) => y(fx(v)))(xs)).attr("fill", "none").attr("stroke", PB.cor("--texto")).attr("stroke-width", 1.6).attr("stroke-dasharray", "6 4").attr("opacity", 0.75);
    }
    const muitos = pts.length > 300;
    const g = svg.append("g");
    const sel = g.selectAll("circle").data(pts.sort((a, b) => (b.r || 0) - (a.r || 0))).join("circle")
      .attr("cx", (p) => x(p.x)).attr("cy", (p) => y(p.y)).attr("r", (p) => p.r || (muitos ? 2.4 : 6))
      .attr("fill", (p) => p.cor).attr("fill-opacity", muitos ? 0.55 : 0.85)
      .attr("stroke", PB.cor("--superficie")).attr("stroke-width", muitos ? 0.3 : 1.5)
      .style("cursor", op.onclick ? "pointer" : "default")
      .on("mousemove", (ev, p) => C.mostraDica(p.dica, ev.clientX, ev.clientY)).on("mouseleave", C.escondeDica)
      .on("click", (ev, p) => op.onclick && op.onclick(p.id));
    if (!muitos) {
      sel.attr("tabindex", 0).attr("role", "img").attr("aria-label", (p) => p.dica.replace(/<[^>]+>/g, " "))
        .on("focus", function (ev, p) { const r = this.getBoundingClientRect(); C.mostraDica(p.dica, r.right, r.top); }).on("blur", C.escondeDica);
      g.selectAll("text").data(pts.filter((p) => p.rotulo)).join("text").attr("x", (p) => x(p.x) + (p.r || 6) + 3).attr("y", (p) => y(p.y) + 4)
        .attr("font-size", 11).attr("font-weight", 700).attr("fill", t2).attr("pointer-events", "none").text((p) => p.rotulo);
    }
    if (op.destacar) g.selectAll("circle").filter((p) => p.id === op.destacar).raise().attr("stroke", PB.cor("--texto")).attr("stroke-width", 2.5).attr("r", (p) => (p.r || 6) + 3).attr("fill-opacity", 1);
    return caixa;
  };
})();

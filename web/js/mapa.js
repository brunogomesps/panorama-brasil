/* Mapas em D3: Brasil por UF (coroplético ou cartograma em grade) e por município. */
(function () {
  "use strict";
  const PB = window.PB;
  const C = PB.C;
  const M = (PB.Mapa = {});
  const NS = "http://www.w3.org/2000/svg";

  // O IBGE entrega os anéis no sentido anti-horário (padrão GeoJSON); o D3 usa geometria
  // esférica e espera o horário. Sem inverter, cada polígono vira "o planeta menos a região".
  function rebobina(f) {
    if (d3.geoArea(f) > 2 * Math.PI) {
      const g = f.geometry;
      const inv = (rings) => rings.map((r) => r.slice().reverse());
      if (g.type === "Polygon") g.coordinates = inv(g.coordinates);
      else if (g.type === "MultiPolygon") g.coordinates = g.coordinates.map(inv);
    }
    return f;
  }
  const COD2UF = Object.fromEntries(PB.locais.filter((l) => l.tipo === "uf").map((l) => [String(l.cod), l.id]));
  let featUF = null, featMun = null;
  function ufs() {
    if (!featUF) featUF = window.PB_GEO.uf.features.map((f) => rebobina({ ...f, properties: { ...f.properties, uf: COD2UF[f.properties.codarea] } }));
    return featUF;
  }
  function municipios() {
    if (!featMun) {
      const t = window.PB_GEO.mun;
      featMun = topojson.feature(t, t.objects[Object.keys(t.objects)[0]]).features.map(rebobina);
    }
    return featMun;
  }

  function texto(html) { const d = document.createElement("div"); d.innerHTML = html; return d.textContent; }

  function hachura(svg) {
    const defs = d3.select(svg).append("defs");
    const p = defs.append("pattern").attr("id", "hachura").attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
    p.append("rect").attr("width", 6).attr("height", 6).attr("fill", PB.cor("--sem-dado"));
    p.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6).attr("stroke", PB.cor("--texto-3")).attr("stroke-width", 1.2).attr("opacity", 0.5);
  }

  function interativo(sel, { dica, onclick }) {
    sel
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => texto(dica(d)))
      .on("mousemove", (ev, d) => C.mostraDica(dica(d), ev.clientX, ev.clientY))
      .on("mouseleave", C.escondeDica)
      .on("focus", function (ev, d) { const r = this.getBoundingClientRect(); C.mostraDica(dica(d), r.right, r.top); })
      .on("blur", C.escondeDica)
      .on("click", (ev, d) => onclick && onclick(d))
      .on("keydown", (ev, d) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onclick && onclick(d); } });
  }

  /**
   * Brasil por UF.
   * op: { cor(uf) -> cor|null, dica(uf) -> html, onclick(uf), selecionado, forma: 'mapa'|'grade', valorTexto(uf) -> string, altura }
   */
  M.uf = (alvo, op) => {
    alvo.replaceChildren();
    const caixa = C.el("div", { class: "mapa-caixa" });
    alvo.append(caixa);
    const forma = op.forma || "mapa";
    const svg = document.createElementNS(NS, "svg");
    caixa.append(svg);
    hachura(svg);
    const s = d3.select(svg);
    const fill = (uf) => op.cor(uf) || "url(#hachura)";
    const resumo = [];
    if (forma === "grade") {
      const lado = 74, gap = 5;
      svg.setAttribute("viewBox", `0 0 ${7 * (lado + gap)} ${8 * (lado + gap)}`);
      svg.setAttribute("role", "group");
      svg.setAttribute("aria-label", "Cartograma em grade: cada estado ocupa um quadrado do mesmo tamanho");
      const dados = PB.UFS.map((u) => ({ uf: u, c: PB.local[u].grade[0], l: PB.local[u].grade[1] }));
      const g = s.selectAll("g.t").data(dados).join("g").attr("class", "t").attr("transform", (d) => `translate(${d.c * (lado + gap)},${d.l * (lado + gap)})`);
      const r = g.append("rect").attr("class", (d) => "tile" + (d.uf === op.selecionado ? " sel" : "")).attr("width", lado).attr("height", lado).attr("rx", 9).attr("fill", (d) => fill(d.uf));
      interativo(r, { dica: (d) => op.dica(d.uf), onclick: (d) => op.onclick && op.onclick(d.uf) });
      g.append("text").attr("class", "rot").attr("x", lado / 2).attr("y", op.valorTexto ? lado / 2 - 9 : lado / 2).attr("fill", (d) => PB.textoSobre(op.cor(d.uf) || PB.cor("--sem-dado"))).text((d) => d.uf);
      if (op.valorTexto) g.append("text").attr("class", "rot-val").attr("x", lado / 2).attr("y", lado / 2 + 10).attr("fill", (d) => PB.textoSobre(op.cor(d.uf) || PB.cor("--sem-dado"))).text((d) => op.valorTexto(d.uf));
    } else {
      const L = 800, A = op.altura || 780;
      svg.setAttribute("viewBox", `0 0 ${L} ${A}`);
      svg.setAttribute("role", "group");
      svg.setAttribute("aria-label", "Mapa do Brasil por estado");
      const fc = { type: "FeatureCollection", features: ufs() };
      const proj = d3.geoMercator().fitExtent([[10, 10], [L - 10, A - 10]], fc);
      const path = d3.geoPath(proj);
      const p = s.selectAll("path.uf").data(fc.features).join("path")
        .attr("class", (d) => "uf" + (d.properties.uf === op.selecionado ? " sel" : ""))
        .attr("d", path).attr("fill", (d) => fill(d.properties.uf));
      interativo(p, { dica: (d) => op.dica(d.properties.uf), onclick: (d) => op.onclick && op.onclick(d.properties.uf) });
      // selecionado por cima
      s.selectAll("path.sel").raise();
      // siglas nos estados grandes o bastante
      const pequenos = new Set(["DF", "SE", "AL", "PB", "RN", "ES", "RJ"]);
      s.selectAll("text.rot").data(fc.features.filter((f) => !pequenos.has(f.properties.uf))).join("text").attr("class", "rot")
        .attr("transform", (d) => `translate(${path.centroid(d)})`)
        .attr("fill", (d) => PB.textoSobre(op.cor(d.properties.uf) || PB.cor("--sem-dado")))
        .text((d) => d.properties.uf);
    }
    PB.UFS.forEach((u) => resumo.push(texto(op.dica(u))));
    caixa.append(C.el("p", { class: "so-leitor" }, resumo.join(". ")));
    return caixa;
  };

  /**
   * Brasil (ou uma UF) por município.
   * op: { cor(cod) -> cor|null, dica(cod) -> html, uf (foco opcional), onclick(cod) }
   */
  M.municipios = (alvo, op) => {
    alvo.replaceChildren();
    const caixa = C.el("div", { class: "mapa-caixa" });
    alvo.append(caixa);
    const svg = document.createElementNS(NS, "svg");
    caixa.append(svg);
    hachura(svg);
    const L = 800, A = op.uf ? 640 : 780;
    svg.setAttribute("viewBox", `0 0 ${L} ${A}`);
    svg.setAttribute("aria-label", op.uf ? "Mapa dos municípios de " + PB.nomeLocal(op.uf) : "Mapa do Brasil por município");
    const cod2uf = Object.fromEntries(PB.locais.filter((l) => l.tipo === "uf").map((l) => [String(l.cod), l.id]));
    let feats = municipios();
    if (op.uf) feats = feats.filter((f) => cod2uf[String(f.properties.codarea).slice(0, 2)] === op.uf);
    const fc = { type: "FeatureCollection", features: feats };
    const proj = d3.geoMercator().fitExtent([[10, 10], [L - 10, A - 10]], fc);
    const path = d3.geoPath(proj);
    const s = d3.select(svg);
    const p = s.append("g").selectAll("path").data(feats).join("path").attr("class", "mun")
      .attr("d", path).attr("fill", (d) => op.cor(String(d.properties.codarea)) || "url(#hachura)");
    // Para 5.570 polígonos, a dica vai só no mouse; o teclado usa a busca/tabela da página
    p.on("mousemove", (ev, d) => C.mostraDica(op.dica(String(d.properties.codarea)), ev.clientX, ev.clientY))
      .on("mouseleave", C.escondeDica)
      .on("click", (ev, d) => op.onclick && op.onclick(String(d.properties.codarea)));
    // contorno dos estados
    const ufsF = op.uf ? ufs().filter((f) => f.properties.uf === op.uf) : ufs();
    s.append("g").selectAll("path").data(ufsF).join("path").attr("class", "contorno-uf").attr("d", path);
    return caixa;
  };
})();

/* Apoio às telas de eleição: resultados por local, líder, margem e cores por candidato. */
(function () {
  "use strict";
  const PB = window.PB;
  const EL = (PB.EL = {});
  const E = PB.D.eleicoes;
  EL.anos = E.anos;
  EL.resultado = (ano, turno) => (E.presidente[ano] || {})[turno] || null;
  EL.temTurno = (ano, turno) => !!EL.resultado(ano, turno);
  EL.nome = (c) => PB.titulo(c.nome);

  /** cores fixas dos candidatos de uma eleição (pela ordem nacional de votos) */
  const cacheCores = {};
  EL.cores = (ano) => {
    const k = ano + (document.documentElement.getAttribute("data-tema") || "");
    if (cacheCores[k]) return cacheCores[k];
    const r1 = EL.resultado(ano, 1);
    const lista = r1.candidatos;
    const cores = PB.coresCandidatos(lista);
    const m = {};
    lista.forEach((c, i) => (m[c.nr] = i < 6 ? cores[i] : PB.cor("--p-outros")));
    return (cacheCores[k] = m);
  };
  EL.limpaCache = () => Object.keys(cacheCores).forEach((k) => delete cacheCores[k]);

  /** líder num local: {nr, nome, partido, pct, margem, segundo, validos} */
  EL.lider = (ano, turno, loc) => {
    const r = EL.resultado(ano, turno);
    if (!r || !r.votos[loc]) return null;
    const vs = Object.entries(r.votos[loc]).sort((a, b) => b[1] - a[1]);
    const tot = vs.reduce((s, x) => s + x[1], 0);
    const info = (nr) => r.candidatos.find((c) => c.nr === nr);
    const [n1, v1] = vs[0], [n2, v2] = vs[1] || [null, 0];
    return { nr: n1, cand: info(n1), pct: (v1 / tot) * 100, segundo: n2 ? info(n2) : null, pct2: (v2 / tot) * 100, margem: ((v1 - v2) / tot) * 100, validos: tot, votos: v1 };
  };
  EL.pct = (ano, turno, loc, nr) => {
    const r = EL.resultado(ano, turno);
    if (!r || !r.votos[loc]) return null;
    const tot = Object.values(r.votos[loc]).reduce((s, x) => s + x, 0);
    return ((r.votos[loc][nr] || 0) / tot) * 100;
  };
  /** cor do líder com intensidade pela margem: <5 p.p. clara, 5–15 média, >15 cheia */
  EL.intensidade = (margem) => (margem < 5 ? 0.42 : margem < 15 ? 0.7 : 1);
  EL.corLider = (ano, turno, loc) => {
    const l = EL.lider(ano, turno, loc);
    if (!l) return null;
    const cor = EL.cores(ano)[l.nr] || PB.cor("--p-outros");
    return d3.interpolateRgb(PB.cor("--superficie"), cor)(EL.intensidade(l.margem));
  };
  EL.faixaMargem = (m) => (m < 5 ? "disputa apertada (menos de 5 p.p.)" : m < 15 ? "vantagem clara (5 a 15 p.p.)" : "vantagem ampla (mais de 15 p.p.)");
  EL.dicaLider = (ano, turno, loc) => {
    const l = EL.lider(ano, turno, loc);
    if (!l) return `<div class="t">${PB.esc(PB.nomeLocal(loc))}</div>sem dado`;
    return `<div class="t">${PB.esc(PB.nomeLocal(loc))}</div>` +
      `<b>${PB.esc(EL.nome(l.cand))}</b> (${PB.esc(l.cand.partido)}) liderou com ${PB.num(l.pct, 1)}% dos válidos<br>` +
      (l.segundo ? `${PB.esc(EL.nome(l.segundo))}: ${PB.num(l.pct2, 1)}%<br>` : "") +
      `<span class="l">Margem de ${PB.num(l.margem, 1)} p.p.: ${EL.faixaMargem(l.margem)}</span>`;
  };
  /** legenda da intensidade pela margem para os candidatos que lideram em algum lugar */
  EL.legendaLider = (ano, turno, locais) => {
    const lideres = new Map();
    locais.forEach((l) => { const x = EL.lider(ano, turno, l); if (x) lideres.set(x.nr, (lideres.get(x.nr) || 0) + 1); });
    const cores = EL.cores(ano);
    const r = EL.resultado(ano, turno);
    const cx = PB.C.el("div", { class: "legenda" });
    [...lideres.entries()].sort((a, b) => b[1] - a[1]).forEach(([nr, n]) => {
      const c = r.candidatos.find((x) => x.nr === nr);
      const item = PB.C.el("span", { class: "item" });
      [0.42, 0.7, 1].forEach((t) => item.append(PB.C.el("span", { class: "sw", style: { background: d3.interpolateRgb(PB.cor("--superficie"), cores[nr])(t), width: "10px" } })));
      item.append(` ${EL.nome(c)} (${c.partido}): lidera em ${n}`);
      cx.append(item);
    });
    cx.append(PB.C.el("span", { class: "item", style: { color: "var(--texto-3)" } }, "Tom mais claro = margem menor (<5 p.p.), médio = 5 a 15 p.p., cheio = mais de 15 p.p."));
    return cx;
  };
  // ---------------------------------------------------------------- Medidas de voto (sem partido fixo)
  // Qual candidato acompanhar em cada eleição. O padrão do painel é o vencedor; "PT" fica como opção
  // porque é o único partido presente em todos os 2º turnos (série contínua), não como destaque.
  const GOVERNO_T2 = { 2002: "45", 2006: "13", 2010: "13", 2014: "13", 2018: null, 2022: "22", 2026: "13" };
  EL.MEDIDAS = {
    vencedor: { t: "Vencedor da eleição", ind: "voto_vencedor", desc: "candidato que venceu a eleição nacional", nr: (a) => { const r = EL.resultado(a, 2) || EL.resultado(a, 1); return r.candidatos[0].nr; } },
    governo: { t: "Candidato do governo federal", ind: "voto_governo_t2", desc: "candidato da situação no 2º turno (em 2018 o governo não foi ao 2º turno)", nr: (a) => GOVERNO_T2[a] },
    pt: { t: "PT (único partido em todos os 2º turnos)", ind: "voto_pt_t2", desc: "candidato do PT no 2º turno", nr: () => "13" },
  };
  EL.medida = (m) => EL.MEDIDAS[m] || EL.MEDIDAS.vencedor;
  /** candidato da medida no 2º turno de um ano, o adversário e as cores dos dois */
  EL.candMedida = (m, ano) => {
    const nr = EL.medida(m).nr(ano);
    const r = EL.resultado(ano, 2);
    if (!nr || !r) return null;
    const c = r.candidatos.find((x) => x.nr === nr), op = r.candidatos.find((x) => x.nr !== nr);
    if (!c) return null;
    const cores = EL.cores(ano);
    return { nr, cand: c, op, cor: cores[nr] || PB.corPartido(c.partido), corOp: op ? cores[op.nr] || PB.corPartido(op.partido) : PB.cor("--p-outros") };
  };
  /** cor de um % da medida: acima de 50 na cor do candidato, abaixo na do adversário, cinza no equilíbrio */
  EL.corMedida = (m, ano, v, amplitude = 25) => {
    const cm = EL.candMedida(m, ano);
    if (v == null || !cm) return PB.cor("--sem-dado");
    const t = Math.max(-1, Math.min(1, (v - 50) / amplitude));
    const base = PB.cor("--div-0");
    return t >= 0 ? d3.interpolateRgb(base, cm.cor)(t) : d3.interpolateRgb(base, cm.corOp)(-t);
  };
  EL.selectMedida = (valor, onchange) => PB.C.select("Medir o voto por", Object.entries(EL.MEDIDAS).map(([k, v]) => ({ v: k, t: v.t })), valor, onchange);
  EL.rotuloMedida = (m, ano) => { const cm = EL.candMedida(m, ano); return cm ? `${EL.nome(cm.cand)} (${cm.cand.partido})` : "–"; };
  /** quem é o candidato da medida em cada ano (texto curto para legendas) */
  EL.candidatosDaMedida = (m) => EL.anos.map((a) => `${a}: ${EL.rotuloMedida(m, a)}`).join(" · ");
  /** cartão "voto por região" com seletor de medida; onMedida(v) é chamado ao trocar */
  EL.cartaoVotoRegioes = (medida, onMedida, altura = 400) => {
    const M = EL.medida(medida), ind = PB.ind[M.ind];
    const cv = PB.C.cartao({ titulo: "O voto por região, 2002 a 2026", sub: `${M.t}: ${M.desc}. % dos válidos no 2º turno. Linha tracejada = Brasil.`, ind, fonte: "TSE" });
    cv.corpo.append(PB.C.el("div", { class: "filtros", style: { boxShadow: "none", border: 0, padding: "0 0 8px", margin: 0 } }, EL.selectMedida(medida, onMedida)));
    const g = PB.C.el("div");
    cv.corpo.append(g, PB.C.el("p", { class: "leitura" }, "Candidato em cada ano: " + EL.candidatosDaMedida(medida) + "."));
    cv.desenhar = () => PB.G.linha(g, { series: [...PB.REGIOES.map((rg) => ({ name: PB.nomeLocal(rg), data: PB.serie(M.ind, rg), color: PB.corRegiao(rg) })), { name: "Brasil", data: PB.serie(M.ind, "BR"), color: PB.cor("--texto-3"), dash: 5 }],
      ind, altura, xMin: 2002, xMax: 2026, linhasY: [{ y: 50, texto: "50%" }] });
    return cv;
  };

  EL.governador = (ano, uf) => (E.governador[ano] || {})[uf] || null;
  EL.comparecimento = (ano, turno, loc) => ((E.comparecimento[ano] || {})[turno] || {})[loc] || null;
})();

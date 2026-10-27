/* Panorama Brasil: utilitários (dados, formatação, estatística, cores, polaridade, URL). */
(function () {
  "use strict";
  const PB = (window.PB = window.PB || {});
  const D = window.PB_DADOS;
  PB.D = D;

  // ---------------------------------------------------------------- Locais
  PB.locais = D.locais;
  PB.local = Object.fromEntries(D.locais.map((l) => [l.id, l]));
  PB.UFS = D.locais.filter((l) => l.tipo === "uf").map((l) => l.id);
  PB.REGIOES = ["N", "NE", "SD", "S", "CO"]; // "SD" = Sudeste (evita colisão com SE, Sergipe)
  PB.nomeLocal = (id) => (PB.local[id] ? PB.local[id].nome : id);
  PB.regiaoDe = (uf) => (PB.local[uf] ? PB.local[uf].regiao : null);
  PB.ufsDaRegiao = (r) => PB.UFS.filter((u) => PB.local[u].regiao === r);

  // ---------------------------------------------------------- Indicadores
  PB.indicadores = D.indicadores;
  PB.ind = Object.fromEntries(D.indicadores.map((i) => [i.id, i]));
  PB.temas = [...new Set(D.indicadores.map((i) => i.tema))];
  /** valor de um indicador num local e ano (null se não houver) */
  PB.valor = (id, loc, ano) => {
    const s = D.valores[id] && D.valores[id][loc];
    if (!s) return null;
    const v = s[String(ano)];
    return v === undefined ? null : v;
  };
  PB.serie = (id, loc) => {
    const s = (D.valores[id] && D.valores[id][loc]) || {};
    return Object.keys(s).map(Number).sort((a, b) => a - b).map((a) => [a, s[a]]);
  };
  /** anos com dado para o indicador (em qualquer local, ou nas UFs se soUFs) */
  PB.anosDe = (id, soUFs) => {
    const v = D.valores[id] || {};
    const set = new Set();
    for (const [loc, s] of Object.entries(v)) {
      if (soUFs && PB.local[loc] && PB.local[loc].tipo !== "uf") continue;
      Object.keys(s).forEach((a) => set.add(+a));
    }
    return [...set].sort((a, b) => a - b);
  };
  PB.ultimoAno = (id, soUFs = true) => {
    const a = PB.anosDe(id, soUFs);
    return a.length ? a[a.length - 1] : null;
  };
  /** ano disponível mais próximo, sem passar de 'ano' (para cruzar com eleições) */
  PB.anoAte = (id, ano) => {
    const a = PB.anosDe(id, true).filter((x) => x <= ano);
    return a.length ? a[a.length - 1] : null;
  };
  PB.anoMaisProximo = (id, ano) => {
    const a = PB.anosDe(id, true);
    if (!a.length) return null;
    return a.reduce((m, x) => (Math.abs(x - ano) < Math.abs(m - ano) ? x : m), a[0]);
  };

  // ----------------------------------------------------------- Formatação
  const nf = (c) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
  const cacheNF = {};
  PB.num = (v, c = 1) => (v == null || isNaN(v) ? "–" : (cacheNF[c] = cacheNF[c] || nf(c)).format(v));
  PB.inteiro = (v) => PB.num(v, 0);
  PB.compacto = (v) => {
    if (v == null) return "–";
    const a = Math.abs(v);
    if (a >= 1e12) return PB.num(v / 1e12, 2) + " tri";
    if (a >= 1e9) return PB.num(v / 1e9, 1) + " bi";
    if (a >= 1e6) return PB.num(v / 1e6, 1) + " mi";
    if (a >= 1e4) return PB.num(v / 1e3, 1) + " mil";
    return PB.num(v, 0);
  };
  /** formata o valor de um indicador conforme o catálogo */
  PB.fmt = (ind, v, comUnidade = false) => {
    if (typeof ind === "string") ind = PB.ind[ind];
    if (v == null || isNaN(v)) return "–";
    let s;
    switch (ind.formato) {
      case "moeda": s = "R$ " + PB.num(v, 0); break;
      case "moeda_grande": s = "R$ " + PB.compacto(v); break;
      case "int": s = PB.compacto(v); break;
      default: s = PB.num(v, Math.min(ind.casas, 3));
    }
    if (comUnidade && !["moeda", "moeda_grande"].includes(ind.formato)) {
      const u = ind.unidade;
      if (u === "%" || u.startsWith("% ")) s += u === "%" ? "%" : " " + u;
      else if (u && u !== "pessoas" && u !== "R$") s += " " + u;
    }
    return s;
  };
  PB.unidadeCurta = (ind) => (ind.formato === "moeda" || ind.formato === "moeda_grande" ? "R$" : ind.unidade);
  /** diferença formatada: p.p. para percentuais, % para valores monetários/contagens */
  PB.fmtDelta = (ind, d) => {
    if (d == null || isNaN(d)) return "–";
    const sinal = d > 0 ? "+" : d < 0 ? "−" : "";
    const abs = Math.abs(d);
    if (ind.unidade && ind.unidade.includes("%")) return sinal + PB.num(abs, 1) + " p.p.";
    if (ind.formato === "moeda") return sinal + "R$ " + PB.num(abs, 0);
    if (ind.formato === "moeda_grande" || ind.formato === "int") return sinal + PB.compacto(abs);
    return sinal + PB.num(abs, Math.min(ind.casas, 2));
  };
  /** primeira letra minúscula, preservando siglas ("PIB per capita", "Votos do PT" → "votos do PT") */
  PB.minus = (s) => (!s ? "" : /^[A-ZÀ-Ú]{2}/.test(s) ? s : s[0].toLowerCase() + s.slice(1));
  PB.titulo = (s) => (s || "").toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
  PB.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ------------------------------------------------------------ Polaridade
  PB.pol = {
    rotulo(ind) {
      return ind.polaridade === "maior" ? "Maior é melhor" : ind.polaridade === "menor" ? "Menor é melhor" : "Sem leitura de melhor ou pior";
    },
    curto(ind) {
      return ind.polaridade === "maior" ? "↑ melhor" : ind.polaridade === "menor" ? "↓ melhor" : "neutro";
    },
    /** +1 se o valor a é melhor que b, -1 se pior, 0 se igual/neutro */
    compara(ind, a, b) {
      if (a == null || b == null || ind.polaridade === "neutro" || a === b) return 0;
      const maior = a > b;
      return (ind.polaridade === "maior") === maior ? 1 : -1;
    },
    /** classifica uma variação: 'bom' | 'ruim' | 'neutra' e o verbo */
    variacao(ind, delta, tol = 1e-9) {
      if (delta == null || isNaN(delta)) return { classe: "neutra", texto: "" };
      if (Math.abs(delta) <= tol) return { classe: "neutra", texto: "estável" };
      if (ind.polaridade === "neutro") return { classe: "neutra", texto: delta > 0 ? "subiu" : "caiu" };
      const melhorou = (ind.polaridade === "maior") === delta > 0;
      return { classe: melhorou ? "bom" : "ruim", texto: melhorou ? "melhorou" : "piorou" };
    },
    /** ordena pares [loc, valor] do melhor para o pior (neutro: do maior para o menor) */
    ordena(ind, pares) {
      const dir = ind.polaridade === "menor" ? 1 : -1;
      return pares.filter((p) => p[1] != null).sort((a, b) => dir * (a[1] - b[1]));
    },
    criterioRanking(ind) {
      return ind.polaridade === "neutro" ? "1º = maior valor (indicador neutro)" : "1º = melhor situação (" + PB.pol.rotulo(ind).toLowerCase() + ")";
    },
  };

  /**
   * Seleção inicial sem viés de lugar: Brasil + pior região + pior estado no último ano do indicador
   * (indicador neutro: os de maior valor). Devolve { locs, texto }.
   */
  PB.selecaoAutomatica = (id) => {
    const ind = PB.ind[id];
    const a = PB.ultimoAno(id, true);
    if (!ind || a == null) return { locs: ["BR"], texto: "" };
    const ultimo = (lista) => { const o = PB.pol.ordena(ind, lista.map((l) => [l, PB.valor(id, l, a)])); return o.length ? o[o.length - 1][0] : null; };
    const primeiro = (lista) => { const o = PB.pol.ordena(ind, lista.map((l) => [l, PB.valor(id, l, a)])); return o.length ? o[0][0] : null; };
    const neutro = ind.polaridade === "neutro";
    // neutro: ordena do maior para o menor, então "o primeiro" é o de maior valor
    const reg = neutro ? primeiro(PB.REGIOES) : ultimo(PB.REGIOES);
    const uf = neutro ? primeiro(PB.UFS) : ultimo(PB.UFS);
    const locs = ["BR", reg, uf].filter(Boolean);
    const criterio = neutro ? "maior valor" : "pior situação";
    return { locs, texto: `Seleção automática (${criterio} em ${a}): ${PB.nomeLocal(reg)} entre as regiões e ${PB.nomeLocal(uf)} entre os estados. ${neutro ? "Indicador neutro: o critério é o maior valor." : PB.pol.rotulo(ind) + "."}` };
  };

  // --------------------------------------------------------------- Cores
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  PB.cor = css;
  PB.corRegiao = (r) => css("--reg-" + r);
  const PARTIDO_COR = {
    PT: "--p-pt", PSDB: "--p-azul", PL: "--p-azul", PSL: "--p-azul", PR: "--p-azul",
    MDB: "--p-mdb", PMDB: "--p-mdb", PDT: "--p-pdt", PSB: "--p-psb", PV: "--p-verde", REDE: "--p-verde",
    PSOL: "--p-psol", "PC DO B": "--p-pt", PCDOB: "--p-pt", "UNIÃO": "--p-uniao", DEM: "--p-uniao", PFL: "--p-uniao",
    REPUBLICANOS: "--p-rep", PRB: "--p-rep", NOVO: "--p-novo", PSD: "--p-psd", PP: "--p-pp", PPB: "--p-pp",
    PPS: "--p-ambar", CIDADANIA: "--p-ambar", AVANTE: "--p-ambar", PODE: "--p-ambar", PTB: "--p-ambar", SOLIDARIEDADE: "--p-ambar",
  };
  PB.corPartido = (p) => css(PARTIDO_COR[(p || "").toUpperCase().replace("*", "").trim()] || "--p-outros");
  /** cores para candidatos num mesmo gráfico: se dois partidos caem na mesma cor, o menor vai para âmbar */
  PB.coresCandidatos = (lista) => {
    const usadas = new Map();
    return lista.map((c) => {
      let cor = PB.corPartido(c.partido);
      if (cor === PB.corPartido("") || usadas.has(cor)) {
        const alternativas = ["--p-ambar", "--p-psol", "--p-mdb", "--p-pdt", "--p-psb", "--p-verde"].map(css);
        cor = alternativas.find((a) => !usadas.has(a)) || PB.corPartido("");
      }
      usadas.set(cor, true);
      return cor;
    });
  };
  PB.corEspectro = (e) => css(e === "esquerda" ? "--esp-esq" : e === "direita" ? "--esp-dir" : "--esp-cen");
  PB.divergente = () => ["--div-p3", "--div-p2", "--div-p1", "--div-0", "--div-m1", "--div-m2", "--div-m3"].map(css);
  PB.sequencial = () => ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6"].map(css);
  /** cor de texto legível sobre um fundo (luminância relativa WCAG) */
  PB.textoSobre = (hex) => {
    const c = d3.color(hex);
    if (!c) return "#000";
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    return L > 0.36 ? "#111" : "#fff";
  };

  /**
   * Escala de cor de um indicador entre os locais.
   * modo 'desempenho': divergente em torno do valor do Brasil, orientada pela polaridade (verde-azulado = melhor).
   * modo 'quintis'   : 5 classes com o mesmo número de locais; polar → laranja (pior) a verde-azulado (melhor).
   * indicadores neutros: sempre sequencial de um só matiz (mais escuro = maior).
   */
  PB.escala = (ind, valores, modo, referencia) => {
    const vs = valores.filter((v) => v != null && !isNaN(v));
    const semDado = css("--sem-dado");
    if (!vs.length) return { cor: () => semDado, legenda: null };
    const polar = ind.polaridade !== "neutro";
    if (!polar || modo === "continua") {
      const seq = PB.sequencial();
      const [mn, mx] = d3.extent(vs);
      const q = d3.scaleQuantize().domain([mn, mx === mn ? mn + 1 : mx]).range(seq);
      if (polar && modo === "continua") {
        // contínua, mas orientada pela polaridade
        const div = PB.divergente();
        const dom = ind.polaridade === "maior" ? [mn, mx] : [mx, mn];
        const s = d3.scaleQuantize().domain(dom[0] < dom[1] ? dom : [dom[1], dom[0]]).range(dom[0] < dom[1] ? div : [...div].reverse());
        return { cor: (v) => (v == null ? semDado : s(v)), tipo: "continua", cores: div, rotulos: [PB.fmt(ind, ind.polaridade === "maior" ? mn : mx), PB.fmt(ind, ind.polaridade === "maior" ? mx : mn)], polar };
      }
      return { cor: (v) => (v == null ? semDado : q(v)), tipo: "seq", cores: seq, rotulos: [PB.fmt(ind, mn), PB.fmt(ind, mx)], polar: false };
    }
    if (modo === "quintis") {
      const div = PB.divergente();
      const cores = [div[0], div[1], div[3], div[5], div[6]]; // pior → melhor
      const sc = d3.scaleQuantile().domain(vs).range(ind.polaridade === "maior" ? cores : [...cores].reverse());
      const lim = sc.quantiles();
      return { cor: (v) => (v == null ? semDado : sc(v)), tipo: "quintis", cores, limites: lim, polar };
    }
    // desempenho em relação a uma referência (Brasil por padrão)
    const ref = referencia != null ? referencia : d3.median(vs);
    const desvios = vs.map((v) => Math.abs(v - ref));
    const lim = d3.quantile(desvios.sort(d3.ascending), 0.9) || 1;
    const div = PB.divergente();
    const s = d3.scaleQuantize().domain([-lim, lim]).range(div);
    const cor = (v) => {
      if (v == null) return semDado;
      let d = v - ref;
      if (ind.polaridade === "menor") d = -d; // positivo = melhor
      return s(Math.max(-lim, Math.min(lim, d)));
    };
    return { cor, tipo: "desempenho", cores: div, ref, lim, polar };
  };

  // --------------------------------------------------------- Estatística
  const E = (PB.est = {});
  E.media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  E.mediaPond = (a, w) => { let s = 0, sw = 0; a.forEach((x, i) => { s += x * w[i]; sw += w[i]; }); return sw ? s / sw : null; };
  E.dp = (a) => { const m = E.media(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : null; };
  E.mediana = (a) => d3.median(a);
  E.cv = (a) => { const m = E.media(a); return m ? (E.dp(a) / Math.abs(m)) * 100 : null; };
  E.ranks = (a) => {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const r = new Array(a.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const rk = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = rk;
      i = j + 1;
    }
    return r;
  };
  E.pearson = (x, y, w) => {
    const n = x.length;
    if (n < 3) return null;
    w = w || x.map(() => 1);
    const mx = E.mediaPond(x, w), my = E.mediaPond(y, w);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += w[i] * dx * dy; sxx += w[i] * dx * dx; syy += w[i] * dy * dy; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  };
  E.spearman = (x, y) => E.pearson(E.ranks(x), E.ranks(y));
  // Distribuição t: p-valor bilateral (aproximação pela beta incompleta regularizada)
  function betacf(a, b, x) {
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - (qab * x) / qap;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d; let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
      aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-12) break;
    }
    return h;
  }
  function lgamma(z) {
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1; let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function betai(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
  }
  E.pT = (t, gl) => (gl > 0 ? betai(gl / 2, 0.5, gl / (gl + t * t)) : null);
  E.pCorrelacao = (r, n) => { if (r == null || n < 4) return null; const t = (r * Math.sqrt(n - 2)) / Math.sqrt(Math.max(1e-12, 1 - r * r)); return E.pT(Math.abs(t), n - 2); };
  /** regressão linear (MQO), com pesos opcionais; X = matriz n×k SEM intercepto */
  E.mqo = (X, y, w) => {
    const n = y.length, k = X[0].length + 1;
    w = w || y.map(() => 1);
    const Xi = X.map((r) => [1, ...r]);
    const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
    const Xty = new Array(k).fill(0);
    for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) { Xty[a] += w[i] * Xi[i][a] * y[i]; for (let b = 0; b < k; b++) XtX[a][b] += w[i] * Xi[i][a] * Xi[i][b]; }
    const inv = inversa(XtX);
    if (!inv) return null;
    const beta = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
    const yhat = Xi.map((r) => r.reduce((s, v, j) => s + v * beta[j], 0));
    const res = y.map((v, i) => v - yhat[i]);
    const my = E.mediaPond(y, w);
    const sqr = res.reduce((s, e, i) => s + w[i] * e * e, 0);
    const sqt = y.reduce((s, v, i) => s + w[i] * (v - my) ** 2, 0);
    const gl = n - k;
    const s2 = gl > 0 ? sqr / gl : NaN;
    const ep = inv.map((row, i) => Math.sqrt(Math.max(0, row[i] * s2)));
    const t = beta.map((b, i) => b / ep[i]);
    const p = t.map((tt) => E.pT(Math.abs(tt), gl));
    const r2 = sqt ? 1 - sqr / sqt : null;
    const r2aj = r2 != null && gl > 0 ? 1 - ((1 - r2) * (n - 1)) / gl : null;
    // coeficientes padronizados
    const dpy = E.dp(y);
    const padr = beta.slice(1).map((b, j) => (b * E.dp(X.map((r) => r[j]))) / dpy);
    return { beta, ep, t, p, r2, r2aj, gl, n, yhat, res, padr };
  };
  function inversa(M) {
    const n = M.length, A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) < 1e-12) return null;
      [A[c], A[piv]] = [A[piv], A[c]];
      const d = A[c][c];
      for (let j = 0; j < 2 * n; j++) A[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j]; }
    }
    return A.map((r) => r.slice(n));
  }
  /** VIF de cada preditor */
  E.vif = (X) => X[0].map((_, j) => {
    const y = X.map((r) => r[j]);
    const outros = X.map((r) => r.filter((_, k) => k !== j));
    if (!outros[0].length) return 1;
    const m = E.mqo(outros, y);
    return m && m.r2 != null && m.r2 < 1 ? 1 / (1 - m.r2) : Infinity;
  });
  E.cagr = (v0, v1, anos) => (v0 > 0 && v1 > 0 && anos > 0 ? (Math.pow(v1 / v0, 1 / anos) - 1) * 100 : null);
  E.forca = (r) => {
    const a = Math.abs(r);
    return a >= 0.7 ? "forte" : a >= 0.4 ? "moderada" : a >= 0.2 ? "fraca" : "muito fraca ou nula";
  };

  // ------------------------------------------------------------- URL / estado
  PB.rota = () => {
    const h = location.hash.replace(/^#\/?/, "");
    const [pag, q] = h.split("?");
    return { pagina: pag || "inicio", params: Object.fromEntries(new URLSearchParams(q || "")) };
  };
  /** grava parâmetros da página atual na URL sem criar entrada no histórico */
  PB.setParams = (obj) => {
    const r = PB.rota();
    const p = { ...r.params, ...obj };
    Object.keys(p).forEach((k) => (p[k] == null || p[k] === "") && delete p[k]);
    const q = new URLSearchParams(p).toString();
    history.replaceState(null, "", "#/" + r.pagina + (q ? "?" + q : ""));
  };
  PB.ir = (pagina, params) => {
    const q = params ? new URLSearchParams(params).toString() : "";
    location.hash = "#/" + pagina + (q ? "?" + q : "");
  };

  // --------------------------------------------------------------- CSV
  PB.csv = (nome, cab, linhas) => {
    const seguro = (v) => {
      if (v == null) return "";
      let s = String(v);
      if (/^[=+\-@]/.test(s) && isNaN(+s)) s = "'" + s; // evita fórmula no Excel
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const num = (v) => (typeof v === "number" ? String(v).replace(".", ",") : seguro(v));
    const txt = [cab.map(seguro).join(";"), ...linhas.map((l) => l.map(num).join(";"))].join("\r\n");
    const blob = new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome.replace(/[^\w\-]+/g, "_") + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  PB.aviso = (txt) => {
    const el = document.getElementById("aviso");
    el.textContent = txt; el.classList.add("on");
    clearTimeout(PB._avisoT); PB._avisoT = setTimeout(() => el.classList.remove("on"), 2200);
  };
  PB.debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
})();

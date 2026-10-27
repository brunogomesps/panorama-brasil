(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el, EL = PB.EL;
  PB.paginas = PB.paginas || {};

  const VARS = {
    pibpc: { t: "PIB per capita (R$)", log: true, fmt: (v) => "R$ " + PB.num(v, 0), pol: "maior" },
    urb: { t: "Taxa de urbanização 2022 (%)", fmt: (v) => PB.num(v, 1) + "%", pol: "neutro" },
    adm: { t: "Peso da administração pública no PIB 2021 (%)", fmt: (v) => PB.num(v, 1) + "%", pol: "neutro" },
    agro: { t: "Peso da agropecuária no PIB 2021 (%)", fmt: (v) => PB.num(v, 1) + "%", pol: "neutro" },
    ind: { t: "Peso da indústria no PIB 2021 (%)", fmt: (v) => PB.num(v, 1) + "%", pol: "neutro" },
    pop: { t: "População 2022", log: true, fmt: (v) => PB.compacto(v), pol: "neutro" },
    comp: { t: "Comparecimento no 1º turno (%)", fmt: (v) => PB.num(v, 1) + "%", pol: "maior" },
  };

  function carrega(cb) {
    if (window.PB_MUN) return cb();
    const s = document.createElement("script");
    s.src = "data/municipios.js";
    s.onload = () => cb(); // o onload passa o evento como argumento: não confundir com erro
    s.onerror = () => cb(new Error("não foi possível carregar data/municipios.js"));
    document.head.append(s);
  }
  PB.paginas.municipios = {
    montar(alvo, p) {
      alvo.append(C.cabecalho("Municípios", "O voto nos 5.570 municípios", "Escolha a eleição, o turno e o candidato: o mapa e a dispersão mostram o percentual dele em cada município, cruzado com renda, urbanização e estrutura econômica. Cada ponto da dispersão é um município."));
      const carregando = C.vazio("Carregando os dados dos municípios…");
      alvo.append(carregando);
      carrega((erro) => {
        carregando.remove();
        if (erro) { alvo.append(C.vazio(erro.message)); return; }
        monta(alvo, p);
      });
    },
  };

  function monta(alvo, p) {
    const MUN = window.PB_MUN, META = window.PB_MUN_META || {};
    const st = {
      ano: EL.anos.includes(+p.ano) ? +p.ano : EL.anos[EL.anos.length - 1],
      turno: +p.turno === 1 ? 1 : 2,
      cand: p.cand || "",
      uf: PB.UFS.includes(p.uf) ? p.uf : "",
      x: VARS[p.x] ? p.x : "pibpc",
      q: p.q || "",
    };
    if (!EL.temTurno(st.ano, st.turno)) st.turno = 1;
    const chaveDe = () => st.ano + "_" + st.turno;
    // candidato padrão = 1º colocado nacional no turno (nenhum partido fixo)
    const candValido = () => { const lista = META[chaveDe()] || []; if (!lista.includes(st.cand)) st.cand = lista[0] || ""; };
    candValido();
    const filtros = el("div", { class: "filtros" });
    const corpo = el("div");
    alvo.append(filtros, corpo);
    const salva = () => PB.setParams(st);
    const desenhaFiltros = () => {
      const r = EL.resultado(st.ano, st.turno);
      filtros.replaceChildren(
        C.segmentado("Ano", EL.anos.map((a) => ({ v: a, t: String(a) })), st.ano, (v) => { st.ano = +v; if (!EL.temTurno(st.ano, st.turno)) st.turno = 1; candValido(); salva(); desenhaFiltros(); desenha(); }),
        C.segmentado("Turno", [{ v: 1, t: "1º" }, { v: 2, t: "2º" }], st.turno, (v) => { st.turno = +v; candValido(); salva(); desenhaFiltros(); desenha(); }),
        C.select("Candidato", (META[chaveDe()] || []).map((nr) => { const c = r.candidatos.find((x) => x.nr === nr); return { v: nr, t: `${EL.nome(c)} (${c.partido}) · ${PB.num(c.pct, 1)}% no país` }; }), st.cand, (v) => { st.cand = v; salva(); desenha(); }, "largo"),
        C.select("Estado", [{ v: "", t: "Brasil inteiro" }, ...PB.UFS.map((u) => ({ v: u, t: PB.nomeLocal(u) }))], st.uf, (v) => { st.uf = v; salva(); desenha(); }),
        C.select("Cruzar com", Object.entries(VARS).map(([k, v]) => ({ v: k, t: v.t })), st.x, (v) => { st.x = v; salva(); desenha(); }, "largo"),
      );
    };

    const desenha = () => {
      PB.G.limpa();
      corpo.replaceChildren();
      const chave = chaveDe();
      const r = EL.resultado(st.ano, st.turno);
      const cores = EL.cores(st.ano);
      const lista = Object.entries(MUN).filter(([, m]) => (!st.uf || m.uf === st.uf) && m.e && m.e[chave]);
      const idx = (META[chave] || []).indexOf(st.cand);
      const cand = r.candidatos.find((c) => c.nr === st.cand);
      const corCand = cores[st.cand] || PB.corPartido(cand.partido);
      const pctDe = (m) => (idx < 0 ? null : m.e[chave][2 + idx]);
      const nome = `${EL.nome(cand)} (${cand.partido})`;
      const valX = (m) => (st.x === "comp" ? (m.c || {})[st.ano] : m[st.x]);
      const nVenceu = {};
      lista.forEach(([, m]) => { const nr = m.e[chave][0]; nVenceu[nr] = (nVenceu[nr] || 0) + 1; });

      // Escala de cor: 2º turno = adversário ↔ candidato em torno de 50%; 1º turno = quintis na cor do candidato
      let corDe, legenda;
      if (st.turno === 2) {
        const op = r.candidatos.find((c) => c.nr !== st.cand);
        const corOp = cores[op.nr] || PB.corPartido(op.partido);
        corDe = (v) => { if (v == null) return null; const t = Math.max(-1, Math.min(1, (v - 50) / 30)); const b = PB.cor("--div-0"); return t >= 0 ? d3.interpolateRgb(b, corCand)(t) : d3.interpolateRgb(b, corOp)(-t); };
        legenda = el("div", { class: "legenda" }, el("div", { class: "rampa" },
          el("div", { class: "rampa-cores" }, ...[20, 30, 40, 50, 60, 70, 80].map((v) => el("span", { style: { background: corDe(v) } }))),
          el("div", { class: "rampa-rot" }, el("span", {}, `${EL.nome(op)} acima de 50%`), el("span", {}, "50%"), el("span", {}, `${EL.nome(cand)} acima de 50%`))));
      } else {
        const vals = lista.map(([, m]) => pctDe(m)).filter((v) => v != null);
        const rampa = [0.18, 0.36, 0.54, 0.72, 0.9].map((t) => d3.interpolateRgb(PB.cor("--superficie"), corCand)(t));
        const q = d3.scaleQuantile().domain(vals).range(rampa);
        const lim = q.quantiles();
        corDe = (v) => (v == null ? null : q(v));
        legenda = C.legendaCategorias(rampa.map((x, i) => ({ cor: x, t: i === 0 ? "até " + PB.num(lim[0], 0) + "%" : i === 4 ? "mais de " + PB.num(lim[3], 0) + "%" : PB.num(lim[i - 1], 0) + "–" + PB.num(lim[i], 0) + "%" })));
        legenda.append(el("span", { class: "item", style: { color: "var(--texto-3)" } }, "quintis: cada cor reúne 1/5 dos municípios"));
      }

      const g = el("div", { class: "grade g-mapa" });
      corpo.append(g);
      const resumo = Object.entries(nVenceu).sort((a, b) => b[1] - a[1]).map(([nr, n]) => { const c = r.candidatos.find((x) => x.nr === nr); return `${EL.nome(c)} liderou em ${PB.inteiro(n)}`; }).join(" · ");
      const cm = C.cartao({ titulo: `Votos de ${nome} por município · ${st.ano}, ${st.turno}º turno`, sub: `${st.uf ? PB.nomeLocal(st.uf) : "Brasil"}: ${PB.inteiro(lista.length)} municípios. ${resumo}.`, fonte: "TSE (votação por município) e IBGE (malha municipal 2024)" });
      cm.corpo.append(el("p", { class: "leitura", style: { marginTop: "-4px" } }, "Indicador político: não há leitura de melhor ou pior."));
      const mapa = el("div");
      cm.corpo.append(mapa);
      PB.Mapa.municipios(mapa, {
        uf: st.uf || null,
        cor: (cod) => { const m = MUN[cod]; return m && m.e && m.e[chave] ? corDe(pctDe(m)) : null; },
        dica: (cod) => {
          const m = MUN[cod];
          if (!m || !m.e || !m.e[chave]) return "sem dado";
          const [nr, tot] = m.e[chave];
          const lid = r.candidatos.find((c) => c.nr === nr);
          return `<div class="t">${PB.esc(m.n)} (${m.uf})</div>${PB.esc(EL.nome(cand))}: <b>${PB.num(pctDe(m), 1)}%</b> dos válidos · ${PB.inteiro(tot)} votos válidos<br>Liderou: ${PB.esc(EL.nome(lid))} (${PB.esc(lid.partido)})<br>` +
            `<span class="l">PIB per capita: ${m.pibpc ? "R$ " + PB.num(m.pibpc, 0) : "–"} · urbanização: ${m.urb != null ? PB.num(m.urb, 0) + "%" : "–"}</span>`;
        },
        onclick: (cod) => { st.q = MUN[cod].n; salva(); desenha(); },
      });
      cm.corpo.append(legenda);
      g.append(cm.cartao);

      // Dispersão
      const V = VARS[st.x];
      const pts = lista.map(([cod, m]) => ({ id: cod, x: valX(m), y: pctDe(m), cor: PB.corRegiao(PB.regiaoDe(m.uf)), r: lista.length < 400 ? Math.max(2.5, Math.sqrt((m.pop || 1000) / 20000) * 3) : null,
        dica: `<div class="t">${PB.esc(m.n)} (${m.uf})</div>${PB.esc(V.t)}: ${PB.esc(V.fmt(valX(m)))}<br>${PB.esc(EL.nome(cand))}: ${PB.num(pctDe(m), 1)}%` }))
        .filter((q) => q.x != null && q.y != null && (!V.log || q.x > 0));
      const xs = pts.map((q) => (V.log ? Math.log10(q.x) : q.x)), ys = pts.map((q) => q.y);
      const m = pts.length > 5 ? PB.est.mqo(xs.map((v) => [v]), ys) : null;
      const rP = PB.est.pearson(xs, ys), rS = PB.est.spearman(xs, ys);
      const cs = C.cartao({ titulo: `${V.t} × votos de ${nome}`, sub: `Cada ponto é um município (cor = região). ${V.log ? "Eixo horizontal em escala logarítmica." : ""}`, fonte: "TSE e IBGE (PIB dos Municípios, Censos)",
        info: `A reta é a regressão linear (mínimos quadrados) do % de ${EL.nome(cand)} sobre a variável escolhida` + (V.log ? " (em log10)" : "") + ". Correlação entre municípios não diz como cada pessoa vota (falácia ecológica)." });
      const gs = el("div");
      cs.corpo.append(gs);
      g.append(cs.cartao);
      PB.G.dispersao(gs, { pontos: pts, xRot: V.t, yRot: `% dos válidos de ${EL.nome(cand)}`, xLog: V.log, fx: V.fmt, fy: (v) => PB.num(v, 0) + "%", reta: m ? { a: m.beta[0], b: m.beta[1] } : null, altura: 420,
        destacar: st.q ? (Object.entries(MUN).find(([, x]) => x.n === st.q && (!st.uf || x.uf === st.uf)) || [])[0] : null, quadrantes: { x: d3.median(pts, (q) => q.x), y: st.turno === 2 ? 50 : d3.median(pts, (q) => q.y) } });
      if (m) {
        const efeito = V.log ? `Cada vez que ${PB.minus(V.t)} é multiplicado por 10, o voto de ${EL.nome(cand)} muda em média ${PB.num(m.beta[1], 1)} p.p.` : `Cada ponto a mais em ${PB.minus(V.t)} se associa a ${m.beta[1] >= 0 ? "+" : ""}${PB.num(m.beta[1], 2)} p.p. no voto de ${EL.nome(cand)}.`;
        cs.corpo.append(el("div", { class: "stats", style: { marginTop: "8px" } },
          el("div", { class: "stat" }, el("div", { class: "r" }, "Correlação (Pearson)"), el("div", { class: "v" }, PB.num(rP, 2)), el("div", { class: "d" }, PB.est.forca(rP))),
          el("div", { class: "stat" }, el("div", { class: "r" }, "Spearman (postos)"), el("div", { class: "v" }, PB.num(rS, 2))),
          el("div", { class: "stat" }, el("div", { class: "r" }, "R²"), el("div", { class: "v" }, PB.num(m.r2, 2)), el("div", { class: "d" }, PB.num(m.r2 * 100, 0) + "% da variação explicada")),
          el("div", { class: "stat" }, el("div", { class: "r" }, "Municípios"), el("div", { class: "v" }, PB.inteiro(pts.length)))));
        cs.corpo.append(C.nota(efeito + " Associação não é causa: renda, região, religião, idade e história política andam juntas."));
      }
      cs.corpo.append(C.legendaCategorias(PB.REGIOES.map((r2) => ({ t: PB.nomeLocal(r2), cor: PB.corRegiao(r2) }))));

      // Busca e tabela (todos os candidatos guardados)
      const cands = (META[chave] || []).map((nr) => r.candidatos.find((c) => c.nr === nr));
      const ct = C.cartao({ titulo: "Buscar município", sub: "Digite parte do nome. A tabela mostra até 200 resultados, dos mais populosos para os menos.", fonte: "TSE e IBGE",
        csv: () => PB.csv(`municipios_${chave}${st.uf ? "_" + st.uf : ""}`, ["Código IBGE", "Município", "UF", ...cands.map((c) => `${EL.nome(c)} (${c.partido}) %`), "Líder", "Votos válidos", "PIB per capita (R$)", "Urbanização (%)", "Adm. pública (% PIB)", "População 2022"],
          lista.map(([cod, x]) => [cod, x.n, x.uf, ...cands.map((_, i) => x.e[chave][2 + i]), (r.candidatos.find((c) => c.nr === x.e[chave][0]) || {}).nome, x.e[chave][1], x.pibpc, x.urb, x.adm, x.pop])) });
      ct.cartao.style.marginTop = "16px";
      const busca = el("input", { type: "search", value: st.q, placeholder: "Ex.: Campinas", "aria-label": "Buscar município" });
      const res = el("div");
      const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const filtra = () => {
        const q = norm(busca.value.trim());
        // ordena pela população antes de cortar em 200 (senão as maiores cidades podiam ficar de fora)
        const achados = lista.filter(([, x]) => !q || norm(x.n).includes(q)).sort((a, b) => (b[1].pop || 0) - (a[1].pop || 0)).slice(0, 200);
        res.replaceChildren(C.tabela([{ t: "Município", k: "n" }, { t: "UF", k: "uf" }, ...cands.map((c, i) => ({ t: `${EL.nome(c)} %`, k: "c" + i, n: true, fmt: (v) => PB.num(v, 1) })), { t: "Liderou", k: "lid" }, { t: "Votos válidos", k: "tot", n: true, fmt: PB.inteiro }, { t: "PIB per capita", k: "pibpc", n: true, fmt: (v) => (v ? "R$ " + PB.num(v, 0) : "–") }, { t: "Urbanização %", k: "urb", n: true, fmt: (v) => PB.num(v, 1) }, { t: "População", k: "pop", n: true, fmt: PB.inteiro }],
          achados.map(([, x]) => ({ n: x.n, uf: x.uf, ...Object.fromEntries(cands.map((_, i) => ["c" + i, x.e[chave][2 + i]])), lid: EL.nome(r.candidatos.find((c) => c.nr === x.e[chave][0]) || { nome: "" }), tot: x.e[chave][1], pibpc: x.pibpc, urb: x.urb, pop: x.pop })), { ordem: cands.length + 6 }));
      };
      busca.addEventListener("input", PB.debounce(() => { st.q = busca.value; salva(); filtra(); }, 250));
      ct.corpo.append(el("label", { class: "campo", style: { marginBottom: "8px", maxWidth: "360px" } }, el("span", {}, "Município"), busca), res);
      filtra();
      corpo.append(ct.cartao);
    };
    desenhaFiltros();
    desenha();
  }
})();

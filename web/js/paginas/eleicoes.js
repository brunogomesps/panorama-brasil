(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el, EL = PB.EL;
  PB.paginas = PB.paginas || {};
  PB.paginas.eleicoes = {
    montar(alvo, p) {
      const st = {
        vista: p.vista || "resultado",
        ano: EL.anos.includes(+p.ano) ? +p.ano : EL.anos[EL.anos.length - 1],
        turno: +p.turno === 1 ? 1 : 2,
        uf: PB.UFS.includes(p.uf) ? p.uf : "",
        mapa: p.mapa || "lider",
        forma: p.forma || "mapa",
        a: EL.anos.includes(+p.a) ? +p.a : 2022,
        b: EL.anos.includes(+p.b) ? +p.b : 2026,
        voto: EL.MEDIDAS[p.voto] ? p.voto : "vencedor",
      };
      if (!EL.temTurno(st.ano, st.turno)) st.turno = 1;
      const filtros = el("div", { class: "filtros" });
      const corpo = el("div");
      alvo.append(C.cabecalho("Eleições", "Eleições presidenciais de 2002 a 2026", "Resultados oficiais do TSE por estado e turno, a evolução do voto e a participação do eleitorado. Indicadores eleitorais são políticos: o painel não os classifica como bons ou ruins."), filtros, corpo);
      const salva = () => PB.setParams(st);

      const desenhaFiltros = () => {
        filtros.replaceChildren(C.segmentado("Vista", [{ v: "resultado", t: "Resultado" }, { v: "historico", t: "2002 a 2026" }, { v: "participacao", t: "Participação" }], st.vista, (v) => { st.vista = v; salva(); desenhaFiltros(); desenha(); }));
        if (st.vista !== "historico") {
          filtros.append(
            C.segmentado("Ano", EL.anos.map((a) => ({ v: a, t: String(a) })), st.ano, (v) => { st.ano = +v; if (!EL.temTurno(st.ano, st.turno)) st.turno = 1; st.mapa = "lider"; salva(); desenhaFiltros(); desenha(); }),
            C.segmentado("Turno", [{ v: 1, t: "1º" }, { v: 2, t: "2º" }], st.turno, (v) => { st.turno = +v; st.mapa = "lider"; salva(); desenhaFiltros(); desenha(); }),
            C.segmentado("Forma", [{ v: "mapa", t: "Mapa" }, { v: "grade", t: "Grade" }], st.forma, (v) => { st.forma = v; salva(); desenha(); }),
          );
          if (st.vista === "resultado") {
            const r = EL.resultado(st.ano, st.turno);
            filtros.append(C.select("Mapa mostra", [{ v: "lider", t: "Quem liderou" }, ...r.candidatos.slice(0, 5).map((c) => ({ v: c.nr, t: "% de " + EL.nome(c) }))], st.mapa, (v) => { st.mapa = v; salva(); desenha(); }));
          }
        } else {
          filtros.append(
            EL.selectMedida(st.voto, (v) => { st.voto = v; salva(); desenha(); }),
            C.select("Virada de", EL.anos.map((a) => ({ v: a, t: a })), st.a, (v) => { st.a = +v; salva(); desenha(); }),
            C.select("para", EL.anos.map((a) => ({ v: a, t: a })), st.b, (v) => { st.b = +v; salva(); desenha(); }),
          );
        }
      };

      const desenha = () => {
        PB.G.limpa();
        corpo.replaceChildren();
        if (st.vista === "historico") return historico(corpo, st);
        if (st.vista === "participacao") return participacao(corpo, st, salva);
        resultado(corpo, st, salva, desenha);
      };
      desenhaFiltros();
      desenha();
    },
  };

  function resultado(corpo, st, salva, redesenha) {
    const r = EL.resultado(st.ano, st.turno);
    if (!r) { corpo.append(C.vazio("Não houve este turno.")); return; }
    const cores = EL.cores(st.ano);
    const venc = r.candidatos[0];
    const lideres = PB.UFS.map((u) => [u, EL.lider(st.ano, st.turno, u)]).filter((x) => x[1]);
    const doVenc = lideres.filter((x) => x[1].nr === venc.nr).sort((a, b) => b[1].margem - a[1].margem);
    const nLid = doVenc.length;
    const [ufMaior, maior] = doVenc[0] || [null, null];
    const [ufApertada, apertada] = [...lideres].sort((a, b) => a[1].margem - b[1].margem)[0] || [null, null];

    // Manchete automática
    let manchete;
    if (st.turno === 2) manchete = `${EL.nome(venc)} (${venc.partido}) foi eleito com ${PB.num(venc.pct, 2)}% dos votos válidos e liderou em ${nLid} das 27 UFs.`;
    else if (venc.pct > 50) manchete = `${EL.nome(venc)} (${venc.partido}) venceu no 1º turno com ${PB.num(venc.pct, 2)}% dos válidos.`;
    else manchete = `${EL.nome(venc)} (${venc.partido}) e ${EL.nome(r.candidatos[1])} (${r.candidatos[1].partido}) foram ao 2º turno; ${EL.nome(venc)} liderou em ${nLid} das 27 UFs.`;
    const extra = (ufMaior ? ` Maior vantagem em ${PB.nomeLocal(ufMaior)} (+${PB.num(maior.margem, 1)} p.p.).` : "") +
      (ufApertada ? ` Disputa mais apertada em ${PB.nomeLocal(ufApertada)} (${PB.num(apertada.margem, 1)} p.p.).` : "");
    const ch = C.cartao({ titulo: manchete, sub: extra.trim(), fonte: st.ano === 2026 && st.turno === 2 ? "TSE, divulgação oficial de resultados (totalização final de 25/10/2026)" : "TSE, dados abertos (votação por município e zona)" });
    const placar = el("div", { class: "placar" });
    r.candidatos.slice(0, st.turno === 2 ? 2 : 4).forEach((c, i) => {
      const dif = i > 0 ? r.candidatos[i - 1].pct - c.pct : null;
      placar.append(el("div", { class: "cand", style: { "--cor": cores[c.nr] } },
        el("div", { class: "pos" }, i + 1 + "º lugar" + (st.turno === 2 && i === 0 ? " · eleito" : st.turno === 1 && i < 2 && venc.pct <= 50 ? " · foi ao 2º turno" : "")),
        el("div", { class: "nome" }, EL.nome(c)), el("div", { class: "partido" }, c.partido + " · " + c.nr + " · " + c.espectro),
        el("div", { class: "pct" }, PB.num(c.pct, 2) + "%"),
        el("div", { class: "votos" }, PB.inteiro(c.votos) + " votos" + (dif != null ? ` · ${PB.num(dif, 2)} p.p. atrás do ${i}º` : "")),
        el("div", { class: "mini" }, el("span", { style: { width: (c.pct / venc.pct) * 100 + "%" } }))));
    });
    ch.corpo.append(placar);
    const comp = EL.comparecimento(st.ano, st.turno, "BR");
    if (comp) ch.corpo.append(el("p", { class: "leitura", style: { marginTop: "10px" } }, `Eleitorado: ${PB.inteiro(comp.aptos)} · comparecimento ${PB.num((comp.comparecimento / comp.aptos) * 100, 1)}% · abstenção ${PB.num((comp.abstencao / comp.aptos) * 100, 1)}% · brancos ${PB.num((comp.brancos / comp.comparecimento) * 100, 1)}% · nulos ${PB.num((comp.nulos / comp.comparecimento) * 100, 1)}% do comparecimento.`));
    corpo.append(ch.cartao);

    const g = el("div", { class: "grade g-mapa", style: { marginTop: "16px" } });
    corpo.append(g);
    // Mapa
    let cor, dica, legenda, titulo;
    if (st.mapa === "lider") {
      titulo = "Quem liderou em cada estado";
      cor = (u) => EL.corLider(st.ano, st.turno, u);
      dica = (u) => EL.dicaLider(st.ano, st.turno, u);
      legenda = EL.legendaLider(st.ano, st.turno, PB.UFS);
    } else {
      const c = r.candidatos.find((x) => x.nr === st.mapa) || venc;
      titulo = `Votos de ${EL.nome(c)} por estado (% dos válidos)`;
      const vals = PB.UFS.map((u) => EL.pct(st.ano, st.turno, u, c.nr));
      // quintis na cor do candidato (como a Cubo Três: faixas iguais deixariam quase tudo claro)
      const rampa = [0.18, 0.36, 0.54, 0.72, 0.9].map((t) => d3.interpolateRgb(PB.cor("--superficie"), cores[c.nr])(t));
      const q = d3.scaleQuantile().domain(vals.filter((v) => v != null)).range(rampa);
      cor = (u) => { const v = EL.pct(st.ano, st.turno, u, c.nr); return v == null ? null : q(v); };
      dica = (u) => `<div class="t">${PB.esc(PB.nomeLocal(u))}</div>${PB.esc(EL.nome(c))}: <b>${PB.num(EL.pct(st.ano, st.turno, u, c.nr), 1)}%</b> dos válidos<br><span class="l">Brasil: ${PB.num(c.pct, 1)}%</span>`;
      const lim = q.quantiles();
      legenda = C.legendaCategorias(rampa.map((x, i) => ({ cor: x, t: i === 0 ? "até " + PB.num(lim[0], 0) + "%" : i === 4 ? "mais de " + PB.num(lim[3], 0) + "%" : PB.num(lim[i - 1], 0) + "–" + PB.num(lim[i], 0) + "%" })));
    }
    const cm = C.cartao({ titulo, sub: "Clique num estado para ver o resultado dele.", fonte: "TSE" });
    const mapa = el("div");
    cm.corpo.append(mapa);
    PB.Mapa.uf(mapa, { forma: st.forma, cor, dica, selecionado: st.uf, onclick: (u) => { st.uf = st.uf === u ? "" : u; salva(); redesenha(); },
      valorTexto: st.forma === "grade" ? (u) => { const l = EL.lider(st.ano, st.turno, u); return st.mapa === "lider" ? (l ? PB.num(l.pct, 0) + "%" : "") : PB.num(EL.pct(st.ano, st.turno, u, st.mapa), 0) + "%"; } : null });
    cm.corpo.append(legenda);
    g.append(cm.cartao);

    // Painel lateral: estado selecionado ou de onde vieram os votos
    const lado = el("div", { class: "grade", style: { alignContent: "start" } });
    g.append(lado);
    if (st.uf) {
      const vs = Object.entries(r.votos[st.uf]).sort((a, b) => b[1] - a[1]);
      const tot = vs.reduce((s, x) => s + x[1], 0);
      const cu = C.cartao({ titulo: `${PB.nomeLocal(st.uf)} · ${st.ano}, ${st.turno}º turno`, sub: `${PB.inteiro(tot)} votos válidos.`, fonte: "TSE" });
      const gb = el("div");
      cu.corpo.append(gb);
      lado.append(cu.cartao);
      const top = vs.slice(0, 6);
      PB.G.barras(gb, { categorias: top.map(([nr]) => EL.nome(r.candidatos.find((c) => c.nr === nr))), horizontal: true, rotulos: true, altura: 60 + top.length * 34,
        series: [{ name: "% dos válidos", data: top.map(([, v]) => +((v / tot) * 100).toFixed(2)) }], fmt: (v) => PB.num(v, 1) + "%", cores: top.map(([nr]) => cores[nr] || PB.cor("--p-outros")) });
      cu.corpo.append(el("p", { class: "leitura" }, el("a", { href: `#/estados?uf=${st.uf}` }, "Ficha socioeconômica do estado →"), " · ", el("a", { href: `#/municipios?ano=${st.ano}&turno=${st.turno}&uf=${st.uf}` }, "Ver por município →")));
    }
    const top = r.candidatos.slice(0, st.turno === 2 ? 2 : 3);
    const cr = C.cartao({ titulo: "De onde vieram os votos", sub: "Votos de cada candidato por região (milhões). A soma inclui o exterior no total nacional.", fonte: "TSE" });
    const gr = el("div");
    cr.corpo.append(gr);
    lado.append(cr.cartao);
    PB.G.barras(gr, { categorias: top.map(EL.nome), horizontal: true, empilhada: true, rotulos: true, altura: 90 + top.length * 46,
      series: PB.REGIOES.map((reg) => ({ name: PB.nomeLocal(reg), color: PB.corRegiao(reg), data: top.map((c) => +(((r.votos[reg] || {})[c.nr] || 0) / 1e6).toFixed(2)) })), fmt: (v) => PB.num(v, 1) + " mi" });
    if (st.turno === 2) {
      const [c1, c2] = top;
      const saldo = PB.REGIOES.map((reg) => [reg, ((r.votos[reg] || {})[c1.nr] || 0) - ((r.votos[reg] || {})[c2.nr] || 0)]);
      cr.corpo.append(el("p", { class: "leitura" }, `Saldo de ${EL.nome(c1)} sobre ${EL.nome(c2)}: ` + saldo.map(([reg, s]) => `${reg} ${s >= 0 ? "+" : "−"}${PB.compacto(Math.abs(s))}`).join(" · ")));
    }

    // Estados decisivos (saldo de votos)
    const g2 = el("div", { class: "grade g2", style: { marginTop: "16px" } });
    corpo.append(g2);
    const [c1, c2] = r.candidatos;
    const saldos = PB.UFS.map((u) => [u, ((r.votos[u] || {})[c1.nr] || 0) - ((r.votos[u] || {})[c2.nr] || 0)]).sort((a, b) => b[1] - a[1]);
    const cs = C.cartao({ titulo: `Onde ${EL.nome(c1)} abriu (e perdeu) vantagem sobre ${EL.nome(c2)}`, sub: "Saldo de votos por estado: positivo = vantagem do 1º colocado nacional. Mostra o peso de cada estado no resultado, que depende do eleitorado e da margem.", fonte: "TSE" });
    const gs = el("div");
    cs.corpo.append(gs);
    g2.append(cs.cartao);
    PB.G.barras(gs, { categorias: saldos.map((x) => x[0]), altura: 330, series: [{ name: "Saldo de votos (mil)", data: saldos.map((x) => Math.round(x[1] / 1000)) }], fmt: (v) => PB.num(v, 0) + " mil",
      cores: saldos.map((x) => (x[1] >= 0 ? cores[c1.nr] : cores[c2.nr])) });
    const tot = saldos.reduce((s, x) => s + x[1], 0);
    const pos = saldos.filter((x) => x[1] > 0).reduce((s, x) => s + x[1], 0);
    cs.corpo.append(C.nota(`Saldo final: ${PB.compacto(tot)} votos (sem o exterior). ${EL.nome(c1)} somou ${PB.compacto(pos)} de saldo nos estados onde venceu e perdeu ${PB.compacto(pos - tot)} nos demais.`));

    // Tabela por UF
    const ct = C.cartao({ titulo: "Resultado por estado", sub: "Ordene pelas colunas.", fonte: "TSE",
      csv: () => PB.csv(`presidente_${st.ano}_t${st.turno}`, ["UF", ...r.candidatos.map((c) => EL.nome(c) + " (%)"), "Votos válidos", "Comparecimento (%)"],
        PB.UFS.map((u) => { const tt = Object.values(r.votos[u]).reduce((s, x) => s + x, 0); const cp = EL.comparecimento(st.ano, st.turno, u); return [u, ...r.candidatos.map((c) => +(((r.votos[u][c.nr] || 0) / tt) * 100).toFixed(2)), tt, cp ? +((cp.comparecimento / cp.aptos) * 100).toFixed(2) : null]; })) });
    const linhas = PB.UFS.map((u) => { const l = EL.lider(st.ano, st.turno, u); const cp = EL.comparecimento(st.ano, st.turno, u); return { uf: u, reg: PB.regiaoDe(u), lider: EL.nome(l.cand) + " (" + l.cand.partido + ")", pct: l.pct, seg: l.segundo ? EL.nome(l.segundo) : "–", pct2: l.pct2, margem: l.margem, comp: cp ? (cp.comparecimento / cp.aptos) * 100 : null, _classe: u === st.uf ? "destaque" : "" }; });
    ct.corpo.append(C.tabela([{ t: "UF", k: "uf" }, { t: "Região", k: "reg" }, { t: "Liderou", k: "lider" }, { t: "%", k: "pct", n: true, fmt: (v) => PB.num(v, 1) }, { t: "2º", k: "seg" }, { t: "%", k: "pct2", n: true, fmt: (v) => PB.num(v, 1) }, { t: "Margem (p.p.)", k: "margem", n: true, fmt: (v) => PB.num(v, 1) }, { t: "Comparec. (%)", k: "comp", n: true, fmt: (v) => PB.num(v, 1) }], linhas, { ordem: 6 }));
    g2.append(ct.cartao);
  }

  function historico(corpo, st) {
    const M = EL.medida(st.voto), ind = PB.ind[M.ind];
    const val = (loc, a) => PB.valor(M.ind, loc, a);
    const anosM = EL.anos.filter((a) => EL.candMedida(st.voto, a));
    // Mapa de calor UF × ano: em cada ano, cor do candidato medido (acima de 50%) ou do adversário (abaixo)
    const ch = C.cartao({ titulo: `${M.t}: votos no 2º turno, por estado (% dos válidos)`, sub: `Em cada ano, a cor do candidato medido quando ele passa de 50% e a do adversário quando fica abaixo; cinza = equilíbrio. ${M.desc[0].toUpperCase() + M.desc.slice(1)}.`, ind, fonte: "TSE",
      info: "Candidato medido × adversário: " + anosM.map((a) => { const cm = EL.candMedida(st.voto, a); return `${a}: ${EL.nome(cm.cand)} (${cm.cand.partido}) × ${EL.nome(cm.op)} (${cm.op.partido})`; }).join("; ") + "." });
    const tab = el("table", { class: "tab", style: { fontSize: "12px" } });
    const thead = el("thead", {}, el("tr", {}, el("th", {}, "UF"), ...anosM.map((a) => { const cm = EL.candMedida(st.voto, a); return el("th", { class: "n", "data-dica": `${EL.nome(cm.cand)} (${cm.cand.partido}) × ${EL.nome(cm.op)} (${cm.op.partido})` }, a + " "); }),
      el("th", { class: "n" }, `Variação ${anosM[0]}→${anosM[anosM.length - 1]}`)));
    const tbody = el("tbody");
    const linhaDe = (loc, negrito) => {
      const tr = el("tr", { class: negrito ? "destaque" : "" }, el("td", {}, loc === "BR" ? "Brasil" : loc));
      anosM.forEach((a) => {
        const v = val(loc, a), cm = EL.candMedida(st.voto, a);
        const bg = EL.corMedida(st.voto, a, v);
        tr.append(el("td", { class: "n", style: { background: bg, color: PB.textoSobre(bg), fontWeight: 600 }, "data-dica": `${PB.nomeLocal(loc)}, ${a}: ${EL.nome(cm.cand)} ${PB.num(v, 1)}% × ${EL.nome(cm.op)} ${PB.num(100 - v, 1)}%` }, PB.num(v, 1)));
      });
      const d = val(loc, anosM[anosM.length - 1]) - val(loc, anosM[0]);
      tr.append(el("td", { class: "n" }, (d >= 0 ? "+" : "−") + PB.num(Math.abs(d), 1) + " p.p."));
      return tr;
    };
    tbody.append(linhaDe("BR", true));
    PB.REGIOES.forEach((r) => { tbody.append(linhaDe(r, true)); PB.ufsDaRegiao(r).forEach((u) => tbody.append(linhaDe(u))); });
    tab.append(thead, tbody);
    ch.corpo.append(el("div", { class: "tabela-caixa", style: { maxHeight: "640px" } }, tab));
    corpo.append(ch.cartao);

    const g = el("div", { class: "grade g2", style: { marginTop: "16px" } });
    corpo.append(g);
    // Virada: escala neutra (violeta = subiu, âmbar = caiu), sem cor de partido
    const sw = (u) => { const a = val(u, st.a), b = val(u, st.b); return a == null || b == null ? null : b - a; };
    const vals = PB.UFS.map(sw).filter((v) => v != null);
    const lim = d3.max(vals.map(Math.abs)) || 1;
    const corSw = (v) => (v == null ? null : d3.interpolateRgb(PB.cor("--div-0"), v >= 0 ? PB.cor("--seq-5") : PB.cor("--p-ambar"))(Math.min(1, Math.abs(v) / lim)));
    const brSw = sw("BR");
    const ca = EL.candMedida(st.voto, st.a), cb = EL.candMedida(st.voto, st.b);
    const cs = C.cartao({ titulo: `Virada entre ${st.a} e ${st.b}`, sub: brSw == null ? "Sem dado para um dos anos nesta medida." : `Variação de "${M.t.toLowerCase()}" no 2º turno (p.p.): ${ca ? EL.nome(ca.cand) : "–"} em ${st.a} → ${cb ? EL.nome(cb.cand) : "–"} em ${st.b}. Violeta = subiu; âmbar = caiu. Brasil: ${brSw >= 0 ? "+" : "−"}${PB.num(Math.abs(brSw), 1)} p.p.`, fonte: "TSE" });
    const ms = el("div", { style: { maxWidth: "460px", margin: "0 auto", width: "100%" } });
    cs.corpo.append(ms);
    if (brSw != null) {
      PB.Mapa.uf(ms, { forma: "grade", cor: (u) => corSw(sw(u)), valorTexto: (u) => { const v = sw(u); return v == null ? "" : (v >= 0 ? "+" : "−") + PB.num(Math.abs(v), 1); },
        dica: (u) => `<div class="t">${PB.esc(PB.nomeLocal(u))}</div>${st.a}: ${PB.num(val(u, st.a), 1)}% → ${st.b}: ${PB.num(val(u, st.b), 1)}%<br><b>${sw(u) >= 0 ? "+" : "−"}${PB.num(Math.abs(sw(u)), 1)} p.p.</b>`,
        onclick: (u) => PB.ir("estados", { uf: u }) });
      const ordSw = PB.UFS.map((u) => [u, sw(u)]).filter((x) => x[1] != null).sort((a, b) => b[1] - a[1]);
      cs.corpo.append(el("p", { class: "leitura" }, `Maiores altas: ${ordSw.slice(0, 3).map(([u, v]) => `${u} (+${PB.num(v, 1)})`).join(", ")}. Maiores quedas: ${ordSw.slice(-3).reverse().map(([u, v]) => `${u} (${PB.num(v, 1)})`).join(", ")}.`));
    } else ms.append(C.vazio("Escolha anos em que a medida existe (em 2018 o governo não foi ao 2º turno)."));
    g.append(cs.cartao);

    const cl = EL.cartaoVotoRegioes(st.voto, (v) => { st.voto = v; PB.setParams(st); PB.rerender(); }, 340);
    g.append(cl.cartao);
    cl.desenhar();
    // distância entre a região com mais e a com menos votos na medida, no primeiro e no último ano
    const amp = (a) => { const v = PB.REGIOES.map((r) => val(r, a)).filter((x) => x != null); return v.length ? Math.max(...v) - Math.min(...v) : null; };
    const a0 = anosM[0], a1 = anosM[anosM.length - 1];
    if (amp(a0) != null && amp(a1) != null) cl.corpo.append(C.nota(`A distância entre a região com mais e a com menos votos nesta medida foi de ${PB.num(amp(a0), 1)} p.p. em ${a0} e de ${PB.num(amp(a1), 1)} p.p. em ${a1}: o voto ficou ${amp(a1) > amp(a0) ? "mais" : "menos"} regionalizado.`));

    // Tabela nacional
    const linhas = EL.anos.flatMap((a) => [1, 2].filter((t) => EL.temTurno(a, t)).map((t) => {
      const r = EL.resultado(a, t), c = EL.comparecimento(a, t, "BR");
      return { ano: a, t: t + "º", v: EL.nome(r.candidatos[0]) + " (" + r.candidatos[0].partido + ")", p: r.candidatos[0].pct, s: EL.nome(r.candidatos[1]) + " (" + r.candidatos[1].partido + ")", p2: r.candidatos[1].pct, n: r.candidatos.length, nec: t === 1 ? PB.valor("nec_t1", "BR", a) : null, comp: c ? (c.comparecimento / c.aptos) * 100 : null, bn: c ? ((c.brancos + c.nulos) / c.comparecimento) * 100 : null };
    }));
    const ct = C.cartao({ titulo: "Todas as eleições presidenciais", sub: "NEC = número efetivo de candidatos (fragmentação do voto no 1º turno).", fonte: "TSE" });
    ct.cartao.style.marginTop = "16px";
    ct.corpo.append(C.tabela([{ t: "Ano", k: "ano" }, { t: "Turno", k: "t" }, { t: "1º colocado", k: "v" }, { t: "%", k: "p", n: true, fmt: (v) => PB.num(v, 2) }, { t: "2º colocado", k: "s" }, { t: "%", k: "p2", n: true, fmt: (v) => PB.num(v, 2) }, { t: "Candidatos", k: "n", n: true }, { t: "NEC", k: "nec", n: true, fmt: (v) => PB.num(v, 2) }, { t: "Comparec. %", k: "comp", n: true, fmt: (v) => PB.num(v, 1) }, { t: "Brancos+nulos %", k: "bn", n: true, fmt: (v) => PB.num(v, 1) }], linhas, { ordem: 0, desc: false }));
    corpo.append(ct.cartao);
  }

  function participacao(corpo, st, salva) {
    const g = el("div", { class: "grade g-mapa" });
    corpo.append(g);
    const taxa = (u, campo, den) => { const c = EL.comparecimento(st.ano, st.turno, u); return c && c[den] ? (c[campo] / c[den]) * 100 : null; };
    const ind = { ...PB.ind.comparecimento, nome: `Comparecimento (${st.turno}º turno)` };
    const pares = PB.UFS.map((u) => [u, taxa(u, "comparecimento", "aptos")]);
    const br = taxa("BR", "comparecimento", "aptos");
    const esc = PB.escala(ind, pares.map((x) => x[1]), "desempenho", br);
    const cm = C.cartao({ titulo: `Comparecimento em ${st.ano}, ${st.turno}º turno`, sub: `% do eleitorado apto que votou. Brasil: ${PB.num(br, 1)}%.`, ind, fonte: "TSE, detalhe da votação" });
    const mapa = el("div");
    cm.corpo.append(mapa);
    PB.Mapa.uf(mapa, { forma: st.forma, cor: (u) => esc.cor(taxa(u, "comparecimento", "aptos")),
      dica: (u) => `<div class="t">${PB.esc(PB.nomeLocal(u))}</div>Comparecimento: <b>${PB.num(taxa(u, "comparecimento", "aptos"), 1)}%</b><br>Abstenção: ${PB.num(taxa(u, "abstencao", "aptos"), 1)}%<br>Brancos: ${PB.num(taxa(u, "brancos", "comparecimento"), 1)}% · nulos: ${PB.num(taxa(u, "nulos", "comparecimento"), 1)}%<br><span class="l">Maior comparecimento é melhor (mais participação).</span>`,
      valorTexto: st.forma === "grade" ? (u) => PB.num(taxa(u, "comparecimento", "aptos"), 1) : null });
    cm.corpo.append(C.legendaEscala(ind, esc));
    cm.corpo.append(C.nota("Abstenção inclui eleitores que mudaram de cidade ou morreram e continuam no cadastro: parte dela é desatualização cadastral, não escolha."));
    g.append(cm.cartao);
    const cr = C.cartao({ titulo: "Ranking do comparecimento", sub: PB.pol.criterioRanking(ind), fonte: "TSE" });
    cr.corpo.append(C.ranking(ind, pares, { corDe: (v) => esc.cor(v), brasil: br, onclick: (u) => PB.ir("estados", { uf: u }) }));
    g.append(cr.cartao);

    const cl = C.cartao({ titulo: "Participação no Brasil, 2002 a 2026", sub: "Comparecimento (% do eleitorado) e brancos + nulos (% do comparecimento), 1º e 2º turnos.", fonte: "TSE" });
    cl.cartao.style.marginTop = "16px";
    const gl = el("div", { class: "grade g2" });
    cl.corpo.append(gl);
    corpo.append(cl.cartao);
    const serie = (t, f) => EL.anos.filter((a) => EL.temTurno(a, t)).map((a) => { const c = EL.comparecimento(a, t, "BR"); return [a, f(c)]; });
    const g1 = el("div"), g2 = el("div");
    gl.append(g1, g2);
    PB.G.linha(g1, { series: [1, 2].map((t) => ({ name: t + "º turno", data: serie(t, (c) => (c.comparecimento / c.aptos) * 100), color: t === 1 ? PB.cor("--marca") : PB.cor("--acento-texto"), dash: t === 2 ? 5 : 0 })), altura: 260, xMin: 2002, xMax: 2026, ind: { formato: "num", casas: 1, unidade: "%" } });
    PB.G.linha(g2, { series: [1, 2].map((t) => ({ name: t + "º turno", data: serie(t, (c) => ((c.brancos + c.nulos) / c.comparecimento) * 100), color: t === 1 ? PB.cor("--marca") : PB.cor("--acento-texto"), dash: t === 2 ? 5 : 0 })), altura: 260, xMin: 2002, xMax: 2026, ind: { formato: "num", casas: 1, unidade: "%" } });
  }
})();

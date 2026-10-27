/* Balanço dos mandatos: o que os dados oficiais mostram × o que o público disse nas pesquisas de opinião. */
(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el, EL = PB.EL;
  PB.paginas = PB.paginas || {};

  // Anos usados nos dados anuais: 2016 fica com Temer (Dilma foi afastada em 12/05/2016)
  const MANDATOS = [
    { id: "lula1", nome: "Lula 1", presidente: "Lula", partido: "PT", ini: 2003, fim: 2006, base: 2002, inicio: "2003-01-01", termino: "2006-12-31", eleicao: 2002 },
    { id: "lula2", nome: "Lula 2", presidente: "Lula", partido: "PT", ini: 2007, fim: 2010, base: 2006, inicio: "2007-01-01", termino: "2010-12-31", eleicao: 2006 },
    { id: "dilma1", nome: "Dilma 1", presidente: "Dilma", partido: "PT", ini: 2011, fim: 2014, base: 2010, inicio: "2011-01-01", termino: "2014-12-31", eleicao: 2010 },
    { id: "dilma2", nome: "Dilma 2", presidente: "Dilma", partido: "PT", ini: 2015, fim: 2015, base: 2014, inicio: "2015-01-01", termino: "2016-05-12", eleicao: 2014, nota: "Afastada em 12/05/2016 (impeachment concluído em 31/08/2016). Nos dados anuais, 2016 entra no período de Temer." },
    { id: "temer", nome: "Temer", presidente: "Temer", partido: "MDB", ini: 2016, fim: 2018, base: 2015, inicio: "2016-05-12", termino: "2018-12-31", eleicao: null, nota: "Eleito vice-presidente em 2014; assumiu como interino em 12/05/2016 e como presidente em 31/08/2016. Não foi eleito presidente." },
    { id: "bolsonaro", nome: "Bolsonaro", presidente: "Bolsonaro", partido: "PL", ini: 2019, fim: 2022, base: 2018, inicio: "2019-01-01", termino: "2022-12-31", eleicao: 2018 },
    { id: "lula3", nome: "Lula 3", presidente: "Lula", partido: "PT", ini: 2023, fim: 2026, base: 2022, inicio: "2023-01-01", termino: "2026-12-31", eleicao: 2022, nota: "Mandato em curso (até 31/12/2026): os dados anuais vão até o último ano publicado." },
  ];
  const M = Object.fromEntries(MANDATOS.map((m) => [m.id, m]));
  // Eleições em que o governo disputou o 2º turno: mandato que terminava e se o candidato do governo era do PT
  const ELEICOES_GOVERNO = [
    { ano: 2006, mandato: "lula1", pt: true, cand: "Lula" }, { ano: 2010, mandato: "lula2", pt: true, cand: "Dilma" }, { ano: 2014, mandato: "dilma1", pt: true, cand: "Dilma" },
    { ano: 2022, mandato: "bolsonaro", pt: false, cand: "Bolsonaro" }, { ano: 2026, mandato: "lula3", pt: true, cand: "Lula" },
  ];
  // Indicadores nacionais comparados no início e no fim do mandato
  const VARIACAO = ["desocupacao", "rendimento", "informalidade", "pobreza", "extrema_pobreza", "gini", "homicidios", "mortalidade_infantil", "analfabetismo", "macro_divida_bruta", "sm_real"];
  const MEDIA = ["macro_pib_real", "macro_ipca"];
  const CORREL = [["macro_ipca", "Inflação (IPCA)"], ["desocupacao", "Desocupação"], ["macro_pib_real", "Crescimento do PIB"], ["rendimento", "Rendimento real do trabalho"], ["sm_real", "Salário mínimo real"], ["homicidios", "Taxa de homicídios"]];

  const corMandato = (m) => PB.corPartido(m.partido);
  const ms = (s) => new Date(s + "T12:00:00").getTime();

  /** salário mínimo real (R$ de dezembro do último ano com IPCA completo) como indicador sintético */
  function indicadorSMReal() {
    const sm = PB.serie("macro_salario_minimo", "BR");
    const ipca = Object.fromEntries(PB.serie("macro_ipca", "BR"));
    const ref = Math.max(...Object.keys(ipca).map(Number));
    const serie = sm.filter(([a]) => a <= ref).map(([a, v]) => { let f = 1; for (let y = a + 1; y <= ref; y++) f *= 1 + (ipca[y] || 0) / 100; return [a, v * f]; });
    return { ind: { id: "sm_real", nome: `Salário mínimo real (R$ de dez/${ref})`, curto: "Salário mínimo real", polaridade: "maior", porque: "Piso salarial maior descontada a inflação.", unidade: "R$", formato: "moeda", casas: 0, fonte: "Banco Central (SGS 1619 e 433), deflacionado pelo IPCA" }, serie };
  }
  function serieBR(id) {
    if (id === "sm_real") return PB._smReal.serie;
    return PB.serie(id, "BR");
  }
  const indDe = (id) => (id === "sm_real" ? PB._smReal.ind : PB.ind[id]);
  const valorAno = (id, ano) => { const s = serieBR(id).find(([a]) => a === ano); return s ? s[1] : null; };
  const ultimoAte = (id, ano) => { const s = serieBR(id).filter(([a]) => a <= ano); return s.length ? s[s.length - 1] : null; };

  /** comparação de um indicador no mandato: variação (base → fim) ou média no período */
  function avaliar(id, m) {
    const ind = indDe(id);
    const serie = serieBR(id);
    if (!ind || !serie.length) return null;
    const dp = PB.est.dp(serie.map((x) => x[1])) || 1;
    if (MEDIA.includes(id)) {
      const vals = serie.filter(([a]) => a >= m.ini && a <= m.fim).map((x) => x[1]);
      if (!vals.length) return null;
      const media = PB.est.media(vals);
      const geral = PB.est.media(serie.filter(([a]) => a >= 2003).map((x) => x[1]));
      const d = media - geral;
      return { id, ind, tipo: "media", v0: geral, v1: media, d, z: (PB.pol.compara(ind, media, geral) || 0) * Math.abs(d / dp), anos: `${m.ini}–${Math.min(m.fim, serie[serie.length - 1][0])}` };
    }
    const v0 = valorAno(id, m.base);
    const fim = ultimoAte(id, m.fim);
    if (v0 == null || !fim || fim[0] <= m.base || fim[0] < m.ini) return null;
    const d = fim[1] - v0;
    return { id, ind, tipo: "variacao", v0, v1: fim[1], a0: m.base, a1: fim[0], d, z: (PB.pol.compara(ind, fim[1], v0) || 0) * Math.abs(d / dp) };
  }

  function aprovacaoDe(mid) {
    const A = window.PB_MANDATOS && window.PB_MANDATOS.aprovacao;
    if (!A) return { df: [], conf: [] };
    const m = M[mid];
    const dentro = (p) => p.mandato === mid || (p.data >= m.inicio && p.data <= m.termino);
    return { df: (A.datafolha || []).filter(dentro).sort((a, b) => a.data.localeCompare(b.data)), conf: (A.conferencia || []).filter(dentro).sort((a, b) => a.data.localeCompare(b.data)) };
  }

  PB.paginas.mandatos = {
    montar(alvo, p) {
      PB._smReal = PB._smReal || indicadorSMReal();
      const D = window.PB_MANDATOS;
      alvo.append(C.cabecalho("Balanço dos mandatos", "O que aconteceu × o que o público disse",
        "Para cada mandato presidencial de 2003 a 2026: à esquerda, o que os dados oficiais e os fatos registrados mostram; à direita, a avaliação do governo nas pesquisas de opinião. No fim, a correlação entre as duas leituras."));
      alvo.append(el("div", { class: "grade g2", style: { marginBottom: "16px" } },
        el("p", { class: "nota", style: { margin: 0 } }, el("strong", {}, "Fatos: "), "indicadores oficiais (IBGE, Banco Central, Ministério da Saúde) e destaques com fonte oficial ou imprensa de referência, com o mesmo critério para todos os governos. Positivo ou negativo se refere ao efeito medido no país, não ao governo. Fatos de leitura controversa vêm como \"ponto neutro\" ou com uma observação de contexto."),
        el("p", { class: "nota alerta", style: { margin: 0 } }, el("strong", {}, "Percepção: "), "aprovação nas pesquisas (Datafolha como série principal). Mede o que as pessoas acham, influenciado por polarização, partido, mídia e expectativa, e tem margem de erro de cerca de 2 p.p. Não é medida de desempenho.")));
      const st = { m: M[p.m] ? p.m : "lula3", corr: CORREL.some(([k]) => k === p.corr) ? p.corr : "macro_ipca" };
      const filtros = el("div", { class: "filtros" });
      const corpo = el("div");
      alvo.append(filtros, corpo);
      const salva = () => PB.setParams(st);
      filtros.append(C.segmentado("Mandato", MANDATOS.map((m) => ({ v: m.id, t: m.nome })), st.m, (v) => { st.m = v; salva(); desenha(); }));
      if (!D || (!D.aprovacao && !Object.keys(D.destaques || {}).length)) alvo.insertBefore(C.nota("Os dados de aprovação e os destaques pesquisados ainda não foram gerados (data/manual/aprovacao.json e destaques_*.json). A parte de indicadores oficiais já funciona.", true), corpo);

      const desenha = () => {
        PB.G.limpa();
        corpo.replaceChildren();
        const m = M[st.m];
        cabecalhoMandato(corpo, m);
        const g = el("div", { class: "grade g2", style: { marginTop: "16px" } });
        corpo.append(g);
        g.append(colunaFatos(m), colunaPercepcao(m));
        comparativo(corpo);
        serieAprovacao(corpo);
        correlacao(corpo, st, salva, desenha);
        eleicoes(corpo);
      };
      desenha();
    },
  };

  function cabecalhoMandato(corpo, m) {
    const ap = aprovacaoDe(m.id).df;
    let como = m.nota && m.id === "temer" ? m.nota : "";
    if (m.eleicao) {
      const r = EL.resultado(m.eleicao, EL.temTurno(m.eleicao, 2) ? 2 : 1);
      const c = r && r.candidatos[0];
      if (c) como = `Eleito em ${m.eleicao} com ${PB.num(c.pct, 2)}% dos votos válidos no ${EL.temTurno(m.eleicao, 2) ? "2º" : "1º"} turno (TSE).`;
    }
    const cc = C.cartao({ titulo: `${m.presidente} (${m.partido}) · ${m.inicio.slice(0, 4)}–${m.termino.slice(0, 4)}`, sub: como });
    cc.cartao.style.borderTop = `4px solid ${corMandato(m)}`;
    if (m.nota && m.id !== "temer") cc.corpo.append(el("p", { class: "leitura" }, m.nota));
    if (ap.length) {
      const ini = ap[0], fim = ap[ap.length - 1];
      cc.corpo.append(el("p", { class: "leitura" }, `Aprovação (ótimo/bom, Datafolha): ${PB.num(ini.otimo_bom, 0)}% em ${ini.data.slice(5, 7)}/${ini.data.slice(0, 4)} → ${PB.num(fim.otimo_bom, 0)}% em ${fim.data.slice(5, 7)}/${fim.data.slice(0, 4)}.`));
    }
    corpo.append(cc.cartao);
  }

  function colunaFatos(m) {
    const cf = C.cartao({ titulo: "O que os dados mostram", sub: `Indicadores nacionais: valor no ano anterior ao mandato (${m.base}) × último ano do mandato com dado; PIB e inflação pela média anual do mandato × média de 2003 a 2025.`, fonte: "IBGE, Banco Central, Ministério da Saúde (DataSUS)" });
    const avals = [...VARIACAO, ...MEDIA].map((id) => avaliar(id, m)).filter(Boolean);
    // Destaques automáticos (variação padronizada, orientada pela polaridade)
    const ord = [...avals].filter((a) => a.ind.polaridade !== "neutro" && a.z).sort((a, b) => b.z - a.z);
    const melhores = ord.filter((a) => a.z > 0).slice(0, 3), piores = ord.filter((a) => a.z < 0).reverse().slice(0, 3);
    const txtAval = (a) => (a.tipo === "media" ? `${a.ind.curto}: média de ${PB.fmt(a.ind, a.v1, true)} no mandato (${a.anos}) contra ${PB.fmt(a.ind, a.v0, true)} em 2003–2025` : `${a.ind.curto}: ${PB.fmt(a.ind, a.v0)} (${a.a0}) → ${PB.fmt(a.ind, a.v1)} (${a.a1})`);
    cf.corpo.append(el("div", { class: "grade g2", style: { gap: "10px" } },
      el("div", {}, el("h3", { style: { fontSize: "14px", marginBottom: "6px" } }, "Maiores melhoras nos dados"), ...(melhores.length ? melhores.map((a) => el("div", { class: "prop", style: { "--cor": "var(--melhor)" } }, el("p", {}, txtAval(a)), el("div", { class: "meta" }, C.variacao(a.ind, a.d))))
        : [C.vazio("Nenhum indicador melhorou de forma relevante.")])),
      el("div", {}, el("h3", { style: { fontSize: "14px", marginBottom: "6px" } }, "Maiores pioras nos dados"), ...(piores.length ? piores.map((a) => el("div", { class: "prop", style: { "--cor": "var(--pior)" } }, el("p", {}, txtAval(a)), el("div", { class: "meta" }, C.variacao(a.ind, a.d))))
        : [C.vazio("Nenhum indicador piorou de forma relevante.")]))));
    cf.corpo.append(el("p", { class: "leitura", style: { marginTop: "6px" } }, "Ordem pela variação padronizada (variação ÷ desvio-padrão histórico do indicador), orientada pela polaridade."));
    // Tabela completa
    const linhas = avals.map((a) => ({ n: a.ind.curto, pol: a.ind, de: a.tipo === "media" ? "média 2003–25" : String(a.a0), v0: a.v0, ate: a.tipo === "media" ? "média " + a.anos : String(a.a1), v1: a.v1, d: a.d, _a: a }));
    const tab = C.tabela([{ t: "Indicador", k: "n" }, { t: "Leitura", k: "pol", fmt: (v) => C.selo(v, true) }, { t: "De", k: "de" }, { t: "Valor", k: "v0", n: true, fmt: (v, l) => PB.fmt(l._a.ind, v) }, { t: "Para", k: "ate" }, { t: "Valor", k: "v1", n: true, fmt: (v, l) => PB.fmt(l._a.ind, v) }, { t: "Resultado", k: "d", n: true, fmt: (v, l) => C.variacao(l._a.ind, v) }], linhas);
    cf.corpo.append(el("h3", { style: { fontSize: "14px", margin: "12px 0 6px" } }, "Todos os indicadores do período"), tab);
    const semDado = [...VARIACAO, ...MEDIA].filter((id) => !avals.some((a) => a.id === id)).map((id) => indDe(id) && indDe(id).curto).filter(Boolean);
    if (semDado.length) cf.corpo.append(el("p", { class: "leitura" }, "Sem dado para o período: " + semDado.join(", ") + " (séries da PNAD começam em 2012)."));
    // Destaques pesquisados
    const dest = window.PB_MANDATOS && window.PB_MANDATOS.destaques && window.PB_MANDATOS.destaques[m.id];
    cf.corpo.append(el("h3", { style: { fontSize: "14px", margin: "14px 0 6px" } }, "Fatos registrados no mandato"));
    if (!dest) cf.corpo.append(C.vazio("Destaques ainda não pesquisados para este mandato."));
    else cf.corpo.append(el("div", { class: "grade g2", style: { gap: "10px" } },
      el("div", { class: "prop-col" }, el("strong", { style: { fontSize: "13px", color: "var(--melhor)" } }, "✔ Positivos"), ...(dest.positivos || []).map((x) => fato(x, "var(--melhor)"))),
      el("div", { class: "prop-col" }, el("strong", { style: { fontSize: "13px", color: "var(--pior)" } }, "✖ Negativos"), ...(dest.negativos || []).map((x) => fato(x, "var(--pior)")))));
    if (dest && (dest.neutros || []).length) cf.corpo.append(el("div", { class: "prop-col", style: { marginTop: "10px" } },
      el("strong", { style: { fontSize: "13px", color: "var(--neutro)" } }, "◆ Pontos neutros (para a sua leitura)"),
      el("p", { class: "leitura", style: { margin: 0 } }, "Fatos relevantes do mandato sem classificação como positivo ou negativo. A observação traz o contexto para cada leitor interpretar."),
      ...dest.neutros.map((x) => fato(x, "var(--neutro)"))));
    return cf.cartao;
  }

  function fato(x, cor) {
    let host = "";
    try { host = new URL(x.fonte).hostname.replace(/^www\./, ""); } catch (e) {}
    return el("div", { class: "prop", style: { "--cor": cor } }, el("div", { class: "tema" }, (x.quando ? x.quando + " · " : "") + (x.tema || "")), el("p", {}, el("strong", {}, x.titulo), " — ", x.texto),
      x.observacao ? el("p", { class: "obs" }, el("strong", {}, "Observação: "), x.observacao) : null,
      el("div", { class: "meta" }, el("a", { href: x.fonte, target: "_blank", rel: "noopener noreferrer", "data-dica": x.fonte }, x.fonte_nome || host), el("span", { class: "selo" + (x.confianca === "alta" ? " bom" : "") }, "confiança " + x.confianca),
        ...(x.observacao_fontes || []).map((f, i) => el("a", { href: f.url, target: "_blank", rel: "noopener noreferrer", "data-dica": f.url }, i ? f.nome : "observação: " + f.nome))));
  }

  function colunaPercepcao(m) {
    const cp = C.cartao({ titulo: "O que o público disse", sub: "Avaliação do governo nas pesquisas de opinião durante o mandato. Linhas = Datafolha; pontos cinza = ótimo/bom em outros institutos, para conferência.", fonte: "Datafolha e institutos de conferência (fonte de cada ponto na dica e na tabela)" });
    const { df, conf } = aprovacaoDe(m.id);
    if (!df.length && !conf.length) { cp.corpo.append(C.vazio("Pesquisas de opinião ainda não levantadas para este mandato.")); return cp.cartao; }
    if (df.length) {
      const vals = df.map((x) => x.otimo_bom);
      const max = df.reduce((a, b) => (b.otimo_bom > a.otimo_bom ? b : a)), min = df.reduce((a, b) => (b.otimo_bom < a.otimo_bom ? b : a));
      const mm = (x) => `${x.data.slice(5, 7)}/${x.data.slice(0, 4)}`;
      const k = (r, v, d) => el("div", { class: "stat" }, el("div", { class: "r" }, r), el("div", { class: "v" }, v), el("div", { class: "d" }, d));
      cp.corpo.append(el("div", { class: "stats", style: { marginBottom: "10px" } },
        k("Início (ótimo/bom)", PB.num(df[0].otimo_bom, 0) + "%", mm(df[0])), k("Última (ótimo/bom)", PB.num(df[df.length - 1].otimo_bom, 0) + "%", mm(df[df.length - 1])),
        k("Máxima", PB.num(max.otimo_bom, 0) + "%", mm(max)), k("Mínima", PB.num(min.otimo_bom, 0) + "%", mm(min)),
        k("Ruim/péssimo na última", PB.num(df[df.length - 1].ruim_pessimo, 0) + "%", mm(df[df.length - 1]))));
    }
    const gl = el("div");
    cp.corpo.append(gl);
    const series = [];
    if (df.length) series.push({ name: "Ótimo/bom (Datafolha)", data: df.map((x) => [ms(x.data), x.otimo_bom]), color: PB.cor("--melhor") }, { name: "Ruim/péssimo (Datafolha)", data: df.map((x) => [ms(x.data), x.ruim_pessimo]), color: PB.cor("--pior") });
    const insts = [...new Set(conf.map((x) => x.instituto))];
    insts.forEach((inst) => series.push({ name: `Ótimo/bom (${inst})`, data: conf.filter((x) => x.instituto === inst).map((x) => [ms(x.data), x.otimo_bom]), color: PB.cor("--texto-2"), largura: 0, marcador: 5 })); // só marcadores: série esparsa e sem os segmentos falsos do Apex
    setTimeout(() => PB.G.linhaTempo(gl, { series, altura: 300, formatoX: "MMM yyyy", xMin: ms(m.inicio), xMax: ms(m.termino) }), 0);
    // Percepção por área
    const perc = window.PB_MANDATOS && window.PB_MANDATOS.aprovacao && (window.PB_MANDATOS.aprovacao.percepcao || {})[m.id];
    cp.corpo.append(el("h3", { style: { fontSize: "14px", margin: "12px 0 6px" } }, "O que o público aprovou e reprovou"));
    if (!perc || !perc.length) cp.corpo.append(C.vazio("Nenhuma pesquisa por área encontrada para este mandato."));
    else cp.corpo.append(el("div", { class: "prop-col" }, ...perc.map((x) => {
      const ok = /aprov/i.test(x.tipo) && !/reprov/i.test(x.tipo);
      let host = "";
      try { host = new URL(x.fonte).hostname.replace(/^www\./, ""); } catch (e) {}
      return el("div", { class: "prop", style: { "--cor": ok ? "var(--melhor)" : "var(--pior)" } }, el("div", { class: "tema" }, (ok ? "✔ aprovou" : "✖ reprovou") + " · " + (x.area || "")), el("p", {}, x.texto),
        el("div", { class: "meta" }, el("a", { href: x.fonte, target: "_blank", rel: "noopener noreferrer" }, x.fonte_nome || host), x.instituto ? el("span", { class: "selo" }, x.instituto) : null));
    })));
    // Tabela de pontos
    C.alternaTabela(cp.acoes, gl, () => C.tabela([{ t: "Data", k: "data" }, { t: "Instituto", k: "inst" }, { t: "Ótimo/bom", k: "ob", n: true }, { t: "Regular", k: "rg", n: true }, { t: "Ruim/péssimo", k: "rp", n: true }, { t: "Fonte", k: "f" }],
      [...df.map((x) => ({ data: x.data, inst: "Datafolha", ob: x.otimo_bom, rg: x.regular, rp: x.ruim_pessimo, f: x.fonte_nome })), ...conf.map((x) => ({ data: x.data, inst: x.instituto, ob: x.otimo_bom, rg: x.regular, rp: x.ruim_pessimo, f: x.fonte_nome }))], { ordem: 0, desc: false }));
    return cp.cartao;
  }

  /** saldo dos fatos × variação da aprovação em cada mandato */
  function comparativo(corpo) {
    const linhas = MANDATOS.map((m) => {
      const avals = [...VARIACAO, ...MEDIA].map((id) => avaliar(id, m)).filter((a) => a && a.ind.polaridade !== "neutro");
      const melhor = avals.filter((a) => a.z > 0).length, pior = avals.filter((a) => a.z < 0).length;
      const df = aprovacaoDe(m.id).df;
      const a0 = df.length ? df[0].otimo_bom : null, a1 = df.length ? df[df.length - 1].otimo_bom : null;
      const da = a0 != null ? a1 - a0 : null;
      const saldo = melhor - pior;
      let leitura = "–";
      if (da != null && avals.length) {
        if (saldo > 0 && da >= 0) leitura = "A aprovação acompanhou dados melhores";
        else if (saldo < 0 && da <= 0) leitura = "A aprovação acompanhou dados piores";
        else if (saldo > 0 && da < 0) leitura = "A aprovação caiu apesar de mais indicadores melhorarem";
        else if (saldo < 0 && da > 0) leitura = "A aprovação subiu apesar de mais indicadores piorarem";
        else leitura = "Dados mistos (saldo zero)";
      }
      return { m: m.nome, melhor, pior, saldo, a0, a1, da, leitura, _m: m };
    });
    const cc = C.cartao({ titulo: "Fatos × percepção, mandato a mandato", sub: "Quantos indicadores oficiais melhoraram ou pioraram no mandato e como a aprovação (ótimo/bom, Datafolha) variou do início ao fim.", fonte: "Cálculo sobre os indicadores do painel e a série Datafolha",
      info: "A leitura compara só o sentido das duas coisas. Ela não diz que um causou o outro: a aprovação também responde a escândalos, polarização e expectativas, e os indicadores têm defasagem." });
    cc.cartao.style.marginTop = "16px";
    cc.corpo.append(C.tabela([{ t: "Mandato", k: "m" }, { t: "Indicadores que melhoraram", k: "melhor", n: true, cls: () => "var bom" }, { t: "Pioraram", k: "pior", n: true, cls: () => "var ruim" }, { t: "Saldo", k: "saldo", n: true, fmt: (v) => (v > 0 ? "+" : "") + v },
      { t: "Aprovação no início", k: "a0", n: true, fmt: (v) => (v == null ? "–" : PB.num(v, 0) + "%") }, { t: "No fim", k: "a1", n: true, fmt: (v) => (v == null ? "–" : PB.num(v, 0) + "%") }, { t: "Variação", k: "da", n: true, fmt: (v) => (v == null ? "–" : (v > 0 ? "+" : "") + PB.num(v, 0) + " p.p.") },
      { t: "Leitura", k: "leitura", fmt: (v) => el("span", { style: { whiteSpace: "normal", display: "block", minWidth: "240px" } }, v) }], linhas, { ordem: 0, desc: false }));
    const ok = linhas.filter((l) => l.da != null);
    if (ok.length > 2) {
      const r = PB.est.spearman(ok.map((l) => l.saldo), ok.map((l) => l.da));
      cc.corpo.append(C.nota(`Entre os ${ok.length} mandatos, a correlação de postos (Spearman) entre o saldo dos indicadores e a variação da aprovação é ${PB.num(r, 2)} (${PB.est.forca(r)}). Com tão poucos mandatos, isso é descritivo, não estatisticamente conclusivo.`));
    }
    corpo.append(cc.cartao);
  }

  function serieAprovacao(corpo) {
    const A = window.PB_MANDATOS && window.PB_MANDATOS.aprovacao;
    if (!A || !(A.datafolha || []).length) return;
    const df = [...A.datafolha].sort((a, b) => a.data.localeCompare(b.data));
    const cs = C.cartao({ titulo: "Aprovação dos presidentes, 2003 a 2026", sub: "Ótimo/bom e ruim/péssimo no Datafolha, com as faixas de cada mandato.", fonte: "Datafolha (fonte de cada ponto na tabela da coluna 'O que o público disse')" });
    cs.cartao.style.marginTop = "16px";
    const g = el("div");
    cs.corpo.append(g);
    corpo.append(cs.cartao);
    PB.G.linhaTempo(g, { series: [{ name: "Ótimo/bom", data: df.map((x) => [ms(x.data), x.otimo_bom]), color: PB.cor("--melhor") }, { name: "Ruim/péssimo", data: df.map((x) => [ms(x.data), x.ruim_pessimo]), color: PB.cor("--pior") }],
      altura: 340, faixas: MANDATOS.map((m, i) => ({ de: ms(m.inicio), ate: ms(m.termino), texto: m.nome, cor: i % 2 ? PB.cor("--superficie-3") : PB.cor("--superficie-2") })) });
  }

  /** aprovação média do ano (Datafolha) */
  function aprovacaoAnual() {
    const A = window.PB_MANDATOS && window.PB_MANDATOS.aprovacao;
    const por = {};
    ((A && A.datafolha) || []).forEach((x) => { const a = +x.data.slice(0, 4); (por[a] = por[a] || []).push(x.otimo_bom); });
    return Object.fromEntries(Object.entries(por).map(([a, v]) => [a, PB.est.media(v)]));
  }
  const mandatoDoAno = (a) => MANDATOS.find((m) => a >= m.ini && a <= m.fim) || MANDATOS.find((m) => a >= +m.inicio.slice(0, 4) && a <= +m.termino.slice(0, 4));

  function correlacao(corpo, st, salva, redesenha) {
    const anual = aprovacaoAnual();
    const cc = C.cartao({ titulo: "A aprovação acompanha a economia e a violência?", sub: "Cada ponto é um ano: aprovação média no Datafolha (ótimo/bom) × indicador oficial do mesmo ano. Cor = partido do presidente.", fonte: "Datafolha; IBGE, Banco Central e Ministério da Saúde",
      info: "Correlação de Pearson entre os anos com os dois dados. Anos de transição (2016) misturam dois governos. Correlação não é causalidade." });
    cc.cartao.style.marginTop = "16px";
    corpo.append(cc.cartao);
    cc.corpo.append(el("div", { class: "filtros", style: { boxShadow: "none" } }, C.select("Indicador", CORREL.map(([k, t]) => ({ v: k, t })), st.corr, (v) => { st.corr = v; salva(); redesenha(); })));
    if (!Object.keys(anual).length) { cc.corpo.append(C.vazio("Série de aprovação ainda não disponível.")); return; }
    const ind = indDe(st.corr);
    const pts = Object.entries(anual).map(([a, ap]) => { a = +a; const v = valorAno(st.corr, a); const m = mandatoDoAno(a); return v == null ? null : { id: String(a), x: v, y: ap, rotulo: String(a), cor: m ? corMandato(m) : PB.cor("--p-outros"),
      dica: `<div class="t">${a} · ${PB.esc(m ? m.nome : "")}</div>${PB.esc(ind.curto)}: ${PB.esc(PB.fmt(ind, v, true))}<br>Aprovação média (ótimo/bom): ${PB.num(ap, 0)}%` }; }).filter(Boolean);
    const g = el("div", { class: "grade g-mapa" });
    cc.corpo.append(g);
    const gs = el("div");
    g.append(gs);
    if (pts.length < 5) { gs.append(C.vazio("Poucos anos com os dois dados.")); return; }
    const mq = PB.est.mqo(pts.map((q) => [q.x]), pts.map((q) => q.y));
    const r = PB.est.pearson(pts.map((q) => q.x), pts.map((q) => q.y));
    const pv = PB.est.pCorrelacao(r, pts.length);
    PB.G.dispersao(gs, { pontos: pts, xRot: `${ind.curto} (${PB.unidadeCurta(ind)})`, yRot: "Aprovação média no ano (ótimo/bom, %)", fx: (v) => PB.fmt(ind, v), fy: (v) => PB.num(v, 0) + "%", reta: { a: mq.beta[0], b: mq.beta[1] }, altura: 420 });
    const lado = el("div");
    g.append(lado);
    lado.append(el("div", { class: "stats" },
      el("div", { class: "stat" }, el("div", { class: "r" }, "Correlação (r)"), el("div", { class: "v" }, PB.num(r, 2)), el("div", { class: "d" }, PB.est.forca(r))),
      el("div", { class: "stat" }, el("div", { class: "r" }, "R²"), el("div", { class: "v" }, PB.num(mq.r2, 2))),
      el("div", { class: "stat" }, el("div", { class: "r" }, "p-valor"), el("div", { class: "v" }, PB.num(pv, 3)), el("div", { class: "d" }, pv < 0.05 ? "significativo a 5%" : "pode ser acaso")),
      el("div", { class: "stat" }, el("div", { class: "r" }, "Anos"), el("div", { class: "v" }, pts.length))));
    const sentido = r >= 0 ? "mais alta" : "mais baixa";
    lado.append(C.nota(`Nos anos em que ${PB.minus(ind.curto)} foi maior, a aprovação foi, em média, ${sentido} (${PB.pol.rotulo(ind).toLowerCase()} neste indicador). Cada ${PB.fmtDelta(ind, 1).replace("+", "")} a mais se associa a ${mq.beta[1] >= 0 ? "+" : ""}${PB.num(mq.beta[1], 1)} p.p. de aprovação.`));
    // anos em que percepção e dado mais se descolaram (maiores resíduos)
    const res = pts.map((q, i) => ({ a: q.id, e: mq.res[i] })).sort((x, y) => Math.abs(y.e) - Math.abs(x.e)).slice(0, 4);
    lado.append(el("h3", { style: { fontSize: "14px", margin: "12px 0 4px" } }, "Anos em que a aprovação mais se afastou do esperado"),
      ...res.map((x) => el("div", { class: "rk", style: { gridTemplateColumns: "56px minmax(0,1fr) 90px", cursor: "default" } }, el("span", { class: "uf" }, x.a), el("span", {}, (mandatoDoAno(+x.a) || {}).nome || ""), el("span", { class: "val" }, (x.e >= 0 ? "+" : "−") + PB.num(Math.abs(x.e), 0) + " p.p."))),
      el("p", { class: "leitura" }, "Positivo = aprovação acima do que o indicador sozinho sugeriria; negativo = abaixo."));
  }

  function eleicoes(corpo) {
    const A = window.PB_MANDATOS && window.PB_MANDATOS.aprovacao;
    if (!A || !(A.datafolha || []).length) return;
    const linhas = ELEICOES_GOVERNO.map((e) => {
      const antes = A.datafolha.filter((x) => x.data <= `${e.ano}-10-31` && x.data >= `${e.ano}-01-01`).sort((a, b) => a.data.localeCompare(b.data));
      const ult = antes[antes.length - 1];
      const voto = PB.valor("voto_governo_t2", "BR", e.ano); // candidato do governo federal no 2º turno
      return { ano: e.ano, m: M[e.mandato].nome, cand: e.cand, ap: ult ? ult.otimo_bom : null, data: ult ? ult.data.split("-").reverse().join("/") : "–", voto };
    });
    const ce = C.cartao({ titulo: "Aprovação no ano da eleição × voto no candidato do governo", sub: "Última pesquisa Datafolha do ano até outubro e o resultado do candidato do governo no 2º turno (TSE). Em 2018 o governo (MDB) não foi ao 2º turno.", fonte: "Datafolha e TSE" });
    ce.cartao.style.marginTop = "16px";
    ce.corpo.append(C.tabela([{ t: "Eleição", k: "ano" }, { t: "Mandato", k: "m" }, { t: "Candidato do governo", k: "cand" }, { t: "Aprovação (ótimo/bom)", k: "ap", n: true, fmt: (v) => (v == null ? "–" : PB.num(v, 0) + "%") }, { t: "Pesquisa de", k: "data" }, { t: "Votos válidos no 2º turno", k: "voto", n: true, fmt: (v) => (v == null ? "–" : PB.num(v, 2) + "%") }], linhas, { ordem: 0, desc: false }));
    ce.corpo.append(C.nota("Aprovação e voto não medem a mesma coisa: quem avalia o governo como 'regular' também vota, e a eleição compara dois candidatos, não só o governo."));
    corpo.append(ce.cartao);
  }
})();

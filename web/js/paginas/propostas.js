(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el, EL = PB.EL;
  PB.paginas = PB.paginas || {};
  const DATAS = { 2002: ["06/10", "27/10"], 2006: ["01/10", "29/10"], 2010: ["03/10", "31/10"], 2014: ["05/10", "26/10"], 2018: ["07/10", "28/10"], 2022: ["02/10", "30/10"], 2026: ["04/10", "25/10"] };

  // Situação da proposta (cumprimento) e desfecho do ato: rótulo, ícone e classe de cor (sempre com texto)
  const STATUS = {
    cumprida: { t: "Cumprida", i: "✔", c: "st-ok" },
    parcial: { t: "Cumprida em parte", i: "◐", c: "st-par" },
    nao_cumprida: { t: "Não cumprida", i: "✖", c: "st-nao" },
    em_andamento: { t: "Em andamento", i: "⏳", c: "st-and" },
    nao_avaliavel: { t: "Não avaliável", i: "?", c: "st-na" },
    nao_se_aplica: { t: "Candidato não eleito", i: "—", c: "st-na" },
    aguardando_mandato: { t: "Mandato começa em 2027", i: "⏳", c: "st-na" },
    efetivado: { t: "Efetivado", i: "✔", c: "st-ok" },
    revertido: { t: "Revertido / perdeu validade", i: "↺", c: "st-nao" },
  };
  const ORDEM_PLACAR = ["cumprida", "parcial", "em_andamento", "nao_cumprida", "nao_avaliavel"];
  const COR_PLACAR = { cumprida: "--st-ok-t", parcial: "--st-par-t", em_andamento: "--st-and-t", nao_cumprida: "--st-nao-t", nao_avaliavel: "--st-na-t" };
  const SITUACOES_FILTRO = [["", "Todas"], ["cumprida", "Cumpridas"], ["parcial", "Cumpridas em parte"], ["nao_cumprida", "Não cumpridas"], ["em_andamento", "Em andamento"], ["nao_avaliavel", "Não avaliáveis"]];

  const dataBR = (s) => (s ? s.split("-").reverse().join("/") : "");
  const link = (url, nome) => {
    let host = "";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) {}
    return el("a", { href: url, target: "_blank", rel: "noopener noreferrer", "data-dica": url }, nome || host || "fonte");
  };
  const seloConf = (c) => el("span", { class: "selo" + (c === "alta" ? " bom" : ""), "data-dica": c === "alta" ? "Plano oficial, ato oficial ou mais de um veículo" : "Um único veículo" }, "confiança " + c);

  /** selo de situação com a explicação completa na dica (mouse e teclado) */
  function seloSituacao(cp, rotuloTipo) {
    const s = STATUS[cp.status] || STATUS.nao_avaliavel;
    const partes = [`<div class="t">${PB.esc(rotuloTipo)}: ${s.i} ${PB.esc(s.t)}</div>`];
    if (cp.resumo) partes.push(`<div>${PB.esc(cp.resumo)}</div>`);
    if (cp.observacao) partes.push(`<div style="margin-top:4px"><strong>Observação:</strong> ${PB.esc(cp.observacao)}</div>`);
    const meta = [];
    if (cp.quando) meta.push("Quando: " + PB.esc(cp.quando));
    if (cp.fonte_nome) meta.push("Fonte: " + PB.esc(cp.fonte_nome));
    if (cp.confianca) meta.push("confiança " + PB.esc(cp.confianca));
    if (meta.length) partes.push(`<div class="l" style="margin-top:4px">${meta.join(" · ")}</div>`);
    return el("span", { class: "st " + s.c, tabindex: 0, role: "note", "data-dica": partes.join(""), "data-dica-html": "1",
      "aria-label": `${rotuloTipo}: ${s.t}. ${cp.resumo || ""}` }, s.i + " " + s.t);
  }

  /** linha "Situação" dentro do cartão da proposta: selo + resumo curto + link da fonte da verificação */
  function linhaSituacao(cp, rotuloTipo) {
    if (!cp) return null;
    const linha = el("div", { class: "situacao" }, seloSituacao(cp, rotuloTipo));
    if (cp.quando && !["nao_se_aplica", "aguardando_mandato"].includes(cp.status)) linha.append(el("span", {}, cp.quando));
    if (cp.fonte) linha.append(link(cp.fonte, "fonte da verificação"));
    if (cp.observacao) linha.append(el("span", { class: "selo", tabindex: 0, role: "note", "data-dica": cp.observacao, "aria-label": "Leitura discutível. " + cp.observacao }, "◆ leitura discutível"));
    return linha;
  }

  /** placar de cumprimento do candidato (só faz sentido para quem foi eleito) */
  function placar(c) {
    const itens = [...(c.propostas_1turno || []), ...(c.propostas_entre_turnos || [])].map((x) => x.cumprimento).filter(Boolean);
    if (!itens.length) return null;
    if (itens.every((x) => x.status === "nao_se_aplica")) return el("p", { class: "leitura" }, "Não foi eleito: as propostas aparecem só para comparação.");
    if (itens.every((x) => x.status === "aguardando_mandato")) return el("p", { class: "leitura" }, "Eleito: o mandato começa em 1º/01/2027. O acompanhamento das propostas começa a partir daí.");
    const cont = {};
    itens.forEach((x) => (cont[x.status] = (cont[x.status] || 0) + 1));
    const total = itens.length;
    const barra = el("div", { class: "barra-cump", role: "img", "aria-label": ORDEM_PLACAR.filter((k) => cont[k]).map((k) => `${cont[k]} ${STATUS[k].t.toLowerCase()}`).join(", ") });
    ORDEM_PLACAR.forEach((k) => { if (cont[k]) barra.append(el("span", { style: { width: (cont[k] / total) * 100 + "%", background: `var(${COR_PLACAR[k]})` }, "data-dica": `${cont[k]} de ${total}: ${STATUS[k].t}` })); });
    const leg = el("div", { class: "leg" }, ...ORDEM_PLACAR.filter((k) => cont[k]).map((k) => el("span", { class: "st " + STATUS[k].c, style: { cursor: "default" } }, `${STATUS[k].i} ${cont[k]} ${STATUS[k].t.toLowerCase()}`)));
    return el("div", { class: "placar-cump" }, el("strong", { style: { fontSize: "13px" } }, `Cumprimento das ${total} propostas listadas`), barra, leg);
  }

  PB.paginas.propostas = {
    montar(alvo, p) {
      const P = window.PB_PROPOSTAS;
      alvo.append(C.cabecalho("Propostas e entre turnos", "O que cada candidato propôs, o que foi cumprido e o que o governo fez entre os turnos",
        "Propostas registradas antes do 1º turno, o que foi proposto de novo entre o 1º e o 2º turno e os atos do governo federal no período. Cada proposta de quem venceu traz a situação: cumprida, em parte, não cumprida ou em andamento. Passe o mouse no selo para ver quando e como."));
      if (!P) { alvo.append(C.vazio("Arquivo data/propostas.js não encontrado. Rode scripts/build.py depois de gerar data/manual/propostas.json.")); return; }
      const anos = P.eleicoes.map((e) => e.ano);
      const st = { ano: anos.includes(+p.ano) ? +p.ano : anos[anos.length - 1], tema: p.tema || "", sit: p.sit || "" };
      const filtros = el("div", { class: "filtros" });
      const corpo = el("div");
      alvo.append(filtros, corpo);
      const salva = () => PB.setParams(st);
      filtros.append(
        C.segmentado("Eleição", anos.map((a) => ({ v: a, t: String(a) })), st.ano, (v) => { st.ano = +v; salva(); desenha(); }),
        C.select("Tema", [{ v: "", t: "Todos" }, ...P.temas.map((t) => ({ v: t, t }))], st.tema, (v) => { st.tema = v; salva(); desenha(); }),
        C.select("Situação", SITUACOES_FILTRO.map(([v, t]) => ({ v, t })), st.sit, (v) => { st.sit = v; salva(); desenha(); }),
      );
      if (!P.cumprimento_gerado) alvo.insertBefore(C.nota("A verificação de cumprimento ainda não foi gerada (data/manual/cumprimento_*.json)."), corpo);

      const desenha = () => {
        corpo.replaceChildren();
        const e = P.eleicoes.find((x) => x.ano === st.ano);
        const filtra = (lista) => (lista || []).filter((i) => (!st.tema || i.tema === st.tema) && (!st.sit || (i.cumprimento && i.cumprimento.status === st.sit)));
        const cores = EL.cores(st.ano);
        const corDe = (c) => cores[String(c.numero)] || PB.corPartido(c.partido);
        const [d1, d2] = DATAS[st.ano] || ["", ""];

        const ctx = C.cartao({ titulo: `${st.ano}: ${e.incumbente_candidato ? "presidente disputando a reeleição" : "sem presidente na disputa"}`, sub: `Presidente em exercício: ${e.presidente_em_exercicio}. 1º turno em ${d1}, 2º turno em ${d2}.`,
          fonte: "Propostas e verificações com fonte por item (links em cada cartão). " + (P.metodo || "") });
        ctx.corpo.append(el("p", { style: { margin: 0 } }, e.contexto));
        const r1 = EL.resultado(st.ano, 1), r2 = EL.resultado(st.ano, 2);
        if (r1) ctx.corpo.append(el("p", { class: "leitura" }, "Resultado oficial (TSE): 1º turno " + r1.candidatos.slice(0, 3).map((c) => `${EL.nome(c)} ${PB.num(c.pct, 2)}%`).join(", ") + (r2 ? " · 2º turno " + r2.candidatos.map((c) => `${EL.nome(c)} ${PB.num(c.pct, 2)}%`).join(" × ") : "") + "."));
        corpo.append(ctx.cartao);

        // Finalistas lado a lado + atos do governo (3 colunas em tela larga)
        const finalistas = e.candidatos.filter((c) => c.finalista);
        const g = el("div", { class: "grade g3", style: { marginTop: "16px" } });
        corpo.append(g);
        finalistas.forEach((c) => {
          const cor = corDe(c);
          const cc = C.cartao({ titulo: `${c.nome_urna ? PB.titulo(c.nome_urna) : c.nome} (${c.partido} · ${c.numero})`, sub: c.nome });
          cc.cartao.style.borderTop = `4px solid ${cor}`;
          const pl = placar(c);
          if (pl) cc.corpo.append(pl);
          if (c.plano_governo_url) cc.corpo.append(el("p", { class: "leitura" }, link(c.plano_governo_url, "Plano de governo (PDF)")));
          cc.corpo.append(el("h3", { style: { margin: "10px 0 6px" } }, "Antes do 1º turno"));
          const p1 = filtra(c.propostas_1turno);
          cc.corpo.append(p1.length ? el("div", { class: "prop-col" }, ...p1.map((x) => item(x, cor))) : C.vazio("Nenhum item com esses filtros."));
          cc.corpo.append(el("h3", { style: { margin: "14px 0 6px" } }, `Novo entre os turnos (${d1} a ${d2})`));
          const p2 = filtra(c.propostas_entre_turnos).sort((a, b) => (a.data || "").localeCompare(b.data || ""));
          cc.corpo.append(p2.length ? el("div", { class: "prop-col linha-tempo" }, ...p2.map((x) => item(x, cor, true))) : C.vazio(st.sit || st.tema ? "Nenhum item com esses filtros." : "Nenhuma proposta nova confirmada em fonte."));
          g.append(cc.cartao);
        });

        // Atos do governo
        const atos = (e.acoes_governo_entre_turnos || []).slice().sort((a, b) => (a.data || "").localeCompare(b.data || ""));
        const ca = C.cartao({ titulo: "O que o governo fez entre os turnos", sub: (e.incumbente_candidato ? "O presidente candidato à reeleição tem a caneta: pode editar medidas provisórias, decretos e liberar recursos durante a campanha (dentro das regras da lei eleitoral). O opositor só pode propor." : "O presidente não disputava a eleição; atos listados para contexto.") + " O selo mostra o desfecho de cada ato." });
        if (!atos.length) ca.corpo.append(C.vazio("Nenhum ato do governo relacionado à disputa foi encontrado em fonte confiável para esta eleição."));
        else ca.corpo.append(el("div", { class: "prop-col linha-tempo" }, ...atos.map((a) => {
          const congresso = /Congresso/.test(a.tipo);
          return el("div", { class: "prop", style: { "--cor": congresso ? PB.cor("--texto-3") : PB.cor("--marca") } },
            el("div", { class: "tema" }, dataBR(a.data) + " · " + a.tipo), el("p", {}, el("strong", {}, a.ato), " — ", a.descricao),
            el("div", { class: "meta" }, link(a.fonte, a.fonte_nome), seloConf(a.confianca), congresso ? el("span", { class: "selo" }, "não é ato do Executivo") : null),
            linhaSituacao(a.desfecho, "Desfecho"));
        })));
        g.append(ca.cartao);

        // Demais candidatos
        const outros = e.candidatos.filter((c) => !c.finalista);
        if (outros.length && !st.sit) {
          const co = C.cartao({ titulo: "Outros candidatos relevantes do 1º turno", sub: "Principais propostas antes do 1º turno. Não foram eleitos." });
          co.cartao.style.marginTop = "16px";
          const go = el("div", { class: "grade", style: { gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" } });
          outros.forEach((c) => {
            const cor = corDe(c);
            go.append(el("div", {}, el("h3", { style: { marginBottom: "6px" } }, `${c.nome_urna ? PB.titulo(c.nome_urna) : c.nome} (${c.partido})`), el("div", { class: "prop-col" }, ...filtra(c.propostas_1turno).map((x) => item(x, cor, false, true)))));
          });
          co.corpo.append(go);
          corpo.append(co.cartao);
        }
        if (e.lacunas && e.lacunas.length) {
          const cl = C.cartao({ titulo: "O que não foi possível confirmar", sub: "Itens deixados de fora por falta de fonte verificável." });
          cl.cartao.style.marginTop = "16px";
          cl.corpo.append(el("ul", { style: { margin: 0, paddingLeft: "18px", fontSize: "13px", color: "var(--texto-2)" } }, ...e.lacunas.map((l) => el("li", {}, l))));
          corpo.append(cl.cartao);
        }
        const cm = C.cartao({ titulo: "Como a situação foi definida", sub: "Verificação feita por pesquisa com fonte por item, com o mesmo critério para todos os governos." });
        cm.cartao.style.marginTop = "16px";
        cm.corpo.append(el("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px 16px", fontSize: "13px" } },
          ...[["cumprida", "feita como proposta, dentro do mandato"], ["parcial", "feita em parte, em escala menor, de outra forma ou fora do prazo"], ["nao_cumprida", "não feita no mandato"], ["em_andamento", "mandato em curso, ainda em execução ou tramitação"], ["nao_avaliavel", "proposta vaga demais ou sem fonte firme para afirmar"], ["efetivado", "ato que vigorou (ex.: MP convertida em lei)"], ["revertido", "MP que perdeu a validade ou ato revogado"]]
            .map(([k, d]) => el("span", {}, el("span", { class: "st " + STATUS[k].c, style: { cursor: "default" } }, STATUS[k].i + " " + STATUS[k].t), " " + d))));
        cm.corpo.append(C.nota("A avaliação é sobre a proposta como resumida aqui, no mandato seguinte à eleição. Não é juízo de mérito: uma proposta não cumprida pode ter sido abandonada por decisão política, pelo Congresso ou por mudança de contexto."));
        corpo.append(cm.cartao);
      };
      function item(x, cor, comData, semSituacao) {
        return el("div", { class: "prop", style: { "--cor": cor } }, el("div", { class: "tema" }, (comData && x.data ? dataBR(x.data) + " · " : "") + x.tema), el("p", {}, x.proposta),
          el("div", { class: "meta" }, link(x.fonte, x.fonte_nome), seloConf(x.confianca)),
          semSituacao ? null : linhaSituacao(x.cumprimento, "Situação"));
      }
      desenha();
    },
  };
})();

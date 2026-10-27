(function () {
  "use strict";
  const PB = window.PB, C = PB.C, el = C.el;
  PB.paginas = PB.paginas || {};

  const PRESETS = {
    social: { t: "Bem-estar social", ids: ["pobreza", "extrema_pobreza", "gini", "mortalidade_infantil", "esperanca_vida", "analfabetismo"] },
    trabalho: { t: "Mercado de trabalho", ids: ["desocupacao", "subutilizacao", "informalidade", "rendimento"] },
    seguranca: { t: "Segurança e vida", ids: ["homicidios", "obitos_transito", "suicidios", "mortalidade_infantil"] },
    desenvolvimento: { t: "Desenvolvimento", ids: ["pib_pc_relativo", "rendimento", "analfabetismo", "esperanca_vida", "mortalidade_infantil", "pobreza", "homicidios"] },
  };

  PB.paginas.indice = {
    montar(alvo, p) {
      const pesosURL = Object.fromEntries((p.pesos || "").split(",").filter(Boolean).map((x) => x.split(":")).filter(([i]) => PB.ind[i]).map(([i, w]) => [i, +w || 1]));
      const st = { preset: PRESETS[p.preset] ? p.preset : (Object.keys(pesosURL).length ? "" : "desenvolvimento"), metodo: p.metodo === "z" ? "z" : "minmax", ano: +p.ano || null };
      st.pesos = Object.keys(pesosURL).length ? pesosURL : Object.fromEntries(PRESETS[st.preset].ids.map((i) => [i, 1]));
      const filtros = el("div", { class: "filtros" });
      const corpo = el("div");
      alvo.append(C.cabecalho("Índice composto", "Monte o seu índice de situação dos estados", "Escolha os indicadores e o peso de cada um. O painel usa a polaridade para inverter os indicadores em que menor é melhor: no índice, 100 é sempre a melhor situação."), filtros, corpo);
      const salva = () => PB.setParams({ preset: st.preset, metodo: st.metodo, ano: st.ano || "", pesos: Object.entries(st.pesos).map(([i, w]) => i + ":" + w).join(",") });
      const anosPossiveis = d3.range(2012, 2027);
      const desenhaFiltros = () => filtros.replaceChildren(
        C.select("Ponto de partida", [{ v: "", t: "Personalizado" }, ...Object.entries(PRESETS).map(([k, v]) => ({ v: k, t: v.t }))], st.preset, (v) => { st.preset = v; if (v) st.pesos = Object.fromEntries(PRESETS[v].ids.map((i) => [i, 1])); salva(); desenhaFiltros(); desenha(); }),
        C.segmentado("Padronização", [{ v: "minmax", t: "0 a 100", dica: "Em cada indicador, pior UF = 0 e melhor = 100" }, { v: "z", t: "Escore z", dica: "Desvios-padrão em relação à média das UFs" }], st.metodo, (v) => { st.metodo = v; salva(); desenha(); }),
        C.select("Ano de referência", [{ v: "", t: "Último de cada indicador" }, ...anosPossiveis.map((a) => ({ v: a, t: "Até " + a }))], st.ano || "", (v) => { st.ano = +v || null; salva(); desenha(); }),
      );

      const desenha = () => {
        PB.G.limpa();
        corpo.replaceChildren();
        const ids = Object.keys(st.pesos).filter((i) => st.pesos[i] > 0);
        // Seleção e pesos
        const cs = C.cartao({ titulo: "Indicadores e pesos", sub: "Só entram indicadores com leitura de melhor e pior. Clique para incluir; ajuste o peso de 1 a 3." });
        const polares = PB.indicadores.filter((i) => i.polaridade !== "neutro" && !["Macroeconomia", "Eleições"].includes(i.tema) && !i.id.endsWith("_n"));
        const chips = el("div", { class: "chips" }, ...polares.map((i) => {
          const on = st.pesos[i.id] > 0;
          const b = el("button", { class: "chip", type: "button", "aria-pressed": on, "data-dica": i.nome + " · " + PB.pol.rotulo(i) }, (i.polaridade === "maior" ? "↑ " : "↓ ") + i.curto);
          b.addEventListener("click", () => { if (on) delete st.pesos[i.id]; else st.pesos[i.id] = 1; st.preset = ""; salva(); desenhaFiltros(); desenha(); });
          return b;
        }));
        cs.corpo.append(chips);
        const pesos = el("div", { class: "filtros", style: { boxShadow: "none", marginTop: "10px", marginBottom: 0 } }, ...ids.map((i) => {
          const r = el("input", { type: "range", min: 1, max: 3, step: 1, value: st.pesos[i], "aria-label": "Peso de " + PB.ind[i].curto });
          const out = el("strong", {}, "×" + st.pesos[i]);
          r.addEventListener("input", () => (out.textContent = "×" + r.value));
          r.addEventListener("change", () => { st.pesos[i] = +r.value; st.preset = ""; salva(); desenha(); });
          r.style.width = "110px";
          return el("label", { class: "campo" }, el("span", {}, PB.ind[i].curto, " ", out), r);
        }));
        cs.corpo.append(pesos);
        corpo.append(cs.cartao);
        if (ids.length < 2) { corpo.append(C.vazio("Escolha pelo menos 2 indicadores.")); return; }

        // Cálculo
        const anoDe = (i) => (st.ano ? PB.anoAte(i, st.ano) : PB.ultimoAno(i));
        const notas = {}; // notas[i][uf] na escala do método, já orientada (maior = melhor)
        ids.forEach((i) => {
          const ind = PB.ind[i], a = anoDe(i);
          const vals = PB.UFS.map((u) => [u, a == null ? null : PB.valor(i, u, a)]).filter((x) => x[1] != null);
          const sinal = ind.polaridade === "menor" ? -1 : 1;
          const xs = vals.map((x) => x[1] * sinal);
          const mn = d3.min(xs), mx = d3.max(xs), md = PB.est.media(xs), dp = PB.est.dp(xs);
          notas[i] = Object.fromEntries(vals.map(([u], k) => [u, st.metodo === "z" ? (xs[k] - md) / dp : ((xs[k] - mn) / (mx - mn || 1)) * 100]));
        });
        const somaPesos = ids.reduce((s, i) => s + st.pesos[i], 0);
        const bruto = PB.UFS.map((u) => {
          const ok = ids.every((i) => notas[i][u] != null);
          return [u, ok ? ids.reduce((s, i) => s + notas[i][u] * st.pesos[i], 0) / somaPesos : null];
        });
        const vs = bruto.map((x) => x[1]).filter((v) => v != null);
        const mn = d3.min(vs), mx = d3.max(vs);
        const indice = bruto.map(([u, v]) => [u, v == null ? null : ((v - mn) / (mx - mn || 1)) * 100]);
        const indDef = { id: "indice", nome: "Índice composto", curto: "Índice", polaridade: "maior", porque: "No índice, 100 = estado com a melhor situação combinada; 0 = a pior.", unidade: "0 a 100", casas: 1, formato: "num" };
        const esc = PB.escala(indDef, indice.map((x) => x[1]), "quintis");
        const g = el("div", { class: "grade g-mapa", style: { marginTop: "16px" } });
        corpo.append(g);
        const cm = C.cartao({ titulo: "Resultado do índice", sub: "0 = pior estado e 100 = melhor estado na combinação escolhida (é uma posição relativa, não uma meta absoluta).", ind: indDef, fonte: "Cálculo sobre os indicadores escolhidos (fontes no catálogo)",
          csv: () => PB.csv("indice_composto", ["UF", "Índice (0-100)", ...ids.map((i) => PB.ind[i].curto + " (nota)")], PB.pol.ordena(indDef, indice).map(([u, v]) => [u, +v.toFixed(2), ...ids.map((i) => +(notas[i][u] ?? NaN).toFixed(2))])) });
        const mapa = el("div");
        cm.corpo.append(mapa);
        PB.Mapa.uf(mapa, { forma: "grade", cor: (u) => { const v = indice.find((x) => x[0] === u)[1]; return v == null ? null : esc.cor(v); }, valorTexto: (u) => PB.num(indice.find((x) => x[0] === u)[1], 0),
          dica: (u) => { const v = indice.find((x) => x[0] === u)[1]; return `<div class="t">${PB.esc(PB.nomeLocal(u))}</div>Índice: <b>${PB.num(v, 1)}</b><br>` + ids.map((i) => `${PB.esc(PB.ind[i].curto)} (${anoDe(i)}): ${PB.esc(PB.fmt(PB.ind[i], PB.valor(i, u, anoDe(i))))}`).join("<br>"); },
          onclick: (u) => PB.ir("estados", { uf: u }) });
        cm.corpo.append(C.legendaEscala(indDef, esc));
        g.append(cm.cartao);
        const cr = C.cartao({ titulo: "Ranking", sub: "1º = melhor situação combinada." });
        cr.corpo.append(C.ranking(indDef, indice, { corDe: (v) => esc.cor(v), onclick: (u) => PB.ir("estados", { uf: u }) }));
        g.append(cr.cartao);

        // Contribuições
        const ct = C.cartao({ titulo: "Nota de cada estado em cada indicador", sub: st.metodo === "z" ? "Escore z orientado: positivo = melhor que a média das UFs." : "0 = pior UF, 100 = melhor UF naquele indicador. O ano usado está no cabeçalho.", fonte: "Cálculo sobre os indicadores escolhidos" });
        ct.cartao.style.marginTop = "16px";
        const linhas = PB.UFS.map((u) => ({ uf: u, idx: indice.find((x) => x[0] === u)[1], ...Object.fromEntries(ids.map((i) => [i, notas[i][u]])) }));
        const fmtN = (v) => (v == null ? "–" : PB.num(v, st.metodo === "z" ? 2 : 0));
        const corN = (v) => { if (v == null) return ""; const t = st.metodo === "z" ? v > 0.5 ? "bom" : v < -0.5 ? "ruim" : "" : v >= 66 ? "bom" : v <= 33 ? "ruim" : ""; return t ? "var " + t : ""; };
        ct.corpo.append(C.tabela([{ t: "UF", k: "uf" }, { t: "Índice", k: "idx", n: true, fmt: (v) => PB.num(v, 1) }, ...ids.map((i) => ({ t: `${PB.ind[i].curto} (${anoDe(i)}) ×${st.pesos[i]}`, k: i, n: true, fmt: fmtN, cls: (l) => corN(l[i]) }))], linhas, { ordem: 1 }));
        ct.corpo.append(C.nota("Índices compostos dependem das escolhas: indicadores, pesos, padronização e ano. Mude os pesos para ver quanto o ranking é sensível a elas."));
        corpo.append(ct.cartao);
      };
      desenhaFiltros();
      desenha();
    },
  };
})();

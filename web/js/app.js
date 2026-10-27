/* Navegação: abas com estado na URL (#/pagina?param=valor), tema e cópia de link. */
(function () {
  "use strict";
  const PB = window.PB;
  const C = PB.C;
  const PAGINAS = [
    ["inicio", "Início"],
    ["explorar", "Mapa e ranking"],
    ["estados", "Estados"],
    ["regioes", "Regiões"],
    ["tendencias", "Séries históricas"],
    ["eleicoes", "Eleições"],
    ["governadores", "Governadores"],
    ["municipios", "Municípios"],
    ["correlacoes", "Correlações"],
    ["indice", "Índice composto"],
    ["macro", "Economia nacional"],
    ["propostas", "Propostas e entre turnos"],
    ["mandatos", "Balanço dos mandatos"],
    ["fontes", "Dados e método"],
  ];
  const trilho = document.getElementById("abas");
  const alvo = document.getElementById("pagina");

  PAGINAS.forEach(([id, rot]) => {
    const b = C.el("button", { class: "aba", role: "tab", id: "aba-" + id, "aria-selected": "false", "aria-controls": "pagina", type: "button" }, rot);
    b.addEventListener("click", () => PB.ir(id));
    trilho.append(b);
  });
  trilho.addEventListener("keydown", (ev) => {
    if (!["ArrowLeft", "ArrowRight"].includes(ev.key)) return;
    const bts = [...trilho.children];
    const i = bts.indexOf(document.activeElement);
    if (i < 0) return;
    bts[(i + (ev.key === "ArrowRight" ? 1 : -1) + bts.length) % bts.length].focus();
    ev.preventDefault();
  });

  function render() {
    const { pagina, params } = PB.rota();
    const pg = PB.paginas[pagina] ? pagina : "inicio";
    [...trilho.children].forEach((b) => {
      const on = b.id === "aba-" + pg;
      b.setAttribute("aria-selected", on);
      b.tabIndex = on ? 0 : -1;
      if (on) b.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    PB.G.limpa();
    C.escondeDica();
    alvo.replaceChildren();
    const rot = PAGINAS.find((p) => p[0] === pg);
    document.title = (rot ? rot[1] + " · " : "") + "Panorama Brasil";
    try {
      PB.paginas[pg].montar(alvo, params);
    } catch (e) {
      console.error(e);
      alvo.append(C.vazio("Não foi possível montar esta tela: " + e.message));
    }
  }
  PB.rerender = render;
  window.addEventListener("hashchange", () => { render(); document.getElementById("conteudo").focus({ preventScroll: true }); window.scrollTo(0, 0); });

  document.getElementById("btn-tema").addEventListener("click", () => {
    const atual = document.documentElement.getAttribute("data-tema") || (matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro");
    const novo = atual === "escuro" ? "claro" : "escuro";
    document.documentElement.setAttribute("data-tema", novo);
    try { localStorage.setItem("pb-tema", novo); } catch (e) {}
    render();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!document.documentElement.getAttribute("data-tema")) render(); });
  document.getElementById("btn-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); PB.aviso("Link copiado com os filtros desta tela"); }
    catch (e) { PB.aviso("Copie o endereço da barra do navegador"); }
  });
  document.getElementById("rodape-gerado").textContent = "Dados consolidados em " + PB.D.gerado_em.split("-").reverse().join("/") + ". Painel local: os dados ficam no seu computador.";
  render();
})();

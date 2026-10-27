"""Teste de navegador do Panorama Brasil (Playwright + Chrome do sistema).

Abre todas as abas (e algumas variações de filtro), coleta erros de JavaScript,
verifica rolagem horizontal no celular e salva capturas em tests/capturas/.
Uso: python tests/e2e_navegador.py   (sobe o servidor Node sozinho)
"""
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
CAPT = RAIZ / "tests" / "capturas"
CAPT.mkdir(parents=True, exist_ok=True)
PORTA = 8093
ROTAS = [
    "inicio", "explorar", "explorar?ind=pib_per_capita&escala=quintis&forma=grade", "estados?uf=BA&cmp=SP", "regioes",
    "tendencias?ind=homicidios&locs=BR,NE,SE,CE,SP&modo=base100", "tendencias?ind=rendimento", "eleicoes?vista=historico&voto=governo&a=2014&b=2022", "eleicoes", "eleicoes?vista=historico", "eleicoes?vista=participacao&ano=2018&turno=1",
    "eleicoes?ano=2018&turno=1&mapa=12", "governadores?sel=2022-SP", "municipios", "municipios?uf=MG&x=urb", "municipios?ano=2022&turno=1&cand=12", "estados?voto=pt", "correlacoes",
    "correlacoes?ano=2014&metodo=spearman&x=analfabetismo&y=voto_pt_t2&retro=homicidios", "indice", "indice?preset=seguranca&metodo=z",
    "macro", "propostas", "propostas?ano=2022", "mandatos", "mandatos?m=bolsonaro&corr=desocupacao", "mandatos?m=lula1", "mandatos?m=temer", "propostas?ano=2014", "fontes",
]


def main():
    srv = subprocess.Popen(["node", "server.js", str(PORTA)], cwd=RAIZ, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    time.sleep(1.2)
    falhas = []
    try:
        with sync_playwright() as p:
            nav = p.chromium.launch(channel="chrome")
            for tema, vp, sufixo in [("claro", {"width": 1440, "height": 1000}, ""), ("escuro", {"width": 1440, "height": 1000}, "_escuro"), ("claro", {"width": 390, "height": 844}, "_celular"), ("escuro", {"width": 1920, "height": 1080}, "_largo")]:
                ctx = nav.new_context(viewport=vp, color_scheme="dark" if tema == "escuro" else "light")
                pg = ctx.new_page()
                # Registra a pilha da primeira vez que um atributo SVG recebe "NaN" (diagnóstico)
                pg.add_init_script(r"""(() => { window.__nan = []; const pa = Element.prototype.setAttribute; const NL = String.fromCharCode(10);
                  Element.prototype.setAttribute = function (n, v) { if (String(v).includes('NaN') && window.__nan.length < 1) {
                    window.__nan.push(n + '=' + v + ' | conectado=' + this.isConnected + ' | ' + new Error().stack.split(NL).slice(1, 14).map((x) => x.trim()).join(' <- ')); }
                    return pa.call(this, n, v); }; })();""")
                erros = []
                pg.on("pageerror", lambda e: erros.append(str(e)))
                pg.on("console", lambda m: erros.append(m.text) if m.type == "error" and "fonts.g" not in m.text else None)
                rotas = ROTAS if sufixo != "_escuro" else ["inicio", "explorar", "eleicoes", "correlacoes", "municipios", "governadores"]
                if sufixo == "_celular":
                    rotas = ["inicio", "explorar", "eleicoes", "estados", "correlacoes", "propostas", "mandatos?m=lula1"]
                if sufixo == "_largo":
                    rotas = ["inicio", "explorar", "eleicoes", "propostas?ano=2022", "mandatos"]
                for r in rotas:
                    erros.clear()
                    pg.goto(f"http://127.0.0.1:{PORTA}/#/{r}")
                    pg.wait_for_timeout(2500 if r.startswith("municipios") else 1200)
                    vazio = pg.locator("#pagina .vazio").all_inner_texts()
                    larg = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                    nome = r.replace("?", "_").replace("&", "_").replace("=", "-").replace(",", "")[:80] + sufixo
                    status = "OK"
                    erros_antes_captura = list(erros)
                    pg.screenshot(path=str(CAPT / f"{nome}.png"), full_page=True)
                    # A captura de página inteira redimensiona a página; erros de SVG do ApexCharts
                    # que surgem só nesse momento são registrados à parte (não acontecem no uso normal).
                    so_captura = [e for e in erros if e not in erros_antes_captura]
                    erros[:] = erros_antes_captura
                    if so_captura:
                        status = "OK*"
                    if erros:
                        status = "ERRO JS"
                        falhas.append((nome, erros[:3]))
                    # cada controle segmentado precisa ter exatamente uma opção marcada (aria-checked="true")
                    sem_marca = pg.evaluate("""[...document.querySelectorAll('.segmentado')].filter(g => g.querySelectorAll('[aria-checked="true"]').length !== 1).map(g => g.getAttribute('aria-label'))""")
                    if sem_marca:
                        status = "SEM SELEÇÃO"
                        falhas.append((nome, ["controle sem opção marcada: " + ", ".join(sem_marca)]))
                    if pg.locator("#pagina .cartao").count() == 0:
                        status = "SEM CONTEÚDO"
                        falhas.append((nome, ["a aba terminou sem nenhum cartão"]))
                    if sufixo == "_celular" and larg > 2:
                        status += f" | rolagem horizontal {larg}px"
                        falhas.append((nome, [f"rolagem horizontal {larg}px"]))
                    print(f"{status:10s} {nome}" + (f"  vazios: {vazio[:2]}" if vazio else ""))
                    for e in erros[:3]:
                        print("    ", e[:300])
                    if erros:
                        print("     PILHA:", pg.evaluate("window.__nan")[:1])
                    pg.evaluate("window.__nan = []")
                ctx.close()
            nav.close()
    finally:
        srv.terminate()
    print("\nFALHAS:", len(falhas))
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()

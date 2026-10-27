"""Coleta do DataSUS via TabNet (SIM - mortalidade; SINASC - nascidos vivos), por UF de residência e ano.

Fonte oficial: tabnet.datasus.gov.br (Ministério da Saúde). A consulta é a mesma que se faz
no formulário do site: o script lê o formulário (.def), mantém "Todas as categorias" em
todos os filtros e só aplica os filtros listados em CONSULTAS (escolhidos pelo rótulo).

Definições:
  homicídios = CID-10 X85-Y09 (Agressões) + Y35-Y36 (Intervenções legais), como no Atlas da Violência
  suicídios  = X60-X84 (Lesões autoprovocadas intencionalmente)
  trânsito   = CID-BR-10 104 (Acidentes de transporte, V01-V99)

Saída: data/processed/datasus_uf.csv  (serie, uf_cod, ano, valor)
"""
import csv
import html
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "data" / "processed"
BASE = "http://tabnet.datasus.gov.br/cgi"
UA = {"User-Agent": "Mozilla/5.0 (panorama-brasil; dados abertos)"}
ANOS = range(2002, 2025)

SIM = ("sim/cnv/obt10uf.def", "Ano_do_Óbito", "obtuf{aa}.dbf")
SINASC = ("sinasc/cnv/nvuf.def", "Ano_do_nascimento", "nvuf{aa}.dbf")

# serie: (sistema, {select: [rótulos que devem ser marcados (prefixo)]})
CONSULTAS = {
    "obitos_total": (SIM, {}),
    "obitos_infantis": (SIM, {"SFaixa_Etária": ["Menor 1 ano"]}),
    "homicidios": (SIM, {"SGrupo_CID-10": ["Agressões", "Intervenções legais"]}),
    "homicidios_mulheres": (SIM, {"SGrupo_CID-10": ["Agressões", "Intervenções legais"], "SSexo": ["Fem"]}),
    "homicidios_jovens": (SIM, {"SGrupo_CID-10": ["Agressões", "Intervenções legais"], "SFaixa_Etária": ["15 a 19", "20 a 29"]}),
    "suicidios": (SIM, {"SGrupo_CID-10": ["Lesões autoprovocadas intencionalmente"]}),
    "obitos_transito": (SIM, {"SCausa_-_CID-BR-10": [". 104 Acidentes de transporte"]}),
    "nascidos_vivos": (SINASC, {}),
    "nascidos_maes_adolescentes": (SINASC, {"SIdade_da_mãe": ["10 a 14", "15 a 19"]}),
    "nascidos_cesarea": (SINASC, {"STipo_de_parto": ["Cesário"]}),
    "nascidos_prenatal_7mais": (SINASC, {"SConsult_pré-natal": ["7 e mais", "7 ou mais"]}),
}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def abrir(url, data=None):
    for t in range(5):
        try:
            req = urllib.request.Request(url, data=data, headers={**UA, "Content-Type": "application/x-www-form-urlencoded"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read().decode("latin-1")
        except Exception:
            if t == 4:
                raise
            time.sleep(5 * (t + 1))


_FORMS = {}


def formulario(defi):
    if defi not in _FORMS:
        t = abrir(f"{BASE}/deftohtm.exe?{defi}")
        selects = {}
        for m in re.finditer(r'<select([^>]*)>(.*?)</select>', t, re.I | re.S):
            nome = re.search(r'NAME="([^"]*)"', m.group(1), re.I)
            if not nome or not nome.group(1).startswith("S"):
                continue
            ops = [(v, html.unescape(lbl).strip()) for v, lbl in
                   re.findall(r'<option\s+VALUE="([^"]*)"[^>]*>([^<]*)', m.group(2), re.I)]
            selects[nome.group(1)] = ops
        _FORMS[defi] = selects
    return _FORMS[defi]


def consultar(sistema, filtros):
    defi, coluna, padrao_arq = sistema
    selects = formulario(defi)
    campos = [("Linha", "Unidade_da_Federação"), ("Coluna", coluna), ("Incremento", None)]
    incremento = "Óbitos_p/Residênc" if "sim/" in defi else "Nascim_p/resid.mãe"
    campos[2] = ("Incremento", incremento)
    campos += [("Arquivos", padrao_arq.format(aa=f"{a % 100:02d}")) for a in ANOS]
    for nome, ops in selects.items():
        if nome in filtros:
            marcados = [v for v, lbl in ops if any(lbl.startswith(p) for p in filtros[nome])]
            if not marcados:
                raise ValueError(f"nenhuma opção de {nome} casa com {filtros[nome]}")
            campos += [(nome, v) for v in marcados]
        else:
            campos.append((nome, "TODAS_AS_CATEGORIAS__"))
    campos += [("formato", "prn"), ("mostre", "Mostra")]
    corpo = urllib.parse.urlencode(campos, encoding="latin-1").encode("latin-1")
    t = abrir(f"{BASE}/tabcgi.exe?{defi}", corpo)
    m = re.search(r"<PRE>(.*?)</PRE>", t, re.S | re.I)
    if not m:
        raise RuntimeError("resposta sem tabela: " + re.sub(r"<[^>]+>", " ", t)[:300])
    linhas = [l for l in html.unescape(m.group(1)).splitlines() if l.strip()]
    cab = [c.strip('"') for c in linhas[0].split(";")]
    saida = []
    for l in linhas[1:]:
        cel = [c.strip('"') for c in l.split(";")]
        mcod = re.match(r"(\d\d) ", cel[0])
        if not mcod:
            continue  # linha Total
        for ano, val in zip(cab[1:], cel[1:]):
            if ano.isdigit():
                saida.append((mcod.group(1), int(ano), 0 if val in ("-", "") else int(val)))
    return saida


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    linhas = []
    for serie, (sistema, filtros) in CONSULTAS.items():
        try:
            dados = consultar(sistema, filtros)
            linhas += [(serie, uf, ano, v) for uf, ano, v in dados]
            log(serie, len(dados), "valores")
        except Exception as e:
            log("ERRO", serie, e)
    with open(SAIDA / "datasus_uf.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["serie", "uf_cod", "ano", "valor"])
        w.writerows(linhas)
    log("gravado datasus_uf.csv", len(linhas))


if __name__ == "__main__":
    main()

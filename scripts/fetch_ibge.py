"""Coleta de séries do IBGE (API de agregados v3 do SIDRA) para Brasil, Grandes Regiões, UFs e municípios.

Cada série tem o número da tabela e da variável conferidos nos metadados oficiais
(servicodados.ibge.gov.br/api/v3/agregados/{tabela}/metadados) em 27/10/2026.

Saída: data/processed/ibge_series.csv no formato longo
    serie, nivel (N1 Brasil | N2 Região | N3 UF | N6 município), cod, periodo, valor

Também baixa: localidades (UF, regiões, municípios) e malhas (UF e municípios).

Uso: python scripts/fetch_ibge.py [--sem-municipios]
"""
import argparse
import csv
import gzip
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "data" / "processed"
GEO = RAIZ / "data" / "geo"
API = "https://servicodados.ibge.gov.br/api/v3/agregados"
UA = {"User-Agent": "panorama-brasil/1.0 (uso pessoal, dados abertos)", "Accept-Encoding": "gzip"}

# serie_id: (tabela, variavel, classificacao, niveis, periodos | None=todos, descricao)
# classificacao: string no formato da API, ex. "2[6794]|58[2795]"
SERIES = {
    # População
    "pop_estimada": (6579, 9324, "", "N1|N2|N3|N6", None, "População residente estimada (IBGE, estimativas anuais)"),
    "pop_censo": (202, 93, "2[0]|1[0]", "N1|N2|N3|N6", ["2000", "2010"], "População residente, Censos 2000 e 2010"),
    "pop_urbana_censo": (202, 93, "2[0]|1[1]", "N1|N2|N3|N6", ["2000", "2010"], "População urbana, Censos 2000 e 2010"),
    "pop_censo2022": (9923, 93, "1[6795]", "N1|N2|N3|N6", None, "População residente, Censo 2022"),
    "pop_urbana2022": (9923, 93, "1[1]", "N1|N2|N3|N6", None, "População urbana, Censo 2022"),
    # Contas regionais e PIB dos municípios (2002-2023)
    "pib": (5938, 37, "", "N1|N2|N3|N6", None, "PIB a preços correntes (mil R$)"),
    "vab_total": (5938, 498, "", "N1|N2|N3", None, "VAB total (mil R$)"),
    "vab_agro": (5938, 513, "", "N1|N2|N3|N6", None, "VAB agropecuária (mil R$)"),
    "vab_industria": (5938, 517, "", "N1|N2|N3|N6", None, "VAB indústria (mil R$)"),
    "vab_servicos": (5938, 6575, "", "N1|N2|N3", None, "VAB serviços exceto adm. pública (mil R$)"),
    "vab_adm_publica": (5938, 525, "", "N1|N2|N3|N6", None, "VAB administração pública (mil R$)"),
    # PNAD Contínua trimestral (2012T1 em diante)
    "desocupacao_tri": (4099, 4099, "", "N1|N2|N3", None, "Taxa de desocupação (%), trimestral"),
    "subutilizacao_tri": (4099, 4118, "", "N1|N2|N3", None, "Taxa composta de subutilização (%), trimestral"),
    "rendimento_tri": (5436, 5932, "", "N1|N2|N3", None, "Rendimento médio mensal real habitual do trabalho (R$), trimestral"),
    # PNAD Contínua anual
    "informalidade": (4708, 12466, "", "N1|N2|N3", None, "Taxa de informalidade (%)"),
    "gini": (7435, 10681, "", "N1|N2|N3", None, "Índice de Gini do rendimento domiciliar per capita"),
    "analfabetismo": (7113, 10267, "2[6794]|58[2795]", "N1|N2|N3", None, "Taxa de analfabetismo 15+ (%)"),
    # Pobreza: três indicadores ODS do IBGE. As linhas (valores em PPC) são definidas na
    # plataforma ODS; aqui se usa o nome oficial do indicador, sem converter para dólares.
    "extrema_pobreza": (5817, 9617, "", "N1|N2|N3", None, "% abaixo da linha de pobreza internacional (ODS 1.1.1)"),
    "pobreza": (5877, 9948, "", "N1|N2|N3", None, "% abaixo da linha de pobreza nacional (ODS 1.2.1)"),
    "pobreza_regional": (10660, 14137, "", "N1|N2|N3", None, "% abaixo da linha de pobreza regional (ODS P1.1.1)"),
    # Empresas (CEMPRE, 2006-2021)
    "empresas": (1685, 367, "", "N1|N2|N3", None, "Empresas e outras organizações atuantes"),
    "pessoal_ocupado": (1685, 707, "", "N1|N2|N3", None, "Pessoal ocupado total (CEMPRE)"),
    "salario_medio": (1685, 10143, "", "N1|N2|N3", None, "Salário médio mensal (R$, CEMPRE)"),
    # Projeção da População, revisão 2018 (valores projetados por ano)
    "esperanca_vida": (7362, 2503, "2[6794]|1933[all]", "N1|N2|N3", None, "Esperança de vida ao nascer (anos, projeção)"),
    "mortalidade_infantil_proj": (7362, 1940, "2[6794]|1933[all]", "N1|N2|N3", None, "Mortalidade infantil (‰, projeção)"),
    "fecundidade": (7360, 2493, "1933[all]", "N1|N2|N3", None, "Taxa de fecundidade total (filhos por mulher, projeção)"),
    "natalidade_proj": (7360, 10606, "1933[all]", "N1|N2|N3", None, "Taxa bruta de natalidade (‰, projeção)"),
    "mortalidade_proj": (7360, 10607, "1933[all]", "N1|N2|N3", None, "Taxa bruta de mortalidade (‰, projeção)"),
    "envelhecimento": (7360, 10612, "1933[all]", "N1|N2|N3", None, "Índice de envelhecimento (projeção)"),
    "idade_mediana": (7360, 10613, "1933[all]", "N1|N2|N3", None, "Idade mediana (anos, projeção)"),
    "dependencia": (7360, 10609, "1933[all]", "N1|N2|N3", None, "Razão de dependência total (%, projeção)"),
}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def get_json(url, tentativas=5):
    for t in range(tentativas):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
                b = r.read()
            if b[:2] == b"\x1f\x8b":
                b = gzip.decompress(b)
            return json.loads(b)
        except Exception as e:
            if t == tentativas - 1:
                raise RuntimeError(f"falhou: {url}: {e}") from e
            time.sleep(4 * (t + 1))


def periodos(tabela):
    return [p["id"] for p in get_json(f"{API}/{tabela}/periodos")]


def baixar_serie(sid, tabela, var, cls, niveis, pers):
    pers = pers or periodos(tabela)
    linhas = []
    for nivel in niveis.split("|"):
        # Municípios: um período por vez (resposta grande); demais: todos de uma vez
        lotes = [[p] for p in pers] if nivel == "N6" else [pers]
        for lote in lotes:
            q = {"localidades": f"{nivel}[all]"}
            if cls:
                q["classificacao"] = cls
            url = f"{API}/{tabela}/periodos/{'|'.join(lote)}/variaveis/{var}?" + urllib.parse.urlencode(q, safe="[]|")
            dados = get_json(url)
            for res in dados[0]["resultados"]:
                # Projeções: o "ano" vem na classificação 1933, não no período
                ano_cls = None
                for c in res["classificacoes"]:
                    if c["id"] == "1933":
                        ano_cls = list(c["categoria"].values())[0]
                for s in res["series"]:
                    cod = s["localidade"]["id"]
                    for per, val in s["serie"].items():
                        if val in (None, "", "-", "...", "..", "X"):
                            continue
                        linhas.append((sid, nivel, cod, ano_cls or per, val))
        log(sid, nivel, "ok")
    return linhas


def baixar_geo():
    GEO.mkdir(parents=True, exist_ok=True)
    alvos = {
        "uf.json": "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&intrarregiao=UF&qualidade=minima",
        "municipios.topo.json": "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/json&intrarregiao=municipio&qualidade=minima",
        "localidades_municipios.json": "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado",
        "localidades_ufs.json": "https://servicodados.ibge.gov.br/api/v1/localidades/estados?view=nivelado",
    }
    for nome, url in alvos.items():
        destino = GEO / nome
        if destino.exists():
            continue
        d = get_json(url)
        destino.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        log("geo", nome, destino.stat().st_size // 1024, "KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sem-municipios", action="store_true")
    ap.add_argument("--series", nargs="*")
    args = ap.parse_args()
    SAIDA.mkdir(parents=True, exist_ok=True)
    baixar_geo()
    arq = SAIDA / "ibge_series.csv"
    existentes = []
    if args.series and arq.exists():
        with open(arq, encoding="utf-8") as f:
            existentes = [tuple(r) for r in csv.reader(f)][1:]
        existentes = [r for r in existentes if r[0] not in args.series]
    linhas = list(existentes)
    for sid, (tab, var, cls, niveis, pers, _desc) in SERIES.items():
        if args.series and sid not in args.series:
            continue
        if args.sem_municipios:
            niveis = "|".join(n for n in niveis.split("|") if n != "N6")
        try:
            linhas += baixar_serie(sid, tab, var, cls, niveis, pers)
        except Exception as e:
            log("ERRO", sid, e)
    with open(arq, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["serie", "nivel", "cod", "periodo", "valor"])
        w.writerows(linhas)
    log("gravado", arq.name, len(linhas), "linhas")
    (SAIDA / "ibge_series_meta.json").write_text(json.dumps(
        {k: {"tabela": v[0], "variavel": v[1], "classificacao": v[2], "descricao": v[5]} for k, v in SERIES.items()},
        ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

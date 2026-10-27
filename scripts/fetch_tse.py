"""Coleta de resultados eleitorais do TSE (presidente e governador), 2002-2026.

Fontes oficiais:
  - Dados abertos do TSE (cdn.tse.jus.br/estatistica/sead/odsele):
      votacao_candidato_munzona_{ano}.zip  -> votos por candidato, município e zona
      detalhe_votacao_munzona_{ano}.zip    -> eleitorado, comparecimento, brancos, nulos
  - Arquivos de divulgação do TSE (resultados.tse.jus.br/oficial/ele2026) para o
    2º turno de 2026, ainda não publicado nos dados abertos na data da coleta.

Os ZIPs são lidos por HTTP Range: só os CSVs necessários são baixados, em streaming,
sem gravar o ZIP em disco.

Saídas em data/processed/:
  tse_presidente_uf.csv, tse_presidente_mun.csv, tse_governador_uf.csv,
  tse_comparecimento_uf.csv, tse_comparecimento_mun.csv, tse_municipios.csv

Uso:  python scripts/fetch_tse.py [--anos 2002 2006 ...] [--sem-governador]
"""
import argparse
import csv
import io
import json
import sys
import time
import urllib.request
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from httpzip import UA, BufferedHttp  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "data" / "processed"
CACHE = RAIZ / "data" / "cache" / "tse"
ODSELE = "https://cdn.tse.jus.br/estatistica/sead/odsele"
DIVULGA = "https://resultados.tse.jus.br/oficial/ele2026"
ANOS = [2002, 2006, 2010, 2014, 2018, 2022, 2026]
UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB",
       "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]
# Códigos de eleição usados pelo TSE na divulgação de 2026 (2º turno)
ELE_2026_T2_FEDERAL = "6258"
ELE_2026_T2_ESTADUAL = "6260"


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def inteiro(s):
    try:
        return int(str(s).strip().strip('"') or 0)
    except ValueError:
        return 0


def ler_csv_zip(zf, nome, filtro_texto=None):
    """Gera dicionários de um CSV do TSE dentro do ZIP (latin-1, ';').

    filtro_texto: se informado, só faz o parse das linhas que contêm o texto (acelera muito).
    """
    with zf.open(nome) as f:
        txt = io.TextIOWrapper(f, encoding="latin-1", newline="")
        cab = next(csv.reader([txt.readline()], delimiter=";"))
        for linha in txt:
            if filtro_texto and filtro_texto not in linha:
                continue
            valores = next(csv.reader([linha], delimiter=";"))
            yield dict(zip(cab, valores))


def votos_validos(r):
    """Votos válidos do candidato: a partir de 2022 o TSE publica a coluna; antes, só os nominais."""
    if "QT_VOTOS_NOMINAIS_VALIDOS" in r:
        return inteiro(r["QT_VOTOS_NOMINAIS_VALIDOS"])
    return inteiro(r["QT_VOTOS_NOMINAIS"])


def coletar_candidatos(ano, com_governador=True):
    url = f"{ODSELE}/votacao_candidato_munzona/votacao_candidato_munzona_{ano}.zip"
    zf = zipfile.ZipFile(BufferedHttp(url))
    nomes = {i.filename for i in zf.infolist()}
    pres_uf = defaultdict(int)
    pres_mun = defaultdict(int)
    cand_info = {}
    log(ano, "presidente: lendo _BR.csv")
    for r in ler_csv_zip(zf, f"votacao_candidato_munzona_{ano}_BR.csv"):
        if r["CD_CARGO"].strip('"') != "1" or r["CD_TIPO_ELEICAO"].strip('"') != "2":
            continue
        turno = inteiro(r["NR_TURNO"])
        nr = r["NR_CANDIDATO"]
        v = votos_validos(r)
        uf = r["SG_UF"]
        pres_uf[(ano, turno, uf, nr)] += v
        pres_mun[(ano, turno, uf, r["CD_MUNICIPIO"].zfill(5), nr)] += v
        cand_info[(ano, 1, nr)] = (r["NM_URNA_CANDIDATO"], r["SG_PARTIDO"], r["DS_SIT_TOT_TURNO"] if turno == 2 or ano == 2026 else None)
    gov = defaultdict(int)
    gov_info = {}
    if com_governador:
        for uf in UFS:
            nome = f"votacao_candidato_munzona_{ano}_{uf}.csv"
            if nome not in nomes:
                log(ano, "sem arquivo", nome)
                continue
            t0 = time.time()
            for r in ler_csv_zip(zf, nome, filtro_texto='"Governador"'):
                if r["CD_CARGO"].strip('"') != "3" or r["CD_TIPO_ELEICAO"].strip('"') != "2":
                    continue
                turno = inteiro(r["NR_TURNO"])
                nr = r["NR_CANDIDATO"]
                gov[(ano, turno, uf, nr)] += votos_validos(r)
                chave = (ano, turno, uf, nr)
                gov_info[chave] = (r["NM_URNA_CANDIDATO"], r["SG_PARTIDO"], r["DS_SIT_TOT_TURNO"],
                                   r.get("DS_DETALHE_SITUACAO_CAND", ""))
            log(ano, "governador", uf, f"{time.time() - t0:.0f}s")
    return pres_uf, pres_mun, cand_info, gov, gov_info


def coletar_detalhe(ano):
    url = f"{ODSELE}/detalhe_votacao_munzona/detalhe_votacao_munzona_{ano}.zip"
    zf = zipfile.ZipFile(BufferedHttp(url))
    nome = next((i.filename for i in zf.infolist() if i.filename.endswith("_BRASIL.csv")), None)
    arquivos = [nome] if nome else [i.filename for i in zf.infolist() if i.filename.endswith(".csv")]
    campos = ["QT_APTOS", "QT_COMPARECIMENTO", "QT_ABSTENCOES", "QT_VOTOS_BRANCOS", "QT_TOTAL_VOTOS_NULOS",
              "QT_TOTAL_VOTOS_VALIDOS"]
    uf_ag = defaultdict(lambda: [0] * 6)
    mun_ag = defaultdict(lambda: [0] * 6)
    for arq in arquivos:
        for r in ler_csv_zip(zf, arq):
            cargo = r["CD_CARGO"].strip('"')
            if cargo not in ("1", "3") or r["CD_TIPO_ELEICAO"].strip('"') != "2":
                continue
            turno = inteiro(r["NR_TURNO"])
            vals = [inteiro(r.get(c, 0)) for c in campos]
            k = (ano, turno, cargo, r["SG_UF"])
            for i, x in enumerate(vals):
                uf_ag[k][i] += x
            if cargo == "1":
                km = (ano, turno, r["SG_UF"], r["CD_MUNICIPIO"].zfill(5))
                for i, x in enumerate(vals):
                    mun_ag[km][i] += x
    log(ano, "detalhe ok", len(uf_ag), "chaves UF")
    return uf_ag, mun_ag


def get_json(url):
    req = urllib.request.Request(url, headers={**UA, "Accept-Encoding": "identity"})
    for t in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(2 * (t + 1))
        except Exception:
            time.sleep(2 * (t + 1))
    return None


def candidatos_divulga(d, cargo):
    """Extrai (nr, nome, partido, votos, situação) de um arquivo -u.json da divulgação."""
    saida = []
    for c in d.get("carg", []):
        if c["cd"] != cargo:
            continue
        for agr in c.get("agr", []):
            for par in agr.get("par", []):
                for cand in par.get("cand", []):
                    saida.append((cand["n"], cand["nmu"], par["sg"], inteiro(cand["vap"]), cand.get("st", "")))
    return saida


def totais_divulga(d):
    e, v = d["e"], d["v"]
    return [inteiro(e["te"]), inteiro(e["c"]), inteiro(e["a"]), inteiro(v["vb"]), inteiro(v["tvn"]), inteiro(v["vv"])]


def coletar_2026_t2():
    """2º turno de 2026 a partir dos arquivos de divulgação (resultado 100% totalizado)."""
    pres_uf, pres_mun, gov, gov_info, info = defaultdict(int), defaultdict(int), defaultdict(int), {}, {}
    comp_uf, comp_mun = {}, {}
    cm = get_json(f"{DIVULGA}/{ELE_2026_T2_FEDERAL}/config/mun-e{ELE_2026_T2_FEDERAL.zfill(6)}-cm.json")
    municipios = [(a["cd"].upper(), m["cd"]) for a in cm["abr"] for m in a["mu"]]
    log("2026 T2: config com", len(municipios), "municípios")
    for uf in UFS + ["ZZ"]:
        d = get_json(f"{DIVULGA}/{ELE_2026_T2_FEDERAL}/dados/{uf.lower()}/{uf.lower()}-c0001-e00{ELE_2026_T2_FEDERAL}-u.json")
        if not d:
            continue
        for nr, nome, partido, votos, st in candidatos_divulga(d, "1"):
            pres_uf[(2026, 2, uf, nr)] += votos
            info[(2026, 2, nr)] = (nome, partido, st)
        comp_uf[(2026, 2, "1", uf)] = totais_divulga(d)
        if uf != "ZZ":
            g = get_json(f"{DIVULGA}/{ELE_2026_T2_ESTADUAL}/dados/{uf.lower()}/{uf.lower()}-c0003-e00{ELE_2026_T2_ESTADUAL}-u.json")
            if g:
                for nr, nome, partido, votos, st in candidatos_divulga(g, "3"):
                    gov[(2026, 2, uf, nr)] += votos
                    gov_info[(2026, 2, uf, nr)] = (nome, partido, st, "")
                comp_uf[(2026, 2, "3", uf)] = totais_divulga(g)

    def baixar_mun(par):
        uf, cd = par
        return par, get_json(f"{DIVULGA}/{ELE_2026_T2_FEDERAL}/dados/{uf.lower()}/{uf.lower()}{cd}-c0001-e00{ELE_2026_T2_FEDERAL}-u.json")

    with ThreadPoolExecutor(max_workers=8) as ex:
        for i, ((uf, cd), d) in enumerate(ex.map(baixar_mun, municipios)):
            if d:
                for nr, _, _, votos, _ in candidatos_divulga(d, "1"):
                    pres_mun[(2026, 2, uf, cd, nr)] += votos
                comp_mun[(2026, 2, uf, cd)] = totais_divulga(d)
            if i % 1000 == 0:
                log("2026 T2 municípios", i)
    municipios_cfg = [(a["cd"].upper(), m["cd"], m.get("cdi", ""), m["nm"]) for a in cm["abr"] for m in a["mu"]]
    return pres_uf, pres_mun, info, gov, gov_info, comp_uf, comp_mun, municipios_cfg


def gravar(nome, cab, linhas):
    caminho = SAIDA / nome
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(cab)
        w.writerows(linhas)
    log("gravado", caminho.name, len(linhas), "linhas")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--anos", nargs="*", type=int, default=ANOS)
    ap.add_argument("--sem-governador", action="store_true")
    args = ap.parse_args()
    SAIDA.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)

    for ano in args.anos:
        marcador = CACHE / f"ok_{ano}.json"
        if marcador.exists():
            log(ano, "já coletado (apague", marcador.name, "para refazer)")
            continue
        pres_uf, pres_mun, info, gov, gov_info = coletar_candidatos(ano, not args.sem_governador)
        comp_uf, comp_mun = coletar_detalhe(ano)
        parcial = {
            "pres_uf": [[*k, v] for k, v in pres_uf.items()],
            "pres_mun": [[*k, v] for k, v in pres_mun.items()],
            "info": [[*k, *v] for k, v in info.items()],
            "gov": [[*k, v, *gov_info[k]] for k, v in gov.items()],
            "comp_uf": [[*k, *v] for k, v in comp_uf.items()],
            "comp_mun": [[*k, *v] for k, v in comp_mun.items()],
        }
        if ano == 2026:
            p2, m2, i2, g2, gi2, cu2, cm2, cfg = coletar_2026_t2()
            parcial["pres_uf"] += [[*k, v] for k, v in p2.items()]
            parcial["pres_mun"] += [[*k, v] for k, v in m2.items()]
            parcial["info"] += [[*k, *v] for k, v in i2.items()]
            parcial["gov"] += [[*k, v, *gi2[k]] for k, v in g2.items()]
            parcial["comp_uf"] += [[*k, *v] for k, v in cu2.items()]
            parcial["comp_mun"] += [[*k, *v] for k, v in cm2.items()]
            parcial["municipios"] = cfg
        marcador.write_text(json.dumps(parcial, ensure_ascii=False), encoding="utf-8")
        log(ano, "concluído")

    consolidar()


def consolidar():
    """Junta os parciais de cada ano nos CSVs finais."""
    pres_uf, pres_mun, gov, comp_uf, comp_mun, info, municipios = [], [], [], [], [], {}, []
    for ano in ANOS:
        arq = CACHE / f"ok_{ano}.json"
        if not arq.exists():
            continue
        p = json.loads(arq.read_text(encoding="utf-8"))
        for a, t, nr, nome, partido, st in p["info"]:
            info[(a, nr)] = (nome, partido)
        pres_uf += p["pres_uf"]
        pres_mun += p["pres_mun"]
        gov += p["gov"]
        comp_uf += p["comp_uf"]
        comp_mun += p["comp_mun"]
        municipios = p.get("municipios", municipios)
    gravar("tse_presidente_uf.csv", ["ano", "turno", "uf", "numero", "candidato", "partido", "votos"],
           sorted([a, t, uf, nr, *info.get((a, nr), ("", "")), v] for a, t, uf, nr, v in pres_uf))
    gravar("tse_presidente_mun.csv", ["ano", "turno", "uf", "cd_tse", "numero", "votos"], sorted(pres_mun))
    gravar("tse_governador_uf.csv", ["ano", "turno", "uf", "numero", "votos", "candidato", "partido", "situacao", "detalhe_candidatura"],
           sorted(gov))
    gravar("tse_comparecimento_uf.csv", ["ano", "turno", "cargo", "uf", "aptos", "comparecimento", "abstencao", "brancos", "nulos", "validos"],
           sorted(comp_uf))
    gravar("tse_comparecimento_mun.csv", ["ano", "turno", "uf", "cd_tse", "aptos", "comparecimento", "abstencao", "brancos", "nulos", "validos"],
           sorted(comp_mun))
    if municipios:
        gravar("tse_municipios.csv", ["uf", "cd_tse", "cd_ibge", "nome"], sorted(municipios))


if __name__ == "__main__":
    main()

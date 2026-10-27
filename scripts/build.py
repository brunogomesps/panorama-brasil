"""Monta os dados do painel a partir de data/processed e grava os arquivos em web/data/.

Saídas (carregadas por <script>, funcionam abrindo o index.html direto, sem servidor):
  web/data/painel.js      window.PB_DADOS  (indicadores por Brasil/região/UF, eleições, macro, catálogo)
  web/data/municipios.js  window.PB_MUN    (municípios: socioeconomia + voto)
  web/data/geo.js         window.PB_GEO    (malhas do IBGE: UFs em GeoJSON e municípios em TopoJSON)
  web/data/propostas.js   window.PB_PROPOSTAS (se data/manual/propostas.json existir)

Uso: python scripts/build.py
"""
import csv
import json
import math
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PROC = RAIZ / "data" / "processed"
GEO = RAIZ / "data" / "geo"
MANUAL = RAIZ / "data" / "manual"
WEB = RAIZ / "web" / "data"

ANO_INI, ANO_FIM = 2002, 2026
ANOS_ELEICAO = [2002, 2006, 2010, 2014, 2018, 2022, 2026]
# Sudeste usa "SD" (e não "SE") para não colidir com a sigla de Sergipe
REG_SIGLA = {"1": "N", "2": "NE", "3": "SD", "4": "S", "5": "CO"}
REG_NOME = {"N": "Norte", "NE": "Nordeste", "SD": "Sudeste", "S": "Sul", "CO": "Centro-Oeste"}

# Cartograma em grade (coluna, linha): todos os estados com o mesmo tamanho
GRADE = {
    "RR": (2, 0), "AP": (4, 0),
    "AM": (1, 1), "PA": (3, 1), "MA": (4, 1), "CE": (5, 1), "RN": (6, 1),
    "AC": (0, 2), "RO": (1, 2), "MT": (2, 2), "TO": (3, 2), "PI": (4, 2), "PE": (5, 2), "PB": (6, 2),
    "GO": (2, 3), "DF": (3, 3), "BA": (4, 3), "SE": (5, 3), "AL": (6, 3),
    "MS": (2, 4), "MG": (3, 4), "ES": (4, 4),
    "PR": (2, 5), "SP": (3, 5), "RJ": (4, 5),
    "SC": (2, 6),
    "RS": (2, 7),
}

# Classificação editorial de espectro (a mesma lógica usada pela Cubo Três, ampliada com siglas antigas).
ESQUERDA = {"PT", "PCDOB", "PC DO B", "PV", "PSOL", "REDE", "PSB", "PDT", "PCB", "PSTU", "UP", "PCO"}
DIREITA = {"PL", "PR", "REPUBLICANOS", "PRB", "NOVO", "PP", "PPB", "UNIÃO", "UNIAO", "PSC", "PRTB", "PTB",
           "PATRIOTA", "PATRI", "DC", "AGIR", "PODE", "PSL", "DEM", "PFL", "PRONA"}


def espectro(partido):
    p = (partido or "").upper().replace("*", "").strip()
    if p in ESQUERDA:
        return "esquerda"
    if p in DIREITA:
        return "direita"
    return "centro/outros"


def ler(nome):
    with open(PROC / nome, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def num(x):
    try:
        return float(str(x).replace(",", "."))
    except (TypeError, ValueError):
        return None


def r(x, casas=2):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(x, casas)


# ---------------------------------------------------------------------------
# Localidades
# ---------------------------------------------------------------------------
ufs_raw = json.loads((GEO / "localidades_ufs.json").read_text(encoding="utf-8"))
UFS = sorted(ufs_raw, key=lambda u: u["UF-id"])
COD2UF = {str(u["UF-id"]): u["UF-sigla"] for u in UFS}
UF2REG = {u["UF-sigla"]: REG_SIGLA[str(u["regiao-id"])] for u in UFS}
SIGLAS = [u["UF-sigla"] for u in UFS]
LOCAIS = ["BR"] + list(REG_NOME) + SIGLAS


def loc_de(nivel, cod):
    if nivel == "N1":
        return "BR"
    if nivel == "N2":
        return REG_SIGLA[cod]
    if nivel == "N3":
        return COD2UF[cod]
    return cod  # município: código IBGE


# ---------------------------------------------------------------------------
# Séries do IBGE em memória: S[serie][local][periodo] = valor
# ---------------------------------------------------------------------------
S = defaultdict(lambda: defaultdict(dict))
for row in ler("ibge_series.csv"):
    v = num(row["valor"])
    if v is None:
        continue
    S[row["serie"]][loc_de(row["nivel"], row["cod"])][row["periodo"]] = v

DS = defaultdict(lambda: defaultdict(dict))  # DataSUS: DS[serie][uf][ano]
for row in ler("datasus_uf.csv"):
    DS[row["serie"]][COD2UF[row["uf_cod"]]][int(row["ano"])] = int(row["valor"])

BCB = defaultdict(dict)
for row in ler("bcb_anual.csv"):
    BCB[row["serie"]][int(row["ano"])] = float(row["valor"])


def agrega_regioes(dados_uf, func="soma"):
    """Soma (ou outra função) os valores das UFs para regiões e Brasil: dados_uf[uf][ano]."""
    out = {k: dict(v) for k, v in dados_uf.items()}
    anos = sorted({a for v in dados_uf.values() for a in v})
    for reg in REG_NOME:
        membros = [u for u in SIGLAS if UF2REG[u] == reg]
        out[reg] = {a: sum(dados_uf[u][a] for u in membros) for a in anos if all(a in dados_uf.get(u, {}) for u in membros)}
    out["BR"] = {a: sum(dados_uf[u][a] for u in SIGLAS) for a in anos if all(a in dados_uf.get(u, {}) for u in SIGLAS)}
    return out


# ---------------------------------------------------------------------------
# População anual (estimativas + Censos; 2007 e 2023 interpolados)
# ---------------------------------------------------------------------------
POP = {}
POP_FLAG = {}  # (local, ano) -> 'censo' | 'interpolado'
todos_locais_pop = set(S["pop_estimada"]) | set(S["pop_censo"]) | set(S["pop_censo2022"])
for loc in todos_locais_pop:
    serie = {int(a): v for a, v in S["pop_estimada"].get(loc, {}).items()}
    for a, v in S["pop_censo"].get(loc, {}).items():
        serie[int(a)] = v
        POP_FLAG[(loc, int(a))] = "censo"
    for a, v in S["pop_censo2022"].get(loc, {}).items():
        serie[int(a)] = v
        POP_FLAG[(loc, int(a))] = "censo"
    # 2023 não tem estimativa: o IBGE usou a população do Censo 2022 no PIB per capita de 2023.
    if 2022 in serie and 2023 not in serie and POP_FLAG.get((loc, 2022)) == "censo":
        serie[2023] = serie[2022]
        POP_FLAG[(loc, 2023)] = "censo2022"
    for a in range(2000, ANO_FIM + 1):
        if a in serie:
            continue
        ant = max((x for x in serie if x < a), default=None)
        pos = min((x for x in serie if x > a), default=None)
        if ant and pos and serie[ant] > 0 and serie[pos] > 0:
            t = (a - ant) / (pos - ant)
            serie[a] = serie[ant] * (serie[pos] / serie[ant]) ** t  # interpolação geométrica
            POP_FLAG[(loc, a)] = "interpolado"
    POP[loc] = serie


def pop(loc, ano):
    return POP.get(loc, {}).get(ano)


# ---------------------------------------------------------------------------
# Catálogo de indicadores (com polaridade) e valores
# ---------------------------------------------------------------------------
IND = []   # catálogo
VAL = {}   # VAL[id][local][ano] = valor


def add(id_, nome, tema, unidade, polaridade, porque, fonte, valores, casas=2, curto=None, descricao="", formato="num", nota=""):
    """polaridade: 'maior' (maior é melhor), 'menor' (menor é melhor) ou 'neutro'."""
    limpos = {}
    for loc, serie in valores.items():
        s = {str(a): r(v, casas) for a, v in serie.items() if v is not None and ANO_INI <= int(a) <= ANO_FIM}
        if s:
            limpos[loc] = s
    if not limpos:
        print("  (sem dados)", id_)
        return
    anos = sorted({int(a) for s in limpos.values() for a in s})
    IND.append({"id": id_, "nome": nome, "curto": curto or nome, "tema": tema, "unidade": unidade,
                "polaridade": polaridade, "porque": porque, "fonte": fonte, "casas": casas,
                "formato": formato, "descricao": descricao, "nota": nota,
                "anos": [anos[0], anos[-1]], "n_anos": len(anos)})
    VAL[id_] = limpos


def ibge_anual(serie, conv=lambda v: v):
    return {loc: {int(a): conv(v) for a, v in s.items()} for loc, s in S[serie].items() if loc in LOCAIS}


def media_trimestral(serie):
    out = {}
    for loc, s in S[serie].items():
        if loc not in LOCAIS:
            continue
        por_ano = defaultdict(list)
        for per, v in s.items():
            por_ano[int(per[:4])].append(v)
        # média anual com pelo menos 3 trimestres (o rendimento não tem 2020-T2 a 2022-T1)
        out[loc] = {a: sum(v) / len(v) for a, v in por_ano.items() if len(v) >= 3}
    return out


def razao(num_d, den_func, fator=1.0):
    out = {}
    for loc, s in num_d.items():
        out[loc] = {}
        for a, v in s.items():
            d = den_func(loc, a)
            if v is not None and d:
                out[loc][a] = v / d * fator
    return out


# --- População e demografia
add("populacao", "População", "População", "pessoas", "neutro",
    "Tamanho da população não é bom nem ruim por si; serve de base para as taxas.",
    "IBGE: estimativas anuais (tab. 6579) e Censos 2010 (tab. 202) e 2022 (tab. 9923)",
    {loc: s for loc, s in POP.items() if loc in LOCAIS}, 0, formato="int",
    nota="2007 não tem estimativa oficial (interpolação geométrica). 2023 repete o Censo 2022, como o IBGE fez no PIB per capita de 2023. As estimativas de 2024 em diante usam nova metodologia (salto de 2023 para 2024).")
cresc = {}
for loc in LOCAIS:
    s = POP.get(loc, {})
    cresc[loc] = {a: (s[a] / s[a - 1] - 1) * 100 for a in s if a - 1 in s}
add("cresc_pop", "Crescimento da população", "População", "% a.a.", "neutro",
    "Crescimento populacional rápido ou lento não é, sozinho, bom ou ruim.",
    "Cálculo sobre a série de população do IBGE", cresc, 2,
    nota="Saltos em 2010 e 2022 refletem a troca de estimativa por Censo, não mudança real.")
urb = {}
for loc in LOCAIS:
    urb[loc] = {}
    for a in ("2000", "2010"):
        t, u = S["pop_censo"].get(loc, {}).get(a), S["pop_urbana_censo"].get(loc, {}).get(a)
        if t and u:
            urb[loc][int(a)] = u / t * 100
    t, u = S["pop_censo2022"].get(loc, {}).get("2022"), S["pop_urbana2022"].get(loc, {}).get("2022")
    if t and u:
        urb[loc][2022] = u / t * 100
add("urbanizacao", "Taxa de urbanização", "População", "%", "neutro",
    "Mostra onde as pessoas vivem; não há leitura de melhor ou pior.",
    "IBGE, Censos 2000, 2010 (tab. 202) e 2022 (tab. 9923)", urb, 1,
    nota="O Censo 2022 mudou o critério urbano/rural; compare 2022 com cautela.")
for sid, nome, pol, porque, casas in [
    ("esperanca_vida", "Esperança de vida ao nascer", "maior", "Viver mais é o resultado desejado.", 1),
    ("fecundidade", "Taxa de fecundidade total", "neutro", "Abaixo de 2,1 filhos por mulher a população tende a encolher; não há valor 'bom' universal.", 2),
    ("envelhecimento", "Índice de envelhecimento", "neutro", "Idosos por 100 jovens: reflete a transição demográfica, não desempenho.", 1),
    ("idade_mediana", "Idade mediana", "neutro", "Descreve a estrutura etária.", 1),
    ("dependencia", "Razão de dependência", "menor", "Menos dependentes por pessoa em idade ativa alivia a renda das famílias e as contas públicas.", 1),
]:
    add(sid, nome, "População", {"esperanca_vida": "anos", "fecundidade": "filhos por mulher", "idade_mediana": "anos"}.get(sid, "índice"),
        pol, porque, f"IBGE, Projeção da População, revisão 2018 (tab. {'7362' if sid == 'esperanca_vida' else '7360'})",
        ibge_anual(sid), casas, nota="Valores projetados pelo IBGE, não observados ano a ano.")

# --- Economia
pib = ibge_anual("pib", lambda v: v * 1000)  # mil R$ -> R$
add("pib", "PIB a preços correntes", "Economia", "R$", "maior",
    "Economia maior gera mais renda e arrecadação (em valores nominais, sem descontar a inflação).",
    "IBGE, Contas Regionais / PIB dos Municípios (tab. 5938)", pib, 0, formato="moeda_grande")
add("pib_per_capita", "PIB per capita", "Economia", "R$", "maior",
    "Mais produção por habitante indica mais renda potencial.",
    "IBGE (tab. 5938) ÷ população", razao(pib, pop), 0, formato="moeda")
pib_rel = {loc: {a: v / (pib["BR"][a] / pop("BR", a)) / (1) * 100 for a, v in razao(pib, pop)[loc].items() if a in pib["BR"]}
           for loc in pib}
add("pib_pc_relativo", "PIB per capita em relação ao Brasil", "Economia", "% do Brasil", "maior",
    "Acima de 100 = mais rico que a média nacional. Elimina o efeito da inflação na comparação entre anos.",
    "Cálculo sobre IBGE (tab. 5938)", pib_rel, 1)
part = {loc: {a: v / pib["BR"][a] * 100 for a, v in s.items() if a in pib["BR"]} for loc, s in pib.items()}
add("part_pib", "Participação no PIB do Brasil", "Economia", "%", "neutro",
    "Mede o peso econômico do lugar; ganhar participação é bom para o lugar, mas o indicador não é de bem-estar.",
    "Cálculo sobre IBGE (tab. 5938)", part, 2)
vt = ibge_anual("vab_total")
for sid, nome, porque in [
    ("vab_agro", "Peso da agropecuária no VAB", "Estrutura produtiva: não há composição 'certa'."),
    ("vab_industria", "Peso da indústria no VAB", "Estrutura produtiva: não há composição 'certa'."),
    ("vab_servicos", "Peso dos serviços no VAB", "Estrutura produtiva: não há composição 'certa'."),
    ("vab_adm_publica", "Peso da administração pública no VAB", "Peso alto indica economia dependente do setor público, mas não é desempenho."),
]:
    v = ibge_anual(sid)
    add(sid + "_pct", nome, "Economia", "% do VAB", "neutro", porque, "IBGE, Contas Regionais (tab. 5938)",
        {loc: {a: x / vt[loc][a] * 100 for a, x in s.items() if vt.get(loc, {}).get(a)} for loc, s in v.items()}, 1)
emp = ibge_anual("empresas")
add("empresas_mil_hab", "Empresas por mil habitantes", "Economia", "por mil hab.", "maior",
    "Mais empresas ativas por habitante indica economia formal mais densa.",
    "IBGE, CEMPRE (tab. 1685) ÷ população", razao(emp, pop, 1000), 1)
add("salario_medio", "Salário médio mensal (empresas formais)", "Trabalho e renda", "R$", "maior",
    "Salário maior significa mais renda do trabalho formal (valor nominal).",
    "IBGE, CEMPRE (tab. 1685)", ibge_anual("salario_medio"), 0, formato="moeda")

# --- Trabalho e renda
add("desocupacao", "Taxa de desocupação", "Trabalho e renda", "%", "menor",
    "Menos pessoas procurando trabalho sem conseguir.", "IBGE, PNAD Contínua (tab. 4099), média dos 4 trimestres",
    media_trimestral("desocupacao_tri"), 1,
    nota="Média simples dos 4 trimestres do ano. O IBGE divulga a média anual por outra conta (pode diferir em alguns décimos).")
add("subutilizacao", "Taxa de subutilização da força de trabalho", "Trabalho e renda", "%", "menor",
    "Inclui desocupados, quem trabalha menos horas do que gostaria e quem desistiu de procurar.",
    "IBGE, PNAD Contínua (tab. 4099), média dos 4 trimestres", media_trimestral("subutilizacao_tri"), 1)
add("rendimento", "Rendimento médio real do trabalho", "Trabalho e renda", "R$", "maior",
    "Renda maior do trabalho, já descontada a inflação.",
    "IBGE, PNAD Contínua (tab. 5436), média dos 4 trimestres", media_trimestral("rendimento_tri"), 0, formato="moeda",
    nota="Valores reais a preços do trimestre mais recente da PNAD. A tabela 5436 do IBGE não tem os trimestres de 2020-T2 a 2022-T1: 2020 e 2021 ficam sem dado e 2022 é a média de 3 trimestres.")
add("informalidade", "Taxa de informalidade", "Trabalho e renda", "%", "menor",
    "Trabalho informal costuma ter menos proteção (férias, previdência, FGTS).",
    "IBGE, PNAD Contínua (tab. 4708)", ibge_anual("informalidade"), 1)
add("gini", "Índice de Gini da renda", "Trabalho e renda", "índice (0 a 1)", "menor",
    "Mais perto de 0 = renda mais bem distribuída.", "IBGE, PNAD Contínua (tab. 7435)", ibge_anual("gini"), 3)
add("extrema_pobreza", "Extrema pobreza (linha internacional, ODS 1.1.1)", "Pobreza", "% da população", "menor",
    "Menos pessoas abaixo da linha de pobreza internacional.", "IBGE, ODS 1.1.1 (tab. 5817)", ibge_anual("extrema_pobreza"), 1,
    curto="Extrema pobreza")
add("pobreza", "Pobreza (linha nacional, ODS 1.2.1)", "Pobreza", "% da população", "menor",
    "Menos pessoas abaixo da linha de pobreza nacional.", "IBGE, ODS 1.2.1 (tab. 5877)", ibge_anual("pobreza"), 1,
    curto="Pobreza")
add("pobreza_regional", "Pobreza (linha regional, ODS P1.1.1)", "Pobreza", "% da população", "menor",
    "Menos pessoas abaixo da linha de pobreza regional.", "IBGE, ODS P1.1.1 (tab. 10660)", ibge_anual("pobreza_regional"), 1,
    curto="Pobreza (linha regional)")

# --- Educação
add("analfabetismo", "Taxa de analfabetismo (15 anos ou mais)", "Educação", "%", "menor",
    "Menos adultos sem saber ler e escrever.", "IBGE, PNAD Contínua Educação (tab. 7113)", ibge_anual("analfabetismo"), 1)

# --- Saúde e violência (DataSUS)
def ds_com_regioes(serie):
    return agrega_regioes({u: DS[serie][u] for u in SIGLAS})


nv = ds_com_regioes("nascidos_vivos")
for sid, nome, pol, porque, fator, den, unidade, casas in [
    ("homicidios", "Taxa de homicídios", "menor", "Menos mortes por agressão e intervenção legal.", 1e5, "pop", "por 100 mil hab.", 1),
    ("suicidios", "Taxa de suicídios", "menor", "Menos mortes por lesão autoprovocada.", 1e5, "pop", "por 100 mil hab.", 1),
    ("obitos_transito", "Taxa de mortes no trânsito", "menor", "Menos mortes em acidentes de transporte.", 1e5, "pop", "por 100 mil hab.", 1),
    ("obitos_total", "Taxa bruta de mortalidade", "neutro", "Depende muito da idade da população: lugares mais velhos têm taxa maior sem serem piores.", 1e3, "pop", "por mil hab.", 2),
    ("obitos_infantis", "Mortalidade infantil", "menor", "Menos bebês morrendo antes de 1 ano.", 1e3, "nv", "por mil nascidos vivos", 1),
    ("nascidos_vivos", "Taxa bruta de natalidade", "neutro", "Nascimentos por mil habitantes: descreve a demografia, não desempenho.", 1e3, "pop", "por mil hab.", 1),
    ("nascidos_maes_adolescentes", "Nascidos de mães adolescentes", "menor", "Gravidez na adolescência está ligada a evasão escolar e riscos de saúde.", 100, "nv", "% dos nascidos", 1),
    ("nascidos_cesarea", "Partos cesáreos", "menor", "A OMS considera que taxas muito acima de 10–15% não trazem benefício e aumentam riscos.", 100, "nv", "% dos nascidos", 1),
    ("nascidos_prenatal_7mais", "Pré-natal com 7 ou mais consultas", "maior", "Mais gestantes com pré-natal completo.", 100, "nv", "% dos nascidos", 1),
]:
    cont = ds_com_regioes(sid)
    if den == "pop":
        val = razao(cont, pop, fator)
    else:
        val = {loc: {a: v / nv[loc][a] * fator for a, v in s.items() if nv.get(loc, {}).get(a)} for loc, s in cont.items()}
    tema = "Violência" if sid in ("homicidios", "suicidios", "obitos_transito") else "Saúde"
    fonte = "Ministério da Saúde, SIM" if sid.startswith(("homicid", "suicid", "obitos")) else "Ministério da Saúde, SINASC"
    add(sid if sid not in ("nascidos_vivos", "obitos_total", "obitos_infantis") else
        {"nascidos_vivos": "natalidade", "obitos_total": "mortalidade_bruta", "obitos_infantis": "mortalidade_infantil"}[sid],
        nome, tema, unidade, pol, porque, fonte + " (TabNet), por residência" + (" ÷ população IBGE" if den == "pop" else ""), val, casas)
for sid, nome, pol, porque in [
    ("homicidios", "Homicídios (número)", "menor", "Menos vidas perdidas."),
    ("homicidios_mulheres", "Homicídios de mulheres (número)", "menor", "Menos mulheres assassinadas."),
    ("homicidios_jovens", "Homicídios de jovens de 15 a 29 anos (número)", "menor", "Menos jovens assassinados."),
]:
    add(sid + "_n", nome, "Violência", "óbitos", pol, porque, "Ministério da Saúde, SIM (TabNet): CID-10 X85–Y09 e Y35–Y36",
        ds_com_regioes(sid), 0, formato="int")

# ---------------------------------------------------------------------------
# Eleições
# ---------------------------------------------------------------------------
pres = ler("tse_presidente_uf.csv")
comp = ler("tse_comparecimento_uf.csv")
gov = ler("tse_governador_uf.csv")

votos = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))  # [ano][turno][loc][nr]
cand = defaultdict(dict)  # [ano][nr] = {nome, partido}
for row in pres:
    a, t, uf, nr, v = int(row["ano"]), int(row["turno"]), row["uf"], row["numero"], int(row["votos"])
    cand[a][nr] = {"nome": row["candidato"], "partido": row["partido"]}
    votos[a][t][uf][nr] += v
    votos[a][t]["BR"][nr] += v
    if uf in UF2REG:
        votos[a][t][UF2REG[uf]][nr] += v

compar = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0] * 6))))  # [cargo][ano][turno][loc]
for row in comp:
    a, t, cg, uf = int(row["ano"]), int(row["turno"]), row["cargo"], row["uf"]
    vals = [int(row[k]) for k in ("aptos", "comparecimento", "abstencao", "brancos", "nulos", "validos")]
    destinos = [uf, "BR"] + ([UF2REG[uf]] if uf in UF2REG else [])
    for d in destinos:
        acc = compar[cg][a][t][d]
        for i, x in enumerate(vals):
            acc[i] += x

eleicoes = {"anos": ANOS_ELEICAO, "presidente": {}, "comparecimento": {}, "governador": {}, "espectro": {}}
for a in ANOS_ELEICAO:
    eleicoes["presidente"][a] = {}
    for t in (1, 2):
        if t not in votos[a]:
            continue
        por_loc = {}
        for loc, vs in votos[a][t].items():
            if loc not in LOCAIS and loc != "ZZ":
                continue
            por_loc[loc] = dict(sorted(vs.items(), key=lambda kv: -kv[1]))
        nacionais = sorted(votos[a][t]["BR"].items(), key=lambda kv: -kv[1])
        tot = sum(v for _, v in nacionais)
        lista = [{"nr": nr, "nome": cand[a][nr]["nome"], "partido": cand[a][nr]["partido"], "votos": v,
                  "pct": r(v / tot * 100, 2), "espectro": espectro(cand[a][nr]["partido"])} for nr, v in nacionais]
        eleicoes["presidente"][a][t] = {"candidatos": lista, "votos": por_loc, "validos": tot}
        eleicoes["comparecimento"].setdefault(a, {})[t] = {
            loc: dict(zip(("aptos", "comparecimento", "abstencao", "brancos", "nulos", "validos"), vals))
            for loc, vals in compar["1"][a][t].items() if loc in LOCAIS or loc == "ZZ"}

# Governadores: votos por candidato e eleito em cada UF/ano
gv = defaultdict(lambda: defaultdict(dict))
for row in gov:
    a, t, uf = int(row["ano"]), int(row["turno"]), row["uf"]
    det = (row.get("detalhe_candidatura") or "").upper()
    eleito_flag = (row["situacao"] or "").upper().startswith("ELEITO")
    # O arquivo é regenerado depois da eleição: "RENÚNCIA" ou "CASSADO" podem ser fatos posteriores.
    # Só descarta candidatura barrada que não foi eleita (votos anulados).
    if not eleito_flag and any(k in det for k in ("INDEFERIDO", "CANCELADO", "NÃO CONHECIMENTO")):
        continue
    validos = compar["3"][a][t].get(uf, [0] * 6)[5] or None
    gv[a][uf].setdefault(t, []).append({
        "nr": row["numero"], "nome": row["candidato"], "partido": row["partido"].replace("*", ""),
        "votos": int(row["votos"]), "pct": r(int(row["votos"]) / validos * 100, 2) if validos else None,
        "eleito": (row["situacao"] or "").upper().startswith("ELEITO"), "espectro": espectro(row["partido"])})
for a in gv:
    eleicoes["governador"][a] = {}
    for uf, turnos in gv[a].items():
        for t in turnos:
            turnos[t].sort(key=lambda c: -c["votos"])
        final = turnos.get(2) or turnos.get(1)
        eleito = next((c for c in final if c["eleito"]), None)
        if eleito is None and final:  # 2º turno de 2026 vem da divulgação ("Eleito")
            eleito = final[0] if 2 in turnos else None
        eleicoes["governador"][a][uf] = {"turnos": {str(t): v[:6] for t, v in turnos.items()},
                                          "eleito": eleito, "segundo_turno": 2 in turnos}

# Indicadores eleitorais por local (ano = ano da eleição)
def ind_eleitoral(func):
    out = defaultdict(dict)
    for a in ANOS_ELEICAO:
        for loc in LOCAIS:
            try:
                v = func(a, loc)
            except (KeyError, ZeroDivisionError, TypeError):
                v = None
            if v is not None:
                out[loc][a] = v
    return out


def pct_pt(a, loc, t):
    vs = votos[a][t].get(loc)
    if not vs:
        return None
    return vs.get("13", 0) / sum(vs.values()) * 100


def margem(a, loc, t):
    vs = sorted(votos[a][t][loc].values(), reverse=True)
    return (vs[0] - vs[1]) / sum(vs) * 100


def nec(a, loc):
    vs = list(votos[a][1][loc].values())
    tot = sum(vs)
    return 1 / sum((v / tot) ** 2 for v in vs)


def taxa_comp(a, loc, i, den, t=1):
    c = compar["1"][a][t][loc]
    return c[i] / c[den] * 100 if c[den] else None


add("comparecimento", "Comparecimento (presidente, 1º turno)", "Eleições", "% do eleitorado", "maior",
    "Mais eleitores participando da escolha.", "TSE, dados abertos (detalhe da votação)", ind_eleitoral(lambda a, l: taxa_comp(a, l, 1, 0)), 1)
add("abstencao", "Abstenção (presidente, 1º turno)", "Eleições", "% do eleitorado", "menor",
    "Menos eleitores deixando de votar.", "TSE, dados abertos (detalhe da votação)", ind_eleitoral(lambda a, l: taxa_comp(a, l, 2, 0)), 1)
add("brancos_nulos", "Brancos e nulos (presidente, 1º turno)", "Eleições", "% dos votos", "neutro",
    "Voto branco ou nulo é uma escolha do eleitor: o painel não trata como bom ou ruim.",
    "TSE, dados abertos (detalhe da votação)",
    ind_eleitoral(lambda a, l: (compar["1"][a][1][l][3] + compar["1"][a][1][l][4]) / compar["1"][a][1][l][1] * 100), 1)
add("voto_pt_t1", "Votos do PT para presidente (1º turno)", "Eleições", "% dos válidos", "neutro",
    "Indicador político: não existe leitura de melhor ou pior.", "TSE, dados abertos", ind_eleitoral(lambda a, l: pct_pt(a, l, 1)), 2,
    descricao="Lula (2002, 2006, 2022, 2026), Dilma (2010, 2014) e Haddad (2018).")
add("voto_pt_t2", "Votos do PT para presidente (2º turno)", "Eleições", "% dos válidos", "neutro",
    "Indicador político: não existe leitura de melhor ou pior.", "TSE, dados abertos e divulgação (2026)",
    ind_eleitoral(lambda a, l: pct_pt(a, l, 2)), 2,
    descricao="O PT esteve em todos os 2º turnos de 2002 a 2026, o que permite comparar a mesma variável ao longo de 24 anos.")
# Medidas neutras de voto (não centradas num partido)
GOVERNO_T2 = {2002: "45", 2006: "13", 2010: "13", 2014: "13", 2018: None, 2022: "22", 2026: "13"}  # candidato do governo federal no 2º turno


def vencedor_nacional(a):
    t = 2 if 2 in votos[a] else 1
    return t, max(votos[a][t]["BR"].items(), key=lambda kv: kv[1])[0]


def pct_nr(a, loc, t, nr):
    vs = votos[a][t].get(loc)
    if not vs or nr is None:
        return None
    return vs.get(nr, 0) / sum(vs.values()) * 100


add("voto_vencedor", "Votos do vencedor da eleição presidencial", "Eleições", "% dos válidos", "neutro",
    "Indicador político: não existe leitura de melhor ou pior.", "TSE, dados abertos e divulgação (2026)",
    ind_eleitoral(lambda a, l: pct_nr(a, l, *vencedor_nacional(a))), 2,
    descricao="Percentual, no turno decisivo, do candidato que venceu a eleição nacional: Lula (2002, 2006, 2022, 2026), Dilma (2010, 2014), Bolsonaro (2018).")
add("voto_governo_t2", "Votos do candidato do governo federal (2º turno)", "Eleições", "% dos válidos", "neutro",
    "Indicador político: não existe leitura de melhor ou pior.", "TSE",
    ind_eleitoral(lambda a, l: pct_nr(a, l, 2, GOVERNO_T2.get(a)) if 2 in votos[a] else None), 2,
    descricao="Candidato da situação no 2º turno: Serra (2002), Lula (2006), Dilma (2010, 2014), Bolsonaro (2022), Lula (2026). Em 2018 o governo (MDB) não foi ao 2º turno.")
add("margem_t2", "Margem do vencedor local (2º turno)", "Eleições", "p.p.", "neutro",
    "Diferença entre os dois finalistas no lugar: mede polarização local, não desempenho.", "TSE",
    ind_eleitoral(lambda a, l: margem(a, l, 2)), 2)
add("nec_t1", "Número efetivo de candidatos (1º turno)", "Eleições", "candidatos", "neutro",
    "Fragmentação do voto (Laakso-Taagepera): 2 = disputa concentrada em dois; valores maiores = voto mais dividido.",
    "Cálculo sobre TSE", ind_eleitoral(nec), 2)

# Macroeconomia nacional (Banco Central)
for sid, nome, unidade, pol, porque, casas in [
    ("ipca", "Inflação (IPCA) no ano", "%", "menor", "Inflação baixa e estável preserva o poder de compra.", 2),
    ("selic", "Selic no fim do ano", "% a.a.", "neutro", "Juro alto segura a inflação mas encarece o crédito: depende do momento.", 2),
    ("cambio", "Dólar médio no ano", "R$", "neutro", "Dólar caro ajuda exportadores e encarece importados: não há leitura única.", 2),
    ("pib_real", "Crescimento real do PIB", "%", "maior", "Economia crescendo acima da inflação.", 2),
    ("divida_bruta", "Dívida bruta do governo geral", "% do PIB", "menor", "Dívida menor reduz o custo de juros e o risco fiscal.", 1),
    ("salario_minimo", "Salário mínimo (dezembro)", "R$", "maior", "Piso salarial maior (valor nominal).", 0),
]:
    add("macro_" + sid, nome, "Macroeconomia", unidade, pol, porque, "Banco Central, SGS", {"BR": BCB[sid]}, casas,
        formato="moeda" if sid in ("salario_minimo", "cambio") else "num")

# ---------------------------------------------------------------------------
# Municípios
# ---------------------------------------------------------------------------
tse2ibge = {}
for row in ler("tse_municipios.csv"):
    if row["cd_ibge"]:
        tse2ibge[(row["uf"], row["cd_tse"])] = row["cd_ibge"]
mun_loc = json.loads((GEO / "localidades_municipios.json").read_text(encoding="utf-8"))
MUN = {}
for m in mun_loc:
    cod = str(m["municipio-id"])
    MUN[cod] = {"n": m["municipio-nome"], "uf": m["UF-sigla"]}


def mun_set(cod, campo, valor):
    if cod in MUN and valor is not None:
        MUN[cod][campo] = valor


for cod in MUN:
    p22 = S["pop_censo2022"].get(cod, {}).get("2022")
    mun_set(cod, "pop", int(p22) if p22 else None)
    u22 = S["pop_urbana2022"].get(cod, {}).get("2022")
    mun_set(cod, "urb", r(u22 / p22 * 100, 1) if (p22 and u22) else None)
    # PIB per capita: último ano com PIB e população
    for ano in ("2023", "2021"):
        pibm = S["pib"].get(cod, {}).get(ano)
        pm = S["pop_estimada"].get(cod, {}).get(ano) or (POP.get(cod, {}).get(int(ano)))
        if pibm and pm:
            mun_set(cod, "pibpc", r(pibm * 1000 / pm, 0))
            mun_set(cod, "pibpc_ano", int(ano))
            break
    vt21 = None
    v_agro, v_ind, v_adm = (S[k].get(cod, {}).get("2021") for k in ("vab_agro", "vab_industria", "vab_adm_publica"))
    pib21 = S["pib"].get(cod, {}).get("2021")
    if pib21 and v_adm is not None:
        # VAB total municipal não foi baixado: usa PIB como aproximação do denominador (inclui impostos)
        mun_set(cod, "adm", r(v_adm / pib21 * 100, 1))
        mun_set(cod, "agro", r(v_agro / pib21 * 100, 1) if v_agro is not None else None)
        mun_set(cod, "ind", r(v_ind / pib21 * 100, 1) if v_ind is not None else None)

mv = defaultdict(lambda: defaultdict(int))
for row in ler("tse_presidente_mun.csv"):
    cod = tse2ibge.get((row["uf"], row["cd_tse"]))
    if not cod:
        continue
    mv[(cod, int(row["ano"]), int(row["turno"]))][row["numero"]] += int(row["votos"])
# Candidatos guardados por município: os que tiveram pelo menos 2% dos válidos no país naquele turno
MUN_META = {f"{a}_{t}": [c["nr"] for c in eleicoes["presidente"][a][t]["candidatos"] if c["pct"] >= 2]
            for a in eleicoes["presidente"] for t in eleicoes["presidente"][a]}
for (cod, a, t), vs in mv.items():
    tot = sum(vs.values())
    if not tot or cod not in MUN:
        continue
    lider = max(vs.items(), key=lambda kv: kv[1])
    # [número do líder, votos válidos, % de cada candidato da lista MUN_META] (sem destacar partido)
    MUN[cod].setdefault("e", {})[f"{a}_{t}"] = [lider[0], tot] + [r(vs.get(nr, 0) / tot * 100, 1) for nr in MUN_META[f"{a}_{t}"]]
for row in ler("tse_comparecimento_mun.csv"):
    cod = tse2ibge.get((row["uf"], row["cd_tse"]))
    if cod in MUN and row["turno"] == "1" and int(row["aptos"]):
        MUN[cod].setdefault("c", {})[row["ano"]] = r(int(row["comparecimento"]) / int(row["aptos"]) * 100, 1)

# ---------------------------------------------------------------------------
# Gravação
# ---------------------------------------------------------------------------
WEB.mkdir(parents=True, exist_ok=True)
locais_info = [{"id": "BR", "nome": "Brasil", "tipo": "pais"}] + \
    [{"id": k, "nome": v, "tipo": "regiao"} for k, v in REG_NOME.items()] + \
    [{"id": u["UF-sigla"], "nome": u["UF-nome"], "tipo": "uf", "regiao": REG_SIGLA[str(u["regiao-id"])], "cod": u["UF-id"],
      "grade": GRADE[u["UF-sigla"]]} for u in UFS]
dados = {
    "gerado_em": __import__("datetime").date.today().isoformat(),
    "locais": locais_info,
    "indicadores": IND,
    "valores": VAL,
    "pop_flags": {f"{l}|{a}": f for (l, a), f in POP_FLAG.items() if l in LOCAIS},
    "eleicoes": eleicoes,
    "espectro": {"esquerda": sorted(ESQUERDA), "direita": sorted(DIREITA)},
}


def grava_js(nome, var, obj):
    txt = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    (WEB / nome).write_text(f"window.{var}={txt};\n", encoding="utf-8")
    print(f"  {nome}: {len(txt) / 1024:.0f} KB")


print("Gravando web/data:")
grava_js("painel.js", "PB_DADOS", dados)
grava_js("municipios.js", "PB_MUN", MUN)
with open(WEB / "municipios.js", "a", encoding="utf-8") as f:
    f.write("window.PB_MUN_META=" + json.dumps(MUN_META, ensure_ascii=False, separators=(",", ":")) + ";\n")
geo = {"uf": json.loads((GEO / "uf.json").read_text(encoding="utf-8")),
       "mun": json.loads((GEO / "municipios.topo.json").read_text(encoding="utf-8"))}
grava_js("geo.js", "PB_GEO", geo)
prop = MANUAL / "propostas.json"
if prop.exists():
    P = json.loads(prop.read_text(encoding="utf-8"))
    # Cumprimento das propostas e desfecho dos atos (pesquisa com fonte por item, data/manual/cumprimento_*.json)
    cumpr = {}
    for arq in sorted(MANUAL.glob("cumprimento_*.json")):
        cumpr.update(json.loads(arq.read_text(encoding="utf-8")).get("itens", {}))
    n_auto = 0
    for e in P["eleicoes"]:
        a = e["ano"]
        r = eleicoes["presidente"].get(a, {})
        final = r.get(2) or r.get(1)
        vencedor = final["candidatos"][0]["nr"] if final else None
        for c in e["candidatos"]:
            eleito = str(c.get("numero")) == str(vencedor)
            for campo in ("propostas_1turno", "propostas_entre_turnos"):
                for item in c.get(campo, []):
                    if item.get("id") in cumpr:
                        item["cumprimento"] = cumpr[item["id"]]
                    elif not eleito:
                        item["cumprimento"] = {"status": "nao_se_aplica", "resumo": "O candidato não foi eleito nesta eleição: a proposta não tinha como ser executada por ele."}
                        n_auto += 1
                    elif a == ANOS_ELEICAO[-1]:
                        item["cumprimento"] = {"status": "aguardando_mandato", "resumo": f"Candidato eleito em {a}: o mandato começa em 1º/01/{a + 1}. Ainda não há como avaliar."}
                        n_auto += 1
        for item in e.get("acoes_governo_entre_turnos", []):
            if item.get("id") in cumpr:
                item["desfecho"] = cumpr[item["id"]]
    P["cumprimento_gerado"] = bool(cumpr)
    print(f"  propostas: {len(cumpr)} itens pesquisados, {n_auto} com status automático")
    grava_js("propostas.js", "PB_PROPOSTAS", P)
# Balanço dos mandatos: percepção do público (pesquisas de opinião) e destaques factuais pesquisados
aprov = MANUAL / "aprovacao.json"
destaques = {}
for arq in sorted(MANUAL.glob("destaques_*.json")):
    destaques.update(json.loads(arq.read_text(encoding="utf-8")).get("mandatos", {}))
# grava sempre (mesmo vazio) para o navegador não acusar 404 enquanto a pesquisa não existe
grava_js("mandatos.js", "PB_MANDATOS", {
    "aprovacao": json.loads(aprov.read_text(encoding="utf-8")) if aprov.exists() else None,
    "destaques": destaques,
})
print(len(IND), "indicadores;", sum(len(v) for v in VAL.values()), "séries por local")

"""Séries macroeconômicas nacionais do Banco Central (SGS), consolidadas por ano (2002 em diante).

Fonte oficial: api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados
Saída: data/processed/bcb_anual.csv (serie, ano, valor)
"""
import csv
import json
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "data" / "processed"

# serie: (código SGS, agregação anual, descrição)
SERIES = {
    "ipca": (433, "composto", "IPCA, variação acumulada no ano (%)"),
    "selic": (432, "ultimo", "Meta da Selic no fim do ano (% a.a.)"),
    "cambio": (3698, "media", "Dólar PTAX venda, média do ano (R$)"),
    "pib_real": (7326, "ultimo", "PIB, variação real anual (%)"),
    "divida_bruta": (13762, "ultimo", "Dívida bruta do governo geral, dezembro (% do PIB)"),
    "divida_liquida": (4513, "ultimo", "Dívida líquida do setor público, dezembro (% do PIB)"),
    "salario_minimo": (1619, "ultimo", "Salário mínimo em dezembro (R$)"),
}


def baixar(codigo):
    """A API limita séries diárias a 10 anos por consulta: busca em janelas de 9 anos.
    Às vezes a API devolve uma página HTML no lugar do JSON: nesse caso tenta de novo."""
    hoje = time.strftime("%d/%m/%Y")
    ano_atual = time.localtime().tm_year
    pontos = []
    for ini in range(2002, ano_atual + 1, 9):
        fim = f"31/12/{ini + 8}" if ini + 8 < ano_atual else hoje
        url = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json"
               f"&dataInicial=01/01/{ini}&dataFinal={fim}")
        for t in range(8):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=120) as r:
                    corpo = r.read().strip()
                if corpo.startswith(b"["):
                    pontos += json.loads(corpo)
                    break
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    break  # janela sem dados
            except Exception:
                pass
            if t == 7:
                raise RuntimeError(f"BCB não respondeu JSON: {url}")
            time.sleep(3 * (t + 1))
    return pontos


def main():
    linhas = []
    for sid, (cod, agg, _d) in SERIES.items():
        por_ano = defaultdict(list)
        for p in baixar(cod):
            d, m, a = p["data"].split("/")
            por_ano[int(a)].append((int(m), int(d), float(p["valor"])))
        for ano, pts in sorted(por_ano.items()):
            pts.sort()
            vals = [v for _, _, v in pts]
            if agg == "composto":
                if len(pts) < 12:
                    continue  # ano incompleto
                acc = 1.0
                for v in vals:
                    acc *= 1 + v / 100
                valor = (acc - 1) * 100
            elif agg == "media":
                valor = sum(vals) / len(vals)
            else:
                valor = vals[-1]
            linhas.append((sid, ano, round(valor, 4)))
        print(sid, len(por_ano), "anos")
    with open(SAIDA / "bcb_anual.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["serie", "ano", "valor"])
        w.writerows(linhas)
    (SAIDA / "bcb_meta.json").write_text(json.dumps({k: {"sgs": v[0], "descricao": v[2]} for k, v in SERIES.items()},
                                                    ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

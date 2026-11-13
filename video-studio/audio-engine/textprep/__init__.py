"""Pré-processamento linguístico pt-BR para TTS: texto escrito -> blocos de fala.

    from textprep import preparar
    r = preparar("Custa R$ 99,90 e abre às 14h30.", perfil="comercial")
    r.falado   -> "Custa noventa e nove e noventa e abre às duas e meia da tarde."
    r.blocos   -> [{partes, falado, pausa, tipo}]   (entrada dos motores)
    r.mudancas -> [{regra, de, para}]               (auditoria: nada muda sem registro)
    r.avisos   -> leituras ambíguas para revisão humana
"""
import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from . import regras as R
from .lexico import Lexico, carregar as carregar_lexico
from .prosodia import segmentar

VERSAO = "1.0"
RAIZ = Path(__file__).resolve().parents[2]
ARQ_PERFIS = RAIZ / "config" / "speech-profiles.json"

_ETAPAS = [  # ordem importa: do mais específico para o mais geral
    R.limpar, R.marcacao, R.caixa_alta, R.enderecos, "lexico", R.abreviacoes, R.datas, R.telefones,
    R.horas, R.faixas, R.moeda, R.porcentagem, R.ordinais, R.dimensoes, R.unidades, R.romanos, R.fracoes,
    R.alfanumericos, R.numeros_gerais, R.simbolos, R.siglas, R.oralidade, R.pontuacao,
]


@dataclass
class Preparado:
    original: str
    falado: str
    blocos: list[dict]
    mudancas: list[dict]
    avisos: list[str]
    perfil: str
    config: dict = field(default_factory=dict)

    def como_dict(self) -> dict:
        return {"original": self.original, "falado": self.falado, "perfil": self.perfil,
                "blocos": [{"falado": b["falado"], "pausa": b["pausa"], "tipo": b["tipo"]} for b in self.blocos],
                "mudancas": self.mudancas, "avisos": self.avisos}


def carregar_perfis() -> dict:
    return json.loads(ARQ_PERFIS.read_text(encoding="utf-8"))


def perfil_config(nome: str | None) -> tuple[str, dict]:
    dados = carregar_perfis()
    nome = nome or dados.get("padrao", "institucional")
    if nome not in dados["perfis"]:
        raise ValueError(f"Perfil de fala desconhecido: {nome!r}. Opções: {', '.join(dados['perfis'])}")
    return nome, dados["perfis"][nome]


_DEZENAS = "vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cento|mil|ponto|vírgula|zero"


def _tonica_numeral(t: str) -> str:
    """O espeak-ng trata 'um' como artigo (átono). Em numerais ('vinte e um', 'número um.') ele é tônico."""
    t = re.sub(rf"\b((?:{_DEZENAS}|[a-zç]+ent[oa]s) e|ponto|vírgula|zero) um\b", r"\1 úm", t)
    return re.sub(r"\b(número|versão|capítulo|volume|parte|fase|nota|grau) um\b(?=[.,;:!?…]|$)", r"\1 úm", t)


def _partes(texto: str, ctx: R.Ctx) -> tuple[list[dict], str]:
    """Troca os marcadores por partes {t: texto} / {ipa, fala} e devolve também a forma legível."""
    partes, falado, pos = [], [], 0
    for m in R._PH.finditer(texto):
        if m.start() > pos:
            partes.append({"t": texto[pos:m.start()]})
            falado.append(texto[pos:m.start()])
        it = ctx.item(m)
        if it["tipo"] == "ipa":
            v = it["valor"]
            partes.append({"ipa": v["ipa"], "fala": v.get("fala") or it["original"]})
            falado.append(it["original"])
        elif it["tipo"] == "fala":
            partes.append({"t": it["valor"]})
            falado.append(it["valor"])
        elif it["tipo"] == "motor":   # forma só para o motor; a leitura humana mostra o original
            partes.append({"t": it["valor"]})
            falado.append(it["original"])
        pos = m.end()
    if pos < len(texto):
        partes.append({"t": texto[pos:]})
        falado.append(texto[pos:])
    # funde textos vizinhos
    fundidas: list[dict] = []
    for p in partes:
        if "t" in p and fundidas and "t" in fundidas[-1]:
            fundidas[-1]["t"] += p["t"]
        else:
            fundidas.append(dict(p))
    for p in fundidas:
        if "t" in p:
            p["t"] = _tonica_numeral(p["t"])
    return fundidas, re.sub(r"\s+", " ", "".join(falado)).strip()


def preparar(texto: str, perfil: str | None = None, lexico: Lexico | None = None,
             lexico_extra=None) -> Preparado:
    nome, cfg = perfil_config(perfil)
    lex = lexico or carregar_lexico(lexico_extra)
    ctx = R.Ctx(cfg, lex)
    t = texto
    for etapa in _ETAPAS:
        t = lex.aplicar(t, ctx) if etapa == "lexico" else etapa(t, ctx)
    blocos = []
    for b in segmentar(t, ctx):
        partes, falado = _partes(b["texto"], ctx)
        if falado:
            blocos.append({"partes": partes, "falado": falado, "pausa": b["pausa"], "tipo": b["tipo"]})
    falado = " ".join(b["falado"] for b in blocos)
    return Preparado(texto, falado, blocos, ctx.mudancas, ctx.avisos, nome, cfg)


def assinatura(perfil: str | None, lexico_extra=None) -> str:
    """Hash de tudo que influencia o resultado (para cache de narração)."""
    h = hashlib.sha256(VERSAO.encode())
    for arq in (ARQ_PERFIS, RAIZ / "config" / "pronunciations.json", lexico_extra):
        if arq and Path(arq).exists():
            h.update(Path(arq).read_bytes())
    for mod in ("regras.py", "numeros.py", "prosodia.py", "lexico.py", "g2p.py", "__init__.py"):
        h.update((Path(__file__).parent / mod).read_bytes())
    h.update(str(perfil).encode())
    return h.hexdigest()[:16]

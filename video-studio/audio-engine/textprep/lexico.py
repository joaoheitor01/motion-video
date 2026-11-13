"""Dicionário de pronúncias (config/pronunciations.json + sobreposição por projeto).

Formato de cada termo:
  "Remotion": "rimôuchon"                       -> respelling em ortografia portuguesa (recomendado)
  "React":    {"fala": "riékti"}                -> idem, forma longa
  "IA":       {"fala": "i á", "caso": true}     -> só casa com a grafia exata (maiúsculas/minúsculas)
  "Kokoro":   {"ipa": "kokˈoɾʊ", "fala": "cocôro"} -> fonemas IPA; usa "fala" se o motor não aceitar
  "API":      {"soletrar": true, "caso": true}  -> soletra letra a letra, com ritmo de sigla
  "Nome":     {"preservar": true}               -> nunca alterar (protege de todas as regras)
"""
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
PADRAO = RAIZ / "config" / "pronunciations.json"


class Lexico:
    def __init__(self, *arquivos):
        self.termos: dict[str, dict] = {}
        self.palavras: set[str] = set()   # siglas lidas como palavra
        self.fontes: list[str] = []
        for arq in arquivos:
            if arq and Path(arq).exists():
                self._carregar(Path(arq))
        self._compilar()

    def _carregar(self, arq: Path):
        dados = json.loads(arq.read_text(encoding="utf-8"))
        self.fontes.append(str(arq))
        for termo, v in dados.get("termos", {}).items():
            if termo.startswith("_"):
                continue
            self.termos[termo] = {"fala": v} if isinstance(v, str) else dict(v)
        self.palavras |= {s.upper() for s in dados.get("siglas_como_palavra", [])}
        for termo in dados.get("preservar", []):
            self.termos[termo] = {"preservar": True, "caso": True}

    def _compilar(self):
        ordenados = sorted(self.termos, key=len, reverse=True)
        self._idx = {t.lower(): t for t in reversed(ordenados)}
        if not ordenados:
            self._re = None
            return
        alt = "|".join(re.escape(t) for t in ordenados)
        self._re = re.compile(rf"(?<![\w\ue000-\uf8ff])({alt})(s?)(?![\w\ue000-\uf8ff])", re.I)

    def sigla_como_palavra(self, tok: str) -> bool:
        return tok.upper() in self.palavras

    def aplicar(self, texto: str, ctx) -> str:
        if not self._re:
            return texto

        def troca(m):
            achado, plural = m.group(1), m.group(2)
            chave = achado if achado in self.termos else self._idx.get(achado.lower())
            v = self.termos.get(chave)
            if v is None or (v.get("caso") and achado != chave):
                return m.group(0)
            original = m.group(0)
            if v.get("preservar"):
                return ctx.proteger("fala", original, original)
            if plural and v.get("plural") is False:
                return original
            if v.get("soletrar"):
                from .regras import proteger_soletrado, soletrar
                ctx.log("dicionario", original, f"{original} (soletrada: {soletrar(achado)})")
                return proteger_soletrado(ctx, achado, plural)
            fala = (v.get("fala") or achado) + plural
            if v.get("ipa"):
                ctx.log("dicionario", original, f"/{v['ipa']}/")
                return ctx.proteger("ipa", {"ipa": v["ipa"] + ("s" if plural else ""), "fala": fala}, original)
            ctx.log("dicionario", original, fala)
            return ctx.proteger("fala", fala, original)
        return self._re.sub(troca, texto)


def carregar(extra=None) -> Lexico:
    return Lexico(PADRAO, extra)

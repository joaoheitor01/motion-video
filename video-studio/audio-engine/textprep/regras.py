"""Regras de normalização: texto escrito -> texto falado (pt-BR).

Cada regra é conservadora: só age quando o padrão é inequívoco. Toda alteração é registrada
em ctx.mudancas; leituras ambíguas geram ctx.avisos para revisão humana.
"""
import re
import unicodedata

from .numeros import cardinal, ordinal, digitos, numero, parse_br, romano, e_feminino

ABRE, FECHA = chr(0xE000), chr(0xE001)  # marcadores (área de uso privado do Unicode)
_PH = re.compile(f"{ABRE}(.){FECHA}")
NUM = r"(?:\d{1,3}(?:\.\d{3})+|\d+)"  # inteiro, com ou sem separador de milhar
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
         "setembro", "outubro", "novembro", "dezembro"]
LETRAS = {"a": "á", "b": "bê", "c": "cê", "d": "dê", "e": "é", "f": "éfe", "g": "gê", "h": "agá",
          "i": "i", "j": "jota", "k": "cá", "l": "éle", "m": "eme", "n": "ene", "o": "ó", "p": "pê",
          "q": "quê", "r": "érre", "s": "ésse", "t": "tê", "u": "u", "v": "vê", "w": "dáblio",
          "x": "xis", "y": "ípsilon", "z": "zê"}


_LETRA_IPA = {"a": ("", "a"), "b": ("b", "e"), "c": ("s", "e"), "d": ("d", "e"), "e": ("", "ɛ"),
              "f": ("", "ɛfy"), "g": ("ʒ", "e"), "h": ("aɡ", "a"), "i": ("", "i"), "j": ("ʒ", "ɔtæ"),
              "k": ("k", "a"), "l": ("", "ɛly"), "m": ("", "eme"), "n": ("", "ene"), "o": ("", "ɔ"),
              "p": ("p", "e"), "q": ("k", "e"), "r": ("", "ɛxe"), "s": ("", "ɛsy"), "t": ("t", "e"),
              "u": ("", "u"), "v": ("v", "e"), "w": ("d", "ablju"), "x": ("ʃ", "is"), "y": ("", "ipsiloŋ"),
              "z": ("z", "e")}


class Ctx:
    def __init__(self, perfil: dict, lexico=None, motor: str | None = None):
        self.perfil = perfil
        self.oral = perfil.get("oralidade", {})
        self.lexico = lexico
        self.motor = motor
        self.mudancas: list[dict] = []
        self.avisos: list[str] = []
        self.protegidos: list[dict] = []

    def log(self, regra: str, de: str, para: str):
        de, para = self.legivel(de), self.legivel(para)
        if de != para:
            self.mudancas.append({"regra": regra, "de": de, "para": para})

    def aviso(self, msg: str):
        if msg not in self.avisos:
            self.avisos.append(msg)

    def proteger(self, tipo: str, valor, original: str) -> str:
        self.protegidos.append({"tipo": tipo, "valor": valor, "original": original})
        return f"{ABRE}{chr(0xE100 + len(self.protegidos) - 1)}{FECHA}"

    def item(self, m) -> dict:
        return self.protegidos[ord(m.group(1)) - 0xE100]

    def legivel(self, s: str) -> str:
        """Texto com marcadores substituídos pela forma legível (para relatórios)."""
        def r(m):
            it = self.item(m)
            if it["tipo"] == "pausa":
                return f"[pausa:{it['valor']}]"
            return it["valor"] if it["tipo"] == "fala" else it["original"]  # ipa/motor: mostra o original
        return _PH.sub(r, s)


def _sub(ctx: Ctx, regra: str, padrao, fn, texto: str, flags=0) -> str:
    def r(m):
        novo = fn(m)
        if novo is None:
            return m.group(0)
        ctx.log(regra, m.group(0), novo)
        return novo
    return re.sub(padrao, r, texto, flags=flags)


def _prox_palavra(texto: str, pos: int) -> str:
    m = re.match(r"\s*([^\W\d_]+)", texto[pos:])
    return m.group(1) if m else ""


# ---------------------------------------------------------------- limpeza
_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍⬀-⯿]")


def limpar(t: str, ctx: Ctx) -> str:
    t = unicodedata.normalize("NFC", t).replace("\r\n", "\n").replace("\r", "\n")
    t = t.replace(" ", " ").replace("​", "")
    t = _EMOJI.sub("", t)
    t = re.sub(r"(\*\*|__)(.+?)\1", r"\2", t)                 # negrito markdown
    t = re.sub(r"(?<!\w)[*_](\S[^*_\n]*?)[*_](?!\w)", r"\1", t)  # itálico markdown
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)        # títulos markdown
    t = re.sub(r"`([^`]*)`", r"\1", t)
    t = re.sub(r"[“”«»„]", '"', t)
    t = re.sub(r"[‘’`´]", "'", t)
    t = t.replace("...", "…")
    # listas: cada item vira uma frase
    def item(m):
        corpo = m.group(1).strip()
        return corpo if corpo[-1:] in ".!?…:;," else corpo + "."
    t = re.sub(r"^[ \t]*(?:[-–—•▪▸*]|\d{1,2}[.)])[ \t]+(.+)$", item, t, flags=re.M)
    t = re.sub(r"[ \t]+[–-][ \t]+|[ \t]*—[ \t]*|[ \t]+--[ \t]+", " — ", t)  # travessões
    t = t.replace("–", "-")
    return t


# ---------------------------------------------------------------- marcação inline
def marcacao(t: str, ctx: Ctx) -> str:
    """[pausa], [pausa:0.8], [respira], {texto|como falar}, {texto|/ipa/}, {=literal}."""
    padrao = ctx.perfil.get("prosodia", {})

    def pausa(m):
        nome, valor = m.group(1).lower(), m.group(2)
        seg = float(valor.replace(",", ".")) if valor else (
            padrao.get("pausa_respiracao", 0.25) if nome == "respira" else padrao.get("pausa_explicita", 0.6))
        return " " + ctx.proteger("pausa", round(min(max(seg, 0.05), 5.0), 3), m.group(0)) + " "
    t = re.sub(r"\[(pausa|respira)(?::\s*(\d+(?:[.,]\d+)?)\s*s?)?\]", pausa, t, flags=re.I)

    def fala(m):
        original, como = m.group(1).strip(), m.group(2).strip()
        ipa = re.fullmatch(r"/(.+)/", como)
        ctx.log("marcacao", original, como)
        return ctx.proteger("ipa", {"ipa": ipa.group(1), "fala": original}, original) if ipa else ctx.proteger("fala", como, original)
    t = re.sub(r"\{([^{}|=][^{}|]*)\|([^{}|]+)\}", fala, t)
    t = re.sub(r"\{=([^{}]+)\}", lambda m: ctx.proteger("fala", m.group(1), m.group(1)), t)
    return t


# ---------------------------------------------------------------- caixa alta
_PALAVRAS_CURTAS = set("""a o e é à ao as os um uma uns de da do das dos em no na nos nas por para com sem se
que eu tu ele ela nós vós meu sua seu já só há ou mas nem não sim lá cá aí ali eu vai vou ver ser ter
dar dia mês ano mil dez bem mal bom boa tão quão sob até pra pro ti te me lhe si quem qual como onde
foi era são tem vem faz diz põe sai cai lei rei réu céu mar sol sul luz voz paz vez fim cor dor flor
som tom dom cem uns nos vos top pop""".split())


def caixa_alta(t: str, ctx: Ctx) -> str:
    """Frases inteiras em maiúsculas são ênfase tipográfica, não siglas: volta à caixa normal."""
    def frase(m):
        s = m.group(0)
        letras = [c for c in s if c.isalpha()]
        palavras = re.findall(r"[^\W\d_]{2,}", s)
        if len(palavras) >= 3 and sum(c.isupper() for c in letras) >= 0.8 * len(letras):
            novo = s.lower()
            novo = re.sub(r"[^\W\d_]", lambda x: x.group(0).upper(), novo, count=1)
            ctx.log("caixa_alta", s, novo)
            return novo
        return s
    return re.sub(r"[^.!?…\n]+[.!?…]*", frase, t)


# ---------------------------------------------------------------- URLs e e-mails
_TLD = {"com": "com", "br": "bê érre", "org": "órg", "net": "nét", "gov": "góv", "edu": "edu",
        "io": "i ó", "app": "épi", "dev": "dév", "tv": "tê vê", "me": "mi", "ai": "a i", "pt": "pê tê",
        "co": "cô", "info": "info", "online": "online", "site": "site", "blog": "blog"}


def _ler_endereco(s: str) -> str:
    s = re.sub(r"^https?://", "", s, flags=re.I).rstrip("/.,;")
    out = []
    for parte in re.split(r"([./@_\-:?=&#])", s):
        if not parte:
            continue
        simbolo = {".": "ponto", "/": "barra", "@": "arroba", "_": "underline", "-": "hífen",
                   ":": "dois pontos", "?": "interrogação", "=": "igual", "&": "e comercial", "#": "cerquilha"}
        if parte in simbolo:
            out.append(simbolo[parte])
        elif parte.lower() == "www":
            out.append("dáblio dáblio dáblio")
        elif parte.lower() in _TLD and out and out[-1] == "ponto":
            out.append(_TLD[parte.lower()])
        else:
            out.append(parte)
    return " ".join(out)


def enderecos(t: str, ctx: Ctx) -> str:
    tlds = "|".join(_TLD)
    t = _sub(ctx, "email", r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+", lambda m: _ler_endereco(m.group(0)), t)
    t = _sub(ctx, "url", rf"\b(?:https?://|www\.)[^\s<>\"]+|\b[\w-]+(?:\.[\w-]+)*\.(?:{tlds})\b(?:/[^\s<>\"]*)?",
             lambda m: _ler_endereco(m.group(0)) + (m.group(0)[-1] if m.group(0)[-1] in ".,;" else ""), t, flags=re.I)
    return t


# ---------------------------------------------------------------- abreviações
_ABREV = [  # (padrão, expansão, pode_encerrar_frase)
    (r"\bDrs\.", "doutores", False), (r"\bDras\.", "doutoras", False),
    (r"\bDra\.", "doutora", False), (r"\bDr\.", "doutor", False),
    (r"\bSrta\.", "senhorita", False), (r"\bSras\.", "senhoras", False), (r"\bSrs\.", "senhores", False),
    (r"\bSra\.", "senhora", False), (r"\bSr\.", "senhor", False),
    (r"\bProf[aª]\.|\bProf\.ª", "professora", False), (r"\bProf\.", "professor", False),
    (r"\bEng\.", "engenheiro", False), (r"\bArq\.", "arquiteto", False),
    (r"\bAv\.", "avenida", False), (r"\bSto\.", "santo", False), (r"\bSta\.", "santa", False),
    (r"\b[Nn](?:\.\s?º|º|°(?=\s?\d)|\.°(?=\s?\d))\s*", "número ", False),
    (r"\b[Pp]ágs\.", "páginas", False), (r"\b[Pp]ág\.", "página", False),
    (r"\b[Pp]\.\s?ex\.", "por exemplo", False), (r"\b[Ee]x\.(?=\s*:)", "exemplo", False),
    (r"\b[Oo]bs\.(?=\s*:)", "observação", False),
    (r"\betc\.?(?!\w)", "etcétera", True), (r"\bvs\.?(?!\w)", "versus", False),
    (r"\b[Aa]prox\.", "aproximadamente", False),
    (r"\b[Mm]áx\.", "máximo", False), (r"\b[Mm]ín\.", "mínimo", False),
    (r"\bLtda\.?(?!\w)", "limitada", True), (r"\bCia\.", "companhia", False),
    (r"\bS\.\s?A\.|\bS/A\b", "ésse á", True), (r"\bJr\.", "júnior", True),
    (r"\ba\.\s?C\.", "antes de Cristo", True), (r"\bd\.\s?C\.", "depois de Cristo", True),
    (r"\bi\.\s?e\.", "isto é", False), (r"\be\.\s?g\.", "por exemplo", False),
    (r"\b[Aa]rt\.(?=\s?\d)", "artigo", False), (r"\b[Cc]ap\.(?=\s?[\dIVXL])", "capítulo", False),
    (r"\b[Vv]ol\.(?=\s?[\dIVXL])", "volume", False), (r"\b[Ss]éc\.(?=\s?[\dIVXL])", "século", False),
    (r"\b[Dd]ept?o?\.", "departamento", False), (r"\b[Aa]pto\.", "apartamento", False),
    (r"\b[Tt]el\.(?=\s*[:(\d])", "telefone", False), (r"\b[Cc]el\.(?=\s*[:(\d])", "celular", False),
    (r"\b[Rr]ef\.", "referência", False), (r"\b[Qq]tde?\.", "quantidade", False),
    (r"(?<!\w)c/(?=\s?\w)", "com ", False), (r"(?<!\w)s/(?=\s?\w)", "sem ", False),
    (r"(?<!\w)p/(?=\s?\w)", "para ", False),
    (r"\be/ou\b", "e ou", False),
]


def abreviacoes(t: str, ctx: Ctx) -> str:
    for padrao, exp, encerra in _ABREV:
        def r(m, exp=exp, encerra=encerra):
            resto = m.string[m.end():]
            tinha_ponto = m.group(0).rstrip().endswith(".")
            fim = encerra and tinha_ponto and (not resto.strip() or re.match(r"\s+[A-ZÀ-Ý\"]", resto))
            return exp + ("." if fim else "")
        t = _sub(ctx, "abreviacao", padrao, r, t)
    return t


# ---------------------------------------------------------------- moeda
_MOEDAS = {"R$": ("real", "reais", False), "US$": ("dólar", "dólares", False), "U$": ("dólar", "dólares", False),
           "$": ("dólar", "dólares", False), "€": ("euro", "euros", False), "£": ("libra", "libras", True)}
_ESC = {"mil": 10 ** 3, "milhão": 10 ** 6, "milhões": 10 ** 6, "mi": 10 ** 6, "bilhão": 10 ** 9,
        "bilhões": 10 ** 9, "bi": 10 ** 9, "trilhão": 10 ** 12, "trilhões": 10 ** 12}


def _com_escala(inteiro: int, dec: str | None, escala: str, fem=False) -> tuple[str, bool]:
    """'2,5' + 'milhões' -> ('dois milhões e meio', precisa_de)."""
    mult = _ESC[escala]
    if mult == 1000:
        valor = inteiro * 1000 + (int((dec + "000")[:3]) if dec else 0)
        return cardinal(valor, fem), False
    nome = {10 ** 6: ("milhão", "milhões"), 10 ** 9: ("bilhão", "bilhões"), 10 ** 12: ("trilhão", "trilhões")}[mult]
    plural = nome[0] if inteiro == 1 else nome[1]
    if not dec or not dec.strip("0"):
        return f"{cardinal(inteiro)} {plural}", True
    if dec in ("5", "50"):
        return (f"meio {nome[0]}" if inteiro == 0 else f"{cardinal(inteiro)} {plural} e meio"), True
    return f"{numero(f'{inteiro},{dec}')} {nome[1] if inteiro != 1 else nome[0]}", True


def moeda(t: str, ctx: Ctx) -> str:
    curto = ctx.oral.get("precos") == "curto"

    def r(m):
        sing, plur, fem = _MOEDAS[m.group("s").upper() if m.group("s").upper() in _MOEDAS else m.group("s")]
        inteiro = int(m.group("i").replace(".", ""))
        dec, esc = m.group("d"), m.group("e")
        if esc:
            ext, de = _com_escala(inteiro, dec, esc.lower(), fem)
            return f"{ext} {'de ' if de else ''}{plur}"
        cent = int((dec + "0")[:2]) if dec else 0
        p_cent = f"{cardinal(cent)} {'centavo' if cent == 1 else 'centavos'}"
        if inteiro == 0 and cent:
            return p_cent
        if curto and cent and 0 < inteiro < 1000:
            return f"{cardinal(inteiro, fem)} e {cardinal(cent)}"
        de = "de " if inteiro >= 10 ** 6 and inteiro % 10 ** 6 == 0 else ""
        base = f"{cardinal(inteiro, fem)} {de}{sing if inteiro == 1 else plur}"
        return f"{base} e {p_cent}" if cent else base
    padrao = (r"(?P<s>R\$|US\$|U\$|€|£|(?<![\w$])\$)\s?(?P<i>" + NUM + r")(?:,(?P<d>\d{1,2}))?"
              r"(?:\s?(?P<e>mil|milhão|milhões|bilhão|bilhões|trilhão|trilhões|mi|bi)\b)?")
    return _sub(ctx, "moeda", padrao, r, t, flags=re.I)


def porcentagem(t: str, ctx: Ctx) -> str:
    return _sub(ctx, "porcentagem", rf"(?<![\w,.])({NUM}(?:,\d+)?)\s?%",
                lambda m: numero(m.group(1)) + " por cento", t)


# ---------------------------------------------------------------- datas
def _dia(d: int) -> str:
    return "primeiro" if d == 1 else cardinal(d)


def datas(t: str, ctx: Ctx) -> str:
    def completa(d, mth, a=None):
        d, mth = int(d), int(mth)
        if not (1 <= d <= 31 and 1 <= mth <= 12):
            return None
        s = f"{_dia(d)} de {MESES[mth - 1]}"
        if a is not None:
            ano = int(a)
            if len(a) == 2:
                ano += 2000 if ano < 50 else 1900
                ctx.aviso(f"Ano com 2 dígitos ('{a}') interpretado como {ano}.")
            s += f" de {cardinal(ano)}"
        return s
    t = _sub(ctx, "data", r"(?<![\w/])(\d{1,2})/(\d{1,2})/(\d{4}|\d{2})(?![\w/])",
             lambda m: completa(m.group(1), m.group(2), m.group(3)), t)
    t = _sub(ctx, "data", r"(?<![\w-])(\d{4})-(\d{2})-(\d{2})(?![\w-])",
             lambda m: completa(m.group(3), m.group(2), m.group(1)), t)
    gatilho = r"(?P<g>\b(?:dias?|em|até|desde|a partir de|entre|no dia|até o dia|para o dia)\s+)"
    for _ in range(3):  # encadeia: "entre 10/11 e 15/11"
        def curta(m):
            s = completa(m.group("d"), m.group("m"))
            return None if s is None else m.group("g") + s
        novo = _sub(ctx, "data", gatilho + r"(?P<d>\d{1,2})/(?P<m>\d{1,2})(?![\w/])", curta, t, flags=re.I)
        novo = _sub(ctx, "data", r"(?P<g>\bde (?:" + "|".join(MESES) + r")\s+(?:e|a|até)\s+)(?P<d>\d{1,2})/(?P<m>\d{1,2})(?![\w/])",
                    lambda m: (lambda s: None if s is None else m.group("g") + s)(completa(m.group("d"), m.group("m"))), novo, flags=re.I)
        if novo == t:
            break
        t = novo
    # "dia 1 de maio" / "1º de maio" -> "primeiro de maio"
    t = _sub(ctx, "data", r"\b1(?:º|°)?(?= de (?:" + "|".join(MESES) + r")\b)", lambda m: "primeiro", t, flags=re.I)
    return t


# ---------------------------------------------------------------- horas
def _periodo(h: int) -> str:
    return "da madrugada" if 1 <= h <= 5 else "da manhã" if h < 12 else "da tarde" if h < 18 else "da noite"


def _hora_informal(h: int, mi: int) -> tuple[str, str]:
    """Retorna (núcleo, tipo) — tipo em {'meio-dia','meia-noite','uma','plural'} para ajustar a preposição."""
    resto = "" if mi == 0 else " e meia" if mi == 30 else f" e {cardinal(mi)}"
    if h == 0:
        return "meia-noite" + resto, "meia-noite"
    if h == 12:
        return "meio-dia" + resto, "meio-dia"
    h12 = h % 12
    return f"{cardinal(h12, True)}{resto} {_periodo(h)}", "uma" if h12 == 1 else "plural"


def _hora_formal(h: int, mi: int, s: int | None = None) -> str:
    out = f"{cardinal(h, True)} {'hora' if h == 1 else 'horas'}" if h else "zero hora"
    if mi:
        out += f" e {cardinal(mi)} {'minuto' if mi == 1 else 'minutos'}"
    if s:
        out += f" e {cardinal(s)} {'segundo' if s == 1 else 'segundos'}"
    return out


_PREP = {  # preposição escrita -> forma por tipo de hora
    "às": {"meio-dia": "ao", "meia-noite": "à", "uma": "à", "plural": "às"},
    "as": {"meio-dia": "ao", "meia-noite": "à", "uma": "à", "plural": "às"},
    "à": {"meio-dia": "ao", "meia-noite": "à", "uma": "à", "plural": "às"},
    "das": {"meio-dia": "do", "meia-noite": "da", "uma": "da", "plural": "das"},
    "da": {"meio-dia": "do", "meia-noite": "da", "uma": "da", "plural": "das"},
    "até as": {"meio-dia": "até o", "meia-noite": "até a", "uma": "até a", "plural": "até as"},
    "até às": {"meio-dia": "até o", "meia-noite": "até a", "uma": "até a", "plural": "até as"},
}
_HORA = r"(?:(?P<h>[01]?\d|2[0-4])\s?h(?:(?P<m>[0-5]\d)(?:\s?min\b)?)?(?![\w/])|(?P<h2>[01]?\d|2[0-3]):(?P<m2>[0-5]\d)(?::(?P<s2>[0-5]\d))?(?:\s?h\b)?(?![\w:]))"


def horas(t: str, ctx: Ctx) -> str:
    informal = ctx.oral.get("horas") == "informal"
    # "9h-18h" -> "9h a 18h"
    t = re.sub(r"(\d\s?h(?:[0-5]\d)?|\d:[0-5]\d)\s?[-–]\s?(?=\d{1,2}(?:\s?h|:[0-5]\d))", r"\1 a ", t)

    def partes(m):
        h = int(m.group("h") if m.group("h") is not None else m.group("h2"))
        mi = int(m.group("m") or m.group("m2") or 0)
        s = int(m.group("s2")) if m.group("s2") else None
        return h % 24 if h == 24 else h, mi, s

    if informal:
        def r(m):
            h, mi, s = partes(m)
            if s:
                return None
            nucleo, tipo = _hora_informal(h, mi)
            prep = _PREP[m.group("p").lower()][tipo]
            if m.group("p")[0].isupper():
                prep = prep.capitalize()
            return f"{prep} {nucleo}"
        t = _sub(ctx, "hora", r"(?<![\w])(?P<p>até [aà]s|[àa]s|das?|à)\s+" + _HORA, r, t, flags=re.I)

    def formal(m):
        h, mi, s = partes(m)
        return _hora_formal(h, mi, s)
    return _sub(ctx, "hora", r"(?<![\w,.:])" + _HORA, formal, t)


# ---------------------------------------------------------------- telefones e documentos
def telefones(t: str, ctx: Ctx) -> str:
    meia = ctx.oral.get("telefone_meia", True)

    def d(s):
        return digitos(s, meia)

    t = _sub(ctx, "documento", r"(?<![\w.])(\d{2})\.(\d{3})\.(\d{3})/(\d{4})-(\d{2})(?!\w)",
             lambda m: ", ".join(digitos(g) for g in m.groups()), t)
    t = _sub(ctx, "documento", r"(?<![\w.])(\d{3})\.(\d{3})\.(\d{3})-(\d{2})(?!\w)",
             lambda m: ", ".join(digitos(g) for g in m.groups()), t)
    t = _sub(ctx, "telefone", r"(?<!\w)0800[\s-]?(\d{3})[\s-]?(\d{4})(?!\w)",
             lambda m: f"zero oitocentos, {d(m.group(1))}, {d(m.group(2))}", t)

    def fone(m):
        ddd = m.group("ddd")
        partes = ([cardinal(int(ddd))] if ddd else []) + [d(m.group("a")), d(m.group("b"))]
        return ", ".join(partes)
    # com DDD entre parênteses, ou celular com 9 dígitos
    t = _sub(ctx, "telefone", r"(?<![\w-])(?:\+55\s?)?\((?P<ddd>\d{2})\)\s?(?P<a>9?\d{4})[-\s](?P<b>\d{4})(?![\w-])", fone, t)
    t = _sub(ctx, "telefone", r"(?<![\w-])(?:\+55\s?)?(?:(?P<ddd>\d{2})\s)?(?P<a>9\d{4})-(?P<b>\d{4})(?![\w-])", fone, t)
    # fixo sem DDD: só com palavra-gatilho antes (evita confundir com "2020-2024")
    t = _sub(ctx, "telefone",
             r"(?P<g>\b(?:telefones?|tel|fones?|celular|whatsapp|zap|ligue|contato|ramal)\b[^.\n\d]{0,25})(?P<ddd>)(?P<a>\d{4})-(?P<b>\d{4})(?![\w-])",
             lambda m: m.group("g") + fone(m), t, flags=re.I)
    t = _sub(ctx, "cep", r"(?<![\w-])(\d{5})-(\d{3})(?![\w-])", lambda m: f"{digitos(m.group(1))}, {digitos(m.group(2))}", t)
    return t


# ---------------------------------------------------------------- ordinais
_SUBST_ORD = r"lugar|andar|ano|dia|mês|semestre|trimestre|bimestre|turno|capítulo|episódio|passo|grau|tempo|período|artigo|parágrafo"


def ordinais(t: str, ctx: Ctx) -> str:
    def r(m):
        n = int(m.group(1).replace(".", ""))
        fem = m.group(2).startswith("ª")
        plural = m.group(2).endswith("s")
        w = ordinal(n, fem)
        return " ".join(p + "s" for p in w.split()) if plural else w
    t = _sub(ctx, "ordinal", r"(?<![\w,.])(\d{1,4})\s?(ºs|ªs|º|ª)(?!\w)", r, t)
    t = _sub(ctx, "ordinal", rf"(?<![\w,.])(\d{{1,3}})o(?=\s(?:{_SUBST_ORD})\b)", lambda m: ordinal(int(m.group(1))), t, flags=re.I)
    # "°" (grau) usado como ordinal antes de substantivos típicos
    t = _sub(ctx, "ordinal", rf"(?<![\w,.])(\d{{1,3}})°(?=\s(?:{_SUBST_ORD})\b)", lambda m: ordinal(int(m.group(1))), t, flags=re.I)
    return t


# ---------------------------------------------------------------- unidades
_UNIDADES = {  # símbolo: (singular, plural, feminino)
    "km/h": ("quilômetro por hora", "quilômetros por hora", False),
    "m/s": ("metro por segundo", "metros por segundo", False),
    "km²": ("quilômetro quadrado", "quilômetros quadrados", False),
    "m²": ("metro quadrado", "metros quadrados", False), "m³": ("metro cúbico", "metros cúbicos", False),
    "cm²": ("centímetro quadrado", "centímetros quadrados", False),
    "km": ("quilômetro", "quilômetros", False), "cm": ("centímetro", "centímetros", False),
    "mm": ("milímetro", "milímetros", False), "m": ("metro", "metros", False),
    "kg": ("quilo", "quilos", False), "mg": ("miligrama", "miligramas", False), "g": ("grama", "gramas", False),
    "ml": ("mililitro", "mililitros", False), "mL": ("mililitro", "mililitros", False),
    "l": ("litro", "litros", False), "L": ("litro", "litros", False),
    "h": ("hora", "horas", True), "min": ("minuto", "minutos", False), "seg": ("segundo", "segundos", False),
    "ms": ("milissegundo", "milissegundos", False), "s": ("segundo", "segundos", False),
    "°C": ("grau Celsius", "graus Celsius", False), "ºC": ("grau Celsius", "graus Celsius", False),
    "°F": ("grau Fahrenheit", "graus Fahrenheit", False), "°": ("grau", "graus", False),
    "TB": ("terabáite", "terabáites", False), "GB": ("gigabáite", "gigabáites", False),
    "MB": ("megabáite", "megabáites", False), "KB": ("quilobáite", "quilobáites", False),
    "kB": ("quilobáite", "quilobáites", False),
    "GHz": ("giga-rértz", "giga-rértz", False), "MHz": ("mega-rértz", "mega-rértz", False),
    "kHz": ("quilo-rértz", "quilo-rértz", False), "Hz": ("rértz", "rértz", False),
    "kWh": ("quilouót-hora", "quilouóts-hora", False), "kW": ("quilouót", "quilouóts", False),
    "W": ("uót", "uóts", False), "V": ("volt", "volts", False),
    "Mbps": ("mega bit por segundo", "mega bits por segundo", False),
    "kbps": ("quilo bit por segundo", "quilo bits por segundo", False),
    "fps": ("quadro por segundo", "quadros por segundo", False),
    "px": ("pícsel", "pícsels", False), "dB": ("decibel", "decibéis", False),
    "dpi": ("ponto por polegada", "pontos por polegada", False),
}


def unidades(t: str, ctx: Ctx) -> str:
    simbolos = "|".join(re.escape(u) for u in sorted(_UNIDADES, key=len, reverse=True))

    def r(m):
        u = m.group("u")
        sing, plur, fem = _UNIDADES[u]
        inteiro = int(m.group("i").replace(".", ""))
        dec = m.group("d")
        colado = m.group("sp") == ""
        if len(u) == 1 and u.isalpha() and not colado and u in "sVWlL":
            return None  # "5 s", "3 V": ambíguo demais com espaço
        if dec in ("5", "50") and "por" not in sing and " " not in sing:
            meio = "meia" if fem else "meio"
            if inteiro == 0:
                return f"{meio} {sing}"
            return f"{cardinal(inteiro, fem)} {sing if inteiro == 1 else plur} e {meio}"
        valor = numero(m.group("i") + ("," + dec if dec else ""), fem)
        return f"{valor} {sing if inteiro in (0, 1) and (dec or inteiro == 1) else plur}"
    return _sub(ctx, "unidade", rf"(?<![\w,.])(?P<i>{NUM})(?:,(?P<d>\d+))?(?P<sp>\s?)(?P<u>{simbolos})(?![\w/²³°])", r, t)


def dimensoes(t: str, ctx: Ctx) -> str:
    n = rf"{NUM}(?:,\d+)?"
    for _ in range(2):
        t = _sub(ctx, "dimensao", rf"(?<![\w,.])({n})\s?[x×]\s?({n})(?![\w,]|\.\d)",
                 lambda m: f"{numero(m.group(1))} por {numero(m.group(2))}", t)
    t = _sub(ctx, "multiplicador", r"(?<![\w,.])(\d{1,3})x(?!\w)",
             lambda m: f"{cardinal(int(m.group(1)), True)} {'vez' if m.group(1) == '1' else 'vezes'}", t)
    t = _sub(ctx, "proporcao", r"(?<![\w,.:])(\d{1,2}):(\d{1,2})(?![\w:])",
             lambda m: f"{cardinal(int(m.group(1)))} por {cardinal(int(m.group(2)))}", t)
    return t


# ---------------------------------------------------------------- romanos
_REIS = r"Pedro|João Paulo|João|Bento|Pio|Luís|Luis|Henrique|Elizabeth|Carlos|Felipe|Filipe|Afonso|Manuel|Leão|Napoleão|Francisco|Paulo|Charles|Guilherme|Isabel|Vitória|Catarina|Alexandre|Nicolau|Frederico"


def romanos(t: str, ctx: Ctx) -> str:
    def secs(m):
        n = romano(m.group(2))
        if n is None:
            return None
        return f"{m.group(1)} {ordinal(n) if n <= 10 else cardinal(n)}"
    t = _sub(ctx, "romano", r"\b([Ss]éculos?)\s+([IVXLCDM]+)\b", secs, t)

    def card(m):
        n = romano(m.group(2))
        return None if n is None else f"{m.group(1)} {cardinal(n)}"
    t = _sub(ctx, "romano", r"\b([Cc]apítulos?|[Vv]olumes?|[Tt]omos?|[Aa]tos?|[Pp]artes?|[Ff]ases?|[Tt]ítulos?|[Aa]nexos?|[Mm]ódulos?|[Ee]pisódios?|[Tt]emporadas?)\s+([IVXLCDM]+)\b", card, t)

    def rei(m):
        n = romano(m.group(2))
        if n is None:
            return None
        fem = m.group(1).split()[-1] in ("Elizabeth", "Isabel", "Vitória", "Catarina")
        return f"{m.group(1)} {ordinal(n, fem) if n <= 10 else cardinal(n)}"
    t = _sub(ctx, "romano", rf"\b((?:(?:Dom|D\.|Papa|Rei|Rainha|Imperador|Imperatriz|Príncipe|Princesa)\s+)?(?:{_REIS}))\s+([IVXLCDM]{{1,6}})\b(?!\.)", rei, t)
    return t


# ---------------------------------------------------------------- números gerais
_FRAC = {2: ("meio", "meios"), 3: ("terço", "terços"), 4: ("quarto", "quartos"), 5: ("quinto", "quintos"),
         6: ("sexto", "sextos"), 7: ("sétimo", "sétimos"), 8: ("oitavo", "oitavos"), 9: ("nono", "nonos"),
         10: ("décimo", "décimos"), 100: ("centésimo", "centésimos")}
_NAO_SUBST = set("de da do das dos e ou a o as os em no na nos nas por para pra que com sem mais menos ao à "
                 "é são foi um uma se mas como até entre sobre vírgula ponto".split())


def fracoes(t: str, ctx: Ctx) -> str:
    def r(m):
        a, b = int(m.group(1)), int(m.group(2))
        if b in _FRAC and 0 < a < b:
            if (a, b) == (1, 2):
                return "meio"
            return f"{cardinal(a)} {_FRAC[b][0 if a == 1 else 1]}"
        ctx.aviso(f"'{m.group(0)}' lido como '{cardinal(a)} barra {cardinal(b)}' — use {{{m.group(0)}|como falar}} se for outra leitura.")
        return f"{cardinal(a)} barra {cardinal(b)}"
    return _sub(ctx, "fracao", r"(?<![\w/,.])(\d{1,3})/(\d{1,3})(?![\w/])", r, t)


def faixas(t: str, ctx: Ctx) -> str:
    """10-20 -> 10 a 20 (só quando o segundo número é maior: evita códigos como 737-200)."""
    def r(m):
        a, b = parse_br(m.group(1)), parse_br(m.group(2))
        if not a or not b or b[0] <= a[0]:
            return None
        ctx.aviso(f"'{m.group(0)}' lido como faixa ('{m.group(1)} a {m.group(2)}').")
        return f"{m.group(1)} a {m.group(2)}"
    return _sub(ctx, "faixa", rf"(?<![\w,.\-/])({NUM}(?:,\d+)?)\s?-\s?({NUM}(?:,\d+)?)(?![\w\-/]|[.,]\d)", r, t)


def numeros_gerais(t: str, ctx: Ctx) -> str:
    t = _sub(ctx, "negativo", r"(?:(?<=\s)|^)-(?=\d)", lambda m: "menos ", t, flags=re.M)
    # versões e números pontuados que não são milhar: 1.5, 4.0.543
    def versao(m):
        if parse_br(m.group(0)) is not None:
            return None
        return " ponto ".join(numero(p) for p in m.group(0).split("."))
    t = _sub(ctx, "versao", r"(?<![\w,.])\d+(?:\.\d+)+(?![\w,]|\.\d)", versao, t)

    def geral(m):
        s = m.group(0)
        bruto = s.replace(".", "").split(",")[0]
        if len(bruto) >= 10 and "." not in s:
            return digitos(bruto)
        prox = _prox_palavra(m.string, m.end())
        fem = e_feminino(prox) and "," not in s
        ext = numero(s, fem)
        p = parse_br(s)
        if p and p[1] is None and p[0] >= 10 ** 6 and p[0] % 10 ** 6 == 0 and prox and prox.lower() not in _NAO_SUBST and prox.islower():
            ext += " de"
        return ext
    t = _sub(ctx, "numero", rf"(?<![\w,.])(?:{NUM})(?:,\d+)?(?![\w]|,\d|\.\d)", geral, t)
    return t


def alfanumericos(t: str, ctx: Ctx) -> str:
    """Códigos como MP4, 5G, 3D, 1080p, H264: letras soletradas, números por extenso."""
    t = _sub(ctx, "versao", r"(?<![\w.])v(\d+(?:\.\d+)*)(?![\w]|\.\d)",
             lambda m: "versão " + " ponto ".join(numero(p) for p in m.group(1).split(".")), t)

    def r(m):
        tok = m.group(0)
        partes = re.findall(r"\d+|[^\W\d_]+", tok)
        out = []
        for p in partes:
            if p.isdigit():
                out.append(digitos(p) if len(p) > 4 or (p.startswith("0") and len(p) > 1) else cardinal(int(p)))
            elif (p.isupper() and len(p) <= 4) or len(p) == 1:
                out.append(ctx.proteger("ipa", {"ipa": soletrar_ipa(p), "fala": soletrar(p)}, p))
            else:
                out.append(p)
        return " ".join(out)
    return _sub(ctx, "alfanumerico", r"(?<![\w.,/-])(?=[^\W_]*\d)(?=[^\W_]*[^\W\d_])[^\W_]{2,8}(?![\w]|-\d)", r, t)


def _sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


# ---------------------------------------------------------------- símbolos
def simbolos(t: str, ctx: Ctx) -> str:
    regras = [
        (r"\s*&\s*", " e "),
        (r"(?<=\w)\s?\+\s?(?=\w)", " mais "),
        (r"(?<=\w)\+(?!\w)", " mais"),
        (r"\s*=\s*", " igual a "),
        (r"\s*≥\s*", " maior ou igual a "), (r"\s*≤\s*", " menor ou igual a "),
        (r"(?<=\s)>(?=\s)", "maior que"), (r"(?<=\s)<(?=\s)", "menor que"),
        (r"[~≈]\s?(?=[\w\ue000])", "cerca de "),
        (r"\s*(?:→|->|=>)\s*", ", "),
        (r"§\s?", "parágrafo "),
        (r"(?<!\w)@(?=\w)", "arroba "),
        (r"(?<!\w)#(?=[^\W\d_])", "hashtag "),
        (r"(?<!\w)#(?=[\d\ue000])", "número "),
    ]
    for padrao, novo in regras:
        t = _sub(ctx, "simbolo", padrao, lambda m, novo=novo: novo, t)

    def barra(m):
        ctx.aviso(f"'{m.group(0)}' lido como '{m.group(1)} ou {m.group(2)}' — confira se a barra significa 'ou'.")
        return f"{m.group(1)} ou {m.group(2)}"
    t = _sub(ctx, "barra", r"\b([^\W\d_]{2,})/([^\W\d_]{2,})\b", barra, t)
    t = re.sub(r"[*_\\|^<>]+", " ", t)
    return t


# ---------------------------------------------------------------- siglas
_ONSET = {"pr", "br", "tr", "dr", "cr", "gr", "fr", "vr", "pl", "bl", "cl", "gl", "fl", "ch", "lh", "nh", "qu", "gu"}
_CODA_DUPLA = {"ns", "rs", "ls", "sp", "st", "ng", "nd", "nt", "rt", "rd"}
_VOGAIS = set("aeiouáéíóúâêôãõ")


def pronunciavel(sigla: str) -> bool:
    """A sigla pode ser lida como palavra em português (ONU, NASA) ou deve ser soletrada (CPF, IBGE)?"""
    s = _sem_acento(sigla.lower())
    if len(s) < 3 or not s.isalpha():
        return False
    v = [c in "aeiou" for c in s]
    if not any(v) or all(v) or s[0] == "h":
        return False
    grupos = re.findall(r"[^aeiou]+", s)
    for g in grupos:
        if len(g) >= 3 and not (len(g) == 3 and g[0] in "srlmn" and g[1:] in _ONSET):
            return False
    ini = re.match(r"[^aeiou]+", s)
    if ini and len(ini.group(0)) == 2 and ini.group(0) not in _ONSET:
        return False
    fim = re.search(r"[^aeiou]+$", s)
    if fim and len(fim.group(0)) == 2 and fim.group(0) not in _CODA_DUPLA:
        return False
    for mm in re.finditer(r"(?<=[aeiou])([^aeiou]{2})(?=[aeiou])", s):
        g = mm.group(1)
        if not (g[0] in "srlmnx" or g in _ONSET or g[0] == g[1]):
            return False
    if re.search(r"[aeiou]{3}", s):
        return False
    return True


def soletrar(sigla: str) -> str:
    """'IBGE' -> 'i bê gê é' (nomes das letras; usado como alternativa quando o motor não aceita IPA)."""
    return " ".join(LETRAS[c] for c in _sem_acento(sigla.lower()) if c in LETRAS)


def soletrar_ipa(sigla: str) -> str:
    """'HTML' -> 'aɡˌatˌeˌemeˈɛly': soletração com o ritmo compacto de uma sigla, não de palavras soltas."""
    letras = [_LETRA_IPA[c] for c in _sem_acento(sigla.lower()) if c in _LETRA_IPA]
    return "".join(pre + ("ˈ" if i == len(letras) - 1 else "ˌ") + resto for i, (pre, resto) in enumerate(letras))


def proteger_soletrado(ctx: Ctx, sigla: str, plural: str = "") -> str:
    return ctx.proteger("ipa", {"ipa": soletrar_ipa(sigla) + ("s" if plural else ""),
                                "fala": soletrar(sigla) + plural}, sigla + plural)


def siglas(t: str, ctx: Ctx) -> str:
    def r(m):
        tok = m.group(1)
        plural = m.group(2) or ""
        def como_palavra():
            # o espeak-ng ora lê, ora soletra palavras em caixa alta conforme o contexto;
            # com só a inicial maiúscula a leitura como palavra é estável
            ctx.log("sigla", tok, f"{tok} (lida como palavra)")
            return ctx.proteger("motor", tok.capitalize() + plural, tok + plural)
        if tok.lower() in _PALAVRAS_CURTAS and len(tok) <= 3:
            return como_palavra()
        if ctx.lexico and ctx.lexico.sigla_como_palavra(tok):
            return como_palavra()
        if re.fullmatch(r"[IVX]{2,5}", tok) and romano(tok) and not plural:
            ctx.aviso(f"'{tok}' lido como numeral romano ({romano(tok)}).")
            ctx.log("romano", tok, cardinal(romano(tok)))
            return cardinal(romano(tok))
        if len(tok) >= 3 and pronunciavel(tok):
            if len(tok) <= 5:
                ctx.aviso(f"Sigla '{tok}' lida como palavra. Para soletrar, adicione-a ao dicionário (config/pronunciations.json).")
            return como_palavra()
        ext = soletrar(tok)
        if len(tok) > 2 and any(c in "AEIOU" for c in _sem_acento(tok)):
            ctx.aviso(f"Sigla '{tok}' soletrada ('{ext}'). Para outra leitura, adicione-a ao dicionário.")
        ctx.log("sigla", tok, f"{tok} (soletrada: {ext})")
        return proteger_soletrado(ctx, tok, plural)

    def aplicar(m):
        novo = r(m)
        return m.group(0) if novo is None else novo
    return re.sub(r"(?<![\w&-])([A-ZÀ-Ý]{2,6})(s?)(?![\w&]|-\w)", aplicar, t)


# ---------------------------------------------------------------- oralidade por perfil
_CONTRACOES = [
    (r"\bpara os\b", "pros"), (r"\bpara as\b", "pras"), (r"\bpara o\b", "pro"), (r"\bpara a\b", "pra"),
    (r"\bpara\b", "pra"), (r"\bestão\b", "tão"), (r"\bestá\b", "tá"), (r"\bestou\b", "tô"),
    (r"\bestavam\b", "tavam"), (r"\bestava\b", "tava"), (r"\bnão é\?", "né?"),
]


def oralidade(t: str, ctx: Ctx) -> str:
    if ctx.oral.get("contracoes"):
        for padrao, novo in _CONTRACOES:
            def r(m, novo=novo):
                return novo.capitalize() if m.group(0)[0].isupper() else novo
            t = _sub(ctx, "contracao", padrao, r, t, flags=re.I)
    return t


# ---------------------------------------------------------------- pontuação
def pontuacao(t: str, ctx: Ctx) -> str:
    t = re.sub(r"[\"']", "", t) if not re.search(r"\w'\w", t) else re.sub(r"\"|(?<!\w)'|'(?!\w)", "", t)
    # parênteses e colchetes viram incisos entre vírgulas
    def inciso(m):
        dentro = m.group(1).strip(" ,")
        return f", {dentro}," if dentro else " "
    t = _sub(ctx, "parenteses", r"\s*[(\[]([^()\[\]]*)[)\]]", inciso, t)
    t = re.sub(r"[()\[\]{}]", " ", t)
    t = re.sub(r"!{2,}", "!", t)
    t = re.sub(r"\?{2,}", "?", t)
    t = re.sub(r"[?!]*\?[?!]*", "?", t)
    t = re.sub(r"…+", "…", t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\s+([,.;:!?…])", r"\1", t)
    t = re.sub(r",(?:\s*,)+", ",", t)
    t = re.sub(r",\s*([.;:!?…])", r"\1", t)
    t = re.sub(r"([.;:!?…])\s*,", r"\1", t)
    t = re.sub(r"—\s*([,.;:!?…])", r"\1", t)
    t = re.sub(r"([,;:])\s*—", r"\1", t)
    t = re.sub(r"\.{2,}", ".", t)
    t = re.sub(r"([,;:])(?=[^\s\d])", r"\1 ", t)
    t = re.sub(r"^[ \t,;:—]+", "", t, flags=re.M)
    return t.strip()

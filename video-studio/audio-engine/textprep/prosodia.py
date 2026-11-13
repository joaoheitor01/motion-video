"""Segmentação em blocos de fala: frases, pausas, respiração e parágrafos."""
import re

from .regras import ABRE, FECHA, _PH, Ctx

_T1 = {"mas", "porém", "porque", "pois", "quando", "enquanto", "embora", "portanto", "contudo",
       "entretanto", "todavia"}
_T2 = {"e", "ou", "nem"}
_T3 = {"para", "pra", "onde", "sem"}
_NUM_PALAVRAS = set("""zero um uma dois duas três quatro cinco seis sete oito nove dez onze doze treze catorze
quinze dezesseis dezessete dezoito dezenove vinte trinta quarenta cinquenta sessenta setenta oitenta noventa
cem cento duzentos duzentas trezentos trezentas quatrocentos quatrocentas quinhentos quinhentas seiscentos
seiscentas setecentos setecentas oitocentos oitocentas novecentos novecentas mil milhão milhões bilhão
bilhões trilhão trilhões meio meia real reais centavo centavos dólar dólares euro euros hora horas minuto
minutos segundo segundos vírgula ponto por""".split())
_FIM = ".!?…"


def _palavras(s: str) -> int:
    return len(re.findall(r"[^\s,;:—.!?…]+", s))


def respiracao(frase: str, ctx: Ctx, max_palavras: int) -> str:
    """Insere uma vírgula (pausa de respiração) em trechos longos sem pontuação.

    Só quebra antes de conjunções/preposições, nunca dentro de números por extenso, e
    apenas quando os dois lados ficam com pelo menos 5 palavras.
    """
    if not max_palavras:
        return frase

    def quebrar(trecho: str) -> str:
        w = trecho.split(" ")
        if len(w) <= max_palavras:
            return trecho
        meio = len(w) / 2
        melhor = None
        for nivel, conj in enumerate((_T1, _T2, _T3)):
            for i in range(5, len(w) - 4):
                p = w[i].lower()
                if p not in conj:
                    continue
                if w[i - 1].lower() in _NUM_PALAVRAS and (i + 1 < len(w) and w[i + 1].lower() in _NUM_PALAVRAS):
                    continue  # "vinte e cinco", "reais e dez centavos"
                custo = (nivel, abs(i - meio))
                if melhor is None or custo < melhor[0]:
                    melhor = (custo, i)
            if melhor:
                break
        if not melhor:
            return trecho
        i = melhor[1]
        esq, dir_ = " ".join(w[:i]), " ".join(w[i:])
        ctx.log("respiracao", f"… {' '.join(w[max(0, i - 2):i + 2])} …", f"… {' '.join(w[max(0, i - 2):i])}, {' '.join(w[i:i + 2])} …")
        return quebrar(esq) + ", " + quebrar(dir_)

    partes = re.split(r"([,;:—]\s*|[.!?…]+\s*)", frase)
    return "".join(p if i % 2 else quebrar(p) for i, p in enumerate(partes))


def _fechar(frase: str) -> str:
    frase = frase.strip(" ,;—")
    if not frase:
        return ""
    if frase[-1] not in _FIM + ":":
        frase += "."
    for i, c in enumerate(frase):  # primeira letra maiúscula (sem mexer em marcadores)
        if c in (ABRE, FECHA) or "\ue100" <= c <= "\uf8ff":
            if c == FECHA:
                break
            continue
        if c.isalpha():
            frase = frase[:i] + c.upper() + frase[i + 1:]
            break
        if not c.isspace():
            break
    return frase


def segmentar(texto: str, ctx: Ctx) -> list[dict]:
    """Retorna blocos {texto (com marcadores), pausa (s), tipo} na ordem de fala."""
    pros = ctx.perfil.get("prosodia", {})
    p_frase = pros.get("pausa_frase", 0.35)
    p_par = pros.get("pausa_paragrafo", 0.7)
    max_folego = pros.get("max_palavras_folego", 22)
    min_bloco = pros.get("min_palavras_bloco", 3)
    idx_pausas = "".join(chr(0xE100 + i) for i, it in enumerate(ctx.protegidos) if it["tipo"] == "pausa")
    re_pausa = re.compile(f"({ABRE}[{idx_pausas}]{FECHA})") if idx_pausas else None

    def tem_conteudo(s: str) -> bool:
        return bool(re.search(r"[^\W_]|" + ABRE, s))

    blocos: list[dict] = []
    for par in re.split(r"\n\s*\n", texto):
        linhas = [ln.strip() for ln in par.split("\n") if ln.strip()]
        par_txt = " ".join(ln if ln[-1] in _FIM + ":;," or (re_pausa and re_pausa.search(ln[-3:])) else ln + "."
                           for ln in linhas)
        if not par_txt:
            continue
        pedacos = re_pausa.split(par_txt) if re_pausa else [par_txt]
        frases_par: list[dict] = []
        for k, ped in enumerate(pedacos):
            if k % 2:  # marcador de pausa explícita
                valor = ctx.item(_PH.fullmatch(ped))["valor"]
                alvo = frases_par[-1] if frases_par else (blocos[-1] if blocos else None)
                if alvo:
                    alvo["pausa"], alvo["tipo"] = valor, "explicita"
                continue
            if not tem_conteudo(ped):
                continue
            suspensa = k + 1 < len(pedacos) and ped.strip()[-1] not in _FIM + ":"
            frases = [f for f in re.split(r"(?<=[.!?…])\s+", ped) if tem_conteudo(f)]
            for j, fr in enumerate(frases):
                fr = _fechar(respiracao(fr, ctx, max_folego))
                if suspensa and j == len(frases) - 1:
                    fr = fr[:-1] + ","  # pausa no meio da frase: entonação suspensa, não final
                mod = 1.25 if fr.endswith("…") else 1.1 if fr.endswith("?") else 0.75 if fr.endswith(":") else 1.0
                frases_par.append({"texto": fr, "pausa": round(p_frase * mod, 3), "tipo": "frase"})
        # junta frases muito curtas à vizinha (blocos curtos saem em ritmo/volume diferentes)
        juntas: list[dict] = []
        for f in frases_par:
            if juntas and juntas[-1]["tipo"] == "frase" and _palavras(juntas[-1]["texto"]) < min_bloco:
                juntas[-1] = {"texto": juntas[-1]["texto"] + " " + f["texto"], "pausa": f["pausa"], "tipo": f["tipo"]}
            else:
                juntas.append(dict(f))
        if len(juntas) > 1 and _palavras(juntas[-1]["texto"]) < min_bloco and juntas[-2]["tipo"] == "frase":
            ult = juntas.pop()
            juntas[-1] = {"texto": juntas[-1]["texto"] + " " + ult["texto"], "pausa": ult["pausa"], "tipo": ult["tipo"]}
        if juntas:
            if juntas[-1]["tipo"] != "explicita":
                juntas[-1]["pausa"], juntas[-1]["tipo"] = p_par, "paragrafo"
            blocos.extend(juntas)
    if blocos:
        blocos[-1]["pausa"] = 0.0
    return blocos

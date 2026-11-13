"""Números por extenso em português brasileiro (cardinais, ordinais, decimais), com gênero."""
import re

_UNID = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
         "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"]
_DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
_CENT = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos",
         "setecentos", "oitocentos", "novecentos"]
_ESCALAS = [None, ("mil", "mil"), ("milhão", "milhões"), ("bilhão", "bilhões"), ("trilhão", "trilhões")]

_ORD_U = ["", "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo", "oitavo", "nono"]
_ORD_D = ["", "décimo", "vigésimo", "trigésimo", "quadragésimo", "quinquagésimo", "sexagésimo",
          "septuagésimo", "octogésimo", "nonagésimo"]
_ORD_C = ["", "centésimo", "ducentésimo", "trecentésimo", "quadringentésimo", "quingentésimo",
          "sexcentésimo", "septingentésimo", "octingentésimo", "nongentésimo"]

# Substantivos femininos frequentes depois de números (a lista é complementada por sufixos).
_FEM = set("""pessoa vez hora semana página cena etapa voz empresa casa mulher criança família cidade
pergunta resposta opção parte fase linha tela imagem foto música faixa trilha palavra frase letra sílaba
loja venda compra unidade peça caixa garrafa xícara colher gota dose porção fatia nota prova aula turma
escola equipe vaga conta taxa parcela ação regra lei norma meta ideia dica forma maneira área região
rua avenida estrada viagem volta rodada partida vitória derrota medalha estrela noite manhã tarde
década geração versão edição sessão seção reunião missão função condição solução questão razão
tonelada grama? milha polegada jarda libra caloria camada cópia chamada mensagem ligação visita
vida morte dor luz cor flor mão viagem ordem origem margem nuvem base classe fonte ponte rede sede
ferramenta máquina câmera lente bateria memória pasta planilha tabela coluna célula chave senha
variável categoria marca oferta promoção assinatura licença pontuação""".replace("?", "").split())
# Masculinos terminados em -a (não seguem a regra do sufixo).
_MASC_A = set("""dia problema sistema programa tema mapa idioma clima planeta cinema drama poema esquema
diploma telefonema panorama dilema emblema pijama sofá quilograma grama miligrama cometa fantasma
aroma axioma carisma dogma enigma estigma lema paradigma plasma prisma sintoma teorema trauma
cinema papa mama""".split())
_FEM_SUFIXOS = ("ção", "ções", "são", "sões", "dade", "dades", "agem", "agens", "tude", "tudes",
                "ência", "ências", "ância", "âncias", "eza", "ezas", "ice", "ices")


def e_feminino(palavra: str) -> bool:
    """Heurística conservadora: a palavra seguinte ao número pede forma feminina (uma, duas, duzentas)?"""
    w = (palavra or "").lower().strip(".,;:!?()\"'")
    if not w:
        return False
    sing = w[:-1] if w.endswith("s") and len(w) > 3 else w
    if w in _MASC_A or sing in _MASC_A:
        return False
    if w in _FEM or sing in _FEM:
        return True
    if w.endswith(("ões", "ães")):
        sing = w[:-3] + "ão"
        if sing in _FEM:
            return True
    if w.endswith("ns") and (w[:-2] + "m") in _FEM:
        return True
    if w.endswith("es") and w[:-2] in _FEM:
        return True
    if w.endswith(_FEM_SUFIXOS):
        return True
    return sing.endswith("a") and len(sing) > 3


def _ate999(n: int, fem: bool) -> str:
    if n == 100:
        return "cem"
    partes = []
    c, r = divmod(n, 100)
    if c:
        partes.append(_CENT[c][:-2] + "as" if fem and c > 1 else _CENT[c])
    if r:
        def un(u):
            return {1: "uma", 2: "duas"}.get(u, _UNID[u]) if fem else _UNID[u]
        if r < 20:
            partes.append(un(r) if r < 3 else _UNID[r])
        else:
            d, u = divmod(r, 10)
            partes.append(_DEZ[d] + (f" e {un(u)}" if u else ""))
    return " e ".join(partes)


def cardinal(n: int, fem: bool = False) -> str:
    """1234 -> 'mil duzentos e trinta e quatro'; fem=True -> 'duas', 'duzentas'."""
    if n < 0:
        return "menos " + cardinal(-n, fem)
    if n == 0:
        return "zero"
    if n >= 10 ** 15:
        return digitos(str(n))
    grupos = []
    i = 0
    while n:
        n, g = divmod(n, 1000)
        if g:
            grupos.append((g, i))
        i += 1
    grupos.reverse()
    palavras = []
    for g, esc in grupos:
        if esc == 0:
            palavras.append(_ate999(g, fem))
        elif esc == 1:
            palavras.append("mil" if g == 1 else _ate999(g, fem) + " mil")
        else:
            palavras.append(_ate999(g, False) + " " + _ESCALAS[esc][0 if g == 1 else 1])
    if len(palavras) == 1:
        return palavras[0]
    ultimo = grupos[-1][0]
    liga = " e " if (ultimo < 100 or ultimo % 100 == 0) else " "
    return " ".join(palavras[:-1]) + liga + palavras[-1]


def ordinal(n: int, fem: bool = False) -> str:
    if n <= 0 or n > 1000:
        return cardinal(n, fem)
    if n == 1000:
        w = "milésimo"
    else:
        c, r = divmod(n, 100)
        d, u = divmod(r, 10)
        w = " ".join(x for x in (_ORD_C[c], _ORD_D[d], _ORD_U[u]) if x)
    if fem:
        w = " ".join(p[:-1] + "a" for p in w.split())
    return w


def digitos(s: str, meia: bool = False) -> str:
    """'0800' -> 'zero oito zero zero'; meia=True lê 6 como 'meia' (convenção de telefone)."""
    return " ".join("meia" if (meia and ch == "6") else _UNID[int(ch)] for ch in s if ch.isdigit())


def parse_br(s: str):
    """'1.234,56' -> (1234, '56'); '2026' -> (2026, None). Retorna None se não for número pt-BR."""
    m = re.fullmatch(r"(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?", s)
    if not m:
        return None
    return int(m.group(1).replace(".", "")), m.group(2)


def numero(s: str, fem: bool = False) -> str:
    """Lê um número escrito em formato brasileiro (com milhar e decimal opcionais)."""
    p = parse_br(s)
    if p is None:
        return s
    inteiro, dec = p
    bruto = s.split(",")[0].replace(".", "")
    if len(bruto) > 1 and bruto.startswith("0") and dec is None:
        return digitos(bruto)  # códigos como 007
    if dec is None:
        return cardinal(inteiro, fem)
    zeros = len(dec) - len(dec.lstrip("0"))
    resto = dec.lstrip("0")
    partes = ["zero"] * zeros + ([cardinal(int(resto))] if resto else [])
    if len(dec) > 3:  # muitas casas: dígito a dígito
        partes = [digitos(dec)]
    return f"{cardinal(inteiro)} vírgula {' '.join(partes)}"


_ROM = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


def romano(s: str):
    """'XXI' -> 21; None se não for numeral romano canônico."""
    if not s or not re.fullmatch(r"M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})", s):
        return None
    total = 0
    for a, b in zip(s, s[1:] + " "):
        v = _ROM[a]
        total += -v if b in _ROM and _ROM[b] > v else v
    return total or None

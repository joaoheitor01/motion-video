"""Grafema -> fonema (espeak-ng pt-br), no formato esperado por cada motor.

O Kokoro v1.0 foi treinado com o G2P do pacote `misaki` (EspeakG2P): espeak-ng com ligaduras
('^') convertidas em símbolos únicos (t^ʃ -> ʧ, d^ʒ -> ʤ, e^ɪ -> A, a^ɪ -> I, a^ʊ -> W ...).
O `kokoro-onnx` não aplica essa conversão; aqui ela é reproduzida para que o modelo receba
os mesmos símbolos que viu no treino.
"""
import re
import threading

_trava = threading.Lock()
_backends: dict = {}

# misaki.espeak.EspeakG2P.e2m (versão 1.0 do modelo)
_E2M = sorted({
    "a^ɪ": "I", "a^ʊ": "W", "d^z": "ʣ", "d^ʒ": "ʤ", "e^ɪ": "A", "o^ʊ": "O", "ə^ʊ": "Q",
    "s^s": "S", "t^s": "ʦ", "t^ʃ": "ʧ", "ɔ^ɪ": "Y",
}.items())
_PONT_INI = re.compile(r"^[\s,.;:!?…—]+")


def _backend(tie: bool):
    chave = ("pt-br", tie)
    if chave not in _backends:
        import espeakng_loader
        import phonemizer
        from phonemizer.backend.espeak.wrapper import EspeakWrapper
        EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
        EspeakWrapper.set_library(espeakng_loader.get_library_path())
        _backends[chave] = phonemizer.backend.EspeakBackend(
            language="pt-br", preserve_punctuation=True, with_stress=True,
            tie="^" if tie else False, language_switch="remove-flags")
    return _backends[chave]


def ipa(texto: str) -> str:
    """Fonemas IPA simples (para relatórios e para conferir entradas do dicionário)."""
    with _trava:
        return _backend(False).phonemize([texto])[0].strip()


def kokoro(texto: str) -> str:
    """Fonemas no formato de treino do Kokoro (equivalente a misaki.espeak.EspeakG2P('pt-br'))."""
    texto = texto.replace("«", "“").replace("»", "”").replace("(", "«").replace(")", "»")
    with _trava:
        ps = _backend(True).phonemize([texto])[0].strip()
    for antigo, novo in _E2M:
        ps = ps.replace(antigo, novo)
    ps = ps.replace("^", "").replace("-", "")
    return ps.replace("«", "(").replace("»", ")")


def ipa_para_kokoro(s: str) -> str:
    """Converte IPA escrito à mão (sem ligaduras) para os símbolos do Kokoro."""
    for antigo, novo in (("tʃ", "ʧ"), ("dʒ", "ʤ"), ("ts", "ʦ"), ("dz", "ʣ"), ("aɪ", "I"), ("aʊ", "W"),
                         ("eɪ", "A"), ("oʊ", "O"), ("ɔɪ", "Y"), ("g", "ɡ")):
        s = s.replace(antigo, novo)
    return s


def separar_pontuacao_inicial(trecho: str) -> tuple[str, str]:
    m = _PONT_INI.match(trecho)
    return (m.group(0).strip(), trecho[m.end():]) if m else ("", trecho)

"""Medidas objetivas de ritmo e entonação de uma narração (apoio à avaliação por escuta).

Não medem "naturalidade" — isso só o ouvido humano avalia. Medem o que dá para medir:
pausas (quantas, onde, quanto duram), velocidade de fala e variação de tom.
"""
import re

import numpy as np
import soundfile as sf

_VOGAIS = "aeiouɛɔæɐəɪʊyAIWOYQ"


def silabas(ipa: str) -> int:
    """Estimativa de sílabas: grupos de vogais na transcrição fonética."""
    return len(re.findall(rf"[{_VOGAIS}][{_VOGAIS}̃ː]*", ipa))


def _quadros(x: np.ndarray, sr: int, ms: float = 10.0) -> np.ndarray:
    q = max(1, int(sr * ms / 1000))
    n = len(x) // q
    return np.sqrt((x[: n * q].reshape(n, q) ** 2).mean(1)) if n else np.zeros(0)


def pausas(x: np.ndarray, sr: int, min_s: float = 0.12, db: float = -35.0) -> list[tuple[float, float]]:
    """Silêncios internos (início, duração) com pelo menos min_s segundos."""
    r = _quadros(x, sr)
    if not len(r) or r.max() <= 0:
        return []
    ativo = r > r.max() * 10 ** (db / 20)
    idx = np.nonzero(ativo)[0]
    if not len(idx):
        return []
    out, ini = [], None
    for i in range(idx[0], idx[-1] + 1):
        if not ativo[i] and ini is None:
            ini = i
        elif ativo[i] and ini is not None:
            if (i - ini) * 0.01 >= min_s:
                out.append((round(ini * 0.01, 2), round((i - ini) * 0.01, 2)))
            ini = None
    return out


def f0(x: np.ndarray, sr: int) -> np.ndarray:
    """Frequência fundamental por autocorrelação (quadros sonoros de 40 ms, passo de 10 ms)."""
    jan, passo = int(sr * 0.04), int(sr * 0.01)
    lo, hi = int(sr / 400), int(sr / 70)
    if len(x) < jan:
        return np.zeros(0)
    limiar = _quadros(x, sr).max() * 10 ** (-25 / 20)
    w = np.hanning(jan)
    vals = []
    for i in range(0, len(x) - jan, passo):
        q = x[i:i + jan]
        if np.sqrt((q ** 2).mean()) < limiar:
            continue
        q = (q - q.mean()) * w
        ac = np.fft.irfft(np.abs(np.fft.rfft(q, 2 * jan)) ** 2)[:jan]
        if ac[0] <= 0:
            continue
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] / ac[0] > 0.45:
            vals.append(sr / k)
    return np.array(vals)


def medir(caminho, ipa_falado: str) -> dict:
    x, sr = sf.read(str(caminho), dtype="float32")
    if x.ndim > 1:
        x = x.mean(1)
    ps = pausas(x, sr)
    r = _quadros(x, sr)
    ativos = np.nonzero(r > r.max() * 10 ** (-35 / 20))[0] if len(r) and r.max() > 0 else np.array([0])
    util = (ativos[-1] - ativos[0] + 1) * 0.01
    t_pausa = sum(d for _, d in ps)
    fala = max(util - t_pausa, 0.01)
    f = f0(x, sr)
    st = 12 * np.log2(f / np.median(f)) if len(f) > 5 else np.zeros(1)
    n_sil = silabas(ipa_falado)
    return {
        "duracao_s": round(len(x) / sr, 2),
        "fala_s": round(fala, 2),
        "silabas": n_sil,
        "silabas_por_s": round(n_sil / fala, 2),
        "pausas": len(ps),
        "pausa_total_s": round(t_pausa, 2),
        "pausa_media_s": round(t_pausa / len(ps), 2) if ps else 0.0,
        "pausa_maior_s": round(max((d for _, d in ps), default=0.0), 2),
        "pausa_pct": round(100 * t_pausa / max(util, 0.01), 1),
        "f0_mediana_hz": round(float(np.median(f)), 1) if len(f) else 0.0,
        "f0_variacao_st": round(float(np.std(st)), 2),
        "f0_faixa_st": round(float(np.percentile(st, 95) - np.percentile(st, 5)), 2),
        "pico_dbfs": round(20 * np.log10(max(float(np.abs(x).max()), 1e-9)), 1),
        "lista_pausas": ps,
    }

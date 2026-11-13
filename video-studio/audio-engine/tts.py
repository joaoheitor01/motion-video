"""Narração local em pt-BR: pré-processamento linguístico + Kokoro/Piper com fallback.

Uso:
  python tts.py --text "Custa R$ 99,90." --voice narradora --perfil comercial --out out.wav
  python tts.py --batch jobs.json            # [{"text","voice","out","perfil"?,"prep"?,"lexico"?}]
  python tts.py --mostrar "texto" [--perfil comercial] [--fonemas]   # só mostra a adaptação
Saída (stdout): JSON. Mensagens de diagnóstico vão para stderr.

Fluxo de uma narração:
  texto -> textprep.preparar (texto falado + blocos + pausas) -> motor (por bloco)
        -> nivelamento e junção com pausas do perfil -> WAV + <saida>.tts.json (auditoria)
Fallback: se o motor principal da voz falhar, usa o motor de reserva. Num lote, todas as
narrações da mesma voz são refeitas no motor de reserva, para o vídeo não trocar de voz no meio.
"""
import argparse
import hashlib
import io
import json
import os
import sys
import wave
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parent
ESTUDIO = RAIZ.parent
sys.path.insert(0, str(RAIZ))

import textprep  # noqa: E402
from textprep import g2p  # noqa: E402

VOZES = json.loads((ESTUDIO / "config" / "voices.json").read_text(encoding="utf-8"))
_FALHAR = {x for x in os.environ.get("STUDIO_TTS_FALHAR", "").split(",") if x}  # teste de fallback


def log(*a):
    print("[tts]", *a, file=sys.stderr, flush=True)


# ------------------------------------------------------------------ áudio
def aparar(x: np.ndarray, sr: int, db: float = -45.0, margem: float = 0.015) -> np.ndarray:
    """Remove silêncio nas bordas (mantém uma pequena margem)."""
    if len(x) == 0:
        return x
    q = max(1, int(sr * 0.01))
    n = len(x) // q
    if n < 3:
        return x
    rms = np.sqrt((x[: n * q].reshape(n, q) ** 2).mean(1))
    ativos = np.nonzero(rms > rms.max() * 10 ** (db / 20))[0]
    if len(ativos) == 0:
        return x
    m = int(margem * sr)
    return x[max(0, ativos[0] * q - m): min(len(x), (ativos[-1] + 1) * q + m)]


def rms_ativo(x: np.ndarray, sr: int) -> float:
    q = max(1, int(sr * 0.02))
    n = len(x) // q
    if n == 0:
        return 0.0
    r = np.sqrt((x[: n * q].reshape(n, q) ** 2).mean(1))
    ativos = r[r > r.max() * 10 ** (-30 / 20)]
    return float(np.sqrt((ativos ** 2).mean())) if len(ativos) else 0.0


def bordas_suaves(x: np.ndarray, sr: int, ms: float = 6.0) -> np.ndarray:
    n = min(int(sr * ms / 1000), len(x) // 2)
    if n > 0:
        rampa = np.linspace(0.0, 1.0, n, dtype=np.float32)
        x = x.copy()
        x[:n] *= rampa
        x[-n:] *= rampa[::-1]
    return x


def gravar_wav(caminho: Path, x: np.ndarray, sr: int):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(x, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(caminho), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


# ------------------------------------------------------------------ motores
class MotorKokoro:
    nome = "kokoro"
    sr = 24000
    _k = None

    def _carregar(self):
        if MotorKokoro._k is None:
            from kokoro_onnx import Kokoro
            MotorKokoro._k = Kokoro(str(RAIZ / "models/kokoro/kokoro-v1.0.onnx"),
                                    str(RAIZ / "models/kokoro/voices-v1.0.bin"))
        return MotorKokoro._k

    _ANCORAS = {"vogal": "ata", "sonora": "bata", "surda": "pata"}

    @staticmethod
    def _classe(ipa: str) -> str:
        c = next((ch for ch in ipa if ch not in "ˈˌ "), "a")
        if c in "aeiouɛɔæɐəɪʊyAIWOYQ":
            return "vogal"
        return "sonora" if c in "bdɡgvzʒmnɲlʎrɾxʤʣjw" else "surda"

    def fonemas(self, partes: list[dict], formato: str = "kokoro") -> str:
        """Fonemas no formato de treino do modelo; trechos IPA (siglas, dicionário) entram direto.
        formato="ipa" devolve a mesma leitura em IPA comum (para relatórios e testes).

        Um trecho de texto que termina logo antes de um trecho IPA é fonetizado junto com uma
        palavra-âncora (depois descartada): sozinho, o espeak-ng trataria o artigo final
        ("segundo o ...") como palavra tônica e erraria a ligação com a palavra seguinte.
        """
        vocab = self._carregar().tokenizer.vocab
        ipas = [g2p.ipa_para_kokoro(p["ipa"]) if "ipa" in p else None for p in partes]
        ipas = [f if f and all(c in vocab for c in f) else None for f in ipas]
        fon = g2p.kokoro if formato == "kokoro" else g2p.ipa
        out: list[str] = []
        for i, p in enumerate(partes):
            if ipas[i]:
                out.append(ipas[i] if formato == "kokoro" else p["ipa"])
                continue
            texto = p["fala"] if "ipa" in p else p["t"]
            pont, resto = g2p.separar_pontuacao_inicial(texto)
            if pont and out:
                out[-1] += pont
            if not resto.strip():
                continue
            prox = ipas[i + 1] if i + 1 < len(partes) else None
            if prox and resto.rstrip()[-1].isalnum():
                ancora = self._ANCORAS[self._classe(prox)]
                fa, f = fon(ancora), fon(resto.rstrip() + " " + ancora)
                out.append(f[: -len(fa)].rstrip() if f.endswith(" " + fa) else fon(resto))
            else:
                out.append(fon(resto))
        return " ".join(x for x in out if x)

    def bloco(self, partes: list[dict], voz: str, cfg: dict, g2p_treino: bool = True) -> np.ndarray:
        if "kokoro" in _FALHAR:
            raise RuntimeError("falha simulada (STUDIO_TTS_FALHAR)")
        k = self._carregar()
        velocidade = float(cfg.get("speed", 1.0))
        if g2p_treino:
            x, _ = k.create(self.fonemas(partes), voice=voz, speed=velocidade, is_phonemes=True, trim=True)
        else:  # caminho original do kokoro-onnx (usado só nos testes comparativos)
            texto = "".join(p.get("t", p.get("fala", "")) for p in partes)
            x, _ = k.create(texto, voice=voz, speed=velocidade, lang="pt-br", trim=True)
        return np.asarray(x, dtype=np.float32)


class MotorPiper:
    nome = "piper"
    _vozes: dict = {}

    def _carregar(self, voz: str):
        if voz not in MotorPiper._vozes:
            from piper import PiperVoice
            modelo = RAIZ / "models" / "piper" / f"{voz}.onnx"
            if not modelo.exists():
                raise FileNotFoundError(f"modelo Piper ausente: {modelo}")
            MotorPiper._vozes[voz] = PiperVoice.load(str(modelo))
        return MotorPiper._vozes[voz]

    def texto(self, partes: list[dict], voz: str) -> str:
        """O Piper recebe só texto: trechos IPA usam a forma reescrita ('fala').

        O modelo foi treinado com os fonemas do espeak-ng embutido no Piper, que diferem dos
        usados pelo Kokoro; injetar IPA via [[ ]] também faz o texto vizinho perder pontuação.
        """
        t = "".join(p["fala"] if "ipa" in p else p["t"] for p in partes)
        # o modelo não conhece travessão nem reticências: viram pausas que ele entende
        return t.replace(" — ", ", ").replace("—", ", ").replace("…", ".")

    def bloco(self, partes: list[dict], voz: str, cfg: dict, **_) -> np.ndarray:
        if "piper" in _FALHAR:
            raise RuntimeError("falha simulada (STUDIO_TTS_FALHAR)")
        from piper import SynthesisConfig
        v = self._carregar(voz)
        self.sr = v.config.sample_rate
        sc = SynthesisConfig(length_scale=cfg.get("length_scale"), noise_scale=cfg.get("noise_scale"),
                             noise_w_scale=cfg.get("noise_w_scale"), normalize_audio=True)
        pedacos = [aparar(c.audio_float_array, self.sr) for c in v.synthesize(self.texto(partes, voz), sc)]
        if not pedacos:
            raise RuntimeError("Piper não produziu áudio")
        gap = np.zeros(int(self.sr * float(cfg.get("_pausa_frase", 0.3))), dtype=np.float32)
        juntos = []
        for i, pd in enumerate(pedacos):
            juntos += ([gap] if i else []) + [pd.astype(np.float32)]
        return np.concatenate(juntos)

    def taxa(self, voz: str) -> int:
        return self._carregar(voz).config.sample_rate


MOTORES = {"kokoro": MotorKokoro(), "piper": MotorPiper()}


# ------------------------------------------------------------------ síntese
def _cadeia(alias: str) -> list[tuple[str, str]]:
    if alias not in VOZES:
        raise KeyError(f"voz desconhecida: {alias!r}. Opções: {', '.join(VOZES)}")
    cfg = VOZES[alias]
    cadeia = [(cfg["engine"], cfg["voice"])]
    if cfg.get("fallback"):
        cadeia.append(tuple(cfg["fallback"].split(":", 1)))
    return cadeia


def _render(prep: "textprep.Preparado", motor: str, voz: str, alias: str, g2p_treino: bool = True):
    """Sintetiza os blocos, nivela e junta com as pausas do perfil. Retorna (áudio, sr, tempos)."""
    m = MOTORES[motor]
    cfg = {**prep.config.get(motor, {}), **VOZES[alias].get(motor, {}),
           "_pausa_frase": prep.config.get("prosodia", {}).get("pausa_frase", 0.3)}
    sr = m.taxa(voz) if motor == "piper" else m.sr
    audios = []
    for b in prep.blocos:
        x = aparar(m.bloco(b["partes"], voz, cfg, g2p_treino=g2p_treino), sr)
        if len(x) < sr * 0.05 or not np.isfinite(x).all():
            raise RuntimeError(f"bloco sem áudio válido: {b['falado'][:40]!r}")
        audios.append(x)
    # nivelamento entre blocos (blocos curtos tendem a sair mais altos/baixos); limite de ±4 dB
    niveis = [rms_ativo(x, sr) for x in audios]
    alvo = float(np.median([n for n in niveis if n > 0] or [0.1]))
    partes, tempos, pos = [], [], 0
    for b, x, n in zip(prep.blocos, audios, niveis):
        ganho = float(np.clip(alvo / n, 10 ** (-4 / 20), 10 ** (4 / 20))) if n > 0 else 1.0
        x = bordas_suaves(x * ganho, sr)
        silencio = np.zeros(int(round(b["pausa"] * sr)), dtype=np.float32)
        tempos.append({"inicio": round(pos / sr, 3), "fim": round((pos + len(x)) / sr, 3),
                       "pausa": b["pausa"], "tipo": b["tipo"], "falado": b["falado"]})
        partes += [x, silencio]
        pos += len(x) + len(silencio)
    audio = np.concatenate(partes) if partes else np.zeros(0, dtype=np.float32)
    pico = float(np.abs(audio).max()) if len(audio) else 0.0
    if pico > 0:
        audio = audio * (10 ** (-3 / 20) / pico)  # pico em -3 dBFS: mesmo nível de saída nos dois motores
    return audio, sr, tempos


def _validar(audio: np.ndarray, sr: int, prep: "textprep.Preparado"):
    dur = len(audio) / sr
    letras = sum(c.isalpha() for c in prep.falado)
    if dur < 0.15 or not np.isfinite(audio).all():
        raise RuntimeError("áudio vazio ou inválido")
    if rms_ativo(audio, sr) < 1e-3:
        raise RuntimeError("áudio silencioso")
    pausas = sum(b["pausa"] for b in prep.blocos)
    fala = max(dur - pausas, 0.01)
    if letras >= 20 and not (4.0 <= letras / fala <= 40.0):
        raise RuntimeError(f"ritmo implausível ({letras / fala:.1f} letras/s): síntese truncada ou travada")


def preparar_texto(texto: str, perfil=None, lexico=None, prep=True) -> "textprep.Preparado":
    if prep:
        return textprep.preparar(texto, perfil, lexico_extra=lexico)
    nome, cfg = textprep.perfil_config(perfil)
    sem_pausas = {k: v for k, v in cfg.items() if k != "prosodia"}
    return textprep.Preparado(texto, texto, [{"partes": [{"t": texto}], "falado": texto, "pausa": 0.0, "tipo": "bruto"}],
                              [], [], nome, sem_pausas)


def chave_cache(texto, alias, perfil, lexico, prep) -> str:
    h = hashlib.sha256()
    for parte in (texto, alias, json.dumps(VOZES.get(alias), sort_keys=True), str(prep),
                  textprep.assinatura(perfil, lexico), Path(__file__).read_text(encoding="utf-8")):
        h.update(parte.encode("utf-8"))
        h.update(b"\0")
    return h.hexdigest()[:20]


def sintetizar(texto: str, alias: str, saida, perfil=None, lexico=None, prep=True,
               forcar_motor: str | None = None, cache=True, g2p_treino=True) -> dict:
    saida = Path(saida)
    meta_arq = saida.with_suffix(".tts.json")
    chave = chave_cache(texto, alias, perfil, lexico, prep) + ("" if g2p_treino else "-g2p0")
    if cache and not forcar_motor and saida.exists() and meta_arq.exists():
        try:
            meta = json.loads(meta_arq.read_text(encoding="utf-8"))
            if meta.get("cache") == chave and not _FALHAR:
                return {**meta, "do_cache": True}
        except (json.JSONDecodeError, OSError):
            pass
    p = preparar_texto(texto, perfil, lexico, prep)
    if not p.blocos:
        raise ValueError(f"texto sem conteúdo falável: {texto!r}")
    cadeia = _cadeia(alias)
    if forcar_motor:
        cadeia = [c for c in cadeia if c[0] == forcar_motor] or cadeia
    erros = []
    for i, (motor, voz) in enumerate(cadeia):
        try:
            audio, sr, tempos = _render(p, motor, voz, alias, g2p_treino)
            _validar(audio, sr, p)
        except Exception as ex:  # tenta o próximo motor da cadeia
            erros.append(f"{motor}:{voz}: {type(ex).__name__}: {ex}")
            log(f"FALHA {erros[-1]}")
            continue
        gravar_wav(saida, audio, sr)
        principal = _cadeia(alias)[0]
        meta = {"path": str(saida), "sample_rate": sr, "duration_s": round(len(audio) / sr, 3),
                "engine": motor, "voice": voz, "alias": alias,
                "fallback": (motor, voz) != principal, "erros": erros,
                "perfil": p.perfil, "prep": prep, "original": p.original, "falado": p.falado,
                "blocos": tempos, "mudancas": p.mudancas, "avisos": p.avisos, "cache": chave}
        meta_arq.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        return {**meta, "do_cache": False}
    raise RuntimeError("Todos os motores falharam: " + " | ".join(erros))


def lote(jobs: list[dict], cache=True) -> list[dict]:
    res = [sintetizar(j["text"], j.get("voice", "narradora"), j["out"], j.get("perfil"), j.get("lexico"),
                      j.get("prep", True), cache=cache) for j in jobs]
    # consistência de voz: se uma narração caiu no motor reserva, todas da mesma voz vão para ele
    for alias in {r["alias"] for r in res if r["fallback"]}:
        reserva = next(r["engine"] for r in res if r["alias"] == alias and r["fallback"])
        for i, (j, r) in enumerate(zip(jobs, res)):
            if r["alias"] == alias and r["engine"] != reserva:
                log(f"refazendo {Path(j['out']).name} em {reserva} (consistência de voz)")
                res[i] = sintetizar(j["text"], alias, j["out"], j.get("perfil"), j.get("lexico"),
                                    j.get("prep", True), forcar_motor=reserva, cache=False)
                res[i]["fallback"] = True
    return res


def mostrar(texto: str, perfil=None, lexico=None, fonemas=False) -> dict:
    p = textprep.preparar(texto, perfil, lexico_extra=lexico)
    d = p.como_dict()
    if fonemas:
        d["fonemas_original"] = g2p.ipa(texto)
        d["fonemas_falado"] = g2p.ipa(p.falado)
    return d


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    ap = argparse.ArgumentParser(description="Narração local pt-BR (Kokoro/Piper) com pré-processamento.")
    ap.add_argument("--text")
    ap.add_argument("--voice", default="narradora")
    ap.add_argument("--out")
    ap.add_argument("--perfil")
    ap.add_argument("--lexico", help="dicionário extra do projeto (pronunciations.json)")
    ap.add_argument("--sem-prep", action="store_true", help="envia o texto cru ao motor")
    ap.add_argument("--sem-cache", action="store_true")
    ap.add_argument("--batch")
    ap.add_argument("--mostrar", metavar="TEXTO", help="mostra o texto adaptado, sem gerar áudio")
    ap.add_argument("--fonemas", action="store_true")
    a = ap.parse_args()
    if a.mostrar:
        saida = mostrar(a.mostrar, a.perfil, a.lexico, a.fonemas)
    elif a.batch:
        saida = lote(json.loads(Path(a.batch).read_text(encoding="utf-8")), cache=not a.sem_cache)
    elif a.text and a.out:
        saida = sintetizar(a.text, a.voice, a.out, a.perfil, a.lexico, not a.sem_prep, cache=not a.sem_cache)
    else:
        ap.error("informe --text e --out, --batch ou --mostrar")
    sys.stdout.write(json.dumps(saida, ensure_ascii=False, indent=2))

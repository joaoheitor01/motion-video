"""Teste comparativo de narração: texto original x texto adaptado, em Kokoro e Piper.

Para cada frase de tests/frases.json gera:
  A-original  : texto cru direto no motor, como o estúdio fazia antes do pré-processamento
  B-adaptado  : pré-processamento linguístico + perfil + ajustes do motor
e mede pronúncia (fonemas do espeak-ng), ritmo (pausas, sílabas/s) e entonação (variação de F0).

Uso:  audio-engine\\.venv\\Scripts\\python audio-engine\\tests\\comparativo.py [--so id1,id2]
Saída: output/tts-comparativo/ (WAVs, index.html para ouvir e avaliar, relatorio.json, relatorio.md)
"""
import argparse
import html
import io
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))
sys.path.insert(0, str(AQUI))

import tts  # noqa: E402
from textprep import g2p, preparar  # noqa: E402
from metricas import medir  # noqa: E402

SAIDA = AQUI.parents[1] / "output" / "tts-comparativo"
MOTORES = [("kokoro", "narradora"), ("piper", "piper-faber")]


def original_kokoro(texto: str, voz: str, saida: Path):
    """Caminho antigo: kokoro-onnx fonetiza o texto cru (sem os símbolos de treino), velocidade 1.0."""
    k = tts.MOTORES["kokoro"]._carregar()
    x, sr = k.create(texto, voice=voz, speed=1.0, lang="pt-br")
    tts.gravar_wav(saida, np.asarray(x, dtype=np.float32), sr)


def original_piper(texto: str, voz: str, saida: Path):
    """Caminho antigo: `python -m piper` com a configuração padrão da voz, sem pausa entre frases."""
    v = tts.MOTORES["piper"]._carregar(voz)
    x = np.concatenate([c.audio_float_array for c in v.synthesize(texto)])
    tts.gravar_wav(saida, x.astype(np.float32), v.config.sample_rate)


def conferir(lista, fonemas: str, quer: bool) -> list[dict]:
    nfd = lambda s: unicodedata.normalize("NFD", s)  # noqa: E731
    return [{"descricao": d, "trecho": t, "ok": (nfd(t) in nfd(fonemas)) == quer} for d, t in lista]


def rodar(so=None) -> dict:
    SAIDA.mkdir(parents=True, exist_ok=True)
    dados = json.loads((AQUI / "frases.json").read_text(encoding="utf-8"))
    rel = {"gerado_em": time.strftime("%Y-%m-%d %H:%M"), "frases": []}
    for f in dados["frases"]:
        if so and f["id"] not in so:
            continue
        cru = re.sub(r"\s+", " ", re.sub(r"\[(?:pausa|respira)[^\]]*\]", " ", f["texto"])).strip()
        p = preparar(f["texto"], f["perfil"])
        ipa_o = g2p.ipa(cru)
        ipa_a = " ".join(tts.MOTORES["kokoro"].fonemas(b["partes"], formato="ipa") for b in p.blocos)
        item = {
            "id": f["id"], "categoria": f["categoria"], "perfil": f["perfil"],
            "original": cru, "adaptado": p.falado, "mudancas": p.mudancas, "avisos": p.avisos,
            "blocos": [{"falado": b["falado"], "pausa": b["pausa"], "tipo": b["tipo"]} for b in p.blocos],
            "fonemas_original": ipa_o, "fonemas_adaptado": ipa_a,
            "pronuncia": {
                "original": conferir(f["evitar"], ipa_o, False) + conferir(f["esperar"], ipa_o, True),
                "adaptado": conferir(f["evitar"], ipa_a, False) + conferir(f["esperar"], ipa_a, True),
            },
            "audio": {},
        }
        for motor, alias in MOTORES:
            voz = tts.VOZES[alias]["voice"]
            a = SAIDA / f"{f['id']}_{motor}_A-original.wav"
            b = SAIDA / f"{f['id']}_{motor}_B-adaptado.wav"
            (original_kokoro if motor == "kokoro" else original_piper)(cru, voz, a)
            meta = tts.sintetizar(f["texto"], alias, b, perfil=f["perfil"], cache=False)
            b.with_suffix(".tts.json").unlink(missing_ok=True)
            item["audio"][motor] = {
                "A": {"arquivo": a.name, **medir(a, ipa_o)},
                "B": {"arquivo": b.name, "motor_usado": meta["engine"], **medir(b, ipa_a)},
            }
            print(f"  {f['id']:24} {motor:7} A {item['audio'][motor]['A']['duracao_s']:6.2f}s  "
                  f"B {item['audio'][motor]['B']['duracao_s']:6.2f}s", file=sys.stderr)
        rel["frases"].append(item)
    rel["resumo"] = resumir(rel)
    (SAIDA / "relatorio.json").write_text(json.dumps(rel, ensure_ascii=False, indent=2), encoding="utf-8")
    (SAIDA / "relatorio.md").write_text(markdown(rel), encoding="utf-8")
    (SAIDA / "index.html").write_text(pagina(rel), encoding="utf-8")
    return rel


def resumir(rel: dict) -> dict:
    fr = rel["frases"]
    tot = sum(len(f["pronuncia"]["original"]) for f in fr)
    out = {"frases": len(fr), "verificacoes_de_pronuncia": tot,
           "pronuncia_ok_original": sum(c["ok"] for f in fr for c in f["pronuncia"]["original"]),
           "pronuncia_ok_adaptado": sum(c["ok"] for f in fr for c in f["pronuncia"]["adaptado"]),
           "frases_alteradas": sum(1 for f in fr if f["mudancas"]), "motores": {}}
    for motor, _ in MOTORES:
        m = {}
        for v in "AB":
            xs = [f["audio"][motor][v] for f in fr if motor in f["audio"]]
            if not xs:
                continue
            m[v] = {k: round(float(np.mean([x[k] for x in xs])), 2)
                    for k in ("silabas_por_s", "pausas", "pausa_media_s", "pausa_pct", "f0_variacao_st", "f0_faixa_st")}
            ritmos = [x["silabas_por_s"] for x in xs]
            m[v]["silabas_por_s_desvio"] = round(float(np.std(ritmos)), 2)
        out["motores"][motor] = m
    return out


def markdown(rel: dict) -> str:
    r = rel["resumo"]
    L = [f"# Comparativo de narração — {rel['gerado_em']}", "",
         f"- Frases: {r['frases']} ({r['frases_alteradas']} alteradas pelo pré-processamento)",
         f"- Verificações de pronúncia (fonemas): original **{r['pronuncia_ok_original']}/{r['verificacoes_de_pronuncia']}**, "
         f"adaptado **{r['pronuncia_ok_adaptado']}/{r['verificacoes_de_pronuncia']}**", "",
         "| Motor | Versão | Sílabas/s | Desvio do ritmo entre frases | Pausas por frase | Pausa média (s) | % em pausa | Variação de tom (st) | Faixa de tom (st) |",
         "|---|---|---|---|---|---|---|---|---|"]
    for motor, m in r["motores"].items():
        for v, nome in (("A", "original"), ("B", "adaptado")):
            if v in m:
                x = m[v]
                L.append(f"| {motor} | {nome} | {x['silabas_por_s']} | {x['silabas_por_s_desvio']} | {x['pausas']} | "
                         f"{x['pausa_media_s']} | {x['pausa_pct']} | {x['f0_variacao_st']} | {x['f0_faixa_st']} |")
    L += ["", "## Por frase", ""]
    for f in rel["frases"]:
        L += [f"### {f['id']} — {f['categoria']} (perfil {f['perfil']})", "",
              f"- **Original:** {f['original']}", f"- **Adaptado:** {f['adaptado']}"]
        for nome in ("original", "adaptado"):
            falhas = [c["descricao"] for c in f["pronuncia"][nome] if not c["ok"]]
            if f["pronuncia"][nome]:
                L.append(f"- Pronúncia ({nome}): {len(f['pronuncia'][nome]) - len(falhas)}/{len(f['pronuncia'][nome])}"
                         + (f" — falhas: {'; '.join(falhas)}" if falhas else ""))
        for motor, a in f["audio"].items():
            L.append(f"- {motor}: A {a['A']['duracao_s']} s, {a['A']['pausas']} pausas, {a['A']['silabas_por_s']} síl/s → "
                     f"B {a['B']['duracao_s']} s, {a['B']['pausas']} pausas, {a['B']['silabas_por_s']} síl/s")
        L.append("")
    return "\n".join(L)


def pagina(rel: dict) -> str:
    e = html.escape
    r = rel["resumo"]
    blocos = []
    for f in rel["frases"]:
        checks = ""
        for c_o, c_a in zip(f["pronuncia"]["original"], f["pronuncia"]["adaptado"]):
            checks += (f"<tr><td>{e(c_o['descricao'])}</td><td class='{'ok' if c_o['ok'] else 'no'}'>{'certo' if c_o['ok'] else 'errado'}</td>"
                       f"<td class='{'ok' if c_a['ok'] else 'no'}'>{'certo' if c_a['ok'] else 'errado'}</td></tr>")
        mud = "".join(f"<li><span class='tag'>{e(m['regra'])}</span> {e(m['de'])} → <b>{e(m['para'])}</b></li>" for m in f["mudancas"])
        audios = ""
        for motor, a in f["audio"].items():
            cel = ""
            for v, nome in (("A", "Original"), ("B", "Adaptado")):
                x = a[v]
                chave = f"{f['id']}|{motor}|{v}"
                notas = "".join(f"<option value='{n}'>{n}</option>" for n in range(1, 6))
                cel += (f"<div class='amostra'><div class='rot'>{nome}</div><audio controls preload='none' src='{e(x['arquivo'])}'></audio>"
                        f"<div class='met'>{x['duracao_s']} s · {x['pausas']} pausas ({x['pausa_total_s']} s) · {x['silabas_por_s']} síl/s · tom ±{x['f0_variacao_st']} st</div>"
                        f"<label>Naturalidade <select data-k='{e(chave)}'><option value=''>–</option>{notas}</select></label></div>")
            audios += f"<div class='motor'><h4>{motor.capitalize()}</h4><div class='par'>{cel}</div></div>"
        blocos.append(f"""<section><h3>{e(f['id'])} <small>{e(f['categoria'])} · perfil {e(f['perfil'])}</small></h3>
<p class='txt'><span class='rot'>Original</span>{e(f['original'])}</p>
<p class='txt'><span class='rot'>Adaptado</span>{e(f['adaptado'])}</p>
{f"<details><summary>{len(f['mudancas'])} alterações</summary><ul>{mud}</ul></details>" if mud else "<p class='met'>Nenhuma alteração no texto (só pausas e ajustes do motor).</p>"}
{f"<table><tr><th>Verificação de pronúncia</th><th>Original</th><th>Adaptado</th></tr>{checks}</table>" if checks else ""}
{audios}</section>""")
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Comparativo de narração</title><style>
:root{{--bg:#f6f7f9;--card:#fff;--ink:#16202b;--mut:#5b6877;--line:#dde2e8;--ok:#12733b;--no:#b3261e;--acc:#0b63ce}}
@media(prefers-color-scheme:dark){{:root{{--bg:#11161c;--card:#1a212a;--ink:#e8edf2;--mut:#9aa7b5;--line:#2c3644;--ok:#6fd397;--no:#ff8a80;--acc:#7ab7ff}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,"Segoe UI",sans-serif}}
main{{max-width:980px;margin:0 auto;padding:24px 16px 80px}}h1{{font-size:26px;margin:0 0 4px}}h3{{margin:0 0 10px;font-size:18px}}
h3 small{{font-weight:400;color:var(--mut);font-size:14px;margin-left:8px}}h4{{margin:14px 0 6px;font-size:15px}}
section{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px;margin:16px 0}}
.txt{{margin:6px 0}}.rot{{display:inline-block;min-width:78px;color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.06em}}
.met{{color:var(--mut);font-size:13px;margin:4px 0}}.par{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
@media(max-width:700px){{.par{{grid-template-columns:1fr}}}}.amostra{{border:1px solid var(--line);border-radius:8px;padding:10px}}
audio{{width:100%;margin:6px 0}}table{{border-collapse:collapse;width:100%;font-size:14px;margin:10px 0}}
td,th{{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left}}.ok{{color:var(--ok)}}.no{{color:var(--no);font-weight:600}}
.tag{{font-size:11px;border:1px solid var(--line);border-radius:4px;padding:0 5px;color:var(--mut)}}ul{{padding-left:18px;font-size:14px}}
button{{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid var(--acc);background:var(--acc);color:#fff;cursor:pointer}}
.resumo{{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:14px 0}}
.resumo div{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}}.resumo b{{display:block;font-size:22px}}
select{{font:inherit}}</style></head><body><main>
<h1>Comparativo de narração</h1><p class="met">Gerado em {e(rel['gerado_em'])}. Ouça os pares e dê uma nota de 1 (robótico) a 5 (natural).
As notas ficam salvas neste navegador; use o botão no fim para exportar.</p>
<div class="resumo"><div><b>{r['frases']}</b>frases de teste</div>
<div><b>{r['pronuncia_ok_original']}/{r['verificacoes_de_pronuncia']}</b>pronúncias certas no original</div>
<div><b>{r['pronuncia_ok_adaptado']}/{r['verificacoes_de_pronuncia']}</b>pronúncias certas no adaptado</div></div>
{''.join(blocos)}
<section><h3>Sua avaliação</h3><p id="medias" class="met">Sem notas ainda.</p><button id="exp">Exportar notas (JSON)</button></section>
</main><script>
const K='tts-comparativo-notas';let notas={{}};try{{notas=JSON.parse(localStorage.getItem(K)||'{{}}')}}catch(e){{}}
function medias(){{const s={{}};for(const[k,v]of Object.entries(notas)){{const[,m,ver]=k.split('|');const c=m+' '+(ver==='A'?'original':'adaptado');(s[c]=s[c]||[]).push(+v)}}
const t=Object.entries(s).map(([c,a])=>c+': '+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2)+' ('+a.length+' notas)');
document.getElementById('medias').textContent=t.length?'Médias — '+t.join(' · '):'Sem notas ainda.'}}
document.querySelectorAll('select[data-k]').forEach(el=>{{if(notas[el.dataset.k])el.value=notas[el.dataset.k];
el.addEventListener('change',()=>{{if(el.value)notas[el.dataset.k]=el.value;else delete notas[el.dataset.k];
try{{localStorage.setItem(K,JSON.stringify(notas))}}catch(e){{}}medias()}})}});medias();
document.getElementById('exp').addEventListener('click',()=>{{const a=document.createElement('a');
a.href=URL.createObjectURL(new Blob([JSON.stringify(notas,null,2)],{{type:'application/json'}}));a.download='notas-narracao.json';a.click()}});
</script></body></html>"""


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--so", help="ids separados por vírgula")
    a = ap.parse_args()
    rel = rodar(set(a.so.split(",")) if a.so else None)
    print(json.dumps(rel["resumo"], ensure_ascii=False, indent=2))
    print(f"\nAbra: {SAIDA / 'index.html'}")

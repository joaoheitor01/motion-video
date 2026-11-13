"""Testes do pré-processamento linguístico pt-BR.

Rodar:  audio-engine\\.venv\\Scripts\\python -m unittest discover -s audio-engine/tests -v
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from textprep import preparar  # noqa: E402
from textprep.numeros import cardinal, ordinal, numero, e_feminino, romano  # noqa: E402
from textprep.regras import pronunciavel  # noqa: E402


def fala(texto, perfil="institucional"):
    return preparar(texto, perfil).falado


class Numeros(unittest.TestCase):
    def test_cardinais(self):
        casos = {0: "zero", 1: "um", 14: "catorze", 16: "dezesseis", 21: "vinte e um", 100: "cem",
                 101: "cento e um", 200: "duzentos", 999: "novecentos e noventa e nove", 1000: "mil",
                 1001: "mil e um", 1100: "mil e cem", 1200: "mil e duzentos", 1234: "mil duzentos e trinta e quatro",
                 2000: "dois mil", 2026: "dois mil e vinte e seis", 1998: "mil novecentos e noventa e oito",
                 10000: "dez mil", 100000: "cem mil", 1000000: "um milhão", 1500000: "um milhão e quinhentos mil",
                 2300000: "dois milhões e trezentos mil", 2000150: "dois milhões cento e cinquenta",
                 1234567: "um milhão duzentos e trinta e quatro mil quinhentos e sessenta e sete",
                 1000000000: "um bilhão"}
        for n, esperado in casos.items():
            self.assertEqual(cardinal(n), esperado, n)

    def test_feminino(self):
        self.assertEqual(cardinal(1, True), "uma")
        self.assertEqual(cardinal(2, True), "duas")
        self.assertEqual(cardinal(22, True), "vinte e duas")
        self.assertEqual(cardinal(200, True), "duzentas")
        self.assertEqual(cardinal(2000, True), "duas mil")
        self.assertEqual(cardinal(2000000, True), "dois milhões")

    def test_ordinais(self):
        self.assertEqual(ordinal(1), "primeiro")
        self.assertEqual(ordinal(2, True), "segunda")
        self.assertEqual(ordinal(13), "décimo terceiro")
        self.assertEqual(ordinal(21, True), "vigésima primeira")
        self.assertEqual(ordinal(100), "centésimo")

    def test_decimais(self):
        self.assertEqual(numero("3,5"), "três vírgula cinco")
        self.assertEqual(numero("0,05"), "zero vírgula zero cinco")
        self.assertEqual(numero("1.234,56"), "mil duzentos e trinta e quatro vírgula cinquenta e seis")
        self.assertEqual(numero("007"), "zero zero sete")

    def test_genero_do_substantivo(self):
        for w in ["pessoas", "horas", "páginas", "opções", "imagens", "vezes", "empresas", "cidades"]:
            self.assertTrue(e_feminino(w), w)
        for w in ["dias", "problemas", "sistemas", "anos", "vídeos", "motores", "reais", "programas", "gramas"]:
            self.assertFalse(e_feminino(w), w)

    def test_romanos(self):
        self.assertEqual(romano("XXI"), 21)
        self.assertEqual(romano("XIV"), 14)
        self.assertIsNone(romano("IIII"))
        self.assertIsNone(romano("ABC"))


class Regras(unittest.TestCase):
    def conferir(self, casos, perfil="institucional"):
        for entrada, esperado in casos.items():
            with self.subTest(entrada=entrada):
                self.assertEqual(fala(entrada, perfil), esperado)

    def test_numeros_no_texto(self):
        self.conferir({
            "Temos 2 pessoas e 2 carros.": "Temos duas pessoas e dois carros.",
            "Foram 21 páginas em 1 dia.": "Foram vinte e uma páginas em um dia.",
            "São 200 opções e 300 vídeos.": "São duzentas opções e trezentos vídeos.",
            "A população é de 1.500.000 habitantes.": "A população é de um milhão e quinhentos mil habitantes.",
            "Vendemos 2.000.000 unidades.": "Vendemos dois milhões de unidades.",
            "Em 2026 lançamos a versão 4.0.": "Em dois mil e vinte e seis lançamos a versão quatro ponto zero.",
            "A nota foi 8,5.": "A nota foi oito vírgula cinco.",
            "Fez -5 graus.": "Fez menos cinco graus.",
            "Atualize para a v2.1.": "Atualize para a versão dois ponto um.",
        })

    def test_moeda(self):
        self.conferir({
            "Custa R$ 1.250,50.": "Custa mil duzentos e cinquenta reais e cinquenta centavos.",
            "Custa R$ 1.": "Custa um real.",
            "Custa R$ 0,50.": "Custa cinquenta centavos.",
            "Custa R$ 1,01.": "Custa um real e um centavo.",
            "Investimento de R$ 2 milhões.": "Investimento de dois milhões de reais.",
            "Investimento de R$ 1,5 milhão.": "Investimento de um milhão e meio de reais.",
            "Investimento de R$ 2,5 mil.": "Investimento de dois mil e quinhentos reais.",
            "Faturou R$ 3.000.000.": "Faturou três milhões de reais.",
            "Custa US$ 10 ou € 5.": "Custa dez dólares ou cinco euros.",
        })
        self.conferir({"Só R$ 99,90!": "Só noventa e nove e noventa!",
                       "Por R$ 1.299,00.": "Por mil duzentos e noventa e nove reais."}, "comercial")

    def test_porcentagem(self):
        self.conferir({
            "Cresceu 3,5% no ano.": "Cresceu três vírgula cinco por cento no ano.",
            "É 100% local.": "É cem por cento local.",
            "Entre 10% e 15 %.": "Entre dez por cento e quinze por cento.",
        })

    def test_datas(self):
        self.conferir({
            "Em 13/11/2026.": "Em treze de novembro de dois mil e vinte e seis.",
            "No dia 1/5 é feriado.": "No dia primeiro de maio é feriado.",
            "Entre 10/11 e 15/11.": "Entre dez de novembro e quinze de novembro.",
            "Vence em 2026-03-01.": "Vence em primeiro de março de dois mil e vinte e seis.",
            "No dia 1º de maio.": "No dia primeiro de maio.",
            "A proporção é de 1/3.": "A proporção é de um terço.",
            "Use 3/4 de xícara.": "Use três quartos de xícara.",
        })

    def test_horas(self):
        self.conferir({
            "A reunião é às 14h30.": "A reunião é às catorze horas e trinta minutos.",
            "Abre às 8h.": "Abre às oito horas.",
            "Começa às 20:00.": "Começa às vinte horas.",
            "O filme dura 1h30.": "O filme dura uma hora e trinta minutos.",
            "Atendimento das 9h-18h.": "Atendimento das nove horas a dezoito horas.",
            "O vídeo é 16:9.": "O vídeo é dezesseis por nove.",
        })
        self.conferir({
            "A reunião é às 14h30.": "A reunião é às duas e meia da tarde.",
            "Abre às 8h.": "Abre às oito da manhã.",
            "O almoço é às 12h.": "O almoço é ao meio-dia.",
            "Fecha às 0h.": "Fecha à meia-noite.",
            "Volto às 13h15.": "Volto à uma e quinze da tarde.",
            "O filme dura 1h30.": "O filme dura uma hora e trinta minutos.",
            "Aberto das 9h às 18h.": "Aberto das nove da manhã às seis da noite.",
        }, "comercial")

    def test_telefones_e_documentos(self):
        self.conferir({
            "Ligue (11) 99876-5432.": "Ligue onze, nove nove oito sete meia, cinco quatro três dois.",
            "Ligue 0800 123 4567.": "Ligue zero oitocentos, um dois três, quatro cinco meia sete.",
            "O CEP é 01310-100.": "O CEP é zero um três um zero, um zero zero.",
            "De 2020-2024 houve crescimento.": "De dois mil e vinte a dois mil e vinte e quatro houve crescimento.",
        })

    def test_ordinais_e_unidades(self):
        self.conferir({
            "Ficou em 1º lugar.": "Ficou em primeiro lugar.",
            "É a 2ª edição.": "É a segunda edição.",
            "Mora no 3° andar.": "Mora no terceiro andar.",
            "A 50 km/h.": "A cinquenta quilômetros por hora.",
            "Pesa 2,5 kg.": "Pesa dois quilos e meio.",
            "Corre 1 km.": "Corre um quilômetro.",
            "Faz 30°C.": "Faz trinta graus Celsius.",
            "Tem 16 GB de memória.": "Tem dezesseis gigabáites de memória.",
            "Vídeo em 1920x1080 a 30 fps.": "Vídeo em mil novecentos e vinte por mil e oitenta a trinta quadros por segundo.",
            "É 10x mais rápido.": "É dez vezes mais rápido.",
            "Espere 5 min.": "Espere cinco minutos.",
            "Dura 1,5 h.": "Dura uma hora e meia.",
        })

    def test_romanos_e_siglas(self):
        self.conferir({
            "No século XXI.": "No século vinte e um.",
            "Dom Pedro II governou.": "Dom Pedro segundo governou.",
            "Leia o capítulo IV.": "Leia o capítulo quatro.",
        })

    def test_siglas_para_o_motor(self):
        # a forma legível mantém a sigla; o motor recebe a leitura (texto no Piper, fonemas no Kokoro)
        casos = {
            "O CPF e o CNPJ.": "O cê pê éfe e o cê ene pê jota.",
            "A ONU e a NASA.": "A Onu e a Nasa.",
            "O IBGE divulgou.": "O i bê gê é divulgou.",
            "Formato MP4 em 4K.": "Formato eme pê quatro em quatro cá.",
            "A área de TI usa IA.": "A área de tê i usa i á.",
            "Os PDFs das ONGs.": "Os pê dê éfes das Ongs.",
            "São 21 anos no século XXI.": "São vinte e úm anos no século vinte e úm.",
        }
        for entrada, esperado in casos.items():
            with self.subTest(entrada=entrada):
                r = preparar(entrada, "institucional")
                motor = " ".join("".join(p["fala"] if "ipa" in p else p["t"] for p in b["partes"]) for b in r.blocos)
                self.assertEqual(motor, esperado)
        r = preparar("O IBGE e a API.", "institucional")
        self.assertEqual(r.falado, "O IBGE e a API.")
        ipas = [p["ipa"] for b in r.blocos for p in b["partes"] if "ipa" in p]
        self.assertEqual(ipas, ["ˌibˌeʒˌeˈɛ", "ˌapˌeˈi"])

    def test_abreviacoes_e_simbolos(self):
        self.conferir({
            "O Dr. João e a Dra. Ana.": "O doutor João e a doutora Ana.",
            "Veja a pág. 12, nº 5.": "Veja a página doze, número cinco.",
            "Frutas, legumes etc.": "Frutas, legumes etcétera.",
            "Pesquisa & desenvolvimento.": "Pesquisa e desenvolvimento.",
            "Brasil vs. Argentina.": "Brasil versus Argentina.",
            "Use e/ou combine.": "Use e ou combine.",
            "Acesse www.exemplo.com.br agora.": "Acesse dáblio dáblio dáblio ponto exemplo ponto com ponto bê érre agora.",
            "Escreva para contato@empresa.com.": "Escreva para contato arroba empresa ponto com.",
            "2 + 2 = 4.": "Dois mais dois igual a quatro.",
        })

    def test_pontuacao_e_estrutura(self):
        self.conferir({
            "A ferramenta (gratuita) funciona.": "A ferramenta, gratuita, funciona.",
            'Ele disse "sim".': "Ele disse sim.",
            "Sem ponto final": "Sem ponto final.",
            "O quê?!": "O quê?",
            "**Importante**: leia tudo.": "Importante: leia tudo.",
            "ATENÇÃO PARA O AVISO IMPORTANTE.": "Atenção para o aviso importante.",
        })

    def test_dicionario_e_marcacao(self):
        self.conferir({
            "Feito com Remotion e React.": "Feito com rimôuchon e riékti.",
            "Dois apps e três bugs.": "Dois épis e três bâgs.",
            "O nome é {Xavier|chaviér}.": "O nome é chaviér.",
            "Mantenha {=R$ 10} assim.": "Mantenha R$ 10 assim.",
        })

    def test_perfil_conversacional(self):
        self.conferir({
            "O vídeo está pronto para o cliente.": "O vídeo tá pronto pro cliente.",
            "Isso é para você, não é?": "Isso é pra você, né?",
        }, "conversacional")
        # os demais perfis não contraem
        self.assertEqual(fala("O vídeo está pronto para o cliente.", "jornalistico"),
                         "O vídeo está pronto para o cliente.")

    def test_nao_altera_texto_comum(self):
        for t in ["Bem-vindo ao estúdio de vídeo.", "A Maria Clara viajou para São Paulo com o João.",
                  "Eu gosto de café, mas prefiro chá.", "Tudo o que você vê e ouve foi produzido aqui."]:
            r = preparar(t, "jornalistico")
            self.assertEqual(r.falado, t)
            self.assertEqual(r.mudancas, [])


class Prosodia(unittest.TestCase):
    def test_blocos_e_pausas(self):
        r = preparar("Primeira frase completa aqui. Segunda frase completa aqui.\n\nNovo parágrafo começa agora.", "institucional")
        self.assertEqual([b["tipo"] for b in r.blocos], ["frase", "paragrafo", "paragrafo"])
        self.assertEqual([b["pausa"] for b in r.blocos], [0.42, 0.8, 0.0])
        r = preparar("Pronto. Um vídeo completo, gratuito e local.", "institucional")
        self.assertEqual(len(r.blocos), 2)  # cada frase é um bloco, com a pausa do perfil entre elas

    def test_pausa_explicita(self):
        r = preparar("E o vencedor é [pausa:1,2] você. Parabéns pela conquista de hoje.", "institucional")
        self.assertEqual(r.blocos[0]["falado"], "E o vencedor é,")
        self.assertEqual(r.blocos[0]["pausa"], 1.2)
        self.assertEqual(r.blocos[0]["tipo"], "explicita")

    def test_frase_curta_junta(self):
        from textprep import perfil_config
        from textprep.regras import Ctx
        from textprep.prosodia import segmentar
        _, cfg = perfil_config("institucional")
        cfg = {**cfg, "prosodia": {**cfg["prosodia"], "min_palavras_bloco": 3}}
        self.assertEqual(len(segmentar("Pronto. Um vídeo completo, gratuito e local.", Ctx(cfg))), 1)

    def test_respiracao(self):
        longo = ("O estúdio prepara o roteiro com cuidado antes de gravar a narração completa do projeto "
                 "e depois sincroniza cada cena com a duração real do áudio gerado pelo motor local.")
        r = preparar(longo, "comercial")
        self.assertIn(", e depois", r.falado)
        self.assertTrue(any(m["regra"] == "respiracao" for m in r.mudancas))
        # nunca quebra dentro de número por extenso
        r = preparar("O valor total do contrato assinado ontem pela diretoria foi de 1.250.350 reais e 25 centavos pagos hoje.", "comercial")
        self.assertNotIn("cinquenta, e", r.falado)
        self.assertNotIn("reais, e vinte", r.falado)

    def test_auditoria(self):
        r = preparar("Custa R$ 10 na loja (só hoje).", "institucional")
        regras = {m["regra"] for m in r.mudancas}
        self.assertIn("moeda", regras)
        self.assertIn("parenteses", regras)
        r = preparar("Proporção 50/50.", "institucional")
        self.assertTrue(r.avisos)


class Fonemas(unittest.TestCase):
    def test_simbolos_de_treino_do_kokoro(self):
        from textprep import g2p
        f = g2p.kokoro("De noite, o leite e o pai.")
        self.assertIn("ʤ", f)      # d^ʒ -> ʤ
        self.assertIn("ʧ", f)      # t^ʃ -> ʧ
        self.assertIn("A", f)      # e^ɪ -> A
        self.assertIn("I", f)      # a^ɪ -> I
        self.assertNotIn("^", f)
        self.assertNotIn("tʃ", f)

    def test_artigo_antes_de_sigla_fica_atono(self):
        import tts
        r = preparar("Segundo o IBGE, sim.", "institucional")
        f = tts.MOTORES["kokoro"].fonemas(r.blocos[0]["partes"], formato="ipa")
        self.assertIn("u ˌibˌeʒˌeˈɛ,", f)
        self.assertNotIn("ˈɔ ˌib", f)


class Siglas(unittest.TestCase):
    def test_pronunciavel(self):
        for s in ["ONU", "NASA", "PIB", "UNESCO", "ENEM", "FIFA", "MEC", "USP", "ONG"]:
            self.assertTrue(pronunciavel(s), s)
        for s in ["CPF", "IBGE", "INSS", "FGTS", "URL", "IPTU", "IPVA", "OMS", "DNA", "EUA", "FBI", "USB", "HIV"]:
            self.assertFalse(pronunciavel(s), s)


if __name__ == "__main__":
    unittest.main(verbosity=2)

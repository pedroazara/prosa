// Modo demonstração: abre o site com dados falsos, sem servidor nem LLM.
// Serve para mexer no visual. Use ?demo na URL, ou ?demo=pesquisa, ?demo=explicacao, ?demo=relatorio
// para abrir direto numa tela.

import type { Config, Dev, Resultado, Sessao } from "./api";

const parametro = new URLSearchParams(location.search).get("demo");
export const emDemo = parametro !== null;
export const telaInicialDemo = parametro || "inicio";
if (new URLSearchParams(location.search).has("estatico")) document.documentElement.classList.add("estatico");

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const configDemo: Config = {
  areas: ["Física", "Química", "Biologia", "Medicina", "Psicologia", "Matemática", "Computação", "Engenharia",
    "Economia", "Direito", "História", "Geopolítica", "Filosofia", "Astronomia", "Geologia", "Linguística",
    "Artes", "Arquitetura"],
  origens: ["brasil", "mundo"],
  tempo_pesquisa: 300,
  tempo_explicacao: 120,
};

export const sessaoDemo: Sessao = {
  id: "demo",
  pergunta: "Por que o ferroceno revolucionou a química de coordenação nos anos 1950?",
  area: "Química",
  origem: "mundo",
};

const TEXTO =
  "Então, o ferroceno é um composto de ferro com dois anéis de ciclopentadienil, e éé, ele tem uma estrutura " +
  "tipo sanduíche, né, com o ferro no meio. Isso foi uma surpresa porque ninguém esperava que um metal se ligasse " +
  "assim a anéis de hidrocarboneto. E aí ele era muito estável, o que, hum, mostrou que esse tipo de ligação " +
  "funcionava. Então a descoberta abriu, assim, todo um campo novo, a química organometálica, e depois veio o " +
  "Nobel pra quem explicou a estrutura.";

function marcar(texto: string) {
  const padroes: [RegExp, "hesitacao" | "muleta"][] = [
    [/(?<!\p{L})(éé+|hum)(?!\p{L})/giu, "hesitacao"],
    [/(?<!\p{L})(então|tipo|né|aí|assim)(?!\p{L})/giu, "muleta"],
  ];
  return padroes
    .flatMap(([re, tipo]) => [...texto.matchAll(re)].map((m) => ({ inicio: m.index!, fim: m.index! + m[0].length, tipo })))
    .sort((a, b) => a.inicio - b.inicio);
}

export const resultadoDemo: Resultado = {
  fala: {
    texto: TEXTO,
    marcacoes: marcar(TEXTO),
    duracao: 97.4,
    palavras: 78,
    palavras_por_minuto: 132,
    pausas: 9,
    maior_pausa: 2.3,
    hesitacoes: { "éé / eh": 1, "ãã / ahn": 0, "hum / hm": 1 },
    muletas: { tipo: 1, "né": 1, "então": 2, assim: 1, "aí": 1, sabe: 0 },
  },
  pontos: [
    "A estrutura em sanduíche do ferroceno mostrou um tipo de ligação entre metal e hidrocarboneto que ninguém previa.",
    "A estabilidade notável do composto provou que essas ligações eram robustas, e não uma curiosidade de laboratório.",
    "A descoberta disparou o crescimento da química organometálica, com uma família inteira de compostos parecidos.",
  ],
  artigo: "Ferroceno",
  link: "https://pt.wikipedia.org/wiki/Ferroceno",
};

export const devDemo: Dev = {
  desafio: {
    pergunta_original: sessaoDemo.pergunta,
    pergunta_final: sessaoDemo.pergunta,
    veredito: "responde",
    justificativa: "O artigo trata da descoberta, da estrutura sanduíche e do impacto na química organometálica.",
    artigo: "Ferroceno",
    link: "https://pt.wikipedia.org/wiki/Ferroceno",
    modelo: "demo",
    pontos_principais: resultadoDemo.pontos.map((ideia, i) => ({
      ideia,
      trecho_do_artigo: "Sua estrutura diferenciada \"sanduíche\" levou a uma explosão de interesse…",
      trecho_verificado: i !== 1,
    })),
    log: ["✗ Por que o cisplatina… — artigo curto demais", "→ Ferroceno: responde."],
  },
};

export async function sortearDemo(aoAndar: (m: string) => void): Promise<Sessao> {
  for (const m of [
    "Área: Química (química inorgânica). Pedindo candidatos ao LLM…",
    "20 temas propostos. Procurando um com bom artigo…",
    "Lendo o artigo “Ferroceno”…",
  ]) {
    aoAndar(m);
    await esperar(1100);
  }
  return sessaoDemo;
}

export async function analisarDemo(): Promise<Resultado> {
  await esperar(1800);
  return resultadoDemo;
}

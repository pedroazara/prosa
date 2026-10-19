// Modo demonstração: abre o site com dados falsos, sem servidor nem LLM.
// Serve para mexer no visual. Use ?demo na URL, ou ?demo=pesquisa, ?demo=explicacao, ?demo=relatorio
// para abrir direto numa tela.

import type { Avaliacao, Config, Dev, Resultado, Sessao, Sorteio, TemaSalvo } from "./api";

const parametro = new URLSearchParams(location.search).get("demo");
export const emDemo = parametro !== null;
export const telaInicialDemo = parametro || "inicio";
if (new URLSearchParams(location.search).has("estatico")) document.documentElement.classList.add("estatico");

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const configDemo: Config = {
  chave_no_servidor: true,
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

export const temasDemo: TemaSalvo[] = [
  { id: "ferroceno", pergunta: sessaoDemo.pergunta, area: "Química", subarea: "química inorgânica", origem: "mundo",
    artigo: "Ferroceno", data: "2026-10-04T14:55:29" },
  { id: "carste", pergunta: "Como se formam as paisagens cársticas?", area: "Geologia", subarea: "geomorfologia",
    origem: "mundo", artigo: "Carste", data: "2026-10-03T21:10:02" },
  { id: "theatro-da-paz", pergunta: "Por que o Theatro da Paz é um símbolo do ciclo da borracha em Belém?",
    area: "Arquitetura", subarea: null, origem: "brasil", artigo: "Theatro da Paz", data: "2026-10-03T20:41:17" },
];

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

export async function sortearDemo(aoAndar: (m: string) => void, aoSortear: (s: Sorteio) => void): Promise<Sessao> {
  aoSortear({
    area: "Química",
    subarea: "química inorgânica",
    areas: configDemo.areas,
    subareas: ["química orgânica", "química inorgânica", "físico-química", "eletroquímica", "bioquímica",
      "química analítica", "polímeros", "catálise", "química de materiais", "processos industriais"],
  });
  for (const m of [
    "Pedindo candidatos ao LLM…",
    "20 temas propostos. Procurando um com bom artigo…",
    "Lendo o artigo “Ferroceno”…",
  ]) {
    aoAndar(m);
    await esperar(3500); // tempo para a roleta terminar antes de trocar de tela
  }
  return sessaoDemo;
}

export async function analisarDemo(): Promise<Resultado> {
  await esperar(1800);
  return resultadoDemo;
}

export async function avaliacaoDemo(): Promise<Avaliacao> {
  await esperar(1500);
  return {
    sem_fala: false,
    pontos: [
      {
        ideia: resultadoDemo.pontos[0],
        evidencia: "ele tem uma estrutura tipo sanduíche, né, com o ferro no meio. Isso foi uma surpresa",
        evidencia_verificada: true,
        justificativa: "Você descreveu o sanduíche e disse que foi uma surpresa, que é o centro do ponto.",
        veredito: "coberto",
      },
      {
        ideia: resultadoDemo.pontos[1],
        evidencia: "ele era muito estável, o que, hum, mostrou que esse tipo de ligação funcionava",
        evidencia_verificada: true,
        justificativa: "Você citou a estabilidade, mas não disse por que ela importava para a química da época.",
        veredito: "parcial",
      },
      {
        ideia: resultadoDemo.pontos[2],
        evidencia: "a descoberta abriu todo um campo novo, a química organometálica",
        evidencia_verificada: false,
        justificativa: "Você ligou a descoberta ao nascimento da química organometálica.",
        veredito: "coberto",
      },
    ],
    outros_pontos_corretos: [
      { trecho_da_fala: "depois veio o Nobel pra quem explicou a estrutura", ideia: "A estrutura rendeu um Nobel.", trecho_verificado: true },
    ],
    afirmacoes_erradas: [
      {
        trecho_da_fala: "o ferroceno é um composto de ferro com dois anéis de ciclopentadienil",
        trecho_da_referencia: "dois anéis ciclopentadienil ligados em lados opostos a um átomo central de ferro",
        correcao: "Exemplo de demonstração: aqui apareceria a correção, com o trecho da referência que a sustenta.",
        fala_verificada: true,
        referencia_verificada: true,
      },
    ],
    organizacao: "Você começou pela estrutura e terminou na consequência, o que dá uma linha clara de causa e efeito.",
    proximo_passo: "Abra já dizendo por que o ferroceno foi revolucionário, e só depois descreva a estrutura.",
  };
}

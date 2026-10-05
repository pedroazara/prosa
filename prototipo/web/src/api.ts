// Conversa com o servidor Python (prototipo/servidor.py). No modo demonstração, usa dados falsos.

import { analisarDemo, avaliacaoDemo, configDemo, devDemo, emDemo, sessaoDemo, sortearDemo, temasDemo } from "./demo";

export type Config = {
  areas: string[];
  origens: string[];
  tempo_pesquisa: number;
  tempo_explicacao: number;
};

export type Sessao = { id: string; pergunta: string; area: string; origem: string; tema?: string };

/** Um tema já gerado antes, guardado no servidor (prototipo/temas/). Vem sem a rubrica. */
export type TemaSalvo = {
  id: string;
  pergunta: string;
  area: string;
  subarea: string | null;
  origem: string;
  artigo: string;
  data: string;
};

/** O que o servidor sorteou, com as opções para a roleta. "areas" vem vazio se o usuário escolheu a área. */
export type Sorteio = { area: string; subarea: string; areas: string[]; subareas: string[] };

export type Marcacao = { inicio: number; fim: number; tipo: "hesitacao" | "muleta" };

export type Fala = {
  texto: string;
  marcacoes: Marcacao[];
  duracao: number;
  palavras: number;
  palavras_por_minuto: number;
  pausas: number;
  maior_pausa: number;
  hesitacoes: Record<string, number>;
  muletas: Record<string, number>;
};

export type Resultado = { fala: Fala; pontos: string[]; artigo: string; link: string };

export type Veredito = "coberto" | "parcial" | "nao_coberto";

/** Avaliação do conteúdo pela IA (experimentos/03-avaliacao). As citações já vêm conferidas pelo código. */
export type Avaliacao = {
  sem_fala: boolean;
  pontos: {
    ideia: string;
    evidencia: string;
    evidencia_verificada: boolean | null; // null: o LLM não citou nada
    justificativa: string;
    veredito: Veredito;
  }[];
  outros_pontos_corretos: { trecho_da_fala: string; ideia: string; trecho_verificado: boolean }[];
  afirmacoes_erradas: {
    trecho_da_fala: string;
    trecho_da_referencia: string;
    correcao: string;
    fala_verificada: boolean;
    referencia_verificada: boolean;
  }[];
  organizacao: string;
  proximo_passo: string;
};

export type Ponto = { ideia: string; trecho_do_artigo: string; trecho_verificado: boolean };

export type Dev = {
  desafio: {
    pergunta_original: string;
    pergunta_final: string;
    veredito: string;
    justificativa: string;
    artigo: string;
    link: string;
    modelo: string;
    pontos_principais: Ponto[];
    log: string[];
  };
  fala?: Fala;
};

/** Erro com o código que o servidor dá aos problemas com a IA (cota_diaria, cota_minuto…; ver llm.py). */
export class ErroApi extends Error {
  constructor(
    mensagem: string,
    public codigo: string | null = null,
  ) {
    super(mensagem);
  }
}

async function json<T>(resposta: Response): Promise<T> {
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new ErroApi(corpo?.detail ?? `Erro ${resposta.status} no servidor.`, resposta.headers.get("X-Codigo-Erro"));
  }
  return resposta.json();
}

export const buscarConfig = () =>
  emDemo ? Promise.resolve(configDemo) : fetch("/api/config").then((r) => json<Config>(r));

/** Sorteia o tema. O servidor manda uma linha JSON por mensagem de andamento. */
export async function sortear(
  area: string | null,
  origem: string,
  aoAndar: (mensagem: string) => void,
  aoSortear: (sorteio: Sorteio) => void,
): Promise<Sessao> {
  if (emDemo) return sortearDemo(aoAndar, aoSortear);
  const resposta = await fetch("/api/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ area, origem }),
  });
  if (!resposta.ok || !resposta.body) await json(resposta);

  const leitor = resposta.body!.pipeThrough(new TextDecoderStream()).getReader();
  let resto = "";
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    resto += value;
    const linhas = resto.split("\n");
    resto = linhas.pop()!;
    for (const linha of linhas.filter(Boolean)) {
      const evento = JSON.parse(linha);
      if (evento.tipo === "sorteio") aoSortear(evento.conteudo);
      if (evento.tipo === "status") aoAndar(evento.conteudo);
      if (evento.tipo === "erro") throw new ErroApi(evento.conteudo, evento.codigo ?? null);
      if (evento.tipo === "pronto") return evento.conteudo as Sessao;
    }
  }
  throw new Error("A conexão com o servidor terminou antes do fim do sorteio.");
}

export const buscarTemas = () =>
  emDemo ? Promise.resolve(temasDemo) : fetch("/api/temas").then((r) => json<TemaSalvo[]>(r));

/** Começa uma sessão com um tema salvo, sem chamar o LLM. Sem id, o servidor sorteia um (da área, se houver). */
export function usarTemaSalvo(id: string | null, area: string | null, excluir: string[] = []): Promise<Sessao> {
  if (emDemo) return Promise.resolve(sessaoDemo);
  return fetch("/api/sessoes/salvo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, area, excluir }),
  }).then((r) => json<Sessao>(r));
}

export function analisar(idSessao: string, audio: Blob, modo: string): Promise<Resultado> {
  if (emDemo) return analisarDemo();
  const extensao = audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "mp4" : "webm";
  const formulario = new FormData();
  formulario.append("audio", audio, `explicacao.${extensao}`);
  formulario.append("modo", modo);
  return fetch(`/api/sessoes/${idSessao}/analise`, { method: "POST", body: formulario }).then((r) =>
    json<Resultado>(r),
  );
}

/** Pede a avaliação da IA, mandando junto o que a pessoa marcou à mão (para comparar depois). */
export function avaliar(idSessao: string, marcacoes: boolean[]): Promise<Avaliacao> {
  if (emDemo) return avaliacaoDemo();
  return fetch(`/api/sessoes/${idSessao}/avaliacao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ marcacoes }),
  }).then((r) => json<Avaliacao>(r));
}

export const buscarDev = (idSessao: string) =>
  emDemo ? Promise.resolve(devDemo) : fetch(`/api/sessoes/${idSessao}/dev`).then((r) => json<Dev>(r));

export function mmss(segundos: number) {
  const s = Math.max(0, Math.round(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

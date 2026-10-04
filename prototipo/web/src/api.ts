// Conversa com o servidor Python (prototipo/servidor.py). No modo demonstração, usa dados falsos.

import { analisarDemo, configDemo, devDemo, emDemo, sortearDemo } from "./demo";

export type Config = {
  areas: string[];
  origens: string[];
  tempo_pesquisa: number;
  tempo_explicacao: number;
};

export type Sessao = { id: string; pergunta: string; area: string; origem: string };

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

async function json<T>(resposta: Response): Promise<T> {
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    throw new Error(corpo?.detail ?? `Erro ${resposta.status} no servidor.`);
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
): Promise<Sessao> {
  if (emDemo) return sortearDemo(aoAndar);
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
      if (evento.tipo === "status") aoAndar(evento.conteudo);
      if (evento.tipo === "erro") throw new Error(evento.conteudo);
      if (evento.tipo === "pronto") return evento.conteudo as Sessao;
    }
  }
  throw new Error("A conexão com o servidor terminou antes do fim do sorteio.");
}

export function analisar(idSessao: string, audio: Blob): Promise<Resultado> {
  if (emDemo) return analisarDemo();
  const extensao = audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "mp4" : "webm";
  const formulario = new FormData();
  formulario.append("audio", audio, `explicacao.${extensao}`);
  return fetch(`/api/sessoes/${idSessao}/analise`, { method: "POST", body: formulario }).then((r) =>
    json<Resultado>(r),
  );
}

export const buscarDev = (idSessao: string) =>
  emDemo ? Promise.resolve(devDemo) : fetch(`/api/sessoes/${idSessao}/dev`).then((r) => json<Dev>(r));

export function mmss(segundos: number) {
  const s = Math.max(0, Math.round(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

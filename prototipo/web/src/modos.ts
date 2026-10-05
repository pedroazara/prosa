// Modos de treino. Cada modo é só um conjunto de regras: tempos, quantos temas, de onde vêm os temas
// e uma instrução curta. As telas leem tudo daqui; o servidor não precisa saber de modo nenhum.

import type { Config } from "./api";

export type Modo = {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  pesquisa: number | null; // segundos; null = sem limite
  explicacao: number | null;
  temas: number; // mais de 1 = maratona
  fonte: "novo" | "salvo"; // "salvo" não gasta IA
  instrucao?: string; // aparece na tela de gravação
  maxPalavras?: number; // o relatório avisa se passar
};

export type Personalizado = Pick<Modo, "pesquisa" | "explicacao" | "temas" | "fonte" | "maxPalavras"> & {
  feynman: boolean;
};

const FEYNMAN = "Explique para uma criança de 12 anos: palavras simples, sem jargão, com um exemplo do dia a dia.";
const CHAVE_PERSONALIZADO = "prosa-personalizado";
const CHAVE_MODO = "prosa-modo";

export const PERSONALIZADO_PADRAO: Personalizado = {
  pesquisa: 10 * 60,
  explicacao: 3 * 60,
  temas: 1,
  fonte: "novo",
  feynman: false,
};

export function listarModos(config: Config | null, p: Personalizado): Modo[] {
  const pesquisa = config?.tempo_pesquisa ?? 300;
  const explicacao = config?.tempo_explicacao ?? 120;
  return [
    { id: "classico", nome: "Clássico", icone: "school", descricao: "Um tema novo, com o tempo padrão.",
      pesquisa, explicacao, temas: 1, fonte: "novo" },
    { id: "relampago", nome: "Relâmpago", icone: "bolt", descricao: "30 s para pesquisar, 30 s para explicar. Usa um tema salvo.",
      pesquisa: 30, explicacao: 30, temas: 1, fonte: "salvo", instrucao: "Só a ideia central, numa frase ou duas." },
    { id: "elevador", nome: "Elevator pitch", icone: "elevator", descricao: "1 minuto e até 150 palavras para convencer.",
      pesquisa: 2 * 60, explicacao: 60, temas: 1, fonte: "novo", maxPalavras: 150,
      instrucao: "Comece pela resposta direta. Até 150 palavras." },
    { id: "maratona", nome: "Maratona", icone: "sprint", descricao: "3 temas salvos seguidos, com resumo no fim.",
      pesquisa: 2 * 60, explicacao: 60, temas: 3, fonte: "salvo" },
    { id: "feynman", nome: "Feynman", icone: "child_care", descricao: "Explique como para uma criança, sem jargão.",
      pesquisa, explicacao, temas: 1, fonte: "novo", instrucao: FEYNMAN },
    { id: "personalizado", nome: "Personalizado", icone: "tune", descricao: "Você escolhe os tempos, os temas e o estilo.",
      pesquisa: p.pesquisa, explicacao: p.explicacao, temas: p.temas, fonte: p.fonte,
      maxPalavras: p.maxPalavras, instrucao: p.feynman ? FEYNMAN : undefined },
  ];
}

// Preferências guardadas no navegador. Se o armazenamento falhar, valem os padrões.
function ler<T>(chave: string, padrao: T): T {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? { ...padrao, ...JSON.parse(valor) } : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* vale só nesta visita */
  }
}

export const lerPersonalizado = () => ler(CHAVE_PERSONALIZADO, PERSONALIZADO_PADRAO);
export const gravarPersonalizado = (p: Personalizado) => gravar(CHAVE_PERSONALIZADO, p);
export const lerModo = () => ler(CHAVE_MODO, { id: "classico" }).id;
export const gravarModo = (id: string) => gravar(CHAVE_MODO, { id });

/** 30 → "30 segundos"; 60 → "1 minuto"; 150 → "2,5 minutos"; null → null. */
export function duracaoPorExtenso(segundos: number | null): string | null {
  if (segundos === null) return null;
  if (segundos < 60) return `${segundos} segundos`;
  const minutos = segundos / 60;
  return `${String(Number(minutos.toFixed(1))).replace(".", ",")} ${minutos === 1 ? "minuto" : "minutos"}`;
}

// Efeitos sonoros, sintetizados na hora com a Web Audio API: nenhum arquivo de áudio.
// O navegador só libera o som depois de um clique, então o contexto nasce no primeiro clique da página.

let contexto: AudioContext | null = null;
let mudo = lerMudo();

function lerMudo() {
  try {
    return localStorage.getItem("prosa-mudo") === "1";
  } catch {
    return false;
  }
}

export const estaMudo = () => mudo;

export function definirMudo(valor: boolean) {
  mudo = valor;
  try {
    localStorage.setItem("prosa-mudo", valor ? "1" : "0");
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}

function ctx(): AudioContext | null {
  if (mudo) return null;
  if (!contexto) {
    try {
      contexto = new AudioContext();
    } catch {
      return null;
    }
  }
  if (contexto.state === "suspended") void contexto.resume();
  return contexto;
}

/** Uma nota: frequência (Hz), quando começa (s, a partir de agora), duração (s), volume e timbre. */
function nota(freq: number, quando = 0, duracao = 0.15, volume = 0.18, tipo: OscillatorType = "sine", freqFinal?: number) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + quando;
  const osc = c.createOscillator();
  const ganho = c.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t);
  if (freqFinal) osc.frequency.exponentialRampToValueAtTime(freqFinal, t + duracao);
  // Ataque rápido e queda exponencial: soa como um toque, e não como um bipe seco.
  ganho.gain.setValueAtTime(0.0001, t);
  ganho.gain.exponentialRampToValueAtTime(volume, t + 0.008);
  ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
  osc.connect(ganho).connect(c.destination);
  osc.start(t);
  osc.stop(t + duracao + 0.02);
}

// Dó maior, do grave ao agudo: as melodias abaixo usam estas notas.
const DO = 523.25, MI = 659.25, SOL = 783.99, LA = 880, DO2 = 1046.5, MI2 = 1318.5, SOL2 = 1568;

export const sons = {
  /** Clique suave dos botões. */
  clique: () => nota(1800, 0, 0.04, 0.05, "triangle"),
  /** Cada nome que passa pela janela da roleta. */
  tique: () => nota(2400, 0, 0.025, 0.06, "square"),
  /** A roleta parou: a área ou a subárea foi revelada. */
  revelar: () => {
    nota(SOL, 0, 0.18, 0.16, "triangle");
    nota(DO2, 0.09, 0.35, 0.16, "triangle");
  },
  /** O tema ficou pronto e a pesquisa começou. */
  temaPronto: () => [DO, MI, SOL, DO2].forEach((f, i) => nota(f, i * 0.09, i === 3 ? 0.5 : 0.2, 0.15, "triangle")),
  /** Contagem regressiva: os últimos segundos de cada cronômetro. */
  contagem: () => nota(LA, 0, 0.08, 0.1, "sine"),
  /** O tempo acabou. */
  esgotado: () => {
    nota(LA, 0, 0.18, 0.18, "square");
    nota(LA, 0.22, 0.18, 0.18, "square");
    nota(DO2, 0.44, 0.4, 0.18, "square");
  },
  /** Começou a gravar: sobe. */
  gravar: () => nota(440, 0, 0.18, 0.15, "sine", 880),
  /** Parou de gravar: desce. */
  pararGravacao: () => nota(880, 0, 0.18, 0.15, "sine", 440),
  /** O relatório ou a avaliação da IA chegou. */
  pronto: () => [MI2, SOL2].forEach((f, i) => nota(f, i * 0.1, 0.4, 0.12, "sine")),
  /** Algo deu errado. */
  erro: () => {
    nota(220, 0, 0.16, 0.14, "sawtooth");
    nota(175, 0.15, 0.28, 0.14, "sawtooth");
  },
};

// Todo botão da página faz o clique suave, sem precisar mexer em cada componente.
// "pointerdown" também serve para liberar o áudio logo no primeiro toque.
document.addEventListener(
  "pointerdown",
  (e) => {
    if ((e.target as Element).closest?.("button:not(:disabled), a.botao")) sons.clique();
    else ctx();
  },
  { capture: true },
);

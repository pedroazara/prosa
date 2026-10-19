import { useEffect, useRef, useState } from "react";
import { mmss } from "../api";
import Icone from "./Icone";

const BARRAS = 64;

/** Calcula a altura de cada barra da onda a partir do volume real da gravação. */
async function picos(audio: Blob): Promise<number[]> {
  const contexto = new AudioContext();
  try {
    const sinal = (await contexto.decodeAudioData(await audio.arrayBuffer())).getChannelData(0);
    const passo = Math.floor(sinal.length / BARRAS);
    const valores = Array.from({ length: BARRAS }, (_, i) => {
      let max = 0;
      for (let j = i * passo; j < (i + 1) * passo; j++) max = Math.max(max, Math.abs(sinal[j]));
      return max;
    });
    const maior = Math.max(...valores, 0.01);
    return valores.map((v) => 0.12 + (v / maior) * 0.88);
  } finally {
    contexto.close();
  }
}

export default function Player({ audio, duracao, aoTempo }: { audio: Blob | null; duracao: number; aoTempo?: (t: number) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [onda, setOnda] = useState<number[]>(() => Array(BARRAS).fill(0.15));
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const elemento = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audio) return;
    const u = URL.createObjectURL(audio);
    setUrl(u);
    picos(audio).then(setOnda).catch(() => {});
    return () => URL.revokeObjectURL(u);
  }, [audio]);

  const total = elemento.current?.duration && isFinite(elemento.current.duration) ? elemento.current.duration : duracao;
  const progresso = total ? tempo / total : 0;

  function alternar() {
    const a = elemento.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  }

  function buscar(e: React.MouseEvent<HTMLDivElement>) {
    const a = elemento.current;
    if (!a || !total) return;
    const caixa = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - caixa.left) / caixa.width) * total;
  }

  return (
    <div className={`cartao player ${audio ? "" : "player-vazio"}`}>
      {url && (
        <audio
          ref={elemento}
          src={url}
          onPlay={() => setTocando(true)}
          onPause={() => setTocando(false)}
          onEnded={() => setTocando(false)}
          onTimeUpdate={(e) => {
            setTempo(e.currentTarget.currentTime);
            aoTempo?.(e.currentTarget.currentTime);
          }}
        />
      )}
      <div className="player-controle">
        <button className="botao-play" onClick={alternar} disabled={!audio} aria-label={tocando ? "Pausar" : "Ouvir"}>
          <Icone nome={tocando ? "pause" : "play_arrow"} cheio tamanho={26} />
        </button>
        <div className="player-info">
          <span className="player-titulo">Sua explicação</span>
          <span className="player-tempo">
            {mmss(tempo)} / {mmss(total)}
          </span>
        </div>
      </div>
      <div className="onda" onClick={buscar} role="slider" aria-label="Posição da gravação" aria-valuenow={Math.round(tempo)}>
        <div className="onda-progresso" style={{ width: `${progresso * 100}%` }} />
        {onda.map((altura, i) => (
          <span key={i} className={i / BARRAS < progresso ? "tocada" : ""} style={{ transform: `scaleY(${altura})` }} />
        ))}
      </div>
      <span className="player-nota">
        <Icone nome="graphic_eq" tamanho={18} />
        {audio ? "Áudio original" : "Sem áudio no modo demo"}
      </span>
    </div>
  );
}

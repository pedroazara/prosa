import { useEffect, useRef, useState } from "react";
import { mmss } from "../api";

/** Contagem regressiva baseada no relógio, para não atrasar se a aba ficar em segundo plano. */
export function useContagem(duracao: number, ativo: boolean, aoFim: () => void) {
  const [restante, setRestante] = useState(duracao);
  const fim = useRef(aoFim);
  fim.current = aoFim;

  useEffect(() => {
    if (!ativo) return;
    const inicio = Date.now();
    setRestante(duracao);
    const id = setInterval(() => {
      const r = duracao - (Date.now() - inicio) / 1000;
      setRestante(Math.max(0, r));
      if (r <= 0) {
        clearInterval(id);
        fim.current();
      }
    }, 200);
    return () => clearInterval(id);
  }, [duracao, ativo]);

  return restante;
}

type Props = { restante: number; total: number; legenda: string; tamanho?: number };

export default function Anel({ restante, total, legenda, tamanho = 240 }: Props) {
  const raio = 46;
  const circunferencia = 2 * Math.PI * raio;
  const fracao = total ? restante / total : 0;

  return (
    <div className={`anel ${restante <= 30 ? "urgente" : ""}`} style={{ width: tamanho, height: tamanho }}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle className="anel-trilho" cx="50" cy="50" r={raio} />
        <circle
          className="anel-progresso"
          cx="50"
          cy="50"
          r={raio}
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - fracao)}
        />
      </svg>
      <div className="anel-centro">
        <span className="anel-tempo" role="timer">{mmss(Math.ceil(restante))}</span>
        <span className="anel-legenda">{legenda}</span>
      </div>
    </div>
  );
}

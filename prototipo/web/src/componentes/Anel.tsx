import { useEffect, useRef, useState } from "react";
import { mmss } from "../api";
import { sons } from "../sons";

/** Segundos finais com tique: 10, ou menos nos modos curtos (5 num de 30 s). */
const aviso = (duracao: number) => Math.min(10, Math.floor(duracao / 6));

/**
 * Cronômetro baseado no relógio, para não atrasar se a aba ficar em segundo plano.
 * Com duração, conta para baixo e chama aoFim no zero. Sem duração (null, modo ilimitado),
 * conta o tempo que passou e nunca termina sozinho.
 */
export function useContagem(duracao: number | null, ativo: boolean, aoFim: () => void) {
  const [restante, setRestante] = useState(duracao ?? 0);
  const fim = useRef(aoFim);
  fim.current = aoFim;

  useEffect(() => {
    if (!ativo) return;
    const inicio = Date.now();
    let ultimoTique = Infinity;
    setRestante(duracao ?? 0);
    const id = setInterval(() => {
      const passou = (Date.now() - inicio) / 1000;
      if (duracao === null) {
        setRestante(passou);
        return;
      }
      const r = duracao - passou;
      setRestante(Math.max(0, r));
      const segundo = Math.ceil(r);
      if (r > 0 && segundo <= aviso(duracao) && segundo < ultimoTique) {
        ultimoTique = segundo;
        sons.contagem();
      }
      if (r <= 0) {
        clearInterval(id);
        sons.esgotado();
        fim.current();
      }
    }, 200);
    return () => clearInterval(id);
  }, [duracao, ativo]);

  return restante;
}

/** Sem total (modo ilimitado), "restante" é o tempo que já passou e o anel fica cheio. */
type Props = { restante: number; total: number | null; legenda: string; tamanho?: number };

export default function Anel({ restante, total, legenda, tamanho = 240 }: Props) {
  const raio = 46;
  const circunferencia = 2 * Math.PI * raio;
  const fracao = total === null ? 1 : total ? restante / total : 0;
  const urgente = total !== null && restante <= Math.min(30, total / 4);

  return (
    <div className={`anel ${urgente ? "urgente" : ""}`} style={{ width: tamanho, height: tamanho }}>
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
        <span className="anel-tempo" role="timer">{mmss(total === null ? Math.floor(restante) : Math.ceil(restante))}</span>
        <span className="anel-legenda">{legenda}</span>
      </div>
    </div>
  );
}

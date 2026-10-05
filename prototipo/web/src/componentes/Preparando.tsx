import { useState } from "react";
import type { Sorteio } from "../api";
import Icone from "./Icone";
import { Balao } from "./Logo";
import Roleta from "./Roleta";

const PAUSA = 600; // respiro entre revelar a área e começar a girar a subárea

export default function Preparando({ andamento, sorteio }: { andamento: string[]; sorteio: Sorteio | null }) {
  // Se o usuário escolheu a área, só a subárea gira.
  const [areaRevelada, setAreaRevelada] = useState(false);
  const giraArea = !!sorteio?.areas.length;
  const subareaAtiva = !!sorteio && (!giraArea || areaRevelada);

  return (
    <section className="centro preparando">
      <span className="pilula">
        <span className="ponto-pulsante" />
        Preparando o desafio
      </span>
      <div className="carregador" aria-hidden>
        <Balao modo="sempre" tamanho={52} />
      </div>
      <h1 className="titulo-secao">Escolhendo o seu tema</h1>
      <p className="lede">A IA propõe temas, lê o artigo de referência e monta a rubrica oculta. Leva cerca de um minuto.</p>
      {sorteio && (
        <div className="roletas">
          <Roleta
            rotulo="Área"
            opcoes={sorteio.areas}
            escolhida={sorteio.area}
            ativa
            aoTerminar={() => setTimeout(() => setAreaRevelada(true), giraArea ? PAUSA : 0)}
          />
          <Roleta rotulo="Subárea" opcoes={sorteio.subareas} escolhida={sorteio.subarea} ativa={subareaAtiva} />
        </div>
      )}
      <ol className="andamento" aria-live="polite">
        {andamento.map((m, i) => {
          const atual = i === andamento.length - 1;
          return (
            <li key={i} className={atual ? "atual" : "feito"}>
              {atual ? <span className="girando" /> : <Icone nome="check_circle" cheio tamanho={20} />}
              {m}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

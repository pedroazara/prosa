import type { ReactNode } from "react";

/** Faixa do topo das telas de pesquisa e gravação: o passo atual e o que está ligado. */
export default function BarraStatus({ passo, direita }: { passo: string; direita: ReactNode }) {
  return (
    <div className="barra-status">
      <span className="pilula pilula-forte">
        <span className="ping" />
        {passo}
      </span>
      <span className="barra-status-direita">{direita}</span>
    </div>
  );
}

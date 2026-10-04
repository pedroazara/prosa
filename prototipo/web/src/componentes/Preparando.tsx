import Icone from "./Icone";

export default function Preparando({ andamento }: { andamento: string[] }) {
  return (
    <section className="centro preparando">
      <span className="pilula">
        <span className="ponto-pulsante" />
        Preparando o desafio
      </span>
      <div className="carregador" aria-hidden>
        <img src="/icone.svg" alt="" />
      </div>
      <h1 className="titulo-secao">Escolhendo o seu tema</h1>
      <p className="lede">A IA propõe temas, lê o artigo de referência e monta a rubrica oculta. Leva cerca de um minuto.</p>
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

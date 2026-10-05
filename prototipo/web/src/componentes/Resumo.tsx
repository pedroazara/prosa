import { mmss, type Fala } from "../api";
import Icone from "./Icone";

/** Uma rodada da maratona: o tema e o que foi medido na fala (tudo por código, sem IA). */
export type Rodada = { pergunta: string; area: string; fala: Fala; marcados: number; pontos: number };

const soma = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
const viciosPorMinuto = (f: Fala) => (soma(f.hesitacoes) + soma(f.muletas)) / (f.duracao / 60 || 1);
const media = (valores: number[]) => valores.reduce((a, b) => a + b, 0) / (valores.length || 1);

export default function Resumo({ rodadas, aoReiniciar }: { rodadas: Rodada[]; aoReiniciar: () => void }) {
  const ppm = media(rodadas.map((r) => r.fala.palavras_por_minuto));
  const vicios = media(rodadas.map((r) => viciosPorMinuto(r.fala)));
  const marcados = rodadas.reduce((a, r) => a + r.marcados, 0);
  const pontos = rodadas.reduce((a, r) => a + r.pontos, 0);

  return (
    <section className="resumo">
      <div className="centro">
        <span className="sobretitulo">Maratona concluída</span>
        <h1 className="titulo-secao">{rodadas.length} temas explicados</h1>
      </div>

      <div className="resumo-totais">
        <div className="cartao metrica">
          <span className="rotulo">Cadência média</span>
          <span className="numero-medio">{Math.round(ppm)}</span>
          <span className="nota">palavras por minuto</span>
        </div>
        <div className="cartao metrica">
          <span className="rotulo">Vícios de linguagem</span>
          <span className="numero-medio">{vicios.toFixed(1)}</span>
          <span className="nota">por minuto, em média</span>
        </div>
        <div className="cartao metrica">
          <span className="rotulo">Pontos marcados</span>
          <span className="numero-medio">
            {marcados}/{pontos}
          </span>
          <span className="nota">pela sua própria marcação</span>
        </div>
      </div>

      <ol className="resumo-rodadas">
        {rodadas.map((r, i) => (
          <li key={i} className="cartao resumo-rodada">
            <span className="resumo-numero">{i + 1}</span>
            <div className="resumo-tema">
              <span className="rotulo">{r.area}</span>
              <strong>{r.pergunta}</strong>
              <span className="nota">
                {mmss(r.fala.duracao)} · {Math.round(r.fala.palavras_por_minuto)} palavras/min · {r.fala.pausas} pausas ·{" "}
                {viciosPorMinuto(r.fala).toFixed(1)} vícios/min · {r.marcados} de {r.pontos} pontos
              </span>
            </div>
          </li>
        ))}
      </ol>

      <div className="relatorio-fim">
        <span className="nota com-icone">
          <Icone nome="history_edu" tamanho={18} /> Cada tema ficou salvo em prototipo/sessoes
        </span>
        <button className="botao primario" onClick={aoReiniciar}>
          Voltar ao início <Icone nome="arrow_forward" tamanho={18} />
        </button>
      </div>
    </section>
  );
}

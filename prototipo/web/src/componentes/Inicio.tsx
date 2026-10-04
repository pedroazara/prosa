import { useState } from "react";
import { mmss, type Config } from "../api";
import Icone from "./Icone";

const NOMES_ORIGEM: Record<string, string> = { mundo: "Mundo", brasil: "Brasil" };

type Props = { config: Config | null; aoComecar: (area: string | null, origem: string) => void };

export default function Inicio({ config, aoComecar }: Props) {
  const [area, setArea] = useState<string | null>(null);
  const [origem, setOrigem] = useState("mundo");
  const pesquisa = mmss(config?.tempo_pesquisa ?? 300);
  const explicacao = mmss(config?.tempo_explicacao ?? 120);
  const minutos = (segundos = 0) => Math.round(segundos / 60);

  return (
    <section className="inicio">
      <div className="brilho" aria-hidden />

      <div className="inicio-titulo">
        <span className="pilula">
          <span className="ponto-pulsante" />
          Treino de síntese e oratória
        </span>
        <h1>
          Aprenda rápido.
          <br />
          Explique em {minutos(config?.tempo_explicacao ?? 120)} minutos.
        </h1>
        <p className="lede">Um tema surpresa, {minutos(config?.tempo_pesquisa ?? 300)} minutos de pesquisa e uma explicação cronometrada.</p>
      </div>

      <div className="cartao cartao-destaque inicio-cartao">
        <div className="inicio-cartao-topo">
          <span className="fonte-pilula">
            <Icone nome="menu_book" tamanho={16} />
            Wikipedia · {area ?? "qualquer área"}
          </span>
          <div className="segmentado" role="radiogroup" aria-label="Origem dos temas">
            {["mundo", "brasil"]
              .filter((o) => !config || config.origens.includes(o))
              .map((o) => (
                <button key={o} role="radio" aria-checked={origem === o} className={origem === o ? "ativo" : ""} onClick={() => setOrigem(o)}>
                  {NOMES_ORIGEM[o] ?? o}
                </button>
              ))}
          </div>
        </div>

        <div className="inicio-areas">
          <span className="rotulo">Área do tema</span>
          <div className="chips">
            <button className={`chip ${area === null ? "ativo" : ""}`} onClick={() => setArea(null)}>
              <Icone nome="casino" tamanho={16} />
              Surpreenda-me
            </button>
            {config?.areas.map((a) => (
              <button key={a} className={`chip ${area === a ? "ativo" : ""}`} onClick={() => setArea(a)}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <button className="botao primario largo" disabled={!config} onClick={() => aoComecar(area, origem)}>
          Sortear tema e começar
          <Icone nome="arrow_forward" />
        </button>

        <p className="nota-centro">
          <Icone nome="info" tamanho={16} />
          O cronômetro de pesquisa ({pesquisa}) começa assim que o tema aparece
        </p>
      </div>

      <div className="passos">
        <div className="passos-linha" aria-hidden />
        <div className="cartao passo">
          <span className="passo-icone">
            <Icone nome="timer" />
          </span>
          <h3>1. Pesquise</h3>
          <p>{pesquisa} na internet, anotando no papel as ideias centrais.</p>
        </div>
        <div className="cartao passo">
          <span className="passo-icone destaque">
            <Icone nome="mic" />
          </span>
          <h3>2. Explique</h3>
          <p>{explicacao} em voz alta, sem consultar nada, com suas próprias palavras.</p>
        </div>
        <div className="cartao passo">
          <span className="passo-icone neutro">
            <Icone nome="analytics" />
          </span>
          <h3>3. Feedback</h3>
          <p>Ritmo, pausas e vícios de linguagem, ao lado dos pontos que a referência esperava.</p>
        </div>
      </div>
    </section>
  );
}

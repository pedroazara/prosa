import type { Sessao } from "../api";
import Anel, { useContagem } from "./Anel";
import BarraStatus from "./BarraStatus";
import Icone from "./Icone";

type Props = { sessao: Sessao; duracao: number; aoTerminar: (tempoEsgotado: boolean) => void };

const DICAS = [
  { icone: "psychology", texto: "Procure o porquê e o como, não só o quê." },
  { icone: "edit_note", texto: "Anote no papel de 3 a 4 ideias centrais, em poucas palavras. Escrever curto obriga a sintetizar." },
  { icone: "travel_explore", texto: "Use as fontes que quiser: artigos, vídeos, livros." },
  { icone: "do_not_disturb_on", texto: "Quando o tempo acabar, feche as abas e guarde as anotações: a explicação é sem consulta." },
];

export default function Pesquisa({ sessao, duracao, aoTerminar }: Props) {
  const restante = useContagem(duracao, true, () => aoTerminar(true));
  const busca = encodeURIComponent(sessao.pergunta);

  return (
    <section className="sala">
      <BarraStatus
        passo="Passo 1 de 3 · Pesquisa"
        direita={
          <>
            <Icone nome="timer" tamanho={18} /> Cronômetro ativo
          </>
        }
      />

      <div className="sala-centro">
        <div className="sala-tema">
          <span className="sobretitulo">{sessao.area} · Tema sorteado</span>
          <h1 className="pergunta">{sessao.pergunta}</h1>
          <p className="lede">
            Pesquise em outra aba. Quando o tempo acabar, você vai explicar os pontos principais em voz alta, sem
            consultar nada.
          </p>
        </div>

        <div className="pesquisa-grade">
          <div className="cartao cartao-destaque pesquisa-tempo">
            <Anel restante={restante} total={duracao} legenda="de pesquisa" />
            <button className="botao primario largo" onClick={() => aoTerminar(false)}>
              Terminei: fechar as fontes
              <Icone nome="arrow_forward" />
            </button>
          </div>

          <div className="pesquisa-lado">
            <div className="cartao">
              <h3 className="cartao-titulo">
                <Icone nome="tips_and_updates" tamanho={20} /> Como pesquisar
              </h3>
              <ul className="dicas">
                {DICAS.map((d) => (
                  <li key={d.texto}>
                    <span className="dica-icone">
                      <Icone nome={d.icone} tamanho={18} />
                    </span>
                    {d.texto}
                  </li>
                ))}
              </ul>
            </div>
            <div className="atalhos">
              <a className="botao" href={`https://www.google.com/search?q=${busca}`} target="_blank" rel="noreferrer">
                <Icone nome="search" tamanho={18} /> Google
              </a>
              <a className="botao" href={`https://www.youtube.com/results?search_query=${busca}`} target="_blank" rel="noreferrer">
                <Icone nome="smart_display" tamanho={18} /> YouTube
              </a>
              <a className="botao" href={`https://scholar.google.com/scholar?q=${busca}`} target="_blank" rel="noreferrer">
                <Icone nome="school" tamanho={18} /> Scholar
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

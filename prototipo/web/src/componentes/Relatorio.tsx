import { useState, type ReactNode } from "react";
import { mmss, type Fala, type Resultado, type Sessao } from "../api";
import Icone from "./Icone";
import Player from "./Player";

type Props = { sessao: Sessao; resultado: Resultado; audio: Blob | null; limite: number; aoReiniciar: () => void };

/** Quebra a transcrição em pedaços, envolvendo os vícios em <mark>. */
function destacar(fala: Fala): ReactNode[] {
  const pedacos: ReactNode[] = [];
  let pos = 0;
  for (const m of fala.marcacoes) {
    if (m.inicio < pos) continue; // padrões sobrepostos: fica o primeiro
    pedacos.push(fala.texto.slice(pos, m.inicio));
    pedacos.push(
      <mark key={m.inicio} className={`vicio vicio-${m.tipo}`}>
        {fala.texto.slice(m.inicio, m.fim)}
      </mark>,
    );
    pos = m.fim;
  }
  pedacos.push(fala.texto.slice(pos));
  return pedacos;
}

function Etiquetas({ contagem, vazio }: { contagem: Record<string, number>; vazio: string }) {
  const itens = Object.entries(contagem).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (!itens.length) return <span className="nota">{vazio}</span>;
  return (
    <div className="etiquetas">
      {itens.map(([nome, n]) => (
        <span key={nome} className="etiqueta">
          {nome} <b>×{n}</b>
        </span>
      ))}
    </div>
  );
}

export default function Relatorio({ sessao, resultado, audio, limite, aoReiniciar }: Props) {
  const { fala, pontos } = resultado;
  const [cobertos, setCobertos] = useState<boolean[]>(() => pontos.map(() => false));

  const minutos = fala.duracao / 60 || 1;
  const soma = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
  const hesitacoes = soma(fala.hesitacoes);
  const muletas = soma(fala.muletas);
  const passou = fala.duracao > limite;
  const nCobertos = cobertos.filter(Boolean).length;

  return (
    <section className="relatorio">
      <header className="relatorio-cabeca">
        <div className="contexto">
          <span className="ponto-pulsante" />
          <span>Sessão concluída</span>
          <span className="sep">•</span>
          <span className={passou ? "texto-alerta" : ""}>
            {mmss(fala.duracao)} de áudio gravado{passou && ` (limite: ${mmss(limite)})`}
          </span>
          <span className="sep">•</span>
          <span className="etiqueta">{sessao.area}</span>
        </div>
        <h1 className="titulo-relatorio">{sessao.pergunta}</h1>
        <Player audio={audio} duracao={fala.duracao} />
      </header>

      <div className="relatorio-grade">
        <div className="coluna">
          <div className="coluna-cabeca">
            <div>
              <h2>Conceitos-chave</h2>
              <p className="nota">Os pontos que a referência esperava. Marque os que você acha que cobriu.</p>
            </div>
            <span className="contador">
              {nCobertos} de {pontos.length} marcados
            </span>
          </div>

          <ol className="conceitos">
            {pontos.map((p, i) => (
              <li key={i}>
                <button
                  className={`cartao conceito ${cobertos[i] ? "coberto" : ""}`}
                  onClick={() => setCobertos((c) => c.map((v, j) => (j === i ? !v : v)))}
                  aria-pressed={cobertos[i]}
                >
                  <span className="conceito-marca">
                    <Icone nome={cobertos[i] ? "check" : "radio_button_unchecked"} cheio={cobertos[i]} tamanho={18} />
                  </span>
                  <span className="conceito-texto">{p}</span>
                  <span className="conceito-estado">{cobertos[i] ? "Coberto" : "Marcar"}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="aviso-suave">
            <Icone nome="info" tamanho={18} />
            <p>
              A avaliação automática do conteúdo, com a evidência de cada ponto na sua fala, ainda está em
              desenvolvimento.{" "}
              <a href={resultado.link} target="_blank" rel="noreferrer">
                Ver referência: {resultado.artigo}
              </a>
            </p>
          </div>

          <div className="cartao">
            <div className="cartao-cabeca">
              <h3 className="cartao-titulo">
                <Icone nome="notes" tamanho={20} /> Transcrição
              </h3>
              <div className="legenda">
                <span><i className="vicio-hesitacao" /> hesitação</span>
                <span><i className="vicio-muleta" /> muleta</span>
              </div>
            </div>
            <p className="transcricao">{fala.texto ? destacar(fala) : <em>Nenhuma palavra reconhecida.</em>}</p>
          </div>
        </div>

        <div className="coluna">
          <div className="coluna-cabeca">
            <div>
              <h2>Métricas de fala</h2>
              <p className="nota">Medidas pelo código a partir da transcrição, sem IA.</p>
            </div>
          </div>

          <div className="cartao metrica">
            <span className="rotulo">Cadência</span>
            <div className="metrica-numero">
              <span className="numero-grande">{Math.round(fala.palavras_por_minuto)}</span>
              <span className="unidade">palavras por minuto</span>
            </div>
            <span className="nota">{fala.palavras} palavras no total</span>
          </div>

          <div className="metricas-duplas">
            <div className="cartao metrica">
              <span className="rotulo">Pausas</span>
              <div className="metrica-numero">
                <span className="numero-medio">{fala.pausas}</span>
                <span className="unidade">pausas</span>
              </div>
              <span className="nota">a maior durou {fala.maior_pausa.toFixed(1)} s</span>
            </div>
            <div className="cartao metrica">
              <span className="rotulo">Hesitações</span>
              <div className="metrica-numero">
                <span className="numero-medio">{hesitacoes}</span>
                <span className="unidade">detectadas</span>
              </div>
              <Etiquetas contagem={fala.hesitacoes} vazio="Nenhuma detectada" />
            </div>
          </div>

          <div className="cartao metrica">
            <span className="rotulo">Palavras-muleta</span>
            <div className="metrica-numero">
              <span className="numero-medio">{muletas}</span>
              <span className="unidade">{((hesitacoes + muletas) / minutos).toFixed(1)} vícios por minuto, no total</span>
            </div>
            <Etiquetas contagem={fala.muletas} vazio="Nenhuma detectada" />
            <span className="nota">
              Estimativa por cima: “então” e “assim” também podem ser usos legítimos.
            </span>
          </div>
        </div>
      </div>

      <div className="relatorio-fim">
        <span className="nota com-icone">
          <Icone nome="history_edu" tamanho={18} /> Sessão salva em prototipo/sessoes
        </span>
        <button className="botao primario" onClick={aoReiniciar}>
          Novo tema <Icone nome="arrow_forward" tamanho={18} />
        </button>
      </div>
    </section>
  );
}

import { useState, type ReactNode } from "react";
import { mmss, type Fala, type Resultado, type Sessao } from "../api";
import Icone from "./Icone";
import Player from "./Player";

type Props = {
  sessao: Sessao;
  resultado: Resultado;
  audio: Blob | null;
  limite: number | null; // null: modo sem limite de tempo
  maxPalavras?: number;
  /** O botão do fim: "Novo tema", ou na maratona "Próximo tema (2 de 3)" e "Ver resumo". */
  seguir: { rotulo: string; acao: () => void };
};

/** Quebra a transcrição em pedaços, envolvendo os vícios em <mark>. */
function destacar(fala: Fala, tempo: number): ReactNode[] {
  const tokens = fala.tokens ?? [];
  // A palavra falando agora: a última que já começou, enquanto ainda soa (ou logo depois dela).
  let ativa = -1;
  tokens.forEach((t, i) => {
    if (t.t0 <= tempo) ativa = i;
  });
  if (ativa >= 0 && tempo > tokens[ativa].t1 + 0.4) ativa = -1;

  // Cortes nas bordas das palavras e dos vícios, para cada pedaço ter um só estilo.
  const cortes = new Set([0, fala.texto.length]);
  for (const t of tokens) cortes.add(t.inicio).add(t.fim);
  for (const m of fala.marcacoes) cortes.add(m.inicio).add(m.fim);
  const pos = [...cortes].filter((c) => c >= 0 && c <= fala.texto.length).sort((a, b) => a - b);

  const pedacos: ReactNode[] = [];
  for (let k = 0; k < pos.length - 1; k++) {
    const [a, b] = [pos[k], pos[k + 1]];
    let no: ReactNode = fala.texto.slice(a, b);
    if (ativa >= 0 && a >= tokens[ativa].inicio && b <= tokens[ativa].fim) no = <span className="falando">{no}</span>;
    const m = fala.marcacoes.find((m) => a >= m.inicio && b <= m.fim);
    if (m) no = <mark className={`vicio vicio-${m.tipo}`}>{no}</mark>;
    pedacos.push(<span key={a}>{no}</span>);
  }
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

export default function Relatorio({ sessao, resultado, audio, limite, maxPalavras, seguir }: Props) {
  const { fala } = resultado;
  const [tempo, setTempo] = useState(0);

  const minutos = fala.duracao / 60 || 1;
  const soma = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
  const hesitacoes = soma(fala.hesitacoes);
  const muletas = soma(fala.muletas);
  const passou = limite !== null && fala.duracao > limite;
  const palavrasDemais = maxPalavras !== undefined && fala.palavras > maxPalavras;

  return (
    <section className="relatorio">
      <header className="relatorio-cabeca">
        <div className="contexto">
          <span className={passou ? "texto-alerta" : ""}>
            {mmss(fala.duracao)} de áudio gravado{passou && ` (limite: ${mmss(limite!)})`}
          </span>
          <span className="sep">•</span>
          <span className="etiqueta">{sessao.area}</span>
          {sessao.subarea && <span className="etiqueta">{sessao.subarea}</span>}
        </div>
        <h1 className="titulo-relatorio">{sessao.pergunta}</h1>
        <Player audio={audio} duracao={fala.duracao} aoTempo={setTempo} />
      </header>

      <div className="relatorio-grade">
        <div className="coluna">
          <div className="coluna-cabeca">
            <div>
              <h2>Transcrição</h2>
            </div>
          </div>

          <div className="aviso-suave">
            <Icone nome="info" tamanho={18} />
            <p>
              A avaliação do conteúdo pela IA ainda não está disponível.{" "}
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
            <p className="transcricao">{fala.texto ? destacar(fala, tempo) : <em>Nenhuma palavra reconhecida.</em>}</p>
          </div>
        </div>

        <div className="coluna">
          <div className="coluna-cabeca">
            <div>
              <h2>Métricas de fala</h2>
            </div>
          </div>

          <div className="cartao metrica">
            <span className="rotulo">Cadência</span>
            <div className="metrica-numero">
              <span className="numero-grande">{Math.round(fala.palavras_por_minuto)}</span>
              <span className="unidade">palavras por minuto</span>
            </div>
            <span className={`nota ${palavrasDemais ? "texto-alerta" : ""}`}>
              {fala.palavras} palavras no total
              {maxPalavras !== undefined && (palavrasDemais ? ` (passou do limite de ${maxPalavras})` : ` (limite: ${maxPalavras})`)}
            </span>
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
        <button className="botao primario" onClick={seguir.acao}>
          {seguir.rotulo} <Icone nome="arrow_forward" tamanho={18} />
        </button>
      </div>
    </section>
  );
}

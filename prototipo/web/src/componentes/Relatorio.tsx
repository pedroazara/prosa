import { useEffect, useState, type ReactNode } from "react";
import { avaliar, mmss, type Avaliacao, type Fala, type Resultado, type Sessao, type Veredito } from "../api";
import Icone from "./Icone";
import { sons } from "../sons";
import Player from "./Player";

type Props = {
  sessao: Sessao;
  resultado: Resultado;
  audio: Blob | null;
  limite: number | null; // null: modo sem limite de tempo
  maxPalavras?: number;
  /** O botão do fim: "Novo tema", ou na maratona "Próximo tema (2 de 3)" e "Ver resumo". */
  seguir: { rotulo: string; acao: () => void };
  /** Avisa quantos pontos a pessoa marcou, para o resumo da maratona. */
  aoMarcar?: (marcados: number) => void;
};

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

const NOME_VEREDITO: Record<Veredito, string> = { coberto: "Coberto", parcial: "Parcial", nao_coberto: "Não coberto" };

/** Citação da fala ou da referência, com o aviso quando o código não a encontrou no texto. */
function Citacao({ texto, conferida, rotulo }: { texto: string; conferida: boolean | null; rotulo?: string }) {
  return (
    <blockquote className="citacao">
      {rotulo && <span className="rotulo">{rotulo}</span>}“{texto}”
      {conferida === false && (
        <span className="citacao-alerta">
          <Icone nome="warning" tamanho={14} /> trecho não encontrado no texto: confira antes de confiar
        </span>
      )}
    </blockquote>
  );
}

export default function Relatorio({ sessao, resultado, audio, limite, maxPalavras, seguir, aoMarcar }: Props) {
  const { fala, pontos } = resultado;
  const [cobertos, setCobertos] = useState<boolean[]>(() => pontos.map(() => false));

  const minutos = fala.duracao / 60 || 1;
  const soma = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);
  const hesitacoes = soma(fala.hesitacoes);
  const muletas = soma(fala.muletas);
  const passou = limite !== null && fala.duracao > limite;
  const palavrasDemais = maxPalavras !== undefined && fala.palavras > maxPalavras;
  const nCobertos = cobertos.filter(Boolean).length;
  useEffect(() => aoMarcar?.(nCobertos), [nCobertos]);
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [avaliando, setAvaliando] = useState(false);
  const [erroAvaliacao, setErroAvaliacao] = useState<string | null>(null);

  async function pedirAvaliacao() {
    setAvaliando(true);
    setErroAvaliacao(null);
    try {
      setAvaliacao(await avaliar(sessao.id, cobertos));
      sons.pronto();
    } catch (e) {
      setErroAvaliacao((e as Error).message);
      sons.erro();
    } finally {
      setAvaliando(false);
    }
  }

  return (
    <section className="relatorio">
      <header className="relatorio-cabeca">
        <div className="contexto">
          <span className="ponto-pulsante" />
          <span>Sessão concluída</span>
          <span className="sep">•</span>
          <span className={passou ? "texto-alerta" : ""}>
            {mmss(fala.duracao)} de áudio gravado{passou && ` (limite: ${mmss(limite!)})`}
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
              <p className="nota">
                {avaliacao
                  ? "O que você marcou, ao lado do que a IA encontrou na sua fala."
                  : "Os pontos que a referência esperava. Marque os que você acha que cobriu antes de ver a avaliação da IA."}
              </p>
            </div>
            <span className="contador">
              {avaliacao
                ? `IA: ${avaliacao.pontos.filter((p) => p.veredito === "coberto").length} de ${pontos.length} cobertos`
                : `${nCobertos} de ${pontos.length} marcados`}
            </span>
          </div>

          <ol className="conceitos">
            {pontos.map((p, i) => {
              const ia = avaliacao?.pontos[i];
              if (!ia)
                return (
                  <li key={i}>
                    <button
                      className={`cartao conceito ${cobertos[i] ? "coberto" : ""}`}
                      onClick={() => setCobertos((c) => c.map((v, j) => (j === i ? !v : v)))}
                      aria-pressed={cobertos[i]}
                      disabled={avaliando}
                    >
                      <span className="conceito-marca">
                        <Icone nome={cobertos[i] ? "check" : "radio_button_unchecked"} cheio={cobertos[i]} tamanho={18} />
                      </span>
                      <span className="conceito-texto">{p}</span>
                      <span className="conceito-estado">{cobertos[i] ? "Coberto" : "Marcar"}</span>
                    </button>
                  </li>
                );
              const concorda = ia.veredito === "parcial" ? null : (ia.veredito === "coberto") === cobertos[i];
              return (
                <li key={i}>
                  <div className={`cartao conceito avaliado veredito-${ia.veredito}`}>
                    <span className="conceito-marca">
                      <Icone
                        nome={ia.veredito === "coberto" ? "check" : ia.veredito === "parcial" ? "contrast" : "close"}
                        cheio
                        tamanho={18}
                      />
                    </span>
                    <div className="conceito-corpo">
                      <span className="conceito-texto">{p}</span>
                      <div className="conceito-selos">
                        <span className={`selo selo-ia-${ia.veredito}`}>IA: {NOME_VEREDITO[ia.veredito]}</span>
                        <span className="selo selo-voce">Você: {cobertos[i] ? "marcou" : "não marcou"}</span>
                        {concorda !== null && (
                          <span className={`concorda ${concorda ? "sim" : "nao"}`}>
                            <Icone nome={concorda ? "handshake" : "compare_arrows"} tamanho={14} />
                            {concorda ? "concordam" : "divergem"}
                          </span>
                        )}
                      </div>
                      <p className="conceito-justificativa">{ia.justificativa}</p>
                      {ia.evidencia && <Citacao texto={ia.evidencia} conferida={ia.evidencia_verificada} />}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {!avaliacao ? (
            <div className="avaliar">
              <button className="botao primario" onClick={pedirAvaliacao} disabled={avaliando}>
                {avaliando ? <span className="girando claro" /> : <Icone nome="auto_awesome" />}
                {avaliando ? "Avaliando sua explicação…" : "Ver avaliação da IA"}
              </button>
              <span className="nota">
                {avaliando
                  ? "A IA compara sua fala com a rubrica e com o artigo. Leva uns 20 segundos."
                  : "Depois de ver, suas marcações ficam travadas: elas servem para comparar com a IA."}
              </span>
              {erroAvaliacao && (
                <span className="erro-inline">
                  <Icone nome="error" tamanho={18} /> {erroAvaliacao}
                </span>
              )}
            </div>
          ) : (
            <>
              {avaliacao.sem_fala && (
                <div className="aviso-suave">
                  <Icone nome="mic_off" tamanho={18} />
                  <p>A gravação tem pouca fala reconhecida, então não deu para avaliar o conteúdo.</p>
                </div>
              )}

              {avaliacao.afirmacoes_erradas.length > 0 && (
                <div className="cartao bloco-avaliacao bloco-erros">
                  <h3 className="cartao-titulo">
                    <Icone nome="error" tamanho={20} /> Afirmações a revisar
                  </h3>
                  {avaliacao.afirmacoes_erradas.map((e, i) => (
                    <div key={i} className="item-avaliacao">
                      <Citacao texto={e.trecho_da_fala} conferida={e.fala_verificada} rotulo="Você disse" />
                      <p>{e.correcao}</p>
                      <Citacao texto={e.trecho_da_referencia} conferida={e.referencia_verificada} rotulo={`Na referência (${resultado.artigo})`} />
                    </div>
                  ))}
                </div>
              )}

              {avaliacao.outros_pontos_corretos.length > 0 && (
                <div className="cartao bloco-avaliacao">
                  <h3 className="cartao-titulo">
                    <Icone nome="add_circle" tamanho={20} /> Outros pontos que você trouxe
                  </h3>
                  <p className="nota">Corretos e fora da rubrica: não contam contra você.</p>
                  {avaliacao.outros_pontos_corretos.map((o, i) => (
                    <div key={i} className="item-avaliacao">
                      <p>{o.ideia}</p>
                      <Citacao texto={o.trecho_da_fala} conferida={o.trecho_verificado} />
                    </div>
                  ))}
                </div>
              )}

              {(avaliacao.organizacao || avaliacao.proximo_passo) && (
                <div className="cartao bloco-avaliacao bloco-proximo">
                  {avaliacao.organizacao && (
                    <>
                      <h3 className="cartao-titulo">
                        <Icone nome="account_tree" tamanho={20} /> Organização
                      </h3>
                      <p>{avaliacao.organizacao}</p>
                    </>
                  )}
                  {avaliacao.proximo_passo && (
                    <>
                      <h3 className="cartao-titulo">
                        <Icone nome="flag" tamanho={20} /> Para a próxima
                      </h3>
                      <p>{avaliacao.proximo_passo}</p>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <div className="aviso-suave">
            <Icone nome="info" tamanho={18} />
            <p>
              A IA pode errar. Cada citação foi conferida pelo código na sua fala ou no artigo; as que não bateram
              aparecem marcadas.{" "}
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

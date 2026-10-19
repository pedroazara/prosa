import { useEffect, useRef, useState } from "react";
import { mmss, type Sessao } from "../api";
import Anel, { useContagem } from "./Anel";
import { sons } from "../sons";
import Icone from "./Icone";

type Props = {
  sessao: Sessao;
  limite: number | null;
  instrucao?: string;
  rodada?: string;
  tempoEsgotado: boolean;
  analisando: boolean;
  aoEnviar: (audio: Blob) => void;
};

type Estado = "pronto" | "gravando" | "revisao";
const BARRAS = 36;

export default function Explicacao({ sessao, limite, instrucao, rodada, tempoEsgotado, analisando, aoEnviar }: Props) {
  const [estado, setEstado] = useState<Estado>("pronto");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [urlAudio, setUrlAudio] = useState<string | null>(null);
  const [duracao, setDuracao] = useState(0);
  const [erroMic, setErroMic] = useState<string | null>(null);

  const gravador = useRef<MediaRecorder | null>(null);
  const inicio = useRef(0);
  const barras = useRef<(HTMLSpanElement | null)[]>([]);
  const limpar = useRef<() => void>(() => {});

  const restante = useContagem(limite, estado === "gravando", () => parar());

  useEffect(() => () => limpar.current(), []);
  useEffect(() => () => { if (urlAudio) URL.revokeObjectURL(urlAudio); }, [urlAudio]);

  async function gravar() {
    setErroMic(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErroMic("Não consegui acessar o microfone. Confira a permissão do navegador.");
      return;
    }

    // Medidor de volume: lê a frequência do áudio e anima as barras direto no DOM.
    const contexto = new AudioContext();
    const analisador = contexto.createAnalyser();
    analisador.fftSize = 128;
    contexto.createMediaStreamSource(stream).connect(analisador);
    const dados = new Uint8Array(analisador.frequencyBinCount);
    let quadro = 0;
    const animar = () => {
      analisador.getByteFrequencyData(dados);
      barras.current.forEach((barra, i) => {
        if (barra) barra.style.transform = `scaleY(${0.1 + (dados[i + 2] / 255) * 0.9})`;
      });
      quadro = requestAnimationFrame(animar);
    };
    animar();

    const partes: Blob[] = [];
    // 32 kbit/s bastam para voz e mantêm a gravação longe do limite de envio do Vercel (4,5 MB ≈ 18 min).
    const rec = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
    rec.ondataavailable = (e) => partes.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(partes, { type: rec.mimeType });
      setAudio(blob);
      setUrlAudio(URL.createObjectURL(blob));
      setDuracao((Date.now() - inicio.current) / 1000);
      setEstado("revisao");
    };

    limpar.current = () => {
      cancelAnimationFrame(quadro);
      stream.getTracks().forEach((t) => t.stop());
      contexto.close();
    };

    gravador.current = rec;
    inicio.current = Date.now();
    rec.start();
    sons.gravar();
    setEstado("gravando");
  }

  function parar() {
    if (gravador.current?.state === "recording") {
      gravador.current.stop();
      sons.pararGravacao();
    }
    limpar.current();
  }

  function regravar() {
    setAudio(null);
    setUrlAudio(null);
    setEstado("pronto");
  }

  return (
    <section className="sala">
      <div className="sala-centro">
        <div className="sala-tema">
          {tempoEsgotado && estado === "pronto" && (
            <span className="aviso-tempo">
              <Icone nome="timer_off" tamanho={18} /> O tempo de pesquisa acabou
            </span>
          )}
          <span className="sobretitulo">
            {sessao.area}
            {rodada && ` · ${rodada}`}
          </span>
          <h1 className="pergunta">{sessao.pergunta}</h1>
          {instrucao && <p className="lede">{instrucao}</p>}
        </div>

        {estado === "pronto" && (
          <div className="cartao cartao-destaque gravador">
            <button className="botao-gravar" onClick={gravar} aria-label="Começar a gravar">
              <Icone nome="mic" cheio tamanho={40} />
            </button>
            <div className="gravador-texto">
              <strong>Pronto para começar?</strong>
            </div>
            {erroMic && (
              <p className="erro-inline">
                <Icone nome="error" tamanho={18} /> {erroMic}
              </p>
            )}
          </div>
        )}

        {estado === "gravando" && (
          <div className="cartao cartao-destaque gravador">
            <Anel restante={restante} total={limite} legenda={limite === null ? "gravando" : "restantes"} tamanho={180} />
            <div className="medidor" aria-hidden>
              {Array.from({ length: BARRAS }, (_, i) => (
                <span key={i} ref={(el) => { barras.current[i] = el; }} />
              ))}
            </div>
            <button className="botao primario largo" onClick={parar}>
              <Icone nome="stop" cheio /> Parar e revisar
            </button>
          </div>
        )}

        {estado === "revisao" && urlAudio && (
          <div className="cartao cartao-destaque gravador">
            <span className="selo selo-ok">
              <Icone nome="check_circle" cheio tamanho={16} /> {mmss(duracao)} gravados
            </span>
            <div className="gravador-texto">
              <strong>Quer enviar esta gravação?</strong>
              <span>Ouça antes, se quiser. Dá para gravar de novo.</span>
            </div>
            <audio controls src={urlAudio} />
            <div className="acoes">
              <button className="botao" onClick={regravar} disabled={analisando}>
                <Icone nome="replay" tamanho={18} /> Gravar de novo
              </button>
              <button className="botao primario" onClick={() => audio && aoEnviar(audio)} disabled={analisando}>
                {analisando ? (
                  <>
                    <span className="girando claro" /> Analisando a fala…
                  </>
                ) : (
                  <>
                    Enviar para análise <Icone nome="arrow_forward" tamanho={18} />
                  </>
                )}
              </button>
            </div>
            {analisando && <p className="nota">Transcrevendo com o Whisper. A primeira vez demora um pouco mais.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

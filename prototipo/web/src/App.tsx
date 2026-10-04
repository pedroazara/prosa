import { useEffect, useState } from "react";
import { buscarConfig, sortear, analisar, type Config, type Resultado, type Sessao } from "./api";
import Inicio from "./componentes/Inicio";
import Preparando from "./componentes/Preparando";
import Pesquisa from "./componentes/Pesquisa";
import Explicacao from "./componentes/Explicacao";
import Relatorio from "./componentes/Relatorio";
import PainelDev from "./componentes/PainelDev";
import Icone from "./componentes/Icone";
import { emDemo, resultadoDemo, sessaoDemo, telaInicialDemo } from "./demo";

type Fase = "inicio" | "preparando" | "pesquisa" | "explicacao" | "analisando" | "relatorio";

const ETAPAS: { nome: string; fases: Fase[] }[] = [
  { nome: "Tema", fases: ["inicio", "preparando"] },
  { nome: "Pesquisa", fases: ["pesquisa"] },
  { nome: "Explicação", fases: ["explicacao", "analisando"] },
  { nome: "Feedback", fases: ["relatorio"] },
];

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [fase, setFase] = useState<Fase>(emDemo ? (telaInicialDemo as Fase) : "inicio");
  const [andamento, setAndamento] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [sessao, setSessao] = useState<Sessao | null>(emDemo && fase !== "inicio" ? sessaoDemo : null);
  const [tempoEsgotado, setTempoEsgotado] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(emDemo ? resultadoDemo : null);
  const [devAberto, setDevAberto] = useState(false);

  useEffect(() => {
    buscarConfig()
      .then(setConfig)
      .catch(() => setErro("Não consegui falar com o servidor. Ele está rodando (python prototipo/servidor.py)?"));
  }, []);

  async function comecar(area: string | null, origem: string) {
    setErro(null);
    setAndamento([]);
    setFase("preparando");
    try {
      const nova = await sortear(area, origem, (m) => setAndamento((a) => [...a, m]));
      setSessao(nova);
      setTempoEsgotado(false);
      setFase("pesquisa");
    } catch (e) {
      setErro((e as Error).message);
      setFase("inicio");
    }
  }

  async function enviar(gravacao: Blob) {
    setErro(null);
    setAudio(gravacao);
    setFase("analisando");
    try {
      setResultado(await analisar(sessao!.id, gravacao));
      setFase("relatorio");
    } catch (e) {
      setErro((e as Error).message);
      setFase("explicacao");
    }
  }

  function reiniciar() {
    setSessao(null);
    setResultado(null);
    setAudio(null);
    setErro(null);
    setFase("inicio");
  }

  const etapaAtual = ETAPAS.findIndex((e) => e.fases.includes(fase));
  const podeVoltar = fase === "inicio" || fase === "relatorio";

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-interno">
          <button className="marca" onClick={podeVoltar ? reiniciar : undefined} aria-label="prosa, voltar ao início">
            <img src="/logo.svg" alt="prosa" />
          </button>
          <nav className="etapas" aria-label="Etapas da sessão">
            {ETAPAS.map((e, i) => (
              <span
                key={e.nome}
                className={`etapa ${i < etapaAtual ? "feita" : i === etapaAtual ? "atual" : ""}`}
                aria-current={i === etapaAtual ? "step" : undefined}
              >
                {i < etapaAtual && <Icone nome="check" tamanho={16} />}
                {e.nome}
              </span>
            ))}
          </nav>
          <div className="topo-acoes">
            {emDemo && <span className="selo-demo">demo</span>}
            <span className="divisor" />
            <button className="botao-dev" onClick={() => setDevAberto(true)} title="Painel do desenvolvedor">
              <Icone nome="code" tamanho={20} />
            </button>
          </div>
        </div>
      </header>

      {erro && (
        <div className="alerta" role="alert">
          <Icone nome="error" tamanho={20} />
          <span>{erro}</span>
          <button onClick={() => setErro(null)} aria-label="Fechar">
            <Icone nome="close" tamanho={18} />
          </button>
        </div>
      )}

      <main className="palco" key={fase === "analisando" ? "explicacao" : fase}>
        {fase === "inicio" && <Inicio config={config} aoComecar={comecar} />}
        {fase === "preparando" && <Preparando andamento={andamento} />}
        {fase === "pesquisa" && sessao && config && (
          <Pesquisa
            sessao={sessao}
            duracao={config.tempo_pesquisa}
            aoTerminar={(esgotou) => {
              setTempoEsgotado(esgotou);
              setFase("explicacao");
            }}
          />
        )}
        {(fase === "explicacao" || fase === "analisando") && sessao && config && (
          <Explicacao
            sessao={sessao}
            limite={config.tempo_explicacao}
            tempoEsgotado={tempoEsgotado}
            analisando={fase === "analisando"}
            aoEnviar={enviar}
          />
        )}
        {fase === "relatorio" && sessao && resultado && config && (
          <Relatorio
            sessao={sessao}
            resultado={resultado}
            audio={audio}
            limite={config.tempo_explicacao}
            aoReiniciar={reiniciar}
          />
        )}
      </main>

      <footer className="rodape">
        <div className="rodape-interno">
          <img src="/icone.svg" alt="" className="rodape-icone" />
          <span>Plataforma de Raciocínio, Oratória, Síntese e Argumentação</span>
          <span className="rodape-espaco" />
          <span>Projeto de estudo</span>
        </div>
      </footer>

      <PainelDev aberto={devAberto} idSessao={sessao?.id ?? null} aoFechar={() => setDevAberto(false)} />
    </div>
  );
}

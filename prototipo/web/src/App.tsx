import { useEffect, useState } from "react";
import { ErroApi, buscarConfig, sortear, usarTemaSalvo, analisar, type Config, type Resultado, type Sessao, type Sorteio } from "./api";
import Inicio from "./componentes/Inicio";
import Preparando from "./componentes/Preparando";
import Pesquisa from "./componentes/Pesquisa";
import Explicacao from "./componentes/Explicacao";
import Relatorio from "./componentes/Relatorio";
import Resumo, { type Rodada } from "./componentes/Resumo";
import PainelDev from "./componentes/PainelDev";
import Icone from "./componentes/Icone";
import Logo from "./componentes/Logo";
import { definirMudo, estaMudo, sons } from "./sons";
import { gravarModo, gravarPersonalizado, lerModo, lerPersonalizado, listarModos, type Personalizado } from "./modos";
import { emDemo, resultadoDemo, sessaoDemo, telaInicialDemo } from "./demo";

type Fase = "inicio" | "preparando" | "pesquisa" | "explicacao" | "analisando" | "relatorio" | "resumo";

const ETAPAS: { nome: string; fases: Fase[] }[] = [
  { nome: "Tema", fases: ["inicio", "preparando"] },
  { nome: "Pesquisa", fases: ["pesquisa"] },
  { nome: "Explicação", fases: ["explicacao", "analisando"] },
  { nome: "Feedback", fases: ["relatorio", "resumo"] },
];

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [fase, setFase] = useState<Fase>(emDemo ? (telaInicialDemo as Fase) : "inicio");
  const [andamento, setAndamento] = useState<string[]>([]);
  const [sorteio, setSorteio] = useState<Sorteio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Problema com a IA (cota, conexão…): a mensagem oferece um tema salvo, que não gasta IA.
  const [erroDaIa, setErroDaIa] = useState(false);
  const [sessao, setSessao] = useState<Sessao | null>(emDemo && fase !== "inicio" ? sessaoDemo : null);
  const [tempoEsgotado, setTempoEsgotado] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(emDemo ? resultadoDemo : null);
  const [devAberto, setDevAberto] = useState(false);
  const [mudo, setMudo] = useState(estaMudo);

  // Modo de treino e, quando ele tem vários temas (maratona), as rodadas já feitas.
  const [modoId, setModoId] = useState(lerModo);
  const [personalizado, setPersonalizado] = useState<Personalizado>(lerPersonalizado);
  const modos = listarModos(config, personalizado);
  const modo = modos.find((m) => m.id === modoId) ?? modos[0];
  // O que vale para todas as rodadas do treino: área, origem e de onde vêm os temas.
  const [escolha, setEscolha] = useState<{ area: string | null; origem: string; fonte: "novo" | "salvo" }>({
    area: null,
    origem: "mundo",
    fonte: "novo",
  });
  const [rodada, setRodada] = useState(1);
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [usados, setUsados] = useState<string[]>([]);
  const [marcados, setMarcados] = useState(0);

  // Sons das mudanças de etapa e dos erros (os da roleta, do cronômetro e da gravação ficam nos componentes).
  useEffect(() => {
    if (fase === "pesquisa") sons.temaPronto();
    if (fase === "relatorio") sons.pronto();
  }, [fase]);
  useEffect(() => {
    if (erro) sons.erro();
    else setErroDaIa(false);
  }, [erro]);

  useEffect(() => {
    buscarConfig()
      .then(setConfig)
      .catch(() => setErro("Não consegui falar com o servidor. Ele está rodando (python prototipo/servidor.py)?"));
  }, []);

  async function comecar(area: string | null, origem: string) {
    setErro(null);
    setAndamento([]);
    setSorteio(null);
    setFase("preparando");
    try {
      const nova = await sortear(area, origem, (m) => setAndamento((a) => [...a, m]), setSorteio);
      setSessao(nova);
      if (nova.tema) setUsados((u) => [...u, nova.tema!]);
      setTempoEsgotado(false);
      setFase("pesquisa");
    } catch (e) {
      setErro((e as Error).message);
      setErroDaIa(e instanceof ErroApi && !!e.codigo && !["chave", "modelo"].includes(e.codigo));
      setFase("inicio");
    }
  }

  async function comecarSalvo(id: string | null, area: string | null, excluir: string[] = []) {
    setErro(null);
    try {
      const nova = await usarTemaSalvo(id, area, excluir);
      setSessao(nova);
      if (nova.tema) setUsados((u) => [...u, nova.tema!]);
      setTempoEsgotado(false);
      setFase("pesquisa");
    } catch (e) {
      setErroDaIa(false);
      setErro((e as Error).message);
    }
  }

  /**
   * Começa um treino do modo escolhido. "salvo" força temas da biblioteca (sem IA) mesmo num modo
   * que sorteia temas novos; "idTema" é um tema salvo escolhido na lista, para a primeira rodada.
   */
  function iniciar(area: string | null, origem: string, salvo = false, idTema: string | null = null) {
    const fonte = salvo ? "salvo" : modo.fonte;
    setEscolha({ area, origem, fonte });
    setRodada(1);
    setRodadas([]);
    setUsados([]);
    buscarTema(area, origem, fonte, [], idTema);
  }

  function buscarTema(area: string | null, origem: string, fonte: "novo" | "salvo", excluir: string[], idTema: string | null = null) {
    setResultado(null);
    setAudio(null);
    setMarcados(0);
    if (idTema) comecarSalvo(idTema, null);
    else if (fonte === "salvo") comecarSalvo(null, area, excluir);
    else comecar(area, origem);
  }

  /** O botão do fim do relatório: próximo tema da maratona, resumo, ou um treino novo. */
  function seguir() {
    const feita: Rodada = {
      pergunta: sessao!.pergunta,
      area: sessao!.area,
      fala: resultado!.fala,
      marcados,
      pontos: resultado!.pontos.length,
    };
    if (rodada < modo.temas) {
      setRodadas((r) => [...r, feita]);
      setRodada(rodada + 1);
      buscarTema(escolha.area, escolha.origem, escolha.fonte, usados);
    } else if (modo.temas > 1) {
      setRodadas((r) => [...r, feita]);
      setFase("resumo");
    } else reiniciar();
  }

  const rotuloRodada = modo.temas > 1 ? `Tema ${rodada} de ${modo.temas}` : undefined;
  const rotuloSeguir =
    rodada < modo.temas ? `Próximo tema (${rodada + 1} de ${modo.temas})` : modo.temas > 1 ? "Ver resumo" : "Novo tema";

  async function enviar(gravacao: Blob) {
    setErro(null);
    setAudio(gravacao);
    setFase("analisando");
    try {
      setResultado(await analisar(sessao!.id, gravacao, modo.id));
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
  // Clicar no logo abandona o treino (inclusive uma maratona pela metade).
  const podeVoltar = fase === "inicio" || fase === "relatorio" || fase === "resumo";

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-interno">
          <button className="marca" onClick={podeVoltar ? reiniciar : undefined} aria-label="prosa, voltar ao início">
            <Logo />
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
            <button
              className="botao-dev"
              onClick={() => {
                definirMudo(!mudo);
                setMudo(!mudo);
              }}
              title={mudo ? "Ligar os sons" : "Desligar os sons"}
              aria-pressed={mudo}
            >
              <Icone nome={mudo ? "volume_off" : "volume_up"} tamanho={20} />
            </button>
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
          {erroDaIa && fase === "inicio" && (
            <button
              className="alerta-acao"
              onClick={() => {
                setErro(null);
                setErroDaIa(false);
                setEscolha((e) => ({ ...e, fonte: "salvo" })); // as próximas rodadas também, sem IA
                comecarSalvo(null, escolha.area, usados);
              }}
            >
              <Icone nome="bookmarks" tamanho={18} /> Usar um tema salvo
            </button>
          )}
          <button onClick={() => setErro(null)} aria-label="Fechar">
            <Icone nome="close" tamanho={18} />
          </button>
        </div>
      )}

      <main className="palco" key={fase === "analisando" ? "explicacao" : fase}>
        {fase === "inicio" && (
          <Inicio
            config={config}
            modos={modos}
            modo={modo}
            aoEscolherModo={(id) => {
              setModoId(id);
              gravarModo(id);
            }}
            personalizado={personalizado}
            aoMudarPersonalizado={(p) => {
              setPersonalizado(p);
              gravarPersonalizado(p);
            }}
            aoComecar={(area, origem) => iniciar(area, origem)}
            aoUsarSalvo={(id, area) => iniciar(area, escolha.origem, true, id)}
          />
        )}
        {fase === "preparando" && <Preparando andamento={andamento} sorteio={sorteio} />}
        {fase === "pesquisa" && sessao && config && (
          <Pesquisa
            sessao={sessao}
            duracao={modo.pesquisa}
            rodada={rotuloRodada}
            aoTerminar={(esgotou) => {
              setTempoEsgotado(esgotou);
              setFase("explicacao");
            }}
          />
        )}
        {(fase === "explicacao" || fase === "analisando") && sessao && config && (
          <Explicacao
            sessao={sessao}
            limite={modo.explicacao}
            instrucao={modo.instrucao}
            rodada={rotuloRodada}
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
            limite={modo.explicacao}
            maxPalavras={modo.maxPalavras}
            seguir={{ rotulo: rotuloSeguir, acao: seguir }}
            aoMarcar={setMarcados}
          />
        )}
        {fase === "resumo" && <Resumo rodadas={rodadas} aoReiniciar={reiniciar} />}
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

import { useEffect, useState } from "react";
import { buscarTemas, type Config, type TemaSalvo } from "../api";
import { duracaoPorExtenso, type Modo, type Personalizado } from "../modos";
import Icone from "./Icone";
import { Balao } from "./Logo";

const NOMES_ORIGEM: Record<string, string> = { mundo: "Mundo", brasil: "Brasil" };

type Props = {
  config: Config | null;
  modos: Modo[];
  modo: Modo;
  aoEscolherModo: (id: string) => void;
  personalizado: Personalizado;
  aoMudarPersonalizado: (p: Personalizado) => void;
  aoComecar: (area: string | null, origem: string) => void;
  aoUsarSalvo: (id: string | null, area: string | null) => void;
};

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/** Campo de tempo do modo personalizado: minutos (aceita 0,5) ou "sem limite". */
function CampoTempo({ rotulo, valor, aoMudar }: { rotulo: string; valor: number | null; aoMudar: (v: number | null) => void }) {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor / 60).replace(".", ","));
  return (
    <div className="campo">
      <span className="rotulo">{rotulo}</span>
      <div className="campo-linha">
        <input
          type="text"
          inputMode="decimal"
          className="campo-numero"
          value={valor === null ? "" : texto}
          disabled={valor === null}
          aria-label={`${rotulo}, em minutos`}
          onChange={(e) => {
            setTexto(e.target.value);
            const minutos = Number(e.target.value.replace(",", "."));
            if (minutos > 0 && minutos <= 180) aoMudar(Math.round(minutos * 60)); // zero ou vazio não vale
          }}
        />
        <span className="nota">min</span>
        <label className="campo-check">
          <input
            type="checkbox"
            checked={valor === null}
            onChange={(e) => {
              if (e.target.checked) return aoMudar(null);
              // Volta ao último número válido do campo, ou a 5 minutos.
              const minutos = Number(texto.replace(",", "."));
              const segundos = minutos > 0 && minutos <= 180 ? Math.round(minutos * 60) : 300;
              setTexto(String(segundos / 60).replace(".", ","));
              aoMudar(segundos);
            }}
          />
          Sem limite
        </label>
      </div>
    </div>
  );
}

export default function Inicio(props: Props) {
  const { config, modos, modo, aoEscolherModo, personalizado, aoMudarPersonalizado, aoComecar, aoUsarSalvo } = props;
  const [area, setArea] = useState<string | null>(null);
  const [origem, setOrigem] = useState("mundo");
  const [painel, setPainel] = useState<"modos" | "ajustes" | "salvos" | null>(null);
  const [salvos, setSalvos] = useState<TemaSalvo[]>([]);
  const ajustesAbertos = painel === "ajustes";
  const alternar = (qual: "modos" | "ajustes" | "salvos") => setPainel((p) => (p === qual ? null : qual));
  const mudar = (parte: Partial<Personalizado>) => aoMudarPersonalizado({ ...personalizado, ...parte });

  useEffect(() => {
    buscarTemas().then(setSalvos).catch(() => setSalvos([]));
  }, []);
  const pesquisa = duracaoPorExtenso(modo.pesquisa);
  const explicacao = duracaoPorExtenso(modo.explicacao);

  return (
    <section className="inicio">
      <div className="brilho" aria-hidden />

      <div className="inicio-titulo">
        <div className="inicio-balao">
          <Balao modo="sempre" tamanho={88} />
        </div>
        <h1>
          Aprenda rápido.
          <br />
          {explicacao ? `Explique em ${explicacao}.` : "Explique do seu jeito."}
        </h1>
      </div>

      <div className="inicio-acao">
        <button className="botao primario botao-grande" disabled={!config} onClick={() => aoComecar(area, origem)}>
          <Icone nome={modo.temas > 1 ? "sprint" : "casino"} />
          {modo.temas > 1 ? `Começar: ${modo.temas} temas` : "Sortear tema"}
        </button>

        <div className="inicio-opcoes">
          <button
            className={`ajustes-botao ${painel === "modos" ? "aberto" : ""}`}
            aria-expanded={painel === "modos"}
            aria-controls="modos"
            onClick={() => alternar("modos")}
          >
            <Icone nome={modo.icone} tamanho={18} />
            {modo.nome}
            <Icone nome="expand_more" tamanho={18} />
          </button>
          <button
            className={`ajustes-botao ${ajustesAbertos ? "aberto" : ""}`}
            aria-expanded={ajustesAbertos}
            aria-controls="ajustes"
            onClick={() => alternar("ajustes")}
          >
            <Icone nome="tune" tamanho={18} />
            {NOMES_ORIGEM[origem] ?? origem} · {area ?? "qualquer área"}
            <Icone nome="expand_more" tamanho={18} />
          </button>
          {salvos.length > 0 && (
            <button
              className={`ajustes-botao ${painel === "salvos" ? "aberto" : ""}`}
              aria-expanded={painel === "salvos"}
              aria-controls="salvos"
              onClick={() => alternar("salvos")}
            >
              <Icone nome="bookmarks" tamanho={18} />
              Temas salvos ({salvos.length})
              <Icone nome="expand_more" tamanho={18} />
            </button>
          )}
        </div>

        {painel === "modos" && (
          <div id="modos" className="cartao ajustes">
            <div className="modos" role="radiogroup" aria-label="Modo de treino">
              {modos.map((m) => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={m.id === modo.id}
                  className={`modo ${m.id === modo.id ? "ativo" : ""}`}
                  onClick={() => aoEscolherModo(m.id)}
                >
                  <Icone nome={m.icone} tamanho={22} />
                  <strong>{m.nome}</strong>
                  <span>{m.descricao}</span>
                </button>
              ))}
            </div>

            {modo.id === "personalizado" && (
              <div className="personalizado">
                <CampoTempo rotulo="Pesquisa" valor={personalizado.pesquisa} aoMudar={(v) => mudar({ pesquisa: v })} />
                <CampoTempo rotulo="Explicação" valor={personalizado.explicacao} aoMudar={(v) => mudar({ explicacao: v })} />
                <div className="campo">
                  <span className="rotulo">Temas seguidos</span>
                  <div className="campo-linha">
                    <input
                      type="number"
                      className="campo-numero"
                      min={1}
                      max={10}
                      value={personalizado.temas}
                      onChange={(e) => {
                        const n = Math.round(Number(e.target.value));
                        if (n >= 1 && n <= 10) mudar({ temas: n });
                      }}
                    />
                    <span className="nota">{personalizado.temas > 1 ? "com resumo no fim" : "um só"}</span>
                  </div>
                </div>
                <div className="campo">
                  <span className="rotulo">Limite de palavras</span>
                  <div className="campo-linha">
                    <input
                      type="number"
                      className="campo-numero"
                      min={10}
                      placeholder="—"
                      value={personalizado.maxPalavras ?? ""}
                      onChange={(e) => {
                        const n = Math.round(Number(e.target.value));
                        mudar({ maxPalavras: n >= 10 ? n : undefined });
                      }}
                    />
                    <span className="nota">vazio = sem limite</span>
                  </div>
                </div>
                <div className="campo">
                  <span className="rotulo">De onde vêm os temas</span>
                  <div className="segmentado" role="radiogroup" aria-label="De onde vêm os temas">
                    {(["novo", "salvo"] as const).map((f) => (
                      <button key={f} role="radio" aria-checked={personalizado.fonte === f} className={personalizado.fonte === f ? "ativo" : ""} onClick={() => mudar({ fonte: f })}>
                        {f === "novo" ? "Sorteio novo (IA)" : "Temas salvos (sem IA)"}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="campo-check">
                  <input type="checkbox" checked={personalizado.feynman} onChange={(e) => mudar({ feynman: e.target.checked })} />
                  Estilo Feynman: explicar para uma criança, sem jargão
                </label>
              </div>
            )}
          </div>
        )}

        {painel === "salvos" && (
          <div id="salvos" className="cartao ajustes salvos">
            <div className="ajustes-linha">
              <div>
                <span className="rotulo">Temas já gerados</span>
                <p className="nota">Reusar um tema não gasta chamadas de IA.</p>
              </div>
              <button className="botao" onClick={() => aoUsarSalvo(null, area)}>
                <Icone nome="casino" tamanho={18} />
                Sortear um salvo
              </button>
            </div>
            <ul className="salvos-lista">
              {salvos.map((t) => (
                <li key={t.id}>
                  <button className="salvo" onClick={() => aoUsarSalvo(t.id, null)}>
                    <span className="salvo-pergunta">{t.pergunta}</span>
                    <span className="salvo-meta">
                      {t.area}
                      {t.subarea && ` · ${t.subarea}`} · {NOMES_ORIGEM[t.origem] ?? t.origem} · {dataCurta(t.data)}
                    </span>
                    <Icone nome="arrow_forward" tamanho={18} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ajustesAbertos && (
          <div id="ajustes" className="cartao ajustes">
            <div className="ajustes-linha">
              <span className="rotulo">Origem dos temas</span>
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
            <div className="ajustes-areas">
              <span className="rotulo">Área do tema</span>
              <div className="chips">
                <button className={`chip ${area === null ? "ativo" : ""}`} onClick={() => setArea(null)}>
                  <Icone nome="casino" tamanho={16} />
                  Qualquer uma
                </button>
                {config?.areas.map((a) => (
                  <button key={a} className={`chip ${area === a ? "ativo" : ""}`} onClick={() => setArea(a)}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="passos">
        <div className="passos-linha" aria-hidden />
        <div className="cartao passo">
          <span className="passo-icone">
            <Icone nome="timer" />
          </span>
          <h3>1. Pesquise</h3>
          <p>{pesquisa ? `${pesquisa} na internet` : "Na internet, sem limite de tempo"}, anotando no papel as ideias centrais.</p>
        </div>
        <div className="cartao passo">
          <span className="passo-icone destaque">
            <Icone nome="mic" />
          </span>
          <h3>2. Explique</h3>
          <p>{explicacao ? `${explicacao} em voz alta` : "Em voz alta, sem limite de tempo"}, sem consultar nada, com suas próprias palavras.</p>
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

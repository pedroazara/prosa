import { useEffect, useState } from "react";
import { buscarDev, type Dev } from "../api";

type Props = { aberto: boolean; idSessao: string | null; aoFechar: () => void };

export default function PainelDev({ aberto, idSessao, aoFechar }: Props) {
  const [dados, setDados] = useState<Dev | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || !idSessao) return;
    setErro(null);
    buscarDev(idSessao).then(setDados).catch((e) => setErro(e.message));
  }, [aberto, idSessao]);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, aoFechar]);

  const d = idSessao ? dados?.desafio : undefined;

  return (
    <>
      <div className={`veu ${aberto ? "visivel" : ""}`} onClick={aoFechar} />
      <aside className={`painel-dev ${aberto ? "aberto" : ""}`} aria-hidden={!aberto}>
        <header>
          <h2>Painel do desenvolvedor</h2>
          <button onClick={aoFechar} aria-label="Fechar">×</button>
        </header>
        <p className="aviso-spoiler">Mostra a rubrica oculta. Abrir antes de explicar estraga o desafio.</p>

        {!idSessao && <p className="nota">Nenhuma sessão em andamento.</p>}
        {erro && <p className="erro-inline">{erro}</p>}

        {d && (
          <div className="dev-conteudo">
            <dl className="dev-campos">
              <dt>Veredito</dt>
              <dd><span className={`selo selo-${d.veredito}`}>{d.veredito}</span></dd>
              <dt>Pergunta original</dt>
              <dd>{d.pergunta_original}</dd>
              {d.pergunta_final !== d.pergunta_original && (
                <>
                  <dt>Pergunta final</dt>
                  <dd>{d.pergunta_final}</dd>
                </>
              )}
              <dt>Justificativa</dt>
              <dd>{d.justificativa}</dd>
              <dt>Artigo</dt>
              <dd><a href={d.link} target="_blank" rel="noreferrer">{d.artigo} ↗</a></dd>
              <dt>Modelo</dt>
              <dd><code>{d.modelo}</code></dd>
            </dl>

            <h3>Rubrica</h3>
            <ol className="dev-pontos">
              {d.pontos_principais.map((p, i) => (
                <li key={i}>
                  <p>{p.ideia}</p>
                  <blockquote>
                    “{p.trecho_do_artigo}”
                    <span className={`selo ${p.trecho_verificado ? "selo-ok" : "selo-falha"}`}>
                      {p.trecho_verificado ? "trecho verificado" : "trecho não encontrado"}
                    </span>
                  </blockquote>
                </li>
              ))}
            </ol>

            {d.log.length > 0 && (
              <>
                <h3>Candidatos testados</h3>
                <ul className="dev-log">
                  {d.log.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </>
            )}

            <details>
              <summary>JSON completo</summary>
              <pre>{JSON.stringify(dados, null, 2)}</pre>
            </details>
          </div>
        )}
      </aside>
    </>
  );
}

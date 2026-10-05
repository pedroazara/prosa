import { useEffect, useMemo, useRef, useState } from "react";
import { sons } from "../sons";

const PASSOS = 28; // quantos nomes passam pela janela antes de parar
const ALTURA = 32; // px de cada nome; igual a --roleta-item no CSS
const DURACAO = 3200; // ms
const SEM_ANIMACAO = matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Nomes ao acaso (sem repetir o vizinho), com o sorteado no penúltimo lugar. O último só aparece embaixo, apagado. */
function fita(opcoes: string[], escolhida: string): string[] {
  const nomes: string[] = [];
  const sortear = (evitar: string[]) => {
    const livres = opcoes.filter((o) => !evitar.includes(o));
    return livres[Math.floor(Math.random() * livres.length)] ?? escolhida;
  };
  for (let i = 0; i < PASSOS; i++) nomes.push(sortear([nomes[i - 1], ...(i === PASSOS - 1 ? [escolhida] : [])]));
  return [...nomes, escolhida, sortear([escolhida])];
}

/**
 * Rolo de caça-níquel: uma fita de nomes que rola num movimento só, freando até parar no sorteado.
 * Mostra "?" até "ativa" virar true. Chama "aoTerminar" quando o rolo para.
 */
export default function Roleta({
  rotulo,
  opcoes,
  escolhida,
  ativa,
  aoTerminar,
}: {
  rotulo: string;
  opcoes: string[];
  escolhida: string;
  ativa: boolean;
  aoTerminar?: () => void;
}) {
  const nomes = useMemo(() => fita(opcoes, escolhida), [opcoes, escolhida]);
  const final = nomes.length - 2; // posição do sorteado
  const [fase, setFase] = useState<"parada" | "girando" | "revelada">("parada");
  const fitaRef = useRef<HTMLDivElement>(null);

  // Tique a cada nome que cruza a linha do meio: lê a posição real da fita a cada quadro,
  // então o som desacelera junto com o rolo.
  useEffect(() => {
    if (fase !== "girando") return;
    let ultimo = -1;
    let quadro = requestAnimationFrame(function medir() {
      const fita = fitaRef.current;
      if (fita) {
        const y = new DOMMatrixReadOnly(getComputedStyle(fita).transform).m42;
        const nome = Math.round(-y / ALTURA);
        if (nome !== ultimo) {
          if (ultimo !== -1) sons.tique();
          ultimo = nome;
        }
      }
      quadro = requestAnimationFrame(medir);
    });
    return () => cancelAnimationFrame(quadro);
  }, [fase]);

  useEffect(() => {
    if (!ativa) return;
    if (SEM_ANIMACAO || opcoes.length < 2) {
      setFase("revelada");
      if (opcoes.length >= 2) sons.revelar();
      aoTerminar?.();
      return;
    }
    // Espera o navegador desenhar a fita na posição inicial, para a transição ter de onde partir.
    let quadro = requestAnimationFrame(() => (quadro = requestAnimationFrame(() => setFase("girando"))));
    return () => cancelAnimationFrame(quadro);
  }, [ativa, escolhida]);

  function parou() {
    setFase("revelada");
    sons.revelar();
    aoTerminar?.();
  }

  // A linha do meio da janela é a que vale; a fita sobe até o sorteado ficar nela.
  const posicao = fase === "parada" ? 1 : final;
  const semRolar = SEM_ANIMACAO || opcoes.length < 2;

  return (
    <div className={`roleta roleta-${fase}`}>
      <span className="rotulo">{rotulo}</span>
      <div className="roleta-janela" aria-live={fase === "revelada" ? "polite" : "off"}>
        {!ativa ? (
          <span className="roleta-nome roleta-incognita">?</span>
        ) : semRolar ? (
          <span className="roleta-nome atual">{escolhida}</span>
        ) : (
          <div
            ref={fitaRef}
            className="roleta-fita"
            style={{
              transform: `translateY(${-(posicao - 1) * ALTURA}px)`,
              transition: fase === "parada" ? "none" : `transform ${DURACAO}ms cubic-bezier(0.12, 0.7, 0.18, 1.02)`,
            }}
            onTransitionEnd={parou}
          >
            {nomes.map((n, i) => (
              <span key={i} className={`roleta-nome${fase === "revelada" && i === final ? " atual" : ""}`}>
                {n}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

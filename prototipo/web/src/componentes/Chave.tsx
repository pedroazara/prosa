import { useState } from "react";
import { gravarChave, lerChave, testarChave } from "../api";
import Icone from "./Icone";

type Props = {
  aviso?: string | null; // por que a chave está sendo pedida de novo (recusada, por exemplo)
  aoSalvar: () => void;
  aoCancelar?: () => void; // só quando já existe uma chave guardada
};

/** No site publicado, cada pessoa usa a própria chave da Groq, guardada só no navegador dela. */
export default function Chave({ aviso, aoSalvar, aoCancelar }: Props) {
  const [chave, setChave] = useState("");
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const guardada = lerChave();

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const limpa = chave.trim();
    if (!limpa) return;
    setTestando(true);
    setErro(null);
    try {
      await testarChave(limpa);
      gravarChave(limpa);
      aoSalvar();
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setTestando(false);
    }
  }

  return (
    <section className="chave">
      <form className="cartao cartao-destaque chave-cartao" onSubmit={salvar}>
        <div className="cartao-titulo">
          <Icone nome="key" />
          <h2>Sua chave da Groq</h2>
        </div>
        <p>
          O PROSA usa a IA da Groq para sortear os temas e transcrever a sua fala. A conta é grátis e não pede cartão.
        </p>
        <ol className="chave-passos">
          <li>
            Crie uma conta em{" "}
            <a href="https://console.groq.com" target="_blank" rel="noreferrer">
              console.groq.com
            </a>
            .
          </li>
          <li>
            Em{" "}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
              API Keys
            </a>
            , clique em <strong>Create API Key</strong> e copie a chave (ela começa com <code>gsk_</code>).
          </li>
          <li>Cole a chave aqui embaixo.</li>
        </ol>

        {aviso && <p className="erro-inline">{aviso}</p>}

        <label className="campo">
          <span className="rotulo">Chave</span>
          <input
            className="chave-entrada"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="gsk_…"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            autoFocus
          />
        </label>
        {erro && <p className="erro-inline">{erro}</p>}

        <div className="chave-acoes">
          <button className="botao primario" type="submit" disabled={!chave.trim() || testando}>
            {testando ? "Conferindo…" : "Salvar chave"}
          </button>
          {aoCancelar && guardada && (
            <button className="botao" type="button" onClick={aoCancelar}>
              Cancelar
            </button>
          )}
          {guardada && (
            <button
              className="botao chave-apagar"
              type="button"
              onClick={() => {
                gravarChave(null);
                setChave("");
                aoCancelar?.();
              }}
            >
              <Icone nome="delete" tamanho={18} /> Apagar a chave guardada
            </button>
          )}
        </div>

        <p className="nota">
          A chave fica guardada só neste navegador. A cada pedido ela passa pelo servidor do PROSA até a Groq, mas não
          é gravada lá. O uso conta na cota grátis da sua conta.
        </p>
      </form>
    </section>
  );
}

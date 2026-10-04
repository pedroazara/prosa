/** Ícone do Material Symbols. "cheio" preenche o desenho (ex.: check, play_arrow). */
export default function Icone({ nome, cheio, tamanho }: { nome: string; cheio?: boolean; tamanho?: number }) {
  return (
    <span
      className="material-symbols-outlined icone"
      aria-hidden
      style={{
        fontSize: tamanho,
        fontVariationSettings: cheio ? "'FILL' 1" : undefined,
      }}
    >
      {nome}
    </span>
  );
}

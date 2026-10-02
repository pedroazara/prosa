# Experimento 01: aprendendo a usar o Whisper

Este experimento tem dois objetivos:

1. aprender a usar o Whisper na prática;
2. responder à pergunta do **Teste 1 da Fase 0**: *o Whisper preserva os vícios de linguagem?*

São três scripts, cada um um passo mais fundo. Faça na ordem.

---

## 1. O que é o Whisper (leitura de 5 minutos)

O Whisper é um modelo de reconhecimento de fala de código aberto, lançado pela OpenAI em 2022. Foi treinado com cerca de 680 mil horas de áudio da internet, em quase 100 idiomas.

**Como funciona:**

```
áudio → janelas de 30 s → espectrograma log-mel → encoder → decoder → texto
```

- O **espectrograma** é uma "imagem" do som: as frequências ao longo do tempo.
- O **encoder** lê essa imagem e a transforma numa representação interna.
- O **decoder** escreve o texto, um token por vez.

**O decoder é um modelo de linguagem.** Ele gera o próximo token olhando para o áudio e para o texto que já escreveu, como um LLM. Por isso os conceitos de LLM aparecem aqui: tokens, temperatura, beam search, prompt. Aprender Whisper já é aprender LLM.

**Por que ele apaga os "ééé":** o Whisper foi treinado com legendas e transcrições da internet, que normalmente vêm "limpas". Ele aprendeu que um bom texto não tem hesitações.

O parâmetro `initial_prompt` aproveita isso. Ele é um texto que o modelo enxerga como o que foi dito antes. Se esse texto está cheio de hesitações, o modelo tende a continuar no mesmo estilo. É exatamente isso que o passo 3 testa.

**faster-whisper** é uma reimplementação do Whisper feita com a biblioteca CTranslate2. A qualidade é a mesma, mas ele é bem mais rápido e usa menos memória. É a versão que usamos aqui.

### Tamanhos de modelo

| Modelo | Parâmetros | Download (aprox.) | Observação |
|---|---|---|---|
| `tiny` | 39 M | 75 MB | Muito rápido, mas erra bastante em português |
| `base` | 74 M | 145 MB | |
| `small` | 244 M | 480 MB | **Padrão dos scripts.** Bom equilíbrio na CPU |
| `medium` | 769 M | 1,5 GB | |
| `large-v3` | 1,55 B | 3 GB | O mais preciso, e lento na CPU |
| `large-v3-turbo` | 809 M | 1,6 GB | Quase a qualidade do large, bem mais rápido |

### Quantização (`compute_type`)

O parâmetro `compute_type` define quantos bits cada peso do modelo usa.

- `float32`: precisão total.
- `float16`: metade da memória. Usado na GPU.
- `int8`: um quarto da memória. Usado na CPU.

Menos bits deixam o modelo mais leve e mais rápido, com uma perda pequena de qualidade. É o mesmo conceito das versões Q4 e Q8 dos LLMs no Ollama.

---

## 2. O ambiente

O ambiente virtual fica na pasta `.venv`, na raiz do projeto. Ela está no `.gitignore`, então não vai para o GitHub. Os comandos abaixo são para o **Git Bash** e rodam a partir da raiz do projeto.

**Criar o ambiente** (só uma vez por computador):

```bash
py -m venv .venv
```

**Ativar o ambiente** (toda vez que abrir um terminal novo):

```bash
source .venv/Scripts/activate
```

O prompt passa a mostrar `(.venv)`. No Windows a pasta se chama `Scripts`; no macOS e no Linux, é `bin`.

**Instalar as bibliotecas** (só uma vez, ou quando o `requirements.txt` mudar):

```bash
pip install -r requirements.txt
```

O `requirements.txt` fixa `av<18`. A versão 18 do PyAV, que o faster-whisper usa para ler os áudios, removeu um parâmetro de que o faster-whisper 1.2.1 depende.

**Sair do ambiente:**

```bash
deactivate
```

Os modelos são baixados na primeira execução e ficam em `%USERPROFILE%\.cache\huggingface`, fora do projeto.

Nessa primeira execução, duas coisas são normais:

- **O terminal fica parado, sem mostrar progresso, enquanto o modelo baixa.** Isso pode levar alguns minutos nos modelos grandes: o `medium` tem 1,5 GB. Não interrompa.
- **Pode aparecer um aviso do `huggingface_hub`** dizendo que o Windows não suporta *symlinks* no cache. É inofensivo: o cache funciona normalmente, só ocupa um pouco mais de espaço. Para esconder o aviso de vez:

```bash
echo 'export HF_HUB_DISABLE_SYMLINKS_WARNING=1' >> ~/.bashrc
```

---

## 3. Gravar os áudios

Use o **Gravador de Som** do Windows, que salva em `.m4a`. Qualquer formato comum funciona: `.mp3`, `.wav`, `.ogg`, até vídeo `.mp4`. O faster-whisper converte tudo internamente.

Salve as gravações na pasta `audios/`, que fica fora do git.

Cada um grava **três áudios de 1 a 2 minutos**:

| Arquivo | O que gravar | Para quê |
|---|---|---|
| `leitura.m4a` | Ler um parágrafo em voz alta | Controle: deve ter poucas hesitações |
| `conhecido.m4a` | Explicar, sem roteiro, algo que você conhece bem | Fala natural |
| `estudado.m4a` | Explicar algo que você estudou por apenas 5 minutos | O cenário real do PROSA, onde aparecem mais hesitações |

**Antes de rodar qualquer script**, ouça cada gravação e conte os vícios à mão: quantos "é...", "ãã", "hum", "tipo", "né". Essa contagem é o gabarito, aquilo com que o Whisper vai ser comparado.

---

## 4. Passo 1: primeira transcrição

Todos os comandos daqui em diante são rodados de dentro desta pasta, com o ambiente ativado:

```bash
cd experimentos/01-whisper
python passo1_transcrever.py audios/conhecido.m4a
```

A primeira execução demora porque baixa o modelo.

**O que observar:**
- Cada segmento sai com o tempo de início e fim. O Whisper agrupa a fala em frases.
- Compare o tempo de transcrição com a duração do áudio.
- Termos técnicos e nomes próprios são onde ele mais erra. No nosso teste com voz sintética, "efeito Hall" virou "efeito rho".

**Exercícios:**
1. Rode com `--modelo tiny`, depois `small`, depois `medium`. Compare o tempo e os erros. Para o PROSA, qual vale a pena?
2. No código, troque `language="pt"` por `language=None` e imprima `info.language` e `info.language_probability`. O modelo acerta o idioma? Com quanta certeza?

---

## 5. Passo 2: palavras, velocidade e pausas

```bash
python passo2_palavras_e_pausas.py audios/conhecido.m4a
```

**O que observar:**
- Cada palavra sai com um `probability`. As marcadas com `*` são aquelas em que o modelo teve pouca confiança. Elas coincidem com os erros?
- No resumo, aparecem palavras por minuto, pausas e as maiores pausas.

**Exercícios:**
1. Rode com `--pausa-minima 0.3` e depois com `0.8`. Como muda o número de pausas? Qual limite faz mais sentido?
2. Ouça o áudio e confira as "maiores pausas" que o script encontrou. Batem com o que você ouve? Os tempos de palavra do Whisper são **aproximados**: ele tende a "esticar" as palavras por cima dos silêncios, então as pausas podem sair menores do que são.
3. Compare as palavras por minuto da `leitura` com as do `estudado`.

---

## 6. Passo 3: o teste dos vícios

```bash
python passo3_teste_vicios.py audios/estudado.m4a
```

O script transcreve o mesmo áudio duas vezes:
- **A:** do jeito padrão;
- **B:** com um `initial_prompt` cheio de hesitações.

Depois conta os vícios de cada versão e salva tudo em `resultados/`.

**Os vícios ficam em três grupos:**
- **Hesitações** ("éé", "ãã", "hum"): sons sem significado. São o que o Whisper costuma apagar.
- **Palavras-muleta** ("tipo", "né", "então", "aí"): palavras de verdade usadas como enchimento. A contagem é por cima, porque "então" também pode ser conclusão.
- **"é" sozinho:** o caso mais ambíguo. Em "é... o efeito" é hesitação; em "a tensão é proporcional" é verbo. O script conta à parte e você julga lendo o texto.

**Uma armadilha que achamos no teste:** sem o prompt, o Whisper transcreveu "hum" como "um". Só que "um" também é artigo ("um material"). Depois de transcrita, a hesitação fica indistinguível do artigo. Por isso o script não conta "um" como hesitação.

**O que o teste com voz sintética mostrou** (o áudio tinha 3 hesitações: "é...", "hum...", "é..."):
- A versão **A** transcreveu as três, mas como "é" e "um". O script não consegue separar essas formas do verbo e do artigo, então contou **0**.
- A versão **B** escreveu "éé" e "hum", que o script reconhece, e contou **3**.

Ou seja: com uma voz sintética, que pronuncia tudo com clareza, o prompt mudou **a grafia** das hesitações, não **se** elas foram ouvidas.

Na fala real, as hesitações são murmuradas, e o risco é diferente: o Whisper pode simplesmente **apagá-las**. Só as gravações de vocês respondem se o prompt ajuda nesse caso.

### Tabela para preencher

| Áudio | Pessoa | Modelo | Hesitações (manual) | A (padrão) | B (com prompt) |
|---|---|---|---|---|---|
| leitura | | small | | | |
| conhecido | | small | | | |
| estudado | | small | | | |
| estudado | | large-v3-turbo | | | |

### Como decidir

Um prompt cheio de hesitações pode ter dois efeitos:
- ajudar o Whisper a transcrever as hesitações que existem;
- fazer o Whisper **inventar** hesitações que ninguém falou.

Por isso a gravação `leitura` serve de controle: ela tem poucas hesitações. Se a versão B encontra nela muito mais hesitações do que a sua contagem manual, o prompt está inventando.

- **B recupera a maioria das hesitações e não infla a `leitura`:** a métrica de vícios é viável usando o prompt.
- **B recupera pouco:** testem um modelo maior.
- **B infla a `leitura`:** experimentem um prompt mais leve, com menos hesitações.
- **Nada disso resolve:** a métrica de vícios vira "aproximada" no relatório, e o foco passa para as pausas, que dependem menos da transcrição.

### Para pensar

O PROSA sabe qual é o tema antes de transcrever. Então dá para colocar no `initial_prompt` os termos técnicos da rubrica ("efeito Hall", "força de Lorentz") e o Whisper vai errar menos esses termos.

O risco: o modelo pode "ouvir" termos que o usuário **não** disse, e a avaliação marcaria um conceito como presente sem que ele tenha sido falado. Como vocês testariam isso?

---

## 7. Para ir além (opcional)

- **`vad_filter=True`:** remove os silêncios antes de transcrever, usando um detector de voz (Silero VAD). O que acontece com as hesitações e com as pausas?
- **Temperatura:** por padrão, o Whisper tenta primeiro com temperatura 0. Se o resultado parecer ruim (repetitivo ou com probabilidade baixa), ele tenta de novo com temperaturas maiores. É o mesmo mecanismo de amostragem dos LLMs. Rode o mesmo áudio duas vezes: a saída sai idêntica?
- **`hotwords`:** mais uma forma de passar termos para o modelo. Compare com o `initial_prompt`.
- **GPU:** com a placa NVIDIA, o `large-v3` fica rápido (`device="cuda"`, `compute_type="float16"`). Mas no Windows isso exige instalar as bibliotecas cuBLAS e cuDNN. Veja a seção de GPU no [README do faster-whisper](https://github.com/SYSTRAN/faster-whisper#gpu).

---

## Conclusões

_Escrevam aqui o que descobriram: os números da tabela, qual modelo escolher e se a métrica de vícios é viável._

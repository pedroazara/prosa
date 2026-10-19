-- Tabelas do PROSA no Supabase (site publicado). Rode uma vez no SQL Editor do projeto.
-- RLS ligado e nenhuma política: só o servidor, com a chave secreta, lê e grava. O navegador não tem acesso.

-- Biblioteca de temas: um por artigo. As colunas soltas servem para listar sem baixar a rubrica.
create table if not exists prosa_temas (
  id       text primary key,          -- "efeito-stroop" (biblioteca.id_do_tema)
  estilo   text not null,             -- "tema" ou "pergunta" (desafio.ESTILO)
  area     text not null,
  subarea  text,
  origem   text not null,
  pergunta text not null,
  artigo   text not null,
  data     text not null,             -- ISO, como no JSON
  desafio  jsonb not null             -- o desafio inteiro, com a rubrica oculta
);
create index if not exists prosa_temas_data on prosa_temas (data desc);

-- Sessões de treino: desafio, transcrição, marcações humanas e avaliação (o dado do Teste 3).
create table if not exists prosa_sessoes (
  id         text primary key,
  criada_em  timestamptz not null default now(),
  sessao     jsonb not null
);

alter table prosa_temas enable row level security;
alter table prosa_sessoes enable row level security;

-- Projetos novos podem vir sem expor tabelas novas à API automaticamente: a permissão vai explícita,
-- só para o papel do servidor (o da chave secreta).
grant select, insert, update on prosa_temas, prosa_sessoes to service_role;

-- Faz a API do Supabase enxergar as tabelas na hora, sem esperar o cache.
notify pgrst, 'reload schema';

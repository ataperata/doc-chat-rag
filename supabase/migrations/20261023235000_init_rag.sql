-- Folio library: page-scoped chunks and cosine search over pgvector.
--
-- Access model for this demo:
--   * The Next.js server uses the service role, which bypasses RLS.
--   * anon and authenticated receive no policies and no table grants,
--     so the Data API cannot read or write documents or embeddings.
--   * match_document_chunks is executable only by service_role.
--   * The pdfs bucket is private. The server mints signed upload URLs;
--     there is no public read or write policy.

create extension if not exists vector with schema extensions;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text,
  byte_size bigint not null default 0,
  page_count integer not null default 0 check (page_count >= 0),
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  content text not null,
  page_number integer not null check (page_number > 0),
  chunk_index integer not null check (chunk_index >= 0),
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create index document_chunks_document_id_idx
  on public.document_chunks (document_id);

-- HNSW can be built on an empty table and stays valid as rows are added.
-- Cosine distance matches the <=> operator in match_document_chunks.
-- pgvector indexes vectors up to 2,000 dimensions; text-embedding-3-small
-- uses 1,536, which fits. Do not switch to a 3,072-dimension model without
-- changing this column.
create index document_chunks_embedding_hnsw
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

revoke all on table public.documents from anon, authenticated;
revoke all on table public.document_chunks from anon, authenticated;
grant select, insert, update, delete on table public.documents to service_role;
grant select, insert, update, delete on table public.document_chunks to service_role;

create or replace function public.match_document_chunks (
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int,
  filter_document_ids uuid[] default null
)
returns table (
  id uuid,
  document_id uuid,
  document_name text,
  content text,
  page_number int,
  chunk_index int,
  similarity float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    d.name as document_name,
    c.content,
    c.page_number,
    c.chunk_index,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.document_chunks as c
  join public.documents as d on d.id = c.document_id
  where c.embedding is not null
    and d.status = 'ready'
    and (
      filter_document_ids is null
      or cardinality(filter_document_ids) = 0
      or c.document_id = any (filter_document_ids)
    )
    and c.embedding <=> query_embedding < (1 - match_threshold)
  order by c.embedding <=> query_embedding asc
  limit least(greatest(match_count, 0), 20);
$$;

revoke all on function public.match_document_chunks(
  extensions.vector,
  double precision,
  integer,
  uuid[]
) from public, anon, authenticated;

grant execute on function public.match_document_chunks(
  extensions.vector,
  double precision,
  integer,
  uuid[]
) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pdfs', 'pdfs', false, 20971520, array['application/pdf']::text[])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

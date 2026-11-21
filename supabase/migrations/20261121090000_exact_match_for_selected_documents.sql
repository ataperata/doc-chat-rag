-- Return the full match_count when the question is limited to some documents.
--
-- The first version filtered by document after the HNSW index scan. HNSW
-- hands back about hnsw.ef_search (40) nearest rows from the whole table, so
-- with a few thousand chunks the rows of the selected documents were often
-- not among them and the function returned fewer passages than asked, or none.
--
-- A selected document has at most 200 chunks, so an exact scan over the chosen
-- documents (through document_chunks_document_id_idx) is cheap and complete.
-- The HNSW index is still used when no documents are selected.

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
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  if filter_document_ids is null or cardinality(filter_document_ids) = 0 then
    -- No documents selected: nearest rows from the HNSW index. The threshold
    -- is applied after the limit so the planner keeps the plain
    -- "order by distance limit k" shape that the index serves.
    return query
    select
      n.id,
      n.document_id,
      n.document_name,
      n.content,
      n.page_number,
      n.chunk_index,
      (1 - n.distance)::float
    from (
      select
        c.id,
        c.document_id,
        d.name as document_name,
        c.content,
        c.page_number,
        c.chunk_index,
        c.embedding <=> query_embedding as distance
      from public.document_chunks as c
      join public.documents as d on d.id = c.document_id
      where c.embedding is not null
        and d.status = 'ready'
      order by c.embedding <=> query_embedding asc
      limit least(greatest(match_count, 0), 20)
    ) as n
    where n.distance < (1 - match_threshold)
    order by n.distance asc;
  else
    -- Some documents selected: exact scan over their chunks. materialized
    -- keeps the planner from using the HNSW scan, which would apply the
    -- document filter only after picking candidates from the whole table.
    return query
    with candidates as materialized (
      select
        c.id,
        c.document_id,
        d.name as document_name,
        c.content,
        c.page_number,
        c.chunk_index,
        c.embedding <=> query_embedding as distance
      from public.document_chunks as c
      join public.documents as d on d.id = c.document_id
      where c.document_id = any (filter_document_ids)
        and c.embedding is not null
        and d.status = 'ready'
    )
    select
      m.id,
      m.document_id,
      m.document_name,
      m.content,
      m.page_number,
      m.chunk_index,
      (1 - m.distance)::float
    from candidates as m
    where m.distance < (1 - match_threshold)
    order by m.distance asc
    limit least(greatest(match_count, 0), 20);
  end if;
end;
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

-- Optional ANN index for semantic search (cosine distance). Safe on empty/small tables.
-- Requires pgvector with HNSW support (pgvector 0.5+).
CREATE INDEX IF NOT EXISTS idx_signals_search_embedding_hnsw
  ON signals
  USING hnsw (search_embedding vector_cosine_ops);

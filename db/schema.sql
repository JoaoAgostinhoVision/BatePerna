CREATE TABLE IF NOT EXISTS freshness (
  ficha_slug     TEXT PRIMARY KEY,
  estado         TEXT NOT NULL,
  calculado_em   INTEGER NOT NULL,
  fonte          TEXT NOT NULL,
  previsao_bruta TEXT
);

CREATE TABLE IF NOT EXISTS confirmacoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ficha_slug  TEXT NOT NULL,
  criado_em   INTEGER NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'foi'
);

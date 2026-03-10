-- Schema Supabase (PostgreSQL) - Versão com IF NOT EXISTS
-- Adaptado do schema D1 (SQLite) original
-- Este script pode ser executado mesmo se as tabelas já existirem

-- Tabela de contas (para compatibilidade com sistema de autenticação Mocha)
CREATE TABLE IF NOT EXISTS contas (
  id BIGSERIAL PRIMARY KEY,
  mocha_user_id TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de usuários (autenticação customizada)
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  session_token TEXT,
  auto_create_pecas_on_import BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  ativo INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabela de peças
CREATE TABLE IF NOT EXISTS pecas (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  part_number TEXT,
  user_id BIGINT NOT NULL,
  desenho_tecnico_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Criar índice único para part_number por usuário (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_pecas_part_number_user'
  ) THEN
    CREATE UNIQUE INDEX idx_pecas_part_number_user ON pecas(part_number, user_id);
  END IF;
END $$;

-- Tabela de etapas de produção (template das peças)
CREATE TABLE IF NOT EXISTS etapas (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  peca_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (peca_id) REFERENCES pecas(id) ON DELETE CASCADE
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id BIGSERIAL PRIMARY KEY,
  peca_id BIGINT NOT NULL,
  fornecedor_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  data_entrega DATE,
  status TEXT DEFAULT 'Em andamento',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (peca_id) REFERENCES pecas(id) ON DELETE CASCADE,
  FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabela de etapas do pedido (instâncias das etapas para cada pedido)
CREATE TABLE IF NOT EXISTS etapas_pedido (
  id BIGSERIAL PRIMARY KEY,
  pedido_id BIGINT NOT NULL,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  status TEXT DEFAULT 'Pendente',
  comprovante_url TEXT,
  is_aprovado INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);

-- Tabela de desenhos técnicos (MODIFICADA para usar Supabase Storage)
-- A coluna 'url' agora armazena a URL pública do Supabase Storage
-- Removida a coluna 'dados' que armazenava base64
CREATE TABLE IF NOT EXISTS desenhos_tecnicos (
  id BIGSERIAL PRIMARY KEY,
  peca_id BIGINT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo_arquivo TEXT,
  tamanho INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (peca_id) REFERENCES pecas(id) ON DELETE CASCADE
);

-- Comentários sobre as mudanças do schema
COMMENT ON TABLE desenhos_tecnicos IS 'Armazena metadados dos desenhos técnicos. Os arquivos reais estão no Supabase Storage.';
COMMENT ON COLUMN desenhos_tecnicos.url IS 'URL pública do arquivo no Supabase Storage (bucket: desenhos)';

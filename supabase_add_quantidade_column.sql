-- Adicionar coluna quantidade à tabela pedidos
-- Execute este script no SQL Editor do Supabase

ALTER TABLE pedidos 
ADD COLUMN quantidade NUMERIC NOT NULL DEFAULT 1;

-- Adicionar comentário para documentação
COMMENT ON COLUMN pedidos.quantidade IS 'Quantidade de peças no pedido';

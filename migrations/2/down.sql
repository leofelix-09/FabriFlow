
-- Reverter mudanças
ALTER TABLE fornecedores RENAME COLUMN user_id TO conta_id;
ALTER TABLE pecas RENAME COLUMN user_id TO conta_id;
ALTER TABLE pedidos RENAME COLUMN user_id TO conta_id;

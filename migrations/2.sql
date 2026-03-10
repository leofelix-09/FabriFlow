
-- Renomear colunas conta_id para user_id para usar Mocha Users Service
ALTER TABLE fornecedores RENAME COLUMN conta_id TO user_id;
ALTER TABLE pecas RENAME COLUMN conta_id TO user_id;
ALTER TABLE pedidos RENAME COLUMN conta_id TO user_id;

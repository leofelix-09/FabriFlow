
-- Primeiro, atualizar peças que não têm part_number para ter valores únicos
UPDATE pecas 
SET part_number = 'PN' || SUBSTR('000000' || id, -6)
WHERE part_number IS NULL OR part_number = '';

-- Criar índice único para part_number por usuário
CREATE UNIQUE INDEX idx_pecas_part_number_user ON pecas(part_number, user_id);

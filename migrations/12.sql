
-- Tornar part_number obrigatório e único
-- Primeiro, atualizar peças que não têm part_number
UPDATE pecas 
SET part_number = 'PN' || SUBSTR('000000' || id, -6)
WHERE part_number IS NULL OR part_number = '';

-- Criar índice único para part_number
CREATE UNIQUE INDEX idx_pecas_part_number_unique ON pecas(part_number, user_id);

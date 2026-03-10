-- Adicionar novos campos para suportar a Importação do Layout 2 (Lead Time)

DO $$ 
BEGIN
  -- Tabela `etapas`
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'etapas' AND column_name = 'como_evidenciar') THEN
    ALTER TABLE etapas ADD COLUMN como_evidenciar TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'etapas' AND column_name = 'prazo_minimo') THEN
    ALTER TABLE etapas ADD COLUMN prazo_minimo INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'etapas' AND column_name = 'prazo_maximo') THEN
    ALTER TABLE etapas ADD COLUMN prazo_maximo INTEGER;
  END IF;

  -- Tabela `etapas_pedido`
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'etapas_pedido' AND column_name = 'como_evidenciar') THEN
    ALTER TABLE etapas_pedido ADD COLUMN como_evidenciar TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'etapas_pedido' AND column_name = 'prazo_minimo') THEN
    ALTER TABLE etapas_pedido ADD COLUMN prazo_minimo INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'etapas_pedido' AND column_name = 'prazo_maximo') THEN
    ALTER TABLE etapas_pedido ADD COLUMN prazo_maximo INTEGER;
  END IF;
END $$;

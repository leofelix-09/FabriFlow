-- Enable RLS on all tables
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pecas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE desenhos_tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidencias_recentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_changes ENABLE ROW LEVEL SECURITY;

-- IMPORTANT:
-- The application uses a custom 'usuarios' table with INTEGER IDs.
-- Supabase Auth uses UUIDs in 'auth.users'.
-- The policies below assume that you are either:
-- 1. Using the Service Role Key in your Worker (which bypasses RLS).
-- 2. OR you have synchronized 'auth.users' with 'usuarios' (unlikely given the schema).
-- 3. OR you are using these policies to prevent direct access from the public, while allowing the Worker (with Service Role) to function.

-- If you are using the ANON key in your Worker, these policies WILL BLOCK ACCESS because 'auth.uid()' will be null or not match 'usuarios.id'.
-- To fix this, ensure your Worker uses the SERVICE_ROLE key in the 'SUPABASE_KEY' environment variable.

-- Helper function to cast auth.uid() to text safely
-- (Not strictly needed if we cast in the policy, but good for clarity)

-- Policies for 'usuarios'
-- Cast auth.uid() to text to compare with integer id (cast to text)
CREATE POLICY "Users can view own profile" 
ON usuarios FOR SELECT 
TO authenticated 
USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" 
ON usuarios FOR UPDATE 
TO authenticated 
USING (auth.uid()::text = id::text);

-- Fornecedores
CREATE POLICY "Users can CRUD own suppliers" 
ON fornecedores FOR ALL 
TO authenticated 
USING (auth.uid()::text = user_id::text);

-- Pecas
CREATE POLICY "Users can CRUD own parts" 
ON pecas FOR ALL 
TO authenticated 
USING (auth.uid()::text = user_id::text);

-- Pedidos
CREATE POLICY "Users can CRUD own orders" 
ON pedidos FOR ALL 
TO authenticated 
USING (auth.uid()::text = user_id::text);

-- Etapas Pedido
CREATE POLICY "Users can CRUD own etapas_pedido" 
ON etapas_pedido FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM pedidos 
    WHERE id = etapas_pedido.pedido_id 
    AND user_id::text = auth.uid()::text
  )
);

-- Public Access Policies (REQUIRED if using Anon Key for public routes like Supplier Panel)
-- These allow public access to specific resources needed for the supplier panel.

-- Allow public read access to specific tables used in the supplier panel
CREATE POLICY "Public read access to fornecedores" 
ON fornecedores FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Public read access to pecas" 
ON pecas FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Public read access to pedidos" 
ON pedidos FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Public read access to etapas_pedido" 
ON etapas_pedido FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Public update access to etapas_pedido" 
ON etapas_pedido FOR UPDATE 
TO anon 
USING (true); -- Needed for suppliers to update status/upload proof

CREATE POLICY "Public read access to desenhos_tecnicos" 
ON desenhos_tecnicos FOR SELECT 
TO anon 
USING (true);

-- Note: 'etapas' table might also need public read if used in the panel
CREATE POLICY "Public read access to etapas" 
ON etapas FOR SELECT 
TO anon 
USING (true);

-- System Notifications and Evidence (Authenticated only)
CREATE POLICY "Users can view own notifications" 
ON notificacoes_sistema FOR ALL 
TO authenticated 
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view own evidence" 
ON evidencias_recentes FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM pedidos 
    WHERE id = evidencias_recentes.pedido_id 
    AND user_id::text = auth.uid()::text
  )
);

CREATE POLICY "Users can view own status changes" 
ON status_changes FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM pedidos 
    WHERE id = status_changes.pedido_id 
    AND user_id::text = auth.uid()::text
  )
);

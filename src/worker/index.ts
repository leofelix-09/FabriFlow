import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { cors } from "hono/cors";
import {
  getOAuthRedirectUrl,
  exchangeCodeForSessionToken,
  deleteSession,
  getCurrentUser,
  MOCHA_SESSION_TOKEN_COOKIE_NAME
} from "@getmocha/users-service/backend";
import { setCookie, getCookie } from "hono/cookie";
import {
  CriarFornecedorSchema,
  CriarPecaSchema,
  CriarPedidoSchema,
  RegisterSchema,
  LoginSchema
} from "@/shared/types";
import bcrypt from "bcryptjs";

import { createSupabaseClient } from "./supabase";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
}

interface User {
  id: number;
  email: string;
  [key: string]: unknown;
}

type HonoEnv = {
  Bindings: Env;
  Variables: {
    user?: User;
  };
};

const app = new Hono<HonoEnv>();

// Middleware
app.use("*", cors());

// Rotas de autenticação usando Mocha Users Service e autenticação customizada
app.get('/api/oauth/google/redirect_url', async (c) => {
  try {
    // Verificar se as variáveis de ambiente estão configuradas
    if (!c.env.MOCHA_USERS_SERVICE_API_URL || !c.env.MOCHA_USERS_SERVICE_API_KEY) {
      console.error("Missing required environment variables for OAuth:", {
        apiUrl: !!c.env.MOCHA_USERS_SERVICE_API_URL,
        apiKey: !!c.env.MOCHA_USERS_SERVICE_API_KEY
      });
      return c.json({ error: "Service configuration error" }, 500);
    }

    const redirectUrl = await getOAuthRedirectUrl('google', {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });

    return c.json({ redirectUrl }, 200);
  } catch (error) {
    console.error("Error getting OAuth redirect URL:", error);
    return c.json({
      error: "Failed to get OAuth redirect URL",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post("/api/sessions", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.code) {
      console.error("No authorization code provided in request body");
      return c.json({ error: "No authorization code provided" }, 400);
    }

    // Verificar se as variáveis de ambiente estão configuradas
    if (!c.env.MOCHA_USERS_SERVICE_API_URL || !c.env.MOCHA_USERS_SERVICE_API_KEY) {
      console.error("Missing required environment variables:", {
        apiUrl: !!c.env.MOCHA_USERS_SERVICE_API_URL,
        apiKey: !!c.env.MOCHA_USERS_SERVICE_API_KEY
      });
      return c.json({ error: "Service configuration error" }, 500);
    }

    console.log("Exchanging code for session token...", {
      codePresent: !!body.code,
      codeLength: body.code?.length,
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL?.substring(0, 50) + "...",
      apiKeyPresent: !!c.env.MOCHA_USERS_SERVICE_API_KEY
    });

    // Adicionar timeout e retry logic
    let sessionToken;
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`OAuth attempt ${attempt}/3`);
        sessionToken = await exchangeCodeForSessionToken(body.code, {
          apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
          apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
        });
        break; // Sucesso, sair do loop
      } catch (attemptError) {
        lastError = attemptError;
        console.error(`OAuth attempt ${attempt} failed:`, attemptError);

        if (attempt < 3) {
          // Aguardar um pouco antes da próxima tentativa
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!sessionToken) {
      throw lastError;
    }

    console.log("Session token obtained successfully");

    setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 24 * 60 * 60, // 60 days
    });

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error("Error in /api/sessions (final):", {
      error: error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    // Retornar erro mais específico
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Bad Request') || errorMessage.includes('400')) {
      return c.json({
        error: "Authentication failed",
        details: "Invalid or expired authorization code. Please try logging in again."
      }, 400);
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return c.json({
        error: "Network error",
        details: "Connection timeout. Please check your internet connection and try again."
      }, 503);
    }

    return c.json({
      error: "Authentication service error",
      details: errorMessage
    }, 500);
  }
});

// Middleware personalizado para verificar sessões customizadas também
const customAuthMiddleware = async (c: any, next: any) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (!sessionToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Primeiro tenta verificar com o serviço de usuários Mocha usando getCurrentUser
  try {
    const user = await getCurrentUser(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });

    if (user) {
      // Se usuário encontrado no serviço Mocha, definir no contexto
      c.set("user", user);
      return await next();
    }
  } catch (error) {
    console.log("Mocha auth failed, trying custom auth:", error);
  }

  // Se falhar com Mocha auth, tenta verificar sessão customizada
  const supabase = createSupabaseClient(c.env);
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('id, nome, email')
    .eq('session_token', sessionToken)
    .single();

  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Definir usuário no contexto (formato compatível com MochaUser)
  c.set("user", {
    id: String(user.id),
    email: user.email as string,
    name: user.nome as string,
    google_user_data: {
      name: user.nome as string,
      given_name: (user.nome as string).split(' ')[0],
      email: user.email as string
    }
  });

  return await next();
};

app.get("/api/users/me", customAuthMiddleware, async (c) => {
  return c.json(c.get("user"));
});

app.get('/api/logout', async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === 'string') {
    // Tentar deletar sessão do Mocha Users Service
    try {
      await deleteSession(sessionToken, {
        apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
        apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
      });
    } catch {
      // Se falhar, pode ser uma sessão customizada, limpar do banco
      const supabase = createSupabaseClient(c.env);
      await supabase
        .from('usuarios')
        .update({ session_token: null, updated_at: new Date().toISOString() })
        .eq('session_token', sessionToken);
    }
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'none',
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// Rota para registro customizado por email/senha
app.post("/api/register-custom", zValidator("json", RegisterSchema), async (c) => {
  try {
    const data = c.req.valid("json");

    const supabase = createSupabaseClient(c.env);

    // Verificar se o email já existe
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', data.email)
      .single();

    if (existingUser) {
      return c.json({ error: "Email já cadastrado" }, 400);
    }

    // Hash da senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(data.senha, saltRounds);

    // Verificar se existe pelo menos uma conta, se não, criar uma conta padrão
    const { data: contaExistente } = await supabase
      .from('contas')
      .select('id')
      .limit(1)
      .single();

    let contaId = contaExistente?.id;

    if (!contaExistente) {
      // Criar conta padrão para o primeiro usuário
      const { data: novaConta, error: contaError } = await supabase
        .from('contas')
        .insert({
          nome: data.nome + " - Empresa",
          email: data.email,
          senha: hashedPassword
        })
        .select()
        .single();

      if (contaError || !novaConta) {
        throw new Error("Erro ao criar conta");
      }

      contaId = novaConta.id;
    }

    // Criar usuário
    const { data: novoUsuario, error: userError } = await supabase
      .from('usuarios')
      .insert({
        nome: data.nome,
        email: data.email,
        senha: hashedPassword,
        conta_id: contaId,
        papel: 'gestor',
        session_token: null
      })
      .select()
      .single();

    if (userError || !novoUsuario) {
      throw new Error("Erro ao criar usuário");
    }

    return c.json({
      message: "Usuário criado com sucesso",
      userId: novoUsuario.id
    }, 201);

  } catch (error) {
    console.error("Erro no registro customizado:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para login customizado por email/senha
app.post("/api/login-custom", zValidator("json", LoginSchema), async (c) => {
  try {
    const data = c.req.valid("json");

    const supabase = createSupabaseClient(c.env);

    // Buscar usuário pelo email
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', data.email)
      .single();

    if (error || !user) {
      return c.json({ error: "Credenciais inválidas" }, 401);
    }

    // Verificar senha - suportar tanto bcrypt quanto hashes legados
    let isPasswordValid = false;

    // Se a senha armazenada parece ser um hash bcrypt (começa com $2)
    if ((user.senha as string).startsWith('$2')) {
      isPasswordValid = await bcrypt.compare(data.senha, user.senha as string);
    } else {
      // Para hashes legados (SHA-256 ou outros), fazer comparação simples
      // Primeiro, tentar com a senha direta
      if (user.senha === data.senha) {
        isPasswordValid = true;
      } else {
        // Tentar com hash SHA-256 da senha fornecida usando Web Crypto API
        const encoder = new TextEncoder();
        const data_encoded = encoder.encode(data.senha);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data_encoded);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashedInput = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        isPasswordValid = hashedInput === user.senha;
      }
    }

    if (!isPasswordValid) {
      return c.json({ error: "Credenciais inválidas" }, 401);
    }

    // Gerar session token
    const sessionToken = crypto.randomUUID();

    // Atualizar usuário com session token
    await supabase
      .from('usuarios')
      .update({
        session_token: sessionToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Definir cookie de sessão
    setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 24 * 60 * 60, // 60 days
    });

    return c.json({ success: true }, 200);

  } catch (error) {
    console.error("Erro no login customizado:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rotas de fornecedores
app.get("/api/fornecedores", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }
  const status = c.req.query('status') || 'ativo'; // 'ativo', 'inativo', 'todos'

  const supabase = createSupabaseClient(c.env);
  let query = supabase
    .from('fornecedores')
    .select('*')
    .eq('user_id', user.id)
    .order('nome');

  if (status === 'ativo') {
    // "ativo = 1 OR ativo IS NULL"
    query = query.or('ativo.eq.1,ativo.is.null');
  } else if (status === 'inativo') {
    query = query.eq('ativo', 0);
  }
  // Para 'todos', não adiciona filtro de status

  const { data: fornecedores, error } = await query;

  if (error) {
    console.error("Erro ao buscar fornecedores:", error);
    return c.json({ error: "Erro ao buscar fornecedores" }, 500);
  }

  return c.json(fornecedores);
});

app.post("/api/fornecedores", customAuthMiddleware, zValidator("json", CriarFornecedorSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);
  const { data: novoFornecedor, error } = await supabase
    .from('fornecedores')
    .insert({
      nome: data.nome,
      email: data.email,
      user_id: user.id,
      ativo: 1
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar fornecedor:", error);
    return c.json({ error: "Erro ao criar fornecedor" }, 500);
  }

  return c.json(novoFornecedor, 201);
});

// Rota para atualizar status de fornecedor (ativar/desativar)
app.patch("/api/fornecedores/:id/status", customAuthMiddleware, async (c) => {
  const fornecedorId = c.req.param("id");
  const { ativo } = await c.req.json(); // 'ativo' will be boolean from frontend
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);

  // Verificar se o fornecedor pertence ao usuário
  const { data: fornecedor, error: fetchError } = await supabase
    .from('fornecedores')
    .select('id')
    .eq('id', fornecedorId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !fornecedor) {
    console.error("Erro ao buscar fornecedor para atualização de status:", fetchError);
    return c.json({ error: "Fornecedor não encontrado ou não pertence ao usuário" }, 404);
  }

  // Se está sendo desativado, verificar se há pedidos em andamento
  if (!ativo) {
    const { count: pedidosEmAndamentoCount, error: pedidosError } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('fornecedor_id', fornecedorId)
      .neq('status', 'Concluído');

    if (pedidosError) {
      console.error("Erro ao verificar pedidos em andamento:", pedidosError);
      return c.json({ error: "Erro ao verificar pedidos em andamento" }, 500);
    }

    if (pedidosEmAndamentoCount && pedidosEmAndamentoCount > 0) {
      return c.json({
        error: "Não é possível desativar este fornecedor pois possui pedidos em andamento"
      }, 400);
    }
  }

  const { error: updateError } = await supabase
    .from('fornecedores')
    .update({ ativo: ativo ? 1 : 0, updated_at: new Date().toISOString() })
    .eq('id', fornecedorId)
    .eq('user_id', user.id);

  if (updateError) {
    console.error("Erro ao atualizar status do fornecedor:", updateError);
    return c.json({ error: "Erro ao atualizar status do fornecedor" }, 500);
  }

  return c.json({
    message: ativo ? "Fornecedor ativado com sucesso" : "Fornecedor desativado com sucesso"
  });
});

// Rota para excluir fornecedor permanentemente
app.delete("/api/fornecedores/:id", customAuthMiddleware, async (c) => {
  const fornecedorId = c.req.param("id");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);

  // Verificar se o fornecedor pertence ao usuário
  const { data: fornecedor, error: fetchError } = await supabase
    .from('fornecedores')
    .select('id')
    .eq('id', fornecedorId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !fornecedor) {
    console.error("Erro ao buscar fornecedor para exclusão:", fetchError);
    return c.json({ error: "Fornecedor não encontrado ou não pertence ao usuário" }, 404);
  }

  // Verificar se há pedidos usando este fornecedor
  const { count: pedidosCount, error: pedidosError } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('fornecedor_id', fornecedorId);

  if (pedidosError) {
    console.error("Erro ao verificar pedidos vinculados:", pedidosError);
    return c.json({ error: "Erro ao verificar pedidos vinculados" }, 500);
  }

  if (pedidosCount && pedidosCount > 0) {
    return c.json({
      error: "Não é possível excluir este fornecedor pois ele possui pedidos cadastrados. Desative-o em vez de excluir."
    }, 400);
  }

  // Excluir o fornecedor
  const { error: deleteError } = await supabase
    .from('fornecedores')
    .delete()
    .eq('id', fornecedorId)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error("Erro ao excluir fornecedor:", deleteError);
    return c.json({ error: "Erro ao excluir fornecedor" }, 500);
  }

  return c.json({ message: "Fornecedor excluído com sucesso" });
});

// Rotas de peças
// Rota para criar peça
app.post("/api/pecas", customAuthMiddleware, zValidator("json", CriarPecaSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    // Verificar se part_number já existe
    const { data: existingPeca } = await supabase
      .from('pecas')
      .select('id')
      .eq('part_number', data.part_number)
      .eq('user_id', user.id)
      .single();

    if (existingPeca) {
      return c.json({ error: 'Código (Part Number) já está em uso' }, 400);
    }

    // Criar peça
    const { data: peca, error: createError } = await supabase
      .from('pecas')
      .insert({
        part_number: data.part_number,
        nome: data.nome,
        descricao: data.descricao,
        user_id: user.id
      })
      .select()
      .single();

    if (createError) {
      console.error("Erro ao criar peça:", createError);
      return c.json({ error: "Erro ao criar peça" }, 500);
    }

    if (data.etapas && data.etapas.length > 0) {
      const etapasToInsert = data.etapas.map(etapa => ({
        nome: etapa.nome,
        ordem: etapa.ordem,
        como_evidenciar: etapa.como_evidenciar,
        prazo_minimo: etapa.prazo_minimo,
        prazo_maximo: etapa.prazo_maximo,
        peca_id: peca.id
      }));

      const { error: etapasError } = await supabase
        .from('etapas')
        .insert(etapasToInsert);

      if (etapasError) {
        console.error("Erro ao criar etapas:", etapasError);
        // Não falhar a criação da peça, mas logar erro
      }
    }

    return c.json({
      id: peca.id,
      message: "Peça criada com sucesso"
    });

  } catch (error) {
    console.error("Erro ao criar peça:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para excluir pedido
app.delete("/api/pedidos/:id", customAuthMiddleware, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);

  const { error } = await supabase
    .from('pedidos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error("Erro ao excluir pedido:", error);
    return c.json({ error: "Erro ao excluir pedido" }, 500);
  }

  return c.json({ success: true });
});

// Rota para upload de desenho técnico para uma peça específica
app.post("/api/pecas/:id/desenho", customAuthMiddleware, async (c) => {
  try {
    console.log("=== INICIO DO UPLOAD DE DESENHO (NOVA ROTA) ===");

    const pecaId = c.req.param("id");
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Usuário não autenticado" }, 401);
    }

    const supabase = createSupabaseClient(c.env);

    const contentType = c.req.header('content-type');

    if (!contentType || !contentType.includes('multipart/form-data')) {
      return c.json({ error: "Content-Type deve ser multipart/form-data" }, 400);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: "Arquivo é obrigatório" }, 400);
    }

    // Verificar se a peça pertence ao usuário
    const { data: peca } = await supabase
      .from('pecas')
      .select('id')
      .eq('id', pecaId)
      .eq('user_id', user.id)
      .single();

    if (!peca) {
      return c.json({ error: "Peça não encontrada" }, 404);
    }

    // Upload para Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${pecaId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase
      .storage
      .from('desenhos')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error("Erro no upload para Storage:", uploadError);
      return c.json({ error: "Erro ao fazer upload do arquivo" }, 500);
    }

    const { data: { publicUrl } } = supabase
      .storage
      .from('desenhos')
      .getPublicUrl(fileName);

    // Salvar metadados no banco
    const { data: desenho, error: dbError } = await supabase
      .from('desenhos_tecnicos')
      .insert({
        peca_id: pecaId,
        nome_arquivo: file.name,
        url: publicUrl,
        tipo_arquivo: file.type,
        tamanho: file.size
      })
      .select()
      .single();

    if (dbError) {
      console.error("Erro ao salvar metadados do desenho:", dbError);
      return c.json({ error: "Erro ao salvar informações do arquivo" }, 500);
    }

    return c.json(desenho, 201);

  } catch (error) {
    console.error("Erro no upload de desenho:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para buscar etapas de uma peça
app.get("/api/pecas/:id/etapas", customAuthMiddleware, async (c) => {
  const pecaId = c.req.param("id");
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    // Verificar se a peça pertence ao usuário
    const { data: peca, error: pecaError } = await supabase
      .from('pecas')
      .select('id')
      .eq('id', pecaId)
      .eq('user_id', user.id)
      .single();

    if (pecaError || !peca) {
      return c.json({ error: "Peça não encontrada" }, 404);
    }

    // Buscar etapas da peça
    const { data: etapas, error: etapasError } = await supabase
      .from('etapas')
      .select('*')
      .eq('peca_id', pecaId)
      .order('ordem', { ascending: true });

    if (etapasError) {
      console.error("Erro ao buscar etapas:", etapasError);
      return c.json({ error: "Erro ao buscar etapas" }, 500);
    }

    return c.json(etapas || []);
  } catch (error) {
    console.error("Erro ao buscar etapas:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para buscar desenhos técnicos de uma peça
app.get("/api/pecas/:id/desenhos", customAuthMiddleware, async (c) => {
  const pecaId = c.req.param("id");
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    // Verificar se a peça pertence ao usuário
    const { data: peca, error: pecaError } = await supabase
      .from('pecas')
      .select('id')
      .eq('id', pecaId)
      .eq('user_id', user.id)
      .single();

    if (pecaError || !peca) {
      return c.json({ error: "Peça não encontrada" }, 404);
    }

    // Buscar desenhos técnicos da peça
    const { data: desenhos, error: desenhosError } = await supabase
      .from('desenhos_tecnicos')
      .select('*')
      .eq('peca_id', pecaId)
      .order('created_at', { ascending: false });

    if (desenhosError) {
      console.error("Erro ao buscar desenhos:", desenhosError);
      return c.json({ error: "Erro ao buscar desenhos técnicos" }, 500);
    }

    return c.json(desenhos || []);

  } catch (error) {
    console.error("Erro ao buscar desenhos:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rotas legadas de desenho removidas


// Rota para excluir peça
app.delete("/api/pecas/:id", customAuthMiddleware, async (c) => {
  const pecaId = c.req.param("id");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);

  // Verificar se a peça pertence ao usuário
  const { data: peca, error: pecaError } = await supabase
    .from('pecas')
    .select('id')
    .eq('id', pecaId)
    .eq('user_id', user.id)
    .single();

  if (pecaError || !peca) {
    return c.json({ error: "Peça não encontrada" }, 404);
  }

  // Verificar se há pedidos usando esta peça
  const { count: pedidosCount, error: pedidosError } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('peca_id', pecaId);

  if (pedidosError) {
    console.error("Erro ao verificar dependências da peça:", pedidosError);
    return c.json({ error: "Erro ao verificar dependências" }, 500);
  }

  if (pedidosCount && pedidosCount > 0) {
    return c.json({
      error: "Não é possível excluir esta peça pois ela está sendo usada em pedidos"
    }, 400);
  }

  // Excluir etapas da peça primeiro (Supabase deve lidar com Cascade se configurado, mas por segurança...)
  const { error: deleteEtapasError } = await supabase
    .from('etapas')
    .delete()
    .eq('peca_id', pecaId);

  if (deleteEtapasError) {
    console.error("Erro ao excluir etapas:", deleteEtapasError);
    // Continuar tentando excluir a peça
  }

  // Excluir a peça
  const { error: deletePecaError } = await supabase
    .from('pecas')
    .delete()
    .eq('id', pecaId);

  if (deletePecaError) {
    console.error("Erro ao excluir peça:", deletePecaError);
    return c.json({ error: "Erro ao excluir peça" }, 500);
  }

  return c.json({ message: "Peça excluída com sucesso" });
});

// Rota para atualizar peça
app.put("/api/pecas/:id", customAuthMiddleware, async (c) => {
  const pecaId = c.req.param("id");
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  try {
    const body = await c.req.json();
    const dados = CriarPecaSchema.parse(body);

    const supabase = createSupabaseClient(c.env);

    // Verificar se a peça pertence ao usuário
    const { data: peca, error: pecaError } = await supabase
      .from('pecas')
      .select('id')
      .eq('id', pecaId)
      .eq('user_id', user.id)
      .single();

    if (pecaError || !peca) {
      return c.json({ error: "Peça não encontrada" }, 404);
    }

    // Atualizar dados da peça
    const { error: updateError } = await supabase
      .from('pecas')
      .update({
        part_number: dados.part_number,
        nome: dados.nome,
        descricao: dados.descricao || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', pecaId);

    if (updateError) {
      console.error("Erro ao atualizar peça:", updateError);
      if (updateError.message?.includes('unique') || updateError.message?.includes('part_number')) {
        return c.json({ error: "Este código já está em uso" }, 400);
      }
      return c.json({ error: "Erro ao atualizar peça" }, 500);
    }

    // Excluir etapas antigas
    await supabase
      .from('etapas')
      .delete()
      .eq('peca_id', pecaId);

    // Inserir novas etapas
    if (dados.etapas && dados.etapas.length > 0) {
      const etapasData = dados.etapas.map(etapa => ({
        peca_id: parseInt(pecaId),
        nome: etapa.nome,
        ordem: etapa.ordem
      }));

      const { error: etapasError } = await supabase
        .from('etapas')
        .insert(etapasData);

      if (etapasError) {
        console.error("Erro ao atualizar etapas:", etapasError);
        return c.json({ error: "Erro ao atualizar etapas" }, 500);
      }
    }

    // Buscar peça atualizada com etapas
    const { data: pecaAtualizada, error: fetchError } = await supabase
      .from('pecas')
      .select('*, etapas(*)')
      .eq('id', pecaId)
      .single();

    if (fetchError) {
      console.error("Erro ao buscar peça atualizada:", fetchError);
      return c.json({ error: "Erro ao buscar peça atualizada" }, 500);
    }

    return c.json(pecaAtualizada);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.errors }, 400);
    }
    console.error("Erro ao atualizar peça:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});


// Rota para buscar fornecedores


// Rota para criar fornecedor
app.post("/api/fornecedores", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  try {
    const body = await c.req.json();
    const dados = CriarFornecedorSchema.parse(body);

    const supabase = createSupabaseClient(c.env);
    const { data: fornecedor, error } = await supabase
      .from('fornecedores')
      .insert({
        user_id: user.id,
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        endereco: dados.endereco
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar fornecedor:", error);
      return c.json({ error: "Erro ao criar fornecedor" }, 500);
    }

    return c.json(fornecedor, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.errors }, 400);
    }
    console.error("Erro ao criar fornecedor:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rotas de pedidos
app.get("/api/pedidos", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);

  let query = supabase
    .from('pedidos')
    .select(`
      *,
      pecas (nome),
      fornecedores (nome, email),
      etapas_pedido (status)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const limit = c.req.query("limit");
  const days = c.req.query("days");

  if (days) {
    const date = new Date();
    date.setDate(date.getDate() - parseInt(days));
    query = query.gte('created_at', date.toISOString());
  }

  if (limit) {
    query = query.limit(parseInt(limit));
  }

  const { data: pedidos, error } = await query;

  if (error) {
    console.error("Erro ao buscar pedidos:", error);
    return c.json({ error: "Erro ao buscar pedidos" }, 500);
  }

  // Formatar retorno para manter compatibilidade com frontend
  const pedidosFormatados = pedidos.map((p: any) => ({
    ...p,
    peca_nome: p.pecas?.nome,
    fornecedor_nome: p.fornecedores?.nome,
    fornecedor_email: p.fornecedores?.email,
    etapas_aguardando: p.etapas_pedido?.filter((ep: any) => ep.status === 'Aguardando Aprovação').length || 0
  }));

  return c.json(pedidosFormatados);
});



// Rota para buscar etapas de um pedido
// Rota para buscar etapas de um pedido
app.get("/api/pedidos/:pedidoId/etapas", customAuthMiddleware, async (c) => {
  const pedidoId = c.req.param("pedidoId");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);

  // Verificar se o pedido pertence ao usuário
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('id')
    .eq('id', pedidoId)
    .eq('user_id', user.id)
    .single();

  if (pedidoError || !pedido) {
    return c.json({ error: "Pedido não encontrado" }, 404);
  }

  const { data: etapas, error: etapasError } = await supabase
    .from('etapas_pedido')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('ordem', { ascending: true });

  if (etapasError) {
    console.error("Erro ao buscar etapas:", etapasError);
    return c.json({ error: "Erro ao buscar etapas" }, 500);
  }

  return c.json(etapas);
});

// Rota para upload de comprovante pelo fornecedor - usando etapas_pedido para armazenar arquivos
app.post("/api/fornecedor/upload-comprovante/:etapaId", async (c) => {
  try {
    const etapaId = c.req.param("etapaId");
    console.log('[Upload Comprovante] Iniciando upload para etapa:', etapaId);

    const supabase = createSupabaseClient(c.env);

    const contentType = c.req.header('content-type');
    console.log('[Upload Comprovante] Content-Type:', contentType);

    if (!contentType || !contentType.includes('multipart/form-data')) {
      console.error('[Upload Comprovante] Content-Type inválido:', contentType);
      return c.json({ error: "Content-Type deve ser multipart-form-data" }, 400);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('[Upload Comprovante] Arquivo não encontrado no FormData');
      return c.json({ error: "Arquivo é obrigatório" }, 400);
    }

    console.log('[Upload Comprovante] Arquivo recebido:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Converter File para ArrayBuffer para upload no Supabase
    const fileBuffer = await file.arrayBuffer();
    console.log('[Upload Comprovante] Arquivo convertido para ArrayBuffer, tamanho:', fileBuffer.byteLength);

    // Upload para Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `comprovantes/${etapaId}/${Date.now()}.${fileExt}`;
    console.log('[Upload Comprovante] Nome do arquivo no storage:', fileName);

    const { error: uploadError } = await supabase
      .storage
      .from('desenhos')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error("[Upload Comprovante] Erro no upload do comprovante:", uploadError);
      return c.json({ error: `Erro ao fazer upload do comprovante: ${uploadError.message}` }, 500);
    }

    console.log('[Upload Comprovante] Upload no storage concluído com sucesso');

    const { data: { publicUrl } } = supabase
      .storage
      .from('desenhos')
      .getPublicUrl(fileName);

    console.log('[Upload Comprovante] URL pública gerada:', publicUrl);

    // Atualizar etapa com URL do comprovante e status
    const { error: updateError } = await supabase
      .from('etapas_pedido')
      .update({
        comprovante_url: publicUrl,
        status: 'Aguardando Aprovação',
        updated_at: new Date().toISOString()
      })
      .eq('id', etapaId);

    if (updateError) {
      console.error("[Upload Comprovante] Erro ao atualizar etapa com comprovante:", updateError);
      return c.json({ error: `Erro ao salvar comprovante: ${updateError.message}` }, 500);
    }

    console.log('[Upload Comprovante] Etapa atualizada com sucesso');

    return c.json({
      success: true,
      comprovante_url: publicUrl
    });

  } catch (error) {
    console.error("[Upload Comprovante] Erro geral:", error);
    return c.json({ error: `Erro interno do servidor: ${error instanceof Error ? error.message : 'Erro desconhecido'}` }, 500);
  }
});

// Rota para remover comprovante
app.delete("/api/fornecedor/remover-comprovante/:etapaId", async (c) => {
  const etapaId = c.req.param("etapaId");
  const supabase = createSupabaseClient(c.env);

  try {
    // Atualizar etapa removendo comprovante
    const { error } = await supabase
      .from('etapas_pedido')
      .update({
        comprovante_url: null,
        status: 'Pendente',
        is_aprovado: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', etapaId);

    if (error) {
      console.error("Erro ao remover comprovante:", error);
      return c.json({ error: "Erro ao remover comprovante" }, 500);
    }

    return c.json({ message: "Comprovante removido com sucesso" });

  } catch (error) {
    console.error("Erro ao remover comprovante:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});



// Rota para obter informações do comprovante (miniatura)
app.get("/api/comprovante/:etapaId/info", async (c) => {
  try {
    const etapaId = c.req.param("etapaId");
    const supabase = createSupabaseClient(c.env);

    const { data: etapa, error } = await supabase
      .from('etapas_pedido')
      .select('comprovante_url')
      .eq('id', etapaId)
      .single();

    if (error || !etapa || !etapa.comprovante_url) {
      return c.json({ error: "Comprovante não encontrado" }, 404);
    }

    // Extrair o caminho do arquivo da URL pública
    // URL formato: https://xxx.supabase.co/storage/v1/object/public/desenhos/comprovantes/1/123.jpg
    const url = etapa.comprovante_url as string;
    const pathMatch = url.match(/\/desenhos\/(.+)$/);

    if (!pathMatch) {
      return c.json({ error: "URL do comprovante inválida" }, 400);
    }

    const filePath = pathMatch[1]; // Ex: comprovantes/1/123.jpg
    const fileName = filePath.split('/').pop() || 'comprovante';

    // Tentar obter metadados do arquivo no Storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('desenhos')
      .list(filePath.substring(0, filePath.lastIndexOf('/')), {
        search: fileName
      });

    let fileInfo = {
      nome: fileName,
      tipo: 'application/octet-stream',
      tamanho: 0
    };

    if (!fileError && fileData && fileData.length > 0) {
      const file = fileData[0];
      // Determinar tipo MIME baseado na extensão
      const ext = fileName.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };

      fileInfo = {
        nome: file.name,
        tipo: ext ? (mimeTypes[ext] || 'application/octet-stream') : 'application/octet-stream',
        tamanho: file.metadata?.size || 0
      };
    }

    return c.json({
      ...fileInfo,
      url: etapa.comprovante_url
    });

  } catch (error) {
    console.error("Erro ao obter informações do comprovante:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para alterar status da etapa pelo fornecedor
app.post("/api/fornecedor/alterar-status-etapa/:etapaId", async (c) => {
  try {
    const etapaId = c.req.param("etapaId");
    const { status } = await c.req.json();
    const supabase = createSupabaseClient(c.env);

    if (!etapaId || !status) {
      return c.json({ error: "Dados obrigatórios não fornecidos" }, 400);
    }

    // Status permitidos para o fornecedor
    const statusPermitidos = ['Pendente', 'Fabricando', 'Aguardando Aprovação', 'Concluída'];

    if (!statusPermitidos.includes(status)) {
      return c.json({ error: "Status inválido" }, 400);
    }

    // Verificar se a etapa existe e buscar info do pedido
    const { data: etapa, error: etapaError } = await supabase
      .from('etapas_pedido')
      .select('*, pedidos!inner(*, pecas(nome))')
      .eq('id', etapaId)
      .single();

    if (etapaError || !etapa) {
      return c.json({ error: "Etapa não encontrada" }, 404);
    }

    // Regras de negócio para mudança de status
    if (status === 'Concluída' && !etapa.is_aprovado) {
      return c.json({ error: "Etapa deve estar aprovada para ser marcada como concluída" }, 400);
    }

    // Atualizar status da etapa usando Supabase
    const { error: updateError } = await supabase
      .from('etapas_pedido')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', etapaId);

    if (updateError) {
      console.error("Erro ao atualizar status da etapa:", updateError);
      return c.json({ error: "Erro ao atualizar status" }, 500);
    }

    // Criar notificação
    const pedidoInfo = etapa.pedidos;
    // @ts-ignore
    const pecaNome = pedidoInfo.pecas?.nome || 'Peça desconhecida';

    let tipoNotificacao = 'status_alterado';
    let titulo = 'Status Atualizado 🔄';
    let mensagem = `O status da etapa "${etapa.nome}" mudou para "${status}" no pedido #${etapa.pedido_id} - ${pecaNome}`;

    if (status === 'Fabricando') {
      tipoNotificacao = 'fabricacao_iniciada';
      titulo = 'Mãos à Obra! 🛠️';
      mensagem = `A fabricação da etapa "${etapa.nome}" começou no pedido #${etapa.pedido_id} - ${pecaNome}`;
    } else if (status === 'Concluída') {
      tipoNotificacao = 'etapa_concluida';
      titulo = 'Etapa Finalizada! ✅';
      mensagem = `A etapa "${etapa.nome}" foi concluída com sucesso no pedido #${etapa.pedido_id} - ${pecaNome}`;
    }

    // Criar notificação para o gestor
    await criarNotificacao(
      supabase,
      // @ts-ignore
      pedidoInfo.user_id,
      etapa.pedido_id,
      tipoNotificacao,
      titulo,
      mensagem
    );

    // Atualizar status do pedido baseado no status das etapas
    const { data: todasEtapas, error: erroEtapas } = await supabase
      .from('etapas_pedido')
      .select('status')
      .eq('pedido_id', etapa.pedido_id);

    if (!erroEtapas && todasEtapas) {
      const totalEtapas = todasEtapas.length;
      const concluidas = todasEtapas.filter(e => e.status === 'Concluída').length;
      const pendentes = todasEtapas.filter(e => e.status === 'Pendente').length;

      let novoStatusPedido = 'Em Fabricação'; // Default se não for nem tudo pendente nem tudo concluído

      if (concluidas === totalEtapas && totalEtapas > 0) {
        novoStatusPedido = 'Concluído';
      } else if (pendentes === totalEtapas) {
        novoStatusPedido = 'Pendente';
      }

      // Atualizar o pedido
      await supabase
        .from('pedidos')
        .update({
          status: novoStatusPedido,
          updated_at: new Date().toISOString()
        })
        .eq('id', etapa.pedido_id);
    }

    return c.json({ message: `Etapa alterada para: ${status} ` });

  } catch (error) {
    console.error("Erro ao alterar status da etapa:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para buscar peças (com paginação e busca)
app.get("/api/pecas", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const search = c.req.query("search") || "";
  const offset = (page - 1) * limit;

  try {
    const supabase = createSupabaseClient(c.env);

    let query = supabase
      .from('pecas')
      .select('*, etapas(*)', { count: 'exact' })
      .eq('user_id', user.id);

    if (search) {
      query = query.or(`nome.ilike.% ${search}%, codigo.ilike.% ${search}%, part_number.ilike.% ${search}% `);
    }

    const { data: pecas, count, error } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar peças:", error);
      return c.json({ pecas: [], total: 0, pages: 0 });
    }

    return c.json({
      pecas: pecas || [],
      total: count || 0,
      pages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    console.error("Erro ao buscar peças:", error);
    return c.json({ pecas: [], total: 0, pages: 0 });
  }
});

// Rota para criar novo pedido
app.post("/api/pedidos", customAuthMiddleware, zValidator("json", CriarPedidoSchema), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const { peca_id, fornecedor_id, quantidade, data_entrega, observacoes, centro, ordem_compra, numero_ordem, data_pedido } = c.req.valid("json");

  try {
    const supabase = createSupabaseClient(c.env);

    // 1. Criar o pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        user_id: user.id,
        peca_id,
        fornecedor_id,
        quantidade,
        data_entrega,
        observacoes,
        centro,
        ordem_compra,
        numero_ordem,
        data_pedido,
        status: 'Pendente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (pedidoError || !pedido) {
      console.error("Erro ao criar pedido:", pedidoError);
      return c.json({ error: "Erro ao criar pedido" }, 500);
    }

    // 2. Buscar etapas da peça para criar as etapas do pedido
    const { data: etapasPeca, error: _etapasError } = await supabase
      .from('etapas')
      .select('*')
      .eq('peca_id', peca_id)
      .order('ordem', { ascending: true });

    if (etapasPeca && etapasPeca.length > 0) {
      const etapasPedido = etapasPeca.map(etapa => ({
        pedido_id: pedido.id,
        nome: etapa.nome,
        ordem: etapa.ordem,
        como_evidenciar: etapa.como_evidenciar,
        prazo_minimo: etapa.prazo_minimo,
        prazo_maximo: etapa.prazo_maximo,
        status: 'Pendente',
        is_aprovado: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: insertEtapasError } = await supabase
        .from('etapas_pedido')
        .insert(etapasPedido);

      if (insertEtapasError) {
        console.error("Erro ao criar etapas do pedido:", insertEtapasError);
      }
    }

    return c.json(pedido, 201);

  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para buscar pedidos (com filtros)
app.get("/api/pedidos", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const status = c.req.query("status");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = (page - 1) * limit;

  try {
    const supabase = createSupabaseClient(c.env);

    let query = supabase
      .from('pedidos')
      .select(`
  *,
  pecas(
    nome,
    codigo,
    part_number
  ),
  fornecedores(
    nome
  )
    `, { count: 'exact' })
      .eq('user_id', user.id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: pedidos, count, error } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar pedidos:", error);
      return c.json({ pedidos: [], total: 0, pages: 0 });
    }

    // Formatar resposta para manter compatibilidade com frontend
    const formattedPedidos = pedidos?.map(p => ({
      ...p,
      peca_nome: p.pecas?.nome,
      peca_codigo: p.pecas?.codigo,
      part_number: p.pecas?.part_number,
      fornecedor_nome: p.fornecedores?.nome
    }));

    return c.json({
      pedidos: formattedPedidos || [],
      total: count || 0,
      pages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    return c.json({ pedidos: [], total: 0, pages: 0 });
  }
});

// Rota para atualizar etapa do pedido (aprovação/rejeição)
app.patch("/api/pedidos/:pedidoId/etapas/:etapaId", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const pedidoId = c.req.param("pedidoId");
  const etapaId = c.req.param("etapaId");
  const { aprovado, observacao } = await c.req.json();

  try {
    const supabase = createSupabaseClient(c.env);

    // Verificar se o pedido pertence ao usuário
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id')
      .eq('id', pedidoId)
      .eq('user_id', user.id)
      .single();

    if (pedidoError || !pedido) {
      return c.json({ error: "Pedido não encontrado" }, 404);
    }

    // Atualizar etapa
    const { data: etapa, error: updateError } = await supabase
      .from('etapas_pedido')
      .update({
        is_aprovado: aprovado ? true : false,
        status: aprovado ? 'Concluída' : 'Rejeitada', // Se rejeitada, volta para pendente ou fica rejeitada? Assumindo rejeitada por enquanto
        observacao,
        updated_at: new Date().toISOString()
      })
      .eq('id', etapaId)
      .eq('pedido_id', pedidoId)
      .select()
      .single();

    if (updateError) {
      return c.json({ error: "Erro ao atualizar etapa" }, 500);
    }

    // Se rejeitado, talvez precise reabrir a etapa anterior ou notificar fornecedor
    // Se aprovado, verificar se todas as etapas foram concluídas para finalizar o pedido
    if (aprovado) {
      const { count: etapasPendentes } = await supabase
        .from('etapas_pedido')
        .select('*', { count: 'exact', head: true })
        .eq('pedido_id', pedidoId)
        .neq('status', 'Concluída');

      if (etapasPendentes === 0) {
        await supabase
          .from('pedidos')
          .update({ status: 'Concluído', updated_at: new Date().toISOString() })
          .eq('id', pedidoId);
      }
    } else {
      // Se rejeitado, volta status do pedido para Em Andamento (se estava em revisão)
      await supabase
        .from('pedidos')
        .update({ status: 'Em Andamento', updated_at: new Date().toISOString() })
        .eq('id', pedidoId);
    }

    // Registrar mudança de status (auditoria)
    await supabase
      .from('status_changes')
      .insert({
        pedido_id: pedidoId,
        status_anterior: 'Em Revisão', // Simplificação
        status_novo: aprovado ? 'Aprovado' : 'Rejeitado',
        created_at: new Date().toISOString()
      });

    return c.json({ message: "Etapa atualizada com sucesso", etapa });

  } catch (error) {
    console.error("Erro ao atualizar etapa:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para marcar etapa como concluída pelo fornecedor (mantida para compatibilidade)
app.post("/api/fornecedor/concluir-etapa", async (c) => {
  try {
    const { etapa_id, pedido_id } = await c.req.json();
    const supabase = createSupabaseClient(c.env);

    if (!etapa_id || !pedido_id) {
      return c.json({ error: "Dados obrigatórios não fornecidos" }, 400);
    }

    // Verificar se a etapa existe, pertence ao pedido e está aprovada
    const { data: etapa, error: etapaError } = await supabase
      .from('etapas_pedido')
      .select('*')
      .eq('id', etapa_id)
      .eq('pedido_id', pedido_id)
      .eq('is_aprovado', true)
      .single();

    if (etapaError || !etapa) {
      return c.json({ error: "Etapa não encontrada ou não aprovada" }, 404);
    }

    // Marcar etapa como concluída
    const { error: updateError } = await supabase
      .from('etapas_pedido')
      .update({
        status: 'Concluída',
        updated_at: new Date().toISOString()
      })
      .eq('id', etapa_id);

    if (updateError) {
      return c.json({ error: "Erro ao concluir etapa" }, 500);
    }

    // Verificar se todas as etapas foram concluídas para atualizar status do pedido
    const { count: etapasPendentes } = await supabase
      .from('etapas_pedido')
      .select('*', { count: 'exact', head: true })
      .eq('pedido_id', pedido_id)
      .neq('status', 'Concluída');

    if (etapasPendentes === 0) {
      await supabase
        .from('pedidos')
        .update({ status: 'Concluído', updated_at: new Date().toISOString() })
        .eq('id', pedido_id);
    }

    return c.json({ message: "Etapa marcada como concluída" });

  } catch (error) {
    console.error("Erro ao concluir etapa:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para aprovar/rejeitar comprovante (apenas para gestores autenticados)
app.post("/api/etapas/:etapaId/aprovar", customAuthMiddleware, async (c) => {
  const etapaId = c.req.param("etapaId");
  const { aprovado } = await c.req.json();
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);

  // Verificar se a etapa pertence a um pedido do usuário
  const { data: etapa, error: etapaError } = await supabase
    .from('etapas_pedido')
    .select('*, pedidos!inner(*)')
    .eq('id', etapaId)
    .eq('pedidos.user_id', user.id)
    .single();

  if (etapaError || !etapa) {
    return c.json({ error: "Etapa não encontrada" }, 404);
  }

  // Atualizar aprovação
  const { error: updateError } = await supabase
    .from('etapas_pedido')
    .update({
      is_aprovado: aprovado ? true : false,
      updated_at: new Date().toISOString()
    })
    .eq('id', etapaId);

  if (updateError) {
    return c.json({ error: "Erro ao atualizar aprovação" }, 500);
  }

  return c.json({
    message: aprovado ? "Etapa aprovada" : "Etapa rejeitada"
  } as { message: string });
});

// Rota para dashboard stats
app.get("/api/dashboard", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);

  try {
    // Executar queries em paralelo para melhor performance
    const [pecasRes, fornecedoresRes, pedidosRes] = await Promise.all([
      supabase.from('pecas').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('fornecedores').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    ]);

    return c.json({
      totalPecas: pecasRes.count || 0,
      totalFornecedores: fornecedoresRes.count || 0,
      totalPedidos: pedidosRes.count || 0
    });
  } catch (error) {
    console.error("Erro ao buscar stats do dashboard:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para buscar configurações do usuário
app.get("/api/user/settings", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);

  const { data: userSettings, error } = await supabase
    .from('usuarios')
    .select('auto_create_pecas_on_import')
    .eq('id', user.id)
    .single();

  if (error || !userSettings) {
    return c.json({ error: "Configurações de usuário não encontradas" }, 404);
  }

  return c.json(userSettings);
});

// Rota para atualizar configurações do usuário
app.patch("/api/user/settings", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }
  const { auto_create_pecas_on_import } = await c.req.json();

  if (typeof auto_create_pecas_on_import !== 'boolean') {
    return c.json({ error: "Valor inválido para auto_create_pecas_on_import" }, 400);
  }

  const supabase = createSupabaseClient(c.env);

  const { error } = await supabase
    .from('usuarios')
    .update({
      auto_create_pecas_on_import,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (error) {
    return c.json({ error: "Erro ao atualizar configurações" }, 500);
  }

  return c.json({ message: "Configurações salvas com sucesso" });
});

// Rota para buscar perfil do usuário
app.get("/api/user/profile", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const supabase = createSupabaseClient(c.env);

  const { data: userProfile, error } = await supabase
    .from('usuarios')
    .select('nome, email')
    .eq('id', user.id)
    .single();

  if (error || !userProfile) {
    return c.json({ error: "Perfil não encontrado" }, 404);
  }

  return c.json(userProfile);
});

// Rota para atualizar perfil do usuário
app.patch("/api/user/profile", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  const { nome, email, senha_atual, nova_senha } = await c.req.json();

  const supabase = createSupabaseClient(c.env);

  try {
    // Se houver mudança de senha, verificar senha atual
    if (nova_senha) {
      if (!senha_atual) {
        return c.json({ error: "Senha atual é obrigatória para alterar a senha" }, 400);
      }

      const { data: currentUser, error: fetchError } = await supabase
        .from('usuarios')
        .select('senha')
        .eq('id', user.id)
        .single();

      if (fetchError || !currentUser) {
        return c.json({ error: "Usuário não encontrado" }, 404);
      }

      const bcrypt = await import('bcryptjs');
      const validPassword = await bcrypt.compare(senha_atual, currentUser.senha);
      if (!validPassword) {
        return c.json({ error: "Senha atual incorreta" }, 401);
      }

      const hashedPassword = await bcrypt.hash(nova_senha, 10);

      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          nome,
          email,
          senha: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        return c.json({ error: "Erro ao atualizar perfil" }, 500);
      }
    } else {
      // Apenas atualizar dados básicos
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          nome,
          email,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        return c.json({ error: "Erro ao atualizar perfil" }, 500);
      }
    }

    return c.json({ message: "Perfil atualizado com sucesso" });

  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para painel do fornecedor (sem autenticação, usando ID do pedido)
app.get("/api/fornecedor/pedido/:pedidoId", async (c) => {
  const pedidoId = c.req.param("pedidoId");
  const supabase = createSupabaseClient(c.env);

  // Buscar pedido com detalhes
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select(`
  *,
  pecas(
    nome,
    part_number,
    descricao,
    desenhos_tecnicos(id, nome_arquivo, url, tipo_arquivo, tamanho)
  ),
  fornecedores(nome),
  etapas_pedido(*)
    `)
    .eq('id', pedidoId)
    .single();

  if (error || !pedido) {
    return c.json({ error: "Pedido não encontrado" }, 404);
  }

  // Formatar resposta
  const response = {
    ...pedido,
    peca_nome: pedido.pecas?.nome,
    peca_part_number: pedido.pecas?.part_number,
    peca_descricao: pedido.pecas?.descricao,
    fornecedor_nome: pedido.fornecedores?.nome,
    etapas: pedido.etapas_pedido?.sort((a: any, b: any) => a.ordem - b.ordem) || [],
    desenhos_tecnicos: pedido.pecas?.desenhos_tecnicos || []
  };

  return c.json(response);
});

// Rota para fornecedor listar desenhos técnicos de uma peça (sem autenticação)
app.get("/api/fornecedor/peca/:pecaId/desenhos", async (c) => {
  try {
    const pecaId = c.req.param("pecaId");
    const supabase = createSupabaseClient(c.env);

    // Buscar desenhos técnicos da nova tabela
    const { data: desenhos, error } = await supabase
      .from('desenhos_tecnicos')
      .select('id, nome_arquivo, url, tipo_arquivo, tamanho, created_at')
      .eq('peca_id', pecaId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar desenhos:", error);
      return c.json({ error: "Erro ao buscar desenhos" }, 500);
    }

    return c.json(desenhos || []);

  } catch (error) {
    console.error("Erro ao listar desenhos técnicos para fornecedor:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Rota para download de desenho técnico pelo fornecedor (sem autenticação)
app.get("/api/fornecedor/desenho/:id/download", async (c) => {
  const desenhoId = c.req.param("id");
  const supabase = createSupabaseClient(c.env);

  try {
    const { data: desenho, error } = await supabase
      .from('desenhos_tecnicos')
      .select('url')
      .eq('id', desenhoId)
      .single();

    if (error || !desenho) {
      return c.json({ error: "Desenho técnico não encontrado" }, 404);
    }

    // Redirecionar para a URL pública do Supabase Storage
    return c.redirect(desenho.url, 302);

  } catch (error) {
    console.error("Erro ao baixar desenho:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Remover rota duplicada pois agora o painel do fornecedor usa a nova API de listagem

// Rota para dashboard (estatísticas)
app.get("/api/dashboard", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    // Buscar totais em paralelo
    const [
      { count: totalFornecedores, error: errorFornecedores },
      { count: totalPecas, error: errorPecas },
      { count: totalPedidos, error: errorPedidos }
    ] = await Promise.all([
      supabase.from('fornecedores').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('pecas').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    ]);

    if (errorFornecedores || errorPecas || errorPedidos) {
      console.error("Erro ao buscar estatísticas:", { errorFornecedores, errorPecas, errorPedidos });
      return c.json({ error: "Erro ao buscar estatísticas" }, 500);
    }

    return c.json({
      totalFornecedores: totalFornecedores || 0,
      totalPecas: totalPecas || 0,
      totalPedidos: totalPedidos || 0
    });

  } catch (error) {
    console.error("Erro no dashboard:", error);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Endpoint temporário para limpar o banco de dados
app.delete("/api/admin/clear-db", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    // Deletar os dados na ordem inversa das dependências
    await supabase.from('notificacoes_sistema').delete().eq('user_id', user.id);
    await supabase.from('evidencias_etapas').delete().neq('id', 0); // Limpar todas evidências (RLS no DB deve proteger as dele se houver policy user_id, se não, usamos .neq('id',0))
    await supabase.from('etapas').delete().neq('id', 0);
    await supabase.from('desenhos_tecnicos').delete().neq('id', 0);

    // As tabelas principais associadas ao user_id
    await supabase.from('pedidos').delete().eq('user_id', user.id);
    await supabase.from('pecas').delete().eq('user_id', user.id);
    await supabase.from('fornecedores').delete().eq('user_id', user.id);

    return c.json({ message: "Banco de dados limpo com sucesso para o usuário" });
  } catch (error) {
    console.error("Erro ao limpar banco de dados:", error);
    return c.json({ error: "Erro ao limpar banco de dados" }, 500);
  }
});

// Alias para compatibilidade com frontend em português
app.get("/api/notificacoes", async (c) => {
  const url = new URL(c.req.url);
  url.pathname = "/api/notifications";
  return app.fetch(new Request(url.toString(), c.req.raw), c.env);
});

app.get("/api/notifications", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    // Buscar notificações não lidas
    const { data: notificacoes, error } = await supabase
      .from('notificacoes_sistema')
      .select('*')
      .eq('user_id', user.id)
      .eq('lida', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar notificações:", error);
      return c.json([]);
    }

    // Marcar como lidas (opcional: pode ser feito em outra rota ou após confirmação)
    // Por enquanto, mantendo comportamento de marcar como lida ao buscar
    if (notificacoes && notificacoes.length > 0) {
      const ids = notificacoes.map(n => n.id);
      await supabase
        .from('notificacoes_sistema')
        .update({ lida: true, updated_at: new Date().toISOString() })
        .in('id', ids);
    }

    return c.json(notificacoes || []);
  } catch (err) {
    console.log('Erro ao buscar notificações:', err);
    return c.json([]);
  }
});

// Rota para buscar evidências recentes (para notificações - mantida para compatibilidade)
app.get("/api/pedidos/evidencias-recentes", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  try {
    const supabase = createSupabaseClient(c.env);

    // Buscar evidências recentes (últimos 30 segundos)
    // Nota: Supabase usa ISO strings para datas
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();

    const { data: evidencias, error } = await supabase
      .from('evidencias_recentes')
      .select(`
  *,
  pedidos!inner(
    peca_id,
    user_id
  )
    `)
      .eq('pedidos.user_id', user.id)
      .gt('created_at', thirtySecondsAgo)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar evidências:", error);
      return c.json([]);
    }

    // Limpar evidências antigas (opcional, pode ser feito via cron/pg_cron no Supabase)
    // Por enquanto, vamos pular a limpeza no request para performance

    // Formatar resposta para manter compatibilidade
    const formattedEvidencias = evidencias.map(e => ({
      ...e,
      peca_id: e.pedidos.peca_id
    }));

    return c.json(formattedEvidencias || []);
  } catch (err) {
    console.log('Erro ao buscar evidências:', err);
    return c.json([]);
  }
});

// Rota para buscar mudanças de status (para notificações)
app.get("/api/pedidos/status-changes", customAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Usuário não autenticado" }, 401);
  }

  try {
    const supabase = createSupabaseClient(c.env);
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();

    const { data: changes, error } = await supabase
      .from('status_changes')
      .select(`
    *,
    pedidos!inner(
      user_id,
      pecas(
        nome
      )
    )
      `)
      .eq('pedidos.user_id', user.id)
      .gt('created_at', thirtySecondsAgo)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar mudanças de status:", error);
      return c.json([]);
    }

    // Formatar resposta
    const formattedChanges = changes.map(c => ({
      ...c,
      peca_nome: c.pedidos.pecas.nome
    }));

    return c.json(formattedChanges || []);
  } catch (err) {
    console.log('Erro ao buscar mudanças de status:', err);
    return c.json([]);
  }
});

// Função auxiliar para criar notificação do sistema
async function criarNotificacao(supabase: any, userId: number, pedidoId: number, tipo: string, titulo: string, mensagem: string) {
  try {
    await supabase
      .from('notificacoes_sistema')
      .insert({
        user_id: userId,
        pedido_id: pedidoId,
        tipo,
        titulo,
        mensagem,
        lida: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  } catch (error) {
    console.log('Erro ao criar notificação (não crítico):', error);
  }
}



// Export as Cloudflare Worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  }
};

import z from "zod";

// Esquemas para validação das entidades

export const ContaSchema = z.object({
  id: z.number(),
  nome: z.string(),
  email: z.string().email(),
  senha: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const UsuarioSchema = z.object({
  id: z.number(),
  nome: z.string(),
  email: z.string().email(),
  senha: z.string(),
  conta_id: z.number(),
  papel: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const FornecedorSchema = z.object({
  id: z.number(),
  nome: z.string(),
  email: z.string().email(),
  conta_id: z.number(),
  ativo: z.boolean().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PecaSchema = z.object({
  id: z.number(),
  part_number: z.string(),
  nome: z.string(),
  descricao: z.string().nullable(),
  conta_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const EtapaSchema = z.object({
  id: z.number(),
  nome: z.string(),
  ordem: z.number(),
  peca_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PedidoSchema = z.object({
  id: z.number(),
  peca_id: z.number(),
  conta_id: z.number(),
  fornecedor_id: z.number(),
  data_entrega: z.string(),
  status: z.string(),
  centro: z.string().optional().nullable(),
  ordem_compra: z.string().optional().nullable(),
  numero_ordem: z.string().optional().nullable(),
  data_pedido: z.string().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const EtapaPedidoSchema = z.object({
  id: z.number(),
  nome: z.string(),
  ordem: z.number(),
  pedido_id: z.number(),
  status: z.string(),
  comprovante_url: z.string().nullable(),
  is_aprovado: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Tipos derivados dos esquemas
export type Conta = z.infer<typeof ContaSchema>;
export type Usuario = z.infer<typeof UsuarioSchema>;
export type Fornecedor = z.infer<typeof FornecedorSchema>;
export type Peca = z.infer<typeof PecaSchema>;
export type Etapa = z.infer<typeof EtapaSchema>;
export type Pedido = z.infer<typeof PedidoSchema>;
export type EtapaPedido = z.infer<typeof EtapaPedidoSchema>;

// Esquemas para entrada de dados
export const CriarContaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  senha: z.string().min(1, "Senha é obrigatória"),
});

export const RegisterSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmarSenha: z.string().min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.senha === data.confirmarSenha, {
  message: "As senhas não coincidem",
  path: ["confirmarSenha"],
});

export const CriarFornecedorSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
});

export const CriarPecaSchema = z.object({
  part_number: z.string().min(1, "Código (Part Number) é obrigatório"),
  nome: z.string().min(1, "Nome da peça é obrigatório"),
  descricao: z.string().optional().nullable(),
  etapas: z.array(z.object({
    nome: z.string().min(1, "Nome da etapa é obrigatório"),
    ordem: z.number(),
    como_evidenciar: z.string().optional().nullable(),
    prazo_minimo: z.number().optional().nullable(),
    prazo_maximo: z.number().optional().nullable(),
  })),
});

export const CriarPedidoSchema = z.object({
  peca_id: z.number(),
  fornecedor_id: z.number(),
  data_entrega: z.string(),
  quantidade: z.number(),
  observacoes: z.string().optional(),
  centro: z.string().optional().nullable(),
  ordem_compra: z.string().optional().nullable(),
  numero_ordem: z.string().optional().nullable(),
  data_pedido: z.string().optional().nullable(),
});

export type CriarConta = z.infer<typeof CriarContaSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type Register = z.infer<typeof RegisterSchema>;
export type CriarFornecedor = z.infer<typeof CriarFornecedorSchema>;
export type CriarPeca = z.infer<typeof CriarPecaSchema>;
export type CriarPedido = z.infer<typeof CriarPedidoSchema>;

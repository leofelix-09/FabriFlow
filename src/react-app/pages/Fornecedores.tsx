import { useState, useEffect } from 'react';
import Layout from '@/react-app/components/Layout';
import Card from '@/react-app/components/Card';
import Button from '@/react-app/components/Button';
import Input from '@/react-app/components/Input';
import ConfirmModal from '@/react-app/components/ConfirmModal';
import { Users, Plus, Mail, Edit3, Power, Trash2, Filter, CheckCircle, XCircle, LayoutGrid, List } from 'lucide-react';
import { useRealTimeUpdates } from '@/react-app/hooks/useRealTimeUpdates';
import { useNotificationContext } from '@/react-app/components/NotificationProvider';

interface Fornecedor {
  id: number;
  nome: string;
  email: string;
  ativo?: boolean;
  created_at: string;
}

export default function Fornecedores() {
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ativo' | 'inativo' | 'todos'>('ativo');
  const [deletingFornecedorId, setDeletingFornecedorId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { showSuccess, showError } = useNotificationContext();

  // Usar atualizações em tempo real para fornecedores (sem notificações automáticas para evitar duplicatas)
  const { data: fornecedores = [], refetch } = useRealTimeUpdates<Fornecedor[]>({
    endpoint: `/api/fornecedores?status=${statusFilter}&limit=1000`,
    interval: 5000,
    onUpdate: () => {
      // Remover notificações automáticas para evitar duplicatas
      // As notificações serão criadas apenas através das ações manuais
    }
  });

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email })
      });

      if (response.ok) {
        await refetch();
        resetForm();
        showSuccess('Fornecedor Adicionado! 🤝', `O fornecedor "${nome}" foi cadastrado.`);
      }
    } catch (error) {
      console.error('Erro ao criar fornecedor:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingFornecedor(null);
    setNome('');
    setEmail('');
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setNome(fornecedor.nome);
    setEmail(fornecedor.email);
    setShowForm(true);
  };

  const handleToggleStatus = async (fornecedor: Fornecedor) => {
    const novoStatus = !fornecedor.ativo;

    try {
      const response = await fetch(`/api/fornecedores/${fornecedor.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoStatus })
      });

      if (response.ok) {
        await refetch();
        showSuccess(
          novoStatus ? 'Fornecedor Ativado' : 'Fornecedor Desativado',
          `O fornecedor "${fornecedor.nome}" foi ${novoStatus ? 'ativado' : 'desativado'} com sucesso`
        );
      } else {
        const errorData = await response.json();
        showError('Algo deu errado ⚠️', errorData.error || 'Não foi possível alterar o status.');
      }
    } catch (error) {
      showError('Algo deu errado ⚠️', 'Erro interno do servidor');
    }
  };

  const handleDeleteFornecedor = async (fornecedor: Fornecedor) => {
    setDeletingFornecedorId(fornecedor.id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteFornecedor = async () => {
    if (!deletingFornecedorId) return;

    try {
      const response = await fetch(`/api/fornecedores/${deletingFornecedorId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await refetch();
        showSuccess('Fornecedor Removido 🗑️', 'O fornecedor foi removido da lista.');
      } else {
        const errorData = await response.json();
        showError('Algo deu errado ⚠️', errorData.error || 'Não foi possível excluir o fornecedor.');
      }
    } catch (error) {
      showError('Algo deu errado ⚠️', 'Erro interno do servidor');
    } finally {
      setShowDeleteConfirm(false);
      setDeletingFornecedorId(null);
    }
  };

  // Recarregar dados quando o filtro mudar
  useEffect(() => {
    refetch();
  }, [statusFilter, refetch]);

  return (
    <Layout currentPage="fornecedores" loading={loading}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fornecedores</h1>
            <p className="text-gray-600 mt-2">Gerencie seus parceiros de fabricação</p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="Visualização em Lista"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>

            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Fornecedor
            </Button>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Status:</label>
                <div className="flex space-x-2">
                  <Button
                    variant={statusFilter === 'ativo' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setStatusFilter('ativo')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Ativos
                  </Button>
                  <Button
                    variant={statusFilter === 'inativo' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setStatusFilter('inativo')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Inativos
                  </Button>
                  <Button
                    variant={statusFilter === 'todos' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setStatusFilter('todos')}
                  >
                    Todos
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Form */}
        {showForm && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Nome da Empresa"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Digite o nome da empresa"
                  required
                />

                <Input
                  label="Email de Contato"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" loading={submitting}>
                  {editingFornecedor ? 'Atualizar' : 'Criar'} Fornecedor
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Lista de Fornecedores */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {(fornecedores || []).map((fornecedor) => {
              const isAtivo = fornecedor.ativo !== false; // Considera NULL como ativo para compatibilidade

              return (
                <Card key={fornecedor.id}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg ${isAtivo ? 'bg-success-100' : 'bg-gray-100'}`}>
                        <Users className={`h-5 w-5 ${isAtivo ? 'text-success-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="ml-3">
                        <div className="flex items-center">
                          <h3 className={`font-semibold ${isAtivo ? 'text-gray-900' : 'text-gray-500'}`}>
                            {fornecedor.nome}
                          </h3>
                          {!isAtivo && (
                            <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                              Inativo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center mt-1">
                          <Mail className="h-4 w-4 text-gray-400 mr-1" />
                          <p className={`text-sm ${isAtivo ? 'text-gray-600' : 'text-gray-400'}`}>
                            {fornecedor.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEdit(fornecedor)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>

                      <Button
                        variant={isAtivo ? "warning" : "success"}
                        size="sm"
                        onClick={() => handleToggleStatus(fornecedor)}
                      >
                        <Power className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteFornecedor(fornecedor)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Cadastrado em {new Date(fornecedor.created_at).toLocaleDateString('pt-BR')}
                      </p>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!isAtivo}
                        onClick={() => window.open(`mailto:${fornecedor.email}`, '_blank')}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Contatar
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Empresa</th>
                    <th className="px-6 py-4">Email de Contato</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Data de Cadastro</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(fornecedores || []).map((fornecedor) => {
                    const isAtivo = fornecedor.ativo !== false;
                    return (
                      <tr key={fornecedor.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 border-l-4 border-transparent hover:border-primary-500">{fornecedor.nome}</td>
                        <td className="px-6 py-4 text-gray-600">{fornecedor.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${isAtivo ? 'bg-success-100 text-success-700' : 'bg-red-100 text-red-700'}`}>
                            {isAtivo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {new Date(fornecedor.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end space-x-2">
                            <span title="Editar">
                              <Button variant="secondary" size="sm" onClick={() => handleEdit(fornecedor)}>
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            </span>
                            <span title={isAtivo ? "Desativar" : "Ativar"}>
                              <Button variant={isAtivo ? "warning" : "success"} size="sm" onClick={() => handleToggleStatus(fornecedor)}>
                                <Power className="h-4 w-4" />
                              </Button>
                            </span>
                            <span title="Excluir">
                              <Button variant="danger" size="sm" onClick={() => handleDeleteFornecedor(fornecedor)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {(!fornecedores || fornecedores.length === 0) && (
          <Card>
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum fornecedor cadastrado</h3>
              <p className="text-gray-600 mb-6">
                Adicione seus primeiros fornecedores para começar a criar pedidos
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Fornecedor
              </Button>
            </div>
          </Card>
        )}

        {/* Modal de Confirmação de Exclusão */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Confirmar Exclusão"
          message="Tem certeza que deseja excluir este fornecedor permanentemente? Esta ação só será possível se o fornecedor não possuir pedidos cadastrados. Considere desativá-lo em vez de excluir."
          confirmText="Excluir Definitivamente"
          cancelText="Cancelar"
          onConfirm={confirmDeleteFornecedor}
          onCancel={() => setShowDeleteConfirm(false)}
          variant="danger"
        />
      </div>
    </Layout>
  );
}

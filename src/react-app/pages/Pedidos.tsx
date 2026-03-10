import { useState, useEffect } from 'react';
import Layout from '@/react-app/components/Layout';
import Card from '@/react-app/components/Card';
import Button from '@/react-app/components/Button';
import Input from '@/react-app/components/Input';
import { FileText, Plus, Calendar, User, Package, Clock, CheckCircle, AlertCircle, Upload, X, Eye, Link, Copy, Download, Trash2, LayoutGrid, List } from 'lucide-react';
import { useRealTimeUpdates } from '@/react-app/hooks/useRealTimeUpdates';
import { useNotificationContext } from '@/react-app/components/NotificationProvider';
import { useFileImport } from '@/react-app/hooks/useFileImport';
import { useAuth } from "@getmocha/users-service/react";
import ImportProgressModal from '@/react-app/components/ImportProgressModal';
import ImportResultModal from '@/react-app/components/ImportResultModal';
import ConfirmModal from '@/react-app/components/ConfirmModal';

interface Pedido {
  id: number;
  peca_nome: string;
  fornecedor_nome: string;
  fornecedor_email: string;
  data_entrega: string;
  status: string;
  created_at: string;
  centro?: string | null;
  numero_ordem?: string | null;
  ordem_compra?: string | null;
  data_pedido?: string | null;
  etapas_aguardando?: number;
  etapas?: EtapaPedido[];
}

interface EtapaPedido {
  id: number;
  nome: string;
  ordem: number;
  status: string;
  comprovante_url?: string;
  is_aprovado: boolean;
}

interface Peca {
  id: number;
  nome: string;
}

interface Fornecedor {
  id: number;
  nome: string;
  email: string;
}



interface DetalhesModalProps {
  pedido: Pedido | null;
  onClose: () => void;
}

interface AprovacaoModalProps {
  etapa: EtapaPedido | null;
  onClose: () => void;
  onApprove: (etapaId: number, aprovado: boolean) => void;
}

function FilePreview({ etapa }: { etapa: EtapaPedido }) {
  const [arquivoInfo, setArquivoInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!etapa.comprovante_url) {
      setLoading(false);
      return;
    }

    // Buscar informações do arquivo via API
    const fetchFileInfo = async () => {
      try {
        const response = await fetch(`/api/comprovante/${etapa.id}/info`);
        if (response.ok) {
          const info = await response.json();
          setArquivoInfo(info);
        }
      } catch (error) {
        console.error('Erro ao buscar info do arquivo:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFileInfo();
  }, [etapa.id, etapa.comprovante_url]);

  if (!etapa.comprovante_url || loading) return null;

  const isImage = arquivoInfo?.tipo?.startsWith('image/');
  const isPDF = arquivoInfo?.tipo === 'application/pdf';

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      if (etapa.comprovante_url) {
        const response = await fetch(etapa.comprovante_url);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = arquivoInfo?.nome || 'comprovante';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
    }
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            {arquivoInfo?.nome || 'Comprovante anexado'}
          </span>
        </div>
        <button
          onClick={handleDownload}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
        >
          <Download className="h-4 w-4" />
          <span>Baixar</span>
        </button>
      </div>

      {isImage && etapa.comprovante_url && (
        <div className="mt-3">
          <img
            src={etapa.comprovante_url}
            alt="Comprovante"
            className="max-w-full h-auto rounded border border-gray-300"
            style={{ maxHeight: '300px' }}
          />
        </div>
      )}

      {isPDF && (
        <div className="mt-2 text-sm text-gray-600">
          Arquivo PDF anexado
        </div>
      )}
    </div>
  );
}

function AprovacaoModal({ etapa, onClose, onApprove }: AprovacaoModalProps) {
  if (!etapa) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6">
          <h2 className="text-xl font-bold text-gray-900">Aprovar Etapa</h2>
          <Button variant="secondary" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-2">{etapa.nome}</h3>
            <p className="text-sm text-gray-600">Etapa {etapa.ordem}</p>
          </div>

          {etapa.comprovante_url && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Comprovante enviado:</p>
              <FilePreview etapa={etapa} />
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              variant="danger"
              onClick={() => {
                onApprove(etapa.id, false);
                onClose();
              }}
              className="flex-1"
            >
              Rejeitar
            </Button>
            <Button
              variant="success"
              onClick={() => {
                onApprove(etapa.id, true);
                onClose();
              }}
              className="flex-1"
            >
              Aprovar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetalhesModal({ pedido, onClose }: DetalhesModalProps) {
  const [etapas, setEtapas] = useState<EtapaPedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [etapaParaAprovar, setEtapaParaAprovar] = useState<EtapaPedido | null>(null);
  const { showSuccess } = useNotificationContext();

  useEffect(() => {
    if (pedido) {
      loadEtapas();
    }
  }, [pedido]);

  const loadEtapas = async () => {
    if (!pedido) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/pedidos/${pedido.id}/etapas`);
      if (response.ok) {
        const data = await response.json();
        setEtapas(data);
      }
    } catch (error) {
      console.error('Erro ao carregar etapas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (etapaId: number, aprovado: boolean) => {
    try {
      const response = await fetch(`/api/etapas/${etapaId}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprovado })
      });

      if (response.ok) {
        await loadEtapas(); // Recarregar etapas
      } else {
        console.error('Erro ao aprovar/rejeitar etapa');
      }
    } catch (error) {
      console.error('Erro ao aprovar/rejeitar etapa:', error);
    }
  };

  if (!pedido) return null;

  const getEtapaStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'concluída':
      case 'concluido':
        return 'text-success-600 bg-success-50';
      case 'aguardando aprovação':
        return 'text-warning-600 bg-warning-50';
      case 'em progresso':
      case 'em andamento':
        return 'text-primary-600 bg-primary-50';
      case 'pendente':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-primary-600 bg-primary-50';
    }
  };

  const getEtapaStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'concluída':
      case 'concluido':
        return <CheckCircle className="h-4 w-4 text-success-600" />;
      case 'aguardando aprovação':
        return <Clock className="h-4 w-4 text-warning-600" />;
      case 'em progresso':
      case 'em andamento':
        return <Clock className="h-4 w-4 text-primary-600" />;
      case 'fabricando':
        return <Package className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Detalhes do Pedido #{pedido.id}</h2>
            <p className="text-gray-600 mt-1">{pedido.peca_nome}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          {/* Informações gerais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Fornecedor</h3>
              <p className="text-gray-600 font-semibold">{pedido.fornecedor_nome}</p>
              <p className="text-sm text-gray-500">{pedido.fornecedor_email}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Datas</h3>
              {pedido.data_pedido && (
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Criação:</span> {new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}
                </p>
              )}
              <p className="text-sm text-gray-600">
                <span className="font-medium">Entrega:</span> {new Date(pedido.data_entrega).toLocaleDateString('pt-BR')}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Info. Comercial</h3>
              {(pedido.ordem_compra || pedido.numero_ordem || pedido.centro) ? (
                <>
                  {pedido.ordem_compra && <p className="text-sm text-gray-600"><span className="font-medium">Documento:</span> {pedido.ordem_compra}</p>}
                  {pedido.numero_ordem && <p className="text-sm text-gray-600"><span className="font-medium">Item:</span> {pedido.numero_ordem}</p>}
                  {pedido.centro && <p className="text-sm text-gray-600"><span className="font-medium">Centro:</span> {pedido.centro}</p>}
                </>
              ) : (
                <p className="text-sm text-gray-500 italic">Não informado</p>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg flex flex-col items-start">
              <h3 className="font-medium text-gray-900 mb-2">Status</h3>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${getEtapaStatusColor(pedido.status)}`}>
                {pedido.status}
              </span>
            </div>
          </div>

          {/* Etapas */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Etapas de Fabricação</h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
              </div>
            ) : etapas.length > 0 ? (
              <div className="space-y-4">
                {etapas.map((etapa) => (
                  <div key={etapa.id} className="rounded-xl p-6 bg-white">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-600">{etapa.ordem}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{etapa.nome}</h4>
                          <p className="text-sm text-gray-500">Etapa {etapa.ordem}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full flex items-center ${getEtapaStatusColor(etapa.status)}`}>
                          {getEtapaStatusIcon(etapa.status)}
                          <span className="ml-2">{etapa.status}</span>
                        </span>

                        {etapa.is_aprovado && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full text-success-600 bg-success-50">
                            ✓ Aprovado
                          </span>
                        )}

                        {etapa.comprovante_url && !etapa.is_aprovado && etapa.status === 'Aguardando Aprovação' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setEtapaParaAprovar(etapa)}
                          >
                            Revisar
                          </Button>
                        )}
                      </div>
                    </div>

                    {etapa.comprovante_url && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-900 text-sm">Comprovante enviado</h5>
                        </div>
                        <FilePreview etapa={etapa} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Nenhuma etapa encontrada</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between p-6">
          <Button
            variant="secondary"
            onClick={() => {
              const link = `${window.location.origin}/fornecedor/pedido/${pedido.id}`;
              navigator.clipboard.writeText(link);
              showSuccess('Link Copiado! 📋', 'O link do fornecedor foi copiado para a área de transferência.');
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copiar Link Fornecedor
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              const link = `${window.location.origin}/fornecedor/pedido/${pedido.id}`;
              window.open(`mailto:${pedido.fornecedor_email}?subject=Pedido #${pedido.id} - ${pedido.peca_nome}&body=Olá,%0A%0ASegue o link para acompanhar o pedido de fabricação:%0A${link}%0A%0AAtenciosamente`, '_blank');
            }}
          >
            Enviar Link por Email
          </Button>
        </div>

        {/* Modal de Aprovação */}
        <AprovacaoModal
          etapa={etapaParaAprovar}
          onClose={() => setEtapaParaAprovar(null)}
          onApprove={handleApproval}
        />
      </div>
    </div>
  );
}

export default function Pedidos() {
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoCreatePecasSetting, setAutoCreatePecasSetting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filtros
  const [filtroOrdemCompra, setFiltroOrdemCompra] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [pecaId, setPecaId] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [dataEntrega, setDataEntrega] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; step: string } | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [deletingPedidoId, setDeletingPedidoId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { showSuccess, showError } = useNotificationContext();
  const { importing, importFromFile } = useFileImport();
  const { user } = useAuth();

  // Usar atualizações em tempo real para pedidos (sem notificações automáticas para evitar duplicatas)
  const { data: pedidos = [], refetch } = useRealTimeUpdates<Pedido[]>({
    endpoint: '/api/pedidos?limit=1000',
    interval: 3000, // Atualizado para 3 segundos (mais rápido)
    onUpdate: () => {
      // Remover notificações automáticas para evitar duplicatas
      // As notificações serão criadas através do useGlobalNotifications e ações manuais
    }
  });

  // Remover verificação duplicada de evidências - já é feita no useGlobalNotifications

  useEffect(() => {
    loadStaticData();
    // Carregar a configuração do usuário
    if (user?.id) {
      loadUserImportSettings();
    }
  }, [user?.id]);

  const loadStaticData = async () => {
    try {
      const [pecasRes, fornecedoresRes] = await Promise.all([
        fetch('/api/pecas?limit=1000'),
        fetch('/api/fornecedores?limit=1000')
      ]);

      if (pecasRes.ok) {
        const pecasData = await pecasRes.json();
        // Extract pecas array from paginated response
        setPecas(pecasData?.pecas || pecasData || []);
      }

      if (fornecedoresRes.ok) {
        const fornecedoresData = await fornecedoresRes.json();
        // Fornecedores is already an array
        setFornecedores(Array.isArray(fornecedoresData) ? fornecedoresData : []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserImportSettings = async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const settings = await response.json();
        setAutoCreatePecasSetting(settings.auto_create_pecas_on_import || false);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração de importação do usuário:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pecaId || !fornecedorId || !dataEntrega) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peca_id: parseInt(pecaId),
          fornecedor_id: parseInt(fornecedorId),
          quantidade: parseInt(quantidade) || 1,
          data_entrega: dataEntrega
        })
      });

      if (response.ok) {
        await refetch();
        resetForm();
        showSuccess('Pedido Criado! 🚀', 'O novo pedido já foi enviado para o fornecedor.');
      }
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setPecaId('');
    setFornecedorId('');
    setQuantidade('1');
    setDataEntrega('');
  };

  const handleDeletePedido = async (pedido: Pedido) => {
    setDeletingPedidoId(pedido.id);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePedido = async () => {
    if (!deletingPedidoId) return;

    try {
      const response = await fetch(`/api/pedidos/${deletingPedidoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await refetch();
        showSuccess('Pedido Removido 🗑️', 'O pedido foi removido da sua lista.');
      } else {
        const errorData = await response.json();
        showError('Algo deu errado ⚠️', errorData.error || 'Não foi possível excluir o pedido. Tente novamente.');
      }
    } catch (error) {
      showError('Algo deu errado ⚠️', 'Erro interno do servidor');
    } finally {
      setShowDeleteConfirm(false);
      setDeletingPedidoId(null);
    }
  };



  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input imediatamente
    event.target.value = '';

    try {
      // Mostrar modal de progresso
      setShowProgressModal(true);
      setImportProgress({ current: 0, total: 0, step: 'Iniciando...' });

      const result = await importFromFile(file, {
        endpoint: '/api/pedidos',
        validateItem: (item) => {
          console.log('Validando item:', item);
          console.log('Campos disponíveis no item:', Object.keys(item));

          // Validar se os campos obrigatórios existem e não são vazios
          const pecaNome = item.peca_nome?.toString()?.trim();
          const fornecedorNome = item.fornecedor_nome?.toString()?.trim();
          const dataEntrega = item.data_entrega?.toString()?.trim();

          console.log('Campos extraídos:', {
            pecaNome: pecaNome || 'VAZIO',
            fornecedorNome: fornecedorNome || 'VAZIO',
            dataEntrega: dataEntrega || 'VAZIO'
          });

          if (!pecaNome || !fornecedorNome || !dataEntrega) {
            const itemJson = JSON.stringify(item, null, 2);
            console.log('Validação falhou - item completo:', itemJson);
            return {
              isValid: false,
              errorMessage: `Dados obrigatórios ausentes: Nome da Peça, Nome do Fornecedor ou Data de Entrega. Item: ${itemJson.substring(0, 100)}...`
            };
          }

          console.log('Validação bem-sucedida');
          return { isValid: true };
        },
        transformItem: (item) => {
          // Sanitizar os dados de entrada
          const pecaNome = item.peca_nome?.toString()?.trim();
          const fornecedorNome = item.fornecedor_nome?.toString()?.trim();
          const dataEntrega = item.data_entrega?.toString()?.trim();
          const quantidade = item.quantidade_item ? parseFloat(item.quantidade_item.toString()) : 1;

          return {
            peca_nome: pecaNome,
            codigo_item: item.codigo_item?.toString()?.trim() || null,
            fornecedor_nome: fornecedorNome,
            data_entrega: dataEntrega,
            quantidade: quantidade,
            // Campos adicionais da planilha
            ordem_compra: item.ordem_compra?.toString()?.trim() || null,
            centro: item.centro?.toString()?.trim() || null,
            numero_ordem: item.numero_ordem?.toString()?.trim() || null,
            data_pedido: item.data_pedido?.toString()?.trim() || null,
            // os campos peca_id e fornecedor_id serão definidos/sobrescritos pelo hook
          };
        },
        onProgress: (progress) => {
          setImportProgress(progress);
        },
        autoCreatePecas: autoCreatePecasSetting
      }, pecas, fornecedores);

      // Fechar modal de progresso
      setShowProgressModal(false);
      setImportProgress(null);

      // Mostrar modal de resultado
      setImportResult(result);
      setShowResultModal(true);

      // Atualizar lista se importou algo
      if (result.importedCount > 0) {
        await refetch();
      }

    } catch (error) {
      console.error('Erro ao importar pedidos:', error);

      // Fechar modal de progresso
      setShowProgressModal(false);
      setImportProgress(null);

      // Mostrar toast de erro
      showError('Ops! 😕', error instanceof Error ? error.message : 'Não conseguimos processar o arquivo.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'concluído':
      case 'concluido':
        return <CheckCircle className="h-4 w-4 text-success-600" />;
      case 'atrasado':
        return <AlertCircle className="h-4 w-4 text-danger-600" />;
      case 'em progresso':
      case 'em andamento':
        return <Clock className="h-4 w-4 text-warning-600" />;
      default:
        return <Clock className="h-4 w-4 text-primary-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'concluído':
      case 'concluido':
        return 'text-success-600 bg-success-50';
      case 'atrasado':
        return 'text-danger-600 bg-danger-50';
      case 'em progresso':
      case 'em andamento':
        return 'text-warning-600 bg-warning-50';
      case 'fabricando':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-primary-600 bg-primary-50';
    }
  };

  const isOverdue = (dataEntrega: string) => {
    return new Date(dataEntrega) < new Date() && !['concluído', 'concluido'].includes(dataEntrega.toLowerCase());
  };

  const pedidosFiltrados = (pedidos || []).filter(pedido => {
    const matchOrdemCompra = !filtroOrdemCompra || (pedido.ordem_compra && pedido.ordem_compra.toLowerCase().includes(filtroOrdemCompra.toLowerCase()));
    const matchFornecedor = !filtroFornecedor || (pedido.fornecedor_nome && pedido.fornecedor_nome.toLowerCase().includes(filtroFornecedor.toLowerCase()));
    return matchOrdemCompra && matchFornecedor;
  });

  return (
    <Layout currentPage="pedidos" loading={loading}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
            <p className="text-gray-600 mt-2">Gerencie seus pedidos de fabricação</p>
          </div>

          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto mt-4 sm:mt-0">
            <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
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

            <div className="relative flex-1 sm:flex-none">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json,.html,.htm"
                onChange={handleFileImport}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={importing || submitting || pecas.length === 0 || fornecedores.length === 0}
              />
              <Button
                variant="secondary"
                loading={importing || submitting}
                disabled={importing || submitting || pecas.length === 0 || fornecedores.length === 0}
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? 'Processando...' : 'Importar Arquivo'}
              </Button>
            </div>

            <Button onClick={() => setShowForm(true)} disabled={pecas.length === 0 || fornecedores.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Pedido
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                label="Ordem de Compra (Doc.compra)"
                placeholder="Filtrar por ordem de compra..."
                value={filtroOrdemCompra}
                onChange={(e) => setFiltroOrdemCompra(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Fornecedor (Nome)"
                placeholder="Filtrar por nome do fornecedor..."
                value={filtroFornecedor}
                onChange={(e) => setFiltroFornecedor(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Avisos */}
        {(pecas.length === 0 || fornecedores.length === 0) && (
          <Card>
            <div className="p-4 bg-warning-50 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-warning-600 mr-3" />
                <div>
                  <h3 className="font-medium text-warning-800">Cadastros necessários</h3>
                  <p className="text-sm text-warning-700 mt-1">
                    {pecas.length === 0 && 'Cadastre pelo menos uma peça '}
                    {pecas.length === 0 && fornecedores.length === 0 && 'e '}
                    {fornecedores.length === 0 && 'cadastre pelo menos um fornecedor '}
                    antes de criar ou importar pedidos.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Informações sobre importação */}
        {pecas.length > 0 && fornecedores.length > 0 && (
          <Card>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-800">Formato para importação de pedidos de fabricação</h3>

                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-blue-700">
                      <strong>O sistema reconhece automaticamente os seguintes títulos de colunas:</strong>
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-blue-700 bg-blue-100 p-3 rounded">
                      <div><strong>Cen</strong> → Código da Filial</div>
                      <div><strong>Fornecedor</strong> → Código do Fornecedor</div>
                      <div><strong>Nome</strong> → Nome do Fornecedor</div>
                      <div><strong>Doc.compra</strong> → Ordem de Compra</div>
                      <div><strong>Item</strong> → Número da Ordem</div>
                      <div><strong>Material</strong> → Código do Item</div>
                      <div><strong>Texto breve de material</strong> → Nome da Peça</div>
                      <div><strong>Quantidade</strong> → Quantidade do Item</div>
                      <div><strong>Dt.Est.Rem</strong> → Data de Entrega</div>
                      <div><strong>Dt.Ped</strong> → Data do Pedido</div>
                    </div>

                    <p className="text-sm text-blue-700 mt-2">
                      <strong>Formatos suportados:</strong> CSV, Excel (.xlsx, .xls), HTML, JSON
                    </p>

                    <p className="text-sm text-blue-700">
                      <strong>Campos obrigatórios:</strong> Nome do Fornecedor, Nome da Peça, Data de Entrega
                    </p>

                    <p className="text-xs text-blue-600 mt-2">
                      Os nomes das peças e fornecedores devem corresponder exatamente aos cadastrados no sistema.
                      Datas devem estar no formato YYYY-MM-DD ou DD/MM/YYYY.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Form */}
        {showForm && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Novo Pedido</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Peça <span className="text-danger-500">*</span>
                  </label>
                  <select
                    value={pecaId}
                    onChange={(e) => setPecaId(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione uma peça</option>
                    {pecas.map((peca) => (
                      <option key={peca.id} value={peca.id}>
                        {peca.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fornecedor <span className="text-danger-500">*</span>
                  </label>
                  <select
                    value={fornecedorId}
                    onChange={(e) => setFornecedorId(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione um fornecedor</option>
                    {fornecedores.map((fornecedor) => (
                      <option key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Quantidade"
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  required
                />

                <Input
                  label="Data de Entrega"
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" loading={submitting}>
                  Criar Pedido
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Lista de Pedidos */}
        {viewMode === 'grid' ? (
          <div className="space-y-4">
            {pedidosFiltrados.map((pedido) => (
              <Card key={pedido.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <FileText className="h-5 w-5 text-primary-600" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{pedido.peca_nome}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(pedido.status)}`}>
                          {getStatusIcon(pedido.status)}
                          <span className="ml-1">{pedido.status}</span>
                        </span>
                        {(pedido.etapas_aguardando || 0) > 0 && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full text-warning-600 bg-warning-50 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {pedido.etapas_aguardando} aguardando aprovação
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2" />
                          {pedido.fornecedor_nome}
                        </div>

                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span className={isOverdue(pedido.data_entrega) ? 'text-danger-600 font-medium' : ''}>
                            {new Date(pedido.data_entrega).toLocaleDateString('pt-BR')}
                            {isOverdue(pedido.data_entrega) && ' (Atrasado)'}
                          </span>
                        </div>

                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-2" />
                          Pedido #{pedido.id}
                        </div>

                        {pedido.ordem_compra && (
                          <div className="flex items-center text-primary-600 font-medium col-span-1 md:col-span-3">
                            <FileText className="h-4 w-4 mr-2" />
                            Doc.Compra: {pedido.ordem_compra}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedPedido(pedido)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalhes
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const link = `${window.location.origin}/fornecedor/pedido/${pedido.id}`;
                        navigator.clipboard.writeText(link);
                        showSuccess('Link Copiado! 📋', 'O link do fornecedor foi copiado para a área de transferência.');
                      }}
                    >
                      <Link className="mr-2 h-4 w-4" />
                      Link Fornecedor
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const link = `${window.location.origin}/fornecedor/pedido/${pedido.id}`;
                        window.open(`mailto:${pedido.fornecedor_email}?subject=Pedido #${pedido.id} - ${pedido.peca_nome}&body=Olá,%0A%0ASegue o link para acompanhar o pedido de fabricação:%0A${link}%0A%0AAtenciosamente`, '_blank');
                      }}
                    >
                      Enviar por Email
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeletePedido(pedido)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 pt-4">
                  <p className="text-xs text-gray-500">
                    Criado em {new Date(pedido.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">ID do Pedido</th>
                    <th className="px-6 py-4">Doc. Compra</th>
                    <th className="px-6 py-4">Peça</th>
                    <th className="px-6 py-4">Fornecedor</th>
                    <th className="px-6 py-4">Data de Entrega</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pedidosFiltrados.map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 border-l-4 border-transparent hover:border-primary-500">#{pedido.id}</td>
                      <td className="px-6 py-4 font-medium text-primary-600">{pedido.ordem_compra || '-'}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{pedido.peca_nome}</td>
                      <td className="px-6 py-4 text-gray-600">{pedido.fornecedor_nome}</td>
                      <td className="px-6 py-4">
                        <span className={isOverdue(pedido.data_entrega) ? 'text-danger-600 font-medium' : 'text-gray-600'}>
                          {new Date(pedido.data_entrega).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full inline-flex items-center ${getStatusColor(pedido.status)}`}>
                          {getStatusIcon(pedido.status)}
                          <span className="ml-1">{pedido.status}</span>
                        </span>
                        {(pedido.etapas_aguardando || 0) > 0 && (
                          <div className="mt-1">
                            <span className="px-1.5 py-0.5 text-xs font-medium rounded text-warning-600 bg-warning-50 inline-flex items-center" title={`${pedido.etapas_aguardando} etapas aguardando aprovação`}>
                              <Clock className="h-3 w-3 mr-1" />
                              {pedido.etapas_aguardando} pendentes
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end space-x-2">
                          <span title="Ver Detalhes">
                            <Button variant="secondary" size="sm" onClick={() => setSelectedPedido(pedido)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </span>
                          <span title="Copiar Link">
                            <Button variant="secondary" size="sm" onClick={() => {
                              const link = `${window.location.origin}/fornecedor/pedido/${pedido.id}`;
                              navigator.clipboard.writeText(link);
                              showSuccess('Link Copiado! 📋', 'O link do fornecedor foi copiado para a área de transferência.');
                            }}>
                              <Link className="h-4 w-4" />
                            </Button>
                          </span>
                          <span title="Excluir">
                            <Button variant="danger" size="sm" onClick={() => handleDeletePedido(pedido)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {(!pedidos || pedidos.length === 0) && pecas.length > 0 && fornecedores.length > 0 && (
          <Card>
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum pedido criado</h3>
              <p className="text-gray-600 mb-6">
                Crie seu primeiro pedido para começar a gerenciar sua produção
              </p>
              <div className="flex justify-center space-x-3">
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.json,.html,.htm"
                    onChange={handleFileImport}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={importing}
                  />
                  <Button variant="secondary" loading={importing} disabled={importing}>
                    <Upload className="mr-2 h-4 w-4" />
                    {importing ? 'Processando...' : 'Importar Arquivo'}
                  </Button>
                </div>

                <Button onClick={() => setShowForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Pedido
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Modal de Detalhes */}
        <DetalhesModal
          pedido={selectedPedido}
          onClose={() => setSelectedPedido(null)}
        />

        {/* Modal de Progresso da Importação */}
        <ImportProgressModal
          isOpen={showProgressModal}
          fileName={importProgress ? 'Arquivo de pedidos' : ''}
          progress={importProgress ? (importProgress.current / importProgress.total) * 100 : 0}
          currentStep={importProgress?.step || 'Processando...'}
          itemsProcessed={importProgress?.current || 0}
          totalItems={importProgress?.total || 0}
        />

        {/* Modal de Resultado da Importação */}
        <ImportResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          result={importResult}
        />

        {/* Modal de Confirmação de Exclusão */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Confirmar Exclusão"
          message="Tem certeza que deseja excluir este pedido? Esta ação só será possível se nenhuma etapa de fabricação foi iniciada."
          confirmText="Excluir Pedido"
          cancelText="Cancelar"
          onConfirm={confirmDeletePedido}
          onCancel={() => setShowDeleteConfirm(false)}
          variant="danger"
        />
      </div>
    </Layout>
  );
}

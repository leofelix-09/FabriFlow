import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Package, Calendar, User, Upload, CheckCircle, Clock, AlertCircle, FileText, X, Eye, Download, Image as ImageIcon } from 'lucide-react';
import { useRealTimeUpdates } from '@/react-app/hooks/useRealTimeUpdates';
import ConfirmModal from '@/react-app/components/ConfirmModal';
import { useNotifications } from '@/react-app/hooks/useNotifications';
import { useNotificationContext } from '@/react-app/components/NotificationProvider';
import NotificationCenter from '@/react-app/components/NotificationCenter';
import Button from '@/react-app/components/Button';

interface Pedido {
  id: number;
  peca_nome: string;
  fornecedor_nome: string;
  fornecedor_email: string;
  data_entrega: string;
  status: string;
  created_at: string;
  etapas: EtapaPedido[];
  peca_id: number;
  desenho_tecnico_url?: string;
}

interface EtapaPedido {
  id: number;
  nome: string;
  ordem: number;
  status: string;
  comprovante_url?: string;
  is_aprovado: boolean;
}

interface ArquivoInfo {
  nome: string;
  tipo: string;
  tamanho: number;
  url: string;
}

interface DesenhoInfo {
  id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  tamanho: number;
  created_at: string;
  url: string;
}

function FilePreview({ arquivo }: { arquivo: ArquivoInfo }) {
  const isImage = arquivo.tipo.startsWith('image/');
  const isPDF = arquivo.tipo === 'application/pdf';

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-blue-50 p-4">
      <div className="flex items-start space-x-3">
        {/* Miniatura/Ícone */}
        <div className="flex-shrink-0 w-16 h-16 bg-blue-100 flex items-center justify-center overflow-hidden">
          {isImage ? (
            <img
              src={arquivo.url}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling!.classList.remove('hidden');
              }}
            />
          ) : isPDF ? (
            <FileText className="h-8 w-8 text-red-400" />
          ) : (
            <FileText className="h-8 w-8 text-gray-400" />
          )}
          <div className="hidden">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        {/* Informações do arquivo */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {arquivo.nome}
          </p>
          <p className="text-xs text-gray-600">
            {formatFileSize(arquivo.tamanho)}
          </p>
          <p className="text-xs text-gray-500 capitalize">
            {arquivo.tipo.split('/')[1] || 'arquivo'}
          </p>
        </div>

        {/* Ações */}
        <div className="flex-shrink-0 flex items-center space-x-2">
          <a
            href={arquivo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            title="Visualizar arquivo"
          >
            <Eye className="h-4 w-4" />
          </a>
          <a
            href={arquivo.url}
            download={arquivo.nome}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            title="Baixar arquivo"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PainelFornecedor() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const [loading, setLoading] = useState(false);
  const [uploadingEtapa, setUploadingEtapa] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [etapaToDeleteComprovante, setEtapaToDeleteComprovante] = useState<number | null>(null);
  const [arquivosInfo, setArquivosInfo] = useState<Record<number, ArquivoInfo>>({});
  const [activeTab, setActiveTab] = useState<'etapas' | 'desenho'>('etapas');
  const [desenhos, setDesenhos] = useState<DesenhoInfo[]>([]);
  const [isLoadingDesenhos, setIsLoadingDesenhos] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [desenhoSelecionado, setDesenhoSelecionado] = useState<any>(null);

  const { notifications, addNotification, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const { showSuccess, showError, showInfo } = useNotificationContext();

  // Usar atualizações em tempo real para o pedido
  const { data: pedido, refetch } = useRealTimeUpdates<Pedido>({
    endpoint: `/api/fornecedor/pedido/${pedidoId}`,
    interval: 3000,
    onUpdate: (newData) => {
      if (newData && pedido) {
        // Detectar mudanças e notificar
        const statusChanged = newData.status !== pedido.status;
        if (statusChanged) {
          addNotification({
            type: 'info',
            title: 'Status do Pedido Atualizado',
            message: `O pedido #${newData.id} foi atualizado para: ${newData.status}`
          });
        }

        // Verificar aprovações de etapas
        newData.etapas?.forEach((etapa: EtapaPedido) => {
          const etapaAnterior = pedido.etapas?.find(e => e.id === etapa.id);
          if (etapaAnterior && !etapaAnterior.is_aprovado && etapa.is_aprovado) {
            addNotification({
              type: 'success',
              title: 'Etapa Aprovada',
              message: `A etapa "${etapa.nome}" foi aprovada pelo gestor`
            });
          }
        });
      }
    }
  });

  // Buscar desenhos técnicos
  const buscarDesenhos = async () => {
    if (!pedido?.peca_id) return;

    setIsLoadingDesenhos(true);
    try {
      const response = await fetch(`/api/fornecedor/peca/${pedido.peca_id}/desenhos`);
      if (response.ok) {
        const data = await response.json();
        setDesenhos(data || []);
      } else {
        setDesenhos([]);
      }
    } catch (error) {
      console.error('Erro ao buscar desenhos técnicos:', error);
      setDesenhos([]);
    } finally {
      setIsLoadingDesenhos(false);
    }
  };

  useEffect(() => {
    if (pedidoId) {
      buscarDesenhos();
    }
  }, [pedido?.peca_id]);

  useEffect(() => {
    if (pedido && pedido.etapas) {
      // Carregar informações dos arquivos para etapas com comprovantes
      const etapasComComprovante = pedido.etapas.filter((etapa: EtapaPedido) => etapa.comprovante_url);
      etapasComComprovante.forEach(etapa => {
        loadArquivoInfo(etapa.id);
      });
    }
  }, [pedido]);

  const loadArquivoInfo = async (etapaId: number) => {
    try {
      const response = await fetch(`/api/comprovante/${etapaId}/info`);
      if (response.ok) {
        const info = await response.json();
        setArquivosInfo(prev => ({
          ...prev,
          [etapaId]: info
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar info do arquivo:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleVisualizarDesenho = async (desenho: any) => {
    try {
      // Construir URL completa baseada no tipo de desenho
      let url;
      if (desenho.id === 'legacy') {
        url = `/api/fornecedor/peca/${pedido?.peca_id}/desenho/legacy`;
      } else {
        url = `/api/fornecedor/desenhos/${desenho.id}`;
      }

      // Para PDFs, sempre abrir em nova aba
      if (desenho.tipo_arquivo === 'application/pdf') {
        const fullUrl = `${window.location.origin}${url}`;
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Para imagens, mostrar no modal
        setDesenhoSelecionado({
          ...desenho,
          url: url
        });
        setShowImageModal(true);
      }
    } catch (error) {
      console.error('Erro ao visualizar desenho:', error);
      showError('Ops! 😕', 'Não conseguimos abrir o arquivo. Tente novamente.');
    }
  };

  const handleBaixarDesenho = async (desenho: any) => {
    try {
      // Construir URL completa baseada no tipo de desenho
      let url;
      if (desenho.id === 'legacy') {
        url = `/api/fornecedor/peca/${pedido?.peca_id}/desenho/legacy`;
      } else {
        url = `/api/fornecedor/desenhos/${desenho.id}`;
      }

      const fullUrl = `${window.location.origin}${url}`;

      // Fazer download do arquivo
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error('Falha no download');
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = desenho.nome_arquivo || 'arquivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Limpar URL do objeto após uso
      URL.revokeObjectURL(downloadUrl);

      showSuccess('Download Pronto! 📥', 'O arquivo foi baixado com sucesso.');
    } catch (error) {
      console.error('Erro ao baixar desenho:', error);
      showError('Falha no Download ⚠️', 'Não conseguimos baixar o arquivo. Tente novamente.');
    }
  };

  const alterarStatusEtapa = async (etapaId: number, novoStatus: string) => {
    console.log('[Alterar Status] Iniciando:', { etapaId, novoStatus });
    setLoading(true);
    try {
      const response = await fetch(`/api/fornecedor/alterar-status-etapa/${etapaId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: novoStatus
        })
      });

      console.log('[Alterar Status] Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('[Alterar Status] Sucesso, fazendo refetch...', result);
        await refetch();
        console.log('[Alterar Status] Refetch concluído');
        showSuccess('Status Atualizado! 🔄', `O status da etapa mudou para "${novoStatus}".`);
      } else {
        const error = await response.json();
        console.error('[Alterar Status] Erro da API:', error);
        showError('Algo deu errado ⚠️', error.error || 'Não foi possível alterar o status.');
      }
    } catch (error) {
      console.error('[Alterar Status] Erro de conexão:', error);
      showError('Sem Conexão 📶', 'Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, etapaId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingEtapa(etapaId);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/fornecedor/upload-comprovante/${etapaId}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await refetch();
        showSuccess('Comprovante Recebido! 📄', 'O comprovante foi enviado e aguarda aprovação.');
      } else {
        const error = await response.json();
        showError('Falha no Envio 📤', error.error || 'Não conseguimos enviar o comprovante.');
      }
    } catch (err) {
      showError('Falha no Envio 📤', 'Não conseguimos enviar o comprovante. Tente novamente.');
    } finally {
      setUploadingEtapa(null);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleRemoveFile = (etapaId: number) => {
    setEtapaToDeleteComprovante(etapaId);
    setShowDeleteConfirm(true);
  };

  const confirmRemoveFile = async () => {
    if (!etapaToDeleteComprovante) return;

    try {
      const response = await fetch(`/api/fornecedor/remover-comprovante/${etapaToDeleteComprovante}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setArquivosInfo(prev => {
          const newInfo = { ...prev };
          delete newInfo[etapaToDeleteComprovante];
          return newInfo;
        });
        refetch();
        showInfo('Comprovante Removido', 'O comprovante foi removido com sucesso');
      } else {
        showError('Algo deu errado ⚠️', 'Não foi possível remover o comprovante.');
      }
    } catch (error) {
      showError('Algo deu errado ⚠️', 'Não foi possível remover o comprovante.');
    } finally {
      setShowDeleteConfirm(false);
      setEtapaToDeleteComprovante(null);
    }
  };

  const getEtapaStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'concluída':
      case 'concluido':
        return 'text-success-600 bg-success-50';
      case 'aguardando aprovação':
        return 'text-warning-600 bg-warning-50';
      case 'fabricando':
        return 'text-blue-600 bg-blue-50';
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
      case 'fabricando':
        return <Package className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  if (!pedido && !loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center font-poppins">
        <div className="max-w-md w-full mx-4 bg-white rounded-xl p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Pedido não encontrado
            </h2>
            <p className="text-gray-600">
              Verifique se o link está correto ou entre em contato com o solicitante.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center font-poppins">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-700">Carregando pedido...</p>
        </div>
      </div>
    );
  }

  const dataEntrega = new Date(pedido.data_entrega);
  const isAtrasado = dataEntrega < new Date() && pedido.status !== 'Concluído';

  return (
    <div className="min-h-screen bg-[#f7f7f7] font-poppins">
      {/* Header com Notificações */}
      <div className="p-4 flex justify-end">
        <NotificationCenter
          notifications={notifications}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onRemove={removeNotification}
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header do Pedido */}
        <div className="mb-8">
          <div className="bg-white rounded-xl p-8">
            <div className="flex items-center mb-6">
              <div className="p-4 bg-blue-100 mr-6">
                <Package className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Pedido #{pedido.id}</h1>
                <p className="text-gray-600 text-xl">{pedido.peca_nome}</p>
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-lg p-6">
                <div className="flex items-center">
                  <User className="h-6 w-6 text-blue-600 mr-4" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Fornecedor</p>
                    <p className="font-semibold text-blue-900">{pedido.fornecedor_nome}</p>
                  </div>
                </div>
              </div>

              <div className={`rounded-lg p-6 ${isAtrasado ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex items-center">
                  <Calendar className={`h-6 w-6 mr-4 ${isAtrasado ? 'text-red-600' : 'text-green-600'}`} />
                  <div>
                    <p className={`text-sm font-medium ${isAtrasado ? 'text-red-800' : 'text-green-800'}`}>Prazo de Entrega</p>
                    <p className={`font-semibold ${isAtrasado ? 'text-red-900' : 'text-green-900'}`}>
                      {dataEntrega.toLocaleDateString('pt-BR')}
                      {isAtrasado && ' (Atrasado)'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-6">
                <div className="flex items-center">
                  <Package className="h-6 w-6 text-purple-600 mr-4" />
                  <div>
                    <p className="text-sm font-medium text-purple-800">Status Geral</p>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getEtapaStatusColor(pedido.status)}`}>
                      {pedido.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl mb-8">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('etapas')}
              className={`px-8 py-4 text-lg font-semibold transition-colors ${activeTab === 'etapas'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Etapas de Fabricação
            </button>
            <button
              onClick={() => setActiveTab('desenho')}
              className={`px-8 py-4 text-lg font-semibold transition-colors ${activeTab === 'desenho'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Desenhos Técnicos
            </button>
          </div>
        </div>

        {/* Conteúdo das Tabs */}
        {activeTab === 'etapas' && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Etapas de Fabricação</h2>
              <p className="text-gray-600">Acompanhe o progresso do seu pedido</p>
            </div>

            {pedido.etapas.map((etapa, index) => (
              <div key={etapa.id} className="bg-white rounded-xl p-6">
                <div className="space-y-6">
                  {/* Header da Etapa */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0 w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-blue-600">{etapa.ordem}</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{etapa.nome}</h3>
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

                      {/* Botões de ação para alterar status */}
                      {etapa.status !== 'Concluída' && (
                        <div className="flex items-center space-x-2">
                          {etapa.status === 'Pendente' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => alterarStatusEtapa(etapa.id, 'Fabricando')}
                              loading={loading}
                            >
                              Iniciar Fabricação
                            </Button>
                          )}

                          {etapa.status === 'Fabricando' && !etapa.comprovante_url && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => alterarStatusEtapa(etapa.id, 'Pendente')}
                              loading={loading}
                            >
                              Voltar para Pendente
                            </Button>
                          )}

                          {etapa.status === 'Fabricando' && (
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                onChange={(e) => handleFileUpload(e, etapa.id)}
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                disabled={uploadingEtapa === etapa.id}
                              />
                              <span className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors cursor-pointer">
                                {uploadingEtapa === etapa.id ? (
                                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                ) : (
                                  <Upload className="mr-2 h-4 w-4" />
                                )}
                                {uploadingEtapa === etapa.id ? 'Enviando...' : 'Enviar Comprovante'}
                              </span>
                            </label>
                          )}

                          {etapa.is_aprovado && etapa.status !== 'Concluída' && (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => alterarStatusEtapa(etapa.id, 'Concluída')}
                              loading={loading}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Marcar como Concluída
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comprovante Atual */}
                  {etapa.comprovante_url && arquivosInfo[etapa.id] && (
                    <div className="bg-blue-50 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900 flex items-center">
                          <FileText className="h-5 w-5 mr-2 text-gray-600" />
                          Comprovante Enviado
                        </h4>
                        <button
                          onClick={() => handleRemoveFile(etapa.id)}
                          disabled={etapa.status === 'Concluída'}
                          className="px-3 py-1 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remover
                        </button>
                      </div>
                      <FilePreview arquivo={arquivosInfo[etapa.id]} />
                    </div>
                  )}

                  {/* Mensagens de Estado */}
                  {index > 0 && !pedido.etapas[index - 1]?.is_aprovado && etapa.status === 'Pendente' && (
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                        <p className="text-sm font-medium text-yellow-800">
                          Aguardando aprovação da etapa anterior para liberar esta etapa.
                        </p>
                      </div>
                    </div>
                  )}

                  {etapa.comprovante_url && !etapa.is_aprovado && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-blue-600 mr-3" />
                        <p className="text-sm font-medium text-blue-800">
                          Comprovante enviado. Aguardando aprovação do gestor.
                        </p>
                      </div>
                    </div>
                  )}

                  {etapa.status === 'Fabricando' && !etapa.comprovante_url && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <Package className="h-5 w-5 text-blue-600 mr-3" />
                        <p className="text-sm font-medium text-blue-800">
                          Etapa em fabricação. Envie um comprovante quando concluir.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Desenhos Técnicos */}
        {activeTab === 'desenho' && (
          <div className="bg-white rounded-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Desenhos Técnicos</h2>
              <p className="text-gray-600">Visualize os desenhos técnicos da peça</p>
            </div>

            {isLoadingDesenhos ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando desenhos técnicos...</p>
              </div>
            ) : desenhos.length > 0 ? (
              <div className="space-y-6">
                {desenhos.map((desenho, index) => (
                  <div key={desenho.id || index} className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          {desenho.tipo_arquivo === 'application/pdf' ? (
                            <FileText className="h-6 w-6 text-blue-600" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{desenho.nome_arquivo}</h3>
                          <p className="text-sm text-gray-600">
                            {formatFileSize(desenho.tamanho)} • {desenho.tipo_arquivo.split('/')[1]?.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleVisualizarDesenho(desenho)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </button>
                        <button
                          onClick={() => handleBaixarDesenho(desenho)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Baixar
                        </button>
                      </div>
                    </div>

                    {/* Preview para imagens */}
                    {desenho.tipo_arquivo.startsWith('image/') && (
                      <div className="mt-4">
                        <img
                          src={desenho.url}
                          alt={desenho.nome_arquivo}
                          className="max-w-full h-auto rounded-lg shadow-sm"
                          style={{ maxHeight: '400px' }}
                        />
                      </div>
                    )}

                    {/* Preview para PDFs */}
                    {desenho.tipo_arquivo === 'application/pdf' && (
                      <div className="mt-4">
                        <div className="bg-red-50 rounded-lg p-8 text-center border-2 border-dashed border-red-200">
                          <FileText className="h-16 w-16 text-red-400 mx-auto mb-4" />
                          <h4 className="font-medium text-gray-900 mb-2">Documento PDF</h4>
                          <p className="text-sm text-gray-600 mb-4">
                            Clique em "Visualizar" para abrir o PDF em uma nova aba
                          </p>
                          <button
                            onClick={() => handleVisualizarDesenho(desenho)}
                            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Abrir PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-6" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  Desenhos Técnicos Não Disponíveis
                </h3>
                <p className="text-gray-600 mb-6">
                  Os desenhos técnicos desta peça ainda não foram fornecidos pelo gestor.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left max-w-lg mx-auto">
                  <p className="text-sm text-yellow-800">
                    <strong>Dica:</strong> Entre em contato com o gestor do projeto se precisar dos desenhos técnicos para prosseguir com a fabricação.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-xl p-8">
            <p className="text-sm text-gray-600">
              Pedido criado em {new Date(pedido.created_at).toLocaleDateString('pt-BR')}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Dúvidas? Entre em contato:
              <a
                href={`mailto:${pedido.fornecedor_email}`}
                className="text-blue-600 hover:text-blue-700 font-medium ml-1"
              >
                {pedido.fornecedor_email}
              </a>
            </p>
          </div>
        </div>

        {/* Modal de Imagem */}
        {showImageModal && desenhoSelecionado && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {desenhoSelecionado.nome_arquivo}
                </h3>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4">
                <img
                  src={`${window.location.origin}${desenhoSelecionado.url}`}
                  alt={desenhoSelecionado.nome_arquivo}
                  className="max-w-full h-auto rounded-lg"
                  style={{ maxHeight: '70vh' }}
                />
              </div>
              <div className="p-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => handleBaixarDesenho(desenhoSelecionado)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Arquivo
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal de Confirmação de Exclusão */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={confirmRemoveFile}
          title="Remover Comprovante"
          message="Tem certeza que deseja remover este comprovante? Esta ação não pode ser desfeita."
          confirmText="Remover"
          cancelText="Cancelar"
          variant="danger"
        />
      </div>
    </div>
  );
}

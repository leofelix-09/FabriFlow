import { useState, useRef, useEffect } from 'react';
import Button from './Button';
import { X, Package, Upload, Eye, Download, Trash2, ExternalLink } from 'lucide-react';
import { useNotificationContext } from './NotificationProvider';
import ConfirmModal from './ConfirmModal';

interface Etapa {
  id?: number;
  nome: string;
  ordem: number;
}

interface DesenhoTecnico {
  id: number;
  nome_arquivo: string;
  url: string;
  tipo_arquivo: string;
  tamanho: number;
  created_at: string;
}

interface Peca {
  id: number;
  nome: string;
  etapas: Etapa[];
  created_at: string;
  desenho_tecnico_url?: string;
  desenhos_tecnicos?: DesenhoTecnico[];
}

interface PecaDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  peca: Peca | null;
  onRefresh?: () => void;
}

export default function PecaDetailsModal({
  isOpen,
  onClose,
  peca,
  onRefresh
}: PecaDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'desenho'>('info');
  const [uploadingDrawing, setUploadingDrawing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: number; nome: string } | null>(null);
  const [desenhosTecnicos, setDesenhosTecnicos] = useState<DesenhoTecnico[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addNotification } = useNotificationContext();

  // Carregar desenhos técnicos quando o modal abrir ou a peça mudar
  useEffect(() => {
    if (isOpen && peca) {
      loadDesenhos();
    }
  }, [isOpen, peca?.id]);

  if (!isOpen || !peca) return null;

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const loadDesenhos = async () => {
    try {
      const response = await fetch(`/ api / pecas / ${peca.id}/desenhos`);
      if (response.ok) {
        const desenhos = await response.json();
        setDesenhosTecnicos(desenhos);
      } else {
        setDesenhosTecnicos([]);
      }
    } catch (error) {
      console.error('Erro ao carregar desenhos:', error);
      setDesenhosTecnicos([]);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Processar múltiplos arquivos
    const filesToProcess = Array.from(files);
    setUploadingDrawing(true);

    try {
      for (const file of filesToProcess) {
        // Validar tipo de arquivo
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
          addNotification({
            type: 'error',
            title: 'Arquivo Inválido',
            message: `${file.name}: Apenas arquivos JPG, PNG e PDF são aceitos`
          });
          continue;
        }

        // Validar tamanho do arquivo (1MB máximo para SQLite)
        if (file.size > 1 * 1024 * 1024) {
          addNotification({
            type: 'error',
            title: 'Arquivo Muito Grande',
            message: `${file.name}: O arquivo deve ter no máximo 1MB`
          });
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/pecas/${peca.id}/desenho`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();

          // Adicionar o novo desenho à lista local
          const novoDesenho: DesenhoTecnico = {
            id: result.arquivo.id,
            nome_arquivo: result.arquivo.nome_arquivo,
            url: result.arquivo.url,
            tipo_arquivo: result.arquivo.tipo_arquivo,
            tamanho: result.arquivo.tamanho,
            created_at: new Date().toISOString()
          };

          setDesenhosTecnicos(prev => [novoDesenho, ...prev]);

          addNotification({
            type: 'success',
            title: 'Desenho Enviado',
            message: `${file.name} foi enviado com sucesso`
          });
        } else {
          const errorText = await response.text();
          throw new Error(`${file.name}: ${errorText || 'Erro ao enviar arquivo'}`);
        }
      }

      // Recarregar desenhos da API para garantir dados corretos
      await loadDesenhos();

      // Atualizar dados da peça
      onRefresh?.();

    } catch (error) {
      console.error('Erro ao enviar desenho:', error);
      addNotification({
        type: 'error',
        title: 'Erro no Upload',
        message: error instanceof Error ? error.message : 'Erro ao enviar desenho técnico'
      });
    } finally {
      setUploadingDrawing(false);
      // Limpar input file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteDrawing = (desenhoId: number, nomeArquivo: string) => {
    setFileToDelete({ id: desenhoId, nome: nomeArquivo });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteDrawing = async () => {
    if (!fileToDelete) return;

    try {
      const response = await fetch(`/api/desenhos/${fileToDelete.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Remover da lista local
        setDesenhosTecnicos(prev => prev.filter(d => d.id !== fileToDelete.id));

        addNotification({
          type: 'success',
          title: 'Desenho Removido 🗑️',
          message: `${fileToDelete.nome} foi removido com sucesso`
        });

        // Atualizar dados da peça
        onRefresh?.();

      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Erro ao remover desenho');
      }
    } catch (error) {
      console.error('Erro ao remover desenho:', error);
      addNotification({
        type: 'error',
        title: 'Algo deu errado ⚠️',
        message: error instanceof Error ? error.message : 'Erro ao remover desenho técnico'
      });
    } finally {
      setShowDeleteConfirm(false);
      setFileToDelete(null);
    }
  };

  const handleViewDrawing = (url: string) => {
    window.open(url, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Package className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Detalhes da Peça</h2>
              <p className="text-sm text-gray-600">{peca.nome}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'info'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Informações
          </button>
          <button
            onClick={() => setActiveTab('desenho')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'desenho'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            Desenho Técnico
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Informações básicas */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações Gerais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nome da Peça</label>
                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{peca.nome}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data de Criação</label>
                    <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                      {formatDate(peca.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Etapas de fabricação */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Etapas de Fabricação ({(peca.etapas || []).length})
                </h3>
                <div className="space-y-3">
                  {(peca.etapas || [])
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((etapa, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {etapa.ordem}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{etapa.nome}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Status do desenho técnico apenas */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status dos Desenhos</h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  {desenhosTecnicos.length > 0 ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-success-500 rounded-full"></div>
                        <span className="text-sm font-medium text-success-600">
                          {desenhosTecnicos.length} desenho{desenhosTecnicos.length !== 1 ? 's' : ''} técnico{desenhosTecnicos.length !== 1 ? 's' : ''} disponível{desenhosTecnicos.length !== 1 ? 'eis' : ''}
                        </span>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setActiveTab('desenho')}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Desenhos
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-warning-500 rounded-full"></div>
                        <span className="text-sm font-medium text-warning-600">
                          Nenhum desenho técnico anexado
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveTab('desenho')}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'desenho' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Desenhos Técnicos ({desenhosTecnicos.length})
                  </h3>

                  <Button
                    variant="primary"
                    onClick={handleFileSelect}
                    loading={uploadingDrawing}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Adicionar Arquivos
                  </Button>
                </div>

                {desenhosTecnicos.length > 0 ? (
                  // Lista de desenhos existentes
                  <div className="space-y-4">
                    {desenhosTecnicos.map((desenho) => (
                      <div key={desenho.id} className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-center space-x-4">
                          {/* Miniatura do arquivo */}
                          <div className="flex-shrink-0">
                            {desenho.tipo_arquivo.startsWith('image/') ? (
                              <img
                                src={desenho.url}
                                alt={desenho.nome_arquivo}
                                className="w-20 h-20 object-cover rounded-lg shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => handleViewDrawing(desenho.url)}
                              />
                            ) : (
                              <div
                                className="w-20 h-20 bg-red-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-200 transition-colors"
                                onClick={() => handleViewDrawing(desenho.url)}
                              >
                                <ExternalLink className="h-8 w-8 text-red-600" />
                              </div>
                            )}
                          </div>

                          {/* Informações do arquivo */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{desenho.nome_arquivo}</h4>
                            <p className="text-sm text-gray-600">
                              {desenho.tipo_arquivo === 'application/pdf' ? 'Documento PDF' : 'Imagem'} • {formatFileSize(desenho.tamanho)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Adicionado em {formatDate(desenho.created_at)}
                            </p>
                          </div>

                          {/* Badge do tipo */}
                          <div className="flex-shrink-0">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${desenho.tipo_arquivo.startsWith('image/')
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                              }`}>
                              {desenho.tipo_arquivo.startsWith('image/') ? 'Imagem' : 'PDF'}
                            </span>
                          </div>

                          {/* Ações */}
                          <div className="flex-shrink-0 flex space-x-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleViewDrawing(desenho.url)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => window.open(desenho.url, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteDrawing(desenho.id, desenho.nome_arquivo)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Nenhum desenho
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <div className="space-y-4">
                      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Upload className="h-8 w-8 text-gray-400" />
                      </div>

                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          Adicionar Desenhos Técnicos
                        </h4>
                        <p className="text-gray-600 mb-6">
                          Faça upload de imagens (JPG, PNG) ou PDFs com os desenhos técnicos da peça
                        </p>
                      </div>

                      <Button
                        variant="primary"
                        onClick={handleFileSelect}
                        loading={uploadingDrawing}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar Arquivos
                      </Button>

                      <p className="text-xs text-gray-500 mt-4">
                        Formatos aceitos: PDF, JPG, PNG. Tamanho máximo: 1MB por arquivo. Múltiplos arquivos permitidos.
                      </p>
                    </div>
                  </div>
                )}

                {/* Input file escondido para múltiplos arquivos */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <Button onClick={onClose}>
            Fechar
          </Button>
        </div>
        {/* Modal de Confirmação de Exclusão */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Confirmar Remoção"
          message={`Tem certeza que deseja remover o arquivo "${fileToDelete?.nome}"?`}
          confirmText="Remover Arquivo"
          cancelText="Cancelar"
          onConfirm={confirmDeleteDrawing}
          onCancel={() => setShowDeleteConfirm(false)}
          variant="danger"
        />
      </div>
    </div>
  );
}

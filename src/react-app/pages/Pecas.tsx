import { useState, useEffect } from 'react';
import Layout from '@/react-app/components/Layout';
import Card from '@/react-app/components/Card';
import Button from '@/react-app/components/Button';
import Input from '@/react-app/components/Input';
import { Package, Plus, Upload, Trash2, Edit3, Eye, LayoutGrid, List } from 'lucide-react';
import { useRealTimeUpdates } from '@/react-app/hooks/useRealTimeUpdates';
import { useNotificationContext } from '@/react-app/components/NotificationProvider';
import { useExcelImport } from '@/react-app/hooks/useExcelImport';
import ImportHelp from '@/react-app/components/ImportHelp';
import ImportPreviewModal from '@/react-app/components/ImportPreviewModal';
import ImportProgressModal from '@/react-app/components/ImportProgressModal';
import ImportResultModal from '@/react-app/components/ImportResultModal';
import ConfirmModal from '@/react-app/components/ConfirmModal';
import PecaDetailsModal from '@/react-app/components/PecaDetailsModal';

interface Peca {
  id: number;
  nome: string;
  part_number?: string;
  descricao?: string;
  etapas: { nome: string; ordem: number }[];
  created_at: string;
  desenho_tecnico_url?: string;
}

interface NovaEtapa {
  nome: string;
  ordem: number;
}

export default function Pecas() {
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPeca, setEditingPeca] = useState<Peca | null>(null);
  const [nomePeca, setNomePeca] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [descricao, setDescricao] = useState('');
  const [etapas, setEtapas] = useState<NovaEtapa[]>([{ nome: '', ordem: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; step: string } | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pecaToDelete, setPecaToDelete] = useState<{ id: number; nome: string } | null>(null);
  const [selectedPeca, setSelectedPeca] = useState<Peca | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [partNumberError, setPartNumberError] = useState('');

  const { addNotification, showSuccess, showError } = useNotificationContext();
  const { importing, previewing, previewFile, importPecasData } = useExcelImport();

  const [layoutSelecionado, setLayoutSelecionado] = useState<'padrao' | 'layout2'>('padrao');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Estados para preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<{
    fileName: string;
    pecasData: any[];
    rawData: any[];
    headers: string[];
    format: any;
  } | null>(null);

  // Usar atualizações em tempo real para peças
  const { data: pecasResponse, refetch } = useRealTimeUpdates<any>({
    endpoint: '/api/pecas?limit=1000',
    interval: 5000,
    onUpdate: (newData) => {
      const newPecasList = newData?.pecas || [];
      const currentPecas = pecasResponse?.pecas || [];

      if (newPecasList.length > 0 && currentPecas.length > 0) {
        // Detectar apenas peças realmente novas comparando IDs
        const newPecas = newPecasList.filter((p: any) => !currentPecas.find((prev: any) => prev.id === p.id));

        // Só gerar notificação se houver peças verdadeiramente novas
        if (newPecas.length > 0) {
          newPecas.forEach((peca: any) => {
            addNotification({
              type: 'info',
              title: 'Nova Peça Criada',
              message: `A peça "${peca.part_number || peca.nome}" foi criada`
            });
          });
        }
      }
    }
  });

  const pecas = pecasResponse?.pecas || [];

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partNumber.trim() || !nomePeca.trim() || etapas.some(etapa => !etapa.nome.trim())) return;

    setSubmitting(true);
    setPartNumberError('');

    try {
      const url = editingPeca ? `/ api / pecas / ${editingPeca.id} ` : '/api/pecas';
      const method = editingPeca ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_number: partNumber,
          nome: nomePeca,
          descricao: descricao || null,
          etapas: etapas.map((etapa, index) => ({
            nome: etapa.nome,
            ordem: index + 1
          }))
        })
      });

      if (response.ok) {
        await refetch();
        resetForm();
        showSuccess(
          `Peça ${editingPeca ? 'Atualizada' : 'Adicionada'} ! 🧩`,
          `A peça "${nomePeca}" foi ${editingPeca ? 'atualizada' : 'adicionada'} ao catálogo.`
        );
      } else {
        const errorText = await response.text();
        if (errorText.includes('UNIQUE constraint failed') || errorText.includes('part_number') || errorText.includes('já está em uso')) {
          setPartNumberError('Este código já está em uso. Por favor, escolha outro código.');
        } else {
          throw new Error(errorText);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar peça:', error);
      const action = editingPeca ? 'atualizar' : 'criar';
      showError(`Algo deu errado ⚠️`, error instanceof Error ? error.message : `Não foi possível ${action} a peça.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopiarEtapasDoGrupo = async (grupoPecaId: number) => {
    try {
      const response = await fetch(`/api/pecas/${grupoPecaId}/etapas`);
      if (response.ok) {
        const dbEtapas = await response.json();
        if (dbEtapas && dbEtapas.length > 0) {
          setEtapas(dbEtapas.map((e: any) => ({
            nome: e.nome,
            como_evidenciar: e.como_evidenciar,
            prazo_minimo: e.prazo_minimo,
            prazo_maximo: e.prazo_maximo
          })));
          showSuccess('Etapas copiadas!', 'As etapas do grupo selecionado foram aplicadas com sucesso.');
        } else {
          showError('Aviso', 'O grupo selecionado não possui etapas cadastradas.');
        }
      }
    } catch (e) {
      showError('Erro', 'Falha ao buscar as etapas do grupo.');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingPeca(null);
    setPartNumber('');
    setNomePeca('');
    setDescricao('');
    setEtapas([{ nome: '', ordem: 1 }]);
    setPartNumberError('');
  };

  const addEtapa = () => {
    setEtapas([...etapas, { nome: '', ordem: etapas.length + 1 }]);
  };

  const removeEtapa = (index: number) => {
    if (etapas.length > 1) {
      setEtapas(etapas.filter((_, i) => i !== index));
    }
  };

  const updateEtapa = (index: number, nome: string) => {
    const newEtapas = [...etapas];
    newEtapas[index].nome = nome;
    setEtapas(newEtapas);
  };

  const handleEdit = (peca: Peca) => {
    setEditingPeca(peca);
    setPartNumber(peca.part_number || '');
    setNomePeca(peca.nome);
    setDescricao(peca.descricao || '');
    setEtapas((peca.etapas || []).map(e => ({ nome: e.nome, ordem: e.ordem })));
    setShowForm(true);
  };

  const handleDelete = (pecaId: number, nomePeca: string) => {
    setPecaToDelete({ id: pecaId, nome: nomePeca });
    setShowDeleteConfirm(true);
  };

  const confirmDeletePeca = async () => {
    if (!pecaToDelete) return;

    try {
      const response = await fetch(`/api/pecas/${pecaToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await refetch();
        showSuccess('Peça Removida 🗑️', `A peça "${pecaToDelete.nome}" foi removida do catálogo.`);
      } else {
        const errorText = await response.text();
        throw new Error(errorText);
      }
    } catch (error) {
      console.error('Erro ao excluir peça:', error);
      showError('Algo deu errado ⚠️', error instanceof Error ? error.message : 'Não foi possível excluir a peça.');
    } finally {
      setShowDeleteConfirm(false);
      setPecaToDelete(null);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Prevenir múltiplas execuções
    if (importing || previewing || submitting) {
      return;
    }

    // Reset file input imediatamente
    event.target.value = '';

    try {
      console.log(`Iniciando preview do arquivo: ${file.name} - Layout: ${layoutSelecionado}`);

      const result = await previewFile(file, layoutSelecionado);

      setPreviewData({
        fileName: file.name,
        pecasData: result.pecasData,
        rawData: result.rawData,
        headers: result.headers,
        format: result.format
      });

      setShowPreviewModal(true);

    } catch (error) {
      console.error('Erro no preview:', error);
      showError('Ops! 😕', error instanceof Error ? error.message : 'Não conseguimos processar o arquivo.');
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !previewData.pecasData.length) return;

    try {
      // Fechar modal de preview e mostrar modal de progresso
      setShowPreviewModal(false);
      setShowProgressModal(true);
      setImportProgress({ current: 0, total: previewData.pecasData.length, step: 'Iniciando...' });

      const result = await importPecasData(
        previewData.pecasData,
        (progress) => {
          setImportProgress(progress);
        },
        previewData.fileName
      );

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

      // Limpar dados de preview
      setPreviewData(null);

    } catch (error) {
      console.error('Erro na importação:', error);

      // Fechar modais de progresso
      setShowProgressModal(false);
      setImportProgress(null);

      // Mostrar toast de erro
      showError('Ops! 😕', error instanceof Error ? error.message : 'Não conseguimos importar os dados.');

      setShowPreviewModal(false);
      setPreviewData(null);
    }
  };

  const handleCancelImport = () => {
    setShowPreviewModal(false);
    setPreviewData(null);
  };

  const handleViewPeca = (peca: Peca) => {
    setSelectedPeca(peca);
    setShowDetailsModal(true);
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedPeca(null);
  };

  return (
    <Layout currentPage="pecas" loading={loading}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Peças</h1>
            <p className="text-gray-600 mt-2">Gerencie suas peças e etapas de fabricação</p>
          </div>

          <div className="flex space-x-3">
            <ImportHelp />

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto mt-4 sm:mt-0">
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
            </div>

            <div className="flex items-center space-x-2 mr-2">
              <select
                value={layoutSelecionado}
                onChange={(e) => setLayoutSelecionado(e.target.value as 'padrao' | 'layout2')}
                className="block w-full px-3 py-2 rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                disabled={importing || previewing}
              >
                <option value="padrao">Layout Padrão</option>
                <option value="layout2">Layout Detalhado (Lead Time)</option>
              </select>
            </div>

            <div className="relative">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={importing || previewing}
              />
              <Button
                variant="secondary"
                loading={importing || previewing}
                disabled={importing || previewing}
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? (
                  importProgress ?
                    `Importando... ${importProgress.current}/${importProgress.total}` :
                    'Importando...'
                ) : previewing ? 'Processando...' : 'Importar Arquivo'}
              </Button>
            </div>

            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Peça
            </Button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPeca ? 'Editar Peça' : 'Nova Peça'}
              </h3>

              <Input
                label="Código (Part Number)"
                value={partNumber}
                onChange={(e) => {
                  setPartNumber(e.target.value);
                  setPartNumberError('');
                }}
                placeholder="Digite o código da peça"
                error={partNumberError}
                required
              />

              <Input
                label="Nome da Peça"
                value={nomePeca}
                onChange={(e) => setNomePeca(e.target.value)}
                placeholder="Digite o nome da peça"
                required
              />

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Descrição
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Digite uma descrição da peça (opcional)"
                  rows={3}
                  className="block w-full px-3 py-2 rounded-lg text-sm border border-gray-300 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Copiar Etapas de um Grupo Existente
                </label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onChange={(e) => {
                      if (e.target.value) handleCopiarEtapasDoGrupo(parseInt(e.target.value));
                      e.target.value = ''; // reset selection
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Selecione um grupo/peça para copiar as etapas...</option>
                    {pecas.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-primary-600 font-medium">Ao selecionar um grupo, as etapas atuais (abaixo) serão substituídas pelas etapas do grupo selecionado.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Etapas de Fabricação
                </label>

                <div className="space-y-3">
                  {etapas.map((etapa, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-600">{index + 1}</span>
                      </div>
                      <Input
                        value={etapa.nome}
                        onChange={(e) => updateEtapa(index, e.target.value)}
                        placeholder={`Etapa ${index + 1}`}
                        className="flex-1"
                        required
                      />
                      {etapas.length > 1 && (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => removeEtapa(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addEtapa}
                  className="mt-3"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Etapa
                </Button>
              </div>

              <div className="flex justify-end space-x-3">
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" loading={submitting}>
                  {editingPeca ? 'Atualizar' : 'Criar'} Peça
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Lista de Peças */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {(pecas || []).map((peca: Peca) => (
              <Card key={peca.id} className="hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="p-3 bg-primary-100 rounded-lg">
                      <Package className="h-6 w-6 text-primary-600" />
                    </div>
                    <div className="ml-4 flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate">
                        {peca.part_number}
                        <span className="text-sm font-normal text-gray-500 ml-2">
                          - {peca.nome}
                        </span>
                      </h3>
                      {peca.descricao && (
                        <p className="text-sm text-gray-600 truncate mb-1">{peca.descricao}</p>
                      )}
                      <p className="text-sm text-gray-600">
                        {(peca.etapas || []).length} etapa{(peca.etapas || []).length !== 1 ? 's' : ''} de fabricação
                      </p>
                    </div>
                  </div>
                </div>

                {/* Indicadores */}
                <div className="mb-6 flex items-center space-x-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-primary-500 rounded-full mr-2"></div>
                    {(peca.etapas || []).length} Etapas
                  </div>
                  {peca.desenho_tecnico_url && (
                    <div className="flex items-center text-sm text-success-600">
                      <div className="w-2 h-2 bg-success-500 rounded-full mr-2"></div>
                      Com Desenho
                    </div>
                  )}
                </div>

                {/* Botões de ação */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleViewPeca(peca)}
                    className="flex-1 mr-2"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>

                  <div className="flex space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(peca)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(peca.id, peca.nome)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                    <th className="px-6 py-4">Código (PN)</th>
                    <th className="px-6 py-4">Nome da Peça</th>
                    <th className="px-6 py-4">Etapas</th>
                    <th className="px-6 py-4">Desenho Técnico</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(pecas || []).map((peca: Peca) => (
                    <tr key={peca.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900 border-l-4 border-transparent hover:border-primary-500">
                        {peca.part_number}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{peca.nome}</span>
                        {peca.descricao && <p className="text-xs text-gray-500 truncate max-w-xs" title={peca.descricao}>{peca.descricao}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                          {(peca.etapas || []).length} etapa{(peca.etapas || []).length !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {peca.desenho_tecnico_url ? (
                          <span className="inline-flex items-center text-success-600 text-xs font-medium">
                            <div className="w-2 h-2 bg-success-500 rounded-full mr-1.5" />
                            Sim
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Não anexado</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end space-x-2">
                          <span title="Visualizar">
                            <Button variant="primary" size="sm" onClick={() => handleViewPeca(peca)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </span>
                          <span title="Editar">
                            <Button variant="secondary" size="sm" onClick={() => handleEdit(peca)}>
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </span>
                          <span title="Excluir">
                            <Button variant="danger" size="sm" onClick={() => handleDelete(peca.id, peca.nome)}>
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

        {(!pecas || pecas.length === 0) && (
          <Card>
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma peça cadastrada</h3>
              <p className="text-gray-600 mb-6">
                Comece criando sua primeira peça ou importe de um arquivo Excel
              </p>
              <div className="flex justify-center space-x-3">
                <ImportHelp />

                <div className="flex items-center space-x-2 mr-2">
                  <select
                    value={layoutSelecionado}
                    onChange={(e) => setLayoutSelecionado(e.target.value as 'padrao' | 'layout2')}
                    className="block w-full px-3 py-2 rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    disabled={importing || previewing}
                  >
                    <option value="padrao">Layout Padrão</option>
                    <option value="layout2">Layout Detalhado (Lead Time)</option>
                  </select>
                </div>

                <div className="relative">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={importing || previewing}
                  />
                  <Button
                    variant="secondary"
                    loading={importing || previewing}
                    disabled={importing || previewing}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {importing ? (
                      importProgress ?
                        `Importando... ${importProgress.current}/${importProgress.total}` :
                        'Importando...'
                    ) : previewing ? 'Processando...' : 'Importar Arquivo'}
                  </Button>
                </div>

                <Button onClick={() => setShowForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Peça
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Modal de Preview da Importação */}
        <ImportPreviewModal
          isOpen={showPreviewModal}
          onClose={handleCancelImport}
          onConfirm={handleConfirmImport}
          fileName={previewData?.fileName || ''}
          pecasData={previewData?.pecasData || []}
          loading={importing}
          rawData={previewData?.rawData || []}
          format={previewData?.format || {}}
          headers={previewData?.headers || []}
        />

        {/* Modal de Progresso da Importação */}
        <ImportProgressModal
          isOpen={showProgressModal}
          fileName={previewData?.fileName || ''}
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
          message={`Tem certeza que deseja excluir a peça "${pecaToDelete?.nome}"? Esta ação não pode ser desfeita.`}
          confirmText="Excluir Peça"
          cancelText="Cancelar"
          onConfirm={confirmDeletePeca}
          onCancel={() => setShowDeleteConfirm(false)}
          variant="danger"
        />

        {/* Modal de Detalhes da Peça */}
        <PecaDetailsModal
          isOpen={showDetailsModal}
          onClose={handleCloseDetailsModal}
          peca={selectedPeca}
          onRefresh={refetch}
        />
      </div>
    </Layout>
  );
}

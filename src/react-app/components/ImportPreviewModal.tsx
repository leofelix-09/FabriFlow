import Button from './Button';
import { X, FileText, Package, AlertCircle, CheckCircle } from 'lucide-react';

interface PecaPreview {
  nome: string;
  part_number: string;
  etapas: Array<{
    nome: string;
    ordem: number;
    como_evidenciar?: string;
    prazo_minimo?: number;
    prazo_maximo?: number;
  }>;
}

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fileName: string;
  pecasData: PecaPreview[];
  loading: boolean;
  rawData: any[];
  format: {
    hasNome: boolean;
    hasEtapas: boolean;
    hasNomeTarefa: boolean;
    hasCodigo: boolean;
    hasDescricao: boolean;
    hasLayout2?: boolean;
  };
  headers: string[];
}

export default function ImportPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  pecasData,
  loading,
  rawData,
  format,
  headers
}: ImportPreviewModalProps) {
  if (!isOpen) return null;

  const formatTypeText = () => {
    if (format.hasLayout2) {
      return 'Layout Detalhado (Lead Time)';
    } else if (format.hasNome && format.hasEtapas) {
      return 'Formato padrão (nome + etapas)';
    } else if (format.hasNomeTarefa || format.hasCodigo || format.hasNome) {
      return 'Formato de tarefas/código';
    } else {
      return 'Lista simples (primeira coluna como nome)';
    }
  };

  const getStatusIcon = () => {
    if (loading) {
      return <div className="animate-spin w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full" />;
    } else if (pecasData.length > 0) {
      return <CheckCircle className="h-5 w-5 text-success-600" />;
    } else {
      return <AlertCircle className="h-5 w-5 text-warning-600" />;
    }
  };

  const getStatusText = () => {
    if (loading) {
      return 'Processando arquivo...';
    } else if (pecasData.length > 0) {
      return `${pecasData.length} peça(s) detectada(s) para importação`;
    } else {
      return 'Nenhuma peça válida encontrada';
    }
  };

  const getStatusColor = () => {
    if (loading) {
      return 'text-primary-600 bg-primary-50';
    } else if (pecasData.length > 0) {
      return 'text-success-600 bg-success-50';
    } else {
      return 'text-warning-600 bg-warning-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-primary-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Preview da Importação</h2>
              <p className="text-sm text-gray-600">{fileName}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status */}
          <div className={`mb-6 p-4 rounded-lg ${getStatusColor()}`}>
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div>
                <p className="font-medium">{getStatusText()}</p>
                <p className="text-sm opacity-80">Formato detectado: {formatTypeText()}</p>
              </div>
            </div>
          </div>

          {/* Headers detectados */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Colunas Detectadas</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex flex-wrap gap-2">
                {headers.map((header, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-white text-sm font-medium text-gray-700 rounded-full"
                  >
                    {header}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Dados brutos (primeiras 5 linhas) */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Dados do Arquivo (primeiras 5 linhas)
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {headers.map((header, index) => (
                      <th key={index} className="text-left py-2 px-3 font-medium text-gray-700">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawData.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {headers.map((header, colIndex) => (
                        <td key={colIndex} className="py-2 px-3 text-gray-600">
                          {typeof row[header] === 'object' && row[header] !== null
                            ? JSON.stringify(row[header])
                            : (row[header] || '-')
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rawData.length > 5 && (
                <p className="text-xs text-gray-500 mt-2">
                  ... e mais {rawData.length - 5} linha(s)
                </p>
              )}
            </div>
          </div>

          {/* Peças que serão criadas */}
          {pecasData.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Package className="h-5 w-5 text-primary-600 mr-2" />
                Peças que Serão Criadas ({pecasData.length})
              </h3>
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {pecasData.map((peca, index) => (
                  <div key={index} className="bg-white rounded-lg p-4">
                    <div className="mb-3">
                      <h4 className="font-semibold text-gray-900 text-base flex justify-between items-center">
                        <div>
                          {peca.part_number && <span className="text-gray-500 mr-2">[{peca.part_number}]</span>}
                          {peca.nome}
                        </div>
                        {format.hasLayout2 && (
                          <div className="text-sm font-normal text-blue-700 bg-blue-50 px-3 py-1 rounded-full whitespace-nowrap">
                            Lead Time: {peca.etapas.reduce((sum, e) => sum + (e.prazo_minimo || 0), 0)} a {peca.etapas.reduce((sum, e) => sum + (e.prazo_maximo || 0), 0)} dias
                          </div>
                        )}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {peca.etapas.length} etapa{peca.etapas.length !== 1 ? 's' : ''} de fabricação
                      </p>
                    </div>

                    <div className="pt-3">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Etapas de Fabricação:</h5>
                      <div className="space-y-2">
                        {peca.etapas.map((etapa, etapaIndex) => (
                          <div
                            key={etapaIndex}
                            className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg"
                          >
                            <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {etapa.ordem}
                            </div>
                            <span className="text-sm text-gray-800 font-medium flex-1">
                              {etapa.nome}
                              {etapa.como_evidenciar && <span className="text-xs font-normal text-gray-500 ml-2 block sm:inline mt-1 sm:mt-0">- Evidência: {etapa.como_evidenciar}</span>}
                            </span>
                            {(etapa.prazo_minimo !== undefined || etapa.prazo_maximo !== undefined) && (
                              <span className="text-xs font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded-md">
                                {etapa.prazo_minimo || 0} a {etapa.prazo_maximo || 0} dias
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Resumo:</strong> {pecasData.length} peça{pecasData.length !== 1 ? 's' : ''} será{pecasData.length !== 1 ? 'ão' : ''} criada{pecasData.length !== 1 ? 's' : ''} com um total de{' '}
                  {pecasData.reduce((total, peca) => total + peca.etapas.length, 0)} etapa{pecasData.reduce((total, peca) => total + peca.etapas.length, 0) !== 1 ? 's' : ''} de fabricação.
                </p>
              </div>
            </div>
          )}

          {/* Mensagem se nenhuma peça for encontrada */}
          {!loading && pecasData.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-warning-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma Peça Válida Encontrada
              </h3>
              <p className="text-gray-600 mb-4">
                O arquivo não contém dados que possam ser convertidos em peças.
                Verifique se o formato está correto.
              </p>
              <div className="bg-yellow-50 p-4 text-left">
                <p className="text-sm text-yellow-800">
                  <strong>Formatos aceitos:</strong>
                </p>
                <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                  <li>• Colunas: <em>nome, etapas</em> (etapas separadas por ; , | ou quebra de linha)</li>
                  <li>• Colunas: <em>nome da peça, etapas de fabricação</em></li>
                  <li>• Colunas: <em>código, nome da tarefa</em> (agrupa tarefas por código)</li>
                  <li>• Lista simples: primeira coluna como nome da peça</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 bg-gray-50">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>

          <div className="flex space-x-3">
            {pecasData.length > 0 && (
              <Button onClick={onConfirm} disabled={loading}>
                Confirmar Importação ({pecasData.length} peça{pecasData.length !== 1 ? 's' : ''})
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

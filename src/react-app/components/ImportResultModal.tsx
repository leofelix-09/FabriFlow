import Button from './Button';
import { X, CheckCircle, AlertCircle, XCircle, FileText, Clock } from 'lucide-react';

interface ImportResult {
  success: boolean;
  importedCount: number;
  errorCount: number;
  skippedCount: number;
  errors: string[];
  processedItems?: Array<{
    name: string;
    status: 'success' | 'error' | 'skipped';
    message?: string;
  }>;
  processingTime?: number;
  fileName?: string;
}

interface ImportResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ImportResult | null;
}

export default function ImportResultModal({
  isOpen,
  onClose,
  result
}: ImportResultModalProps) {
  if (!isOpen || !result) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-danger-600" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-warning-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-success-600 bg-success-50';
      case 'error':
        return 'text-danger-600 bg-danger-50';
      case 'skipped':
        return 'text-warning-600 bg-warning-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getTotalItems = () => {
    return result.importedCount + result.errorCount + result.skippedCount;
  };

  const getOverallStatus = () => {
    if (result.importedCount > 0 && result.errorCount === 0) {
      return { icon: <CheckCircle className="h-6 w-6 text-success-600" />, text: 'Importação bem-sucedida!', color: 'text-success-600' };
    } else if (result.importedCount > 0 && result.errorCount > 0) {
      return { icon: <AlertCircle className="h-6 w-6 text-warning-600" />, text: 'Importação concluída com avisos', color: 'text-warning-600' };
    } else if (result.errorCount > 0) {
      return { icon: <XCircle className="h-6 w-6 text-danger-600" />, text: 'Importação falhou', color: 'text-danger-600' };
    } else {
      return { icon: <AlertCircle className="h-6 w-6 text-gray-400" />, text: 'Nenhum item processado', color: 'text-gray-600' };
    }
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-primary-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Resultado da Importação</h2>
              {result.fileName && (
                <p className="text-sm text-gray-600">{result.fileName}</p>
              )}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status geral */}
          <div className="mb-6 p-4 rounded-lg bg-gray-50">
            <div className="flex items-center space-x-3 mb-3">
              {overallStatus.icon}
              <h3 className={`text-lg font-semibold ${overallStatus.color}`}>
                {overallStatus.text}
              </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-gray-600">Total Processado</p>
                <p className="text-2xl font-bold text-gray-900">{getTotalItems()}</p>
              </div>
              
              <div className="bg-white p-3 rounded-lg">
                <p className="text-gray-600">Importados</p>
                <p className="text-2xl font-bold text-success-600">{result.importedCount}</p>
              </div>
              
              <div className="bg-white p-3 rounded-lg">
                <p className="text-gray-600">Erros</p>
                <p className="text-2xl font-bold text-danger-600">{result.errorCount}</p>
              </div>
              
              <div className="bg-white p-3 rounded-lg">
                <p className="text-gray-600">Ignorados</p>
                <p className="text-2xl font-bold text-warning-600">{result.skippedCount}</p>
              </div>
            </div>

            {result.processingTime && (
              <div className="mt-3 text-sm text-gray-600">
                Tempo de processamento: {(result.processingTime / 1000).toFixed(1)}s
              </div>
            )}
          </div>

          {/* Lista de erros principais */}
          {result.errors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <XCircle className="h-5 w-5 text-danger-600 mr-2" />
                Principais Erros Encontrados
              </h3>
              <div className="bg-danger-50 rounded-lg p-4 space-y-2">
                {result.errors.map((error, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <XCircle className="h-4 w-4 text-danger-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-danger-700">{error}</p>
                  </div>
                ))}
                {result.errorCount > result.errors.length && (
                  <p className="text-xs text-danger-600 mt-2">
                    ... e mais {result.errorCount - result.errors.length} erro(s)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Log detalhado por item */}
          {result.processedItems && result.processedItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <FileText className="h-5 w-5 text-gray-600 mr-2" />
                Log Detalhado de Processamento
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.processedItems.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg flex items-start space-x-3 ${getStatusColor(item.status)}`}
                  >
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.name}</p>
                      {item.message && (
                        <p className="text-xs mt-1 opacity-80">{item.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dicas para melhorar próximas importações */}
          {(result.errorCount > 0 || result.skippedCount > 0) && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">💡 Dicas para melhorar a importação:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                {result.errorCount > 0 && (
                  <li>• Verifique se os nomes das peças e fornecedores estão exatamente como cadastrados no sistema</li>
                )}
                {result.skippedCount > 0 && (
                  <li>• Certifique-se de que todas as linhas têm dados válidos nas colunas obrigatórias</li>
                )}
                <li>• Use datas no formato YYYY-MM-DD para evitar erros de interpretação</li>
                <li>• Remova linhas vazias ou com dados incompletos antes de importar</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <Button onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}

import ProgressBar from './ProgressBar';
import { FileText, Loader2 } from 'lucide-react';

interface ImportProgressModalProps {
  isOpen: boolean;
  fileName: string;
  progress: number; // 0-100
  currentStep: string;
  itemsProcessed: number;
  totalItems: number;
}

export default function ImportProgressModal({
  isOpen,
  fileName,
  progress,
  currentStep,
  itemsProcessed,
  totalItems
}: ImportProgressModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-primary-100 rounded-lg">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Processando Arquivo</h2>
              <p className="text-sm text-gray-600">{fileName}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <ProgressBar 
              progress={progress} 
              color="primary" 
              size="lg"
              showPercentage={true}
            />
          </div>

          {/* Status atual */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Loader2 className="h-4 w-4 text-primary-600 animate-spin" />
              <p className="text-sm font-medium text-gray-900">{currentStep}</p>
            </div>
            
            {totalItems > 0 && (
              <p className="text-xs text-gray-600">
                {itemsProcessed} de {totalItems} itens processados
              </p>
            )}
          </div>

          {/* Loading animation */}
          <div className="flex justify-center">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

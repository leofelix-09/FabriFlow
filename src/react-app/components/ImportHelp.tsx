import { useState } from 'react';
import { HelpCircle, X, FileSpreadsheet, CheckCircle } from 'lucide-react';
import Button from './Button';

interface ImportHelpProps {
  className?: string;
}

export default function ImportHelp({ className = '' }: ImportHelpProps) {
  const [showHelp, setShowHelp] = useState(false);

  if (!showHelp) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowHelp(true)}
        className={className}
      >
        <HelpCircle className="h-4 w-4 mr-2" />
        Ajuda com Importação
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <FileSpreadsheet className="h-6 w-6 text-primary-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">
                Como Importar Arquivos
              </h2>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowHelp(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                <CheckCircle className="h-5 w-5 text-success-500 mr-2" />
                Formatos Suportados
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-3">
                  O sistema detecta automaticamente o formato do seu arquivo e suporta:
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary-500 rounded-full mr-2"></div>
                    <strong>CSV/Excel - Formato Padrão:</strong> Colunas "nome" e "etapas" (etapas separadas por ponto-e-vírgula)
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary-500 rounded-full mr-2"></div>
                    <strong>CSV/Excel - Formato de Tarefas:</strong> Colunas "Código", "Nome da tarefa", etc.
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary-500 rounded-full mr-2"></div>
                    <strong>HTML:</strong> Tabelas com cabeçalhos nas colunas (primeira tabela será usada)
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary-500 rounded-full mr-2"></div>
                    <strong>JSON:</strong> Array de objetos com propriedades estruturadas
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary-500 rounded-full mr-2"></div>
                    <strong>Apenas Nomes:</strong> Lista simples de peças (etapas padrão serão criadas)
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Exemplo - Formato Padrão
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">nome</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">etapas</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 px-3 text-gray-600">Engrenagem Principal</td>
                      <td className="py-2 px-3 text-gray-600">Corte;Solda;Acabamento;Pintura</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-gray-600">Eixo Motor</td>
                      <td className="py-2 px-3 text-gray-600">Torneamento;Fresagem;Tratamento térmico</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Exemplo - Formato de Tarefas
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Código</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Nome da tarefa</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 px-3 text-gray-600">001</td>
                      <td className="py-2 px-3 text-gray-600">PREPARAÇÃO</td>
                      <td className="py-2 px-3 text-gray-600">2 dias</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-gray-600">001</td>
                      <td className="py-2 px-3 text-gray-600">SOLDA</td>
                      <td className="py-2 px-3 text-gray-600">1 dia</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-gray-600">002</td>
                      <td className="py-2 px-3 text-gray-600">MONTAGEM</td>
                      <td className="py-2 px-3 text-gray-600">3 dias</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Nota:</strong> Tarefas com o mesmo código serão agrupadas em uma única peça.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Exemplo - Formato JSON
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-gray-600 whitespace-pre-wrap">
{`[
  {
    "nome": "Engrenagem Principal",
    "etapas": "Corte;Solda;Acabamento;Pintura"
  },
  {
    "nome": "Eixo Motor", 
    "etapas": "Torneamento;Fresagem;Tratamento térmico"
  }
]`}
                </pre>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Nota:</strong> O JSON pode ser um array direto ou um objeto contendo arrays.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Dicas Importantes
              </h3>
              <div className="bg-blue-50 rounded-lg p-4">
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 mt-2"></div>
                    Para CSV/Excel: Certifique-se de que a primeira linha contém os cabeçalhos das colunas
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 mt-2"></div>
                    Use arquivos .csv, .xlsx, .xls, .json, .html ou .htm
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 mt-2"></div>
                    Para HTML: A primeira tabela encontrada será usada para importação
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 mt-2"></div>
                    No formato padrão, separe etapas com ponto-e-vírgula (;)
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 mt-2"></div>
                    Para JSON: Use estrutura válida com arrays ou objetos
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 mt-2"></div>
                    Linhas em branco ou com dados incompletos serão ignoradas
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={() => setShowHelp(false)}>
              Entendi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

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

interface PecaData {
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

export function useExcelImport() {
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const detectFileFormat = (headers: string[]) => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    return {
      hasNome: normalizedHeaders.some(h =>
        ['nome', 'name', 'peça', 'peca', 'produto', 'item', 'nome da peça', 'nome da peca'].includes(h) ||
        h.includes('nome') && (h.includes('peça') || h.includes('peca') || h.includes('produto'))
      ),
      hasEtapas: normalizedHeaders.some(h =>
        ['etapas', 'processos', 'stages', 'steps', 'fases', 'etapas de fabricação', 'etapas de fabricacao'].includes(h) ||
        (h.includes('etapa') && (h.includes('fabricação') || h.includes('fabricacao'))) ||
        h === 'etapas de fabricação' || h === 'etapas de fabricacao'
      ),
      hasNomeTarefa: normalizedHeaders.some(h =>
        ['nome da tarefa', 'nome_tarefa', 'tarefa', 'task', 'atividade'].includes(h)
      ),
      hasCodigo: normalizedHeaders.some(h =>
        ['código', 'codigo', 'code', 'id', 'ref', 'referencia', 'part number', 'part_number'].includes(h)
      ),
      hasDescricao: normalizedHeaders.some(h =>
        ['descrição', 'descricao', 'description', 'obs', 'observacao'].includes(h)
      ),
      hasLayout2: normalizedHeaders.some(h =>
        h.includes('evidenciar') || h.includes('mínimo') || h.includes('minimo') || h.includes('máximo') || h.includes('maximo')
      )
    };
  };

  const findBestHeaderMatch = (headers: string[], candidates: string[]) => {
    const normalizedHeaders = headers.map((h, index) => ({ original: h, normalized: h.toLowerCase().trim(), index }));
    const normalizedCandidates = candidates.map(c => c.toLowerCase().trim());

    console.log('Procurando match para:', candidates, 'nos headers:', headers);

    // Busca exata primeiro
    for (const candidate of normalizedCandidates) {
      const exactMatch = normalizedHeaders.find(h => h.normalized === candidate);
      if (exactMatch) {
        console.log('Match exato encontrado:', exactMatch.original, 'para', candidate);
        return exactMatch.original;
      }
    }

    // Busca por inclusão
    for (const candidate of normalizedCandidates) {
      const includesMatch = normalizedHeaders.find(h =>
        h.normalized.includes(candidate) || candidate.includes(h.normalized)
      );
      if (includesMatch) {
        console.log('Match por inclusão encontrado:', includesMatch.original, 'para', candidate);
        return includesMatch.original;
      }
    }

    // Busca específica para etapas de fabricação
    const etapasCandidates = ['etapas de fabricação', 'etapas de fabricacao', 'etapas', 'processos', 'stages', 'fases'];
    for (const etapaCandidate of etapasCandidates) {
      const etapaMatch = normalizedHeaders.find(h =>
        h.normalized.includes(etapaCandidate) || etapaCandidate.includes(h.normalized)
      );
      if (etapaMatch && candidates.some(c => c.toLowerCase().includes('etapa'))) {
        console.log('Match específico para etapas encontrado:', etapaMatch.original);
        return etapaMatch.original;
      }
    }

    // Busca por palavras-chave gerais
    for (const candidate of normalizedCandidates) {
      const words = candidate.split(' ');
      const keywordMatch = normalizedHeaders.find(h =>
        words.some(word => word.length > 3 && h.normalized.includes(word))
      );
      if (keywordMatch) {
        console.log('Match por palavra-chave encontrado:', keywordMatch.original, 'para', candidate);
        return keywordMatch.original;
      }
    }

    console.log('Nenhum match encontrado para:', candidates);
    return null;
  };

  const processLayout2Format = (data: any[], headers: string[]): PecaData[] => {
    console.log('Processando formato Layout 2 com headers:', headers);

    const itemField = findBestHeaderMatch(headers, ['item', 'nome', 'peça', 'produto']);
    const etapasField = findBestHeaderMatch(headers, ['etapas de fabricação', 'etapas', 'processo']);
    const evidenciaField = findBestHeaderMatch(headers, ['como evidenciar', 'como evidenciar?', 'evidência', 'evidenciar']);
    const minimoField = findBestHeaderMatch(headers, ['mínimo', 'minimo', 'min', 'prazo minimo']);
    const maximoField = findBestHeaderMatch(headers, ['máximo', 'maximo', 'max', 'prazo maximo']);

    const pecas: PecaData[] = [];
    let currentPeca: PecaData | null = null;
    let ordemAtual = 1;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      let nomeItem = itemField ? cleanText(row[itemField]) : '';

      // Se tiver nomeItem, inicia uma nova peça
      if (nomeItem && nomeItem !== '-') {
        currentPeca = {
          nome: nomeItem,
          part_number: nomeItem, // Layout 2 usa o grupo/item como identificador (Nome e Código iguais)
          etapas: []
        };
        pecas.push(currentPeca);
        ordemAtual = 1;
      }

      if (currentPeca && etapasField && row[etapasField]) {
        const nomeEtapa = cleanText(row[etapasField]);
        // Ignorar a etapa se for a linha de "TOTAL"
        if (nomeEtapa && nomeEtapa !== '-' && !nomeEtapa.toLowerCase().startsWith('total')) {
          const minimo = minimoField ? parseInt(row[minimoField]) : NaN;
          const maximo = maximoField ? parseInt(row[maximoField]) : NaN;

          currentPeca.etapas.push({
            nome: nomeEtapa,
            ordem: ordemAtual++,
            como_evidenciar: evidenciaField ? cleanText(row[evidenciaField]) : undefined,
            prazo_minimo: !isNaN(minimo) ? minimo : undefined,
            prazo_maximo: !isNaN(maximo) ? maximo : undefined,
          });
        }
      }
    }

    return pecas.filter(p => p.etapas.length > 0);
  };

  const previewFile = async (file: File, layoutType?: 'padrao' | 'layout2'): Promise<{
    pecasData: PecaData[];
    rawData: any[];
    headers: string[];
    format: ReturnType<typeof detectFileFormat>;
  }> => {
    if (previewing) {
      throw new Error('Preview já em andamento');
    }

    setPreviewing(true);

    try {
      // Validar arquivo
      const validExtensions = ['csv', 'xlsx', 'xls', 'json', 'html', 'htm'];
      const fileExtension = file.name.toLowerCase().split('.').pop();

      if (!validExtensions.includes(fileExtension || '')) {
        throw new Error('Formato não suportado. Use CSV, XLSX, XLS, JSON ou HTML.');
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB
        throw new Error('Arquivo muito grande. Máximo 10MB.');
      }

      console.log(`Iniciando preview do arquivo: ${file.name}`);

      // Parse do arquivo
      const rawData = await parseFile(file);

      if (!rawData || rawData.length === 0) {
        throw new Error('Arquivo vazio ou sem dados válidos.');
      }

      // Detectar formato
      const headers = Object.keys(rawData[0]);
      const format = detectFileFormat(headers);

      console.log('Formato detectado:', format, 'Headers:', headers);

      // Processar dados baseado no formato
      let pecasData: PecaData[];

      if (layoutType === 'layout2' || (!layoutType && format.hasLayout2)) {
        console.log('Processando como Layout Detalhado (Lead Time)');
        pecasData = processLayout2Format(rawData, headers);
      } else if (format.hasNome && format.hasEtapas) {
        console.log('Processando como formato padrão (nome + etapas)');
        pecasData = processStandardFormat(rawData, headers);
      } else if (format.hasNomeTarefa || format.hasCodigo || format.hasNome) {
        console.log('Processando como formato de tarefas/código');
        pecasData = processTaskFormat(rawData, headers);
      } else {
        console.log('Processando como lista simples (primeira coluna como nome)');
        pecasData = processStandardFormat(rawData, headers);
      }

      console.log(`${pecasData.length} peça(s) encontrada(s) para preview`);

      return {
        pecasData,
        rawData,
        headers,
        format
      };

    } finally {
      setPreviewing(false);
    }
  };

  const cleanText = (text: any): string => {
    if (!text) return '';
    if (typeof text === 'object') {
      return JSON.stringify(text);
    }
    return text.toString().trim().replace(/\s+/g, ' ');
  };

  const parseHtmlFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const htmlContent = e.target?.result as string;
          if (!htmlContent) {
            reject(new Error('Erro ao ler arquivo HTML'));
            return;
          }

          // Criar um DOM parser
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');

          // Buscar todas as tabelas no documento
          const tables = doc.querySelectorAll('table');

          if (tables.length === 0) {
            reject(new Error('Nenhuma tabela encontrada no arquivo HTML'));
            return;
          }

          // Usar a primeira tabela encontrada
          const table = tables[0];
          const rows = table.querySelectorAll('tr');

          if (rows.length < 2) {
            reject(new Error('Tabela HTML deve ter pelo menos uma linha de cabeçalho e uma linha de dados'));
            return;
          }

          // Extrair cabeçalhos da primeira linha
          const headerRow = rows[0];
          const headerCells = headerRow.querySelectorAll('th, td');
          const headers = Array.from(headerCells).map(cell =>
            cell.textContent?.trim() || ''
          ).filter(header => header);

          if (headers.length === 0) {
            reject(new Error('Nenhum cabeçalho válido encontrado na tabela HTML'));
            return;
          }

          // Extrair dados das linhas subsequentes
          const dataRows = Array.from(rows).slice(1);
          const processedData = dataRows
            .map(row => {
              const cells = row.querySelectorAll('td, th');
              const rowData: any = {};

              headers.forEach((header, index) => {
                const cell = cells[index];
                const cellText = cell?.textContent?.trim() || '';
                rowData[header] = cellText;
              });

              return rowData;
            })
            .filter(row => {
              // Filtrar linhas vazias
              return Object.values(row).some(value =>
                typeof value === 'string' && value.length > 0
              );
            });

          console.log('HTML parsed:', processedData.length, 'rows from table');
          resolve(processedData);

        } catch (error) {
          console.error('Erro ao processar HTML:', error);
          reject(new Error(`Erro ao processar arquivo HTML: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler arquivo HTML'));
      };

      reader.readAsText(file, 'UTF-8');
    });
  };

  const parseFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const fileExtension = file.name.toLowerCase().split('.').pop();

      if (fileExtension === 'html' || fileExtension === 'htm') {
        parseHtmlFile(file).then(resolve).catch(reject);
      } else if (fileExtension === 'json') {
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            let jsonContent = e.target?.result as string;
            if (!jsonContent) {
              reject(new Error('Erro ao ler arquivo JSON'));
              return;
            }

            // Limpar conteúdo JSON - remover blocos de código markdown se existirem
            jsonContent = jsonContent.trim();

            // Remover blocos de código markdown (```json...``` ou ```...```)
            if (jsonContent.startsWith('```')) {
              const lines = jsonContent.split('\n');
              // Remover primeira linha se começar com ```
              if (lines[0].trim().startsWith('```')) {
                lines.shift();
              }
              // Remover última linha se for apenas ```
              if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
                lines.pop();
              }
              jsonContent = lines.join('\n').trim();
            }

            // Tentar parsing do JSON limpo
            const jsonData = JSON.parse(jsonContent);
            console.log('JSON parsed:', jsonData);

            // Se for um array, usar diretamente
            if (Array.isArray(jsonData)) {
              // Normalizar dados do array para garantir que não há objetos aninhados complexos
              const normalizedData = jsonData.map(item => {
                if (typeof item === 'object' && item !== null) {
                  const normalized: any = {};
                  Object.entries(item).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null) {
                      // Converter objetos/arrays aninhados para string
                      normalized[key] = JSON.stringify(value);
                    } else {
                      normalized[key] = value;
                    }
                  });
                  return normalized;
                }
                return item;
              });
              resolve(normalizedData);
            } else if (jsonData && typeof jsonData === 'object') {
              // Se for um objeto, tentar encontrar um array dentro dele
              const possibleArrays = Object.values(jsonData).filter(value => Array.isArray(value));
              if (possibleArrays.length > 0) {
                const selectedArray = possibleArrays[0] as any[];
                // Normalizar dados do array
                const normalizedData = selectedArray.map(item => {
                  if (typeof item === 'object' && item !== null) {
                    const normalized: any = {};
                    Object.entries(item).forEach(([key, value]) => {
                      if (typeof value === 'object' && value !== null) {
                        normalized[key] = JSON.stringify(value);
                      } else {
                        normalized[key] = value;
                      }
                    });
                    return normalized;
                  }
                  return item;
                });
                resolve(normalizedData);
              } else {
                // Se não tiver arrays, transformar o objeto em um array de um elemento
                const normalized: any = {};
                Object.entries(jsonData).forEach(([key, value]) => {
                  if (typeof value === 'object' && value !== null) {
                    normalized[key] = JSON.stringify(value);
                  } else {
                    normalized[key] = value;
                  }
                });
                resolve([normalized]);
              }
            } else {
              reject(new Error('Formato JSON inválido. Esperado array ou objeto.'));
            }
          } catch (error) {
            console.error('Erro ao processar JSON:', error);
            console.error('Conteúdo que causou erro:', (e.target?.result as string)?.slice(0, 200) + '...');

            if (error instanceof SyntaxError) {
              reject(new Error(`Arquivo JSON inválido. Verifique se o formato está correto. Erro: ${error.message}`));
            } else {
              reject(new Error(`Erro ao processar arquivo JSON: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
            }
          }
        };

        reader.onerror = () => {
          reject(new Error('Erro ao ler arquivo JSON'));
        };

        reader.readAsText(file, 'UTF-8');
      } else if (fileExtension === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          transformHeader: (header) => header.trim(),
          complete: (results) => {
            console.log('CSV parsed:', results.data?.length, 'rows');
            resolve(results.data);
          },
          error: reject
        });
      } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            const arrayBuffer = e.target?.result;
            if (!arrayBuffer) {
              reject(new Error('Erro ao ler arquivo'));
              return;
            }

            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];

            if (!firstSheetName) {
              reject(new Error('Arquivo Excel vazio ou sem planilhas'));
              return;
            }

            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
              defval: '',
              blankrows: false
            });

            if (!jsonData || jsonData.length < 2) {
              reject(new Error('Arquivo sem dados válidos'));
              return;
            }

            // Find the correct header row (often it's not the first row due to titles/merged cells)
            let headerRowIndex = 0;
            let maxFilledCols = 0;

            for (let i = 0; i < Math.min(5, jsonData.length); i++) {
              const row = jsonData[i] as any[];
              if (!row) continue;
              const filledCols = row.filter(cell => cell !== '' && cell != null).length;
              const rowString = row.filter(Boolean).join(' ').toLowerCase();

              // If we see characteristic keywords, we found it
              if (
                (rowString.includes('item') || rowString.includes('nome') || rowString.includes('peça') || rowString.includes('código')) &&
                (rowString.includes('etapas') || rowString.includes('tarefa') || rowString.includes('mínimo') || rowString.includes('maximo') || rowString.includes('evidenciar'))
              ) {
                headerRowIndex = i;
                break;
              }

              // Fallback to the row with the most columns
              if (filledCols > maxFilledCols) {
                maxFilledCols = filledCols;
                headerRowIndex = i;
              }
            }

            // Converter array de arrays para array de objetos
            const headers = ((jsonData[headerRowIndex] || []) as string[]).map(h => (h || '').toString().trim());
            const rows = jsonData.slice(headerRowIndex + 1) as any[][];

            const processedData = rows
              .filter(row => row.some(cell => cell !== '' && cell != null))
              .map(row => {
                const obj: any = {};
                headers.forEach((header) => {
                  if (header) {
                    const colIndex = headers.indexOf(header);
                    const cellValue = row[colIndex];
                    // Garantir que valores complexos sejam convertidos para string
                    if (typeof cellValue === 'object' && cellValue !== null) {
                      obj[header] = JSON.stringify(cellValue);
                    } else {
                      obj[header] = cellValue || '';
                    }
                  }
                });
                return obj;
              });

            console.log('Excel parsed:', processedData.length, 'rows');
            resolve(processedData);
          } catch (error) {
            reject(new Error(`Erro ao processar arquivo Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
          }
        };

        reader.onerror = () => {
          reject(new Error('Erro ao ler arquivo'));
        };

        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Formato de arquivo não suportado. Use CSV, XLSX, XLS, JSON ou HTML.'));
      }
    });
  };

  const processTaskFormat = (data: any[], headers: string[]): PecaData[] => {
    console.log('Processando formato de tarefas com headers:', headers);
    console.log('Dados recebidos:', data.length, 'linhas');

    const codigoField = findBestHeaderMatch(headers, ['código', 'codigo', 'code', 'id', 'ref', 'referencia', 'part number', 'part_number']);
    const nomeField = findBestHeaderMatch(headers, ['nome da peça', 'nome da peca', 'peça', 'peca', 'produto', 'nome', 'item']);
    const etapasField = findBestHeaderMatch(headers, ['etapas de fabricação', 'etapas de fabricacao', 'etapas', 'processos', 'stages']);
    const tarefaField = findBestHeaderMatch(headers, ['nome da tarefa', 'tarefa', 'task', 'atividade']);

    console.log('Campos encontrados:', { codigoField, nomeField, etapasField, tarefaField });

    // Se tiver nome da peça e etapas, usar formato padrão
    if (nomeField && etapasField) {
      console.log('Detectado formato padrão com nome e etapas - usando processStandardFormat');
      return processStandardFormat(data, headers);
    }

    const pecasMap = new Map<string, { part_number: string, etapas: Set<string> }>();

    // Processar cada linha dos dados
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      console.log(`Processando linha ${i + 1}:`, row);

      let nomePeca = '';
      let partNumber = '';
      let etapasArray: string[] = [];

      // Determinar nome da peça e part_number
      if (nomeField && row[nomeField]) {
        nomePeca = cleanText(row[nomeField]);
      }

      if (codigoField && row[codigoField]) {
        partNumber = cleanText(row[codigoField]);
        if (!nomePeca) {
          nomePeca = `Peça ${partNumber}`;
        }
      }

      // Se não tem part_number, usar o nome como fallback
      if (!partNumber && nomePeca) {
        partNumber = nomePeca;
      }

      console.log(`Nome da peça na linha ${i + 1}: "${nomePeca}", Part Number: "${partNumber}"`);

      // Determinar etapas - primeiro tentar buscar campo de etapas
      if (etapasField && row[etapasField]) {
        const etapasStr = cleanText(row[etapasField]);
        console.log(`Etapas brutas na linha ${i + 1}:`, `"${etapasStr}"`);

        if (etapasStr) {
          etapasArray = etapasStr
            .split(/[;,|\n\r]/)
            .map(e => cleanText(e))
            .filter(e => e.length > 0);

          console.log(`Etapas processadas na linha ${i + 1}:`, etapasArray);
        }
      }

      // Se não encontrou no campo específico de etapas, tentar nome da tarefa
      if (etapasArray.length === 0 && tarefaField && row[tarefaField]) {
        const etapaNome = cleanText(row[tarefaField]);
        console.log(`Tentando usar tarefa como etapa na linha ${i + 1}: "${etapaNome}"`);
        if (etapaNome) {
          etapasArray = [etapaNome];
        }
      }

      // Se ainda não tem etapas, criar etapas padrão
      if (nomePeca && etapasArray.length === 0) {
        etapasArray = ['Preparação', 'Processamento', 'Finalização'];
        console.log(`Usando etapas padrão para "${nomePeca}" na linha ${i + 1}`);
      }

      // Adicionar peça e etapas
      if (nomePeca && etapasArray.length > 0) {
        if (!pecasMap.has(nomePeca)) {
          pecasMap.set(nomePeca, { part_number: partNumber, etapas: new Set() });
        }

        // Atualizar part_number se estiver vazio
        const currentData = pecasMap.get(nomePeca)!;
        if (!currentData.part_number && partNumber) {
          currentData.part_number = partNumber;
        }

        etapasArray.forEach(etapa => {
          if (etapa.trim()) {
            currentData.etapas.add(etapa);
            console.log(`Adicionando etapa "${etapa}" para peça "${nomePeca}"`);
          }
        });
      } else {
        console.log(`Linha ${i + 1} ignorada - nome ou etapas inválidos`);
      }
    }

    console.log('Peças extraídas:', Array.from(pecasMap.keys()));

    return Array.from(pecasMap.entries()).map(([nome, data]) => {
      const etapas = Array.from(data.etapas).map((etapaNome, index) => ({
        nome: etapaNome,
        ordem: index + 1
      }));
      console.log(`Peça final processada: "${nome}" com ${etapas.length} etapas:`, etapas.map(e => e.nome));
      return {
        nome,
        part_number: data.part_number || nome, // Fallback final para garantir que não seja vazio
        etapas
      };
    });
  };

  const processStandardFormat = (data: any[], headers: string[]): PecaData[] => {
    console.log('Processando formato padrão com headers:', headers);
    console.log('Dados recebidos:', data.length, 'linhas');

    const nomeField = findBestHeaderMatch(headers, ['nome da peça', 'nome da peca', 'nome', 'name', 'peça', 'produto', 'item']) || headers[0];
    const partNumberField = findBestHeaderMatch(headers, ['part number', 'part_number', 'código', 'codigo', 'code', 'id', 'ref', 'referencia']);
    const etapasField = findBestHeaderMatch(headers, ['etapas de fabricação', 'etapas de fabricacao', 'etapas', 'processos', 'stages', 'fases']);

    console.log('Campos encontrados no processStandardFormat:', { nomeField, partNumberField, etapasField });

    const pecas: PecaData[] = [];

    // Processar cada linha dos dados
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const nome = cleanText(row[nomeField]);
      let partNumber = partNumberField ? cleanText(row[partNumberField]) : '';

      console.log(`Processando linha ${i + 1}:`, row);
      console.log(`Nome encontrado: "${nome}", Part Number: "${partNumber}"`);

      if (!nome) {
        console.log(`Linha ${i + 1} ignorada - nome vazio`);
        continue;
      }

      // Se não tem part_number, usar o nome como fallback
      if (!partNumber) {
        partNumber = nome;
        console.log(`Usando nome como part_number para: "${nome}"`);
      }

      let etapas: Array<{ nome: string; ordem: number }> = [];

      if (etapasField && row[etapasField]) {
        const etapasStr = cleanText(row[etapasField]);
        console.log(`Etapas brutas na linha ${i + 1}:`, `"${etapasStr}"`);

        if (etapasStr) {
          etapas = etapasStr
            .split(/[;,|\n\r]/) // Separadores: ponto-vírgula, vírgula, pipe, quebra de linha
            .map(etapa => cleanText(etapa))
            .filter(etapa => etapa.length > 0)
            .map((etapa, index) => {
              console.log(`Etapa ${index + 1} processada: "${etapa}"`);
              return {
                nome: etapa,
                ordem: index + 1
              };
            });
        }
      } else {
        console.log(`Linha ${i + 1}: Campo de etapas não encontrado ou vazio`);
      }

      // Etapas padrão se não tiver especificadas
      if (etapas.length === 0) {
        console.log(`Usando etapas padrão para: "${nome}"`);
        etapas = [
          { nome: 'Preparação', ordem: 1 },
          { nome: 'Processamento', ordem: 2 },
          { nome: 'Finalização', ordem: 3 }
        ];
      }

      console.log(`Peça processada: "${nome}" com ${etapas.length} etapas:`, etapas.map(e => e.nome));
      pecas.push({
        nome,
        part_number: partNumber,
        etapas
      });
    }

    console.log('Total de peças processadas:', pecas.length);
    return pecas;
  };

  const importFromFile = async (
    file: File,
    onProgress?: (progress: { current: number; total: number; step: string }) => void
  ): Promise<ImportResult> => {
    if (importing) {
      throw new Error('Importação já em andamento');
    }

    setImporting(true);

    try {
      const startTime = Date.now();

      // Usar preview para obter dados processados
      const { pecasData, rawData } = await previewFile(file);

      if (pecasData.length === 0) {
        throw new Error('Nenhuma peça válida encontrada no arquivo. Verifique se os dados estão no formato correto.');
      }

      console.log(`${pecasData.length} peça(s) encontrada(s) para importar`);

      // Criar peças no servidor
      let importedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      const processedItems: Array<{
        name: string;
        status: 'success' | 'error' | 'skipped';
        message?: string;
      }> = [];

      const BATCH_SIZE = 3;

      for (let i = 0; i < pecasData.length; i += BATCH_SIZE) {
        const batch = pecasData.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (peca) => {
            const response = await fetch('/api/pecas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(peca)
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`${peca.nome}: ${errorText}`);
            }

            return peca.nome;
          })
        );

        batchResults.forEach((result, resultIndex) => {
          const peca = batch[resultIndex];
          if (result.status === 'fulfilled') {
            importedCount++;
            processedItems.push({
              name: peca.nome,
              status: 'success',
              message: `Importada com ${peca.etapas.length} etapa(s)`
            });
          } else {
            errorCount++;
            const errorMessage = result.reason.message;
            errors.push(errorMessage);
            processedItems.push({
              name: peca.nome,
              status: 'error',
              message: errorMessage
            });
          }
        });

        // Callback de progresso
        onProgress?.({
          current: i + batch.length,
          total: pecasData.length,
          step: `Processando peças... (${i + batch.length}/${pecasData.length})`
        });

        // Pausa entre lotes
        if (i + BATCH_SIZE < pecasData.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      return {
        success: importedCount > 0,
        importedCount,
        errorCount,
        skippedCount: rawData.length - pecasData.length,
        errors: errors.slice(0, 5),
        processedItems,
        processingTime,
        fileName: file.name
      };

    } finally {
      setImporting(false);
    }
  };

  const importPecasData = async (
    pecasData: PecaData[],
    onProgress?: (progress: { current: number; total: number; step: string }) => void,
    fileName?: string
  ): Promise<ImportResult> => {
    if (importing) {
      throw new Error('Importação já em andamento');
    }

    setImporting(true);

    try {
      const startTime = Date.now();

      // Notificar início do processamento
      onProgress?.({
        current: 0,
        total: pecasData.length,
        step: 'Iniciando importação...'
      });

      // Criar peças no servidor
      let importedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      const processedItems: Array<{
        name: string;
        status: 'success' | 'error' | 'skipped';
        message?: string;
      }> = [];

      const BATCH_SIZE = 3;

      for (let i = 0; i < pecasData.length; i += BATCH_SIZE) {
        const batch = pecasData.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (peca) => {
            const response = await fetch('/api/pecas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(peca)
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`${peca.nome}: ${errorText}`);
            }

            return peca.nome;
          })
        );

        batchResults.forEach((result, resultIndex) => {
          const peca = batch[resultIndex];
          if (result.status === 'fulfilled') {
            importedCount++;
            processedItems.push({
              name: peca.nome,
              status: 'success',
              message: `Importada com ${peca.etapas.length} etapa(s)`
            });
          } else {
            errorCount++;
            const errorMessage = result.reason.message;
            errors.push(errorMessage);
            processedItems.push({
              name: peca.nome,
              status: 'error',
              message: errorMessage
            });
          }
        });

        // Callback de progresso
        onProgress?.({
          current: i + batch.length,
          total: pecasData.length,
          step: `Processando peças... (${i + batch.length}/${pecasData.length})`
        });

        // Pausa entre lotes
        if (i + BATCH_SIZE < pecasData.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      return {
        success: importedCount > 0,
        importedCount,
        errorCount,
        skippedCount: 0,
        errors: errors.slice(0, 5),
        processedItems,
        processingTime,
        fileName
      };

    } finally {
      setImporting(false);
    }
  };

  return {
    importing,
    previewing,
    importFromFile,
    previewFile,
    importPecasData
  };
}

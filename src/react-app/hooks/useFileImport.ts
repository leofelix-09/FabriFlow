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

interface ImportOptions {
  endpoint: string;
  validateItem?: (item: any) => { isValid: boolean; errorMessage?: string };
  transformItem?: (item: any) => any;
  onProgress?: (progress: { current: number; total: number; step: string }) => void;
  autoCreatePecas?: boolean;
}

interface Peca {
  id: number;
  nome: string;
  part_number?: string;
  codigo?: string;
}

interface Fornecedor {
  id: number;
  nome: string;
  email: string;
}

export function useFileImport() {
  const [importing, setImporting] = useState(false);

  // Mapeamento específico para colunas de pedidos de fabricação
  const mapColumnHeaders = (headers: string[]): { [key: string]: string } => {
    const headerMap: { [key: string]: string } = {};

    console.log('Headers originais encontrados:', headers);

    headers.forEach(header => {
      const originalHeader = header;
      const normalizedHeader = header.toLowerCase().trim()
        .replace(/\./g, '')  // Remove pontos
        .replace(/\s+/g, ' ') // Normaliza espaços
        .replace(/\s/g, '');  // Remove todos os espaços para comparação

      console.log(`Processando header: "${originalHeader}" -> "${normalizedHeader}"`);

      // Mapear colunas específicas conforme especificação do cliente (Layout 2 e SAP)
      if (normalizedHeader === 'cen' || normalizedHeader === 'centro') {
        headerMap['centro'] = originalHeader;
      } else if (normalizedHeader === 'fornecedor') {
        headerMap['cod_fornecedor'] = originalHeader;
      } else if (normalizedHeader === 'nome') {
        headerMap['fornecedor_nome'] = originalHeader;
      } else if (normalizedHeader === 'doccompra') {
        headerMap['ordem_compra'] = originalHeader;
      } else if (normalizedHeader === 'item' || normalizedHeader === 'itm') {
        headerMap['numero_ordem'] = originalHeader;
      } else if (normalizedHeader === 'material') {
        headerMap['codigo_item'] = originalHeader;
      } else if (normalizedHeader.includes('textobreve') || normalizedHeader.includes('textobrevedematerial')) {
        headerMap['peca_nome'] = originalHeader;
      } else if (normalizedHeader === 'quantidade' || normalizedHeader.includes('quantpend')) {
        headerMap['quantidade_item'] = originalHeader;
      } else if (normalizedHeader.includes('dtestrem') || normalizedHeader.includes('dtremessa')) {
        headerMap['data_entrega'] = originalHeader;
      } else if (normalizedHeader.includes('dtped') || normalizedHeader.includes('dtcriacao') || normalizedHeader.includes('dtcriação')) {
        headerMap['data_pedido'] = originalHeader;
      } else if (normalizedHeader === 'grupodeetapas') {
        headerMap['grupo_etapas'] = originalHeader;
      }
    });

    console.log('Mapeamento de colunas criado:', headerMap);
    console.log('Headers mapeados para campos obrigatórios:');
    console.log('- peca_nome:', headerMap['peca_nome']);
    console.log('- fornecedor_nome:', headerMap['fornecedor_nome']);
    console.log('- data_entrega:', headerMap['data_entrega']);

    return headerMap;
  };

  const transformDataWithMapping = (data: any[], headerMap: { [key: string]: string }): any[] => {
    return data.map(row => {
      const transformedRow: any = {};

      // Aplicar mapeamento de colunas
      Object.entries(headerMap).forEach(([standardKey, originalHeader]) => {
        if (row[originalHeader] !== undefined) {
          transformedRow[standardKey] = row[originalHeader];
        }
      });

      // Manter colunas originais que não foram mapeadas
      Object.entries(row).forEach(([key, value]) => {
        if (!Object.values(headerMap).includes(key)) {
          transformedRow[key] = value;
        }
      });

      return transformedRow;
    });
  };

  // Função para converter datas de DD.MM.YYYY ou DD/MM/YYYY para YYYY-MM-DD
  const convertDateFormat = (dateString: string): string => {
    if (!dateString) return dateString;

    const trimmedDate = dateString.toString().trim();

    // Formato DD.MM.YYYY
    const partsDot = trimmedDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (partsDot) {
      const day = partsDot[1].padStart(2, '0');
      const month = partsDot[2].padStart(2, '0');
      const year = partsDot[3];
      return `${year}-${month}-${day}`;
    }

    // Formato DD/MM/YYYY
    const partsSlash = trimmedDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (partsSlash) {
      const day = partsSlash[1].padStart(2, '0');
      const month = partsSlash[2].padStart(2, '0');
      const year = partsSlash[3];
      return `${year}-${month}-${day}`;
    }

    // Se já está no formato YYYY-MM-DD ou outro formato, retorna como está
    return trimmedDate;
  };

  const parseHtmlTable = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const htmlContent = e.target?.result as string;
          if (!htmlContent) {
            reject(new Error('Erro ao ler arquivo HTML'));
            return;
          }

          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');
          const tables = doc.querySelectorAll('table');

          if (tables.length === 0) {
            reject(new Error('Nenhuma tabela encontrada no arquivo HTML'));
            return;
          }

          const table = tables[0];
          const rows = table.querySelectorAll('tr');

          if (rows.length < 2) {
            reject(new Error('Tabela HTML deve ter pelo menos uma linha de cabeçalho e uma linha de dados'));
            return;
          }

          const headerRow = rows[0];
          const headerCells = headerRow.querySelectorAll('th, td');
          const headers = Array.from(headerCells).map(cell =>
            cell.textContent?.trim() || ''
          ).filter(header => header);

          if (headers.length === 0) {
            reject(new Error('Nenhum cabeçalho válido encontrado na tabela HTML'));
            return;
          }

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
              return Object.values(row).some(value =>
                typeof value === 'string' && value.length > 0
              );
            });

          resolve(processedData);

        } catch (error) {
          reject(new Error(`Erro ao processar arquivo HTML: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler arquivo HTML'));
      };

      reader.readAsText(file, 'UTF-8');
    });
  };

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error('Erro ao ler arquivo Excel'));
            return;
          }

          // Ler arquivo Excel usando XLSX
          const workbook = XLSX.read(data, { type: 'array' });

          // Pegar a primeira planilha
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Converter para JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            raw: false
          });

          if (!jsonData || jsonData.length < 2) {
            reject(new Error('Planilha vazia ou sem dados válidos'));
            return;
          }

          // Converter formato de array para objeto com headers
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];

          const processedData = rows
            .filter(row => row.some(cell => cell && cell.toString().trim() !== ''))
            .map(row => {
              const rowData: any = {};
              headers.forEach((header, index) => {
                rowData[header] = row[index] || '';
              });
              return rowData;
            });

          console.log('Excel headers encontrados:', headers);
          console.log('Dados processados (amostra):', processedData.slice(0, 2));

          resolve(processedData);

        } catch (error) {
          reject(new Error(`Erro ao processar arquivo Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler arquivo Excel'));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const parseFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const fileName = file.name.toLowerCase();
      const fileExtension = fileName.split('.').pop();

      console.log('Detected file extension:', fileExtension, 'File name:', file.name);

      const processAndMapData = (rawData: any[]) => {
        if (!rawData || rawData.length === 0) {
          resolve([]);
          return;
        }

        // Obter headers e criar mapeamento
        const headers = Object.keys(rawData[0]);
        console.log('Headers encontrados:', headers);

        const headerMap = mapColumnHeaders(headers);
        console.log('Mapeamento aplicado:', headerMap);

        // Aplicar transformação de mapeamento
        const transformedData = transformDataWithMapping(rawData, headerMap);
        console.log('Dados transformados (amostra):', transformedData.slice(0, 2));

        resolve(transformedData);
      };

      if (fileExtension === 'html' || fileExtension === 'htm') {
        console.log('Processing HTML file...');
        parseHtmlTable(file)
          .then(processAndMapData)
          .catch(reject);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        console.log('Processing Excel file with XLSX...');
        parseExcelFile(file)
          .then(processAndMapData)
          .catch(reject);
      } else if (fileExtension === 'json') {
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            let jsonContent = e.target?.result as string;
            if (!jsonContent) {
              reject(new Error('Erro ao ler arquivo JSON'));
              return;
            }

            jsonContent = jsonContent.trim();

            if (jsonContent.startsWith('```')) {
              const lines = jsonContent.split('\n');
              if (lines[0].trim().startsWith('```')) {
                lines.shift();
              }
              if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
                lines.pop();
              }
              jsonContent = lines.join('\n').trim();
            }

            const jsonData = JSON.parse(jsonContent);

            let rawData: any[];
            if (Array.isArray(jsonData)) {
              rawData = jsonData;
            } else if (jsonData && typeof jsonData === 'object') {
              const possibleArrays = Object.values(jsonData).filter(value => Array.isArray(value));
              if (possibleArrays.length > 0) {
                rawData = possibleArrays[0] as any[];
              } else {
                rawData = [jsonData];
              }
            } else {
              reject(new Error('Formato JSON inválido. Esperado array ou objeto.'));
              return;
            }

            processAndMapData(rawData);
          } catch (error) {
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
        console.log('Processing CSV file...');
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          transformHeader: (header) => header.trim(),
          complete: (results) => {
            processAndMapData(results.data);
          },
          error: reject
        });
      } else {
        console.log('Unsupported file extension:', fileExtension);
        reject(new Error(`Formato de arquivo não suportado: .${fileExtension}. Use CSV, XLS, XLSX, JSON ou HTML.`));
      }
    });
  };

  const importFromFile = async (
    file: File,
    options: ImportOptions,
    currentPecas: Peca[],
    currentFornecedores: Fornecedor[]
  ): Promise<ImportResult> => {
    if (importing) {
      throw new Error('Importação já em andamento');
    }

    setImporting(true);

    try {
      const startTime = Date.now();

      // Notificar início
      options.onProgress?.({
        current: 0,
        total: 0,
        step: 'Analisando arquivo...'
      });

      // Parse do arquivo
      const rawData = await parseFile(file);

      if (!rawData || rawData.length === 0) {
        throw new Error('Arquivo vazio ou sem dados válidos.');
      }

      const normalizeForMatch = (str: string | undefined | null) => {
        if (!str) return '';
        return str.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
      };

      // Mapeia peças existentes para fácil consulta por nome e código
      const pecaNameToIdMap = new Map<string, number>();
      const pecaCodigoToIdMap = new Map<string, number>();
      const pecasWithoutEtapas = new Set<number>();
      currentPecas.forEach(p => {
        if (p.nome) pecaNameToIdMap.set(normalizeForMatch(p.nome), p.id);
        if (p.part_number) pecaCodigoToIdMap.set(normalizeForMatch(p.part_number), p.id);
        if (!(p as any).etapas || (p as any).etapas.length === 0) pecasWithoutEtapas.add(p.id);
      });

      // Mapeia fornecedores existentes para fácil consulta por nome
      const supplierNameToIdMap = new Map<string, number>();
      currentFornecedores.forEach(f => {
        if (f.nome) supplierNameToIdMap.set(normalizeForMatch(f.nome), f.id);
      });

      // Conjunto para armazenar fornecedores únicos a serem criados
      const suppliersToCreate = new Map<string, { name: string; email: string }>();

      console.log('Iniciando análise de fornecedores...');
      options.onProgress?.({
        current: 0,
        total: rawData.length,
        step: 'Identificando novos fornecedores...'
      });

      // Primeira passada: identifica todos os fornecedores que precisam ser criados
      for (const item of rawData) {
        // Tenta pegar o nome do fornecedor da coluna mapeada
        const fornecedorName = item.fornecedor_nome?.toString()?.trim();
        if (fornecedorName) {
          const normalizedName = normalizeForMatch(fornecedorName);
          // Se o fornecedor não existe no mapa e não está na lista de espera para ser criado
          if (!supplierNameToIdMap.has(normalizedName) && !suppliersToCreate.has(normalizedName)) {
            // Gera um e-mail padrão para o novo fornecedor
            const emailSanitized = normalizedName.replace(/[^a-z0-9]/g, '');
            const email = `${emailSanitized}@fabricacao.com`;
            suppliersToCreate.set(normalizedName, { name: fornecedorName, email });
            console.log(`Novo fornecedor identificado: ${fornecedorName} -> ${email}`);
          }
        }
      }

      // Processa a criação dos novos fornecedores
      if (suppliersToCreate.size > 0) {
        console.log(`Criando ${suppliersToCreate.size} novos fornecedores...`);
        options.onProgress?.({ current: 0, total: suppliersToCreate.size, step: `Criando ${suppliersToCreate.size} novos fornecedores...` });
        let createdCount = 0;

        for (const [normalizedName, supplierData] of suppliersToCreate.entries()) {
          try {
            console.log(`Criando fornecedor: ${supplierData.name}`);
            const response = await fetch('/api/fornecedores', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nome: supplierData.name,
                email: supplierData.email
              })
            });

            if (response.ok) {
              const result = await response.json();
              supplierNameToIdMap.set(normalizedName, result.id);
              createdCount++;
              console.log(`Fornecedor criado com sucesso: ${supplierData.name} (ID: ${result.id})`);
              options.onProgress?.({
                current: createdCount,
                total: suppliersToCreate.size,
                step: `Criando fornecedores... (${createdCount}/${suppliersToCreate.size})`
              });
            } else {
              const errorText = await response.text();
              console.error(`Falha ao criar fornecedor ${supplierData.name}: ${errorText}`);
            }
          } catch (err) {
            console.error(`Erro ao criar fornecedor ${supplierData.name}:`, err);
          }

          // Pequena pausa entre criações para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`Criados ${createdCount} fornecedores de ${suppliersToCreate.size} identificados`);
      }

      // --- NOVA LÓGICA: IDENTIFICAR E CRIAR PEÇAS SE autoCreatePecas ESTIVER ATIVADO ---
      options.onProgress?.({
        current: 0,
        total: rawData.length,
        step: 'Verificando peças e etapas...'
      });
      let pecasToCreateOrUpdate = new Map<string, { idToUpdate?: number; nome: string; grupo_etapas?: string; codigo?: string }>();

      if (options.autoCreatePecas) {
        for (const item of rawData) {
          const pecaName = item.peca_nome?.toString()?.trim();
          const pecaCodigo = item.codigo_item?.toString()?.trim() || "";

          if (pecaName) {
            const normalizedPecaName = normalizeForMatch(pecaName);
            const normalizedCodigo = normalizeForMatch(pecaCodigo);

            const existsByName = pecaNameToIdMap.has(normalizedPecaName);
            const existsByCode = pecaCodigo ? pecaCodigoToIdMap.has(normalizedCodigo) : false;

            const pecaIdExistente = existsByCode ? pecaCodigoToIdMap.get(normalizedCodigo) : existsByName ? pecaNameToIdMap.get(normalizedPecaName) : null;
            const needsStages = pecaIdExistente ? pecasWithoutEtapas.has(pecaIdExistente) : false;
            const grupoEtapasName = item.grupo_etapas?.toString()?.trim();

            if ((!existsByName && !existsByCode) || (needsStages && grupoEtapasName)) {
              if (!pecasToCreateOrUpdate.has(normalizedPecaName)) {
                pecasToCreateOrUpdate.set(normalizedPecaName, {
                  idToUpdate: needsStages ? (pecaIdExistente ?? undefined) : undefined,
                  nome: pecaName,
                  grupo_etapas: grupoEtapasName,
                  codigo: pecaCodigo
                });
                console.log(`Peça identificada para ${needsStages ? 'atualização de etapas' : 'criação'}: ${pecaName}`);
              }
            }
          }
        }
      }

      if (pecasToCreateOrUpdate.size > 0) {
        console.log(`Processando ${pecasToCreateOrUpdate.size} peças (novas ou sem etapas)...`);
        options.onProgress?.({ current: 0, total: pecasToCreateOrUpdate.size, step: `Processando ${pecasToCreateOrUpdate.size} peças...` });
        let processedPecasCount = 0;

        for (const [normalizedName, pecaData] of pecasToCreateOrUpdate.entries()) {
          try {
            console.log(`Processando peça: ${pecaData.nome}`);

            // Busca etapas do grupo se existir
            let etapasToClone = [
              { nome: 'Preparação', ordem: 1 },
              { nome: 'Processamento', ordem: 2 },
              { nome: 'Finalização', ordem: 3 }
            ];

            if (pecaData.grupo_etapas) {
              const grupoPecaNameStr = normalizeForMatch(pecaData.grupo_etapas);
              const grupoPeca = currentPecas.find(p => normalizeForMatch(p.nome) === grupoPecaNameStr);

              if (grupoPeca) {
                try {
                  // Fetch detalhado das etapas daquele grupo
                  const etapaResponse = await fetch(`/api/pecas/${grupoPeca.id}/etapas`);
                  if (etapaResponse.ok) {
                    const etapasGrupoData = await etapaResponse.json();
                    if (etapasGrupoData && etapasGrupoData.length > 0) {
                      etapasToClone = etapasGrupoData.map((e: any) => ({
                        nome: e.nome,
                        ordem: e.ordem,
                        como_evidenciar: e.como_evidenciar,
                        prazo_minimo: e.prazo_minimo,
                        prazo_maximo: e.prazo_maximo
                      }));
                      console.log(`Etapas clonadas do grupo '${pecaData.grupo_etapas}' para a peça '${pecaData.nome}'`);
                    }
                  }
                } catch (e) { console.error('Falhou ao buscar etapas do grupo para herdar', e); }
              } else {
                console.warn(`Grupo de etapas '${pecaData.grupo_etapas}' não encontrado no sistema. Usando etapas padrão.`);
              }
            }

            const method = pecaData.idToUpdate ? 'PUT' : 'POST';
            const endpoint = pecaData.idToUpdate ? `/api/pecas/${pecaData.idToUpdate}` : '/api/pecas';

            const response = await fetch(endpoint, {
              method: method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nome: pecaData.nome,
                part_number: pecaData.codigo || pecaData.nome,
                etapas: etapasToClone
              })
            });

            if (response.ok) {
              const result = await response.json();
              if (!pecaData.idToUpdate) {
                pecaNameToIdMap.set(normalizedName, result.id);
                if (pecaData.codigo) {
                  pecaCodigoToIdMap.set(normalizeForMatch(pecaData.codigo), result.id);
                }
              }
              if (pecaData.idToUpdate) pecasWithoutEtapas.delete(pecaData.idToUpdate);

              processedPecasCount++;
              console.log(`Peça ${pecaData.idToUpdate ? 'atualizada' : 'criada'} com sucesso: ${pecaData.nome} (ID: ${result.id || pecaData.idToUpdate})`);
              options.onProgress?.({
                current: processedPecasCount,
                total: pecasToCreateOrUpdate.size,
                step: `Processando peças... (${processedPecasCount}/${pecasToCreateOrUpdate.size})`
              });
            } else {
              const errorText = await response.text();
              console.error(`Falha ao processar peça ${pecaData.nome}: ${errorText}`);
            }
          } catch (err) {
            console.error(`Erro ao processar peça ${pecaData.nome}:`, err);
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log(`Processadas ${processedPecasCount} peças de ${pecasToCreateOrUpdate.size} identificadas`);
      }
      // --- FIM DA NOVA LÓGICA ---

      options.onProgress?.({
        current: 0,
        total: rawData.length,
        step: 'Validando dados...'
      });

      // Validar e transformar dados
      const validItems = [];
      const processedItems: Array<{
        name: string;
        status: 'success' | 'error' | 'skipped';
        message?: string;
      }> = [];

      let skippedCount = 0;

      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];

        // Aplicar transformação se fornecida
        let transformedItem = options.transformItem ? options.transformItem(item) : item;

        // Converter data se necessário
        if (transformedItem.data_entrega) {
          transformedItem.data_entrega = convertDateFormat(transformedItem.data_entrega);
        }
        if (transformedItem.data_pedido) {
          transformedItem.data_pedido = convertDateFormat(transformedItem.data_pedido);
        }

        // Resolver IDs de peça e fornecedor usando os mapas internos
        const pecaName = transformedItem.peca_nome?.toString()?.trim();
        const pecaCodigo = transformedItem.codigo_item?.toString()?.trim();
        const fornecedorName = transformedItem.fornecedor_nome?.toString()?.trim();

        if (pecaCodigo && !transformedItem.peca_id) {
          const pecaIdByCode = pecaCodigoToIdMap.get(normalizeForMatch(pecaCodigo));
          if (pecaIdByCode) {
            transformedItem.peca_id = pecaIdByCode;
          }
        }

        if (pecaName && !transformedItem.peca_id) {
          const pecaIdByName = pecaNameToIdMap.get(normalizeForMatch(pecaName));
          if (pecaIdByName) {
            transformedItem.peca_id = pecaIdByName;
          }
        }

        if (fornecedorName) {
          const fornecedorId = supplierNameToIdMap.get(normalizeForMatch(fornecedorName));
          if (fornecedorId) {
            transformedItem.fornecedor_id = fornecedorId;
          }
        }

        // Validar item
        let isValid = true;
        let errorMessage = '';

        if (options.validateItem) {
          const validation = options.validateItem(transformedItem);
          isValid = validation.isValid;
          errorMessage = validation.errorMessage || '';
        }

        // Validações obrigatórias
        if (!transformedItem.peca_id && pecaName) {
          isValid = false;
          errorMessage = `Peça "${pecaName}" não encontrada e não pôde ser criada.`;
        }

        if (!transformedItem.fornecedor_id && fornecedorName) {
          isValid = false;
          errorMessage = `Fornecedor "${fornecedorName}" não encontrado ou não pôde ser criado`;
        }

        if (!transformedItem.data_entrega) {
          isValid = false;
          errorMessage = 'Data de entrega não informada';
        }

        if (!isValid) {
          skippedCount++;
          processedItems.push({
            name: pecaName || fornecedorName || `Item ${i + 1}`,
            status: 'skipped',
            message: errorMessage || 'Dados inválidos'
          });
          continue;
        }

        validItems.push(transformedItem);
      }

      options.onProgress?.({
        current: 0,
        total: validItems.length,
        step: 'Importando dados...'
      });

      // Importar dados válidos
      let importedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      const BATCH_SIZE = 3;

      for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
        const batch = validItems.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async (item) => {
            const response = await fetch(options.endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`${item.peca_nome || 'Item'}: ${errorText}`);
            }

            return item;
          })
        );

        batchResults.forEach((result, resultIndex) => {
          const item = batch[resultIndex];
          const itemName = item.peca_nome || `Item ${i + resultIndex + 1}`;

          if (result.status === 'fulfilled') {
            importedCount++;
            processedItems.push({
              name: itemName,
              status: 'success',
              message: 'Importado com sucesso'
            });
          } else {
            errorCount++;
            const errorMessage = result.reason.message;
            errors.push(errorMessage);
            processedItems.push({
              name: itemName,
              status: 'error',
              message: errorMessage
            });
          }
        });

        // Callback de progresso
        options.onProgress?.({
          current: i + batch.length,
          total: validItems.length,
          step: `Importando... (${i + batch.length}/${validItems.length})`
        });

        // Pausa entre lotes
        if (i + BATCH_SIZE < validItems.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      return {
        success: importedCount > 0,
        importedCount,
        errorCount,
        skippedCount,
        errors: errors.slice(0, 10),
        processedItems,
        processingTime,
        fileName: file.name
      };

    } finally {
      setImporting(false);
    }
  };

  return {
    importing,
    importFromFile,
    parseFile
  };
}

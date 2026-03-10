import { useState, useEffect, useCallback } from 'react';

interface UseRealTimeUpdatesOptions {
  endpoint: string;
  interval?: number;
  onUpdate?: (data: any) => void;
}

export function useRealTimeUpdates<T = any>({
  endpoint,
  interval = 3000, // Reduzido de 5000ms para 3000ms para atualizações mais rápidas
  onUpdate
}: UseRealTimeUpdatesOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const newData = await response.json();

        // Comparar dados para detectar mudanças
        if (JSON.stringify(newData) !== JSON.stringify(data)) {
          setData(newData);
          setLastUpdate(new Date());

          // Só chamar onUpdate se não for a primeira carga
          if (!isFirstLoad) {
            onUpdate?.(newData);
          }
        }

        // Marcar que a primeira carga foi concluída
        if (isFirstLoad) {
          setIsFirstLoad(false);
        }
      } else {
        setError('Erro ao carregar dados');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [endpoint, data, onUpdate, isFirstLoad]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Buscar dados imediatamente
    fetchData();

    // Configurar polling
    const intervalId = setInterval(fetchData, interval);

    return () => clearInterval(intervalId);
  }, [fetchData, interval]);

  return {
    data,
    loading,
    error,
    lastUpdate,
    refetch
  };
}

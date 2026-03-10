import { useEffect, useRef } from 'react';
import { useNotificationContext } from '@/react-app/components/NotificationProvider';

// Hook para notificações globais independentes da página
export function useGlobalNotifications() {
  const { addNotification } = useNotificationContext();
  const processedNotifications = useRef(new Set<string>());
  const processedEvidencias = useRef(new Set<string>());
  const processedStatusChanges = useRef(new Set<string>());

  useEffect(() => {
    // Verificar notificações do sistema (principal)
    const checkNotificacoes = async () => {
      try {
        const response = await fetch('/api/notificacoes');
        if (response.ok) {
          const notificacoes = await response.json();
          notificacoes.forEach((notificacao: any) => {
            const notificationKey = `${notificacao.tipo}_${notificacao.pedido_id}_${notificacao.titulo}`;
            
            // Evitar duplicatas
            if (processedNotifications.current.has(notificationKey)) {
              return;
            }
            
            processedNotifications.current.add(notificationKey);
            
            let type = 'info';
            
            // Mapear tipo da notificação para tipo do componente
            switch (notificacao.tipo) {
              case 'comprovante_enviado':
                type = 'warning';
                break;
              case 'fabricacao_iniciada':
                type = 'info';
                break;
              case 'etapa_concluida':
                type = 'success';
                break;
              default:
                type = 'info';
            }
            
            addNotification({
              type: type as 'success' | 'warning' | 'info' | 'error',
              title: notificacao.titulo,
              message: notificacao.mensagem
            });
          });
        }
      } catch (error) {
        // Silencioso - não atrapalhar a experiência do usuário
      }
    };

    // Verificar evidências enviadas em tempo real (backup)
    const checkEvidencias = async () => {
      try {
        const response = await fetch('/api/pedidos/evidencias-recentes');
        if (response.ok) {
          const evidencias = await response.json();
          evidencias.forEach((evidencia: any) => {
            const evidenciaKey = `evidencia_${evidencia.pedido_id}_${evidencia.etapa_nome}`;
            
            // Evitar duplicatas
            if (processedEvidencias.current.has(evidenciaKey)) {
              return;
            }
            
            processedEvidencias.current.add(evidenciaKey);
            
            addNotification({
              type: 'warning',
              title: 'Nova Evidência Enviada',
              message: `Evidência enviada para Pedido #${evidencia.pedido_id} - ${evidencia.etapa_nome}`
            });
          });
        }
      } catch (error) {
        // Silencioso - não atrapalhar a experiência do usuário
      }
    };

    // Verificar status dos pedidos (backup)
    const checkPedidosStatus = async () => {
      try {
        const response = await fetch('/api/pedidos/status-changes');
        if (response.ok) {
          const changes = await response.json();
          changes.forEach((change: any) => {
            const changeKey = `status_${change.pedido_id}_${change.status}`;
            
            // Evitar duplicatas
            if (processedStatusChanges.current.has(changeKey)) {
              return;
            }
            
            processedStatusChanges.current.add(changeKey);
            
            addNotification({
              type: change.status === 'Concluído' ? 'success' : 'info',
              title: 'Status Atualizado',
              message: `Pedido #${change.pedido_id} - ${change.peca_nome}: ${change.status}`
            });
          });
        }
      } catch (error) {
        // Silencioso
      }
    };

    // Limpar sets periodicamente para evitar acúmulo de memória (a cada 5 minutos)
    const cleanupInterval = setInterval(() => {
      processedNotifications.current.clear();
      processedEvidencias.current.clear();
      processedStatusChanges.current.clear();
    }, 5 * 60 * 1000);

    // Executar verificações periodicamente - notificações do sistema têm prioridade
    const notificacoesInterval = setInterval(checkNotificacoes, 3000);
    const evidenciasInterval = setInterval(checkEvidencias, 7000);
    const statusInterval = setInterval(checkPedidosStatus, 10000);

    return () => {
      clearInterval(cleanupInterval);
      clearInterval(notificacoesInterval);
      clearInterval(evidenciasInterval);
      clearInterval(statusInterval);
    };
  }, [addNotification]);
}

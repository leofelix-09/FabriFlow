import { useState, useEffect } from 'react';
import Layout from '@/react-app/components/Layout';
import Card from '@/react-app/components/Card';
import { Package, FileText, Users, AlertCircle } from 'lucide-react';
import { useRealTimeUpdates } from '@/react-app/hooks/useRealTimeUpdates';
import { useNotificationContext } from '@/react-app/components/NotificationProvider';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalPedidos: 0,
    pedidosAndamento: 0,
    pedidosConcluidos: 0,
    pedidosAtrasados: 0,
    totalPecas: 0,
    totalFornecedores: 0,
  });
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotificationContext();

  // Usar atualizações em tempo real para pedidos recentes
  const { data: pedidosResponse } = useRealTimeUpdates<any>({
    endpoint: '/api/pedidos?days=5',
    interval: 10000,
    onUpdate: (newData) => {
      const newPedidosList = newData?.pedidos || [];
      const currentPedidos = pedidosResponse?.pedidos || [];

      if (newPedidosList.length > 0 && currentPedidos.length > 0) {
        const newPedidos = newPedidosList.filter((p: any) => !currentPedidos.find((prev: any) => prev.id === p.id));
        if (newPedidos.length > 0) {
          addNotification({
            type: 'info',
            title: 'Dashboard Atualizado',
            message: `${newPedidos.length} novo(s) pedido(s) encontrado(s)`
          });
        }
      }
    }
  });

  const pedidosRecentes = Array.isArray(pedidosResponse) ? pedidosResponse : (pedidosResponse?.pedidos || []);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const response = await fetch('/api/dashboard');

      if (response.ok) {
        const data = await response.json();

        // Se o backend retornar os totais diretamente
        if (data.totalPecas !== undefined) {
          // Buscar pedidos para calcular status (ou atualizar backend para retornar isso também)
          // Por enquanto, vamos buscar pedidos apenas para os status, mas usar o total do dashboard
          const pedidosRes = await fetch('/api/pedidos?limit=1000'); // Limit alto para pegar stats
          let pedidosAndamento = 0, pedidosConcluidos = 0, pedidosAtrasados = 0;

          if (pedidosRes.ok) {
            const pedidosData = await pedidosRes.json();
            const pedidos = Array.isArray(pedidosData) ? pedidosData : (pedidosData.pedidos || []);

            pedidosConcluidos = pedidos.filter((p: any) => p.status === 'Concluído').length;
            pedidosAndamento = pedidos.filter((p: any) => p.status === 'Em andamento' || p.status === 'Pendente').length;
            pedidosAtrasados = pedidos.filter((p: any) => {
              const dataEntrega = new Date(p.data_entrega);
              return dataEntrega < new Date() && p.status !== 'Concluído';
            }).length;
          }

          setStats({
            totalPedidos: data.totalPedidos,
            pedidosAndamento,
            pedidosConcluidos,
            pedidosAtrasados,
            totalPecas: data.totalPecas,
            totalFornecedores: data.totalFornecedores
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsDisplay = [
    {
      title: 'Total de Peças',
      value: stats.totalPecas.toString(),
      icon: Package,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50'
    },
    {
      title: 'Pedidos Ativos',
      value: stats.pedidosAndamento.toString(),
      icon: FileText,
      color: 'text-warning-600',
      bgColor: 'bg-warning-50'
    },
    {
      title: 'Fornecedores',
      value: stats.totalFornecedores.toString(),
      icon: Users,
      color: 'text-success-600',
      bgColor: 'bg-success-50'
    },
    {
      title: 'Pedidos Atrasados',
      value: stats.pedidosAtrasados.toString(),
      icon: AlertCircle,
      color: 'text-danger-600',
      bgColor: 'bg-danger-50'
    }
  ];

  const getStatusColor = (status: string, dataEntrega: string) => {
    const isAtrasado = new Date(dataEntrega) < new Date() && status !== 'Concluído';
    if (isAtrasado) return 'text-danger-600 bg-danger-50';
    if (status === 'Concluído') return 'text-success-600 bg-success-50';
    if (status === 'Em andamento') return 'text-warning-600 bg-warning-50';
    return 'text-primary-600 bg-primary-50';
  };

  return (
    <Layout currentPage="dashboard" loading={loading}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Visão geral dos seus pedidos de fabricação</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsDisplay.map((stat, index) => (
            <Card key={index}>
              <div className="flex items-center">
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Recent Orders */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Pedidos Recentes</h3>
            <a href="/pedidos" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Ver todos
            </a>
          </div>

          <div className="space-y-4">
            {(pedidosRecentes || []).map((order: any) => (
              <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{order.peca_nome}</h4>
                  <p className="text-sm text-gray-600">{order.fornecedor_nome}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">Prazo</p>
                    <p className="text-sm text-gray-600">{new Date(order.data_entrega).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status, order.data_entrega)}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}

            {(!pedidosRecentes || pedidosRecentes.length === 0) && (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Nenhum pedido encontrado</p>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card onClick={() => window.location.href = '/pecas'}>
            <div className="text-center">
              <Package className="h-12 w-12 text-primary-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Cadastrar Peças</h3>
              <p className="text-sm text-gray-600">Importe suas peças via Excel</p>
            </div>
          </Card>

          <Card onClick={() => window.location.href = '/pedidos'}>
            <div className="text-center">
              <FileText className="h-12 w-12 text-warning-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Novo Pedido</h3>
              <p className="text-sm text-gray-600">Crie um novo pedido de fabricação</p>
            </div>
          </Card>

          <Card onClick={() => window.location.href = '/fornecedores'}>
            <div className="text-center">
              <Users className="h-12 w-12 text-success-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Fornecedores</h3>
              <p className="text-sm text-gray-600">Gerencie seus fornecedores</p>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

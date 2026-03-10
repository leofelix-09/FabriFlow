import { useState, useEffect } from 'react';
import Layout from '@/react-app/components/Layout';
import Card from '@/react-app/components/Card';
import Button from '@/react-app/components/Button';
import { BarChart3, Package, FileText, Users, User, Shield, CreditCard, UserCircle } from 'lucide-react';
import { useNotificationContext } from '@/react-app/components/NotificationProvider';
import ConfirmModal from '@/react-app/components/ConfirmModal';

type TabId = 'perfil' | 'dashboard' | 'pecas' | 'pedidos' | 'fornecedores' | 'usuarios' | 'administrador' | 'planos';

interface Tab {
  id: TabId;
  label: string;
  icon: any;
}

const tabs: Tab[] = [
  { id: 'perfil', label: 'Perfil', icon: UserCircle },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'pecas', label: 'Peças', icon: Package },
  { id: 'pedidos', label: 'Pedidos', icon: FileText },
  { id: 'fornecedores', label: 'Fornecedores', icon: Users },
  { id: 'usuarios', label: 'Usuários', icon: User },
  { id: 'administrador', label: 'Administrador', icon: Shield },
  { id: 'planos', label: 'Planos', icon: CreditCard },
];

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('perfil');
  const [autoCreatePecas, setAutoCreatePecas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearingDb, setClearingDb] = useState(false);
  const [showClearDbConfirm, setShowClearDbConfirm] = useState(false);
  const { showSuccess, showError } = useNotificationContext();

  // Estados para o perfil do usuário
  const [profileData, setProfileData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    loadUserSettings();
    loadUserProfile();
  }, []);

  const loadUserSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const settings = await response.json();
        setAutoCreatePecas(settings.auto_create_pecas_on_import || false);
      } else {
        // Se o endpoint retornar 404 (ainda não existe), considerar defaults
        console.warn('API de configurações não encontrada ou erro, usando defaults.');
        setAutoCreatePecas(false);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações do usuário:', error);
      showError('Ops! 😕', 'Não conseguimos carregar suas configurações.');
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const profile = await response.json();
        setProfileData({
          nome: profile.nome || '',
          email: profile.email || '',
          senha: '',
          confirmarSenha: ''
        });
      } else {
        console.error('Erro ao carregar perfil do usuário');
      }
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);
      showError('Ops! 😕', 'Não conseguimos carregar seus dados.');
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_create_pecas_on_import: autoCreatePecas })
      });

      if (response.ok) {
        showSuccess('Tudo certo! ✨', 'Suas preferências foram salvas com sucesso.');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar configurações.');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showError('Algo deu errado ⚠️', error instanceof Error ? error.message : 'Não foi possível salvar suas configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      // Validar senhas se foram preenchidas
      if (profileData.senha && profileData.senha !== profileData.confirmarSenha) {
        throw new Error('As senhas não coincidem');
      }

      if (profileData.senha && profileData.senha.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres');
      }

      const payload: { nome: string; senha?: string } = {
        nome: profileData.nome
      };

      // Incluir senha apenas se foi preenchida
      if (profileData.senha) {
        payload.senha = profileData.senha;
      }

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Limpar campos de senha após salvar
        setProfileData(prev => ({
          ...prev,
          senha: '',
          confirmarSenha: ''
        }));

        showSuccess('Perfil Atualizado 👤', 'Seus dados estão atualizados e seguros.');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar perfil.');
      }
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      showError('Algo deu errado ⚠️', error instanceof Error ? error.message : 'Não foi possível atualizar seus dados.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleClearDb = async () => {
    setShowClearDbConfirm(false);

    setClearingDb(true);
    try {
      const response = await fetch('/api/admin/clear-db', {
        method: 'DELETE'
      });

      if (response.ok) {
        showSuccess('Banco Limpo 🧹', 'Todos os seus dados foram resetados com sucesso.');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao limpar banco de dados.');
      }
    } catch (error) {
      console.error('Erro ao limpar banco de dados:', error);
      showError('Algo deu errado ⚠️', error instanceof Error ? error.message : 'Não foi possível limpar o banco.');
    } finally {
      setClearingDb(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'perfil':
        return (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <UserCircle className="h-5 w-5 mr-2" />
                  Dados do Perfil
                </h3>
                <p className="text-gray-600 mt-1">
                  Gerencie suas informações pessoais e de acesso.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={profileData.nome}
                    onChange={handleProfileChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Digite seu nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    disabled
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 bg-gray-50 text-gray-500 cursor-not-allowed"
                    placeholder="seu@email.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    O email não pode ser alterado por questões de segurança
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">Alterar Senha</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Deixe em branco se não quiser alterar sua senha atual.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nova senha
                    </label>
                    <input
                      type="password"
                      name="senha"
                      value={profileData.senha}
                      onChange={handleProfileChange}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmar nova senha
                    </label>
                    <input
                      type="password"
                      name="confirmarSenha"
                      value={profileData.confirmarSenha}
                      onChange={handleProfileChange}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Digite a senha novamente"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button onClick={handleSaveProfile} loading={savingProfile}>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </Card>
        );

      case 'dashboard':
        return (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Configurações do Dashboard
                </h3>
                <p className="text-gray-600 mt-1">
                  Personalize a visualização e comportamento do painel principal.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Atualização automática</label>
                  <p className="text-sm text-gray-500 mt-1">Atualizar dados automaticamente a cada 30 segundos</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={true}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Mostrar pedidos atrasados</label>
                  <p className="text-sm text-gray-500 mt-1">Destacar pedidos que passaram da data de entrega</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={true}
                />
              </div>
            </div>
          </Card>
        );

      case 'pecas':
        return (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Configurações de Peças
                </h3>
                <p className="text-gray-600 mt-1">
                  Gerencie como as peças são cadastradas e organizadas no sistema.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Validar códigos duplicados</label>
                  <p className="text-sm text-gray-500 mt-1">Impedir cadastro de peças com códigos já existentes</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={true}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Etapas padrão obrigatórias</label>
                  <p className="text-sm text-gray-500 mt-1">Exigir pelo menos 3 etapas ao cadastrar uma nova peça</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={false}
                />
              </div>
            </div>
          </Card>
        );

      case 'pedidos':
        return (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Configurações de Pedidos
                </h3>
                <p className="text-gray-600 mt-1">
                  Gerencie como os pedidos são processados e importados no sistema.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label htmlFor="auto-create-pecas" className="text-gray-900 font-medium cursor-pointer">
                    Cadastrar peça automaticamente na importação
                  </label>
                  <p className="text-sm text-gray-500 mt-1">
                    Se ativado, o sistema criará novas peças automaticamente caso elas não existam durante a importação de pedidos.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="auto-create-pecas"
                  checked={autoCreatePecas}
                  onChange={() => setAutoCreatePecas(!autoCreatePecas)}
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Notificar sobre atrasos</label>
                  <p className="text-sm text-gray-500 mt-1">Enviar notificações quando pedidos passarem da data de entrega</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={true}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Aprovação automática</label>
                  <p className="text-sm text-gray-500 mt-1">Aprovar automaticamente etapas com evidências válidas</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={false}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button onClick={handleSaveSettings} loading={saving}>
                Salvar Configurações
              </Button>
            </div>
          </Card>
        );

      case 'fornecedores':
        return (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Configurações de Fornecedores
                </h3>
                <p className="text-gray-600 mt-1">
                  Gerencie como os fornecedores interagem com o sistema.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Permitir auto-cadastro</label>
                  <p className="text-sm text-gray-500 mt-1">Permitir que novos fornecedores se cadastrem através do link público</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={false}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Notificações por email</label>
                  <p className="text-sm text-gray-500 mt-1">Enviar emails automáticos sobre novos pedidos e atualizações</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={true}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Avaliar desempenho</label>
                  <p className="text-sm text-gray-500 mt-1">Coletar métricas de pontualidade e qualidade dos fornecedores</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={true}
                />
              </div>
            </div>
          </Card>
        );

      case 'usuarios':
        return (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Configurações de Usuários
                </h3>
                <p className="text-gray-600 mt-1">
                  Gerencie permissões e acesso dos usuários da sua empresa.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                <div className="flex items-center">
                  <Shield className="h-5 w-5 text-yellow-600 mr-3" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Funcionalidade em desenvolvimento</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      O gerenciamento de múltiplos usuários estará disponível em breve.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg opacity-50">
                <div>
                  <label className="text-gray-900 font-medium">Permitir novos usuários</label>
                  <p className="text-sm text-gray-500 mt-1">Permitir que novos usuários sejam convidados para sua empresa</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  disabled
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg opacity-50">
                <div>
                  <label className="text-gray-900 font-medium">Aprovar convites</label>
                  <p className="text-sm text-gray-500 mt-1">Exigir aprovação antes de novos usuários acessarem o sistema</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  disabled
                />
              </div>
            </div>
          </Card>
        );

      case 'administrador':
        return (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Configurações de Administrador
                </h3>
                <p className="text-gray-600 mt-1">
                  Configurações avançadas e administrativas do sistema.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Logs de auditoria</label>
                  <p className="text-sm text-gray-500 mt-1">Registrar todas as ações importantes dos usuários</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={true}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="text-gray-900 font-medium">Backup automático</label>
                  <p className="text-sm text-gray-500 mt-1">Realizar backup automático dos dados diariamente</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked={true}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                <div>
                  <label className="text-red-900 font-medium">Modo de manutenção</label>
                  <p className="text-sm text-red-700 mt-1">Bloquear acesso temporariamente para manutenção</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 text-red-600 focus:ring-red-500 border-red-300 rounded"
                  defaultChecked={false}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-red-500 rounded-lg bg-red-100">
                <div>
                  <label className="text-red-900 font-bold">Zerar Banco de Dados (Temporário)</label>
                  <p className="text-sm text-red-800 mt-1">Isso apagará todos os seus pedidos, peças, fornecedores e evidências.</p>
                </div>
                <Button
                  variant="danger"
                  onClick={() => setShowClearDbConfirm(true)}
                  loading={clearingDb}
                >
                  Limpar Tudo
                </Button>
              </div>
            </div>
          </Card>
        );

      case 'planos':
        return (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Planos e Cobrança
                </h3>
                <p className="text-gray-600 mt-1">
                  Gerencie sua assinatura e informações de cobrança.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 border border-green-200 rounded-lg bg-green-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-green-800">Plano Gratuito</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Você está usando o plano gratuito do FabriFlow
                    </p>
                  </div>
                  <span className="px-3 py-1 text-sm font-medium text-green-700 bg-green-200 rounded-full">
                    Ativo
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Limite de Pedidos</h5>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">0 / 100 pedidos</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div className="bg-primary-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Limite de Fornecedores</h5>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">0 / 10 fornecedores</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div className="bg-primary-600 h-2 rounded-full" style={{ width: '0%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-800">Deseja mais recursos?</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Faça upgrade para ter pedidos ilimitados, mais fornecedores e recursos premium
                    </p>
                  </div>
                  <Button variant="primary" size="sm">
                    Ver Planos
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <Layout currentPage="settings" loading={loading}>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
            <p className="text-gray-600 mt-2">Personalize o comportamento do FabriFlow</p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <Icon className={`mr-2 h-4 w-4 ${activeTab === tab.id ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {renderTabContent()}
        </div>
      </div>

      {/* Modal de confirmação para limpar banco de dados */}
      <ConfirmModal
        isOpen={showClearDbConfirm}
        title="Zerar Banco de Dados"
        message="Tem certeza que deseja apagar TODOS os seus pedidos, peças, fornecedores, etapas e evidências? Essa ação não pode ser desfeita."
        confirmText="Sim, apagar tudo"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleClearDb}
        onCancel={() => setShowClearDbConfirm(false)}
      />
    </Layout>
  );
}

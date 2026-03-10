import React, { useState, useEffect } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { Link, useLocation } from 'react-router';
import { LogOut, Package, FileText, Users, Settings as SettingsIcon, LayoutDashboard } from 'lucide-react';
import NotificationCenter from '@/react-app/components/NotificationCenter';
import { useNotificationContext } from '@/react-app/components/NotificationProvider';
import { useGlobalNotifications } from '@/react-app/hooks/useGlobalNotifications';

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  loading?: boolean;
}

export default function Layout({ children, currentPage, loading = false }: LayoutProps) {
  const { user, logout } = useAuth();
  const { notifications, markAsRead, markAllAsRead, removeNotification } = useNotificationContext();
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  // Ativar notificações globais
  useGlobalNotifications();

  // Controlar estado de navegação
  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 100);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { id: 'pecas', label: 'Peças', icon: Package, href: '/pecas' },
    { id: 'pedidos', label: 'Pedidos', icon: FileText, href: '/pedidos' },
    { id: 'fornecedores', label: 'Fornecedores', icon: Users, href: '/fornecedores' },
    { id: 'settings', label: 'Configurações', icon: SettingsIcon, href: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-poppins">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white">
        <div className="flex h-16 items-center justify-center">
          <h1 className="text-2xl font-bold text-primary-600">FabriFlow</h1>
        </div>

        <nav className="mt-8 px-4">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              to={item.href}
              className={`mb-2 flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors ${currentPage === item.id
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sair
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-64">
        {/* Header */}
        <header className="h-16 bg-white px-8">
          <div className="flex h-full items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {menuItems.find(item => item.id === currentPage)?.label || 'Dashboard'}
            </h2>

            <div className="flex items-center space-x-4">
              <NotificationCenter
                notifications={notifications}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onRemove={removeNotification}
              />
              <div className="flex items-center space-x-3">
                {user?.google_user_data?.picture ? (
                  <img
                    src={user.google_user_data.picture}
                    alt="Avatar"
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-600 text-sm font-medium">
                      {user?.google_user_data?.given_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">
                    {user?.google_user_data?.name || user?.google_user_data?.given_name || 'Usuário'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {user?.email}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-8">
          {(loading || isNavigating) ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

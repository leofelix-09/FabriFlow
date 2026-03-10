import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from "@getmocha/users-service/react";
import Button from '@/react-app/components/Button';
import Input from '@/react-app/components/Input';
import Card from '@/react-app/components/Card';
import { LogIn } from 'lucide-react';
import { Login as LoginType } from '@/shared/types';

export default function Login() {
  const { redirectToLogin, isPending, fetchUser } = useAuth();
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [formData, setFormData] = useState<LoginType>({
    email: '',
    senha: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center font-poppins">
        <div className="animate-spin">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Limpar erro ao começar a digitar
    if (error) setError('');
  };

  const handleGoogleLogin = async () => {
    try {
      await redirectToLogin();
    } catch (error) {
      console.error('Erro no login com Google:', error);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login-custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer login');
      }

      // Recarregar dados do usuário após login bem-sucedido
      await fetchUser();
      
      // Redirecionar para dashboard
      window.location.href = '/';
    } catch (err) {
      console.error('Erro no login:', err);
      setError(err instanceof Error ? err.message : 'Erro interno do servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4 font-poppins">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">FabriFlow</h1>
          <p className="text-gray-600">Sistema de Gestão de Pedidos de Fabricação</p>
        </div>

        <Card>
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-4">
              <LogIn className="h-6 w-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Entrar na sua conta
            </h2>
          </div>

          {!showEmailLogin ? (
            <div className="space-y-4">
              {/* Login com Google */}
              <Button
                onClick={handleGoogleLogin}
                variant="primary"
                size="lg"
                loading={isPending}
                className="w-full"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
              </Button>

              {/* Divisor */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">ou</span>
                </div>
              </div>

              {/* Botão para mostrar login por email */}
              <Button
                onClick={() => setShowEmailLogin(true)}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Login com Email
              </Button>

              <div className="text-center mt-4">
                <p className="text-gray-600 text-sm">
                  Não tem uma conta?{' '}
                  <Link 
                    to="/register" 
                    className="text-primary-600 hover:text-primary-800 font-medium hover:underline transition-colors"
                  >
                    Criar conta
                  </Link>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  placeholder="seu@email.com"
                />

                <Input
                  label="Senha"
                  type="password"
                  name="senha"
                  value={formData.senha}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  placeholder="Digite sua senha"
                />

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                  loading={isLoading}
                >
                  Entrar
                </Button>
              </form>

              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">ou</span>
                  </div>
                </div>

                <Button
                  onClick={() => setShowEmailLogin(false)}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  ← Voltar para outras opções
                </Button>
              </div>

              <div className="text-center">
                <p className="text-gray-600 text-sm">
                  Não tem uma conta?{' '}
                  <Link 
                    to="/register" 
                    className="text-primary-600 hover:text-primary-800 font-medium hover:underline transition-colors"
                  >
                    Criar conta
                  </Link>
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router';
import Button from '@/react-app/components/Button';
import Input from '@/react-app/components/Input';
import Card from '@/react-app/components/Card';
import { Register } from '@/shared/types';

export default function RegisterPage() {
  const [formData, setFormData] = useState<Register>({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Limpar erro ao começar a digitar
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/register-custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar conta');
      }

      setSuccess(true);
    } catch (err) {
      console.error('Erro no registro:', err);
      setError(err instanceof Error ? err.message : 'Erro interno do servidor');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4 font-poppins">
        <Card className="w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Conta criada com sucesso!
            </h2>
            <p className="text-gray-600 mb-6">
              Sua conta foi criada. Agora você pode fazer login.
            </p>
            <Link to="/login">
              <Button size="lg" className="w-full">
                Ir para Login
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4 font-poppins">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-600 mb-2">
            Criar Conta
          </h1>
          <p className="text-gray-600">
            Crie sua conta no FabriFlow
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Nome completo"
            name="nome"
            value={formData.nome}
            onChange={handleChange}
            required
            disabled={isLoading}
            placeholder="Digite seu nome completo"
          />

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
            placeholder="Mínimo 6 caracteres"
          />

          <Input
            label="Confirmar senha"
            type="password"
            name="confirmarSenha"
            value={formData.confirmarSenha}
            onChange={handleChange}
            required
            disabled={isLoading}
            placeholder="Digite a senha novamente"
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Já tem uma conta?{' '}
            <Link 
              to="/login" 
              className="text-primary-600 hover:text-primary-800 font-medium hover:underline transition-colors"
            >
              Fazer login
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}

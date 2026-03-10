import { useEffect } from 'react';
import { useAuth } from '@getmocha/users-service/react';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const { exchangeCodeForSessionToken } = useAuth();

  useEffect(() => {
    let hasRun = false;
    
    const handleCallback = async () => {
      if (hasRun) return;
      hasRun = true;
      
      try {
        console.log('Iniciando troca do código por token de sessão...');
        
        // Verificar se existe código na URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (!code) {
          console.error('Código de autorização não encontrado na URL');
          window.location.href = '/';
          return;
        }
        
        console.log('Código encontrado, iniciando troca...');
        await exchangeCodeForSessionToken();
        console.log('Autenticação bem-sucedida, redirecionando...');
        
        // Limpar parâmetros da URL e redirecionar
        window.history.replaceState({}, document.title, '/');
        window.location.href = '/';
      } catch (error) {
        console.error('Erro no callback de autenticação:', error);
        
        // Log mais detalhado do erro
        if (error instanceof Error) {
          console.error('Detalhes do erro:', {
            message: error.message,
            stack: error.stack
          });
        }
        
        // Para erro 400, limpar localStorage e cookies antes de redirecionar
        if (error instanceof Error && error.message.includes('400')) {
          console.log('Limpando dados de sessão devido a erro 400...');
          localStorage.clear();
          sessionStorage.clear();
          
          // Limpar cookies relacionados ao auth
          document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
          });
        }
        
        // Aguardar um pouco antes de redirecionar para dar tempo de ver o erro
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    // Usar timeout para evitar múltiplas execuções
    const timer = setTimeout(handleCallback, 100);
    
    return () => {
      clearTimeout(timer);
    };
  }, [exchangeCodeForSessionToken]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center font-poppins">
      <div className="text-center">
        <div className="animate-spin mb-4 mx-auto">
          <Loader2 className="w-12 h-12 text-primary-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Finalizando login...
        </h2>
        <p className="text-gray-600">
          Aguarde enquanto processamos sua autenticação
        </p>
      </div>
    </div>
  );
}

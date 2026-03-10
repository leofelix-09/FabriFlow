import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider, useAuth } from "@getmocha/users-service/react";
import { NotificationProvider } from "@/react-app/components/NotificationProvider";
import Login from "@/react-app/pages/Login";
import Dashboard from "@/react-app/pages/Dashboard";
import AuthCallback from "@/react-app/pages/AuthCallback";
import Register from "@/react-app/pages/Register";
import Pecas from "@/react-app/pages/Pecas";
import Pedidos from "@/react-app/pages/Pedidos";
import Fornecedores from "@/react-app/pages/Fornecedores";
import PainelFornecedor from "@/react-app/pages/PainelFornecedor";
import Settings from "@/react-app/pages/Settings";

function AppRoutes() {
  const { user, isPending } = useAuth();

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-poppins">
        <div className="animate-spin">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/register" element={<Register />} />
      <Route path="/fornecedor/pedido/:pedidoId" element={<PainelFornecedor />} />
      {user ? (
        <>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pecas" element={<Pecas />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/fornecedores" element={<Fornecedores />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </>
      ) : (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Login />} />
        </>
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <AppRoutes />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

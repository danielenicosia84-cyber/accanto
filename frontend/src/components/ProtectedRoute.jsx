import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children }) {
  const { user, checked } = useAuth();
  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E8F5E9] border-t-[#2D6A4F]" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

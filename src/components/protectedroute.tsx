import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useauth";

import type { ReactNode } from "react";

export default function ProtectedRoute({
  children,
}: {
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) return <Navigate to="/" />;

  return children;
}
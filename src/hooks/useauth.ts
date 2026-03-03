import { useContext } from "react";
import { AuthContext } from "../context/authcontext";

export function useAuth() {
  return useContext(AuthContext);
}
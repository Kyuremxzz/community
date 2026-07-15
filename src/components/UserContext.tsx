"use client";

/**
 * Contexto de autenticação do lado do cliente.
 *
 * O cookie httpOnly guarda a sessão; este contexto só espelha o usuário
 * (via GET /api/me na montagem) para o Topbar e para os guards das telas.
 * Login/logout/assinatura chamam `setUser`/`refresh` para atualizar tudo
 * sem recarregar a página.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { User } from "@/lib/types";

interface UserContextValue {
  /** Usuário logado ou null (deslogado). */
  user: User | null;
  /** true enquanto o GET /api/me inicial não respondeu. */
  loading: boolean;
  /** Atualiza o usuário localmente (após login/logout/assinatura). */
  setUser: (user: User | null) => void;
  /** Rebusca /api/me (após entrar/sair de vaga, para o badge do grátis). */
  refresh: () => Promise<User | null>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<User | null> => {
    try {
      const { user: fresh } = await api.me();
      setUser(fresh);
      return fresh;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, loading, setUser, refresh }),
    [user, loading, refresh]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser precisa ser usado dentro de <UserProvider>.");
  }
  return context;
}

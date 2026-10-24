"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth } from "@/lib/firebase";
import { db } from "@/lib/firestore";

type Perfil = "enfermeira" | "acs" | "administrador_municipal" | "desenvolvedor";

interface UsuarioSistema {
  uid: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ubsId?: string;
  municipio?: string;
  uf?: string;
  ativo: boolean;
}

interface UBS {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  ativo: boolean;
}

interface AuthContextData {
  usuarioAuth: User | null;
  usuario: UsuarioSistema | null;
  ubs: UBS | null;
  carregando: boolean;
  atualizarUbs: (dados: UBS) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [usuarioAuth, setUsuarioAuth] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [ubs, setUbs] = useState<UBS | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, async (user) => {
      try {
        setCarregando(true);

        if (!user) {
          setUsuarioAuth(null);
          setUsuario(null);
          setUbs(null);
          return;
        }

        setUsuarioAuth(user);

        const usuarioRef = doc(db, "usuarios", user.uid);
        const usuarioSnap = await getDoc(usuarioRef);

        if (!usuarioSnap.exists()) {
          console.error(
            "Usuário autenticado sem cadastro correspondente no Firestore."
          );
          await signOut(auth);
          setUsuarioAuth(null);
          setUsuario(null);
          setUbs(null);
          return;
        }

        const dados = usuarioSnap.data();
        const perfil = dados.perfil as Perfil | undefined;

        if (
          dados.ativo !== true ||
          !["enfermeira", "acs", "administrador_municipal", "desenvolvedor"].includes(
            perfil ?? ""
          )
        ) {
          console.error("Usuário sem acesso ativo ou com perfil inválido.");
          await signOut(auth);
          setUsuarioAuth(null);
          setUsuario(null);
          setUbs(null);
          return;
        }

        // A conta de desenvolvedor é separada dos perfis operacionais e não pertence a uma UBS.
        // A autorização comercial real também é validada no servidor pela variável DESENVOLVEDOR_UIDS.
        if (perfil === "desenvolvedor") {
          setUsuario({
            uid: user.uid,
            nome: dados.nome ?? "Desenvolvedor",
            email: dados.email ?? user.email ?? "",
            perfil,
            ativo: true,
          });
          setUbs(null);
          return;
        }

        // Administrador municipal não pertence a uma UBS específica.
        if (perfil === "administrador_municipal") {
          const municipio =
            typeof dados.municipio === "string" ? dados.municipio.trim() : "";
          const uf = typeof dados.uf === "string" ? dados.uf.trim().toUpperCase() : "";

          if (!municipio || !/^[A-Z]{2}$/.test(uf)) {
            console.error(
              "Administrador municipal sem município/UF válidos."
            );
            await signOut(auth);
            setUsuarioAuth(null);
            setUsuario(null);
            setUbs(null);
            return;
          }

          setUsuario({
            uid: user.uid,
            nome: dados.nome ?? "",
            email: dados.email ?? user.email ?? "",
            perfil,
            municipio,
            uf,
            ativo: true,
          });
          setUbs(null);
          return;
        }

        // Enfermeiras e ACS continuam obrigatoriamente vinculados a uma UBS.
        const ubsId =
          typeof dados.ubsId === "string" ? dados.ubsId.trim() : "";

        if (!ubsId) {
          console.error("Usuário sem UBS vinculada.");
          await signOut(auth);
          setUsuarioAuth(null);
          setUsuario(null);
          setUbs(null);
          return;
        }

        // Valida a assinatura no servidor antes de liberar a sessão operacional
        // da enfermeira. A API verifica a assinatura pelo UID autenticado.
        if (perfil === "enfermeira") {
          try {
            const token = await user.getIdToken();
            const respostaAcesso = await fetch("/api/dashboard", {
              method: "GET",
              cache: "no-store",
              headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" },
            });
            const dadosAcesso = await respostaAcesso.json().catch(() => ({}));

            if (
              respostaAcesso.status === 403 &&
              dadosAcesso?.codigo === "ASSINATURA_PROFISSIONAL_INATIVA"
            ) {
              await signOut(auth);
              setUsuarioAuth(null);
              setUsuario(null);
              setUbs(null);
              if (typeof window !== "undefined") {
                window.location.replace("/login?motivo=assinatura-pendente");
              }
              return;
            }
          } catch (erroValidacao) {
            // Falhas de rede não são tratadas como inadimplência; a API continua
            // protegendo os dados a cada requisição operacional.
            console.error("Não foi possível validar a assinatura no início da sessão:", erroValidacao);
          }
        }

        const usuarioSistema: UsuarioSistema = {
          uid: user.uid,
          nome: dados.nome ?? "",
          email: dados.email ?? user.email ?? "",
          perfil: perfil!,
          ubsId,
          ativo: true,
        };

        setUsuario(usuarioSistema);

        const ubsRef = doc(db, "ubs", ubsId);
        const ubsSnap = await getDoc(ubsRef);

        if (ubsSnap.exists()) {
          const dadosUbs = ubsSnap.data();

          setUbs({
            id: ubsSnap.id,
            nome: dadosUbs.nome ?? "",
            municipio: dadosUbs.municipio ?? "",
            uf: dadosUbs.uf ?? "",
            ativo: dadosUbs.ativo === true,
          });
        } else {
          console.error("UBS vinculada ao usuário não foi encontrada.");
          await signOut(auth);
          setUsuarioAuth(null);
          setUsuario(null);
          setUbs(null);
        }
      } catch (error) {
        console.error("Erro ao carregar autenticação:", error);
        await signOut(auth);
        setUsuarioAuth(null);
        setUsuario(null);
        setUbs(null);
      } finally {
        setCarregando(false);
      }
    });

    return () => cancelar();
  }, []);

  function atualizarUbs(dados: UBS) {
    setUbs(dados);
  }

  async function logout() {
    await signOut(auth);
    setUsuarioAuth(null);
    setUsuario(null);
    setUbs(null);
  }

  return (
    <AuthContext.Provider
      value={{
        usuarioAuth,
        usuario,
        ubs,
        carregando,
        atualizarUbs,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider.");
  }

  return context;
}

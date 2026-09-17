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

type Perfil = "enfermeira" | "acs"; 

interface UsuarioSistema { 
  uid: string; 
  nome: string; 
  email: string; 
  perfil: Perfil; 
  ubsId: string; 
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
    /** 
     * Observa automaticamente o estado de autenticação 
     * do Firebase. 
     */ 
    const cancelar = onAuthStateChanged(auth, async (user) => { 
      try { 
        setCarregando(true); 

        // Usuário não está autenticado. 
        if (!user) { 
          setUsuarioAuth(null); 
          setUsuario(null); 
          setUbs(null); 
          return; 
        } 

        setUsuarioAuth(user); 

        /** 
         * Busca o perfil do usuário no Firestore. 
         * 
         * O documento utiliza o mesmo UID fornecido 
         * pelo Firebase Authentication. 
         */ 
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
        console.log("USUÁRIO CARREGADO:", { 
          uid: user.uid, 
          nome: dados.nome, 
          perfil: dados.perfil, 
          ubsId: dados.ubsId, 
          ativo: dados.ativo, 
        }); 

        // Conta desativada. 
        if (dados.ativo !== true || !dados.ubsId) { 
          console.error("Usuário sem acesso ativo ou sem UBS vinculada."); 

          await signOut(auth); 

          setUsuarioAuth(null); 
          setUsuario(null); 
          setUbs(null); 

          return; 
        } 

        const usuarioSistema: UsuarioSistema = { 
          uid: user.uid, 
          nome: dados.nome ?? "", 
          email: dados.email ?? user.email ?? "", 
          perfil: dados.perfil, 
          ubsId: dados.ubsId, 
          ativo: dados.ativo, 
        }; 

        setUsuario(usuarioSistema); 

        /** 
         * Depois de identificar o usuário, buscamos 
         * a UBS à qual ele pertence. 
         */ 
        const ubsRef = doc(db, "ubs", dados.ubsId); 
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

  /**
   * Atualiza os dados da UBS no contexto imediatamente,
   * sem precisar recarregar a página.
   *
   * A gravação no Firestore continua sendo feita pela API.
   */
  function atualizarUbs(dados: UBS) {
    setUbs(dados);
  }

  /** 
   * Encerra a sessão do Firebase. 
   */ 
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

/** 
 * Hook utilizado pelas páginas para acessar 
 * os dados do usuário autenticado. 
 */ 
export function useAuth() { 
  const context = useContext(AuthContext); 

  if (!context) { 
    throw new Error( 
      "useAuth deve ser utilizado dentro de um AuthProvider." 
    ); 
  } 

  return context; 
} 

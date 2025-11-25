import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBGNzN5e6VdNpg2UJEQEmXE1sk1yGoQl7Q",
  authDomain: "sistema-avalicao.firebaseapp.com",
  projectId: "sistema-avalicao" 
};

let app: FirebaseApp | undefined;
let db: Firestore | null = null;

try {
  // Singleton: Verifica se o app já foi inicializado
  // Se houver apps registrados, usa o existente para evitar conflitos de HMR (Hot Module Replacement)
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  
  if (app) {
    try {
      // Tenta inicializar com Cache Persistente (Performance Otimizada)
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (cacheError: any) {
      console.warn("Aviso: Falha ao ativar cache persistente. Tentando modo padrão.", cacheError);
      
      // Fallback: Se initializeFirestore falhar (ex: 'Component not registered'), 
      // tenta getFirestore padrão que é mais tolerante a problemas de injeção de dependência.
      try {
        db = getFirestore(app);
      } catch (fatalError) {
        console.error("Erro Fatal: Firestore indisponível.", fatalError);
        db = null;
      }
    }
  }
} catch (e) {
  console.error("Erro crítico ao inicializar Firebase App:", e);
  db = null;
}

export { db };
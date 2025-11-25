
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';

// Configuração atualizada com o novo Project ID
const firebaseConfig = {
  apiKey: "AIzaSyBGNzN5e6VdNpg2UJEQEmXE1sk1yGoQl7Q",
  authDomain: "sistema-avalicao.firebaseapp.com",
  projectId: "sistema-avalicao-1f310", 
  storageBucket: "sistema-avalicao.firebasestorage.app",
  messagingSenderId: "1082262958380",
  appId: "1:1082262958380:web:3d4f1f7f3a9bbae64e3c89"
};

let app: FirebaseApp | undefined;
let db: Firestore | null = null;

try {
  // Singleton: Evita recriar o app se já existir (Hot Reload)
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  
  if (app) {
    try {
      // ATIVAÇÃO DO CACHE PERSISTENTE & LONG POLLING
      // experimentalForceLongPolling: Essencial para redes escolares/corporativas que bloqueiam WebSockets.
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        }),
        experimentalForceLongPolling: true 
      }); 
      console.log("Firestore initialized successfully (Persistence + Long Polling enabled)");
    } catch (fsError: any) {
      // Se falhar porque já foi inicializado (failed-precondition), tentamos pegar a instância existente
      if (fsError.code === 'failed-precondition') {
          try {
              db = getFirestore(app);
              console.log("Firestore retrieved (already initialized).");
          } catch (e) {
              console.error("Critical: Firestore service unavailable even after retry.", e);
              db = null;
          }
      } else {
          console.error("Erro ao obter instância do Firestore:", fsError);
          db = null;
      }
    }
  }
} catch (e) {
  console.error("Erro crítico ao inicializar Firebase App:", e);
  db = null;
}

export { db };

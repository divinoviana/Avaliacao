import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore } from 'firebase/firestore';

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
      // Usa initializeFirestore para garantir a configuração correta do serviço
      // Isso evita o erro "Service firestore is not available" em alguns ambientes
      db = initializeFirestore(app, {}); 
      console.log("Firestore initialized successfully with Project ID:", firebaseConfig.projectId);
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
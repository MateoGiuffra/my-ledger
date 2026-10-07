import { getApp, getApps, initializeApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = () => !!(config.apiKey && config.projectId && config.messagingSenderId && config.appId && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);

async function messaging() {
  if (!(await isSupported())) throw new Error("Este navegador no soporta notificaciones push");
  return getMessaging(getApps().length ? getApp() : initializeApp(config));
}

/** Pide permiso y devuelve el token FCM de este dispositivo (usa nuestro service worker /sw.js). */
export async function enablePush(): Promise<string> {
  if (!firebaseConfigured()) throw new Error("Falta configurar Firebase (variables NEXT_PUBLIC_FIREBASE_*)");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permiso de notificaciones denegado");
  const registration = await navigator.serviceWorker.ready;
  return getToken(await messaging(), { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
}

export async function disablePush(): Promise<void> {
  await deleteToken(await messaging()).catch(() => {});
}

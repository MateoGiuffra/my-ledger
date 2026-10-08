import { google } from "googleapis";
import { User } from "../models/user";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Envía un mensaje a un token; devuelve "ok" | "invalid" (token caducado) | "error". */
export type PushSender = (token: string, payload: PushPayload) => Promise<"ok" | "invalid" | "error">;

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export function pushConfigured(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
}

function serviceAccount(): ServiceAccount {
  return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);
}

/** FCM HTTP v1 con la service account (sin firebase-admin). Mensaje solo de datos: lo muestra nuestro service worker. */
const fcmSender: PushSender = async (token, payload) => {
  const sa = serviceAccount();
  const jwt = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ["https://www.googleapis.com/auth/firebase.messaging"] });
  const { access_token } = await jwt.authorize();
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { token, data: { title: payload.title, body: payload.body, url: payload.url ?? "/alertas" }, webpush: { headers: { Urgency: "high" } } },
    }),
  });
  if (res.ok) return "ok";
  if (res.status === 404 || res.status === 400) {
    const j = (await res.json().catch(() => ({}))) as { error?: { status?: string } };
    if (res.status === 404 || j.error?.status === "INVALID_ARGUMENT" || j.error?.status === "NOT_FOUND") return "invalid";
  }
  return "error";
};

let sender: PushSender | null = null;
/** Solo para tests. */
export function setPushSender(s: PushSender | null) {
  sender = s;
}

/** Manda el push a todos los dispositivos del usuario y descarta los tokens inválidos. Devuelve cuántos salieron bien. */
export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  const send = sender ?? (pushConfigured() ? fcmSender : null);
  if (!send) return 0;
  const u = await User.findById(userId).select("pushTokens").lean<{ pushTokens?: string[] }>();
  let ok = 0;
  for (const t of u?.pushTokens ?? []) {
    let r: Awaited<ReturnType<PushSender>> = "error";
    try {
      r = await send(t, payload);
    } catch {
      r = "error";
    }
    if (r === "ok") ok++;
    else if (r === "invalid") await User.updateOne({ _id: userId }, { $pull: { pushTokens: t } });
  }
  return ok;
}

export async function saveToken(userId: string, token: string) {
  await User.updateOne({ _id: userId }, { $addToSet: { pushTokens: token } });
}

export async function removeToken(userId: string, token: string) {
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
}

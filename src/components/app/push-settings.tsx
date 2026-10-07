"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { removePushTokenAction, savePushTokenAction } from "@/app/actions/alerts";
import { Button } from "@/components/ui/button";
import { disablePush, enablePush, firebaseConfigured } from "@/lib/firebase-client";

export function PushSettings({ deviceCount }: { deviceCount: number }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [permOverride, setPerm] = useState<string | null>(null);
  const livePerm = useSyncExternalStore(
    () => () => {},
    () => ("Notification" in window ? Notification.permission : "unsupported"),
    () => "default",
  );
  const perm = permOverride ?? livePerm;
  const [pending, start] = useTransition();
  const configured = firebaseConfigured();

  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <p className="font-medium">Notificaciones push en este dispositivo</p>
      <p className="text-xs text-muted-foreground">Dispositivos registrados: {deviceCount} · permiso: {perm}</p>
      {!configured && <p className="text-xs text-muted-foreground">Firebase no está configurado (ver README). Las alertas igual aparecen dentro de la app.</p>}
      <div className="flex gap-2">
        <Button
          disabled={pending || !configured}
          onClick={() =>
            start(async () => {
              try {
                const t = await enablePush();
                await savePushTokenAction(t);
                setToken(t);
                setPerm(Notification.permission);
                setMsg("Notificaciones activadas ✓");
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "No se pudo activar");
              }
            })
          }
        >
          Activar
        </Button>
        <Button
          variant="outline"
          disabled={pending || !token}
          onClick={() =>
            start(async () => {
              if (token) await removePushTokenAction(token);
              await disablePush();
              setToken(null);
              setMsg("Desactivadas en este dispositivo");
            })
          }
        >
          Desactivar
        </Button>
      </div>
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </div>
  );
}

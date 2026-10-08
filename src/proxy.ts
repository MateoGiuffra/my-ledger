import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// En Next 16 el middleware se llama proxy.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|swe-worker.*|firebase-messaging-sw.js|icons/).*)"],
};

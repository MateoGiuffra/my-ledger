import type { NextAuthConfig } from "next-auth";

const PUBLIC = ["/login", "/registro", "/api/auth", "/api/cron"];

/** Config liviana (sin Mongo/bcrypt): la usa el proxy. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (PUBLIC.some((p) => path === p || path.startsWith(p + "/"))) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;

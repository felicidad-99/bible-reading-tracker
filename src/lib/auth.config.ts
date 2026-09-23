import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible Auth.js config for middleware only.
 * Full config (Prisma, bcrypt, Nodemailer) lives in auth.ts for Node runtimes.
 */
export const authConfig = {
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

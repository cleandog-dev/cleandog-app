import type { NextAuthConfig } from 'next-auth';

// Edge-safe config: no Prisma, no bcrypt — used by middleware.
export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: 'ADMIN' | 'STAFF' }).role ?? 'ADMIN';
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as 'ADMIN' | 'STAFF') ?? 'ADMIN';
      }
      return session;
    },
    authorized({ auth: a, request: { nextUrl } }) {
      const isAdminArea = nextUrl.pathname.startsWith('/admin');
      if (isAdminArea) return !!a?.user;
      return true;
    },
  },
} satisfies NextAuthConfig;

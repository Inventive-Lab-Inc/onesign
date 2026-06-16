import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  callbacks: {
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
    jwt({ token, account }) {
      if (account?.provider === "google" && account.providerAccountId) {
        token.googleSub = account.providerAccountId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.googleSub === "string") {
        session.user.googleSub = token.googleSub;
      }
      return session;
    },
  },
  trustHost: true,
});

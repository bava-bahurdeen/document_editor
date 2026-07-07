import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [], // leave empty here — real providers go in the full config
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user; // just checks session validity
    },
  },
} satisfies NextAuthConfig;
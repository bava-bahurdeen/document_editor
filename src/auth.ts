import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { PrismaAdapter } from "@auth/prisma-adapter"; // or whatever adapter you use
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./lib/db";
// ...your bcrypt/db imports etc.

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      // your real provider logic with bcrypt, DB lookups, etc.
    }),
  ],
});
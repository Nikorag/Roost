import NextAuth, { type DefaultSession } from "next-auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      icsToken: string;
    } & DefaultSession["user"];
  }
}

const issuer = process.env.OIDC_ISSUER;
const clientId = process.env.OIDC_CLIENT_ID;
const clientSecret = process.env.OIDC_CLIENT_SECRET;
const providerName = process.env.OIDC_PROVIDER_NAME ?? "SSO";

const allowed = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers:
    issuer && clientId && clientSecret
      ? [
          {
            id: "oidc",
            name: providerName,
            type: "oidc",
            issuer,
            clientId,
            clientSecret,
            authorization: { params: { scope: "openid email profile" } },
          },
        ]
      : [],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      if (allowed.length > 0 && !allowed.includes(email)) return false;
      return true;
    },
    async jwt({ token, profile, account }) {
      // On first sign-in profile/account are present; upsert the user.
      if (profile?.email) {
        const email = profile.email.toLowerCase();
        const sub = (profile.sub ?? account?.providerAccountId) as string | undefined;
        const existing = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);
        let row = existing[0];
        if (!row) {
          const [created] = await db
            .insert(schema.users)
            .values({
              email,
              name: (profile.name as string | undefined) ?? null,
              image: (profile.picture as string | undefined) ?? null,
              oidcSub: sub ?? null,
              icsToken: randomBytes(24).toString("hex"),
            })
            .returning();
          row = created;
        }
        token.uid = row.id;
        token.icsToken = row.icsToken;
        token.email = row.email;
        token.name = row.name ?? token.name;
        token.picture = row.image ?? token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      if (token.icsToken) session.user.icsToken = token.icsToken as string;
      return session;
    },
  },
  pages: { signIn: "/signin" },
});

export function authConfigured() {
  return Boolean(issuer && clientId && clientSecret);
}

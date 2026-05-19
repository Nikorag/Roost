import { signIn, authConfigured } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const configured = authConfigured();
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-gradient-to-br from-pastel-sky via-pastel-sky to-pastel-lilac">
      <div className="w-full max-w-md rounded-3xl bg-card/90 glass shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <LogoMark className="size-12" />
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Roost</h1>
            <p className="text-sm text-muted-foreground">Household project tracker</p>
          </div>
        </div>
        {configured ? (
          <form
            action={async () => {
              "use server";
              await signIn("oidc", { redirectTo: from ?? "/" });
            }}
          >
            <Button size="lg" className="w-full" type="submit">
              Continue with {process.env.OIDC_PROVIDER_NAME ?? "SSO"}
            </Button>
          </form>
        ) : (
          <div className="rounded-2xl bg-pastel-lemon p-4 text-sm">
            <p className="font-medium mb-1">OIDC not configured</p>
            <p className="text-muted-foreground">
              Set <code>OIDC_ISSUER</code>, <code>OIDC_CLIENT_ID</code>,{" "}
              <code>OIDC_CLIENT_SECRET</code> and <code>AUTH_SECRET</code> in your environment to
              enable sign-in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

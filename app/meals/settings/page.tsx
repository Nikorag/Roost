import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { excludeTagName, mealieConfigured } from "@/lib/mealie/client";
import { BackToMeals } from "@/components/meals/back-link";

export const dynamic = "force-dynamic";

export default async function MealsSettings() {
  const session = await auth();
  const base = process.env.APP_URL ?? "";
  const feedUrl = session?.user?.icsToken
    ? `${base}/api/meal-calendar.ics?token=${session.user.icsToken}`
    : "";

  return (
    <div className="space-y-4">
      <BackToMeals />
      <header>
        <h1 className="text-2xl font-semibold">Meals settings</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Meal calendar (ICS)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Subscribe in Apple, Google or Outlook calendar. Calendars refresh on their own cadence
            (Apple ~hourly, Google up to 24h).
          </p>
        </CardHeader>
        <CardContent>
          {feedUrl ? (
            <code className="block text-xs break-all rounded-2xl bg-muted px-3 py-2">{feedUrl}</code>
          ) : (
            <div className="text-sm text-muted-foreground">Sign in to see your private feed URL.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mealie</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {mealieConfigured() ? (
            <div className="text-emerald-700">Connected.</div>
          ) : (
            <div className="text-muted-foreground">
              Not configured. Set <code>MEALIE_BASE_URL</code> and <code>MEALIE_API_TOKEN</code> in
              your environment.
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            To exclude a recipe from AI weekly-plan suggestions, tag it{" "}
            <code>{excludeTagName()}</code> in Mealie. Override the tag name with{" "}
            <code>MEALIE_EXCLUDE_TAG</code>.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI assistant</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {process.env.GOOGLE_GENERATIVE_AI_API_KEY ? (
            <div className="text-emerald-700">Gemini configured.</div>
          ) : (
            <div className="text-muted-foreground">
              Set <code>GOOGLE_GENERATIVE_AI_API_KEY</code> to enable suggestions.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

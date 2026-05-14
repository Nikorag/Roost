import { Card, CardContent } from "@/components/ui/card";
import { NewRecipeClient } from "./new-recipe-client";
import { BackToMeals } from "@/components/meals/back-link";
import { mealieConfigured } from "@/lib/mealie/client";

export const dynamic = "force-dynamic";

export default function NewRecipePage() {
  return (
    <div className="space-y-4">
      <BackToMeals />
      <header>
        <h1 className="text-2xl font-semibold">New recipe</h1>
        <p className="text-sm text-muted-foreground">
          Give it a name, let AI suggest ingredients, then save to Mealie.
        </p>
      </header>
      <Card>
        <CardContent className="p-4">
          {mealieConfigured() ? (
            <NewRecipeClient />
          ) : (
            <div className="text-sm text-muted-foreground">
              Mealie isn&apos;t configured. Set <code>MEALIE_BASE_URL</code> and{" "}
              <code>MEALIE_API_TOKEN</code> in env first.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

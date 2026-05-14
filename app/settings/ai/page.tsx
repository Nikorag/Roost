import { Card, CardContent } from "@/components/ui/card";
import { AI_PROMPT_KEYS, getAllPromptAdditions } from "@/lib/ai-settings";
import { AiPromptsClient } from "./ai-prompts-client";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const current = await getAllPromptAdditions();
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">AI prompts</h1>
        <p className="text-sm text-muted-foreground">
          Add extra instructions to any AI feature. Use the global box for things that apply
          everywhere (dietary needs, family size, tone) and per-feature boxes for narrower tweaks.
        </p>
      </header>
      <div className="grid gap-3">
        {AI_PROMPT_KEYS.map((p) => (
          <Card key={p.key}>
            <CardContent className="p-4">
              <AiPromptsClient
                k={p.key}
                label={p.label}
                description={p.description}
                value={current[p.key] ?? ""}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

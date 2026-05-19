"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Lightbox } from "@/components/lightbox";
import { SmartImage } from "@/components/smart-image";
import { cn } from "@/lib/utils";

export type ProjectImage = {
  id: string;
  url: string;
  kind: "before" | "progress" | "after" | "other";
  caption: string | null;
  aiGenerated: boolean;
  createdAt: string;
};

type Actions = {
  setKind: (uploadId: string, kind: ProjectImage["kind"]) => Promise<void>;
  remove: (uploadId: string) => Promise<void>;
  setAi: (uploadId: string, aiGenerated: boolean) => Promise<void>;
  generateAfter: (input: { prompt: string; basedOnUploadId?: string }) => Promise<{
    uploadId: string;
    url: string;
  } | { error: string }>;
};

const KINDS: { value: ProjectImage["kind"]; label: string; tint: string }[] = [
  { value: "before", label: "Before", tint: "bg-pastel-rose text-rose-900" },
  { value: "progress", label: "Progress", tint: "bg-pastel-lemon text-yellow-900" },
  { value: "after", label: "After", tint: "bg-pastel-sky text-blue-900" },
  { value: "other", label: "Other", tint: "bg-muted text-muted-foreground" },
];

export function ProjectImages({
  projectId,
  projectTitle,
  projectDescription,
  images,
  actions,
}: {
  projectId: string;
  projectTitle: string;
  projectDescription: string | null;
  images: ProjectImage[];
  actions: Actions;
}) {
  const [pending, start] = useTransition();
  const [genOpen, setGenOpen] = useState(false);
  const [prompt, setPrompt] = useState(
    `A photorealistic interior photograph showing the finished result of "${projectTitle}".${projectDescription ? " " + projectDescription : ""}`,
  );
  const [basedOn, setBasedOn] = useState<string | null>(
    images.find((i) => i.kind === "before")?.id ?? null,
  );
  const [genError, setGenError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingKind, setPendingKind] = useState<ProjectImage["kind"]>("progress");

  async function handleFile(file: File) {
    setGenError(null);
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        projectId,
        kind: pendingKind,
      }),
    });
    if (!res.ok) {
      setGenError("Could not start upload.");
      return;
    }
    const data = await res.json();
    let putOk = false;
    try {
      const put = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      putOk = put.ok;
      if (!putOk) setGenError(`Upload failed (${put.status}).`);
    } catch (err) {
      setGenError(`Upload failed: ${(err as Error).message}`);
    }
    if (!putOk) {
      // remove the ghost row so it doesn't appear in the gallery
      await fetch(`/api/upload/${data.uploadId}`, { method: "DELETE" }).catch(() => {});
      return;
    }
    location.reload();
  }

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await actions.generateAfter({
        prompt: prompt.trim(),
        basedOnUploadId: basedOn ?? undefined,
      });
      if ("error" in res) {
        setGenError(res.error);
        return;
      }
      setGenOpen(false);
      location.reload();
    } finally {
      setGenerating(false);
    }
  }

  const grouped = {
    before: images.filter((i) => i.kind === "before"),
    progress: images.filter((i) => i.kind === "progress"),
    after: images.filter((i) => i.kind === "after"),
    other: images.filter((i) => i.kind === "other"),
  };

  // Flat list in display order for the lightbox.
  const lightboxOrder = [...grouped.before, ...grouped.progress, ...grouped.after, ...grouped.other];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm text-muted-foreground">Add as</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => {
                  setPendingKind(k.value);
                  fileInput.current?.click();
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1 border",
                  pendingKind === k.value ? k.tint + " border-transparent" : "hover:bg-muted",
                )}
              >
                <ImagePlus className="size-3.5" />
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setGenOpen((o) => !o)}
            className="rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1 bg-pastel-lilac text-purple-900"
          >
            <Wand2 className="size-3.5" />
            Generate after image
          </button>
        </div>
      </div>

      {genOpen && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="size-4 text-blue-700" />
            Imagine the finished project
          </div>
          {grouped.before.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Base on this "before" image:</p>
              <div className="flex flex-wrap gap-2">
                {grouped.before.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBasedOn(basedOn === b.id ? null : b.id)}
                    className={cn(
                      "size-16 rounded-xl overflow-hidden border-2 transition-colors",
                      basedOn === b.id ? "border-blue-500" : "border-transparent",
                    )}
                  >
                    <SmartImage src={b.url} alt="" wrapperClassName="size-full" className="size-full object-cover" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setBasedOn(null)}
                  className={cn(
                    "size-16 rounded-xl border-2 text-xs",
                    basedOn === null ? "border-blue-500 bg-blue-50" : "border-dashed",
                  )}
                >
                  Text only
                </button>
              </div>
            </div>
          )}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full min-h-[5rem] rounded-2xl border bg-background px-4 py-3 text-sm"
            placeholder="Describe the finished look…"
          />
          {genError && <p className="text-xs text-destructive">{genError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setGenOpen(false)}
              className="rounded-full px-3 h-9 text-xs hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={generate}
              disabled={generating || !prompt.trim()}
              className="rounded-full px-3 h-9 text-xs bg-primary text-primary-foreground disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Sparkles className="size-3.5" />
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
      )}

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images yet.</p>
      ) : (
        <div className="space-y-4">
          {(["before", "progress", "after", "other"] as const).map((k) => {
            const list = grouped[k];
            if (list.length === 0) return null;
            const tint = KINDS.find((kk) => kk.value === k)?.tint;
            return (
              <div key={k}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  <Badge className={tint}>{KINDS.find((kk) => kk.value === k)?.label}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {list.map((img) => (
                    <ImageTile
                      key={img.id}
                      img={img}
                      pending={pending}
                      onOpen={() =>
                        setLightboxIndex(lightboxOrder.findIndex((i) => i.id === img.id))
                      }
                      onSetKind={(kind) => start(() => actions.setKind(img.id, kind))}
                      onDelete={() => start(() => actions.remove(img.id))}
                      onToggleAi={() => start(() => actions.setAi(img.id, !img.aiGenerated))}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightboxIndex != null && (
        <Lightbox
          images={lightboxOrder.map((i) => ({
            id: i.id,
            url: i.url,
            caption: i.caption,
            aiGenerated: i.aiGenerated,
            kind: i.kind,
          }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={setLightboxIndex}
          actions={{
            setKind: (uploadId, kind) => actions.setKind(uploadId, kind),
            setAi: (uploadId, ai) => actions.setAi(uploadId, ai),
            remove: (uploadId) => actions.remove(uploadId),
          }}
        />
      )}
    </div>
  );
}

function ImageTile({
  img,
  pending,
  onOpen,
  onSetKind,
  onDelete,
  onToggleAi,
}: {
  img: ProjectImage;
  pending: boolean;
  onOpen: () => void;
  onSetKind: (kind: ProjectImage["kind"]) => void;
  onDelete: () => void;
  onToggleAi: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative rounded-2xl overflow-hidden border bg-muted aspect-square cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="View image"
    >
      <SmartImage
        src={img.url}
        alt={img.caption ?? ""}
        wrapperClassName="absolute inset-0 size-full"
        className="size-full object-cover"
      />
      {img.aiGenerated ? (
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Unmark this image as AI-generated?")) onToggleAi();
          }}
          className="absolute top-2 left-2"
          aria-label="Unmark as AI"
        >
          <Badge className="bg-pastel-lilac text-purple-900 cursor-pointer">
            <Sparkles className="size-3 mr-1" /> AI
          </Badge>
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            onToggleAi();
          }}
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-white/90 px-2 py-0.5 text-[11px] inline-flex items-center gap-1 text-purple-900"
          aria-label="Mark as AI"
          title="Mark as AI-generated"
        >
          <Sparkles className="size-3" /> Mark AI
        </button>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between gap-1">
          <select
            defaultValue={img.kind}
            disabled={pending}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onSetKind(e.target.value as ProjectImage["kind"]);
            }}
            className="text-[11px] rounded-full bg-white/90 px-2 py-0.5"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Delete image?")) onDelete();
            }}
            className="size-7 rounded-full bg-white/90 flex items-center justify-center text-destructive"
            aria-label="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

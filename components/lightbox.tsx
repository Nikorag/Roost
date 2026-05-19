"use client";

import { useEffect, useTransition } from "react";
import { ChevronLeft, ChevronRight, X, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/smart-image";
import { cn } from "@/lib/utils";

export type LightboxImage = {
  id: string;
  url: string;
  caption: string | null;
  aiGenerated: boolean;
  kind?: string;
};

type ImageKind = "before" | "progress" | "after" | "other";

const KINDS: { value: ImageKind; label: string; tint: string }[] = [
  { value: "before", label: "Before", tint: "bg-pastel-rose text-rose-900" },
  { value: "progress", label: "Progress", tint: "bg-pastel-lemon text-yellow-900" },
  { value: "after", label: "After", tint: "bg-pastel-sky text-blue-900" },
  { value: "other", label: "Other", tint: "bg-white/80 text-foreground" },
];

export type LightboxActions = {
  setKind?: (uploadId: string, kind: ImageKind) => Promise<void> | void;
  setAi?: (uploadId: string, aiGenerated: boolean) => Promise<void> | void;
  remove?: (uploadId: string) => Promise<void> | void;
};

export function Lightbox({
  images,
  index,
  onClose,
  onIndex,
  actions,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  actions?: LightboxActions;
}) {
  const [pending, start] = useTransition();
  const img = images[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndex((index + 1) % images.length);
      else if (e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, images.length, onClose, onIndex]);

  if (!img) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="absolute top-4 right-4 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
      >
        <X className="size-5" />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index - 1 + images.length) % images.length);
            }}
            aria-label="Previous"
            className="absolute left-4 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index + 1) % images.length);
            }}
            aria-label="Next"
            className="absolute right-4 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}

      <div className="max-w-[95vw] max-h-[85vh] flex items-center" onClick={(e) => e.stopPropagation()}>
        <SmartImage
          key={img.id}
          src={img.url}
          alt={img.caption ?? ""}
          loading="eager"
          wrapperClassName="rounded-2xl"
          className="max-w-[95vw] max-h-[85vh] object-contain"
        />
      </div>

      <div
        className="mt-4 flex flex-col items-center gap-3 text-white text-sm max-w-[95vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          {img.aiGenerated && !actions?.setAi && (
            <Badge className="bg-pastel-lilac text-purple-900">
              <Sparkles className="size-3 mr-1" /> AI
            </Badge>
          )}
          {img.kind && !actions?.setKind && (
            <span className="opacity-70 capitalize">{img.kind}</span>
          )}
          {img.caption && <span className="opacity-90">{img.caption}</span>}
          {images.length > 1 && (
            <span className="opacity-50">
              {index + 1} / {images.length}
            </span>
          )}
        </div>

        {actions && (actions.setKind || actions.setAi || actions.remove) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {actions.setKind &&
              KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(() => Promise.resolve(actions.setKind!(img.id, k.value)))
                  }
                  className={cn(
                    "rounded-full px-3 h-9 text-xs border border-white/20",
                    img.kind === k.value ? k.tint + " border-transparent" : "bg-white/10 text-white hover:bg-white/20",
                  )}
                >
                  {k.label}
                </button>
              ))}
            {actions.setAi && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(() => Promise.resolve(actions.setAi!(img.id, !img.aiGenerated)))
                }
                className={cn(
                  "rounded-full px-3 h-9 text-xs inline-flex items-center gap-1 border border-white/20",
                  img.aiGenerated
                    ? "bg-pastel-lilac text-purple-900 border-transparent"
                    : "bg-white/10 text-white hover:bg-white/20",
                )}
              >
                <Sparkles className="size-3.5" />
                {img.aiGenerated ? "AI" : "Mark AI"}
              </button>
            )}
            {actions.remove && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete image?")) {
                    start(async () => {
                      await Promise.resolve(actions.remove!(img.id));
                      onClose();
                    });
                  }
                }}
                className="rounded-full px-3 h-9 text-xs inline-flex items-center gap-1 bg-white/10 text-white hover:bg-red-500/30 border border-white/20"
                aria-label="Delete image"
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

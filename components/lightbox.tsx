"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/smart-image";

export type LightboxImage = {
  id: string;
  url: string;
  caption: string | null;
  aiGenerated: boolean;
  kind?: string;
};

export function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
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
        className="mt-4 flex items-center gap-2 text-white text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {img.aiGenerated && (
          <Badge className="bg-pastel-lilac text-purple-900">
            <Sparkles className="size-3 mr-1" /> AI
          </Badge>
        )}
        {img.kind && <span className="opacity-70 capitalize">{img.kind}</span>}
        {img.caption && <span className="opacity-90">{img.caption}</span>}
        {images.length > 1 && (
          <span className="opacity-50">
            · {index + 1} / {images.length}
          </span>
        )}
      </div>
    </div>
  );
}

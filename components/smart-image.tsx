"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  /** Optional class for the wrapper. The `className` prop styles the inner <img> as before. */
  wrapperClassName?: string;
};

/**
 * <img> with a pulsing skeleton until the real image decodes, then crossfades it in.
 * Use as a drop-in for `<img>` whenever the source is a user-uploaded photo over the network.
 */
export function SmartImage({ wrapperClassName, className, onLoad, onError, ...rest }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  return (
    <span className={cn("relative block overflow-hidden bg-muted", wrapperClassName)}>
      {!loaded && !errored && (
        <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...rest}
        loading={rest.loading ?? "lazy"}
        decoding={rest.decoding ?? "async"}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setErrored(true);
          onError?.(e);
        }}
        className={cn(
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </span>
  );
}

"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  careersUrl?: string | null;
  logoUrl?: string | null;
  size?: number;
  className?: string;
};

export function CompanyLogo({ name, careersUrl, logoUrl, size = 40, className }: Props) {
  const [errored, setErrored] = useState(false);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Derive a Clearbit URL from careersUrl host (free, ~1M reqs/mo)
  let resolved = logoUrl;
  if (!resolved && careersUrl) {
    try {
      const u = new URL(careersUrl);
      // Many ATS subdomains aren't the brand. Skip those.
      if (!/greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com/.test(u.hostname)) {
        resolved = `https://logo.clearbit.com/${u.hostname.replace(/^www\./, "")}`;
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md bg-muted overflow-hidden text-muted-foreground font-semibold",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {resolved && !errored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt={name}
          width={size}
          height={size}
          onError={() => setErrored(true)}
          className="object-cover w-full h-full"
        />
      ) : (
        <span>{initials || "?"}</span>
      )}
    </div>
  );
}

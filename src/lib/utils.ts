import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeCompanyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,'"()]/g, "")
    .replace(/\b(inc|incorporated|ltd|limited|llc|gmbh|sa|ag|plc|corp|corporation|co)\b\.?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeJobTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(sr|senior)\b/g, "senior")
    .replace(/\b(jr|junior)\b/g, "junior")
    .replace(/\s+/g, " ")
    .trim();
}

export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

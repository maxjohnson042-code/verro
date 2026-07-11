import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui helper: merge conditional class lists then dedupe
// conflicting Tailwind utility classes (e.g. "px-2 px-4" -> "px-4").
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

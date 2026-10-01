type ClassValue = string | false | null | undefined;

/** Concatène des classes en ignorant les valeurs vides. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}

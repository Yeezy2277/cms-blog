/** Pure helpers for the Author sidebar tool. */

/** "Vitaly Popov" -> "VP"; single names and extra spaces handled. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return letters.join("");
}

export function validateAuthorName(name: string): { ok: boolean; error?: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: "Name is too short." };
  if (trimmed.length > 80) return { ok: false, error: "Name is too long (max 80)." };
  return { ok: true };
}

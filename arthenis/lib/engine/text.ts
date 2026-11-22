/** Lowercase, accent-free, punctuation-to-space. Every lexical check runs on this form. */
export function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NEGATIONS = new Set(["sans", "pas", "aucun", "aucune", "ni", "jamais", "non", "anti", "nul", "nulle", "interdit", "interdite", "refuse", "refusent", "ignore", "ignorent"]);

/**
 * Finds `term` in normalised text, ignoring occurrences negated by one of the
 * three preceding words ("sans magie", "n'utilise pas la magie"). Matches on
 * word starts so "mage" does not fire on "image" or "fromage".
 */
export function mentions(text: string, term: string): boolean {
  const t = norm(term);
  if (!t) return false;
  const words = text.split(" ");
  const tw = t.split(" ");
  for (let i = 0; i <= words.length - tw.length; i++) {
    let ok = true;
    for (let k = 0; k < tw.length; k++) {
      const w = words[i + k];
      // last word of the term may be a prefix (sorcier → sorciers, sorcière)
      if (k === tw.length - 1 ? !w.startsWith(tw[k]) || w.length > tw[k].length + 2 : w !== tw[k]) { ok = false; break; }
    }
    if (!ok) continue;
    const before = words.slice(Math.max(0, i - 3), i);
    if (before.some(b => NEGATIONS.has(b))) continue;
    return true;
  }
  return false;
}

export function firstMention(text: string, terms: string[]): string | null {
  for (const term of terms) if (mentions(text, term)) return term;
  return null;
}

export function slug(s: string): string {
  return norm(s).replace(/\s+/g, "-").slice(0, 60);
}

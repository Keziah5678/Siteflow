/**
 * Maps database / auth errors to user-facing French messages. Unknown errors
 * are reported generically — the raw message is logged server-side, never
 * hidden, never shown verbatim to end users (it may leak internals).
 */
const CODES: Record<string, string> = {
  VENTURE_MINIMUM_AGE: "VENTURE est réservé aux personnes majeures (18 ans et plus).",
  VENTURE_BIRTHDATE_REQUIRED: "La date de naissance est requise.",
  VENTURE_RATE_LIMITED: "Trop d'actions en peu de temps. Réessaie dans quelques minutes.",
  VENTURE_FORBIDDEN: "Tu n'as pas l'autorisation d'effectuer cette action.",
  VENTURE_NOT_FOUND: "Élément introuvable.",
  VENTURE_ALREADY_DECIDED: "Cette demande a déjà été traitée.",
  VENTURE_BLOCKED: "Action impossible : un blocage existe entre vous.",
  VENTURE_CONTACT_REQUIRED: "Envoie d'abord une demande de contact à cette personne.",
  VENTURE_ALREADY_CONTACTS: "Vous êtes déjà en contact.",
  VENTURE_CANNOT_REMOVE_OWNER: "Le créateur du projet ne peut pas être retiré.",
  VENTURE_CANNOT_DEMOTE_OWNER: "Le rôle du créateur ne peut pas être modifié.",
  VENTURE_CANNOT_PROMOTE_OWNER: "Un projet n'a qu'un seul créateur.",
  VENTURE_ONLY_OWNER_PROMOTES: "Seul le créateur peut nommer des administrateurs.",
  VENTURE_ASSIGNEE_NOT_MEMBER: "La personne assignée doit faire partie de l'équipe.",
  VENTURE_INVALID: "Données invalides.",
  VENTURE_INVALID_TITLE: "Le titre doit contenir entre 2 et 80 caractères.",
  VENTURE_PLAN_REQUIRED: "Cette fonctionnalité nécessite l'offre VENTURE Business.",
};

export type ErrorLike = { message?: string; code?: string; details?: string | null; hint?: string | null } | null | undefined;

export function toUserMessage(error: ErrorLike, fallback = "Une erreur est survenue. Réessaie."): string {
  if (!error) return fallback;
  const msg = error.message ?? "";
  for (const key of Object.keys(CODES)) {
    if (msg.includes(key)) return CODES[key]!;
  }
  if (error.code === "23505") return "Cet élément existe déjà.";
  if (error.code === "42501" || /row-level security/i.test(msg)) return CODES.VENTURE_FORBIDDEN!;
  if (error.code === "23514") return "Certaines valeurs ne respectent pas les contraintes (longueur, format).";
  if (/Database error saving new user/i.test(msg)) return "Inscription impossible : vérifie ta date de naissance (18 ans minimum).";
  if (/Email not confirmed/i.test(msg)) return "Confirme d'abord ton adresse email (lien envoyé à l'inscription).";
  if (/Invalid login credentials/i.test(msg)) return "Email ou mot de passe incorrect.";
  if (/User already registered/i.test(msg)) return "Un compte existe déjà avec cet email.";
  if (/Password should|weak_password|Password is known/i.test(msg))
    return "Mot de passe trop faible : 10 caractères minimum, avec majuscules, minuscules et chiffres.";
  if (/rate limit|over_email_send_rate_limit/i.test(msg)) return CODES.VENTURE_RATE_LIMITED!;
  console.error("[venture] unmapped error:", error);
  return fallback;
}

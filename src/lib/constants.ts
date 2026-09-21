// Shared vocabulary used by the wizard UI, the business-profile validation
// schema, and the AI prompts — keeping one source of truth avoids the
// orchestrator and the UI drifting apart.

export const INDUSTRIES = [
  { value: "artisanat-btp", label: "Artisanat & BTP", kind: "service" },
  { value: "beaute-bien-etre", label: "Beauté & bien-être", kind: "service" },
  { value: "sante", label: "Santé & paramédical", kind: "service" },
  { value: "restauration", label: "Restauration", kind: "service" },
  { value: "commerce-detail", label: "Commerce de détail", kind: "product" },
  { value: "e-commerce", label: "E-commerce", kind: "product" },
  { value: "conseil-services-pro", label: "Conseil & services professionnels", kind: "service" },
  { value: "immobilier", label: "Immobilier", kind: "service" },
  { value: "evenementiel", label: "Événementiel", kind: "service" },
  { value: "education-formation", label: "Éducation & formation", kind: "service" },
  { value: "sport-loisirs", label: "Sport & loisirs", kind: "service" },
  { value: "autre", label: "Autre", kind: "service" },
] as const;

export const PRICE_TIERS = [
  { value: "economique", label: "Économique" },
  { value: "milieu-de-gamme", label: "Milieu de gamme" },
  { value: "premium", label: "Premium" },
  { value: "luxe", label: "Luxe" },
] as const;

export const TONES = [
  { value: "professionnel", label: "Professionnel" },
  { value: "chaleureux", label: "Chaleureux" },
  { value: "luxueux", label: "Luxueux" },
  { value: "dynamique", label: "Dynamique" },
  { value: "rassurant", label: "Rassurant" },
  { value: "expert", label: "Expert / technique" },
] as const;

export const VISUAL_STYLES = [
  { value: "moderne-epure", label: "Moderne épuré" },
  { value: "artisanal-chaleureux", label: "Artisanal chaleureux" },
  { value: "luxueux", label: "Luxueux" },
  { value: "corporate", label: "Corporate" },
  { value: "colore-vivant", label: "Coloré et vivant" },
  { value: "minimaliste", label: "Minimaliste" },
] as const;

export const GOALS = [
  { value: "devis", label: "Recevoir des demandes de devis" },
  { value: "rendez-vous", label: "Prendre des rendez-vous en ligne" },
  { value: "vente-ligne", label: "Vendre en ligne" },
  { value: "savoir-faire", label: "Présenter mon savoir-faire" },
  { value: "visibilite-locale", label: "Améliorer ma visibilité locale" },
  { value: "recrutement", label: "Recruter" },
  { value: "credibilite", label: "Renforcer ma crédibilité" },
] as const;

export const ANIMATION_INTENSITIES = [
  { value: "minimal", label: "Minimale" },
  { value: "subtle", label: "Discrète" },
  { value: "balanced", label: "Équilibrée" },
  { value: "dynamic", label: "Dynamique" },
  { value: "immersive", label: "Immersive" },
] as const;

export const SERVICE_SUGGESTIONS: Record<string, string[]> = {
  "artisanat-btp": ["Dépannage urgence", "Rénovation", "Installation", "Devis gratuit", "Entretien annuel"],
  "beaute-bien-etre": ["Coupe & coiffage", "Soin du visage", "Massage", "Épilation", "Manucure"],
  sante: ["Consultation", "Suivi personnalisé", "Téléconsultation", "Bilan"],
  restauration: ["Menu du jour", "Livraison", "Événements privés", "Click & collect"],
  "commerce-detail": ["Click & collect", "Livraison locale", "Conseil personnalisé"],
  "e-commerce": ["Livraison rapide", "Retours gratuits", "Programme fidélité"],
  "conseil-services-pro": ["Audit", "Accompagnement", "Formation", "Consultation initiale"],
  immobilier: ["Estimation gratuite", "Visite virtuelle", "Gestion locative"],
  evenementiel: ["Organisation complète", "Location de matériel", "Coordination le jour J"],
  "education-formation": ["Cours particuliers", "Ateliers de groupe", "Formation certifiante"],
  "sport-loisirs": ["Cours collectifs", "Coaching individuel", "Abonnement mensuel"],
  autre: ["Devis gratuit", "Consultation initiale"],
};

export function industryLabel(value: string): string {
  return INDUSTRIES.find((i) => i.value === value)?.label ?? value;
}

export function industryKind(value: string): "service" | "product" {
  return INDUSTRIES.find((i) => i.value === value)?.kind ?? "service";
}

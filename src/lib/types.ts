// Domain types mirroring the Supabase schema (see supabase/migrations/0001_init.sql).
// These are the single source of truth for shapes passed between the DB,
// the AI orchestrator modules, and the UI.

export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export type ProjectStatus = "draft" | "generating" | "active" | "archived";

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type PriceTier = "economique" | "milieu-de-gamme" | "premium" | "luxe";

export interface BusinessProfile {
  id: string;
  project_id: string;
  company: string;
  industry: string;
  activity: string | null;
  location: string | null;
  services: string[];
  target_audience: string | null;
  goals: string[];
  positioning: string | null;
  tone: string | null;
  visual_style: string | null;
  price_tier: PriceTier | null;
  contact: {
    email?: string;
    phone?: string;
    address?: string;
  };
  social_links: Record<string, string>;
  brand_colors: string[];
  has_logo: boolean;
  logo_url: string | null;
  photos: string[];
  raw_answers: Record<string, unknown>;
  completeness: number;
  created_at: string;
  updated_at: string;
}

export type AnimationIntensity =
  | "minimal"
  | "subtle"
  | "balanced"
  | "dynamic"
  | "immersive";

export interface DesignSystem {
  id: string;
  project_id: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    foreground: string;
    muted: string;
    border: string;
  };
  typography: {
    heading_font: string;
    body_font: string;
    scale: "compact" | "comfortable" | "spacious";
  };
  spacing_scale: "tight" | "regular" | "airy";
  radii: "sharp" | "soft" | "round";
  shadows: "none" | "subtle" | "elevated";
  button_style: "solid" | "outline" | "soft" | "minimal";
  animation_intensity: AnimationIntensity;
  created_at: string;
  updated_at: string;
}

export type WebsiteStatus = "draft" | "published";

export interface Website {
  id: string;
  project_id: string;
  status: WebsiteStatus;
  domain: string | null;
  public_slug: string | null;
  global_seo: {
    site_title?: string;
    site_description?: string;
    og_image?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: string;
  website_id: string;
  slug: string;
  title: string;
  is_home: boolean;
  nav_order: number;
  status: "draft" | "published";
  seo: {
    title?: string;
    description?: string;
    og_image?: string;
  };
  created_at: string;
  updated_at: string;
}

export type SectionType =
  | "hero"
  | "services"
  | "about"
  | "gallery"
  | "faq"
  | "contact"
  | "cta"
  | "features"
  | "process"
  | "pricing"
  | "form"
  | "text"
  | "footer"
  | "nav";

export interface Section {
  id: string;
  page_id: string;
  type: SectionType;
  position: number;
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SiteVersion {
  id: string;
  website_id: string;
  label: string;
  snapshot: WebsiteSnapshot;
  created_by: string | null;
  created_at: string;
}

export interface WebsiteSnapshot {
  website: Website;
  pages: Array<Page & { sections: Section[] }>;
  design_system: DesignSystem | null;
}

export type FormType =
  | "devis"
  | "rendez-vous"
  | "contact"
  | "intervention"
  | "information";

export interface ProjectForm {
  id: string;
  project_id: string;
  name: string;
  type: FormType;
  fields: FormField[];
  target_section_id: string | null;
  created_at: string;
}

export interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select" | "date" | "checkbox";
  required: boolean;
  options?: string[];
}

export type LeadStatus =
  | "nouveau"
  | "contacte"
  | "qualifie"
  | "rendez-vous"
  | "proposition"
  | "gagne"
  | "perdu";

export interface Lead {
  id: string;
  project_id: string;
  form_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: string;
  status: LeadStatus;
  form_data: Record<string, unknown>;
  notes: LeadNote[];
  created_at: string;
  updated_at: string;
}

export interface LeadNote {
  id: string;
  body: string;
  created_at: string;
}

export type ConversationType = "modification" | "assistant";

export interface Conversation {
  id: string;
  project_id: string;
  type: ConversationType;
  created_at: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  structured_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface SeoAudit {
  id: string;
  project_id: string;
  scores: AuditScores;
  issues: AuditIssue[];
  created_at: string;
}

export interface AuditScores {
  design: number;
  content: number;
  seo: number;
  responsive: number;
  accessibility: number;
  performance: number;
  security: number;
  conversion: number;
  consistency: number;
  overall: number;
}

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditIssue {
  category: keyof Omit<AuditScores, "overall">;
  severity: AuditSeverity;
  title: string;
  description: string;
  suggestion: string | null;
  auto_fixable: boolean;
}

export interface Automation {
  id: string;
  project_id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

export interface WorkspaceSettings {
  id: string;
  workspace_id: string;
  billing: {
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    plan?: "free" | "pro" | "business";
  };
  created_at: string;
  updated_at: string;
}

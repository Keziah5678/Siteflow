/** Shape the image prompt builder (kept from the beta) expects. */
export type CoherenceResult = { decision: "accept" | "modify" | "reject"; reason: string; consequences: string[] };

export type WorldContext = {
  name: string;
  theme: string;
  fictionEnabled: boolean;
  fictionalCreaturesEnabled: boolean;
  magicEnabled: boolean;
  rules: Array<{ title: string; description: string; immutable?: boolean }>;
  memory?: Record<string, unknown>;
  visualBible?: Record<string, unknown>;
};

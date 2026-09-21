/**
 * Abstraction over an AI image generation provider, so the concrete vendor
 * (OpenAI Images, Stability, etc.) can be swapped without touching callers.
 * When no provider is configured, `generate` returns null — callers must
 * fall back to a neutral, clearly-a-placeholder visual treatment, never a
 * generic stock photo presented as if it were the business's own image.
 */
export interface GeneratedImage {
  url: string;
  provider: string;
}

export interface ImageGenerationProvider {
  name: string;
  generate(prompt: string): Promise<GeneratedImage | null>;
}

class OpenAIImageProvider implements ImageGenerationProvider {
  name = "openai";

  async generate(prompt: string): Promise<GeneratedImage | null> {
    const apiKey = process.env.IMAGE_GENERATION_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json as string | undefined;
    const url = data?.data?.[0]?.url as string | undefined;
    if (url) return { url, provider: this.name };
    if (b64) return { url: `data:image/png;base64,${b64}`, provider: this.name };
    return null;
  }
}

export class ImageGenerationService {
  private provider: ImageGenerationProvider | null;

  constructor() {
    const configured = process.env.IMAGE_GENERATION_PROVIDER;
    if (configured === "openai" || (!configured && process.env.OPENAI_API_KEY)) {
      this.provider = new OpenAIImageProvider();
    } else {
      this.provider = null;
    }
  }

  isConfigured(): boolean {
    return this.provider !== null;
  }

  async generate(prompt: string): Promise<GeneratedImage | null> {
    if (!this.provider) return null;
    try {
      return await this.provider.generate(prompt);
    } catch {
      return null;
    }
  }
}

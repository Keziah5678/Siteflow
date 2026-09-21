import type { ImageGenerationService } from "@/lib/ai/modules/image-generation-service";

const MAX_IMAGE_CALLS = 6;

interface SectionLike {
  type: string;
  content: Record<string, unknown>;
}
interface PageLike {
  sections: SectionLike[];
}

/**
 * Resolves `image_prompt`/`image_prompts` placeholders left by
 * ContentGenerator into real `image_url`/`image_urls` via
 * ImageGenerationService, when a provider is configured. Bounded to avoid
 * excessive latency/cost on generation. Sections without a resolved image
 * keep their prompt only — the renderer shows an explicit placeholder
 * rather than a fake stock photo.
 */
export async function enrichImages<T extends PageLike>(pages: T[], images: ImageGenerationService): Promise<T[]> {
  if (!images.isConfigured()) return pages;

  let calls = 0;

  const result: T[] = [];
  for (const page of pages) {
    const sections: SectionLike[] = [];
    for (const section of page.sections) {
      const content = { ...section.content };

      if (calls < MAX_IMAGE_CALLS && typeof content.image_prompt === "string") {
        const generated = await images.generate(content.image_prompt);
        calls += 1;
        if (generated) content.image_url = generated.url;
      }

      if (calls < MAX_IMAGE_CALLS && Array.isArray(content.image_prompts)) {
        const urls: string[] = [];
        for (const prompt of content.image_prompts as string[]) {
          if (calls >= MAX_IMAGE_CALLS) break;
          const generated = await images.generate(prompt);
          calls += 1;
          if (generated) urls.push(generated.url);
        }
        if (urls.length > 0) content.image_urls = urls;
      }

      sections.push({ ...section, content });
    }
    result.push({ ...page, sections } as T);
  }
  return result;
}

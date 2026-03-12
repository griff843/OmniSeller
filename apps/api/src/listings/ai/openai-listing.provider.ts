import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import {
  ListingAiProvider,
  ListingGenerationInput,
  ListingGenerationResult,
  listingSuggestionSchema,
} from './listing-ai.contract';
import { ListingPromptBuilder } from './listing-prompt-builder.service';

@Injectable()
export class OpenAiListingProvider implements ListingAiProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly promptBuilder: ListingPromptBuilder,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>('OPENAI_API_KEY'));
  }

  async generateSuggestion(input: ListingGenerationInput): Promise<ListingGenerationResult> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model = this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';

    if (!apiKey) {
      throw new ServiceUnavailableException('Missing OPENAI_API_KEY for AI listing generation');
    }

    const payload = {
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: this.promptBuilder.buildSystemInstruction(),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(this.promptBuilder.buildUserContext(input), null, 2),
            },
            ...input.photoContexts.slice(0, 4).map((photo) => ({
              type: 'input_image',
              image_url: photo.url,
              detail: photo.isPrimary ? 'high' : 'low',
            })),
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'listing_suggestion',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'description', 'category', 'priceCents', 'itemSpecifics'],
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
              priceCents: { type: 'number' },
              itemSpecifics: {
                type: 'object',
                additionalProperties: { type: 'string' },
              },
            },
          },
        },
      },
    };

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.json();

    if (!response.ok) {
      throw new InternalServerErrorException(
        `OpenAI listing generation failed: ${response.status} ${JSON.stringify(raw)}`,
      );
    }

    const text = this.extractText(raw);

    if (!text) {
      throw new InternalServerErrorException('OpenAI listing generation returned no structured output');
    }

    let parsedText: unknown;

    try {
      parsedText = JSON.parse(text);
    } catch {
      throw new InternalServerErrorException('OpenAI listing generation returned malformed JSON');
    }

    const parsed = listingSuggestionSchema.safeParse(parsedText);

    if (!parsed.success) {
      throw new InternalServerErrorException(
        `OpenAI listing generation failed schema validation: ${parsed.error.message}`,
      );
    }

    return {
      provider: 'openai',
      model,
      output: parsed.data,
      rawResponse: raw,
    };
  }

  private extractText(raw: any): string | null {
    if (typeof raw?.output_text === 'string' && raw.output_text.length > 0) {
      return raw.output_text;
    }

    const outputs = Array.isArray(raw?.output) ? raw.output : [];

    for (const output of outputs) {
      const contents = Array.isArray(output?.content) ? output.content : [];

      for (const content of contents) {
        if (typeof content?.text === 'string' && content.text.length > 0) {
          return content.text;
        }
      }
    }

    return null;
  }
}

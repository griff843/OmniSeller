import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ApplyAiSuggestionDto {
  @IsString()
  suggestionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  fields!: Array<'title' | 'description' | 'category' | 'priceCents' | 'itemSpecifics'>;
}

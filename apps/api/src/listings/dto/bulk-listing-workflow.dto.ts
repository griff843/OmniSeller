import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export const LISTING_BULK_WORKFLOW_LIMIT = 25;
export const LISTING_BULK_AI_LIMIT = 10;

export class BulkListingWorkflowDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LISTING_BULK_WORKFLOW_LIMIT)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  itemIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  marketplace?: string;
}

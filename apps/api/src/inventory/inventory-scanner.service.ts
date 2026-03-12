import { Injectable } from '@nestjs/common';

@Injectable()
export class InventoryScannerService {
  normalizeScanCode(input: string): string {
    return input.trim().replace(/\s+/g, '').toUpperCase();
  }

  describeFutureLookupBoundary() {
    return {
      provider: 'not-configured',
      canLookupByScanCode: false,
      note: 'Future mobile or hardware scanner lookup should plug into this boundary instead of UI components.',
    };
  }
}

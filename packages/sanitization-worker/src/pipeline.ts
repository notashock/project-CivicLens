import { BlurBoundingBox } from './canvas-blur';
import { StructuredObservation, validateAndFormatNarrative } from './text-neutrality';
import { sanitizeMedia, MediaSanitizationOptions, SanitizedMediaResult } from './media-sanitizer';

export interface SanitizeObservationInput {
  observation: StructuredObservation;
  mediaFile?: File | Blob | string | null;
  blurRegions?: BlurBoundingBox[];
  preBlurEnabled?: boolean;
  rawBufferInput?: {
    pixelData: Uint8ClampedArray;
    width: number;
    height: number;
  };
  mediaOptions?: Partial<MediaSanitizationOptions>;
}

export interface SanitizedObservationResult {
  isValid: boolean;
  violations: string[];
  sanitizedNarrative?: string;
  mediaDataBase64?: string;
  mediaMetadata?: {
    width: number;
    height: number;
    isSanitized: boolean;
  };
}

/**
 * Deep Consolidated Client Sanitization Seam.
 * Orchestrates factual narrative neutrality filtering and media pre-blurring / EXIF stripping.
 */
export async function sanitizeObservation(
  input: SanitizeObservationInput
): Promise<SanitizedObservationResult> {
  const violations: string[] = [];

  // 1. Text neutrality & factual narrative validation
  const textResult = validateAndFormatNarrative(input.observation);
  if (!textResult.isNeutral) {
    violations.push(...textResult.violations);
  }

  let sanitizedMedia: SanitizedMediaResult | undefined;

  // 2. Media sanitization if image provided or pure buffer supplied
  if (input.mediaFile || input.rawBufferInput) {
    try {
      sanitizedMedia = await sanitizeMedia(input.mediaFile, {
        preBlur: input.preBlurEnabled ?? true,
        blurRegions: input.blurRegions,
        rawBufferInput: input.rawBufferInput,
        ...input.mediaOptions,
      });
    } catch (err: any) {
      violations.push(`Media sanitization error: ${err.message || 'Failed to process evidence image'}`);
    }
  }

  const isValid = violations.length === 0;

  return {
    isValid,
    violations,
    sanitizedNarrative: isValid ? textResult.sanitizedNarrative : undefined,
    mediaDataBase64: isValid && sanitizedMedia ? sanitizedMedia.dataUrl : undefined,
    mediaMetadata: sanitizedMedia ? {
      width: sanitizedMedia.width,
      height: sanitizedMedia.height,
      isSanitized: sanitizedMedia.isSanitized,
    } : undefined,
  };
}

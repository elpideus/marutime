import sharp, { type Metadata } from 'sharp';

export type ImageKind = 'avatar' | 'cover' | 'comment' | 'list-cover';

export type ProcessedImage = { data: Uint8Array; width: number; height: number; contentType: 'image/webp' };

const PRESETS: Record<ImageKind, { width: number; height?: number; fit: 'cover' | 'inside'; quality: number }> = {
  avatar: { width: 512, height: 512, fit: 'cover', quality: 85 },
  cover: { width: 1800, height: 600, fit: 'cover', quality: 82 },
  'list-cover': { width: 1200, height: 675, fit: 'cover', quality: 82 },
  comment: { width: 1600, fit: 'inside', quality: 82 },
};

const ALLOWED = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif']);

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

/**
 * Validate, strip metadata (EXIF/GPS), resize and re-encode as WebP.
 * Re-encoding also neutralises malformed files that could exploit viewers.
 */
export async function processImage(input: Uint8Array, kind: ImageKind): Promise<ProcessedImage> {
  const preset = PRESETS[kind];
  let meta: Metadata;
  try {
    meta = await sharp(input, { animated: kind === 'comment' }).metadata();
  } catch {
    throw new ImageError('The file is not a valid image');
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new ImageError(`Unsupported image format: ${meta.format ?? 'unknown'}`);
  if ((meta.width ?? 0) < 32 || (meta.height ?? 0) < 32) throw new ImageError('Image is too small');
  if ((meta.width ?? 0) > 12000 || (meta.height ?? 0) > 12000) throw new ImageError('Image dimensions are too large');

  const animated = kind === 'comment' && (meta.pages ?? 1) > 1;
  const pipeline = sharp(input, { animated })
    .rotate()
    .resize({
      width: preset.width,
      height: preset.height,
      fit: preset.fit,
      withoutEnlargement: true,
      position: 'attention',
    })
    .webp({ quality: preset.quality, effort: 4 });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8Array(data),
    width: info.width,
    height: animated ? Math.round(info.height / (meta.pages ?? 1)) : info.height,
    contentType: 'image/webp',
  };
}

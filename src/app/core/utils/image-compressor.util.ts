export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
}

const DEFAULTS: Required<CompressImageOptions> = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.82,
  mimeType: 'image/jpeg',
};

/**
 * Compresses an image File via canvas for private Storage uploads.
 * Output matches MinchApp convention: JPEG under recipe-images/{household}/{recipe}.jpg
 */
export async function compressImage(
  file: File | Blob,
  options: CompressImageOptions = {},
): Promise<Blob> {
  const { maxWidth, maxHeight, quality, mimeType } = { ...DEFAULTS, ...options };

  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('No se pudo inicializar el canvas para comprimir la imagen.');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), mimeType, quality),
  );

  if (!blob) {
    throw new Error('La compresión de imagen falló.');
  }

  return blob;
}

export function recipeImagePath(householdId: string, recipeId: string): string {
  return `${householdId}/${recipeId}.jpg`;
}

/** Compat helper used by AiRecipeService (max edge + JPEG quality). */
export async function compressRecipeImage(
  file: File | Blob,
  maxEdge = 1200,
  quality = 0.85,
): Promise<Blob> {
  return compressImage(file, {
    maxWidth: maxEdge,
    maxHeight: maxEdge,
    quality,
    mimeType: 'image/jpeg',
  });
}

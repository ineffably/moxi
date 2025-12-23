/**
 * Image Import Utility
 * Handles importing PNG images as spritesheets
 */
import { readFileAsImage } from '../handlers/file-drop-handler';
import { SpriteSheetType } from '../controllers/sprite-sheet-controller';
import { PICO8_PALETTE, TIC80_PALETTE } from '../theming/palettes';

export interface ImportedSpritesheet {
  /** Extracted name from filename (without extension) */
  name: string;
  /** Detected or default sprite sheet type */
  type: SpriteSheetType;
  /** Pixel data as 2D array of color indices */
  pixels: number[][];
  /** Original image width */
  width: number;
  /** Original image height */
  height: number;
}

export interface ImageImportOptions {
  /** Target palette to map colors to */
  palette: number[];
  /** Target sprite sheet type */
  type: SpriteSheetType;
}

/**
 * Import a PNG file as spritesheet pixel data
 * @param file The PNG file to import
 * @param options Import options including palette and type
 * @returns Imported spritesheet data
 */
export async function importPngAsSpritesheet(
  file: File,
  options: ImageImportOptions
): Promise<ImportedSpritesheet> {
  const { palette, type } = options;

  // Extract name from filename
  const name = extractNameFromFilename(file.name);

  // Load the image
  const img = await readFileAsImage(file);

  // Get image dimensions
  const width = img.width;
  const height = img.height;

  // Create canvas and draw image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  ctx.drawImage(img, 0, 0);

  // Read pixel data
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Convert to color indices
  const pixels: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // If transparent, use color index 0 (usually transparent/black)
      if (a < 128) {
        row.push(0);
      } else {
        // Find nearest palette color
        const colorIndex = findNearestPaletteColor(r, g, b, palette);
        row.push(colorIndex);
      }
    }
    pixels.push(row);
  }

  return {
    name,
    type,
    pixels,
    width,
    height
  };
}

/**
 * Extract a name from a filename (remove extension)
 */
export function extractNameFromFilename(filename: string): string {
  // Remove path if present
  const baseName = filename.split('/').pop() || filename;
  // Remove extension
  const dotIndex = baseName.lastIndexOf('.');
  return dotIndex > 0 ? baseName.substring(0, dotIndex) : baseName;
}

/**
 * Find the nearest color in a palette to the given RGB values
 * Uses Euclidean distance in RGB color space
 */
export function findNearestPaletteColor(
  r: number,
  g: number,
  b: number,
  palette: number[]
): number {
  let nearestIndex = 0;
  let nearestDistance = Infinity;

  for (let i = 0; i < palette.length; i++) {
    const color = palette[i];
    const pr = (color >> 16) & 0xff;
    const pg = (color >> 8) & 0xff;
    const pb = color & 0xff;

    // Euclidean distance
    const distance = Math.sqrt(
      Math.pow(r - pr, 2) +
      Math.pow(g - pg, 2) +
      Math.pow(b - pb, 2)
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  return nearestIndex;
}

/**
 * Detect the best sprite sheet type based on image dimensions
 * PICO-8: 128x128 (16x16 cells of 8x8 sprites)
 * TIC-80: 256x256 (32x32 cells of 8x8 sprites)
 */
export function detectSpriteSheetType(width: number, height: number): SpriteSheetType {
  // Check for exact matches first
  if (width === 128 && height === 128) {
    return 'PICO-8';
  }
  if (width === 256 && height === 256) {
    return 'TIC-80';
  }

  // Check for multiples of cell size
  if (width <= 128 && height <= 128) {
    return 'PICO-8';
  }

  return 'TIC-80';
}

/**
 * Resize pixel data to fit target dimensions
 * If source is smaller, it will be placed in top-left corner
 * If source is larger, it will be cropped
 */
export function resizePixelData(
  pixels: number[][],
  targetWidth: number,
  targetHeight: number
): number[][] {
  const result: number[][] = [];

  for (let y = 0; y < targetHeight; y++) {
    const row: number[] = [];
    for (let x = 0; x < targetWidth; x++) {
      if (y < pixels.length && x < pixels[y].length) {
        row.push(pixels[y][x]);
      } else {
        row.push(0); // Fill with transparent/black
      }
    }
    result.push(row);
  }

  return result;
}

/**
 * Get the palette for a sprite sheet type
 */
export function getPaletteForType(type: SpriteSheetType): number[] {
  return type === 'PICO-8' ? PICO8_PALETTE : TIC80_PALETTE;
}

/**
 * Get the dimensions for a sprite sheet type
 */
export function getDimensionsForType(type: SpriteSheetType): { width: number; height: number } {
  return type === 'PICO-8'
    ? { width: 128, height: 128 }
    : { width: 256, height: 256 };
}

/**
 * Tool icons for the sprite editor
 * Icons defined as 10x9 ASCII grids (# = filled, . = empty)
 * Each cell = GRID.scale pixels. Icons are centered in button content area.
 *
 * Button content area (press mode): 12 wide × 11 tall grid units
 * Icon: 10 wide × 9 tall cells
 * Centering: (12-10)/2 = 1 grid unit horizontal, (11-9)/2 = 1 grid unit vertical
 */
import * as PIXI from 'pixi.js';

export type ToolType = 'pencil' | 'eraser' | 'fill' | 'eyedrop' | 'selection' | 'shape';
export type ShapeType = 'line' | 'circle' | 'circle-filled' | 'square' | 'square-filled';
export type PlaybackIconType = 'play' | 'pause' | 'loop' | 'pingpong' | 'add-frame' | 'settings';

// Cache for generated textures
const textureCache: Map<string, PIXI.Texture> = new Map();

/**
 * 10x9 ASCII icon definitions (10 wide × 9 tall)
 * # = filled pixel, . = empty, E = eraser fill (light gray)
 * No built-in margins - icons are centered by the button component
 */
const TOOL_ICON_GRIDS: Record<ToolType, string> = {
  pencil: `
.......##.
......###.
.....###..
....###...
...###....
..###.....
..##......
.#........
..........
`.trim(),

  eraser: `
..........
..........
..#######.
.########.
#######.#.
#.....##..
#######...
..........
..........
`.trim(),

  fill: `
..######..
.#.####.#.
.########..
.#.#.#..#..
.#...#..#..
.#......#..
.#......#..
..######...
`.trim(),

  eyedrop: `
...###....
...###....
....#.....
....#.....
....#.....
....#.....
....#.....
....#.....
..........
`.trim(),

  selection: `
####..####
#........#
#........#
..........
..........
#........#
#........#
#........#
####..####
`.trim(),

  shape: `
.....####.
.....#..#.
#####.##..
#...#.....
#...#.....
#...#.....
#...#.....
#####.....
..........
`.trim()
};

const SHAPE_ICON_GRIDS: Record<ShapeType, string> = {
  line: `
.........#
........#.
.......#..
......#...
.....#....
....#.....
...#......
..#.......
.#........
`.trim(),

  circle: `
...####...
.##....##.
#........#
#........#
#........#
#........#
#........#
.##....##.
...####...
`.trim(),

  'circle-filled': `
...####...
.########.
##########
##########
##########
##########
##########
.########.
...####...
`.trim(),

  square: `
##########
#........#
#........#
#........#
#........#
#........#
#........#
#........#
##########
`.trim(),

  'square-filled': `
##########
##########
##########
##########
##########
##########
##########
##########
##########
`.trim()
};

/**
 * 8x8 ASCII playback icon definitions (compact for title bar controls)
 * # = filled pixel, . = empty
 */
const PLAYBACK_ICON_GRIDS: Record<PlaybackIconType, string> = {
  play: `
..#.....
..##....
..###...
..####..
..###...
..##....
..#.....
........
`.trim(),

  pause: `
.##.##..
.##.##..
.##.##..
.##.##..
.##.##..
.##.##..
.##.##..
........
`.trim(),

  loop: `
..####..
.#....#.
#......#
#..##..#
#..##..#
#......#
.#....#.
..####..
`.trim(),

  pingpong: `
........
#......#
##....##
###..###
###..###
##....##
#......#
........
`.trim(),

  'add-frame': `
...##...
...##...
...##...
########
########
...##...
...##...
...##...
`.trim(),

  settings: `
..#..#..
.######.
##....##
#..##..#
#..##..#
##....##
.######.
..#..#..
`.trim()
};

/**
 * Parse ASCII grid and render to Graphics at target size
 * Each cell is rendered as (pixelSize x pixelSize) rectangle
 * Renders directly at target size for pixel-perfect results (like SVG approach)
 */
function renderAsciiGrid(grid: string, color: number, pixelSize: number): PIXI.Graphics {
  const g = new PIXI.Graphics();
  g.roundPixels = true;

  const lines = grid.split('\n');
  const gridSize = lines.length; // Should be 12
  const totalSize = gridSize * pixelSize;

  // Force full bounds by drawing transparent pixels at corners
  g.rect(0, 0, 1, 1);
  g.fill({ color: 0x000000, alpha: 0 });
  g.rect(totalSize - 1, totalSize - 1, 1, 1);
  g.fill({ color: 0x000000, alpha: 0 });

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    for (let x = 0; x < line.length; x++) {
      const char = line[x];
      if (char === '#') {
        g.rect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        g.fill({ color });
      } else if (char === 'E') {
        g.rect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        g.fill({ color: 0xeeeeee });
      }
    }
  }

  return g;
}

/**
 * Draw ASCII grid directly into an existing Graphics object at a position.
 * Use this to draw icons in the same pass as button backgrounds for perfect grid alignment.
 *
 * @param g - Graphics object to draw into
 * @param grid - ASCII grid string (10x9 for tool/shape icons)
 * @param offsetX - X position in pixels (should be grid-aligned)
 * @param offsetY - Y position in pixels (should be grid-aligned)
 * @param color - Icon color
 * @param pixelSize - Size of each grid cell in pixels (typically GRID.scale)
 */
function drawAsciiGridInto(g: PIXI.Graphics, grid: string, offsetX: number, offsetY: number, color: number, pixelSize: number): void {
  const lines = grid.split('\n');

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    for (let x = 0; x < line.length; x++) {
      const char = line[x];
      if (char === '#') {
        g.rect(offsetX + x * pixelSize, offsetY + y * pixelSize, pixelSize, pixelSize);
        g.fill({ color });
      } else if (char === 'E') {
        g.rect(offsetX + x * pixelSize, offsetY + y * pixelSize, pixelSize, pixelSize);
        g.fill({ color: 0xeeeeee });
      }
    }
  }
}

/**
 * Draw a tool icon directly into a Graphics object.
 * Perfect for drawing icons in the same pass as button backgrounds.
 */
export function drawToolIconInto(g: PIXI.Graphics, tool: ToolType, offsetX: number, offsetY: number, color: number, pixelSize: number): void {
  drawAsciiGridInto(g, TOOL_ICON_GRIDS[tool], offsetX, offsetY, color, pixelSize);
}

/**
 * Draw a shape icon directly into a Graphics object.
 * Perfect for drawing icons in the same pass as button backgrounds.
 */
export function drawShapeIconInto(g: PIXI.Graphics, shape: ShapeType, offsetX: number, offsetY: number, color: number, pixelSize: number): void {
  drawAsciiGridInto(g, SHAPE_ICON_GRIDS[shape], offsetX, offsetY, color, pixelSize);
}

/**
 * Draws a tool icon from ASCII grid at target size
 */
function drawToolGraphic(tool: ToolType, color: number, pixelSize: number): PIXI.Graphics {
  return renderAsciiGrid(TOOL_ICON_GRIDS[tool], color, pixelSize);
}

/**
 * Draws a shape icon from ASCII grid at target size
 */
function drawShapeGraphic(shape: ShapeType, color: number, pixelSize: number): PIXI.Graphics {
  return renderAsciiGrid(SHAPE_ICON_GRIDS[shape], color, pixelSize);
}

/** Icon dimensions: 10 wide × 9 tall cells */
export const ICON_WIDTH = 10;
export const ICON_HEIGHT = 9;

/**
 * Creates a tool icon sprite rendered directly at target size
 * No sprite scaling needed - texture is generated at final size for pixel-perfect rendering
 */
export function createToolIcon(tool: ToolType, size: number, color: number, renderer: PIXI.Renderer): PIXI.Sprite {
  // Cache key includes size since we render at target size
  const pixelSize = Math.floor(size / ICON_WIDTH);
  const cacheKey = `${tool}_${color}_${pixelSize}`;

  if (!textureCache.has(cacheKey)) {
    const graphic = drawToolGraphic(tool, color, pixelSize);
    graphic.roundPixels = true;

    const texture = renderer.generateTexture({
      target: graphic,
      resolution: 1,
      antialias: false
    });

    texture.source.scaleMode = 'nearest';
    graphic.destroy();
    textureCache.set(cacheKey, texture);
  }

  const sprite = new PIXI.Sprite(textureCache.get(cacheKey)!);
  sprite.roundPixels = true;
  sprite.texture.source.scaleMode = 'nearest';

  // No scaling needed - texture is already at target size
  return sprite;
}

/**
 * Creates a shape icon sprite rendered directly at target size
 * No sprite scaling needed - texture is generated at final size for pixel-perfect rendering
 */
export function createShapeIcon(shape: ShapeType, size: number, color: number, renderer: PIXI.Renderer): PIXI.Sprite {
  // Cache key includes size since we render at target size
  const pixelSize = Math.floor(size / ICON_WIDTH);
  const cacheKey = `shape_${shape}_${color}_${pixelSize}`;

  if (!textureCache.has(cacheKey)) {
    const graphic = drawShapeGraphic(shape, color, pixelSize);
    graphic.roundPixels = true;

    const texture = renderer.generateTexture({
      target: graphic,
      resolution: 1,
      antialias: false
    });

    texture.source.scaleMode = 'nearest';
    graphic.destroy();
    textureCache.set(cacheKey, texture);
  }

  const sprite = new PIXI.Sprite(textureCache.get(cacheKey)!);
  sprite.roundPixels = true;
  sprite.texture.source.scaleMode = 'nearest';

  // No scaling needed - texture is already at target size
  return sprite;
}

// ============================================================================
// Playback Icons (8x8 for animation controls)
// ============================================================================

/** Playback icon dimensions: 8 wide x 8 tall cells */
export const PLAYBACK_ICON_WIDTH = 8;
export const PLAYBACK_ICON_HEIGHT = 8;

/**
 * Draw a playback icon directly into a Graphics object.
 * Perfect for drawing icons in the same pass as button backgrounds.
 */
export function drawPlaybackIconInto(g: PIXI.Graphics, icon: PlaybackIconType, offsetX: number, offsetY: number, color: number, pixelSize: number): void {
  drawAsciiGridInto(g, PLAYBACK_ICON_GRIDS[icon], offsetX, offsetY, color, pixelSize);
}

/**
 * Draws a playback icon from ASCII grid at target size
 */
function drawPlaybackGraphic(icon: PlaybackIconType, color: number, pixelSize: number): PIXI.Graphics {
  return renderAsciiGrid(PLAYBACK_ICON_GRIDS[icon], color, pixelSize);
}

/**
 * Creates a playback icon sprite rendered directly at target size
 * No sprite scaling needed - texture is generated at final size for pixel-perfect rendering
 */
export function createPlaybackIcon(icon: PlaybackIconType, size: number, color: number, renderer: PIXI.Renderer): PIXI.Sprite {
  // Cache key includes size since we render at target size
  const pixelSize = Math.floor(size / PLAYBACK_ICON_WIDTH);
  const cacheKey = `playback_${icon}_${color}_${pixelSize}`;

  if (!textureCache.has(cacheKey)) {
    const graphic = drawPlaybackGraphic(icon, color, pixelSize);
    graphic.roundPixels = true;

    const texture = renderer.generateTexture({
      target: graphic,
      resolution: 1,
      antialias: false
    });

    texture.source.scaleMode = 'nearest';
    graphic.destroy();
    textureCache.set(cacheKey, texture);
  }

  const sprite = new PIXI.Sprite(textureCache.get(cacheKey)!);
  sprite.roundPixels = true;
  sprite.texture.source.scaleMode = 'nearest';

  // No scaling needed - texture is already at target size
  return sprite;
}

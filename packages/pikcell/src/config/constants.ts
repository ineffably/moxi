/**
 * Sprite Editor Constants
 *
 * Centralized configuration for all magic numbers and constants used throughout
 * the sprite editor. This promotes maintainability and makes it easy to tune
 * editor behavior from a single location.
 * 
 * ⚠️ CRITICAL: GRID-BASED UI SYSTEM
 * =================================
 * 
 * THIS CODEBASE USES GRID UNITS FOR UI, BUT ACTUAL PIXELS FOR SPRITE CONTENT!
 * 
 * GRID UNITS are used for:
 *   - UI elements (cards, buttons, spacing, margins, padding, borders)
 *   - Card dimensions and positioning
 *   - Layout spacing between UI components
 * 
 * ACTUAL PIXELS are used for:
 *   - Sprite dimensions (8x8 pixels per sprite)
 *   - Sprite sheet dimensions (128x128, 256x256 pixels)
 *   - Pixel art content itself
 *   - Canvas/texture dimensions for sprite rendering
 * 
 * All UI dimensions, spacing, margins, and padding should be specified in GRID UNITS
 * and converted to pixels using the px() function from '@moxijs/core'.
 * 
 * Examples:
 *   ✅ CORRECT (UI): const spacing = px(GRID.gap);        // Uses grid units
 *   ✅ CORRECT (UI): const margin = px(2);                 // 2 grid units
 *   ✅ CORRECT (Sprite): const spriteWidth = 8;            // 8 actual pixels
 *   ✅ CORRECT (Sprite): const sheetWidth = 128;            // 128 actual pixels
 *   ❌ WRONG (UI):   const spacing = 8;                   // Raw pixels - DON'T DO THIS for UI
 *   ❌ WRONG (UI):   const margin = 20;                    // Raw pixels - DON'T DO THIS for UI
 * 
 * Grid units scale with GRID.scale (configurable, default: 4x)
 * - The scale is NOT hardcoded - it can be 1x, 2x, 3x, or 4x
 * - Scale is configured at the outer layer (PixelGrid initialization)
 * - px(1) = 1 grid unit = 4 pixels (at 4x scale) = 3px (at 3x) = 2px (at 2x) = 1px (at 1x)
 * - px(2) = 2 grid units = 8 pixels (at 4x) = 6px (at 3x) = 4px (at 2x) = 2px (at 1x)
 * - Changing GRID.scale scales the entire UI proportionally
 * 
 * When displaying sprite content in cards:
 *   - Sprite content is measured in actual pixels (e.g., 8x8 sprite)
 *   - Card content size converts: Math.ceil(pixelWidth / px(1))
 * 
 * Why grid units for UI?
 * - Ensures pixel-perfect rendering
 * - Maintains consistent spacing
 * - Makes UI scalable (change GRID.scale to scale entire UI)
 * - Prevents sub-pixel rendering issues
 * 
 * If you see hardcoded pixel values in UI code (cards, buttons, spacing), they are bugs!
 * But pixel values for sprite/sprite sheet dimensions are correct and expected.
 */

/**
 * Sprite dimensions and cell sizes
 */
export const SPRITE_CONSTANTS = {
  /** Standard sprite cell size in pixels (8x8) */
  CELL_SIZE: 8,

  /** Default editor scale for individual sprite editing */
  DEFAULT_SPRITE_SCALE: 8,

  /** Minimum sprite scale */
  MIN_SPRITE_SCALE: 1,

  /** Maximum sprite scale */
  MAX_SPRITE_SCALE: 64,
} as const;

/**
 * Sprite sheet controller constants
 */
export const SPRITE_SHEET_CONSTANTS = {
  /** Click threshold in pixels - below this distance is a click, above is a drag */
  CLICK_THRESHOLD_PX: 5,

  /** Default viewport scale ratio (sheet height / viewport height) */
  DEFAULT_VIEWPORT_RATIO: 0.5,

  /** Zoom increment per mouse wheel notch */
  ZOOM_INCREMENT: 0.5,

  /** Minimum sprite sheet scale */
  MIN_SCALE: 1,

  /** Maximum sprite sheet scale */
  MAX_SCALE: 16,

  /** Grid line opacity (0-1) */
  GRID_OPACITY: 0.3,

  /** Grid line color (CSS color string) */
  GRID_COLOR: 'rgba(128, 128, 128, 0.3)',

  /** Grid line width in pixels */
  GRID_LINE_WIDTH: 1,
} as const;

/**
 * Card UI constants
 */
export const CARD_CONSTANTS = {
  /** Title bar font scale multiplier */
  TITLE_FONT_SCALE_MULTIPLIER: 64,

  /** Title bar padding multiplier */
  TITLE_PADDING_MULTIPLIER: 2,

  /** Resize handle size in pixels */
  RESIZE_HANDLE_SIZE: 16,

  /** Corner resize handle size in pixels */
  CORNER_RESIZE_HANDLE_SIZE: 16,

  /** Minimum drag distance to distinguish from click */
  MIN_DRAG_DISTANCE: 5,
} as const;

/**
 * Default card dimensions (in grid units)
 */
export const DEFAULT_CARD_SIZES = {
  /** Default palette card dimensions */
  PALETTE: {
    WIDTH: 50,
    HEIGHT: 50,
  },

  /** Default tool card dimensions */
  TOOL: {
    WIDTH: 50,
    HEIGHT: 50,
  },

  /** Default sprite sheet minimap dimensions */
  SPRITESHEET_MINIMAP: {
    WIDTH: 50,
    HEIGHT: 50,
    SCALE: 5,
  },

  /** Default sprite card dimensions */
  SPRITE: {
    WIDTH: 70,
    HEIGHT: 70,
  },

  /** Default commander bar dimensions */
  COMMANDER_BAR: {
    BASE_HEIGHT: 12,
    BUTTON_SPACING: 24,
  },

  /** Default info bar dimensions */
  INFO_BAR: {
    HEIGHT: 10,
  },

  /** Default scale card dimensions */
  SCALE: {
    WIDTH: 20,
    HEIGHT: 10,
  },
} as const;

/**
 * Layout constants
 */
export const LAYOUT_CONSTANTS = {
  /** Gap between cards in pixels */
  CARD_GAP: 8,

  /** Padding from viewport edges */
  VIEWPORT_PADDING: 0,

  /** Z-index for focused cards (to bring to front) */
  FOCUSED_CARD_Z_INDEX: 1000,
} as const;

/**
 * Animation and interaction constants
 */
export const INTERACTION_CONSTANTS = {
  /** Double-click time threshold in milliseconds */
  DOUBLE_CLICK_THRESHOLD_MS: 300,

  /** Long press duration in milliseconds */
  LONG_PRESS_DURATION_MS: 500,

  /** Drag start delay in milliseconds */
  DRAG_START_DELAY_MS: 100,
} as const;

/**
 * File operation constants
 */
export const FILE_CONSTANTS = {
  /** Project file extension */
  PROJECT_FILE_EXTENSION: '.moxiproject',

  /** PNG export file extension */
  PNG_EXPORT_EXTENSION: '.png',

  /** Default project file name */
  DEFAULT_PROJECT_NAME: 'untitled-project',

  /** UI state storage key */
  UI_STATE_STORAGE_KEY: 'spriteEditorUIState',

  /** Project state storage key */
  PROJECT_STATE_STORAGE_KEY: 'spriteEditorProjectState',

  /** Layout state storage key */
  LAYOUT_STATE_STORAGE_KEY: 'spriteEditorLayoutState',
} as const;

/**
 * Color constants
 */
export const COLOR_CONSTANTS = {
  /** Cell selection highlight color */
  CELL_SELECTION_COLOR: 0xffec27,

  /** Cell selection highlight width */
  CELL_SELECTION_WIDTH: 2,

  /** Cell hover highlight color */
  CELL_HOVER_COLOR: 0xffffff,

  /** Cell hover highlight width */
  CELL_HOVER_WIDTH: 1,

  /** Cell hover highlight alpha */
  CELL_HOVER_ALPHA: 0.5,
} as const;

/**
 * Performance constants
 */
export const PERFORMANCE_CONSTANTS = {
  /** Maximum number of sprite sheets per project */
  MAX_SPRITE_SHEETS_PER_PROJECT: 10,

  /** Texture cache size limit */
  TEXTURE_CACHE_SIZE: 100,

  /** Debounce delay for project auto-save in milliseconds */
  AUTO_SAVE_DEBOUNCE_MS: 1000,

  /** Debounce delay for UI state save in milliseconds */
  UI_STATE_DEBOUNCE_MS: 500,

  /** Delay after dialog action before proceeding (allows dialog to close) */
  DIALOG_ACTION_DELAY_MS: 100,
} as const;

/**
 * Debug constants
 */
export const DEBUG_CONSTANTS = {
  /** Enable verbose logging */
  ENABLE_VERBOSE_LOGGING: false,

  /** Show performance metrics */
  SHOW_PERFORMANCE_METRICS: false,

  /** Show bounding boxes for cards */
  SHOW_CARD_BOUNDS: false,
} as const;

/**
 * Tool constants
 */
export const TOOL_CONSTANTS = {
  /** Default tool on editor start */
  DEFAULT_TOOL: 'pencil',

  /** Tool cursor types */
  TOOL_CURSORS: {
    pencil: 'crosshair',
    eraser: 'crosshair',
    fill: 'crosshair',
    eyedropper: 'crosshair',
    select: 'default',
  },
} as const;

/**
 * Animation preview constants
 */
export const ANIMATION_CONSTANTS = {
  /** Default FPS for new animations */
  DEFAULT_FPS: 12,

  /** Minimum FPS */
  MIN_FPS: 1,

  /** Maximum FPS */
  MAX_FPS: 60,

  /** Minimum frame duration in milliseconds (1000ms / MAX_FPS) */
  MIN_FRAME_DURATION_MS: 17,

  /** Maximum frame duration in milliseconds (1000ms / MIN_FPS) */
  MAX_FRAME_DURATION_MS: 1000,

  /** Default preview scale */
  DEFAULT_PREVIEW_SCALE: 8,

  /** Minimum preview scale */
  MIN_PREVIEW_SCALE: 1,

  /** Maximum preview scale */
  MAX_PREVIEW_SCALE: 32,

  /** Maximum frames per sequence */
  MAX_FRAMES_PER_SEQUENCE: 64,

  /** Maximum animation preview windows */
  MAX_PREVIEW_WINDOWS: 8,
} as const;

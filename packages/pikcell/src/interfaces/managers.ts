/**
 * Manager Interfaces
 *
 * Defines clear contracts for all manager classes in the sprite editor.
 * These interfaces establish the public API and responsibilities of each manager,
 * making it easy to understand, test, and potentially swap implementations.
 */
import * as PIXI from 'pixi.js';
import { PixelCard } from '../components/pixel-card';
import { SpriteSheetController, SpriteSheetType, SpriteSheetConfig } from '../controllers/sprite-sheet-controller';
import { SpriteController } from '../controllers/sprite-controller';
import { CardState } from '../state/ui-state-manager';
import { ProjectState, SpriteSheetState } from '../state/project-state-manager';
import { LayoutSlotState } from '../state/layout-state-manager';
import { SpriteSheetCardResult } from '../components/spritesheet-card';
import { SpriteEditorCardResult } from '../components/sprite-editor-card';

/**
 * Sprite sheet instance that combines UI and data concerns
 */
export interface SpriteSheetInstance {
  /** Unique identifier for this sprite sheet */
  id: string;

  /** User-visible name for this sprite sheet */
  name: string;

  /** UI card for the sprite sheet */
  sheetCard: SpriteSheetCardResult;

  /** UI card for individual sprite editing (optional) */
  spriteCard: SpriteEditorCardResult | null;

  /** Controller for individual sprite editing (optional) */
  spriteController: SpriteController | null;
}

/**
 * Validation result for operations
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Layout specification for positioning cards
 */
export interface LayoutSpec {
  id: string;
  name: string;
  positions: Record<string, CardPosition>;
}

export interface CardPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
  // Extended positioning properties for data-driven layouts
  anchor?: string;      // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  dock?: string;        // 'top' | 'bottom' | 'left' | 'right'
  below?: string;       // Card ID to position below
  gapMultiplier?: number; // Multiplier for gap spacing
}

/**
 * SpriteSheetManager - Manages sprite sheet lifecycle
 *
 * Responsibilities:
 * - Create and destroy sprite sheet instances
 * - Track active sprite sheet
 * - Validate sprite sheet operations
 * - Provide access to sprite sheet data
 */
export interface ISpriteSheetManager {
  /**
   * Create a new sprite sheet instance
   */
  create(type: SpriteSheetType, savedId?: string, config?: Partial<SpriteSheetConfig>, name?: string): SpriteSheetInstance;

  /**
   * Get a sprite sheet instance by ID
   */
  get(id: string): SpriteSheetInstance | undefined;

  /**
   * Get a sprite sheet instance by name
   */
  getByName(name: string): SpriteSheetInstance | undefined;

  /**
   * Get the currently active sprite sheet
   */
  getActive(): SpriteSheetInstance | null;

  /**
   * Set the active sprite sheet
   */
  setActive(id: string): void;

  /**
   * Get all sprite sheet instances
   */
  getAll(): SpriteSheetInstance[];

  /**
   * Remove a sprite sheet instance
   */
  remove(id: string): void;

  /**
   * Validate if a sprite sheet can be created
   */
  validate(type: SpriteSheetType): ValidationResult;

  /**
   * Check if a sprite sheet exists
   */
  has(id: string): boolean;

  /**
   * Check if a sprite sheet with the given name exists
   */
  hasName(name: string): boolean;

  /**
   * Set the name of a sprite sheet
   */
  setName(id: string, name: string): boolean;

  /**
   * Get the count of sprite sheets
   */
  count(): number;

  /**
   * Subscribe to sprite sheet events
   */
  on(event: 'created' | 'removed' | 'activeChanged' | 'renamed', handler: (id: string) => void): void;
}

/**
 * UIManager - Manages UI card lifecycle and z-ordering
 *
 * Responsibilities:
 * - Register and unregister cards
 * - Bring cards to front (z-ordering)
 * - Track card focus
 * - Export/import card states
 */
export interface IUIManager {
  /**
   * Register a card with the UI manager
   */
  registerCard(id: string, card: PixelCard): void;

  /**
   * Unregister a card
   */
  unregisterCard(id: string): void;

  /**
   * Get a registered card by ID
   */
  getCard(id: string): PixelCard | undefined;

  /**
   * Get all registered cards
   */
  getAllCards(): Map<string, PixelCard>;

  /**
   * Bring a card to the front (highest z-index)
   */
  bringToFront(id: string): void;

  /**
   * Export states of all cards
   */
  exportAllStates(): Map<string, CardState>;

  /**
   * Import and restore card states
   */
  importStates(states: Map<string, CardState>): void;

  /**
   * Check if a card is registered
   */
  hasCard(id: string): boolean;

  /**
   * Get the focused card ID
   */
  getFocusedCard(): string | null;

  /**
   * Set the focused card
   */
  setFocusedCard(id: string | null): void;
}

/**
 * LayoutManager - Manages card positioning and layouts
 *
 * Responsibilities:
 * - Apply layout presets
 * - Position individual cards
 * - Calculate card dimensions
 * - Handle viewport resizing
 */
export interface ILayoutManager {
  /**
   * Apply a layout preset
   */
  applyLayout(layoutId: string, cards: Map<string, PixelCard>): void;

  /**
   * Apply the default layout
   */
  applyDefaultLayout(cards: Map<string, PixelCard>): void;

  /**
   * Position a single card
   */
  positionCard(card: PixelCard, position: CardPosition): void;

  /**
   * Get a layout by ID
   */
  getLayout(id: string): LayoutSpec | undefined;

  /**
   * Register a custom layout
   */
  registerLayout(layout: LayoutSpec): void;

  /**
   * Get all available layouts
   */
  getAllLayouts(): LayoutSpec[];

  /**
   * Calculate card dimensions based on content
   */
  calculateCardDimensions(contentWidth: number, contentHeight: number): { width: number; height: number };

  /**
   * Handle viewport resize
   */
  onViewportResize(width: number, height: number): void;
}

/**
 * FileOperationsManager - Manages file I/O operations
 *
 * Responsibilities:
 * - Save/load project files
 * - Export PNG images
 * - Handle file dialogs
 * - Manage file formats
 */
export interface IFileOperationsManager {
  /**
   * Save project to file
   */
  saveProject(projectState: ProjectState): Promise<void>;

  /**
   * Load project from file
   */
  loadProject(): Promise<ProjectState | null>;

  /**
   * Export sprite sheet as PNG
   */
  exportPNG(spriteSheet: SpriteSheetController, filename?: string): Promise<void>;

  /**
   * Export individual sprite as PNG
   */
  exportSpritePNG(sprite: SpriteController, filename?: string): Promise<void>;

  /**
   * Check if browser supports file operations
   */
  supportsFileOperations(): boolean;

  /**
   * Get the last saved file name
   */
  getLastSavedFileName(): string | null;
}

/**
 * StatePersistenceManager - Manages state save/restore
 *
 * Responsibilities:
 * - Save state to localStorage
 * - Load state from localStorage
 * - Clear saved state
 * - Handle state versioning
 */
export interface IStatePersistenceManager {
  /**
   * Save UI state
   */
  saveUIState(state: Map<string, CardState>): void;

  /**
   * Load UI state
   */
  loadUIState(): Map<string, CardState> | null;

  /**
   * Save project state
   */
  saveProjectState(state: ProjectState): void;

  /**
   * Load project state
   */
  loadProjectState(): ProjectState | null;

  /**
   * Save layout state
   */
  saveLayoutState(state: Record<string, LayoutSlotState>): void;

  /**
   * Load layout state
   */
  loadLayoutState(): Record<string, LayoutSlotState> | null;

  /**
   * Clear all saved state
   */
  clearAll(): void;

  /**
   * Check if state exists in storage
   */
  hasState(key: string): boolean;
}

/**
 * EventBus - Simple event bus for manager communication
 *
 * Responsibilities:
 * - Emit events
 * - Subscribe to events
 * - Unsubscribe from events
 */
export interface IEventBus {
  /**
   * Emit an event
   */
  emit(event: string, data?: any): void;

  /**
   * Subscribe to an event
   */
  on(event: string, handler: (data?: any) => void): () => void;

  /**
   * Subscribe to an event once
   */
  once(event: string, handler: (data?: any) => void): () => void;

  /**
   * Unsubscribe all handlers for an event
   */
  off(event: string): void;
}

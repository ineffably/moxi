/**
 * SpriteSheetManager - Manages sprite sheet lifecycle
 *
 * Extracted from SpriteEditor to follow Single Responsibility Principle.
 * Handles creation, tracking, activation, and validation of sprite sheets.
 */
import { SpriteSheetInstance, ISpriteSheetManager, ValidationResult } from '../interfaces/managers';
import { SpriteSheetType, SpriteSheetConfig } from '../controllers/sprite-sheet-controller';
import { PERFORMANCE_CONSTANTS } from '../config/constants';

type EventHandler = (id: string) => void;

/**
 * Manages all sprite sheet instances in the editor
 */
export class SpriteSheetManager implements ISpriteSheetManager {
  private instances: Map<string, SpriteSheetInstance> = new Map();
  private activeId: string | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Create a new sprite sheet instance
   *
   * @param type Sprite sheet type (PICO-8, TIC-80, etc.)
   * @param savedId Optional saved ID to reuse when loading from state
   * @param config Optional configuration overrides
   * @param name Optional name for the sprite sheet
   * @returns The created sprite sheet instance (or existing one if ID already exists)
   */
  create(type: SpriteSheetType, savedId?: string, config?: Partial<SpriteSheetConfig>, name?: string): SpriteSheetInstance {
    const id = savedId || this.generateId();

    // If an instance with this ID already exists, return it instead of creating a duplicate
    if (this.instances.has(id)) {
      console.warn(`SpriteSheetManager: Instance with ID "${id}" already exists, returning existing instance`);
      return this.instances.get(id)!;
    }

    // Generate a default name if none provided
    const sheetName = name || this.generateDefaultName(type);

    // Create the instance with sheetCard as undefined initially
    // The caller MUST set sheetCard before using the instance
    const instance: Partial<SpriteSheetInstance> & { id: string; name: string } = {
      id,
      name: sheetName,
      spriteCard: null,
      spriteController: null,
    };

    // Store as full instance - sheetCard will be set by caller
    this.instances.set(id, instance as SpriteSheetInstance);
    this.emit('created', id);

    return instance as SpriteSheetInstance;
  }

  /**
   * Get a sprite sheet instance by ID
   *
   * @param id Sprite sheet ID
   * @returns The sprite sheet instance or undefined if not found
   */
  get(id: string): SpriteSheetInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * Get the currently active sprite sheet
   *
   * @returns The active sprite sheet instance or null if none active
   */
  getActive(): SpriteSheetInstance | null {
    if (!this.activeId) return null;
    return this.instances.get(this.activeId) || null;
  }

  /**
   * Set the active sprite sheet
   *
   * @param id Sprite sheet ID to activate
   * @throws Error if sprite sheet ID doesn't exist
   */
  setActive(id: string): void {
    if (!this.instances.has(id)) {
      throw new Error(`Cannot set active sprite sheet: ID "${id}" not found`);
    }

    if (this.activeId !== id) {
      this.activeId = id;
      this.emit('activeChanged', id);
    }
  }

  /**
   * Get all sprite sheet instances
   *
   * @returns Array of all sprite sheet instances
   */
  getAll(): SpriteSheetInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Remove a sprite sheet instance
   *
   * @param id Sprite sheet ID to remove
   */
  remove(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;

    // Clear active if this was the active sheet
    if (this.activeId === id) {
      this.activeId = null;

      // Set first remaining sheet as active, if any
      const remaining = Array.from(this.instances.keys()).filter(key => key !== id);
      if (remaining.length > 0) {
        this.activeId = remaining[0];
      }
    }

    this.instances.delete(id);
    this.emit('removed', id);
  }

  /**
   * Validate if a sprite sheet can be created
   *
   * Enforces rules like:
   * - Maximum sprite sheets per project
   * - One sprite sheet type per project
   *
   * @param type Sprite sheet type to validate
   * @returns Validation result with error message if invalid
   */
  validate(type: SpriteSheetType): ValidationResult {
    // Check maximum sprite sheets
    if (this.instances.size >= PERFORMANCE_CONSTANTS.MAX_SPRITE_SHEETS_PER_PROJECT) {
      return {
        valid: false,
        message: `Maximum ${PERFORMANCE_CONSTANTS.MAX_SPRITE_SHEETS_PER_PROJECT} sprite sheets per project`,
      };
    }

    // Enforce single sprite sheet type per project
    if (this.instances.size > 0) {
      const firstInstance = Array.from(this.instances.values())[0];
      const existingType = firstInstance.sheetCard?.controller.getConfig().type;

      if (existingType && existingType !== type) {
        return {
          valid: false,
          message: `Project already contains a ${existingType} sprite sheet. Create a new project to use ${type}.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if a sprite sheet exists
   *
   * @param id Sprite sheet ID
   * @returns True if sprite sheet exists
   */
  has(id: string): boolean {
    return this.instances.has(id);
  }

  /**
   * Get the count of sprite sheets
   *
   * @returns Number of sprite sheets
   */
  count(): number {
    return this.instances.size;
  }

  /**
   * Subscribe to sprite sheet events
   *
   * @param event Event type to subscribe to
   * @param handler Event handler function
   */
  on(event: 'created' | 'removed' | 'activeChanged' | 'renamed', handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from sprite sheet events
   *
   * @param event Event type to unsubscribe from
   * @param handler Event handler function to remove
   */
  off(event: 'created' | 'removed' | 'activeChanged' | 'renamed', handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Clear all sprite sheets
   *
   * Useful for creating a new project
   */
  clear(): void {
    const ids = Array.from(this.instances.keys());
    ids.forEach(id => this.remove(id));
  }

  /**
   * Get the sprite sheet type (if all sheets are the same type)
   *
   * @returns The sprite sheet type or null if no sheets or mixed types
   */
  getProjectSpriteSheetType(): SpriteSheetType | null {
    if (this.instances.size === 0) return null;

    const firstInstance = Array.from(this.instances.values())[0];
    return firstInstance.sheetCard?.controller.getConfig().type || null;
  }

  /**
   * Generate a unique ID for a sprite sheet
   *
   * @private
   */
  private generateId(): string {
    return `sheet-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Emit an event to all subscribed handlers
   *
   * @private
   */
  private emit(event: string, id: string): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(id));
    }
  }

  /**
   * Get statistics about sprite sheets
   *
   * Useful for debugging and UI display
   */
  getStats(): {
    total: number;
    activeId: string | null;
    type: SpriteSheetType | null;
  } {
    return {
      total: this.instances.size,
      activeId: this.activeId,
      type: this.getProjectSpriteSheetType(),
    };
  }

  /**
   * Set the name of a sprite sheet
   *
   * @param id Sprite sheet ID
   * @param name New name for the sprite sheet
   * @returns True if renamed successfully
   */
  setName(id: string, name: string): boolean {
    const instance = this.instances.get(id);
    if (!instance) return false;

    instance.name = name;
    this.emit('renamed', id);
    return true;
  }

  /**
   * Get a sprite sheet by name
   *
   * @param name Sprite sheet name to find
   * @returns The sprite sheet instance or undefined if not found
   */
  getByName(name: string): SpriteSheetInstance | undefined {
    for (const instance of this.instances.values()) {
      if (instance.name === name) {
        return instance;
      }
    }
    return undefined;
  }

  /**
   * Check if a sprite sheet with the given name exists
   *
   * @param name Sprite sheet name to check
   * @returns True if a sprite sheet with this name exists
   */
  hasName(name: string): boolean {
    return this.getByName(name) !== undefined;
  }

  /**
   * Generate a default name for a sprite sheet
   *
   * @param type Sprite sheet type
   * @returns A default name like "PICO-8 Sheet 1"
   */
  private generateDefaultName(type: SpriteSheetType): string {
    let index = 1;
    let baseName = type === 'PICO-8' ? 'PICO-8' : 'TIC-80';
    let name = `${baseName} Sheet ${index}`;

    while (this.hasName(name)) {
      index++;
      name = `${baseName} Sheet ${index}`;
    }

    return name;
  }
}

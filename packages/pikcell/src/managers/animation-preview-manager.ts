/**
 * AnimationPreviewManager - Manages animation preview window lifecycle
 *
 * Handles creation, tracking, and cleanup of animation preview cards.
 */
import * as PIXI from 'pixi.js';
import {
  AnimationPreviewCardResult,
  AnimationPreviewCardOptions,
  createAnimationPreviewCard
} from '../cards/animation-preview-card';
import { SpriteSheetController } from '../controllers/sprite-sheet-controller';
import {
  AnimationSequenceConfig,
  AnimationPreviewState,
  generateAnimationId,
  createDefaultSequence
} from '../interfaces/animation-types';
import { ANIMATION_CONSTANTS } from '../config/constants';
import { ANIMATION_PREVIEW_CARD_CONFIG } from '../config/card-configs';

type EventHandler = (id: string) => void;

export interface AnimationPreviewInstance {
  id: string;
  spriteSheetId: string;
  card: AnimationPreviewCardResult;
}

export interface CreatePreviewOptions {
  spriteSheetId: string;
  spriteSheetController: SpriteSheetController;
  renderer: PIXI.Renderer;
  scene: PIXI.Container;
  x?: number;
  y?: number;
  /** Initial animation sequences (supports multiple rows) */
  sequences?: AnimationSequenceConfig[];
  onFocus?: (id: string) => void;
  onSelectionModeChange?: (previewId: string, isSelecting: boolean) => void;
  onShowSettings?: (previewId: string) => void;
  onStateChange?: () => void;
  /** Called when the current frame changes during playback */
  onFrameChange?: (previewId: string, frameIndex: number) => void;
  /** Called when hovering over a frame tick bar */
  onFrameHover?: (previewId: string, frameIndex: number, cellX: number, cellY: number) => void;
  /** Called when mouse leaves frame tick bars */
  onFrameHoverEnd?: (previewId: string) => void;
  /** Container for tooltips (for z-ordering above other UI) */
  tooltipLayer?: PIXI.Container;
}

/**
 * Manages all animation preview instances in the editor
 */
export class AnimationPreviewManager {
  private instances: Map<string, AnimationPreviewInstance> = new Map();
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private nextSpawnOffset: number = 0;

  /**
   * Create a new animation preview window
   */
  create(options: CreatePreviewOptions): AnimationPreviewInstance | null {
    // Check maximum preview windows
    if (this.instances.size >= ANIMATION_CONSTANTS.MAX_PREVIEW_WINDOWS) {
      console.warn(`Maximum ${ANIMATION_CONSTANTS.MAX_PREVIEW_WINDOWS} animation preview windows reached`);
      return null;
    }

    const id = generateAnimationId();

    // Calculate spawn position with offset for cascading effect
    const spawnX = (options.x ?? 100) + this.nextSpawnOffset * 20;
    const spawnY = (options.y ?? 100) + this.nextSpawnOffset * 20;
    this.nextSpawnOffset = (this.nextSpawnOffset + 1) % 5;

    // Create the card
    const card = createAnimationPreviewCard({
      id,
      x: spawnX,
      y: spawnY,
      renderer: options.renderer,
      spriteSheetController: options.spriteSheetController,
      initialSequences: options.sequences,
      onClose: () => {
        this.remove(id);
      },
      onFocus: () => {
        options.onFocus?.(id);
      },
      onSequenceChange: () => {
        options.onStateChange?.();
      },
      onSelectionModeChange: (isSelecting: boolean) => {
        options.onSelectionModeChange?.(id, isSelecting);
      },
      onShowSettings: () => {
        options.onShowSettings?.(id);
      },
      onFrameChange: (frameIndex: number) => {
        options.onFrameChange?.(id, frameIndex);
      },
      onFrameHover: (frameIndex: number, cellX: number, cellY: number) => {
        options.onFrameHover?.(id, frameIndex, cellX, cellY);
      },
      onFrameHoverEnd: () => {
        options.onFrameHoverEnd?.(id);
      },
      tooltipLayer: options.tooltipLayer
    });

    // Add to scene
    options.scene.addChild(card.container);

    const instance: AnimationPreviewInstance = {
      id,
      spriteSheetId: options.spriteSheetId,
      card
    };

    this.instances.set(id, instance);
    this.emit('created', id);

    return instance;
  }

  /**
   * Get an animation preview instance by ID
   */
  get(id: string): AnimationPreviewInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * Get all animation preview instances
   */
  getAll(): AnimationPreviewInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get all preview instances for a specific sprite sheet
   */
  getBySheetId(spriteSheetId: string): AnimationPreviewInstance[] {
    return this.getAll().filter(instance => instance.spriteSheetId === spriteSheetId);
  }

  /**
   * Remove an animation preview instance
   */
  remove(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;

    // Destroy the card
    instance.card.destroy();

    this.instances.delete(id);
    this.emit('removed', id);
  }

  /**
   * Clear all animation previews
   */
  clear(): void {
    const ids = Array.from(this.instances.keys());
    ids.forEach(id => this.remove(id));
    this.nextSpawnOffset = 0;
  }

  /**
   * Clear all previews for a specific sprite sheet
   */
  clearBySheetId(spriteSheetId: string): void {
    this.getBySheetId(spriteSheetId).forEach(instance => this.remove(instance.id));
  }

  /**
   * Check if a preview exists
   */
  has(id: string): boolean {
    return this.instances.has(id);
  }

  /**
   * Get the count of preview windows
   */
  count(): number {
    return this.instances.size;
  }

  /**
   * Notify all previews that sprite sheet data has changed
   */
  onSpriteSheetUpdate(spriteSheetId?: string): void {
    const previews = spriteSheetId
      ? this.getBySheetId(spriteSheetId)
      : this.getAll();

    previews.forEach(instance => {
      instance.card.refresh();
    });
  }

  /**
   * Add a frame to a specific preview
   */
  addFrameToPreview(previewId: string, cellX: number, cellY: number): void {
    const instance = this.get(previewId);
    if (!instance) return;

    instance.card.addFrame({ cellX, cellY });
  }

  /**
   * Export all preview states for persistence
   */
  exportStates(): AnimationPreviewState[] {
    return this.getAll().map(instance => {
      const sequences = instance.card.getSequences();
      const card = instance.card.card;
      const contentSize = card.getContentSize();

      return {
        id: instance.id,
        spriteSheetId: instance.spriteSheetId,
        sequences,
        scale: instance.card.controller.getScale(),
        isPlaying: instance.card.controller.isAnimating(),
        position: {
          x: card.container.x,
          y: card.container.y
        },
        size: {
          width: contentSize.width,
          height: contentSize.height
        }
      };
    });
  }

  /**
   * Import preview states (restore from persistence)
   */
  importStates(
    states: AnimationPreviewState[],
    options: {
      renderer: PIXI.Renderer;
      scene: PIXI.Container;
      getSpriteSheetController: (id: string) => SpriteSheetController | null;
      onFocus?: (id: string) => void;
      onSelectionModeChange?: (previewId: string, isSelecting: boolean) => void;
      onShowSettings?: (previewId: string) => void;
      onStateChange?: () => void;
      onFrameChange?: (previewId: string, frameIndex: number) => void;
      onFrameHover?: (previewId: string, frameIndex: number, cellX: number, cellY: number) => void;
      onFrameHoverEnd?: (previewId: string) => void;
    }
  ): void {
    // Clear existing previews
    this.clear();

    states.forEach(state => {
      const controller = options.getSpriteSheetController(state.spriteSheetId);
      if (!controller) {
        console.warn(`Cannot restore animation preview: sprite sheet "${state.spriteSheetId}" not found`);
        return;
      }

      const instance = this.create({
        spriteSheetId: state.spriteSheetId,
        spriteSheetController: controller,
        renderer: options.renderer,
        scene: options.scene,
        x: state.position.x,
        y: state.position.y,
        sequences: state.sequences,
        onFocus: options.onFocus,
        onSelectionModeChange: options.onSelectionModeChange,
        onShowSettings: options.onShowSettings,
        onStateChange: options.onStateChange,
        onFrameChange: options.onFrameChange,
        onFrameHover: options.onFrameHover,
        onFrameHoverEnd: options.onFrameHoverEnd
      });

      if (instance) {
        // Restore scale
        instance.card.controller.setScale(state.scale);

        // Restore playback state
        if (state.isPlaying) {
          instance.card.play();
        }
      }
    });
  }

  /**
   * Subscribe to preview events
   */
  on(event: 'created' | 'removed', handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from preview events
   */
  off(event: 'created' | 'removed', handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit an event to all subscribed handlers
   */
  private emit(event: string, id: string): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(id));
    }
  }

  /**
   * Get statistics about animation previews
   */
  getStats(): {
    total: number;
    maxAllowed: number;
  } {
    return {
      total: this.instances.size,
      maxAllowed: ANIMATION_CONSTANTS.MAX_PREVIEW_WINDOWS
    };
  }
}

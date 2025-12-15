/**
 * Animation Types
 *
 * Interfaces for animation preview system
 */

/**
 * Reference to a specific sprite frame in the sheet
 */
export interface SpriteFrameRef {
  /** Cell X coordinate (0-based) */
  cellX: number;
  /** Cell Y coordinate (0-based) */
  cellY: number;
  /** Optional per-frame duration override (ms) */
  duration?: number;
}

/**
 * Configuration for a single animation sequence
 */
export interface AnimationSequenceConfig {
  /** Unique ID for this sequence */
  id: string;
  /** User-defined name (e.g., "Walk", "Idle") */
  name: string;
  /** Ordered list of sprite frames */
  frames: SpriteFrameRef[];
  /** Duration per frame in milliseconds */
  frameDurationMs: number;
  /** Whether animation loops */
  loop: boolean;
  /** Whether to reverse at end (bounce) */
  pingPong: boolean;
}

/**
 * State for an animation preview window
 */
export interface AnimationPreviewState {
  /** Unique preview window ID */
  id: string;
  /** Which sprite sheet this animates */
  spriteSheetId: string;
  /** Animation sequence configuration */
  sequence: AnimationSequenceConfig;
  /** Display scale */
  scale: number;
  /** Current playback state */
  isPlaying: boolean;
  /** Window position */
  position: { x: number; y: number };
  /** Window size in grid units */
  size: { width: number; height: number };
}

/**
 * Generate a unique ID for sequences/previews
 */
export function generateAnimationId(): string {
  return `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a default animation sequence
 */
export function createDefaultSequence(): AnimationSequenceConfig {
  return {
    id: generateAnimationId(),
    name: 'Animation',
    frames: [],
    frameDurationMs: 83, // ~12 fps
    loop: true,
    pingPong: false
  };
}

/**
 * Convert FPS to milliseconds per frame
 */
export function fpsToMs(fps: number): number {
  return Math.round(1000 / fps);
}

/**
 * Convert milliseconds per frame to FPS
 */
export function msToFps(ms: number): number {
  return Math.round(1000 / ms);
}

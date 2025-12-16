/**
 * Animation Controller
 *
 * Handles sprite animation playback logic independently of the UI.
 * Manages frame timing, sequence progression, and texture generation.
 */
import * as PIXI from 'pixi.js';
import { SpriteSheetController } from './sprite-sheet-controller';
import {
  AnimationSequenceConfig,
  SpriteFrameRef,
  createDefaultSequence,
  fpsToMs,
  msToFps
} from '../interfaces/animation-types';
import { ANIMATION_CONSTANTS } from '../config/constants';
import { SPRITE_CONTROLLER_CONFIG } from '../config/controller-configs';

export interface AnimationControllerOptions {
  spriteSheetController: SpriteSheetController;
  sequence?: AnimationSequenceConfig;
  scale?: number;
  onFrameChange?: (frameIndex: number, texture: PIXI.Texture) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

/**
 * Controller for managing sprite animation playback
 */
export class AnimationController {
  private spriteSheetController: SpriteSheetController;
  private sequence: AnimationSequenceConfig;
  private currentFrameIndex: number = 0;
  private isPlaying: boolean = false;
  private lastFrameTime: number = 0;
  private animationFrameId: number | null = null;
  private direction: 1 | -1 = 1; // For ping-pong
  private scale: number;

  // Event callbacks
  private onFrameChange?: (frameIndex: number, texture: PIXI.Texture) => void;
  private onPlayStateChange?: (isPlaying: boolean) => void;

  constructor(options: AnimationControllerOptions) {
    this.spriteSheetController = options.spriteSheetController;
    this.sequence = options.sequence ?? createDefaultSequence();
    this.scale = options.scale ?? ANIMATION_CONSTANTS.DEFAULT_PREVIEW_SCALE;
    this.onFrameChange = options.onFrameChange;
    this.onPlayStateChange = options.onPlayStateChange;

    // Bind tick to preserve context
    this.tick = this.tick.bind(this);
  }

  // ============================================================================
  // Playback Controls
  // ============================================================================

  /**
   * Start animation playback
   */
  public play(): void {
    if (this.isPlaying || this.sequence.frames.length === 0) return;

    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.tick);
    this.onPlayStateChange?.(true);
  }

  /**
   * Pause animation playback
   */
  public pause(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.onPlayStateChange?.(false);
  }

  /**
   * Toggle play/pause
   */
  public togglePlayback(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Stop animation and reset to first frame
   */
  public stop(): void {
    this.pause();
    this.currentFrameIndex = 0;
    this.direction = 1;
    this.emitFrameChange();
  }

  /**
   * Step forward one frame
   */
  public stepForward(): void {
    this.pause();
    if (this.sequence.frames.length === 0) return;

    this.currentFrameIndex = (this.currentFrameIndex + 1) % this.sequence.frames.length;
    this.emitFrameChange();
  }

  /**
   * Step backward one frame
   */
  public stepBackward(): void {
    this.pause();
    if (this.sequence.frames.length === 0) return;

    this.currentFrameIndex = this.currentFrameIndex - 1;
    if (this.currentFrameIndex < 0) {
      this.currentFrameIndex = this.sequence.frames.length - 1;
    }
    this.emitFrameChange();
  }

  /**
   * Go to a specific frame
   */
  public goToFrame(index: number): void {
    if (index < 0 || index >= this.sequence.frames.length) return;
    this.currentFrameIndex = index;
    this.emitFrameChange();
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set the animation sequence
   */
  public setSequence(sequence: AnimationSequenceConfig): void {
    this.sequence = sequence;
    this.currentFrameIndex = 0;
    this.direction = 1;
    this.emitFrameChange();
  }

  /**
   * Get the current sequence
   */
  public getSequence(): AnimationSequenceConfig {
    return this.sequence;
  }

  /**
   * Set frame rate in FPS
   */
  public setFps(fps: number): void {
    const clampedFps = Math.max(
      ANIMATION_CONSTANTS.MIN_FPS,
      Math.min(ANIMATION_CONSTANTS.MAX_FPS, fps)
    );
    this.sequence.frameDurationMs = fpsToMs(clampedFps);
  }

  /**
   * Get frame rate in FPS
   */
  public getFps(): number {
    return msToFps(this.sequence.frameDurationMs);
  }

  /**
   * Set display scale
   */
  public setScale(scale: number): void {
    this.scale = Math.max(
      ANIMATION_CONSTANTS.MIN_PREVIEW_SCALE,
      Math.min(ANIMATION_CONSTANTS.MAX_PREVIEW_SCALE, scale)
    );
    this.emitFrameChange();
  }

  /**
   * Get display scale
   */
  public getScale(): number {
    return this.scale;
  }

  /**
   * Set loop mode
   */
  public setLoop(loop: boolean): void {
    this.sequence.loop = loop;
  }

  /**
   * Set ping-pong mode
   */
  public setPingPong(pingPong: boolean): void {
    this.sequence.pingPong = pingPong;
  }

  // ============================================================================
  // Frame Management
  // ============================================================================

  /**
   * Add a frame to the sequence
   */
  public addFrame(frame: SpriteFrameRef): void {
    if (this.sequence.frames.length >= ANIMATION_CONSTANTS.MAX_FRAMES_PER_SEQUENCE) return;
    this.sequence.frames.push(frame);
    this.emitFrameChange();
  }

  /**
   * Remove a frame from the sequence
   */
  public removeFrame(index: number): void {
    if (index < 0 || index >= this.sequence.frames.length) return;
    this.sequence.frames.splice(index, 1);

    // Adjust current frame if needed
    if (this.currentFrameIndex >= this.sequence.frames.length) {
      this.currentFrameIndex = Math.max(0, this.sequence.frames.length - 1);
    }
    this.emitFrameChange();
  }

  /**
   * Reorder frames
   */
  public moveFrame(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this.sequence.frames.length ||
      toIndex < 0 ||
      toIndex >= this.sequence.frames.length
    ) return;

    const frame = this.sequence.frames.splice(fromIndex, 1)[0];
    this.sequence.frames.splice(toIndex, 0, frame);
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  /**
   * Get current frame index
   */
  public getCurrentFrameIndex(): number {
    return this.currentFrameIndex;
  }

  /**
   * Get total frame count
   */
  public getTotalFrames(): number {
    return this.sequence.frames.length;
  }

  /**
   * Check if currently playing
   */
  public isAnimating(): boolean {
    return this.isPlaying;
  }

  /**
   * Get the sprite sheet controller
   */
  public getSpriteSheetController(): SpriteSheetController {
    return this.spriteSheetController;
  }

  /**
   * Get texture for a specific frame
   */
  public getFrameTexture(index: number): PIXI.Texture | null {
    if (index < 0 || index >= this.sequence.frames.length) return null;

    const frameRef = this.sequence.frames[index];
    return this.generateFrameTexture(frameRef);
  }

  /**
   * Get texture for current frame
   */
  public getCurrentFrameTexture(): PIXI.Texture | null {
    return this.getFrameTexture(this.currentFrameIndex);
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  /**
   * Animation loop tick
   */
  private tick(): void {
    if (!this.isPlaying) return;

    const now = performance.now();
    const currentFrame = this.sequence.frames[this.currentFrameIndex];
    const frameDuration = currentFrame?.duration ?? this.sequence.frameDurationMs;

    if (now - this.lastFrameTime >= frameDuration) {
      this.advanceFrame();
      this.lastFrameTime = now;
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  /**
   * Advance to next frame
   */
  private advanceFrame(): void {
    const frameCount = this.sequence.frames.length;
    if (frameCount === 0) return;

    if (this.sequence.pingPong) {
      // Ping-pong mode: bounce back and forth
      const nextIndex = this.currentFrameIndex + this.direction;

      if (nextIndex >= frameCount) {
        this.direction = -1;
        this.currentFrameIndex = frameCount - 2;
        if (this.currentFrameIndex < 0) this.currentFrameIndex = 0;
      } else if (nextIndex < 0) {
        this.direction = 1;
        this.currentFrameIndex = 1;
        if (this.currentFrameIndex >= frameCount) this.currentFrameIndex = 0;
      } else {
        this.currentFrameIndex = nextIndex;
      }
    } else {
      // Normal mode
      this.currentFrameIndex++;
      if (this.currentFrameIndex >= frameCount) {
        if (this.sequence.loop) {
          this.currentFrameIndex = 0;
        } else {
          this.currentFrameIndex = frameCount - 1;
          this.pause();
        }
      }
    }

    this.emitFrameChange();
  }

  /**
   * Generate texture for a frame reference
   * Uses a sub-texture (frame) of the spritesheet texture for direct projection
   */
  private generateFrameTexture(frameRef: SpriteFrameRef): PIXI.Texture {
    const cellSize = SPRITE_CONTROLLER_CONFIG.cellSize;

    // Get the spritesheet texture directly
    const sheetTexture = this.spriteSheetController.getTexture();
    if (!sheetTexture) {
      console.warn('Animation: No spritesheet texture available');
      return PIXI.Texture.EMPTY;
    }

    if (!sheetTexture.source) {
      console.warn('Animation: Spritesheet texture has no source');
      return PIXI.Texture.EMPTY;
    }

    // Create a sub-texture that is a "view" into the spritesheet at this cell
    // Following tilemap-matic pattern: use Rectangle and texture source
    const frame = new PIXI.Rectangle(
      frameRef.cellX * cellSize,
      frameRef.cellY * cellSize,
      cellSize,
      cellSize
    );

    const texture = new PIXI.Texture({
      source: sheetTexture.source,
      frame: frame
    });

    // Ensure nearest-neighbor scaling for pixel art
    texture.source.scaleMode = 'nearest';

    return texture;
  }

  /**
   * Emit frame change event
   */
  private emitFrameChange(): void {
    if (this.sequence.frames.length === 0) return;

    const texture = this.getCurrentFrameTexture();
    if (texture) {
      this.onFrameChange?.(this.currentFrameIndex, texture);
    }
  }

  /**
   * Called when sprite sheet pixels change - triggers redraw
   * Since we use sub-textures of the spritesheet, they automatically reflect changes
   */
  public onSpriteSheetUpdate(): void {
    this.emitFrameChange();
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.pause();
    this.onFrameChange = undefined;
    this.onPlayStateChange = undefined;
  }
}

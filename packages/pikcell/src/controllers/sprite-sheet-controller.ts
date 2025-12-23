/**
 * Sprite sheet controller - manages sprite data and interactions independently of the card
 */
import * as PIXI from 'pixi.js';
import { px } from '@moxijs/ui';
import { SPRITE_SHEET_CONTROLLER_CONFIG } from '../config/controller-configs';

export type SpriteSheetType = 'PICO-8' | 'TIC-80';

export interface SpriteSheetConfig {
  type: SpriteSheetType;
  /** Width in ACTUAL PIXELS (not grid units) - e.g., 128, 256 */
  width: number;
  /** Height in ACTUAL PIXELS (not grid units) - e.g., 128, 256 */
  height: number;
  palette: number[]; // Array of color values
}

export interface SpriteSheetControllerOptions {
  config: SpriteSheetConfig;
  renderer: PIXI.Renderer;
  showGrid?: boolean;
  onScaleChange?: (scale: number) => void;
  onCellHover?: (cellX: number, cellY: number) => void;
  onCellClick?: (cellX: number, cellY: number) => void;
}

/**
 * Controller for managing sprite sheet state and rendering
 */
export class SpriteSheetController {
  private config: SpriteSheetConfig;
  private renderer: PIXI.Renderer;
  private scale: number = 1;
  private pixels: number[][]; // 2D array of color indices
  private texture: PIXI.Texture | null = null;
  private sprite: PIXI.Sprite | null = null;
  private showGrid: boolean;
  private onScaleChange?: (scale: number) => void;
  private onCellHover?: (cellX: number, cellY: number) => void;
  private onCellClick?: (cellX: number, cellY: number) => void;
  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private spriteStartX: number = 0;
  private spriteStartY: number = 0;
  private cellOverlay: PIXI.Graphics | null = null;
  private selectedCellX: number = -1;
  private selectedCellY: number = -1;
  private hoveredCellX: number = -1;
  private hoveredCellY: number = -1;
  private interactionSetup: boolean = false;
  // Animation frame highlights - cells that are part of an animation sequence
  private animationFrameHighlights: Array<{ cellX: number; cellY: number }> = [];
  private animationFrameLabels: PIXI.Text[] = [];
  private currentAnimationFrameIndex: number = -1;
  // Selection mode - when active, shows overlay to indicate cells can be selected for animation
  private selectionModeActive: boolean = false;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private clickThreshold: number = SPRITE_SHEET_CONTROLLER_CONFIG.clickThreshold;

  // Event listener references for cleanup
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private mouseDownHandler: ((e: MouseEvent) => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseUpHandler: ((e: MouseEvent) => void) | null = null;
  private animationFrameId: number | null = null;

  constructor(options: SpriteSheetControllerOptions) {
    this.config = options.config;
    this.renderer = options.renderer;
    this.showGrid = options.showGrid ?? false;
    this.onScaleChange = options.onScaleChange;
    this.onCellHover = options.onCellHover;
    this.onCellClick = options.onCellClick;

    // Calculate initial scale to fit nicely (percentage of viewport height)
    const targetHeight = this.renderer.height * SPRITE_SHEET_CONTROLLER_CONFIG.initialScaleViewportRatio;
    this.scale = Math.max(SPRITE_SHEET_CONTROLLER_CONFIG.minScale, Math.floor(targetHeight / this.config.height));

    // Initialize pixel data (all set to first palette color)
    this.pixels = [];
    for (let y = 0; y < this.config.height; y++) {
      this.pixels[y] = [];
      for (let x = 0; x < this.config.width; x++) {
        this.pixels[y][x] = 0; // Default to first palette color
      }
    }

    // Setup mouse wheel zoom
    this.setupMouseWheelZoom();

    // Setup middle mouse button pan
    this.setupMiddleMousePan();
  }

  /**
   * Setup mouse wheel zoom handler
   * Based on: https://stackoverflow.com/questions/75969167/pixi-js-zoom-to-mouse-position
   */
  private setupMouseWheelZoom() {
    if (typeof window !== 'undefined') {
      this.wheelHandler = (e: WheelEvent) => {
        if (!this.sprite) return;

        // Get canvas bounds
        const canvas = this.renderer.canvas as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const canvasScaleX = canvas.width / rect.width;
        const canvasScaleY = canvas.height / rect.height;

        // Convert client coordinates to canvas coordinates
        const mouseX = (e.clientX - rect.left) * canvasScaleX;
        const mouseY = (e.clientY - rect.top) * canvasScaleY;

        // Get sprite sheet bounds
        const bounds = this.sprite.getBounds();

        // Check if mouse is over the sprite sheet
        if (mouseX >= bounds.x && mouseX <= bounds.x + bounds.width &&
            mouseY >= bounds.y && mouseY <= bounds.y + bounds.height) {
          e.preventDefault();

          // Get parent container offset
          const parentBounds = this.sprite.parent.getBounds();

          // Calculate mouse position relative to sprite center (accounting for anchor 0.5, 0.5)
          const spriteCenterX = parentBounds.x + this.sprite.x;
          const spriteCenterY = parentBounds.y + this.sprite.y;

          // Current scale
          const oldScale = this.sprite.scale.x;

          // Mouse position in sprite's local space (unscaled, relative to center due to anchor)
          const localX = (mouseX - spriteCenterX) / oldScale;
          const localY = (mouseY - spriteCenterY) / oldScale;

          // Calculate new scale
          const zoomDelta = e.deltaY > 0 ? -SPRITE_SHEET_CONTROLLER_CONFIG.zoomDelta : SPRITE_SHEET_CONTROLLER_CONFIG.zoomDelta;
          const newScale = Math.max(SPRITE_SHEET_CONTROLLER_CONFIG.minScale, Math.min(SPRITE_SHEET_CONTROLLER_CONFIG.maxScale, this.scale + zoomDelta));

          if (newScale !== this.scale) {
            // Reposition sprite so the local point under mouse stays at same screen position
            this.sprite.x = mouseX - parentBounds.x - (localX * newScale);
            this.sprite.y = mouseY - parentBounds.y - (localY * newScale);

            // Update scale
            this.setScale(newScale);
          }
        }
      };

      window.addEventListener('wheel', this.wheelHandler, { passive: false });
    }
  }

  /**
   * Setup middle mouse button pan handler
   */
  private setupMiddleMousePan() {
    if (typeof window !== 'undefined') {
      this.mouseDownHandler = (e: MouseEvent) => {
        if (e.button !== 1 || !this.sprite) return; // Middle button only

        // Get canvas bounds
        const canvas = this.renderer.canvas as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Convert client coordinates to canvas coordinates
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        // Get sprite sheet bounds
        const bounds = this.sprite.getBounds();

        // Check if mouse is over the sprite sheet
        if (canvasX >= bounds.x && canvasX <= bounds.x + bounds.width &&
            canvasY >= bounds.y && canvasY <= bounds.y + bounds.height) {
          e.preventDefault();
          this.isPanning = true;
          this.panStartX = e.clientX;
          this.panStartY = e.clientY;
          this.spriteStartX = this.sprite.x;
          this.spriteStartY = this.sprite.y;
        }
      };

      this.mouseMoveHandler = (e: MouseEvent) => {
        if (!this.isPanning || !this.sprite) return;

        e.preventDefault();

        // Get canvas bounds for scaling
        const canvas = this.renderer.canvas as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Calculate delta in screen space, then convert to canvas space
        const deltaScreenX = e.clientX - this.panStartX;
        const deltaScreenY = e.clientY - this.panStartY;
        const deltaX = deltaScreenX * scaleX;
        const deltaY = deltaScreenY * scaleY;

        // Update sprite position
        this.sprite.x = this.spriteStartX + deltaX;
        this.sprite.y = this.spriteStartY + deltaY;
      };

      this.mouseUpHandler = (e: MouseEvent) => {
        if (e.button === 1) { // Middle button
          this.isPanning = false;
        }
      };

      window.addEventListener('mousedown', this.mouseDownHandler);
      window.addEventListener('mousemove', this.mouseMoveHandler);
      window.addEventListener('mouseup', this.mouseUpHandler);
    }
  }

  /**
   * Get the current scale
   */
  public getScale(): number {
    return this.scale;
  }

  /**
   * Set the scale (supports smooth/fractional scaling)
   */
  public setScale(newScale: number) {
    const clampedScale = Math.max(SPRITE_SHEET_CONTROLLER_CONFIG.minScale, Math.min(SPRITE_SHEET_CONTROLLER_CONFIG.maxScale, newScale));
    // Allow smooth scaling - no rounding to integers
    if (clampedScale !== this.scale) {
      this.scale = clampedScale;
      if (this.onScaleChange) {
        this.onScaleChange(this.scale);
      }
    }
  }

  /**
   * Get the sprite sheet config
   */
  public getConfig(): SpriteSheetConfig {
    return this.config;
  }

  /**
   * Get the scaled dimensions
   */
  public getScaledDimensions(): { width: number; height: number } {
    return {
      width: this.config.width * this.scale,
      height: this.config.height * this.scale
    };
  }

  /**
   * Get pixel color at coordinates
   */
  public getPixel(x: number, y: number): number {
    if (x < 0 || x >= this.config.width || y < 0 || y >= this.config.height) {
      return 0;
    }
    return this.pixels[y][x];
  }

  /**
   * Set pixel color at coordinates
   */
  public setPixel(x: number, y: number, colorIndex: number) {
    if (x < 0 || x >= this.config.width || y < 0 || y >= this.config.height) {
      return;
    }
    if (colorIndex < 0 || colorIndex >= this.config.palette.length) {
      return;
    }
    this.pixels[y][x] = colorIndex;
  }

  /**
   * Update the texture from pixel data
   */
  private updateTexture() {
    // Create canvas to draw pixel data
    const canvas = document.createElement('canvas');
    canvas.width = this.config.width;
    canvas.height = this.config.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw each pixel to canvas
    for (let y = 0; y < this.config.height; y++) {
      for (let x = 0; x < this.config.width; x++) {
        const colorIndex = this.pixels[y][x];
        const color = this.config.palette[colorIndex];

        // Convert color to CSS format
        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Bake grid into texture if enabled
    if (this.showGrid) {
      const gridSize = SPRITE_SHEET_CONTROLLER_CONFIG.gridSize;
      ctx.strokeStyle = `rgba(128, 128, 128, ${SPRITE_SHEET_CONTROLLER_CONFIG.gridOpacity})`;
      ctx.lineWidth = 1;

      // Draw vertical grid lines
      for (let x = gridSize; x < this.config.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.config.height);
        ctx.stroke();
      }

      // Draw horizontal grid lines
      for (let y = gridSize; y < this.config.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.config.width, y);
        ctx.stroke();
      }
    }

    // Destroy old texture if exists
    // Use destroy(false) to keep the source alive for animation sub-textures
    // until they can be regenerated via onSpriteSheetUpdate()
    if (this.texture) {
      this.texture.destroy(false);
    }

    // Create texture from canvas with nearest neighbor scaling
    this.texture = PIXI.Texture.from(canvas);
    this.texture.source.scaleMode = 'nearest';
  }

  /**
   * Draw the cell overlay (highlighting selected/hovered cells and animation frames)
   */
  private drawCellOverlay() {
    if (!this.cellOverlay || !this.sprite) return;

    this.cellOverlay.clear();

    // Clean up old animation frame labels
    this.animationFrameLabels.forEach(label => label.destroy());
    this.animationFrameLabels = [];

    const cellSize = SPRITE_SHEET_CONTROLLER_CONFIG.cellSize * this.scale;
    // Sprite has anchor (0.5, 0.5), so adjust for centered origin
    const spriteX = this.sprite.x - (this.config.width * this.scale) / 2;
    const spriteY = this.sprite.y - (this.config.height * this.scale) / 2;
    const spriteWidth = this.config.width * this.scale;
    const spriteHeight = this.config.height * this.scale;

    // Draw selection mode overlay (semi-transparent tint over entire sprite)
    if (this.selectionModeActive) {
      // Draw a cyan/teal tinted overlay to indicate selection mode
      this.cellOverlay.rect(spriteX, spriteY, spriteWidth, spriteHeight);
      this.cellOverlay.fill({ color: 0x00ffff, alpha: 0.15 });

      // Draw a border around the sprite to make selection mode obvious
      this.cellOverlay.rect(spriteX, spriteY, spriteWidth, spriteHeight);
      this.cellOverlay.stroke({ color: 0x00ffff, width: 2, alpha: 0.8 });
    }

    // Draw animation frame highlights first (behind everything)
    if (this.animationFrameHighlights.length > 0) {
      this.animationFrameHighlights.forEach((frame, index) => {
        const x = spriteX + frame.cellX * cellSize;
        const y = spriteY + frame.cellY * cellSize;
        const isCurrentFrame = index === this.currentAnimationFrameIndex;

        // Draw light gray fill for all frames
        this.cellOverlay!.rect(x, y, cellSize, cellSize);
        this.cellOverlay!.fill({ color: 0xffffff, alpha: isCurrentFrame ? 0.4 : 0.2 });

        // Draw highlight border for current frame
        if (isCurrentFrame) {
          this.cellOverlay!.rect(x + 1, y + 1, cellSize - 2, cellSize - 2);
          this.cellOverlay!.stroke({ color: 0x00ff00, width: 2, alpha: 0.9 });
        }

        // Add sequence number label with black outline for readability
        const label = new PIXI.Text({
          text: String(index + 1),
          style: {
            fontSize: Math.max(8, cellSize * 0.4),
            fill: isCurrentFrame ? 0x00ff00 : 0xffffff,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            stroke: { color: 0x000000, width: 2 }
          }
        });
        label.alpha = isCurrentFrame ? 1.0 : 0.85;
        label.anchor.set(0.5);
        label.x = x + cellSize / 2;
        label.y = y + cellSize / 2;
        this.cellOverlay!.parent?.addChild(label);
        this.animationFrameLabels.push(label);
      });
    }

    // Draw selected cell (strong highlight)
    if (this.selectedCellX >= 0 && this.selectedCellY >= 0) {
      this.cellOverlay.rect(
        spriteX + this.selectedCellX * cellSize,
        spriteY + this.selectedCellY * cellSize,
        cellSize,
        cellSize
      );
      this.cellOverlay.stroke({ color: SPRITE_SHEET_CONTROLLER_CONFIG.selectedCellColor, width: SPRITE_SHEET_CONTROLLER_CONFIG.selectedCellStrokeWidth });
    }

    // Draw hovered cell on top (subtle highlight)
    if (this.hoveredCellX >= 0 && this.hoveredCellY >= 0) {
      this.cellOverlay.rect(
        spriteX + this.hoveredCellX * cellSize,
        spriteY + this.hoveredCellY * cellSize,
        cellSize,
        cellSize
      );
      this.cellOverlay.stroke({ color: SPRITE_SHEET_CONTROLLER_CONFIG.hoveredCellColor, width: SPRITE_SHEET_CONTROLLER_CONFIG.hoveredCellStrokeWidth, alpha: SPRITE_SHEET_CONTROLLER_CONFIG.hoveredCellAlpha });
    }
  }

  /**
   * Setup cell interaction handlers
   */
  private setupCellInteraction(container: PIXI.Container) {
    if (!this.onCellHover && !this.onCellClick) return;
    if (this.interactionSetup) return; // Already set up

    this.interactionSetup = true;
    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!this.sprite) return;

      // Convert to sprite-local coordinates (unscaled, centered at origin)
      const spriteLocal = e.getLocalPosition(this.sprite);
      const cellSize = SPRITE_SHEET_CONTROLLER_CONFIG.cellSize; // Cell size in texture space (unscaled)

      // Adjust for centered anchor (sprite origin is at center)
      const adjustedX = spriteLocal.x + (this.config.width / 2);
      const adjustedY = spriteLocal.y + (this.config.height / 2);

      const cellX = Math.floor(adjustedX / cellSize);
      const cellY = Math.floor(adjustedY / cellSize);

      const maxCellX = Math.floor(this.config.width / SPRITE_SHEET_CONTROLLER_CONFIG.cellSize) - 1;
      const maxCellY = Math.floor(this.config.height / SPRITE_SHEET_CONTROLLER_CONFIG.cellSize) - 1;

      if (cellX >= 0 && cellX <= maxCellX && cellY >= 0 && cellY <= maxCellY) {
        if (cellX !== this.hoveredCellX || cellY !== this.hoveredCellY) {
          this.hoveredCellX = cellX;
          this.hoveredCellY = cellY;
          this.drawCellOverlay();
          if (this.onCellHover) {
            this.onCellHover(cellX, cellY);
          }
        }
      } else {
        if (this.hoveredCellX !== -1 || this.hoveredCellY !== -1) {
          this.hoveredCellX = -1;
          this.hoveredCellY = -1;
          this.drawCellOverlay();
        }
      }
    });

    container.on('pointerout', () => {
      this.hoveredCellX = -1;
      this.hoveredCellY = -1;
      this.drawCellOverlay();
    });

    // Click and drag interaction
    container.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (!this.sprite) return;

      this.isDragging = false;
      this.dragStartX = e.global.x;
      this.dragStartY = e.global.y;
      this.spriteStartX = this.sprite.x;
      this.spriteStartY = this.sprite.y;
    });

    container.on('globalpointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!this.sprite) return;

      // Check if we've moved beyond the click threshold
      const dx = e.global.x - this.dragStartX;
      const dy = e.global.y - this.dragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > this.clickThreshold && (this.dragStartX !== 0 || this.dragStartY !== 0)) {
        this.isDragging = true;
        // Pan the sprite
        this.sprite.x = this.spriteStartX + dx;
        this.sprite.y = this.spriteStartY + dy;
      }
    });

    container.on('pointerup', () => {
      // If we didn't drag, it's a click - select the cell
      if (!this.isDragging && this.onCellClick) {
        if (this.hoveredCellX >= 0 && this.hoveredCellY >= 0) {
          this.selectedCellX = this.hoveredCellX;
          this.selectedCellY = this.hoveredCellY;
          this.drawCellOverlay();
          this.onCellClick!(this.selectedCellX, this.selectedCellY);
        }
      }

      // Reset drag state
      this.isDragging = false;
      this.dragStartX = 0;
      this.dragStartY = 0;
    });

    container.on('pointerupoutside', () => {
      // Reset drag state
      this.isDragging = false;
      this.dragStartX = 0;
      this.dragStartY = 0;
    });

    // Update overlay continuously to follow sprite when panning
    if (typeof window !== 'undefined') {
      const updateOverlay = () => {
        this.drawCellOverlay();
        this.animationFrameId = requestAnimationFrame(updateOverlay);
      };
      this.animationFrameId = requestAnimationFrame(updateOverlay);
    }
  }

  /**
   * Render the sprite sheet
   */
  public render(container: PIXI.Container) {
    // Preserve position if sprite already exists
    const preservedX = this.sprite?.x;
    const preservedY = this.sprite?.y;

    // Remove old sprite if it exists
    if (this.sprite) {
      container.removeChild(this.sprite);
    }

    // Remove old overlay if it exists
    if (this.cellOverlay) {
      container.removeChild(this.cellOverlay);
    }

    // Update texture from pixel data (with grid baked in if enabled)
    this.updateTexture();

    if (!this.texture) return;

    // Create sprite from texture
    this.sprite = new PIXI.Sprite(this.texture);
    this.sprite.anchor.set(0.5, 0.5); // Center origin for zoom
    this.sprite.scale.set(this.scale);

    // Use preserved position if available, otherwise center it
    if (preservedX !== undefined && preservedY !== undefined) {
      this.sprite.x = preservedX;
      this.sprite.y = preservedY;
    } else {
      // Initial position at center of texture dimensions
      this.sprite.x = (this.config.width * this.scale) / 2;
      this.sprite.y = (this.config.height * this.scale) / 2;
    }

    container.addChild(this.sprite);

    // Create and add cell overlay AFTER sprite (so it renders on top)
    this.cellOverlay = new PIXI.Graphics();
    this.cellOverlay.roundPixels = true;
    container.addChild(this.cellOverlay);

    // Setup cell interaction once
    if (this.onCellHover || this.onCellClick) {
      this.setupCellInteraction(container);
    }

    // Initial overlay draw
    this.drawCellOverlay();
  }

  /**
   * Programmatically select a cell
   */
  public selectCell(cellX: number, cellY: number) {
    this.selectedCellX = cellX;
    this.selectedCellY = cellY;
    this.drawCellOverlay();

    // Trigger onCellClick callback to update title
    if (this.onCellClick) {
      this.onCellClick(cellX, cellY);
    }
  }

  /**
   * Clear all pixels to a specific color
   */
  public clear(colorIndex: number = 0) {
    for (let y = 0; y < this.config.height; y++) {
      for (let x = 0; x < this.config.width; x++) {
        this.pixels[y][x] = colorIndex;
      }
    }
  }

  /**
   * Convert screen coordinates to sprite pixel coordinates
   */
  public screenToPixel(screenX: number, screenY: number): { x: number; y: number } | null {
    const pixelX = Math.floor(screenX / this.scale);
    const pixelY = Math.floor(screenY / this.scale);

    if (pixelX < 0 || pixelX >= this.config.width || pixelY < 0 || pixelY >= this.config.height) {
      return null;
    }

    return { x: pixelX, y: pixelY };
  }

  /**
   * Get all pixel data (for saving)
   */
  public getPixelData(): number[][] {
    // Return a deep copy to prevent external mutation
    return this.pixels.map(row => [...row]);
  }

  /**
   * Get the current texture (for creating sub-textures/frames)
   */
  public getTexture(): PIXI.Texture | null {
    return this.texture;
  }

  /**
   * Set all pixel data (for loading)
   */
  public setPixelData(pixels: number[][]): void {
    // Validate dimensions match
    if (pixels.length !== this.config.height) {
      console.error('Pixel data height mismatch');
      return;
    }
    if (pixels[0]?.length !== this.config.width) {
      console.error('Pixel data width mismatch');
      return;
    }

    // Deep copy the pixel data
    this.pixels = pixels.map(row => [...row]);
  }

  /**
   * Get current selected cell
   */
  public getSelectedCell(): { x: number; y: number } {
    return { x: this.selectedCellX, y: this.selectedCellY };
  }

  /**
   * Position the sprite so that cell 0,0 is at the top-left corner of the content container
   */
  public positionCell00AtTopLeft(): void {
    if (!this.sprite) return;

    // With anchor (0.5, 0.5), to position cell 0,0 at top-left (0,0) of content container:
    // sprite position = (width * scale) / 2, (height * scale) / 2
    this.sprite.x = (this.config.width * this.scale) / 2;
    this.sprite.y = (this.config.height * this.scale) / 2;

    // Redraw overlay to reflect new position
    this.drawCellOverlay();
  }

  /**
   * Set animation frame highlights to show which cells are part of an animation
   * @param frames Array of cell coordinates in sequence order, or null to clear
   * @param currentFrameIndex Index of the currently playing/selected frame (-1 for none)
   */
  public setAnimationFrameHighlights(frames: Array<{ cellX: number; cellY: number }> | null, currentFrameIndex: number = -1): void {
    this.animationFrameHighlights = frames ?? [];
    this.currentAnimationFrameIndex = currentFrameIndex;
    this.drawCellOverlay();
  }

  /**
   * Update just the current animation frame index (for playback updates)
   */
  public setCurrentAnimationFrameIndex(index: number): void {
    this.currentAnimationFrameIndex = index;
    this.drawCellOverlay();
  }

  /**
   * Get the current animation frame highlights
   */
  public getAnimationFrameHighlights(): Array<{ cellX: number; cellY: number }> {
    return this.animationFrameHighlights;
  }

  /**
   * Set selection mode active state
   * When active, shows a colored overlay to indicate cells can be selected for animation
   */
  public setSelectionMode(active: boolean): void {
    this.selectionModeActive = active;
    this.drawCellOverlay();
  }

  /**
   * Get current selection mode state
   */
  public isSelectionModeActive(): boolean {
    return this.selectionModeActive;
  }

  /**
   * Set a hovered animation frame cell (for external hover events like animation tick bars)
   * This will highlight the cell as if it were being hovered
   */
  public setHoveredAnimationFrame(cellX: number, cellY: number): void {
    this.hoveredCellX = cellX;
    this.hoveredCellY = cellY;
    this.drawCellOverlay();
  }

  /**
   * Clear the hovered animation frame cell
   */
  public clearHoveredAnimationFrame(): void {
    this.hoveredCellX = -1;
    this.hoveredCellY = -1;
    this.drawCellOverlay();
  }

  /**
   * Center a specific cell in the viewport
   * Positions the sprite so the given cell is centered in the content container
   */
  public centerCell(cellX: number, cellY: number, containerWidth: number, containerHeight: number): void {
    if (!this.sprite) return;

    const cellSize = SPRITE_SHEET_CONTROLLER_CONFIG.cellSize;

    // Calculate the center of the cell in sprite-local coordinates (unscaled)
    const cellCenterX = (cellX * cellSize) + (cellSize / 2);
    const cellCenterY = (cellY * cellSize) + (cellSize / 2);

    // Calculate the center of the container
    const containerCenterX = containerWidth / 2;
    const containerCenterY = containerHeight / 2;

    // With anchor (0.5, 0.5), sprite position (0,0) corresponds to sprite center
    // To center a cell: position sprite so that cell's scaled position aligns with container center
    // sprite.x + (cellLocalX - spriteLocalCenterX) * scale = containerCenterX

    const spriteCenterX = this.config.width / 2;
    const spriteCenterY = this.config.height / 2;

    this.sprite.x = containerCenterX - (cellCenterX - spriteCenterX) * this.scale;
    this.sprite.y = containerCenterY - (cellCenterY - spriteCenterY) * this.scale;

    // Redraw overlay to reflect new position
    this.drawCellOverlay();
  }

  /**
   * Clean up resources and event listeners
   * Call this when the controller is no longer needed to prevent memory leaks
   */
  public destroy(): void {
    // Remove window event listeners
    if (typeof window !== 'undefined') {
      if (this.wheelHandler) {
        window.removeEventListener('wheel', this.wheelHandler);
        this.wheelHandler = null;
      }
      if (this.mouseDownHandler) {
        window.removeEventListener('mousedown', this.mouseDownHandler);
        this.mouseDownHandler = null;
      }
      if (this.mouseMoveHandler) {
        window.removeEventListener('mousemove', this.mouseMoveHandler);
        this.mouseMoveHandler = null;
      }
      if (this.mouseUpHandler) {
        window.removeEventListener('mouseup', this.mouseUpHandler);
        this.mouseUpHandler = null;
      }
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    // Clean up PIXI resources
    if (this.texture) {
      this.texture.destroy(true);
      this.texture = null;
    }
    // Clean up animation frame labels
    this.animationFrameLabels.forEach(label => label.destroy());
    this.animationFrameLabels = [];
    this.animationFrameHighlights = [];

    if (this.cellOverlay) {
      this.cellOverlay.destroy();
      this.cellOverlay = null;
    }
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}

/**
 * Pixel-perfect card component with drag, resize, and triple border
 *
 * Refactored to use CardDragHandler and CardResizeHandler for cleaner SRP.
 *
 * ⚠️ CRITICAL: This component uses GRID UNITS for all dimensions!
 * - contentWidth/contentHeight are in GRID UNITS (not pixels)
 * - Internal calculations convert to pixels using px()
 * - All spacing, borders, padding use GRID constants
 *
 * @see ../utilities/README.md for grid system documentation
 */
import * as PIXI from 'pixi.js';
import { getTheme, createText, getFontDisplaySize } from '../theming/theme';
import { GRID, BORDER, px, asBitmapText } from '@moxijs/core';
import { CardDragHandler } from '../logic/card-drag-logic';
import { CardResizeHandler, ResizeDirection } from '../logic/card-resize-logic';

export interface PixelCardOptions {
  title: string;
  x?: number;
  y?: number;
  contentWidth: number;   // In grid units
  contentHeight: number;  // In grid units
  renderer: PIXI.Renderer;
  onResize?: (width: number, height: number) => void;
  onRefresh?: () => void; // Callback when card is refreshed (e.g., theme change)
  minContentSize?: boolean; // If true, prevents resizing below content's actual size
  minContentWidth?: number; // Explicit minimum content width in grid units
  minContentHeight?: number; // Explicit minimum content height in grid units
  backgroundColor?: number; // Custom background color (defaults to theme.cardBackground)
  clipContent?: boolean; // If true, clips content to container bounds (like CSS overflow: hidden)
  pairedCard?: PixelCard; // Optional paired card that should layer together
  onFocus?: () => void; // Callback when card is clicked/focused
  titleBarExtraHeight?: number; // Extra height to add to title bar (in grid units)
}

export interface PixelCardResizeState {
  contentWidth: number;   // Current content width in grid units
  contentHeight: number;  // Current content height in grid units
  minContentWidth?: number;  // Minimum content width in grid units (when minContentSize is enabled)
  minContentHeight?: number; // Minimum content height in grid units (when minContentSize is enabled)
}

/**
 * Creates a pixel-perfect card with drag, resize, and triple border
 */
export class PixelCard {
  public container: PIXI.Container;
  public contentContainer: PIXI.Container;
  private titleBarHeightPx: number;

  private options: PixelCardOptions;
  private state: PixelCardResizeState;

  // Extracted handlers
  private dragHandler: CardDragHandler;
  private resizeHandler: CardResizeHandler;

  private pairedCard: PixelCard | null = null;
  private onFocus: (() => void) | null = null;
  private onStateChange: (() => void) | null = null;
  private contentMask: PIXI.Graphics | null = null;

  constructor(options: PixelCardOptions) {
    this.options = options;
    this.pairedCard = options.pairedCard ?? null;
    this.onFocus = options.onFocus ?? null;

    this.container = new PIXI.Container();
    this.container.position.set(options.x ?? 0, options.y ?? 0);

    this.contentContainer = new PIXI.Container();

    // Make content container trigger focus on click (same as title bar)
    this.contentContainer.eventMode = 'static';
    this.contentContainer.on('pointerdown', () => {
      if (this.onFocus) {
        this.onFocus();
      }
    });

    this.state = {
      contentWidth: options.contentWidth,
      contentHeight: options.contentHeight,
      minContentWidth: options.minContentWidth,
      minContentHeight: options.minContentHeight,
    };

    // Calculate title bar height based on font DISPLAY size (not installation size)
    const fontHeight = getFontDisplaySize();
    const verticalPadding = px(GRID.padding * 2);
    const extraHeight = options.titleBarExtraHeight ? px(options.titleBarExtraHeight) : 0;
    this.titleBarHeightPx = Math.ceil(fontHeight + verticalPadding + extraHeight);

    // Initialize drag handler
    this.dragHandler = new CardDragHandler({
      renderer: options.renderer,
      container: this.container,
      onDragEnd: () => {
        if (this.onStateChange) {
          this.onStateChange();
        }
      },
    });

    // Initialize resize handler
    this.resizeHandler = new CardResizeHandler({
      renderer: options.renderer,
      container: this.container,
      getContentSize: () => ({
        width: this.state.contentWidth,
        height: this.state.contentHeight,
      }),
      setContentSize: (width, height) => {
        this.state.contentWidth = width;
        this.state.contentHeight = height;
      },
      getCardStartPosition: () => this.dragHandler.getCardStartPosition(),
      setCardStartPosition: (x, y) => this.dragHandler.setCardStartPosition(x, y),
      onResize: this.options.onResize,
      onResizeEnd: () => {
        if (this.onStateChange) {
          this.onStateChange();
        }
      },
      redraw: () => this.redraw(),
    });

    // Set initial constraints
    if (this.state.minContentWidth !== undefined && this.state.minContentHeight !== undefined) {
      this.resizeHandler.setConstraints(this.state.minContentWidth, this.state.minContentHeight);
    }

    // Register cleanup
    this.container.on('destroyed', () => {
      this.dragHandler.destroy();
      this.resizeHandler.destroy();
    });

    this.redraw();
  }

  private redraw() {
    // Clear all children except content container
    this.container.removeChildren();

    const cardWidth = BORDER.total * 2 + GRID.padding * 2 + this.state.contentWidth;
    const cardHeight = px(BORDER.total * 2) + this.titleBarHeightPx + px(GRID.padding * 2) + px(this.state.contentHeight);

    // Draw card background with triple border
    this.drawBackground(cardWidth, cardHeight);

    // Draw title bar
    this.drawTitleBar(cardWidth);

    // Position content container
    this.contentContainer.position.set(
      px(BORDER.total + GRID.padding),
      px(BORDER.total) + this.titleBarHeightPx + px(GRID.padding)
    );

    // Setup content clipping if enabled
    this.setupContentMask();

    this.container.addChild(this.contentContainer);

    // Add resize handles
    this.addResizeHandles(cardWidth, cardHeight);
  }

  private drawBackground(cardWidth: number, cardHeight: number) {
    const theme = getTheme();
    const bg = new PIXI.Graphics();
    bg.roundPixels = true;

    const shadowOffset = px(1);

    // Drop shadow
    bg.rect(shadowOffset, shadowOffset, px(cardWidth), cardHeight);
    bg.fill({ color: theme.cardBorder, alpha: 0.3 });

    // Layer 1: Outer border
    bg.rect(0, 0, px(cardWidth), cardHeight);
    bg.fill({ color: theme.cardBorder });

    // Layer 2: Middle border (using buttonBackground for subtle contrast)
    bg.rect(px(BORDER.outer), px(BORDER.outer),
            px(cardWidth - BORDER.outer * 2), cardHeight - px(BORDER.outer * 2));
    bg.fill({ color: theme.buttonBackground });

    // Layer 3: Inner border
    bg.rect(px(BORDER.outer + BORDER.middle), px(BORDER.outer + BORDER.middle),
            px(cardWidth - (BORDER.outer + BORDER.middle) * 2),
            cardHeight - px((BORDER.outer + BORDER.middle) * 2));
    bg.fill({ color: theme.cardBorder });

    // Layer 4: Content background
    bg.rect(px(BORDER.total), px(BORDER.total),
            px(cardWidth - BORDER.total * 2), cardHeight - px(BORDER.total * 2));
    bg.fill({ color: this.options.backgroundColor ?? theme.cardBackground });

    this.container.addChild(bg);
  }

  private drawTitleBar(cardWidth: number) {
    const theme = getTheme();
    const titleBar = new PIXI.Graphics();
    titleBar.roundPixels = true;
    titleBar.eventMode = 'static';
    titleBar.cursor = 'move';
    titleBar.rect(px(BORDER.total), px(BORDER.total),
                  px(cardWidth - BORDER.total * 2), this.titleBarHeightPx);
    titleBar.fill({ color: theme.cardTitleBar });

    // Title bar dragging
    titleBar.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (this.onFocus) {
        this.onFocus();
      }
      this.dragHandler.startDrag(e);
      e.stopPropagation();
    });

    this.container.addChild(titleBar);

    // Title text
    const titleText = createText(this.options.title, theme.text);

    const textHeight = titleText.height;
    const verticalCenter = px(BORDER.total) + (this.titleBarHeightPx - textHeight) / 2;
    titleText.position.set(px(BORDER.total) + 2, Math.floor(verticalCenter));
    this.container.addChild(titleText);

    // ALPHA! stamp for PIKCELL title (uses BitmapText for rotation/special styling)
    if (this.options.title === 'PIKCELL') {
      // Random bright color: pink, cyan, or lime green
      const stampColors = [0xff00ff, 0x00ffff, 0x00ff00];
      const stampColor = stampColors[Math.floor(Math.random() * stampColors.length)];
      
      const alphaStamp = asBitmapText(
        { text: 'ALPHA!', style: { fontFamily: 'KennyBlocksBitmap', fontSize: 64, fill: stampColor }, pixelPerfect: true },
        { anchor: 0.5, scale: 0.25 * 1.2 }
      );
      alphaStamp.tint = stampColor;
      alphaStamp.angle = -8;

      const stampX = titleText.x + titleText.width + px(2) + px(8) + px(2);
      const stampY = verticalCenter - px(2) + px(4) - px(1);
      alphaStamp.position.set(stampX, stampY);
      this.container.addChild(alphaStamp);
    }
  }

  private setupContentMask() {
    if (this.options.clipContent) {
      if (!this.contentMask) {
        this.contentMask = new PIXI.Graphics();
      }

      this.contentMask.clear();
      this.contentMask.rect(
        px(BORDER.total + GRID.padding),
        px(BORDER.total) + this.titleBarHeightPx + px(GRID.padding),
        px(this.state.contentWidth),
        px(this.state.contentHeight)
      );
      this.contentMask.fill({ color: 0xffffff });
      this.container.addChild(this.contentMask);
      this.contentContainer.mask = this.contentMask;
    } else {
      this.contentContainer.mask = null;
    }
  }

  private addResizeHandles(cardWidth: number, cardHeight: number) {
    const handleThickness = px(1);
    const cornerSize = px(2);

    const createResizeHandle = (
      x: number,
      y: number,
      width: number,
      height: number,
      cursor: string,
      direction: ResizeDirection
    ) => {
      const handle = new PIXI.Graphics();
      handle.roundPixels = true;
      handle.eventMode = 'static';
      handle.cursor = cursor;
      handle.rect(0, 0, width, height);
      handle.fill({ color: 0x000000, alpha: 0.01 });
      handle.position.set(x, y);

      handle.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        this.resizeHandler.startResize(e, direction);
        e.stopPropagation();
      });

      this.container.addChild(handle);
    };

    // Corners
    createResizeHandle(0, 0, cornerSize, cornerSize, 'nwse-resize', 'nw');
    createResizeHandle(px(cardWidth) - cornerSize, 0, cornerSize, cornerSize, 'nesw-resize', 'ne');
    createResizeHandle(0, cardHeight - cornerSize, cornerSize, cornerSize, 'nesw-resize', 'sw');
    createResizeHandle(px(cardWidth) - cornerSize, cardHeight - cornerSize, cornerSize, cornerSize, 'nwse-resize', 'se');

    // Edges
    createResizeHandle(cornerSize, 0, px(cardWidth) - cornerSize * 2, handleThickness, 'ns-resize', 'n');
    createResizeHandle(cornerSize, cardHeight - handleThickness, px(cardWidth) - cornerSize * 2, handleThickness, 'ns-resize', 's');
    createResizeHandle(0, cornerSize, handleThickness, cardHeight - cornerSize * 2, 'ew-resize', 'w');
    createResizeHandle(px(cardWidth) - handleThickness, cornerSize, handleThickness, cardHeight - cornerSize * 2, 'ew-resize', 'e');
  }

  // ============ Public API ============

  /**
   * Get the content container to add custom content
   */
  public getContentContainer(): PIXI.Container {
    return this.contentContainer;
  }

  /**
   * Get current content dimensions
   */
  public getContentSize(): { width: number; height: number } {
    return {
      width: this.state.contentWidth,
      height: this.state.contentHeight
    };
  }

  /**
   * Set content dimensions and redraw
   */
  public setContentSize(width: number, height: number) {
    this.state.contentWidth = width;
    this.state.contentHeight = height;
    this.redraw();

    if (this.options.onResize) {
      this.options.onResize(width, height);
    }
  }

  /**
   * Get total card width in pixels
   */
  public getPixelWidth(): number {
    const cardWidthGridUnits = this.state.contentWidth + BORDER.total * 2 + GRID.padding * 2;
    return px(cardWidthGridUnits);
  }

  /**
   * Get total card height in pixels
   */
  public getPixelHeight(): number {
    return px(this.state.contentHeight) + px(BORDER.total * 2) + this.titleBarHeightPx + px(GRID.padding * 2);
  }

  /**
   * Manually trigger a redraw
   */
  public refresh() {
    this.redraw();

    if (this.options.onRefresh) {
      this.options.onRefresh();
    }
  }

  /**
   * Update the card title
   */
  public setTitle(title: string) {
    this.options.title = title;
    this.redraw();
  }

  /**
   * Set custom title bar content with left and right aligned text
   */
  public setTitleContent(leftText: string, rightText: string) {
    this.options.title = '';

    const titleTextChildren = this.container.children.filter(
      child => child instanceof PIXI.Text
    );
    titleTextChildren.forEach(child => this.container.removeChild(child));

    const theme = getTheme();
    const textY = px(BORDER.total) + (this.titleBarHeightPx - getFontDisplaySize()) / 2;

    // Left-aligned text
    const leftTextEl = createText(leftText, theme.text, { x: px(BORDER.total) + 2, y: Math.floor(textY) });
    this.container.addChild(leftTextEl);

    // Right-aligned text
    const rightTextEl = createText(rightText, theme.text);

    const cardWidth = this.state.contentWidth + BORDER.total * 2 + GRID.padding * 2;
    const rightX = px(cardWidth - BORDER.total) - rightTextEl.width - 2;
    rightTextEl.position.set(rightX, Math.floor(textY));
    this.container.addChild(rightTextEl);
  }

  /**
   * Set title bar with an icon and text
   * @param drawIcon Function to draw the icon into a graphics object
   * @param text Text to display after the icon
   * @param iconSize Size of the icon in pixels (default 8)
   */
  public setTitleWithIcon(
    drawIcon: (g: PIXI.Graphics, x: number, y: number, color: number, pixelSize: number) => void,
    text: string,
    iconSize: number = 8
  ) {
    this.options.title = '';

    // Remove existing title elements (text and icon graphics)
    // Keep: background (first Graphics), title bar (cursor='move'), content mask, and resize handles
    const toRemove = this.container.children.filter(
      child => child instanceof PIXI.Text ||
               (child instanceof PIXI.Graphics &&
                child.cursor !== 'move' &&
                child.cursor !== 'pointer' &&
                !child.cursor?.includes('resize') &&
                child !== this.contentMask)
    );
    // Skip the first graphics element (background)
    const titleElements = toRemove.slice(1);
    titleElements.forEach(child => {
      this.container.removeChild(child);
    });

    const theme = getTheme();
    const fontHeight = getFontDisplaySize();
    const textY = px(BORDER.total) + (this.titleBarHeightPx - fontHeight) / 2;

    // Icon positioning - center vertically in title bar
    const iconY = px(BORDER.total) + (this.titleBarHeightPx - iconSize) / 2;
    const iconX = px(BORDER.total) + 2;

    // Draw the icon with 2x pixel size for better visibility in title bar
    const iconPixelSize = 2;
    const iconGraphics = new PIXI.Graphics();
    iconGraphics.roundPixels = true;
    drawIcon(iconGraphics, iconX, iconY, theme.text, iconPixelSize);
    this.container.addChild(iconGraphics);

    // Add text after the icon
    const textX = iconX + iconSize + 4; // 4px gap after icon
    const titleText = createText(text, theme.text, { x: textX, y: Math.floor(textY) });
    this.container.addChild(titleText);
  }

  /**
   * Set the paired card
   */
  public setPairedCard(card: PixelCard) {
    this.pairedCard = card;
  }

  /**
   * Get the paired card
   */
  public getPairedCard(): PixelCard | null {
    return this.pairedCard;
  }

  /**
   * Set callback for when card state changes (position/size)
   */
  public onStateChanged(callback: () => void) {
    this.onStateChange = callback;
  }

  /**
   * Export card state for persistence
   */
  public exportState(id: string): { id: string; x: number; y: number; contentWidth: number; contentHeight: number; visible: boolean } {
    return {
      id,
      x: this.container.x,
      y: this.container.y,
      contentWidth: this.state.contentWidth,
      contentHeight: this.state.contentHeight,
      visible: this.container.visible
    };
  }

  /**
   * Import card state (restore position and size)
   */
  public importState(state: { x: number; y: number; contentWidth: number; contentHeight: number; visible: boolean }): void {
    this.container.position.set(state.x, state.y);
    this.container.visible = state.visible;

    if (state.contentWidth !== this.state.contentWidth ||
        state.contentHeight !== this.state.contentHeight) {
      this.setContentSize(state.contentWidth, state.contentHeight);
    }
  }

  /**
   * Updates minimum content size based on actual content bounds
   */
  public updateMinContentSize() {
    if (!this.options.minContentSize) return;

    const bounds = this.contentContainer.getLocalBounds();

    const minWidth = Math.ceil((bounds.x + bounds.width) / px(1));
    const minHeight = Math.ceil((bounds.y + bounds.height) / px(1));

    this.state.minContentWidth = minWidth;
    this.state.minContentHeight = minHeight;
    this.resizeHandler.setConstraints(minWidth, minHeight);

    if (this.state.contentWidth < minWidth || this.state.contentHeight < minHeight) {
      this.state.contentWidth = Math.max(this.state.contentWidth, minWidth);
      this.state.contentHeight = Math.max(this.state.contentHeight, minHeight);
      this.redraw();
    }
  }
}

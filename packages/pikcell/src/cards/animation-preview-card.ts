/**
 * Animation Preview Card
 *
 * UI for animation preview with controls in the title bar.
 *
 * Layout:
 * +----------------------------------------+
 * | [<][|>][>]                    [*][X]   |  <- Playback left, settings/close right
 * +----------------------------------------+
 * |          +------------+                |
 * |          |  Preview   |                |
 * |          +------------+                |
 * |         [|][|][|][+]                   |  <- Frame strip (tick bars)
 * +----------------------------------------+
 */
import * as PIXI from 'pixi.js';
import { GRID, px } from '@moxijs/ui';
import { createManagedCard } from '../utilities/managed-card';
import { CardResult } from '../interfaces/components';
import { ANIMATION_PREVIEW_CARD_CONFIG } from '../config/card-configs';
import { ANIMATION_CONSTANTS } from '../config/constants';
import { AnimationController } from '../controllers/animation-controller';
import { SpriteSheetController } from '../controllers/sprite-sheet-controller';
import {
  AnimationSequenceConfig,
  SpriteFrameRef,
  createDefaultSequence
} from '../interfaces/animation-types';
import { getTheme, createText } from '../theming/theme';
import { createPixelButton } from '../components/pixel-button';
import { SPRITE_CONTROLLER_CONFIG } from '../config/controller-configs';

export interface AnimationPreviewCardOptions {
  id: string;
  x: number;
  y: number;
  renderer: PIXI.Renderer;
  spriteSheetController: SpriteSheetController;
  initialSequence?: AnimationSequenceConfig;
  onSequenceChange?: (sequence: AnimationSequenceConfig) => void;
  onClose?: () => void;
  onFocus?: () => void;
  onSelectionModeChange?: (isSelecting: boolean) => void;
  onShowSettings?: () => void;
  /** Called when current frame changes during playback */
  onFrameChange?: (frameIndex: number) => void;
}

export interface AnimationPreviewCardResult extends CardResult {
  id: string;
  controller: AnimationController;
  play: () => void;
  pause: () => void;
  stop: () => void;
  togglePlayback: () => void;
  setSequence: (sequence: AnimationSequenceConfig) => void;
  getSequence: () => AnimationSequenceConfig;
  addFrame: (frame: SpriteFrameRef) => void;
  removeFrame: (index: number) => void;
  refresh: () => void;
  isSelectingFrames: () => boolean;
  setSelectingFrames: (selecting: boolean) => void;
  /** Called when user clicks a cell on sprite sheet while in selection mode */
  handleCellClick: (cellX: number, cellY: number) => void;
  /** Get frames for highlighting on sprite sheet */
  getFrameCells: () => Array<{ cellX: number; cellY: number }>;
  /** Get current frame index for highlight updates */
  getCurrentFrameIndex: () => number;
}

/**
 * Creates an animation preview card
 */
export function createAnimationPreviewCard(options: AnimationPreviewCardOptions): AnimationPreviewCardResult {
  const {
    id,
    x,
    y,
    renderer,
    spriteSheetController,
    initialSequence,
    onSequenceChange,
    onClose,
    onFocus,
    onSelectionModeChange,
    onShowSettings,
    onFrameChange
  } = options;

  const config = ANIMATION_PREVIEW_CARD_CONFIG;

  // State
  let previewSize: number = config.defaultPreviewSize;
  const sequence = initialSequence ?? createDefaultSequence();
  let isSelectingFrames = false;
  let isPlaying = false;

  // Layout calculations
  // Tick bars are smaller than thumbnails - 8 grid units high + padding
  const frameStripHeight = 8 + GRID.padding;
  const contentWidth = previewSize + GRID.padding * 4;
  const contentHeight = previewSize + frameStripHeight + GRID.padding * 2;

  // Create the managed card
  const managed = createManagedCard({
    title: '',
    x,
    y,
    contentWidth,
    contentHeight,
    renderer,
    onFocus,
    titleBarExtraHeight: 1, // Extra height for playback control buttons
    onResize: (newWidth, newHeight) => {
      const availableWidth = newWidth - GRID.padding * 4;
      const availableHeight = newHeight - frameStripHeight - GRID.padding * 2;
      previewSize = Math.max(
        config.minPreviewSize,
        Math.min(config.maxPreviewSize, Math.min(availableWidth, availableHeight))
      );
      redrawContent();
    },
    onRefresh: () => {
      redrawContent();
    }
  });

  const { card, contentContainer } = managed;

  // Title bar buttons - layout: [<][|>][>]          [*][X]
  // Playback controls left-aligned, settings/close right-aligned
  const btnSize = config.controlButtonSize;
  const btnSpacing = 1; // Grid units between buttons
  const cardTotalWidth = contentWidth + GRID.border * 6 + GRID.padding * 2;
  const btnY = px(GRID.border * 2); // Align with title bar top

  // Track all title bar buttons for cleanup
  const titleBarButtons: Array<{ destroy: () => void }> = [];

  // === RIGHT-ALIGNED: Settings and Close ===
  const rightEdge = cardTotalWidth - GRID.border * 2 - 1;
  let rightX = rightEdge;

  // Close button [X] (rightmost)
  rightX -= btnSize;
  const closeBtn = createPixelButton({
    size: btnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: 'X',
    onClick: () => onClose?.()
  });
  closeBtn.container.position.set(px(rightX), btnY);
  card.container.addChild(closeBtn.container);
  titleBarButtons.push(closeBtn);

  // Settings button [*]
  rightX -= btnSpacing + btnSize;
  const settingsBtn = createPixelButton({
    size: btnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: '*',
    onClick: () => onShowSettings?.()
  });
  settingsBtn.container.position.set(px(rightX), btnY);
  card.container.addChild(settingsBtn.container);
  titleBarButtons.push(settingsBtn);

  // === LEFT-ALIGNED: Playback controls ===
  let leftX = GRID.border * 2;

  // Back frame button [<]
  const backBtn = createPixelButton({
    size: btnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: '<',
    onClick: () => {
      animController.stepBackward();
    }
  });
  backBtn.container.position.set(px(leftX), btnY);
  card.container.addChild(backBtn.container);
  titleBarButtons.push(backBtn);

  // Play/Pause button [|>] or [||]
  leftX += btnSize + btnSpacing;
  const playPauseBtnX = leftX; // Store for updatePlayPauseButton
  let playPauseBtn = createPixelButton({
    size: btnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: '|>',
    onClick: () => {
      animController.togglePlayback();
    }
  });
  playPauseBtn.container.position.set(px(leftX), btnY);
  card.container.addChild(playPauseBtn.container);
  titleBarButtons.push(playPauseBtn);

  // Forward frame button [>]
  leftX += btnSize + btnSpacing;
  const forwardBtn = createPixelButton({
    size: btnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: '>',
    onClick: () => {
      animController.stepForward();
    }
  });
  forwardBtn.container.position.set(px(leftX), btnY);
  card.container.addChild(forwardBtn.container);
  titleBarButtons.push(forwardBtn);

  /**
   * Update play/pause button label based on play state
   */
  function updatePlayPauseButton() {
    // Remove old button
    card.container.removeChild(playPauseBtn.container);
    playPauseBtn.destroy();

    // Create new button with updated label
    playPauseBtn = createPixelButton({
      size: btnSize,
      selectionMode: 'press',
      actionMode: 'click',
      label: isPlaying ? '||' : '|>',
      onClick: () => {
        animController.togglePlayback();
      }
    });
    playPauseBtn.container.position.set(px(playPauseBtnX), btnY);
    card.container.addChild(playPauseBtn.container);
    // Update the reference in titleBarButtons
    titleBarButtons[3] = playPauseBtn;
  }

  // Animation controller
  const animController = new AnimationController({
    spriteSheetController,
    sequence,
    scale: ANIMATION_CONSTANTS.DEFAULT_PREVIEW_SCALE,
    onFrameChange: (frameIndex, texture) => {
      updatePreviewSprite(texture);
      redrawFrameStrip();
      // Notify external listener (e.g., for updating spritesheet highlights)
      onFrameChange?.(frameIndex);
    },
    onPlayStateChange: (playing) => {
      isPlaying = playing;
      updatePlayPauseButton();
    }
  });

  // Containers
  let previewContainer: PIXI.Container = new PIXI.Container();
  let frameStripContainer: PIXI.Container = new PIXI.Container();
  let previewSprite: PIXI.Sprite | null = null;

  contentContainer.addChild(previewContainer);
  contentContainer.addChild(frameStripContainer);

  // Make content container interactive to trigger focus on any click
  contentContainer.eventMode = 'static';
  contentContainer.on('pointerdown', () => {
    onFocus?.();
  });

  /**
   * Update the preview sprite texture
   */
  function updatePreviewSprite(texture: PIXI.Texture) {
    if (previewSprite) {
      previewSprite.texture = texture;
    }
  }

  /**
   * Draw the preview area
   */
  function redrawPreview() {
    previewContainer.removeChildren();

    const theme = getTheme();
    const cellSize = SPRITE_CONTROLLER_CONFIG.cellSize;
    const previewSizePx = px(previewSize);
    const scale = Math.floor(previewSizePx / cellSize);

    // Background
    const bg = new PIXI.Graphics();
    bg.roundPixels = true;
    bg.rect(0, 0, previewSizePx, previewSizePx);
    bg.fill({ color: theme.cardTitleBar });
    previewContainer.addChild(bg);

    // Preview sprite
    const texture = animController.getCurrentFrameTexture();
    if (texture) {
      previewSprite = new PIXI.Sprite(texture);
      previewSprite.scale.set(scale);
      previewSprite.roundPixels = true;
      previewSprite.position.set(
        (previewSizePx - cellSize * scale) / 2,
        (previewSizePx - cellSize * scale) / 2
      );
      previewContainer.addChild(previewSprite);
    } else {
      previewSprite = null;
      const noFramesText = createText('No frames', theme.text);
      noFramesText.position.set(
        (previewSizePx - noFramesText.width) / 2,
        (previewSizePx - noFramesText.height) / 2
      );
      previewContainer.addChild(noFramesText);
    }

    // Center preview
    const contentWidthPx = px(contentWidth);
    previewContainer.position.set(
      (contentWidthPx - previewSizePx) / 2,
      px(GRID.padding)
    );
  }

  /**
   * Draw the frame strip with tick bars instead of thumbnails
   * More compact - allows more frames to fit
   */
  function redrawFrameStrip() {
    frameStripContainer.removeChildren();

    const theme = getTheme();
    const frames = sequence.frames;
    const currentFrameIndex = animController.getCurrentFrameIndex();

    // Tick bar dimensions - much smaller than thumbnails
    const tickWidth = px(2);    // Narrow bar
    const tickHeight = px(8);   // Short height
    const tickSpacing = px(1);  // Tight spacing
    const addBtnSize = config.controlButtonSize;
    const addBtnSizePx = px(addBtnSize);

    // Calculate strip dimensions
    const totalTickWidth = frames.length * (tickWidth + tickSpacing);
    const totalWidth = totalTickWidth + addBtnSizePx + px(2); // + button with gap

    // Center the strip
    const contentWidthPx = px(contentWidth);
    const startX = (contentWidthPx - totalWidth) / 2;

    // Frame tick bars
    frames.forEach((frameRef, index) => {
      const tickX = startX + index * (tickWidth + tickSpacing);

      const tickBar = new PIXI.Graphics();
      tickBar.roundPixels = true;
      tickBar.eventMode = 'static';
      tickBar.cursor = 'pointer';

      // Current frame gets accent color, others get muted color
      const isCurrentFrame = index === currentFrameIndex;
      const barColor = isCurrentFrame ? theme.accent : theme.cardBorder;
      const barAlpha = isCurrentFrame ? 1.0 : 0.6;

      // Draw the tick bar
      tickBar.roundRect(tickX, 0, tickWidth, tickHeight, 1);
      tickBar.fill({ color: barColor, alpha: barAlpha });

      // Add subtle border for visibility
      if (isCurrentFrame) {
        tickBar.roundRect(tickX, 0, tickWidth, tickHeight, 1);
        tickBar.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
      }

      frameStripContainer.addChild(tickBar);

      // Click to select frame
      tickBar.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        onFocus?.();
        animController.goToFrame(index);
        e.stopPropagation();
      });

      // Right-click to remove
      tickBar.on('rightclick', (e: PIXI.FederatedPointerEvent) => {
        onFocus?.();
        animController.removeFrame(index);
        onSequenceChange?.(sequence);
        redrawContent();
        e.stopPropagation();
      });
    });

    // Add/Select frame button [+] - toggles selection mode
    const addX = startX + frames.length * (tickWidth + tickSpacing) + px(1);
    const addBtn = createPixelButton({
      size: addBtnSize,
      selectionMode: 'press',
      actionMode: 'toggle',
      selected: isSelectingFrames,
      label: '+',
      onClick: () => {
        isSelectingFrames = !isSelectingFrames;
        onSelectionModeChange?.(isSelectingFrames);
        redrawFrameStrip();
      }
    });
    managed.trackChild(addBtn);
    // Vertically center the button relative to ticks
    const addBtnY = (tickHeight - addBtnSizePx) / 2;
    addBtn.container.position.set(addX, addBtnY);
    frameStripContainer.addChild(addBtn.container);

    // Position strip below preview with less vertical space
    const previewSizePx = px(previewSize);
    frameStripContainer.position.set(0, px(GRID.padding) + previewSizePx + px(1));
  }

  /**
   * Redraw all content
   */
  function redrawContent() {
    managed.clearChildren();
    redrawPreview();
    redrawFrameStrip();
  }

  // Initial draw
  redrawContent();

  return {
    id,
    card,
    container: card.container,
    controller: animController,

    play: () => animController.play(),
    pause: () => animController.pause(),
    stop: () => animController.stop(),
    togglePlayback: () => animController.togglePlayback(),

    setSequence: (newSequence: AnimationSequenceConfig) => {
      Object.assign(sequence, newSequence);
      animController.setSequence(sequence);
      redrawContent();
    },

    getSequence: () => animController.getSequence(),

    addFrame: (frame: SpriteFrameRef) => {
      animController.addFrame(frame);
      onSequenceChange?.(sequence);
      redrawContent();
    },

    removeFrame: (index: number) => {
      animController.removeFrame(index);
      onSequenceChange?.(sequence);
      redrawContent();
    },

    refresh: () => {
      animController.onSpriteSheetUpdate();
      redrawContent();
    },

    isSelectingFrames: () => isSelectingFrames,

    setSelectingFrames: (selecting: boolean) => {
      isSelectingFrames = selecting;
      onSelectionModeChange?.(isSelectingFrames);
      redrawFrameStrip();
    },

    handleCellClick: (cellX: number, cellY: number) => {
      if (!isSelectingFrames) return;

      // Check if this cell is already in the sequence
      const existingIndex = sequence.frames.findIndex(
        f => f.cellX === cellX && f.cellY === cellY
      );

      if (existingIndex >= 0) {
        // Remove this frame
        animController.removeFrame(existingIndex);
      } else {
        // Add this frame
        animController.addFrame({ cellX, cellY });
      }

      onSequenceChange?.(sequence);
      redrawContent();
    },

    getFrameCells: () => {
      return sequence.frames.map(f => ({ cellX: f.cellX, cellY: f.cellY }));
    },
    getCurrentFrameIndex: () => animController.getCurrentFrameIndex(),

    destroy: () => {
      // Exit selection mode on destroy
      if (isSelectingFrames) {
        isSelectingFrames = false;
        onSelectionModeChange?.(false);
      }
      animController.destroy();
      // Clean up all title bar buttons
      titleBarButtons.forEach(btn => btn.destroy());
      managed.destroy();
    }
  };
}

/**
 * Animation Preview Card
 *
 * UI for animation preview with controls above the preview area.
 *
 * Layout:
 * +----------------------------------+
 * | Animation                    [X] |  <- Title bar with close
 * +----------------------------------+
 * |  [>] 12fps [L][P]                |  <- Controls row
 * |        +------------+            |
 * |        |  Preview   |            |
 * |        +------------+            |
 * |       [0][1][2][+]               |  <- Frame strip
 * +----------------------------------+
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
    onShowSettings
  } = options;

  const config = ANIMATION_PREVIEW_CARD_CONFIG;

  // State
  let previewSize: number = config.defaultPreviewSize;
  const sequence = initialSequence ?? createDefaultSequence();
  let isSelectingFrames = false;

  // Layout calculations
  const frameStripHeight = config.frameThumbnailSize + GRID.padding;
  const contentWidth = previewSize + GRID.padding * 4;
  const contentHeight = previewSize + frameStripHeight + GRID.padding * 2;

  // Create the managed card
  const managed = createManagedCard({
    title: 'Animation',
    x,
    y,
    contentWidth,
    contentHeight,
    renderer,
    onFocus,
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

  // Title bar buttons
  const closeBtnSize = config.controlButtonSize;
  const cardTotalWidth = contentWidth + GRID.border * 6 + GRID.padding * 2;

  // Close button in title bar (rightmost)
  const titleBarCloseBtn = createPixelButton({
    size: closeBtnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: 'X',
    onClick: () => {
      onClose?.();
    }
  });
  titleBarCloseBtn.container.position.set(
    px(cardTotalWidth - GRID.border * 2 - closeBtnSize - 1),
    px(GRID.border * 2)
  );
  card.container.addChild(titleBarCloseBtn.container);

  // Settings button in title bar (left of close)
  // Use label instead of icon to match close button size
  const settingsBtn = createPixelButton({
    size: closeBtnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: '*',  // Simple gear representation, same style as X
    onClick: () => {
      onShowSettings?.();
    }
  });
  settingsBtn.container.position.set(
    px(cardTotalWidth - GRID.border * 2 - closeBtnSize * 2 - config.titleControlSpacing - 1),
    px(GRID.border * 2)
  );
  card.container.addChild(settingsBtn.container);

  // Animation controller
  const animController = new AnimationController({
    spriteSheetController,
    sequence,
    scale: ANIMATION_CONSTANTS.DEFAULT_PREVIEW_SCALE,
    onFrameChange: (frameIndex, texture) => {
      updatePreviewSprite(texture);
      redrawFrameStrip();
    }
  });

  // Containers
  let previewContainer: PIXI.Container = new PIXI.Container();
  let frameStripContainer: PIXI.Container = new PIXI.Container();
  let previewSprite: PIXI.Sprite | null = null;

  contentContainer.addChild(previewContainer);
  contentContainer.addChild(frameStripContainer);

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
   * Draw the frame strip
   */
  function redrawFrameStrip() {
    frameStripContainer.removeChildren();

    const theme = getTheme();
    const thumbSize = config.frameThumbnailSize;
    const thumbSizePx = px(thumbSize);
    const spacingPx = px(config.frameSpacing);
    const frames = sequence.frames;
    const currentFrameIndex = animController.getCurrentFrameIndex();
    const cellSize = SPRITE_CONTROLLER_CONFIG.cellSize;

    // Calculate strip dimensions
    const addButtonWidth = thumbSizePx;
    const totalFrameWidth = frames.length * (thumbSizePx + spacingPx);
    const totalWidth = totalFrameWidth + addButtonWidth;

    // Center the strip
    const contentWidthPx = px(contentWidth);
    const startX = (contentWidthPx - totalWidth) / 2;

    // Frame thumbnails
    frames.forEach((frameRef, index) => {
      const thumbX = startX + index * (thumbSizePx + spacingPx);

      // Background with highlight for current frame
      const thumbBg = new PIXI.Graphics();
      thumbBg.roundPixels = true;
      thumbBg.eventMode = 'static';
      thumbBg.cursor = 'pointer';

      if (index === currentFrameIndex) {
        thumbBg.rect(thumbX - px(1), -px(1), thumbSizePx + px(2), thumbSizePx + px(2));
        thumbBg.fill({ color: theme.accent });
      }

      thumbBg.rect(thumbX, 0, thumbSizePx, thumbSizePx);
      thumbBg.fill({ color: theme.cardTitleBar });
      frameStripContainer.addChild(thumbBg);

      // Thumbnail sprite
      const texture = animController.getFrameTexture(index);
      if (texture) {
        const thumbSprite = new PIXI.Sprite(texture);
        const thumbScale = Math.floor(thumbSizePx / cellSize);
        thumbSprite.scale.set(thumbScale);
        thumbSprite.roundPixels = true;
        thumbSprite.position.set(
          thumbX + (thumbSizePx - cellSize * thumbScale) / 2,
          (thumbSizePx - cellSize * thumbScale) / 2
        );
        frameStripContainer.addChild(thumbSprite);
      }

      // Cell coordinates label
      const coordText = createText(`${frameRef.cellX},${frameRef.cellY}`, theme.text);
      coordText.scale.set(0.5);
      coordText.position.set(
        thumbX + (thumbSizePx - coordText.width * 0.5) / 2,
        thumbSizePx + px(1)
      );
      frameStripContainer.addChild(coordText);

      // Click to select frame
      thumbBg.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        animController.goToFrame(index);
        e.stopPropagation();
      });

      // Right-click to remove
      thumbBg.on('rightclick', (e: PIXI.FederatedPointerEvent) => {
        animController.removeFrame(index);
        onSequenceChange?.(sequence);
        redrawContent();
        e.stopPropagation();
      });
    });

    // Add/Select frame button [+] - toggles selection mode
    // Use same size as close button (controlButtonSize)
    const addBtnSize = config.controlButtonSize;
    const addBtnSizePx = px(addBtnSize);
    const addX = startX + frames.length * (thumbSizePx + spacingPx);
    const addBtn = createPixelButton({
      size: addBtnSize,
      selectionMode: 'press',
      actionMode: 'toggle',
      selected: isSelectingFrames,
      label: '+',  // Simple label, same style as X
      onClick: () => {
        isSelectingFrames = !isSelectingFrames;
        onSelectionModeChange?.(isSelectingFrames);
        redrawFrameStrip();
      }
    });
    managed.trackChild(addBtn);
    // Vertically center the smaller button relative to thumbnails
    const addBtnY = (thumbSizePx - addBtnSizePx) / 2;
    addBtn.container.position.set(addX, addBtnY);
    frameStripContainer.addChild(addBtn.container);

    // Position strip below preview
    const previewSizePx = px(previewSize);
    frameStripContainer.position.set(0, px(GRID.padding) + previewSizePx + px(GRID.padding));
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

    destroy: () => {
      // Exit selection mode on destroy
      if (isSelectingFrames) {
        isSelectingFrames = false;
        onSelectionModeChange?.(false);
      }
      animController.destroy();
      settingsBtn.destroy();
      titleBarCloseBtn.destroy();
      managed.destroy();
    }
  };
}

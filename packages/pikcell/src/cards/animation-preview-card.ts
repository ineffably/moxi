/**
 * Animation Preview Card
 *
 * UI for animation preview with controls in the title bar.
 * Supports multiple animation sequences (rows).
 *
 * Layout:
 * +----------------------------------------+
 * | [<][|>][>]                    [*][X]   |  <- Playback left, settings/close right
 * +----------------------------------------+
 * |          +------------+                |
 * |          |  Preview   |                |
 * |          +------------+                |
 * |    [|][|][|][+][++]                    |  <- Row 1: ticks, add frame, add row
 * |    [X][|][|][+]                        |  <- Row 2+: remove, ticks, add frame
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
import { createConfirmDialog } from '../components/confirm-dialog';

export interface AnimationPreviewCardOptions {
  id: string;
  x: number;
  y: number;
  renderer: PIXI.Renderer;
  spriteSheetController: SpriteSheetController;
  initialSequences?: AnimationSequenceConfig[];
  onSequenceChange?: (sequences: AnimationSequenceConfig[]) => void;
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
  getSequences: () => AnimationSequenceConfig[];
  addFrame: (frame: SpriteFrameRef) => void;
  removeFrame: (index: number) => void;
  refresh: () => void;
  isSelectingFrames: () => boolean;
  setSelectingFrames: (selecting: boolean) => void;
  /** Called when user clicks a cell on sprite sheet while in selection mode */
  handleCellClick: (cellX: number, cellY: number) => void;
  /** Get frames for highlighting on sprite sheet (all sequences combined) */
  getFrameCells: () => Array<{ cellX: number; cellY: number }>;
  /** Get current frame index for highlight updates */
  getCurrentFrameIndex: () => number;
}

/**
 * Creates an animation preview card with multiple sequence support
 */
export function createAnimationPreviewCard(options: AnimationPreviewCardOptions): AnimationPreviewCardResult {
  const {
    id,
    x,
    y,
    renderer,
    spriteSheetController,
    initialSequences,
    onSequenceChange,
    onClose,
    onFocus,
    onSelectionModeChange,
    onShowSettings,
    onFrameChange
  } = options;

  const config = ANIMATION_PREVIEW_CARD_CONFIG;

  // State - multiple sequences
  const sequences: AnimationSequenceConfig[] = initialSequences && initialSequences.length > 0
    ? [...initialSequences]
    : [createDefaultSequence()];
  const animControllers: AnimationController[] = [];

  let previewSize: number = config.defaultPreviewSize;
  let activeRowIndex = 0;
  let selectingRowIndex = -1; // -1 means no row is in selection mode
  let isPlaying = false;

  // Layout calculations
  const rowHeight = 10; // Grid units per row
  const baseFrameStripHeight = rowHeight + GRID.padding;

  function getContentHeight() {
    return previewSize + (sequences.length * rowHeight) + GRID.padding * 2;
  }

  const contentWidth = previewSize + GRID.padding * 4;

  // Create the managed card
  const managed = createManagedCard({
    title: '',
    x,
    y,
    contentWidth,
    contentHeight: getContentHeight(),
    renderer,
    onFocus,
    titleBarExtraHeight: 1,
    onResize: (newWidth, newHeight) => {
      const availableWidth = newWidth - GRID.padding * 4;
      const availableHeight = newHeight - (sequences.length * rowHeight) - GRID.padding * 2;
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

  // Create animation controllers for each sequence
  function createControllerForSequence(seq: AnimationSequenceConfig, index: number): AnimationController {
    return new AnimationController({
      spriteSheetController,
      sequence: seq,
      scale: ANIMATION_CONSTANTS.DEFAULT_PREVIEW_SCALE,
      onFrameChange: (frameIndex, texture) => {
        if (index === activeRowIndex) {
          updatePreviewSprite(texture);
          onFrameChange?.(frameIndex);
        }
        redrawFrameStrips();
      },
      onPlayStateChange: (playing) => {
        if (index === activeRowIndex) {
          isPlaying = playing;
          updatePlayPauseButton();
        }
      }
    });
  }

  // Initialize controllers
  sequences.forEach((seq, i) => {
    animControllers.push(createControllerForSequence(seq, i));
  });

  // Title bar buttons
  const btnSize = config.controlButtonSize;
  const btnSpacing = 1;
  const cardTotalWidth = contentWidth + GRID.border * 6 + GRID.padding * 2;
  const btnY = px(GRID.border * 2);

  const titleBarButtons: Array<{ destroy: () => void }> = [];

  // === RIGHT-ALIGNED: Settings and Close ===
  const rightEdge = cardTotalWidth - GRID.border * 2 - 1;
  let rightX = rightEdge;

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

  const backBtn = createPixelButton({
    size: btnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: '<',
    onClick: () => {
      animControllers[activeRowIndex]?.stepBackward();
    }
  });
  backBtn.container.position.set(px(leftX), btnY);
  card.container.addChild(backBtn.container);
  titleBarButtons.push(backBtn);

  leftX += btnSize + btnSpacing;
  const playPauseBtnX = leftX;
  let playPauseBtn = createPixelButton({
    size: btnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: '|>',
    onClick: () => {
      animControllers[activeRowIndex]?.togglePlayback();
    }
  });
  playPauseBtn.container.position.set(px(leftX), btnY);
  card.container.addChild(playPauseBtn.container);
  titleBarButtons.push(playPauseBtn);

  leftX += btnSize + btnSpacing;
  const forwardBtn = createPixelButton({
    size: btnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: '>',
    onClick: () => {
      animControllers[activeRowIndex]?.stepForward();
    }
  });
  forwardBtn.container.position.set(px(leftX), btnY);
  card.container.addChild(forwardBtn.container);
  titleBarButtons.push(forwardBtn);

  function updatePlayPauseButton() {
    card.container.removeChild(playPauseBtn.container);
    playPauseBtn.destroy();

    playPauseBtn = createPixelButton({
      size: btnSize,
      selectionMode: 'press',
      actionMode: 'click',
      label: isPlaying ? '||' : '|>',
      onClick: () => {
        animControllers[activeRowIndex]?.togglePlayback();
      }
    });
    playPauseBtn.container.position.set(px(playPauseBtnX), btnY);
    card.container.addChild(playPauseBtn.container);
    titleBarButtons[3] = playPauseBtn;
  }

  // Containers
  let previewContainer: PIXI.Container = new PIXI.Container();
  let frameStripsContainer: PIXI.Container = new PIXI.Container();
  let previewSprite: PIXI.Sprite | null = null;

  contentContainer.addChild(previewContainer);
  contentContainer.addChild(frameStripsContainer);

  contentContainer.eventMode = 'static';
  contentContainer.on('pointerdown', () => {
    onFocus?.();
  });

  function updatePreviewSprite(texture: PIXI.Texture) {
    if (previewSprite) {
      previewSprite.texture = texture;
    }
  }

  function redrawPreview() {
    previewContainer.removeChildren();

    const theme = getTheme();
    const cellSize = SPRITE_CONTROLLER_CONFIG.cellSize;
    const previewSizePx = px(previewSize);
    const scale = Math.floor(previewSizePx / cellSize);

    const bg = new PIXI.Graphics();
    bg.roundPixels = true;
    bg.rect(0, 0, previewSizePx, previewSizePx);
    bg.fill({ color: theme.cardTitleBar });
    previewContainer.addChild(bg);

    const activeController = animControllers[activeRowIndex];
    const texture = activeController?.getCurrentFrameTexture();
    // Check that texture is valid and not empty
    const hasValidTexture = texture && texture !== PIXI.Texture.EMPTY && texture.source;
    if (hasValidTexture) {
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
      const seq = sequences[activeRowIndex];
      const noFramesText = createText(
        seq?.frames?.length > 0 ? 'Loading...' : 'No frames',
        theme.text
      );
      noFramesText.position.set(
        (previewSizePx - noFramesText.width) / 2,
        (previewSizePx - noFramesText.height) / 2
      );
      previewContainer.addChild(noFramesText);
    }

    const contentWidthPx = px(contentWidth);
    previewContainer.position.set(
      (contentWidthPx - previewSizePx) / 2,
      px(GRID.padding)
    );
  }

  /**
   * Draw a single frame strip row
   * Layout: [X](non-first) [ticks][+]    [++](first row, right-aligned)
   */
  function drawFrameStripRow(
    container: PIXI.Container,
    rowIndex: number,
    yOffset: number
  ) {
    const theme = getTheme();
    const seq = sequences[rowIndex];
    const controller = animControllers[rowIndex];
    const frames = seq.frames;
    const currentFrameIndex = controller?.getCurrentFrameIndex() ?? -1;
    const isActiveRow = rowIndex === activeRowIndex;
    const isSelectingRow = rowIndex === selectingRowIndex;
    const isFirstRow = rowIndex === 0;

    const tickWidth = px(2);
    const tickHeight = px(8);
    const tickSpacing = px(1);
    const btnSize = config.controlButtonSize;
    const btnSizePx = px(btnSize);
    const margin = px(2);
    const contentWidthPx = px(contentWidth);
    const rowHeightPx = px(rowHeight);

    // Draw active row background
    if (isActiveRow) {
      const rowBg = new PIXI.Graphics();
      rowBg.roundPixels = true;
      rowBg.rect(0, yOffset - px(1), contentWidthPx, rowHeightPx);
      rowBg.fill({ color: theme.cardBorder, alpha: 0.15 });
      container.addChild(rowBg);
    }

    // Calculate layout - start with left margin
    let rowStartX = margin;

    // Add [X] button for non-first rows (left-aligned with margin)
    if (!isFirstRow) {
      const removeBtn = createPixelButton({
        size: btnSize,
        selectionMode: 'press',
        actionMode: 'click',
        label: 'X',
        onClick: () => {
          // Show confirmation dialog
          const dialog = createConfirmDialog({
            title: 'Remove Animation',
            message: `Remove animation row ${rowIndex + 1}?`,
            onConfirm: () => {
              removeRow(rowIndex);
            },
            renderer
          });
          card.container.parent?.addChild(dialog.container);
        }
      });
      managed.trackChild(removeBtn);
      removeBtn.container.position.set(rowStartX, yOffset + (tickHeight - btnSizePx) / 2);
      container.addChild(removeBtn.container);
      rowStartX += btnSizePx + margin;
    }

    // Draw tick bars
    frames.forEach((frameRef, index) => {
      const tickX = rowStartX + index * (tickWidth + tickSpacing);

      const tickBar = new PIXI.Graphics();
      tickBar.roundPixels = true;
      tickBar.eventMode = 'static';
      tickBar.cursor = 'pointer';

      const isCurrentFrame = index === currentFrameIndex && isActiveRow;
      const barColor = isCurrentFrame ? theme.accent : (isActiveRow ? theme.cardBorder : 0x555555);
      const barAlpha = isCurrentFrame ? 1.0 : (isActiveRow ? 0.6 : 0.4);

      tickBar.roundRect(tickX, yOffset, tickWidth, tickHeight, 1);
      tickBar.fill({ color: barColor, alpha: barAlpha });

      if (isCurrentFrame) {
        tickBar.roundRect(tickX, yOffset, tickWidth, tickHeight, 1);
        tickBar.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
      }

      container.addChild(tickBar);

      tickBar.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        onFocus?.();
        setActiveRow(rowIndex);
        controller?.goToFrame(index);
        e.stopPropagation();
      });

      tickBar.on('rightclick', (e: PIXI.FederatedPointerEvent) => {
        onFocus?.();
        setActiveRow(rowIndex);
        controller?.removeFrame(index);
        onSequenceChange?.(sequences);
        redrawContent();
        e.stopPropagation();
      });
    });

    // Add frame button [+] after tick bars
    const addX = rowStartX + frames.length * (tickWidth + tickSpacing) + px(1);
    const addBtn = createPixelButton({
      size: btnSize,
      selectionMode: 'press',
      actionMode: 'toggle',
      selected: isSelectingRow,
      label: '+',
      onClick: () => {
        if (selectingRowIndex === rowIndex) {
          // Turn off selection mode
          selectingRowIndex = -1;
          onSelectionModeChange?.(false);
        } else {
          // Turn on selection mode for this row
          selectingRowIndex = rowIndex;
          setActiveRow(rowIndex);
          onSelectionModeChange?.(true);
        }
        redrawFrameStrips();
      }
    });
    managed.trackChild(addBtn);
    addBtn.container.position.set(addX, yOffset + (tickHeight - btnSizePx) / 2);
    container.addChild(addBtn.container);

    // Add row button [++] only on first row - RIGHT ALIGNED with margin
    if (isFirstRow) {
      const addRowX = contentWidthPx - btnSizePx - margin;
      const addRowBtn = createPixelButton({
        size: btnSize,
        selectionMode: 'press',
        actionMode: 'click',
        label: '++',
        onClick: () => {
          addRow();
        }
      });
      managed.trackChild(addRowBtn);
      addRowBtn.container.position.set(addRowX, yOffset + (tickHeight - btnSizePx) / 2);
      container.addChild(addRowBtn.container);
    }
  }

  function redrawFrameStrips() {
    frameStripsContainer.removeChildren();
    managed.clearChildren();

    const previewSizePx = px(previewSize);
    const startY = px(GRID.padding) + previewSizePx + px(2);

    sequences.forEach((_, rowIndex) => {
      const yOffset = startY + rowIndex * px(rowHeight);
      drawFrameStripRow(frameStripsContainer, rowIndex, yOffset - startY);
    });

    frameStripsContainer.position.set(0, startY);
  }

  function addRow() {
    if (sequences.length >= ANIMATION_CONSTANTS.MAX_FRAMES_PER_SEQUENCE) return;

    const newSeq = createDefaultSequence();
    sequences.push(newSeq);

    const newController = createControllerForSequence(newSeq, sequences.length - 1);
    animControllers.push(newController);

    // Update card size
    updateCardSize();
    onSequenceChange?.(sequences);
    redrawContent();
  }

  function removeRow(rowIndex: number) {
    if (rowIndex === 0 || rowIndex >= sequences.length) return;

    // Clean up controller
    animControllers[rowIndex]?.destroy();
    animControllers.splice(rowIndex, 1);
    sequences.splice(rowIndex, 1);

    // Adjust active row if needed
    if (activeRowIndex >= sequences.length) {
      activeRowIndex = sequences.length - 1;
    }
    if (selectingRowIndex === rowIndex) {
      selectingRowIndex = -1;
      onSelectionModeChange?.(false);
    } else if (selectingRowIndex > rowIndex) {
      selectingRowIndex--;
    }

    // Update card size
    updateCardSize();
    onSequenceChange?.(sequences);
    redrawContent();
  }

  function setActiveRow(index: number) {
    if (index < 0 || index >= sequences.length) return;

    // Pause previous active controller
    animControllers[activeRowIndex]?.pause();

    activeRowIndex = index;
    isPlaying = animControllers[activeRowIndex]?.isAnimating() ?? false;
    updatePlayPauseButton();
    redrawContent();
  }

  function updateCardSize() {
    const newHeight = getContentHeight();
    card.setContentSize(contentWidth, newHeight);
  }

  function redrawContent() {
    redrawPreview();
    redrawFrameStrips();
  }

  // Initial draw
  redrawContent();

  return {
    id,
    card,
    container: card.container,
    controller: animControllers[0], // Return first controller for backwards compatibility

    play: () => animControllers[activeRowIndex]?.play(),
    pause: () => animControllers[activeRowIndex]?.pause(),
    stop: () => animControllers[activeRowIndex]?.stop(),
    togglePlayback: () => animControllers[activeRowIndex]?.togglePlayback(),

    setSequence: (newSequence: AnimationSequenceConfig) => {
      Object.assign(sequences[activeRowIndex], newSequence);
      animControllers[activeRowIndex]?.setSequence(sequences[activeRowIndex]);
      redrawContent();
    },

    getSequence: () => animControllers[activeRowIndex]?.getSequence() ?? sequences[activeRowIndex],

    getSequences: () => sequences.map((_, i) => animControllers[i]?.getSequence() ?? sequences[i]),

    addFrame: (frame: SpriteFrameRef) => {
      animControllers[activeRowIndex]?.addFrame(frame);
      onSequenceChange?.(sequences);
      redrawContent();
    },

    removeFrame: (index: number) => {
      animControllers[activeRowIndex]?.removeFrame(index);
      onSequenceChange?.(sequences);
      redrawContent();
    },

    refresh: () => {
      animControllers.forEach(c => c.onSpriteSheetUpdate());
      redrawContent();
    },

    isSelectingFrames: () => selectingRowIndex >= 0,

    setSelectingFrames: (selecting: boolean) => {
      if (selecting) {
        selectingRowIndex = activeRowIndex;
      } else {
        selectingRowIndex = -1;
      }
      onSelectionModeChange?.(selecting);
      redrawFrameStrips();
    },

    handleCellClick: (cellX: number, cellY: number) => {
      if (selectingRowIndex < 0) return;

      const seq = sequences[selectingRowIndex];
      const controller = animControllers[selectingRowIndex];

      const existingIndex = seq.frames.findIndex(
        f => f.cellX === cellX && f.cellY === cellY
      );

      if (existingIndex >= 0) {
        controller?.removeFrame(existingIndex);
      } else {
        controller?.addFrame({ cellX, cellY });
      }

      onSequenceChange?.(sequences);
      redrawContent();
    },

    getFrameCells: () => {
      // Return all frames from all sequences for highlighting
      const allFrames: Array<{ cellX: number; cellY: number }> = [];
      sequences.forEach(seq => {
        seq.frames.forEach(f => {
          if (!allFrames.some(af => af.cellX === f.cellX && af.cellY === f.cellY)) {
            allFrames.push({ cellX: f.cellX, cellY: f.cellY });
          }
        });
      });
      return allFrames;
    },

    getCurrentFrameIndex: () => animControllers[activeRowIndex]?.getCurrentFrameIndex() ?? 0,

    destroy: () => {
      if (selectingRowIndex >= 0) {
        selectingRowIndex = -1;
        onSelectionModeChange?.(false);
      }
      animControllers.forEach(c => c.destroy());
      titleBarButtons.forEach(btn => btn.destroy());
      managed.destroy();
    }
  };
}

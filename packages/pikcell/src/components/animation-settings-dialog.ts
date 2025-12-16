/**
 * Animation Settings Dialog
 * Modal dialog for configuring animation sequence settings
 */
import * as PIXI from 'pixi.js';
import { PixelCard } from './pixel-card';
import { GRID, px } from '@moxijs/core';
import { createPixelButton, PixelButtonResult } from './pixel-button';
import { createPixelCheckbox, PixelCheckboxResult } from './pixel-checkbox';
import { getTheme, createText } from '../theming/theme';
import { ComponentResult } from '../interfaces/components';
import { AnimationSequenceConfig } from '../interfaces/animation-types';
import { ANIMATION_CONSTANTS } from '../config/constants';

export interface AnimationSettingsDialogOptions {
  sequence: AnimationSequenceConfig;
  renderer: PIXI.Renderer;
  onApply: (settings: AnimationSequenceConfig) => void;
  onCancel?: () => void;
}

export interface AnimationSettingsDialogResult extends ComponentResult {
  close(): void;
}

/**
 * Creates an animation settings dialog
 */
export function createAnimationSettingsDialog(options: AnimationSettingsDialogOptions): AnimationSettingsDialogResult {
  const { sequence, renderer, onApply, onCancel } = options;

  // Track created components for cleanup
  const createdButtons: PixelButtonResult[] = [];
  const createdCheckboxes: PixelCheckboxResult[] = [];

  // Editable copy of settings
  let frameDurationMs = sequence.frameDurationMs;
  let loop = sequence.loop;
  let pingPong = sequence.pingPong;

  // Create overlay container
  const overlay = new PIXI.Container();

  // Semi-transparent backdrop
  const backdrop = new PIXI.Graphics();
  backdrop.rect(0, 0, renderer.width, renderer.height);
  backdrop.fill({ color: 0x000000, alpha: 0.5 });
  backdrop.eventMode = 'static';
  overlay.addChild(backdrop);

  // Dialog dimensions
  const contentWidth = 80; // Grid units
  const contentHeight = 75; // Grid units - enough for all content + buttons

  // Create dialog card
  const dialogCard = new PixelCard({
    title: 'Animation Settings',
    x: 0,
    y: 0,
    contentWidth,
    contentHeight,
    renderer,
    minContentSize: true
  });

  const contentContainer = dialogCard.getContentContainer();
  const theme = getTheme();

  let currentY = px(4);

  // Cleanup function
  const cleanup = () => {
    createdButtons.forEach(btn => btn.destroy());
    createdButtons.length = 0;
    createdCheckboxes.forEach(cb => cb.destroy());
    createdCheckboxes.length = 0;
    overlay.destroy({ children: true });
  };

  // --- Frame Duration Section ---
  const durationLabel = createText('Frame Duration:', theme.text);
  durationLabel.position.set(px(4), currentY);
  contentContainer.addChild(durationLabel);
  currentY += durationLabel.height + px(3);

  // Duration display and controls row
  const durationRow = new PIXI.Container();
  durationRow.position.set(px(4), currentY);

  // Decrement button [-]
  const decrementBtn = createPixelButton({
    size: 10,
    label: '-',
    selectionMode: 'press',
    actionMode: 'click',
    onClick: () => {
      frameDurationMs = Math.max(ANIMATION_CONSTANTS.MIN_FRAME_DURATION_MS, frameDurationMs - 10);
      updateDurationDisplay();
    }
  });
  createdButtons.push(decrementBtn);
  decrementBtn.container.position.set(0, 0);
  durationRow.addChild(decrementBtn.container);

  // Duration value text
  const durationValueText = createText(`${frameDurationMs}ms`, theme.text);
  durationValueText.position.set(px(16), px(2));
  durationRow.addChild(durationValueText);

  // Increment button [+]
  const incrementBtn = createPixelButton({
    size: 10,
    label: '+',
    selectionMode: 'press',
    actionMode: 'click',
    onClick: () => {
      frameDurationMs = Math.min(ANIMATION_CONSTANTS.MAX_FRAME_DURATION_MS, frameDurationMs + 10);
      updateDurationDisplay();
    }
  });
  createdButtons.push(incrementBtn);
  incrementBtn.container.position.set(px(38), 0);
  durationRow.addChild(incrementBtn.container);

  // FPS display (calculated from duration)
  const fpsText = createText(`(${Math.round(1000 / frameDurationMs)} fps)`, theme.text);
  fpsText.position.set(px(54), px(2));
  durationRow.addChild(fpsText);

  contentContainer.addChild(durationRow);
  currentY += px(14);

  function updateDurationDisplay() {
    durationValueText.text = `${frameDurationMs}ms`;
    fpsText.text = `(${Math.round(1000 / frameDurationMs)} fps)`;
  }

  // --- Loop Checkbox ---
  const loopCheckbox = createPixelCheckbox({
    label: 'Loop',
    checked: loop,
    onChange: (checked) => {
      loop = checked;
    }
  });
  createdCheckboxes.push(loopCheckbox);
  loopCheckbox.container.position.set(px(4), currentY);
  contentContainer.addChild(loopCheckbox.container);
  currentY += loopCheckbox.container.height + px(4);

  // --- Ping-Pong Checkbox ---
  const pingPongCheckbox = createPixelCheckbox({
    label: 'Ping-Pong',
    checked: pingPong,
    onChange: (checked) => {
      pingPong = checked;
    }
  });
  createdCheckboxes.push(pingPongCheckbox);
  pingPongCheckbox.container.position.set(px(4), currentY);
  contentContainer.addChild(pingPongCheckbox.container);
  currentY += pingPongCheckbox.container.height + px(6);

  // --- Frame Count Info ---
  const frameCountText = createText(`Frames: ${sequence.frames.length}`, theme.text);
  frameCountText.position.set(px(4), currentY);
  contentContainer.addChild(frameCountText);
  currentY += frameCountText.height + px(8);

  // --- Buttons Row ---
  const buttonWidth = 24;
  const buttonHeight = 12;
  const buttonSpacingUnits = 6;
  const buttonsY = currentY;

  // Calculate total width of both buttons + spacing, then center
  const totalButtonsWidth = buttonWidth * 2 + buttonSpacingUnits;
  const startX = px((contentWidth - totalButtonsWidth) / 2);

  // Apply button
  const applyBtn = createPixelButton({
    width: buttonWidth,
    height: buttonHeight,
    label: 'Apply',
    selectionMode: 'press',
    actionMode: 'click',
    onClick: () => {
      // Create updated sequence config
      const updatedSequence: AnimationSequenceConfig = {
        ...sequence,
        frameDurationMs,
        loop,
        pingPong
      };
      onApply(updatedSequence);
      cleanup();
    }
  });
  createdButtons.push(applyBtn);
  applyBtn.container.position.set(startX, buttonsY);
  contentContainer.addChild(applyBtn.container);

  // Cancel button
  const cancelBtn = createPixelButton({
    width: buttonWidth,
    height: buttonHeight,
    label: 'Cancel',
    selectionMode: 'press',
    actionMode: 'click',
    onClick: () => {
      onCancel?.();
      cleanup();
    }
  });
  createdButtons.push(cancelBtn);
  cancelBtn.container.position.set(startX + px(buttonWidth + buttonSpacingUnits), buttonsY);
  contentContainer.addChild(cancelBtn.container);

  // Center dialog on screen
  const dialogBounds = dialogCard.container.getBounds();
  dialogCard.container.position.set(
    (renderer.width - dialogBounds.width) / 2,
    (renderer.height - dialogBounds.height) / 2
  );

  overlay.addChild(dialogCard.container);

  return {
    container: overlay,
    close: cleanup,
    destroy: cleanup
  };
}

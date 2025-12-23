/**
 * Project Dialog
 * Modal dialog for project management: New, Open, Save, Save As
 */
import * as PIXI from 'pixi.js';
import { PixelCard } from './pixel-card';
import { GRID, BORDER, px } from '@moxijs/core';
import { createPixelButton, PixelButtonResult } from './pixel-button';
import { createPixelTextInput, PixelTextInputResult } from './pixel-text-input';
import { getTheme, createText } from '../theming/theme';
import { ComponentResult } from '../interfaces/components';

export interface ProjectDialogCallbacks {
  onNew: () => void;
  onOpen: () => void;
  onSave: (projectName: string) => void;
}

export interface ProjectDialogOptions {
  renderer: PIXI.Renderer;
  callbacks: ProjectDialogCallbacks;
  /** Whether there's an existing project open */
  hasProject?: boolean;
  /** Whether there are unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Current project filename if saved */
  currentFilename?: string | null;
  /** Current project name */
  projectName?: string;
}

export interface ProjectDialogResult extends ComponentResult {
  close(): void;
}

/**
 * Creates a project management dialog
 */
export function createProjectDialog(options: ProjectDialogOptions): ProjectDialogResult {
  const {
    renderer,
    callbacks,
    hasProject = false,
    hasUnsavedChanges = false,
    currentFilename = null,
    projectName = 'Untitled'
  } = options;

  // Track created components for cleanup
  const createdButtons: PixelButtonResult[] = [];
  let textInput: PixelTextInputResult | null = null;

  // Create overlay container
  const overlay = new PIXI.Container();

  // Semi-transparent backdrop
  const backdrop = new PIXI.Graphics();
  backdrop.rect(0, 0, renderer.width, renderer.height);
  backdrop.fill({ color: 0x000000, alpha: 0.5 });
  backdrop.eventMode = 'static';
  overlay.addChild(backdrop);

  // Dialog dimensions
  const buttonWidth = 28;
  const buttonHeight = 10;
  const buttonSpacingX = 4;
  const buttonSpacingY = 3;

  // Calculate content width to fit 2 columns of buttons with spacing
  const totalButtonsWidth = buttonWidth * 2 + buttonSpacingX;
  const contentWidth = totalButtonsWidth + 8; // 4 grid units margin on each side
  const contentHeight = 62; // Grid units - room for input, status, and 2 rows of buttons

  // Create dialog card
  const dialogCard = new PixelCard({
    title: 'Project',
    x: 0,
    y: 0,
    contentWidth,
    contentHeight,
    renderer,
    minContentSize: true
  });

  const contentContainer = dialogCard.getContentContainer();
  const theme = getTheme();

  // Cleanup function
  const cleanup = () => {
    createdButtons.forEach(btn => btn.destroy());
    createdButtons.length = 0;
    if (textInput) {
      textInput.destroy();
      textInput = null;
    }
    overlay.destroy({ children: true });
  };

  // --- Add Close Button to Title Bar ---
  const btnSize = 8;
  const cardTotalWidth = contentWidth + BORDER.total * 2 + GRID.padding * 2;
  const btnY = px(GRID.border * 2);
  const rightEdge = cardTotalWidth - GRID.border * 2 - 1;

  const closeBtn = createPixelButton({
    size: btnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: 'X',
    onClick: cleanup
  });
  createdButtons.push(closeBtn);
  closeBtn.container.position.set(px(rightEdge - btnSize), btnY);
  dialogCard.container.addChild(closeBtn.container);

  let currentY = px(4);

  // --- Project Name Input ---
  const inputWidth = contentWidth - 8; // Leave margin on sides
  textInput = createPixelTextInput({
    width: inputWidth,
    height: 12,
    value: projectName,
    placeholder: 'Enter project name...',
    label: 'Project Name:',
    maxLength: 40
  });
  textInput.container.position.set(px(4), currentY);
  contentContainer.addChild(textInput.container);
  currentY += px(22); // Label + input + spacing (reduced from 26)

  // --- Status Text ---
  if (hasProject) {
    const statusLabel = currentFilename
      ? `File: ${currentFilename.length > 20 ? '...' + currentFilename.slice(-17) : currentFilename}`
      : 'Not saved to file';
    const statusText = createText(statusLabel, theme.text); // Use white text
    statusText.position.set(px(4), currentY);
    contentContainer.addChild(statusText);
    currentY += statusText.height + px(1);

    // Show unsaved changes indicator
    if (hasUnsavedChanges) {
      const unsavedText = createText('(unsaved changes)', theme.accent);
      unsavedText.position.set(px(4), currentY);
      contentContainer.addChild(unsavedText);
      currentY += unsavedText.height + px(2);
    } else {
      currentY += px(2);
    }
  } else {
    currentY += px(2);
  }

  // --- Button Grid (2 columns) ---
  const gridStartX = px(4); // Left margin

  // Row 1: New | Open
  const newBtn = createPixelButton({
    width: buttonWidth,
    height: buttonHeight,
    label: 'New',
    selectionMode: 'press',
    actionMode: 'click',
    onClick: () => {
      cleanup();
      callbacks.onNew();
    }
  });
  createdButtons.push(newBtn);
  newBtn.container.position.set(gridStartX, currentY);
  contentContainer.addChild(newBtn.container);

  const openBtn = createPixelButton({
    width: buttonWidth,
    height: buttonHeight,
    label: 'Open',
    selectionMode: 'press',
    actionMode: 'click',
    onClick: () => {
      cleanup();
      callbacks.onOpen();
    }
  });
  createdButtons.push(openBtn);
  openBtn.container.position.set(gridStartX + px(buttonWidth + buttonSpacingX), currentY);
  contentContainer.addChild(openBtn.container);
  currentY += px(buttonHeight + buttonSpacingY);

  // Row 2: Save (centered)
  const saveBtn = createPixelButton({
    width: buttonWidth,
    height: buttonHeight,
    label: 'Save',
    selectionMode: 'press',
    actionMode: 'click',
    onClick: () => {
      const name = textInput?.getValue() || projectName;
      cleanup();
      callbacks.onSave(name);
    }
  });
  createdButtons.push(saveBtn);
  // Center the save button in the row
  const saveBtnX = gridStartX + px((buttonWidth + buttonSpacingX) / 2);
  saveBtn.container.position.set(saveBtnX, currentY);
  contentContainer.addChild(saveBtn.container);

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

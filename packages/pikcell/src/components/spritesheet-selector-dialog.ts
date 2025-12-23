/**
 * Spritesheet Selector Dialog
 * Modal dialog for viewing, selecting, and managing spritesheets in a project
 */
import * as PIXI from 'pixi.js';
import { PixelCard } from './pixel-card';
import { GRID, px } from '@moxijs/core';
import { createPixelButton, PixelButtonResult } from './pixel-button';
import { getTheme, createText } from '../theming/theme';
import { ComponentResult } from '../interfaces/components';
import { SpriteSheetInstance } from '../interfaces/managers';
import { SpriteSheetType } from '../controllers/sprite-sheet-controller';

export interface SpritesheetSelectorDialogOptions {
  renderer: PIXI.Renderer;
  /** Get all sprite sheets */
  getSpritesheets: () => SpriteSheetInstance[];
  /** Get the active spritesheet ID */
  getActiveId: () => string | null;
  /** Select a spritesheet by ID */
  onSelect: (id: string) => void;
  /** Rename a spritesheet */
  onRename: (id: string, newName: string) => void;
  /** Delete a spritesheet */
  onDelete: (id: string) => void;
  /** Add a new spritesheet */
  onAddNew: (type: SpriteSheetType) => void;
  /** Called when dialog closes */
  onClose?: () => void;
}

export interface SpritesheetSelectorDialogResult extends ComponentResult {
  /** Close the dialog */
  close(): void;
  /** Refresh the list (call when sheets change externally) */
  refresh(): void;
}

interface SheetRowComponents {
  container: PIXI.Container;
  buttons: PixelButtonResult[];
}

/**
 * Creates a spritesheet selector dialog
 */
export function createSpritesheetSelectorDialog(
  options: SpritesheetSelectorDialogOptions
): SpritesheetSelectorDialogResult {
  const {
    renderer,
    getSpritesheets,
    getActiveId,
    onSelect,
    onRename,
    onDelete,
    onAddNew,
    onClose
  } = options;

  const theme = getTheme();

  // Track created components for cleanup
  const createdButtons: PixelButtonResult[] = [];
  const sheetRows: SheetRowComponents[] = [];

  // Create overlay container
  const overlay = new PIXI.Container();

  // Semi-transparent backdrop
  const backdrop = new PIXI.Graphics();
  backdrop.rect(0, 0, renderer.width, renderer.height);
  backdrop.fill({ color: 0x000000, alpha: 0.5 });
  backdrop.eventMode = 'static';
  overlay.addChild(backdrop);

  // Dialog dimensions - width must fit "No spritesheets in project" text + padding
  const contentWidth = 130; // Grid units
  const rowHeight = 12; // Grid units per sheet row
  const maxVisibleRows = 6;
  const addButtonHeightForLayout = 10;

  // Calculate content height based on sheets
  const sheets = getSpritesheets();
  const rowsCount = Math.min(sheets.length, maxVisibleRows);
  const listHeight = Math.max(rowsCount * rowHeight, rowHeight); // At least one row height
  const contentHeight = listHeight + addButtonHeightForLayout + 8; // List + add buttons + margins

  // Create dialog card
  const dialogCard = new PixelCard({
    title: 'Spritesheets',
    x: 0,
    y: 0,
    contentWidth,
    contentHeight,
    renderer,
    minContentSize: true
  });

  const contentContainer = dialogCard.getContentContainer();

  // Close button in title bar
  const closeBtnSize = 6;
  const cardTotalWidth = contentWidth + GRID.border * 6 + GRID.padding * 2;
  const closeBtn = createPixelButton({
    size: closeBtnSize,
    selectionMode: 'press',
    actionMode: 'click',
    label: 'X',
    onClick: () => {
      cleanup();
      onClose?.();
    }
  });
  createdButtons.push(closeBtn);
  closeBtn.container.position.set(
    px(cardTotalWidth - GRID.border * 2 - closeBtnSize - 1),
    px(GRID.border * 2)
  );
  dialogCard.container.addChild(closeBtn.container);

  // List container
  const listContainer = new PIXI.Container();
  listContainer.position.set(px(2), px(2));
  contentContainer.addChild(listContainer);

  /**
   * Create a row for a spritesheet
   */
  function createSheetRow(
    sheet: SpriteSheetInstance,
    yOffset: number,
    isActive: boolean
  ): SheetRowComponents {
    const rowContainer = new PIXI.Container();
    rowContainer.position.set(0, yOffset);
    const rowButtons: PixelButtonResult[] = [];

    // Active indicator
    if (isActive) {
      const indicator = new PIXI.Graphics();
      indicator.roundPixels = true;
      indicator.circle(px(2), px(rowHeight / 2), px(1.5));
      indicator.fill({ color: theme.accent });
      rowContainer.addChild(indicator);
    }

    // Sheet name
    const nameText = createText(sheet.name, theme.text);
    nameText.position.set(px(6), px(1));
    rowContainer.addChild(nameText);

    // Type label
    const config = sheet.sheetCard?.controller.getConfig();
    const typeLabel = config?.type || 'Unknown';
    const typeText = createText(typeLabel, theme.text);
    typeText.alpha = 0.7;
    typeText.position.set(px(40), px(1));
    rowContainer.addChild(typeText);

    // Action buttons row
    const buttonSize = 6;
    const buttonSpacing = 2;
    let buttonX = px(contentWidth - 4 - (buttonSize * 3 + buttonSpacing * 2));

    // Select button
    const selectBtn = createPixelButton({
      size: buttonSize,
      selectionMode: 'press',
      actionMode: 'click',
      label: 'S',
      onClick: () => {
        onSelect(sheet.id);
        refresh();
      }
    });
    rowButtons.push(selectBtn);
    createdButtons.push(selectBtn);
    selectBtn.container.position.set(buttonX, px(1));
    rowContainer.addChild(selectBtn.container);
    buttonX += px(buttonSize + buttonSpacing);

    // Rename button
    const renameBtn = createPixelButton({
      size: buttonSize,
      selectionMode: 'press',
      actionMode: 'click',
      label: 'R',
      onClick: () => {
        // For now, use browser prompt - TODO: custom rename dialog
        const newName = prompt('Enter new name:', sheet.name);
        if (newName && newName !== sheet.name) {
          onRename(sheet.id, newName);
          refresh();
        }
      }
    });
    rowButtons.push(renameBtn);
    createdButtons.push(renameBtn);
    renameBtn.container.position.set(buttonX, px(1));
    rowContainer.addChild(renameBtn.container);
    buttonX += px(buttonSize + buttonSpacing);

    // Delete button
    const deleteBtn = createPixelButton({
      size: buttonSize,
      selectionMode: 'press',
      actionMode: 'click',
      label: 'X',
      onClick: () => {
        // Confirm deletion
        if (confirm(`Delete spritesheet "${sheet.name}"?`)) {
          onDelete(sheet.id);
          refresh();
        }
      }
    });
    rowButtons.push(deleteBtn);
    createdButtons.push(deleteBtn);
    deleteBtn.container.position.set(buttonX, px(1));
    rowContainer.addChild(deleteBtn.container);

    // Separator line
    const separator = new PIXI.Graphics();
    separator.roundPixels = true;
    separator.rect(0, px(rowHeight - 1), px(contentWidth - 4), px(0.5));
    separator.fill({ color: theme.cardBorder, alpha: 0.3 });
    rowContainer.addChild(separator);

    return { container: rowContainer, buttons: rowButtons };
  }

  /**
   * Refresh the list display
   */
  function refresh(): void {
    // Clear existing rows
    sheetRows.forEach(row => {
      row.buttons.forEach(btn => {
        const idx = createdButtons.indexOf(btn);
        if (idx !== -1) {
          createdButtons.splice(idx, 1);
        }
        btn.destroy();
      });
      row.container.destroy({ children: true });
    });
    sheetRows.length = 0;
    listContainer.removeChildren();

    // Get current sheets
    const currentSheets = getSpritesheets();
    const activeId = getActiveId();

    if (currentSheets.length === 0) {
      // Show "No spritesheets" message
      const emptyText = createText('No spritesheets in project', theme.text);
      emptyText.alpha = 0.6;
      emptyText.position.set(px(4), px(rowHeight / 2 - 2));
      listContainer.addChild(emptyText);
    } else {
      // Create rows for each sheet
      currentSheets.forEach((sheet, index) => {
        const yOffset = px(index * rowHeight);
        const isActive = sheet.id === activeId;
        const row = createSheetRow(sheet, yOffset, isActive);
        sheetRows.push(row);
        listContainer.addChild(row.container);
      });
    }
  }

  // Initial list render
  refresh();

  // Add New buttons row
  const addButtonsY = px(listHeight + 4);
  const addButtonHeight = 10;
  const addBtnSpacing = px(4);

  // Add PICO-8 button - let width auto-calculate from label
  const addPico8Btn = createPixelButton({
    height: addButtonHeight,
    selectionMode: 'press',
    actionMode: 'click',
    label: '+ PICO-8',
    onClick: () => {
      onAddNew('PICO-8');
      refresh();
    }
  });
  createdButtons.push(addPico8Btn);
  contentContainer.addChild(addPico8Btn.container);

  // Add TIC-80 button - let width auto-calculate from label
  const addTic80Btn = createPixelButton({
    height: addButtonHeight,
    selectionMode: 'press',
    actionMode: 'click',
    label: '+ TIC-80',
    onClick: () => {
      onAddNew('TIC-80');
      refresh();
    }
  });
  createdButtons.push(addTic80Btn);
  contentContainer.addChild(addTic80Btn.container);

  // Position buttons centered together after creation (so we know their actual widths)
  const pico8Width = addPico8Btn.container.width;
  const tic80Width = addTic80Btn.container.width;
  const totalButtonsWidth = pico8Width + tic80Width + addBtnSpacing;
  const startX = (px(contentWidth) - totalButtonsWidth) / 2;

  addPico8Btn.container.position.set(startX, addButtonsY);
  addTic80Btn.container.position.set(startX + pico8Width + addBtnSpacing, addButtonsY);

  // Center dialog on screen
  const dialogBounds = dialogCard.container.getBounds();
  dialogCard.container.position.set(
    (renderer.width - dialogBounds.width) / 2,
    (renderer.height - dialogBounds.height) / 2
  );

  overlay.addChild(dialogCard.container);

  // Cleanup function
  function cleanup(): void {
    createdButtons.forEach(btn => btn.destroy());
    createdButtons.length = 0;
    sheetRows.length = 0;
    overlay.destroy({ children: true });
  }

  return {
    container: overlay,
    close: () => {
      cleanup();
      onClose?.();
    },
    refresh,
    destroy: () => {
      cleanup();
      onClose?.();
    }
  };
}

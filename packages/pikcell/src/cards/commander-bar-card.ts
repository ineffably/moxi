/**
 * PIKCELL Bar Card - Main action bar with commands
 *
 * Uses GRID UNITS for all measurements (converted via px()).
 */
import * as PIXI from 'pixi.js';
import { PixelCard } from '../components/pixel-card';
import { createPixelButton } from '../components/pixel-button';
import { createPixelDialog } from '../components/pixel-dialog';
import { BORDER, GRID, px } from '@moxijs/core';
import { getAllThemes, setTheme, ThemeInfo } from '../theming/theme';
import { createManagedCard } from '../utilities/managed-card';
import { layoutButtonRow } from '../utilities/button-layout';
import { COMMANDER_BAR_CONFIG } from '../config/card-configs';

/** Button definition for data-driven creation */
interface ButtonDef {
  label: string;
  callbackKey: keyof CommanderBarCallbacks;
}

export interface CommanderBarCallbacks {
  onNew?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  onExport?: () => void;
  onNewAnimation?: () => void;
  onSheets?: () => void;
  onApplyLayout?: () => void;
  onSaveLayoutSlot?: (slot: 'A' | 'B' | 'C') => void;
  onLoadLayoutSlot?: (slot: 'A' | 'B' | 'C') => void;
  hasLayoutSlot?: (slot: 'A' | 'B' | 'C') => boolean;
  onThemeChange?: () => void;
  onScaleChange?: (scale: number) => void; // TEMPORARY: For testing GRID scaling
}

export interface CommanderBarCardOptions {
  x: number;
  y: number;
  renderer: PIXI.Renderer;
  scene: PIXI.Container;
  width?: number;  // Optional width in grid units (defaults to auto-calculated)
  callbacks?: CommanderBarCallbacks;
  /** Enable pixel explosion effect on buttons */
  explodeEffect?: boolean;
}

export interface CommanderBarCardResult {
  card: PixelCard;
  container: PIXI.Container;
  destroy: () => void;
}

/** Left-side button definitions */
const LEFT_BUTTONS: ButtonDef[] = [
  { label: 'New', callbackKey: 'onNew' },
  { label: 'Save', callbackKey: 'onSave' },
  { label: 'Load', callbackKey: 'onLoad' },
  { label: 'Export', callbackKey: 'onExport' },
  { label: 'Anim', callbackKey: 'onNewAnimation' },
  { label: 'Sheets', callbackKey: 'onSheets' }
];

/** Layout slot identifiers */
const LAYOUT_SLOTS: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];

/**
 * Creates a PIKCELL bar for actions and options
 */
export function createCommanderBarCard(options: CommanderBarCardOptions): CommanderBarCardResult {
  const { x, y, renderer, scene, width, callbacks, explodeEffect = false } = options;

  const canvasWidth = renderer.width;
  const barHeight = COMMANDER_BAR_CONFIG.barHeight;
  const buttonSpacing = COMMANDER_BAR_CONFIG.buttonSpacing;

  // Calculate bar width (account for card borders and padding)
  const barWidth = width ?? (Math.floor(canvasWidth / px(1)) - (BORDER.total * 2) - (GRID.padding * 2));

  // Create the managed card
  const managed = createManagedCard({
    title: 'PIKCELL',
    x,
    y,
    contentWidth: barWidth,
    contentHeight: barHeight,
    renderer,
    minContentSize: true,
    onResize: () => drawCommands(),
    onRefresh: () => drawCommands()
  });

  const { card, contentContainer } = managed;

  /**
   * Build layout dialog buttons dynamically based on saved slots
   */
  function buildLayoutDialogButtons(): Array<{ label: string; onClick: () => void }> {
    const buttons: Array<{ label: string; onClick: () => void }> = [];

    // Reset layout button
    buttons.push({
      label: 'Reset',
      onClick: () => callbacks?.onApplyLayout?.()
    });

    // Slot A, B, C load/save buttons
    LAYOUT_SLOTS.forEach(slot => {
      const hasSlot = callbacks?.hasLayoutSlot?.(slot) ?? false;

      if (hasSlot) {
        buttons.push({
          label: `Load ${slot}`,
          onClick: () => callbacks?.onLoadLayoutSlot?.(slot)
        });
      }

      buttons.push({
        label: `Save ${slot}`,
        onClick: () => callbacks?.onSaveLayoutSlot?.(slot)
      });
    });

    return buttons;
  }

  /**
   * Show layout selection dialog
   */
  function showLayoutDialog() {
    const dialog = createPixelDialog({
      title: 'Layout',
      message: 'Choose layout:',
      buttons: buildLayoutDialogButtons(),
      renderer
    });
    scene.addChild(dialog.container);
  }

  /**
   * Show theme selection dialog
   */
  function showThemeDialog() {
    const allThemes = getAllThemes();
    const dialog = createPixelDialog({
      title: 'Choose Theme',
      message: 'Select a theme:',
      buttons: allThemes.map((themeInfo: ThemeInfo) => ({
        label: themeInfo.name,
        onClick: () => {
          setTheme(themeInfo);
          callbacks?.onThemeChange?.();
        }
      })),
      renderer
    });
    scene.addChild(dialog.container);
  }

  function drawCommands() {
    managed.clearChildren();
    contentContainer.removeChildren();

    // Create left-side buttons from config
    const leftButtons = LEFT_BUTTONS.map(def => {
      const btn = createPixelButton({
        height: barHeight,
        label: def.label,
        selectionMode: 'press',
        actionMode: 'click',
        explodeEffect,
        explodeScene: scene,
        explodeScreenHeight: renderer.height,
        explodeRenderer: renderer,
        onClick: () => {
          const callback = callbacks?.[def.callbackKey];
          if (typeof callback === 'function') {
            (callback as () => void)();
          }
        }
      });
      managed.trackChild(btn);
      contentContainer.addChild(btn.container);
      return btn;
    });

    // Layout left buttons in a row
    layoutButtonRow({
      items: leftButtons,
      spacing: buttonSpacing
    });

    // Create right-side buttons
    const layoutButton = createPixelButton({
      height: barHeight,
      label: 'Layout',
      selectionMode: 'press',
      actionMode: 'click',
      explodeEffect,
      explodeScene: scene,
      explodeScreenHeight: renderer.height,
      explodeRenderer: renderer,
      onClick: showLayoutDialog
    });
    managed.trackChild(layoutButton);

    const themeButton = createPixelButton({
      height: barHeight,
      label: 'Theme',
      selectionMode: 'press',
      actionMode: 'click',
      explodeEffect,
      explodeScene: scene,
      explodeScreenHeight: renderer.height,
      explodeRenderer: renderer,
      onClick: showThemeDialog
    });
    managed.trackChild(themeButton);

    // Position right-side buttons at far right
    const layoutWidth = layoutButton.container.width / px(1);
    const themeWidth = themeButton.container.width / px(1);
    const spacingPx = px(buttonSpacing);

    layoutButton.container.position.set(px(barWidth - layoutWidth - themeWidth) - spacingPx, 0);
    themeButton.container.position.set(px(barWidth - themeWidth), 0);

    contentContainer.addChild(layoutButton.container);
    contentContainer.addChild(themeButton.container);
  }

  // Initial draw
  drawCommands();
  card.updateMinContentSize();

  return {
    card,
    container: card.container,
    destroy: managed.destroy
  };
}

/**
 * Save Dialog
 * Reusable confirmation dialog for save-before-action prompts
 */
import * as PIXI from 'pixi.js';
import { createPixelDialog, PixelDialogResult } from './pixel-dialog';

export interface SaveDialogOptions {
  renderer: PIXI.Renderer;
  /** Action being performed (e.g., "loading", "creating new project", "importing") */
  action: string;
  /** Called when user clicks Save - should save then perform the action */
  onSave: () => void;
  /** Called when user clicks Don't Save - should perform the action without saving */
  onDontSave: () => void;
}

export interface SaveDialogResult extends PixelDialogResult {}

/**
 * Creates a save confirmation dialog
 *
 * Usage:
 * ```
 * const dialog = createSaveDialog({
 *   renderer,
 *   action: 'loading',
 *   onSave: () => { save(); load(); },
 *   onDontSave: () => { load(); }
 * });
 * scene.addChild(dialog.container);
 * ```
 */
export function createSaveDialog(options: SaveDialogOptions): SaveDialogResult {
  const { renderer, action, onSave, onDontSave } = options;

  return createPixelDialog({
    title: 'Save Current Project?',
    message: `You have unsaved changes. Save before ${action}?`,
    buttons: [
      {
        label: 'Save',
        onClick: onSave
      },
      {
        label: "Don't Save",
        onClick: onDontSave
      }
    ],
    renderer
  });
}

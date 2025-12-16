/**
 * Confirmation Dialog
 * Simple confirmation dialog wrapper around PixelDialog
 */
import * as PIXI from 'pixi.js';
import { createPixelDialog, PixelDialogResult } from './pixel-dialog';

export interface ConfirmDialogOptions {
  /** Dialog title */
  title: string;
  /** Confirmation message */
  message: string;
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Optional callback when user cancels */
  onCancel?: () => void;
  /** Renderer for positioning */
  renderer: PIXI.Renderer;
  /** Optional custom confirm button label (default: "Confirm") */
  confirmLabel?: string;
  /** Optional custom cancel button label (default: "Cancel") */
  cancelLabel?: string;
}

export interface ConfirmDialogResult extends PixelDialogResult {
  // Inherits from PixelDialogResult
}

/**
 * Creates a confirmation dialog with Confirm/Cancel buttons
 */
export function createConfirmDialog(options: ConfirmDialogOptions): ConfirmDialogResult {
  const {
    title,
    message,
    onConfirm,
    onCancel,
    renderer,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel'
  } = options;

  return createPixelDialog({
    title,
    message,
    renderer,
    buttons: [
      {
        label: confirmLabel,
        onClick: () => {
          onConfirm();
        }
      },
      {
        label: cancelLabel,
        onClick: () => {
          onCancel?.();
        }
      }
    ]
  });
}

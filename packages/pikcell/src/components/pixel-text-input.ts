/**
 * Pixel-perfect text input component for pikcell
 * Wraps UITextInput from @moxijs/ui with pikcell styling
 */
import * as PIXI from 'pixi.js';
import { GRID, px } from '@moxijs/core';
import { UITextInput, UIFocusManager } from '@moxijs/ui';
import { getTheme, createText } from '../theming/theme';
import { ComponentResult } from '../interfaces/components';

export interface PixelTextInputOptions {
  /** Width in grid units */
  width: number;
  /** Height in grid units (default: 12) */
  height?: number;
  /** Initial value */
  value?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Maximum character length */
  maxLength?: number;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Label to show above the input */
  label?: string;
}

export interface PixelTextInputResult extends ComponentResult {
  /** Get current value */
  getValue(): string;
  /** Set current value */
  setValue(value: string): void;
  /** Focus the input */
  focus(): void;
  /** Blur the input */
  blur(): void;
  /** Refresh display (e.g., after theme change) */
  refresh(): void;
}

/**
 * Creates a pixel-styled text input using UITextInput from @moxijs/ui
 */
export function createPixelTextInput(options: PixelTextInputOptions): PixelTextInputResult {
  const {
    width,
    height = 12,
    value = '',
    placeholder = '',
    maxLength = 50,
    onChange,
    label
  } = options;

  const theme = getTheme();

  // Main container
  const container = new PIXI.Container();

  // Label text (if provided)
  let labelText: PIXI.Text | null = null;
  let labelHeight = 0;

  if (label) {
    labelText = createText(label, theme.text);
    labelText.position.set(0, 0);
    container.addChild(labelText);
    labelHeight = Math.ceil(labelText.height / px(1)) + 2; // 2 grid units gap
  }

  // Convert grid units to pixels for UITextInput
  const inputWidthPx = px(width);
  const inputHeightPx = px(height);

  // Create UITextInput with pikcell theme colors
  // Use 16px font size (same as FONT_DISPLAY_SIZE in pikcell theming)
  const textInput = new UITextInput({
    defaultValue: value, // Use defaultValue for uncontrolled mode
    placeholder: placeholder,
    maxLength: maxLength,
    width: inputWidthPx,
    height: inputHeightPx,
    backgroundColor: theme.cardBackground,
    textColor: theme.text,
    placeholderColor: theme.cardBorder,
    borderRadius: 0, // Pixel-perfect, no rounded corners
    fontSize: 16, // Match pikcell's FONT_DISPLAY_SIZE
    fontFamily: 'PixelOperator8',
    onChange: onChange
  });

  // Position the input below the label
  textInput.container.position.set(0, px(labelHeight));
  container.addChild(textInput.container);

  // Initialize focus manager if not already done
  const focusManager = UIFocusManager.getInstance();
  if (focusManager) {
    focusManager.register(textInput);
  }

  return {
    container,
    getValue: () => textInput.getValue(),
    setValue: (newValue: string) => textInput.setValue(newValue),
    focus: () => textInput.onFocus(),
    blur: () => textInput.onBlur(),
    refresh: () => {
      // Re-apply theme colors if needed
      const newTheme = getTheme();
      // UITextInput doesn't have a direct way to update colors after creation
      // For now, refresh is a no-op
    },
    destroy: () => {
      if (focusManager) {
        focusManager.unregister(textInput);
      }
      textInput.destroy();
      if (labelText) {
        labelText.destroy();
      }
      container.destroy({ children: true });
    }
  };
}

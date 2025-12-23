/**
 * Pixel-perfect button component for the sprite editor
 *
 * IMPORTANT - Button Content Area Sizing:
 * ----------------------------------------
 * For 'press' mode buttons (selectionMode='press'), there is a BEVEL at the bottom
 * that reduces the content area height by 1 grid unit.
 *
 * Button structure (unpressed, press mode):
 * - Outer border: 1 grid unit all around
 * - Bevel strip: 1 grid unit at bottom (inside outer border)
 * - Inner border: 1 grid unit all around (above bevel)
 * - Background/content: remaining space
 *
 * For a 16x16 grid unit button:
 * - Content width:  16 - (border * 4) = 12 grid units
 * - Content height: 16 - (border * 5) = 11 grid units (due to bevel!)
 *
 * Icon sizing for perfect centering:
 * - Icons are 10 wide × 9 tall grid units
 * - Horizontal: (12 - 10) / 2 = 1 grid unit margin each side
 * - Vertical: (11 - 9) / 2 = 1 grid unit margin each side
 */
import * as PIXI from 'pixi.js';
import { GRID, px } from '@moxijs/core';
import { getTheme, createText } from '../theming/theme';
import { ComponentResult } from '../interfaces/components';
import { createPixelExplosion, PixelExplosionResult } from '../effects/pixel-explosion';

export type SelectionMode = 'highlight' | 'press';
export type ActionMode = 'click' | 'toggle';

export interface PixelButtonOptions {
  size?: number;          // Size in grid units (for square buttons)
  width?: number;         // Width in grid units (for rectangular buttons)
  height?: number;        // Height in grid units (for rectangular buttons)
  selected?: boolean;
  label?: string;
  icon?: PIXI.Sprite | PIXI.Graphics;   // Optional icon sprite or graphic (legacy)
  /** Draw icon directly into button graphics for perfect grid alignment.
   * Called with (graphics, x, y, color, pixelSize) where x,y is the top-left position.
   * Icons are 10x9 grids, so icon size = (10 * pixelSize) wide × (9 * pixelSize) tall.
   */
  drawIcon?: (g: PIXI.Graphics, x: number, y: number, color: number, pixelSize: number) => void;
  /** Icon width in cells (default 10) - used with drawIcon to calculate centering */
  iconWidth?: number;
  /** Icon height in cells (default 9) - used with drawIcon to calculate centering */
  iconHeight?: number;
  backgroundColor?: number;
  onClick?: () => void;
  selectionMode?: SelectionMode;  // 'highlight' for swatches, 'press' for tool buttons (visual appearance)
  actionMode?: ActionMode;        // 'click' for simple click, 'toggle' for toggleable state (behavior)
  tooltip?: string;       // Optional tooltip text
  /** Container for tooltips - if provided, tooltips render here (for z-ordering) */
  tooltipLayer?: PIXI.Container;
  /** Optional callback to trigger when button is clicked (before onClick, useful for focus) */
  onFocus?: () => void;
  /** Enable pixel explosion effect on click/toggle */
  explodeEffect?: boolean;
  /** Scene container for explosion particles (required if explodeEffect is true) */
  explodeScene?: PIXI.Container;
  /** Screen height for explosion effect (required if explodeEffect is true) */
  explodeScreenHeight?: number;
  /** PIXI renderer for capturing button pixels (required for authentic explosion) */
  explodeRenderer?: PIXI.Renderer;
}

export interface PixelButtonResult extends ComponentResult {
  /** The button graphics (alias for container) */
  button: PIXI.Graphics;
  /** Get the current selected state */
  isSelected(): boolean;
  /** Set the selected state (for toggle buttons) */
  setSelected(selected: boolean): void;
  /** Refresh the button (e.g., after theme change) */
  refresh(): void;
  /** Trigger the pixel explosion effect manually */
  triggerExplosion(): void;
}

/**
 * Creates a pixel-perfect button with optional label
 *
 * Selection modes (visual appearance):
 * - 'highlight': Shows accent border when selected (for color swatches)
 * - 'press': Shows pressed state with bevel (for tool buttons)
 *
 * Action modes (behavior):
 * - 'click': Simple click action, no visual state change
 * - 'toggle': Toggleable selection state (for swatches, tool groups)
 */
export function createPixelButton(options: PixelButtonOptions): PixelButtonResult {
  const {
    size,
    width,
    height,
    selected = false,
    label,
    icon,
    drawIcon,
    iconWidth = 10,
    iconHeight = 9,
    backgroundColor,
    onClick,
    selectionMode = 'press',
    actionMode = 'click',
    tooltip,
    tooltipLayer,
    onFocus,
    explodeEffect = false,
    explodeScene,
    explodeScreenHeight = 800,
    explodeRenderer
  } = options;

  // Track state
  let isSelectedState = selected;
  let tooltipContainer: PIXI.Container | null = null;
  let buttonText: PIXI.Text | null = null;
  let explosionEffect: PixelExplosionResult | null = null;
  let isExploding = false;

  // Auto-calculate width for text labels if not explicitly provided
  let buttonWidth = width ?? size ?? 10;
  const buttonHeight = height ?? size ?? 10;

  // If label is provided and no explicit width, calculate based on text + padding
  if (label && !width && !size) {
    const tempText = createText(label, 0xffffff);

    // Calculate text width in grid units
    const textWidthInGridUnits = Math.ceil(tempText.width / px(1));
    const bordersWidth = GRID.border * 4; // 2 borders on each side
    const paddingWidth = 2; // 1 grid unit on each side
    buttonWidth = textWidthInGridUnits + bordersWidth + paddingWidth;

    tempText.destroy();
  }

  const button = new PIXI.Graphics();
  button.roundPixels = true;
  button.eventMode = (onClick || tooltip) ? 'static' : 'auto';
  button.cursor = onClick ? 'pointer' : 'default';

  // Draw function to render button state
  function drawButton() {
    button.clear();

    const theme = getTheme();
    const bgColor = backgroundColor ?? theme.buttonBackground;

    if (selectionMode === 'highlight') {
      // Highlight mode (for swatches)
      if (isSelectedState) {
        // Selected: accent border, then card border, then background/color
        button.rect(0, 0, px(buttonWidth), px(buttonHeight));
        button.fill({ color: theme.accent });

        button.rect(px(GRID.border), px(GRID.border),
                    px(buttonWidth - GRID.border * 2), px(buttonHeight - GRID.border * 2));
        button.fill({ color: theme.cardBorder });

        button.rect(px(GRID.border * 2), px(GRID.border * 2),
                    px(buttonWidth - GRID.border * 4), px(buttonHeight - GRID.border * 4));
        button.fill({ color: bgColor });
      } else {
        // Unselected: border, then background/color
        button.rect(0, 0, px(buttonWidth), px(buttonHeight));
        button.fill({ color: theme.cardBorder });

        button.rect(px(GRID.border), px(GRID.border),
                    px(buttonWidth - GRID.border * 2), px(buttonHeight - GRID.border * 2));
        button.fill({ color: bgColor });
      }
    } else {
      // Press mode (for tool buttons)
      if (isSelectedState) {
        // Pressed: starts 1px lower, card border, title bar color as inner border, background (no bevel)
        button.rect(0, px(1), px(buttonWidth), px(buttonHeight) - px(1));
        button.fill({ color: theme.cardBorder });

        button.rect(px(GRID.border), px(GRID.border + 1),
                    px(buttonWidth - GRID.border * 2), px(buttonHeight - GRID.border * 2 - 1));
        button.fill({ color: theme.cardTitleBar });

        button.rect(px(GRID.border * 2), px(GRID.border * 2 + 1),
                    px(buttonWidth - GRID.border * 4), px(buttonHeight - GRID.border * 4 - 1));
        button.fill({ color: bgColor });
      } else {
        // Unpressed: card border, bevel at bottom, title bar as inner border, background
        button.rect(0, 0, px(buttonWidth), px(buttonHeight));
        button.fill({ color: theme.cardBorder });

        // Bevel strip at bottom
        button.rect(px(GRID.border), px(buttonHeight - GRID.border * 2),
                    px(buttonWidth - GRID.border * 2), px(GRID.border));
        button.fill({ color: theme.bevelColor });

        // Inner border
        button.rect(px(GRID.border), px(GRID.border),
                    px(buttonWidth - GRID.border * 2), px(buttonHeight - GRID.border * 3));
        button.fill({ color: theme.cardTitleBar });

        // Background
        button.rect(px(GRID.border * 2), px(GRID.border * 2),
                    px(buttonWidth - GRID.border * 4), px(buttonHeight - GRID.border * 5));
        button.fill({ color: bgColor });
      }
    }

    // Update content position
    // Press offset: when pressed, content moves down with button
    const pressOffset = (selectionMode === 'press' && isSelectedState) ? px(1) : 0;

    // Draw icon directly into button graphics for perfect grid alignment
    // Icon is 10x9 cells, content area is 12×11 grid units (due to bevel)
    // Center the icon in the content area
    if (drawIcon) {
      const iconWidthPx = iconWidth * GRID.scale;
      const iconHeightPx = iconHeight * GRID.scale;
      // Content area starts after 2 border layers
      const contentX = px(GRID.border * 2);
      const contentY = px(GRID.border * 2) + pressOffset;
      // Content dimensions (width: buttonWidth-4, height: buttonHeight-5 due to bevel)
      const contentWidth = px(buttonWidth - GRID.border * 4);
      const contentHeight = px(buttonHeight - GRID.border * 5);
      // Center icon in content area, snap to grid
      const iconX = contentX + Math.floor((contentWidth - iconWidthPx) / 2 / GRID.scale) * GRID.scale;
      const iconY = contentY + Math.floor((contentHeight - iconHeightPx) / 2 / GRID.scale) * GRID.scale;
      drawIcon(button, iconX, iconY, theme.text, GRID.scale);
    }
    // Legacy: position icon sprite (for backwards compatibility)
    else if (icon) {
      icon.position.set(
        Math.floor((px(buttonWidth) - icon.width) / 2 / GRID.scale) * GRID.scale,
        Math.floor((px(buttonHeight) - icon.height) / 2 / GRID.scale) * GRID.scale + pressOffset
      );
      if (!button.children.includes(icon)) {
        button.addChild(icon);
      }
    }

    // Labels: no base offset, just move down when pressed
    // Also update text color to match current theme
    if (buttonText) {
      buttonText.position.set(px(buttonWidth) / 2, px(buttonHeight) / 2 + pressOffset);
      buttonText.style.fill = theme.text;
    }
  }

  // Tooltip support
  if (tooltip) {
    const createTooltip = () => {
      const container = new PIXI.Container();
      const theme = getTheme();

      const text = createText(tooltip, theme.text);

      const padding = px(2);
      const borderWidth = px(GRID.border);
      const tooltipWidth = text.width + padding * 2 + borderWidth * 2;
      const tooltipHeight = text.height + padding * 2 + borderWidth * 2;

      const bg = new PIXI.Graphics();
      bg.roundPixels = true;

      const shadowOffset = px(1);

      // Drop shadow
      bg.rect(shadowOffset, shadowOffset, tooltipWidth, tooltipHeight);
      bg.fill({ color: theme.cardTitleBar });

      // Outer border
      bg.rect(0, 0, tooltipWidth, tooltipHeight);
      bg.fill({ color: theme.cardBorder });

      // Background
      bg.rect(borderWidth, borderWidth,
              tooltipWidth - borderWidth * 2,
              tooltipHeight - borderWidth * 2);
      bg.fill({ color: theme.cardBackground });

      container.addChild(bg);
      text.position.set(borderWidth + padding, borderWidth + padding);
      container.addChild(text);

      return container;
    };

    button.on('pointerover', (e: PIXI.FederatedPointerEvent) => {
      if (tooltipContainer) return;

      tooltipContainer = createTooltip();

      if (tooltipLayer) {
        // Use global coordinates for the tooltip layer
        const globalPos = button.getGlobalPosition();
        tooltipContainer.position.set(globalPos.x, globalPos.y - tooltipContainer.height - 2);
        tooltipLayer.addChild(tooltipContainer);
      } else {
        // Fallback: add to button with local coordinates
        const local = e.getLocalPosition(button);
        tooltipContainer.position.set(local.x, local.y - tooltipContainer.height - 2);
        button.addChild(tooltipContainer);
      }
    });

    button.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (tooltipContainer) {
        if (tooltipLayer) {
          const globalPos = button.getGlobalPosition();
          tooltipContainer.position.set(globalPos.x, globalPos.y - tooltipContainer.height - 2);
        } else {
          const local = e.getLocalPosition(button);
          tooltipContainer.position.set(local.x, local.y - tooltipContainer.height - 2);
        }
      }
    });

    button.on('pointerout', () => {
      if (tooltipContainer) {
        if (tooltipLayer) {
          tooltipLayer.removeChild(tooltipContainer);
        } else {
          button.removeChild(tooltipContainer);
        }
        tooltipContainer.destroy();
        tooltipContainer = null;
      }
    });
  }

  // Initial draw
  drawButton();

  // Add icon if provided
  if (icon) {
    const pressOffset = (selectionMode === 'press' && isSelectedState) ? px(1) : 0;
    // Snap to GRID.scale for pixel-perfect alignment
    icon.position.set(
      Math.floor((px(buttonWidth) - icon.width) / 2 / GRID.scale) * GRID.scale,
      Math.floor((px(buttonHeight) - icon.height) / 2 / GRID.scale) * GRID.scale + pressOffset
    );
    button.addChild(icon);
  }
  // Add label if provided (and no icon)
  else if (label) {
    const theme = getTheme();
    // Labels: no base offset, just move down when pressed
    const pressOffset = (selectionMode === 'press' && isSelectedState) ? px(1) : 0;
    buttonText = createText(label, theme.text, { 
      x: px(buttonWidth) / 2, 
      y: px(buttonHeight) / 2 + pressOffset, 
      anchor: 0.5 
    });
    button.addChild(buttonText);
  }

  /**
   * Trigger the pixel explosion effect
   */
  function triggerExplosion() {
    if (!explodeScene || isExploding) return;

    isExploding = true;

    // Get global position of button
    const globalPos = button.getGlobalPosition();

    // Get button colors from theme for the explosion (fallback)
    const theme = getTheme();
    const bgColor = backgroundColor ?? theme.buttonBackground;
    const explosionColors = [
      bgColor,
      theme.cardBorder,
      theme.cardTitleBar,
      theme.bevelColor,
      theme.accent
    ];

    // Clean up previous explosion if any
    if (explosionEffect) {
      explosionEffect.destroy();
    }

    // Create the explosion effect while button is still visible
    explosionEffect = createPixelExplosion({
      scene: explodeScene,
      buttonX: globalPos.x,
      buttonY: globalPos.y,
      buttonWidth,
      buttonHeight,
      colors: explosionColors,
      screenHeight: explodeScreenHeight,
      explosionForce: 1.2,
      gravity: 0.25,
      renderer: explodeRenderer,
      sourceObject: button,
      onExplosionComplete: () => {
        // Explosion particles have left the screen
        // Reassembly will start automatically
      },
      onReassemblyComplete: () => {
        // Show the button again
        button.visible = true;
        isExploding = false;
      }
    });

    // Start the explosion - this captures the button pixels while it's still visible
    explosionEffect.explode();
    
    // THEN hide the button after pixels have been captured
    button.visible = false;
  }

  // Add click handler if provided
  if (onClick) {
    button.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      // Trigger focus callback first (e.g., for card focus)
      onFocus?.();
      // Trigger explosion if enabled and not already exploding
      if (explodeEffect && explodeScene && !isExploding) {
        triggerExplosion();
      }
      onClick();
      e.stopPropagation();
    });
  }

  return {
    container: button,
    button,
    isSelected: () => isSelectedState,
    setSelected: (selected: boolean) => {
      isSelectedState = selected;
      drawButton();
    },
    refresh: () => {
      drawButton();
    },
    triggerExplosion,
    destroy: () => {
      if (tooltipContainer) {
        tooltipContainer.destroy();
        tooltipContainer = null;
      }
      if (explosionEffect) {
        explosionEffect.destroy();
        explosionEffect = null;
      }
      button.removeAllListeners();
      button.destroy({ children: true });
    }
  };
}

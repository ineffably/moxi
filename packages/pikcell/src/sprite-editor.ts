/**
 * Sprite Editor (Refactored) - Main orchestrator class
 *
 * REFACTORED to use manager pattern for better separation of concerns:
 * - SpriteSheetManager: Sprite sheet lifecycle
 * - UIManager: Card registry and z-ordering
 * - LayoutManager: Positioning and layouts
 * - FileOperationsManager: Save/load/export
 *
 * This reduces the class from 1040 lines to ~400 lines with clear responsibilities.
 * 
 * ⚠️ CRITICAL: GRID-BASED UI SYSTEM
 * =================================
 * 
 * This codebase uses GRID UNITS for all UI measurements, not raw pixels!
 * - Always use px(gridUnits) to convert grid units to pixels
 * - Example: px(1) = 1 grid unit = 4 pixels (at default 4x scale)
 * - Example: px(GRID.gap) = standard gap in grid units
 * - NEVER use hardcoded pixel values like 24, 16, etc. for UI
 * 
 * @see ./utilities/README.md for detailed grid system documentation
 */
import * as PIXI from 'pixi.js';
import { PixelCard } from './components/pixel-card';
import { createPixelDialog, PixelDialogResult } from './components/pixel-dialog';
import { createAnimationSettingsDialog } from './components/animation-settings-dialog';
import { createSpriteSheetCard, SPRITESHEET_CONFIGS } from './components/spritesheet-card';
import { SpriteSheetType } from './controllers/sprite-sheet-controller';
import { UIStateManager } from './state/ui-state-manager';
import { ProjectStateManager, ProjectState, SpriteSheetState } from './state/project-state-manager';
import { LayoutStateManager, LayoutSlotState } from './state/layout-state-manager';
import { UndoManager, StrokeOperation } from './state/undo-manager';
import { getTheme } from './theming/theme';
import { PICO8_PALETTE, getPalette, PaletteType } from './theming/palettes';
import { GRID, BORDER, px } from '@moxijs/core';

// Card imports
import { createPaletteCard, PaletteCardResult } from './cards/palette-card';
import { createInfoBarCard, InfoBarCardResult } from './cards/info-bar-card';
import { createCommanderBarCard, CommanderBarCardResult } from './cards/commander-bar-card';
import { createToolbarCard, ToolbarCardResult, MainToolType } from './cards/toolbar-card';
import { ShapeType } from './theming/tool-icons';
import { Selection } from './components/sprite-editor-card';

// Manager imports
import { SpriteSheetManager } from './managers/sprite-sheet-manager';
import { UIManager } from './managers/ui-manager';
import { LayoutManager } from './managers/layout-manager';
import { FileOperationsManager } from './managers/file-operations-manager';
import { SpriteCardFactory } from './managers/sprite-card-factory';
import { AnimationPreviewManager } from './managers/animation-preview-manager';
import { SpriteSheetInstance } from './interfaces/managers';

// Constants
import { PERFORMANCE_CONSTANTS, INTERACTION_CONSTANTS } from './config/constants';
import { CARD_IDS, getSpriteSheetCardId, getSpriteCardId, isSpriteCard } from './config/card-ids';

// Utilities
import { calculateCommanderBarHeight } from './utilities/card-utils';

export interface SpriteEditorOptions {
  renderer: PIXI.Renderer;
  scene: PIXI.Container;
  maxSpriteSheets?: number;
}

/**
 * Main Sprite Editor class (Refactored)
 * Now acts as a lightweight orchestrator that delegates to specialized managers
 */
export class SpriteEditor {
  // Managers
  private spriteSheetManager: SpriteSheetManager;
  private uiManager: UIManager;
  private layoutManager: LayoutManager;
  private fileOperationsManager: FileOperationsManager;
  private spriteCardFactory: SpriteCardFactory;
  private undoManager: UndoManager;
  private animationPreviewManager: AnimationPreviewManager;

  // Core dependencies
  private renderer: PIXI.Renderer;
  private scene: PIXI.Container;

  // UI Cards (only persistent cards stored here)
  private commanderBarCard?: CommanderBarCardResult;
  private paletteCard?: PaletteCardResult;
  private infoBarCard?: InfoBarCardResult;
  private toolbarCard?: ToolbarCardResult;

  // Current tool state
  private currentTool: MainToolType = 'pencil';
  private currentShapeType: ShapeType = 'square';

  // Tool display names for info bar
  private static readonly TOOL_DISPLAY_NAMES: Record<MainToolType, string> = {
    pencil: 'Pencil',
    eraser: 'Eraser',
    fill: 'Fill',
    selection: 'Selection',
    shape: 'Shape'
  };

  // Editor state
  private currentPaletteType: PaletteType = 'pico8';
  private currentPalette: number[] = PICO8_PALETTE;
  private selectedColorIndex: number = 0;
  private projectState: ProjectState;
  private hasUnsavedChanges: boolean = false;

  // Timers for debounced saves
  private uiStateSaveTimer: number | null = null;
  private projectSaveTimer: number | null = null;

  // Keyboard handler for undo/redo
  private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

  // Beforeunload handler for saving state when page closes
  private beforeUnloadHandler: (() => void) | null = null;

  // Clipboard for copy/paste operations
  private clipboard: { width: number; height: number; pixels: number[][] } | null = null;

  // Track current dialog for cleanup
  private currentDialog: PixelDialogResult | null = null;

  // Track which animation preview is currently in selection mode
  private animationSelectionModePreviewId: string | null = null;

  constructor(options: SpriteEditorOptions) {
    this.renderer = options.renderer;
    this.scene = options.scene;

    // Initialize managers
    this.spriteSheetManager = new SpriteSheetManager();
    this.uiManager = new UIManager(this.scene);
    this.layoutManager = new LayoutManager(this.renderer);
    this.fileOperationsManager = new FileOperationsManager();
    this.undoManager = new UndoManager({ maxHistory: 50 });
    this.animationPreviewManager = new AnimationPreviewManager();

    // Initialize sprite card factory
    this.spriteCardFactory = new SpriteCardFactory({
      renderer: this.renderer,
      scene: this.scene,
      registerCard: (id, card) => this.registerCard(id, card),
      getSelectedColorIndex: () => this.selectedColorIndex,
      getSelectedColorHex: () => this.currentPalette[this.selectedColorIndex] ?? 0xFFFFFF,
      getCurrentTool: () => this.currentTool,
      getCurrentShape: () => this.currentShapeType,
      undoManager: this.undoManager,
      onPixelChange: () => this.saveProjectState(),
      onFocus: (instance) => this.activateInstance(instance),
      getSheetIndex: (instance) => this.spriteSheetManager.getAll().indexOf(instance)
    });

    // Setup keyboard handler for undo/redo
    this.setupKeyboardHandler();

    // Setup beforeunload handler to save state when page closes
    this.setupBeforeUnloadHandler();

    // Initialize or load project state
    const loadResult = ProjectStateManager.loadProject();
    if (!loadResult.success) {
      console.warn('Failed to load saved project, starting fresh:', loadResult.error);
    }
    this.projectState = loadResult.data ?? ProjectStateManager.createEmptyProject();

    // Subscribe to sprite sheet manager events
    this.spriteSheetManager.on('activeChanged', (id) => {
      this.updatePaletteForActiveSheet();
    });
  }

  /**
   * Initialize and create all UI elements
   */
  async initialize(): Promise<void> {
    await this.recreateUI();
  }

  /**
   * Register a card and setup auto-save on state changes
   */
  private registerCard(id: string, card: PixelCard): void {
    this.uiManager.registerCard(id, card);
    card.onStateChanged(() => this.saveUIState());
  }

  /**
   * Save current UI state to localStorage (debounced)
   */
  private saveUIState(): void {
    if (this.uiStateSaveTimer) {
      clearTimeout(this.uiStateSaveTimer);
    }

    this.uiStateSaveTimer = window.setTimeout(() => {
      this.saveUIStateImmediate();
    }, PERFORMANCE_CONSTANTS.UI_STATE_DEBOUNCE_MS);
  }

  /**
   * Save UI state immediately (no debounce) - used for beforeunload
   */
  private saveUIStateImmediate(): void {
    const stateMap = this.uiManager.exportAllStates();
    UIStateManager.saveState(stateMap, this.renderer.width, this.renderer.height);
  }

  /**
   * Restore UI state from localStorage
   */
  private restoreUIState(): boolean {
    const savedState = UIStateManager.loadState();
    if (!savedState) return false;

    const adjustedState = UIStateManager.adjustForCanvasSize(
      savedState,
      this.renderer.width,
      this.renderer.height
    );

    // Use UIManager to import states
    this.uiManager.importStates(new Map(adjustedState.cards.map(cs => [cs.id, cs])));

    // Reposition toolbar relative to sprite cards if they exist
    this.repositionToolbar();

    console.log('✅ UI state restored');
    return true;
  }

  /**
   * Reposition toolbar to the right of sprite cards and bring to front
   */
  private repositionToolbar(): void {
    const toolCard = this.uiManager.getCard(CARD_IDS.TOOL);
    if (!toolCard) return;

    // Find rightmost edge of any sprite card
    const commanderBarHeight = calculateCommanderBarHeight();
    let spriteCardRight = -1;
    let spriteCardY = commanderBarHeight + px(1);

    this.uiManager.getAllCards().forEach((card, id) => {
      if (isSpriteCard(id)) {
        const cardRight = card.container.x + card.getPixelWidth();
        if (cardRight > spriteCardRight) {
          spriteCardRight = cardRight;
          spriteCardY = card.container.y;
        }
      }
    });

    // Only reposition if sprite cards exist
    if (spriteCardRight > 0) {
      const toolX = spriteCardRight + px(GRID.gap);
      toolCard.container.position.set(toolX, spriteCardY);
    }

    // Always bring toolbar to front
    this.scene.setChildIndex(toolCard.container, this.scene.children.length - 1);
  }

  /**
   * Apply default layout positions to all cards
   */
  private applyDefaultLayout(): void {
    // Delegate to LayoutManager
    this.layoutManager.applyDefaultLayout(this.uiManager.getAllCards());

    // Position sprite sheet instances
    const spriteSheets = this.spriteSheetManager.getAll();
    const infoCard = this.uiManager.getCard(CARD_IDS.INFO);

    spriteSheets.forEach((instance, index) => {
      if (instance.sheetCard) {
        const card = instance.sheetCard.card;

        // Set minimap size and scale
        const desiredContentWidth = 50;
        const desiredContentHeight = 50;

        instance.sheetCard.controller.setScale(5);
        instance.sheetCard.controller.selectCell(0, 0);
        instance.sheetCard.controller.positionCell00AtTopLeft();

        card.setContentSize(desiredContentWidth, desiredContentHeight);
        instance.sheetCard.controller.render(card.getContentContainer());

        // Position at bottom right
        const defaultX = this.renderer.width - card.getPixelWidth();
        const defaultY = infoCard
          ? infoCard.container.y - card.getPixelHeight() - px(GRID.gap)
          : this.renderer.height - card.getPixelHeight();

        card.container.position.set(defaultX, defaultY);
      }
    });

    // Center sprite cards and position toolbar to their right
    const commanderBarHeight = calculateCommanderBarHeight();
    let spriteCardRight = this.renderer.width / 2; // Default if no sprite card
    // Position sprite cards below commander bar with 1 grid unit margin
    let spriteCardY = commanderBarHeight + px(1);

    this.uiManager.getAllCards().forEach((card, id) => {
      if (isSpriteCard(id)) {
        const x = (this.renderer.width - card.getPixelWidth()) / 2;
        const y = spriteCardY;
        card.container.position.set(x, y);
        // Track rightmost edge of sprite card for toolbar positioning
        spriteCardRight = x + card.getPixelWidth();
      }
    });

    // Position toolbar to the right of sprite card
    const toolCard = this.uiManager.getCard(CARD_IDS.TOOL);
    if (toolCard) {
      const toolX = spriteCardRight + px(GRID.gap);
      toolCard.container.position.set(toolX, spriteCardY);
      // Bring toolbar to front so it's above sprite cards
      this.scene.setChildIndex(toolCard.container, this.scene.children.length - 1);
    }

    this.saveUIState();
    console.log('✅ Default layout applied');
  }

  /**
   * Updates the palette card to match the active sprite sheet
   */
  private updatePaletteForActiveSheet(): void {
    const activeSheet = this.spriteSheetManager.getActive();
    if (!activeSheet || !this.paletteCard) return;

    // Update palette type based on sprite sheet type
    const sheetType = activeSheet.sheetCard.controller.getConfig().type;
    this.currentPaletteType = sheetType === 'PICO-8' ? 'pico8' : 'tic80';
    this.currentPalette = activeSheet.sheetCard.controller.getConfig().palette;
    this.paletteCard.setPalette(this.currentPalette);
  }

  /**
   * Activate a sprite sheet instance and bring its cards to front
   */
  private activateInstance(instance: SpriteSheetInstance): void {
    this.spriteSheetManager.setActive(instance.id);

    // Bring cards to front
    const sheetIndex = this.spriteSheetManager.getAll().indexOf(instance);
    this.uiManager.bringGroupToFront([
      getSpriteSheetCardId(sheetIndex),
      getSpriteCardId(sheetIndex)
    ]);
  }

  /**
   * Creates a new sprite sheet and sprite card
   */
  private createNewSpriteSheet(type: SpriteSheetType, showGrid: boolean, savedState?: SpriteSheetState): void {
    // Validate using SpriteSheetManager
    if (!savedState) {
      const validation = this.spriteSheetManager.validate(type);
      if (!validation.valid) {
        const dialog = createPixelDialog({
          title: 'Cannot Create Sprite Sheet',
          message: validation.message || 'Validation failed',
          buttons: [{ label: 'OK', onClick: () => {} }],
          renderer: this.renderer
        });
        this.scene.addChild(dialog.container);
        return;
      }
    }

    // Create instance via manager (with saved ID if available)
    const instance = this.spriteSheetManager.create(type, savedState?.id);

    // Function to make this sprite sheet active
    const makeThisSheetActive = () => {
      this.activateInstance(instance);
    };

    // Helper to create sprite card for a cell - delegates to factory
    const createSpriteCardForCell = (cellX: number, cellY: number) => {
      this.spriteCardFactory.createOrUpdate({
        instance,
        cellX,
        cellY
      });
    };

    // Create sprite sheet card
    const spriteSheetResult = createSpriteSheetCard({
      config: SPRITESHEET_CONFIGS[type],
      renderer: this.renderer,
      showGrid,
      onCellHover: (cellX, cellY) => {
        console.log(`Hovering cell: ${cellX}, ${cellY}`);
      },
      onCellClick: (cellX, cellY) => {
        // Check if we're in animation selection mode
        if (this.animationSelectionModePreviewId) {
          const preview = this.animationPreviewManager.get(this.animationSelectionModePreviewId);
          if (preview) {
            preview.card.handleCellClick(cellX, cellY);
            this.saveProjectState();
            return;
          }
        }
        // Normal behavior: create/update sprite card for this cell
        createSpriteCardForCell(cellX, cellY);
        this.saveProjectState();
      },
      onFocus: makeThisSheetActive
    });

    this.scene.addChild(spriteSheetResult.card.container);
    instance.sheetCard = spriteSheetResult;

    // Restore pixel data if loading from saved state
    if (savedState) {
      spriteSheetResult.controller.setPixelData(savedState.pixels);
      if (savedState.scale) {
        spriteSheetResult.controller.setScale(savedState.scale);
      }
      spriteSheetResult.controller.render(spriteSheetResult.card.getContentContainer());
    }

    // Register with UIManager
    const sheetIndex = this.spriteSheetManager.count() - 1;
    this.registerCard(getSpriteSheetCardId(sheetIndex), spriteSheetResult.card);

    // Set as active
    this.spriteSheetManager.setActive(instance.id);

    // Default zoom if new - use scale 2 to keep card reasonably sized
    if (!savedState) {
      spriteSheetResult.controller.setScale(2);
      const dims = spriteSheetResult.controller.getScaledDimensions();
      const newContentWidth = Math.ceil(dims.width / px(1));
      const newContentHeight = Math.ceil(dims.height / px(1));
      spriteSheetResult.card.setContentSize(newContentWidth, newContentHeight);
      spriteSheetResult.controller.render(spriteSheetResult.card.getContentContainer());
    }

    // Create sprite card for initial cell
    // Note: selectCell() triggers onCellClick which calls createSpriteCardForCell
    const cellX = savedState?.selectedCellX ?? 0;
    const cellY = savedState?.selectedCellY ?? 0;
    spriteSheetResult.controller.selectCell(cellX, cellY);

    // Note: centerCell() is called separately after layout is applied via centerActiveSheetCell()

    // Restore sprite card scale if saved
    if (savedState?.spriteCardScale && instance.spriteController) {
      this.spriteCardFactory.restoreScale(instance, savedState.spriteCardScale);
    }

    // Show toolbar when sprite sheet is created
    if (this.toolbarCard) {
      this.toolbarCard.card.container.visible = true;
    }

    console.log(`Created ${type} sprite sheet`);
    this.saveProjectState();
  }

  /**
   * Center the selected cell in the active spritesheet's viewport
   * Should be called after layout is applied so the content size is correct
   */
  private centerActiveSheetCell(): void {
    const activeInstance = this.spriteSheetManager.getActive();
    if (!activeInstance?.sheetCard) return;

    const cell = activeInstance.sheetCard.controller.getSelectedCell();
    const contentState = activeInstance.sheetCard.card.getContentSize();
    const contentWidthPx = px(contentState.width);
    const contentHeightPx = px(contentState.height);
    activeInstance.sheetCard.controller.centerCell(cell.x, cell.y, contentWidthPx, contentHeightPx);
  }

  /**
   * Update theme without losing state
   */
  updateTheme(): void {
    this.renderer.background.color = getTheme().workspace;

    // Refresh all cards
    if (this.commanderBarCard) this.commanderBarCard.card.refresh();
    if (this.paletteCard) this.paletteCard.card.refresh();
    if (this.infoBarCard) this.infoBarCard.card.refresh();
    if (this.toolbarCard) this.toolbarCard.card.refresh();

    this.spriteSheetManager.getAll().forEach(instance => {
      if (instance.sheetCard) instance.sheetCard.card.refresh();
      if (instance.spriteCard) instance.spriteCard.card.refresh();
    });

    console.log('✨ Theme updated');
  }

  /**
   * Update info bar with current tool and color
   */
  private updateInfoBar(): void {
    if (!this.infoBarCard) return;

    // Get tool display name (include shape type if shape tool)
    let toolName = SpriteEditor.TOOL_DISPLAY_NAMES[this.currentTool];
    if (this.currentTool === 'shape') {
      const shapeNames: Record<ShapeType, string> = {
        'line': 'Line',
        'circle': 'Circle',
        'circle-filled': 'Filled Circle',
        'square': 'Rectangle',
        'square-filled': 'Filled Rect'
      };
      toolName = shapeNames[this.currentShapeType];
    }

    // Get color hex value
    const colorValue = this.currentPalette[this.selectedColorIndex];
    const colorHex = `#${colorValue.toString(16).padStart(6, '0').toUpperCase()}`;

    this.infoBarCard.updateSections([
      { label: 'Tool:', value: toolName },
      { label: 'Color:', value: colorHex }
    ]);
  }

  /**
   * Update all sprite card titles with current tool
   */
  private updateSpriteCardTitles(): void {
    const instances = this.spriteSheetManager.getAll();
    for (const instance of instances) {
      if (instance.spriteCard) {
        instance.spriteCard.updateTitle(this.currentTool, this.currentShapeType);
      }
    }
  }

  /**
   * Setup keyboard handler for undo/redo and clipboard operations
   */
  private setupKeyboardHandler(): void {
    this.keyboardHandler = (e: KeyboardEvent) => {
      // Check for Ctrl+key combinations
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.handleRedo();
          } else {
            this.handleUndo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          this.handleRedo();
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          this.handleCopy();
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          this.handlePaste();
        } else if (e.key === 'x' || e.key === 'X') {
          e.preventDefault();
          this.handleCut();
        }
      }

      // Delete/Backspace clears selection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeInstance = this.spriteSheetManager.getActive();
        if (activeInstance?.spriteCard) {
          const selection = activeInstance.spriteCard.getSelection();
          if (selection) {
            e.preventDefault();
            this.handleClearSelection();
          }
        }
      }

      // Arrow keys move selection
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const activeInstance = this.spriteSheetManager.getActive();
        if (activeInstance?.spriteCard) {
          const selection = activeInstance.spriteCard.getSelection();
          if (selection) {
            e.preventDefault();
            const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
            const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
            this.handleMoveSelection(dx, dy);
          }
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keyboardHandler);
    }
  }

  /**
   * Setup beforeunload handler to ensure state is saved when page closes
   */
  private setupBeforeUnloadHandler(): void {
    if (typeof window !== 'undefined') {
      this.beforeUnloadHandler = () => {
        // Force immediate save of UI and project state
        this.saveUIStateImmediate();
        this.saveProjectStateImmediate();
      };
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }
  }

  /**
   * Handle undo operation
   */
  private handleUndo(): void {
    const operation = this.undoManager.undo();
    if (!operation) return;

    // Find the sprite sheet instance
    const instance = this.spriteSheetManager.getAll().find(i => i.id === operation.spriteSheetId);
    if (!instance) return;

    // Apply the undo - restore old colors
    for (const change of operation.changes) {
      // Convert local sprite coordinates to global sheet coordinates
      const cell = instance.spriteController?.getCell();
      if (cell) {
        const globalX = cell.x * 8 + change.x;
        const globalY = cell.y * 8 + change.y;
        instance.sheetCard.controller.setPixel(globalX, globalY, change.oldColorIndex);
      }
    }

    // Re-render
    this.refreshInstance(instance);
    this.saveProjectState();
  }

  /**
   * Handle redo operation
   */
  private handleRedo(): void {
    const operation = this.undoManager.redo();
    if (!operation) return;

    // Find the sprite sheet instance
    const instance = this.spriteSheetManager.getAll().find(i => i.id === operation.spriteSheetId);
    if (!instance) return;

    // Apply the redo - apply new colors
    for (const change of operation.changes) {
      // Convert local sprite coordinates to global sheet coordinates
      const cell = instance.spriteController?.getCell();
      if (cell) {
        const globalX = cell.x * 8 + change.x;
        const globalY = cell.y * 8 + change.y;
        instance.sheetCard.controller.setPixel(globalX, globalY, change.newColorIndex);
      }
    }

    // Re-render
    this.refreshInstance(instance);
    this.saveProjectState();
  }

  /**
   * Refresh rendering for an instance
   */
  private refreshInstance(instance: SpriteSheetInstance): void {
    if (instance.spriteCard && instance.spriteController) {
      instance.spriteCard.redraw();
    }
    instance.sheetCard.controller.render(instance.sheetCard.card.getContentContainer());
  }

  /**
   * Get normalized selection bounds (minX, minY, maxX, maxY)
   */
  private getNormalizedSelection(selection: Selection): { minX: number; minY: number; maxX: number; maxY: number } {
    return {
      minX: Math.min(selection.x1, selection.x2),
      minY: Math.min(selection.y1, selection.y2),
      maxX: Math.max(selection.x1, selection.x2),
      maxY: Math.max(selection.y1, selection.y2)
    };
  }

  /**
   * Handle copy operation - copy selected pixels to clipboard
   */
  private handleCopy(): void {
    const activeInstance = this.spriteSheetManager.getActive();
    if (!activeInstance?.spriteCard || !activeInstance.spriteController) return;

    const selection = activeInstance.spriteCard.getSelection();
    if (!selection) return;

    const { minX, minY, maxX, maxY } = this.getNormalizedSelection(selection);
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    // Copy pixels from selection
    const pixels: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(activeInstance.spriteController.getPixel(minX + x, minY + y));
      }
      pixels.push(row);
    }

    this.clipboard = { width, height, pixels };
    console.log(`Copied ${width}x${height} pixels to clipboard`);
  }

  /**
   * Handle paste operation - paste clipboard at selection or origin
   */
  private handlePaste(): void {
    if (!this.clipboard) return;

    const activeInstance = this.spriteSheetManager.getActive();
    if (!activeInstance?.spriteCard || !activeInstance.spriteController) return;

    const selection = activeInstance.spriteCard.getSelection();

    // Paste at selection top-left, or at origin if no selection
    const startX = selection ? Math.min(selection.x1, selection.x2) : 0;
    const startY = selection ? Math.min(selection.y1, selection.y2) : 0;

    // Begin undo stroke
    this.undoManager.beginStroke(activeInstance.id);

    // Paste pixels (index 0 is transparent - don't overwrite destination)
    for (let y = 0; y < this.clipboard.height; y++) {
      for (let x = 0; x < this.clipboard.width; x++) {
        const destX = startX + x;
        const destY = startY + y;

        // Skip if out of bounds
        if (destX < 0 || destX >= 8 || destY < 0 || destY >= 8) continue;

        const newColorIndex = this.clipboard.pixels[y][x];

        // Skip transparent pixels (index 0) - they don't overwrite
        if (newColorIndex === 0) continue;

        const oldColorIndex = activeInstance.spriteController.getPixel(destX, destY);

        if (oldColorIndex !== newColorIndex) {
          this.undoManager.recordPixelChange(destX, destY, oldColorIndex, newColorIndex);
          activeInstance.spriteController.setPixel(destX, destY, newColorIndex);
        }
      }
    }

    this.undoManager.endStroke();
    this.refreshInstance(activeInstance);
    this.saveProjectState();
    console.log(`Pasted ${this.clipboard.width}x${this.clipboard.height} pixels at (${startX}, ${startY})`);
  }

  /**
   * Handle cut operation - copy then clear selection
   */
  private handleCut(): void {
    this.handleCopy();
    this.handleClearSelection();
  }

  /**
   * Handle clear selection - fill selection with transparent (color 0)
   */
  private handleClearSelection(): void {
    const activeInstance = this.spriteSheetManager.getActive();
    if (!activeInstance?.spriteCard || !activeInstance.spriteController) return;

    const selection = activeInstance.spriteCard.getSelection();
    if (!selection) return;

    const { minX, minY, maxX, maxY } = this.getNormalizedSelection(selection);

    // Begin undo stroke
    this.undoManager.beginStroke(activeInstance.id);

    // Clear pixels (set to color 0 = transparent)
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const oldColorIndex = activeInstance.spriteController.getPixel(x, y);
        if (oldColorIndex !== 0) {
          this.undoManager.recordPixelChange(x, y, oldColorIndex, 0);
          activeInstance.spriteController.setPixel(x, y, 0);
        }
      }
    }

    this.undoManager.endStroke();
    this.refreshInstance(activeInstance);
    this.saveProjectState();
  }

  /**
   * Helper to check if coordinates are within sprite bounds
   */
  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < 8 && y >= 0 && y < 8;
  }

  /**
   * Handle move selection - move selected pixels by dx, dy
   * Selection can move freely; pixels that move off-screen are clipped
   */
  private handleMoveSelection(dx: number, dy: number): void {
    const activeInstance = this.spriteSheetManager.getActive();
    if (!activeInstance?.spriteCard || !activeInstance.spriteController) return;

    const selection = activeInstance.spriteCard.getSelection();
    if (!selection) return;

    const { minX, minY, maxX, maxY } = this.getNormalizedSelection(selection);
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    // Calculate new selection position (can be outside bounds)
    const newMinX = minX + dx;
    const newMinY = minY + dy;
    const newMaxX = maxX + dx;
    const newMaxY = maxY + dy;

    // Copy current selection pixels (only from valid coordinates)
    const pixels: (number | null)[][] = [];
    for (let y = 0; y < height; y++) {
      const row: (number | null)[] = [];
      for (let x = 0; x < width; x++) {
        const srcX = minX + x;
        const srcY = minY + y;
        if (this.isInBounds(srcX, srcY)) {
          row.push(activeInstance.spriteController.getPixel(srcX, srcY));
        } else {
          row.push(null); // Out of bounds - no pixel data
        }
      }
      pixels.push(row);
    }

    // Begin undo stroke
    this.undoManager.beginStroke(activeInstance.id);

    // Clear old position (only valid coordinates, and only if not going to be overwritten by new position)
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!this.isInBounds(x, y)) continue;

        // Check if this position (x, y) will be overwritten by a pixel from the moved selection
        // A pixel lands at (x, y) if (x, y) is within the new selection bounds
        const willBeOverwritten = x >= newMinX && x <= newMaxX && y >= newMinY && y <= newMaxY;
        if (!willBeOverwritten) {
          const oldColorIndex = activeInstance.spriteController.getPixel(x, y);
          if (oldColorIndex !== 0) {
            this.undoManager.recordPixelChange(x, y, oldColorIndex, 0);
            activeInstance.spriteController.setPixel(x, y, 0);
          }
        }
      }
    }

    // Draw at new position (only valid coordinates)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const destX = newMinX + x;
        const destY = newMinY + y;
        const pixelData = pixels[y][x];

        // Skip if destination is out of bounds or source had no data
        if (!this.isInBounds(destX, destY) || pixelData === null) continue;

        const newColorIndex = pixelData;
        const oldColorIndex = activeInstance.spriteController.getPixel(destX, destY);

        if (oldColorIndex !== newColorIndex) {
          this.undoManager.recordPixelChange(destX, destY, oldColorIndex, newColorIndex);
          activeInstance.spriteController.setPixel(destX, destY, newColorIndex);
        }
      }
    }

    this.undoManager.endStroke();
    this.refreshInstance(activeInstance);
    this.saveProjectState();

    // Update selection to follow the moved area (selection can be outside bounds)
    activeInstance.spriteCard.setSelection({
      x1: newMinX,
      y1: newMinY,
      x2: newMaxX,
      y2: newMaxY
    });
  }

  /**
   * Recreate all UI with current theme
   */
  async recreateUI(): Promise<void> {
    this.scene.removeChildren();
    this.renderer.background.color = getTheme().workspace;

    // Create commander bar
    this.commanderBarCard = createCommanderBarCard({
      x: px(GRID.margin),
      y: px(GRID.margin),
      renderer: this.renderer,
      scene: this.scene,
      explodeEffect: true, // Enable pixel explosion on PIKCELL bar buttons
      callbacks: {
        onNew: () => this.handleNew(),
        onSave: () => this.handleSave(),
        onLoad: () => this.handleLoad(),
        onExport: () => this.handleExport(),
        onNewAnimation: () => this.createAnimationPreview(),
        onApplyLayout: () => this.applyDefaultLayout(),
        onSaveLayoutSlot: (slot) => this.handleSaveLayoutSlot(slot),
        onLoadLayoutSlot: (slot) => this.handleLoadLayoutSlot(slot),
        hasLayoutSlot: (slot) => LayoutStateManager.hasLayoutSlot(slot),
        onThemeChange: () => this.updateTheme(),
        onScaleChange: (scale) => this.handleScaleChange(scale)
      }
    });
    this.scene.addChild(this.commanderBarCard.card.container);
    this.registerCard(CARD_IDS.COMMANDER, this.commanderBarCard.card);

    // Create palette card
    const commanderBarHeight = calculateCommanderBarHeight();
    const topOffset = px(GRID.margin) + commanderBarHeight + px(GRID.gap * 2);

    this.paletteCard = createPaletteCard({
      x: px(GRID.margin),
      y: topOffset,
      renderer: this.renderer,
      palette: this.currentPalette,
      selectedColorIndex: this.selectedColorIndex,
      onColorSelect: (colorIndex) => {
        this.selectedColorIndex = colorIndex;
        this.updateInfoBar();
        this.saveProjectState();
      }
    });
    this.scene.addChild(this.paletteCard.card.container);
    this.registerCard(CARD_IDS.PALETTE, this.paletteCard.card);

    // Restore tool selection from project state before creating toolbar
    if (this.projectState.selectedTool) {
      this.currentTool = this.projectState.selectedTool;
    }
    if (this.projectState.selectedShape) {
      this.currentShapeType = this.projectState.selectedShape;
    }

    // Create toolbar card (default position - will be repositioned in applyDefaultLayout)
    this.toolbarCard = createToolbarCard({
      x: this.renderer.width / 2 + 200, // Temporary - repositioned by layout
      y: topOffset,
      renderer: this.renderer,
      selectedTool: this.currentTool,
      selectedShape: this.currentShapeType,
      onToolSelect: (tool, shapeType) => {
        this.currentTool = tool;
        if (shapeType) {
          this.currentShapeType = shapeType;
        }
        this.updateInfoBar();
        this.updateSpriteCardTitles(); // Update all sprite card titles with new tool
        this.saveProjectState(); // Persist tool selection
        console.log(`Tool selected: ${tool}${shapeType ? ` (${shapeType})` : ''}`);
      }
    });
    this.scene.addChild(this.toolbarCard.card.container);
    this.registerCard(CARD_IDS.TOOL, this.toolbarCard.card);

    // Hide toolbar by default - will be shown when a sprite sheet is created
    this.toolbarCard.card.container.visible = false;

    // Create info bar using LayoutManager
    const barHeight = 8;
    const cardTotalHeight = this.layoutManager.calculateCardHeightFromContent(barHeight);
    const infoY = this.renderer.height - cardTotalHeight;
    const infoBarWidth = this.layoutManager.calculateFullWidthContentSize(this.renderer.width);

    this.infoBarCard = createInfoBarCard({
      x: 0,
      y: infoY,
      renderer: this.renderer,
      width: infoBarWidth
    });
    this.scene.addChild(this.infoBarCard.card.container);
    this.registerCard(CARD_IDS.INFO, this.infoBarCard.card);

    // Load project state
    this.loadProjectState();

    // Restore UI state, or apply default layout if no saved state
    const stateRestored = this.restoreUIState();
    if (!stateRestored) {
      this.applyDefaultLayout();
    }

    // Center the selected cell after layout is applied
    this.centerActiveSheetCell();

    // Update info bar with initial state
    this.updateInfoBar();
  }

  /**
   * Save current project state (debounced)
   */
  private saveProjectState(): void {
    this.hasUnsavedChanges = true;

    if (this.projectSaveTimer) {
      clearTimeout(this.projectSaveTimer);
    }

    this.projectSaveTimer = window.setTimeout(() => {
      this.projectState.spriteSheets = this.spriteSheetManager.getAll().map(instance => {
        const cell = instance.sheetCard.controller.getSelectedCell();
        const state: SpriteSheetState = {
          id: instance.id,
          type: instance.sheetCard.controller.getConfig().type,
          showGrid: false,
          pixels: instance.sheetCard.controller.getPixelData(),
          selectedCellX: cell.x,
          selectedCellY: cell.y,
          scale: instance.sheetCard.controller.getScale(),
          spriteCardScale: instance.spriteController?.getScale()
        };
        return state;
      });

      const activeSheet = this.spriteSheetManager.getActive();
      this.projectState.activeSpriteSheetId = activeSheet?.id ?? null;
      this.projectState.selectedColorIndex = this.selectedColorIndex;
      this.projectState.selectedTool = this.currentTool;
      this.projectState.selectedShape = this.currentShapeType;
      this.projectState.selectedPalette = this.currentPaletteType;
      this.projectState.animationPreviews = this.animationPreviewManager.exportStates();

      const saveResult = ProjectStateManager.saveProject(this.projectState);
      if (!saveResult.success) {
        console.warn('Auto-save failed:', saveResult.error);
      }
    }, PERFORMANCE_CONSTANTS.AUTO_SAVE_DEBOUNCE_MS);
  }

  /**
   * Save project state immediately (no debounce) - used for beforeunload
   */
  private saveProjectStateImmediate(): void {
    this.projectState.spriteSheets = this.spriteSheetManager.getAll().map(instance => {
      const cell = instance.sheetCard.controller.getSelectedCell();
      const state: SpriteSheetState = {
        id: instance.id,
        type: instance.sheetCard.controller.getConfig().type,
        showGrid: false,
        pixels: instance.sheetCard.controller.getPixelData(),
        selectedCellX: cell.x,
        selectedCellY: cell.y,
        scale: instance.sheetCard.controller.getScale(),
        spriteCardScale: instance.spriteController?.getScale()
      };
      return state;
    });

    const activeSheet = this.spriteSheetManager.getActive();
    this.projectState.activeSpriteSheetId = activeSheet?.id ?? null;
    this.projectState.selectedColorIndex = this.selectedColorIndex;
    this.projectState.selectedTool = this.currentTool;
    this.projectState.selectedShape = this.currentShapeType;
    this.projectState.selectedPalette = this.currentPaletteType;
    this.projectState.animationPreviews = this.animationPreviewManager.exportStates();

    const saveResult = ProjectStateManager.saveProject(this.projectState);
    if (!saveResult.success) {
      console.warn('Immediate save failed:', saveResult.error);
    }
  }

  /**
   * Load project state and recreate sprite sheets
   */
  private loadProjectState(): void {
    if (this.projectState.spriteSheets.length === 0) {
      return;
    }

    this.selectedColorIndex = this.projectState.selectedColorIndex ?? 0;

    // Restore palette selection
    if (this.projectState.selectedPalette) {
      this.currentPaletteType = this.projectState.selectedPalette;
      this.currentPalette = getPalette(this.currentPaletteType);
      if (this.paletteCard) {
        this.paletteCard.setPalette(this.currentPalette);
      }
    }

    // Restore selected color index in palette card
    if (this.paletteCard) {
      this.paletteCard.setSelectedColorIndex(this.selectedColorIndex);
    }

    // Track loaded IDs to prevent duplicates from corrupted state
    const loadedIds = new Set<string>();

    this.projectState.spriteSheets.forEach(sheetState => {
      // Skip if this ID was already loaded (prevents duplicates from corrupted state)
      if (loadedIds.has(sheetState.id)) {
        console.warn(`Skipping duplicate sprite sheet ID: ${sheetState.id}`);
        return;
      }
      loadedIds.add(sheetState.id);

      // Skip if instance already exists in the manager
      if (this.spriteSheetManager.has(sheetState.id)) {
        console.warn(`Sprite sheet instance already exists: ${sheetState.id}`);
        return;
      }

      this.createNewSpriteSheet(sheetState.type, sheetState.showGrid, sheetState);
    });

    // Restore animation previews
    if (this.projectState.animationPreviews && this.projectState.animationPreviews.length > 0) {
      this.animationPreviewManager.importStates(this.projectState.animationPreviews, {
        renderer: this.renderer,
        scene: this.scene,
        getSpriteSheetController: (id) => {
          const instance = this.spriteSheetManager.get(id);
          return instance?.sheetCard?.controller ?? null;
        },
        onFocus: (id) => {
          const preview = this.animationPreviewManager.get(id);
          if (preview) {
            this.scene.setChildIndex(preview.card.container, this.scene.children.length - 1);
          }
        },
        onSelectionModeChange: (previewId, isSelecting) => {
          if (isSelecting) {
            this.animationSelectionModePreviewId = previewId;
          } else if (this.animationSelectionModePreviewId === previewId) {
            this.animationSelectionModePreviewId = null;
          }
          this.saveProjectState();
        },
        onShowSettings: (previewId) => {
          this.showAnimationSettings(previewId);
        },
        onStateChange: () => {
          this.saveProjectState();
        }
      });
    }
  }

  /**
   * Create a new animation preview window
   */
  private createAnimationPreview(): void {
    const activeSheet = this.spriteSheetManager.getActive();
    if (!activeSheet || !activeSheet.sheetCard) {
      // Show dialog if no sprite sheet exists
      const dialog = createPixelDialog({
        title: 'No Sprite Sheet',
        message: 'Create a sprite sheet first before creating animations.',
        buttons: [{ label: 'OK', onClick: () => {} }],
        renderer: this.renderer
      });
      this.scene.addChild(dialog.container);
      return;
    }

    const instance = this.animationPreviewManager.create({
      spriteSheetId: activeSheet.id,
      spriteSheetController: activeSheet.sheetCard.controller,
      renderer: this.renderer,
      scene: this.scene,
      x: 200,
      y: 150,
      onFocus: (id) => {
        // Bring animation card to front
        const preview = this.animationPreviewManager.get(id);
        if (preview) {
          this.scene.setChildIndex(preview.card.container, this.scene.children.length - 1);
        }
      },
      onSelectionModeChange: (previewId, isSelecting) => {
        if (isSelecting) {
          // This preview is now in selection mode
          this.animationSelectionModePreviewId = previewId;
          console.log(`Animation preview ${previewId} entered selection mode`);
        } else {
          // Exiting selection mode
          if (this.animationSelectionModePreviewId === previewId) {
            this.animationSelectionModePreviewId = null;
            console.log(`Animation preview ${previewId} exited selection mode`);
          }
        }
        this.saveProjectState();
      },
      onShowSettings: (previewId) => {
        this.showAnimationSettings(previewId);
      },
      onStateChange: () => {
        this.saveProjectState();
      }
    });

    if (instance) {
      console.log(`Created animation preview: ${instance.id}`);
      this.saveProjectState();
    }
  }

  /**
   * Show animation settings dialog for a preview
   */
  private showAnimationSettings(previewId: string): void {
    const preview = this.animationPreviewManager.get(previewId);
    if (!preview) return;

    const sequence = preview.card.getSequence();

    const dialog = createAnimationSettingsDialog({
      sequence,
      renderer: this.renderer,
      onApply: (updatedSequence) => {
        // Update the preview's sequence
        preview.card.setSequence(updatedSequence);
        this.saveProjectState();
        console.log(`Animation settings updated for ${previewId}`);
      },
      onCancel: () => {
        console.log('Animation settings cancelled');
      }
    });

    this.scene.addChild(dialog.container);
  }

  /**
   * Handle "New" button
   */
  private async handleNew(): Promise<void> {
    if (this.spriteSheetManager.count() > 0) {
      const dialog = createPixelDialog({
        title: 'Save Current Project?',
        message: 'You have unsaved work. Save before creating new project?',
        buttons: [
          {
            label: 'Save',
            onClick: () => {
              this.handleSave();
              setTimeout(() => this.createNewProject(), PERFORMANCE_CONSTANTS.DIALOG_ACTION_DELAY_MS);
            }
          },
          {
            label: 'Discard',
            onClick: () => {
              this.createNewProject();
            }
          },
          {
            label: 'Cancel',
            onClick: () => {}
          }
        ],
        renderer: this.renderer
      });
      this.scene.addChild(dialog.container);
    } else {
      this.createNewProject();
    }
  }

  /**
   * Create a new project
   */
  private createNewProject(): void {
    // Cancel any pending save timers to prevent race conditions
    if (this.projectSaveTimer) {
      clearTimeout(this.projectSaveTimer);
      this.projectSaveTimer = null;
    }

    // Clear using managers - destroy controllers and unregister cards
    this.spriteSheetManager.getAll().forEach((instance, index) => {
      // Remove sprite card FIRST (before factory.remove sets it to null)
      if (instance.spriteCard) {
        this.scene.removeChild(instance.spriteCard.card.container);
        this.uiManager.unregisterCard(getSpriteCardId(index));
      }

      // Clean up zoom handlers via factory (this sets spriteCard to null)
      this.spriteCardFactory.remove(instance);

      // Remove spritesheet card
      if (instance.sheetCard) {
        instance.sheetCard.controller.destroy();
        this.scene.removeChild(instance.sheetCard.card.container);
        this.uiManager.unregisterCard(getSpriteSheetCardId(index));
      }
    });

    this.spriteSheetManager.clear();
    this.animationPreviewManager.clear();
    this.projectState = ProjectStateManager.createEmptyProject();

    // Reset palette to default
    this.currentPaletteType = 'pico8';
    this.currentPalette = PICO8_PALETTE;
    if (this.paletteCard) {
      this.paletteCard.setPalette(this.currentPalette);
    }

    // Clear localStorage immediately to prevent stale state on reload
    ProjectStateManager.saveProject(this.projectState);
    this.hasUnsavedChanges = false;

    // Show sprite sheet type dialog
    this.currentDialog = createPixelDialog({
      title: 'New Sprite Sheet',
      message: 'Choose sprite sheet type:',
      checkboxes: [
        {
          name: 'showGrid',
          label: 'Show 8x8 Grid',
          defaultValue: true
        }
      ],
      buttons: [
        {
          label: 'PICO-8',
          onClick: (checkboxStates) => {
            this.currentDialog = null;
            this.createNewSpriteSheet('PICO-8', checkboxStates?.showGrid ?? false);
            // Always apply default layout for new projects
            this.applyDefaultLayout();
            this.centerActiveSheetCell();
          }
        },
        {
          label: 'TIC-80',
          onClick: (checkboxStates) => {
            this.currentDialog = null;
            this.createNewSpriteSheet('TIC-80', checkboxStates?.showGrid ?? false);
            // Always apply default layout for new projects
            this.applyDefaultLayout();
            this.centerActiveSheetCell();
          }
        }
      ],
      renderer: this.renderer
    });
    this.scene.addChild(this.currentDialog.container);
  }

  /**
   * Handle "Save" button - uses FileOperationsManager
   */
  private handleSave(): void {
    if (this.projectSaveTimer) {
      clearTimeout(this.projectSaveTimer);
    }

    // Update project state
    this.projectState.spriteSheets = this.spriteSheetManager.getAll().map(instance => {
      const cell = instance.sheetCard.controller.getSelectedCell();
      return {
        id: instance.id,
        type: instance.sheetCard.controller.getConfig().type,
        showGrid: false,
        pixels: instance.sheetCard.controller.getPixelData(),
        selectedCellX: cell.x,
        selectedCellY: cell.y,
        scale: instance.sheetCard.controller.getScale(),
        spriteCardScale: instance.spriteController?.getScale()
      };
    });

    const activeSheet = this.spriteSheetManager.getActive();
    this.projectState.activeSpriteSheetId = activeSheet?.id ?? null;
    this.projectState.selectedColorIndex = this.selectedColorIndex;

    // Delegate to FileOperationsManager
    this.fileOperationsManager.saveProject(this.projectState);
    this.hasUnsavedChanges = false;
  }

  /**
   * Handle "Load" button - uses FileOperationsManager
   */
  private async handleLoad(): Promise<void> {
    if (this.spriteSheetManager.count() > 0 && this.hasUnsavedChanges) {
      const dialog = createPixelDialog({
        title: 'Unsaved Changes',
        message: 'Loading will replace current project. Continue?',
        buttons: [
          {
            label: 'Continue',
            onClick: async () => {
              await this.loadProjectFile();
            }
          },
          {
            label: 'Cancel',
            onClick: () => {}
          }
        ],
        renderer: this.renderer
      });
      this.scene.addChild(dialog.container);
    } else {
      await this.loadProjectFile();
    }
  }

  /**
   * Load a project file
   */
  private async loadProjectFile(): Promise<void> {
    // Delegate to FileOperationsManager
    const loadedState = await this.fileOperationsManager.loadProject();
    if (!loadedState) {
      console.log('No file selected or failed to load');
      return;
    }

    // Cancel any pending save timers
    if (this.projectSaveTimer) {
      clearTimeout(this.projectSaveTimer);
      this.projectSaveTimer = null;
    }

    // Clear existing work - destroy controllers, unregister cards, clean up handlers
    this.spriteSheetManager.getAll().forEach((instance, index) => {
      // Remove sprite card FIRST (before factory.remove sets it to null)
      if (instance.spriteCard) {
        this.scene.removeChild(instance.spriteCard.card.container);
        this.uiManager.unregisterCard(getSpriteCardId(index));
      }

      // Clean up zoom handlers via factory (this sets spriteCard to null)
      this.spriteCardFactory.remove(instance);

      // Remove spritesheet card
      if (instance.sheetCard) {
        instance.sheetCard.controller.destroy();
        this.scene.removeChild(instance.sheetCard.card.container);
        this.uiManager.unregisterCard(getSpriteSheetCardId(index));
      }
    });

    this.spriteSheetManager.clear();
    this.projectState = loadedState;
    this.hasUnsavedChanges = false;

    const saveResult = ProjectStateManager.saveProject(this.projectState);
    if (!saveResult.success) {
      console.warn('Failed to save loaded project to localStorage:', saveResult.error);
    }
    this.loadProjectState();

    // Center the selected cell after loading
    this.centerActiveSheetCell();
  }

  /**
   * Handle "Export" button - uses FileOperationsManager
   */
  private handleExport(): void {
    const activeSheet = this.spriteSheetManager.getActive();
    if (!activeSheet) {
      const dialog = createPixelDialog({
        title: 'No Sprite Sheet',
        message: 'Please create a sprite sheet first.',
        buttons: [{ label: 'OK', onClick: () => {} }],
        renderer: this.renderer
      });
      this.scene.addChild(dialog.container);
      return;
    }

    // Delegate to FileOperationsManager
    this.fileOperationsManager.exportPNG(activeSheet.sheetCard.controller);
  }

  /**
   * Handle saving layout to slot
   */
  private handleSaveLayoutSlot(slot: 'A' | 'B' | 'C'): void {
    const layoutState: LayoutSlotState = { cards: [] };

    this.uiManager.getAllCards().forEach((card, id) => {
      const contentSize = card.getContentSize();
      layoutState.cards.push({
        id,
        x: card.container.x,
        y: card.container.y,
        width: contentSize.width,
        height: contentSize.height
      });
    });

    LayoutStateManager.saveLayoutSlot(slot, layoutState);
    console.log(`Layout saved to slot ${slot}`);
  }

  /**
   * Handle loading layout from slot
   */
  private handleLoadLayoutSlot(slot: 'A' | 'B' | 'C'): void {
    const layoutState = LayoutStateManager.loadLayoutSlot(slot);
    if (!layoutState) {
      console.warn(`No layout found in slot ${slot}`);
      return;
    }

    layoutState.cards.forEach(cardLayout => {
      const card = this.uiManager.getCard(cardLayout.id);
      if (card) {
        card.container.position.set(cardLayout.x, cardLayout.y);
        card.setContentSize(cardLayout.width, cardLayout.height);
      }
    });

    console.log(`Layout loaded from slot ${slot}`);
  }

  /**
   * Handle scale change (temporary)
   */
  private handleScaleChange(scale: number): void {
    const dialog = createPixelDialog({
      title: 'Scale Change',
      message: `Changing scale to ${scale}x requires reloading the page.`,
      buttons: [
        {
          label: 'Reload',
          onClick: () => {
            localStorage.setItem('temp-grid-scale', scale.toString());
            window.location.reload();
          }
        },
        {
          label: 'Cancel',
          onClick: () => {}
        }
      ],
      renderer: this.renderer
    });
    this.scene.addChild(dialog.container);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API - Programmatic access to editor actions
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Select a drawing tool
   * @param tool - The tool to select: 'pencil', 'eraser', 'fill', 'selection', 'shape'
   */
  selectTool(tool: MainToolType): void {
    this.currentTool = tool;
    this.toolbarCard?.setSelectedTool(tool);
    this.updateInfoBar();
    this.updateSpriteCardTitles();
    this.saveProjectState();
  }

  /**
   * Select a shape type (used when shape tool is active)
   * @param shape - The shape to select: 'circle', 'circle-filled', 'square', 'square-filled'
   */
  selectShape(shape: ShapeType): void {
    this.currentShapeType = shape;
    this.toolbarCard?.setSelectedShape(shape);
    this.updateInfoBar();
    this.updateSpriteCardTitles();
    this.saveProjectState();
  }

  /**
   * Select a color from the palette by index
   * @param index - Palette color index (0-15 for PICO-8)
   */
  selectColor(index: number): void {
    if (index >= 0 && index < this.currentPalette.length) {
      this.selectedColorIndex = index;
      this.paletteCard?.setSelectedColorIndex(index);
      this.updateInfoBar();
    }
  }

  /**
   * Undo the last drawing operation
   */
  undo(): void {
    this.handleUndo();
  }

  /**
   * Redo the last undone operation
   */
  redo(): void {
    this.handleRedo();
  }

  /**
   * Copy the current selection to clipboard
   */
  copy(): void {
    this.handleCopy();
  }

  /**
   * Paste clipboard contents at selection or origin
   */
  paste(): void {
    this.handlePaste();
  }

  /**
   * Cut the current selection (copy + clear)
   */
  cut(): void {
    this.handleCut();
  }

  /**
   * Clear the current selection (fill with transparent)
   */
  clearSelection(): void {
    this.handleClearSelection();
  }

  /**
   * Move the current selection by offset
   * @param dx - Horizontal offset in pixels
   * @param dy - Vertical offset in pixels
   */
  moveSelection(dx: number, dy: number): void {
    this.handleMoveSelection(dx, dy);
  }

  /**
   * Click the "New" button - shows the new project dialog
   */
  clickNew(): void {
    this.handleNew();
  }

  /**
   * Click the "PICO-8" button in the new project dialog
   */
  clickPico8(): boolean {
    if (!this.currentDialog) return false;
    return this.currentDialog.clickButton('PICO-8');
  }

  /**
   * Click the "TIC-80" button in the new project dialog
   */
  clickTic80(): boolean {
    if (!this.currentDialog) return false;
    return this.currentDialog.clickButton('TIC-80');
  }

  /**
   * Click the "Save" button
   */
  clickSave(): void {
    this.handleSave();
  }

  /**
   * Click the "Load" button (opens file picker)
   */
  async clickLoad(): Promise<void> {
    await this.handleLoad();
  }

  /**
   * Click the "Export" button
   */
  clickExport(): void {
    this.handleExport();
  }

  /**
   * Click the "Layout" button
   */
  clickLayout(): void {
    this.applyDefaultLayout();
  }

  /**
   * Update the editor theme
   */
  refreshTheme(): void {
    this.updateTheme();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // State Getters
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the currently selected tool
   */
  getCurrentTool(): MainToolType {
    return this.currentTool;
  }

  /**
   * Get the currently selected shape type
   */
  getCurrentShape(): ShapeType {
    return this.currentShapeType;
  }

  /**
   * Get the selected color palette index
   */
  getSelectedColorIndex(): number {
    return this.selectedColorIndex;
  }

  /**
   * Get the selected color as hex value
   */
  getSelectedColorHex(): number {
    return this.currentPalette[this.selectedColorIndex] ?? 0xFFFFFF;
  }

  /**
   * Get the current palette
   */
  getPalette(): number[] {
    return [...this.currentPalette];
  }

  /**
   * Check if there are unsaved changes
   */
  hasChanges(): boolean {
    return this.hasUnsavedChanges;
  }

  /**
   * Get the number of sprite sheets
   */
  getSpriteSheetCount(): number {
    return this.spriteSheetManager.count();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.uiStateSaveTimer) {
      clearTimeout(this.uiStateSaveTimer);
    }
    if (this.projectSaveTimer) {
      clearTimeout(this.projectSaveTimer);
    }

    // Clean up keyboard handler
    if (this.keyboardHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }

    // Clean up beforeunload handler
    if (this.beforeUnloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    // Destroy all sprite sheet controllers to prevent memory leaks
    this.spriteSheetManager.getAll().forEach(instance => {
      if (instance.sheetCard) {
        instance.sheetCard.controller.destroy();
      }
    });

    // Clean up factory
    this.spriteCardFactory.destroy();

    this.uiManager.clear();
    this.spriteSheetManager.clear();
  }
}

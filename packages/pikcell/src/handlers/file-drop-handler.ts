/**
 * File Drop Handler
 * Handles drag-and-drop file operations for PNG spritesheets and .pikcell project files
 */

export interface FileDropHandlerOptions {
  /** The HTML element to attach drop listeners to */
  dropTarget: HTMLElement;
  /** Callback when a PNG file is dropped */
  onPngDrop: (file: File) => void;
  /** Callback when a .pikcell project file is dropped */
  onProjectDrop: (file: File) => void;
  /** Optional callback for drag enter */
  onDragEnter?: () => void;
  /** Optional callback for drag leave */
  onDragLeave?: () => void;
}

export interface FileDropHandlerResult {
  /** Remove all event listeners and cleanup */
  destroy: () => void;
  /** Check if handler is active */
  isActive: () => boolean;
}

/**
 * Creates a file drop handler for the given target element
 */
export function createFileDropHandler(options: FileDropHandlerOptions): FileDropHandlerResult {
  const { dropTarget, onPngDrop, onProjectDrop, onDragEnter, onDragLeave } = options;

  let isActive = true;
  let dragCounter = 0; // Track nested drag events

  /**
   * Handle dragenter event
   */
  function handleDragEnter(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    dragCounter++;

    if (dragCounter === 1) {
      onDragEnter?.();
    }
  }

  /**
   * Handle dragleave event
   */
  function handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    dragCounter--;

    if (dragCounter === 0) {
      onDragLeave?.();
    }
  }

  /**
   * Handle dragover event (required to allow drop)
   */
  function handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // Set the drop effect
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  /**
   * Handle drop event
   */
  function handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // Reset drag counter
    dragCounter = 0;
    onDragLeave?.();

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    // Process first file only
    const file = files[0];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.png')) {
      onPngDrop(file);
    } else if (fileName.endsWith('.pikcell') || fileName.endsWith('.moxiproject')) {
      onProjectDrop(file);
    } else {
      console.warn(`Unsupported file type: ${file.name}`);
    }
  }

  // Add event listeners
  dropTarget.addEventListener('dragenter', handleDragEnter);
  dropTarget.addEventListener('dragleave', handleDragLeave);
  dropTarget.addEventListener('dragover', handleDragOver);
  dropTarget.addEventListener('drop', handleDrop);

  return {
    destroy: () => {
      if (!isActive) return;

      dropTarget.removeEventListener('dragenter', handleDragEnter);
      dropTarget.removeEventListener('dragleave', handleDragLeave);
      dropTarget.removeEventListener('dragover', handleDragOver);
      dropTarget.removeEventListener('drop', handleDrop);

      isActive = false;
    },
    isActive: () => isActive
  };
}

/**
 * Read a file as text
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}

/**
 * Read a file as an Image element
 */
export async function readFileAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
      img.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

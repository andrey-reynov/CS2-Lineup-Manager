import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageEditorComponent, ImageEditorSave } from './image-editor';

let canvasOperations: Array<{ name: string; args: number[] }> = [];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 320;
  naturalHeight = 180;
  width = 320;
  height = 180;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function pointerEvent(type: string, init: PointerEventInit): PointerEvent {
  if (typeof PointerEvent !== 'undefined') {
    return new PointerEvent(type, { bubbles: true, ...init });
  }

  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: init.clientX,
    clientY: init.clientY,
    shiftKey: init.shiftKey,
  }) as PointerEvent;
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  return event;
}

function stubCanvas(): void {
  canvasOperations = [];
  const record = (name: string) => (...args: number[]) => {
    canvasOperations.push({ name, args });
  };
  const context = {
    arc: () => undefined,
    beginPath: () => undefined,
    clearRect: () => undefined,
    clip: () => undefined,
    drawImage: () => undefined,
    ellipse: () => undefined,
    fill: () => undefined,
    fillRect: () => undefined,
    fillText: () => undefined,
    lineTo: record('lineTo'),
    moveTo: record('moveTo'),
    rect: () => undefined,
    restore: () => undefined,
    save: () => undefined,
    setLineDash: () => undefined,
    stroke: () => undefined,
    strokeRect: () => undefined,
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => context,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value(callback: BlobCallback) {
      callback(new Blob(['edited'], { type: 'image/png' }));
    },
  });
}

function setCanvasRect(canvas: HTMLCanvasElement): void {
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      width: 320,
      height: 180,
      right: 320,
      bottom: 180,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

describe('ImageEditorComponent', () => {
  let originalImage: typeof Image;

  beforeEach(async () => {
    stubCanvas();
    originalImage = Image;
    (globalThis as unknown as { Image: typeof Image }).Image = FakeImage as unknown as typeof Image;
    await TestBed.configureTestingModule({
      imports: [ImageEditorComponent],
    }).compileComponents();
  });

  afterEach(() => {
    (globalThis as unknown as { Image: typeof Image }).Image = originalImage;
  });

  async function createEditor(): Promise<ComponentFixture<ImageEditorComponent>> {
    const fixture = TestBed.createComponent(ImageEditorComponent);
    fixture.componentRef.setInput('media', {
      id: 'media-1',
      name: 'lineup.jpg',
      type: 'image',
      mimeType: 'image/jpeg',
      blob: new Blob(['source'], { type: 'image/jpeg' }),
      url: 'blob:source',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    setCanvasRect(fixture.nativeElement.querySelector('canvas'));
    return fixture;
  }

  it('should add freehand annotations and undo or redo them', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: unknown[]; redoStack: unknown[] };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 10, clientY: 10 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 80, clientY: 40 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 80, clientY: 40 }));
    fixture.detectChanges();

    expect(editor.annotations).toHaveLength(1);

    (fixture.nativeElement.querySelector('[aria-label="Undo"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(editor.annotations).toHaveLength(0);
    expect(editor.redoStack).toHaveLength(1);

    (fixture.nativeElement.querySelector('[aria-label="Redo"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(editor.annotations).toHaveLength(1);
  });

  it('should add shape and text annotations', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: Array<{ type: string }> };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Arrow"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, button: 0, clientX: 30, clientY: 30 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 120, clientY: 90 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 120, clientY: 90 }));

    (fixture.nativeElement.querySelector('[aria-label="Text"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement).value = 'Aim here';
    (fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement).dispatchEvent(new Event('input'));
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 3, button: 0, clientX: 60, clientY: 60 }));

    expect(editor.annotations.map((annotation) => annotation.type)).toEqual(['arrow', 'text']);
  });

  it('should resize selected annotations from a corner handle', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: Array<{ end: { x: number; y: number } }> };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Rectangle"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 4, button: 0, clientX: 30, clientY: 30 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 4, clientX: 120, clientY: 90 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 4, clientX: 120, clientY: 90 }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[aria-label="Select"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 5, button: 0, clientX: 120, clientY: 90 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 5, clientX: 160, clientY: 120 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 5, clientX: 160, clientY: 120 }));
    fixture.detectChanges();

    expect(editor.annotations[0].end).toEqual({ x: 160, y: 120 });
  });

  it('should lock rectangle creation and resize aspect ratio while holding Shift', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Rectangle"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 17, button: 0, clientX: 30, clientY: 30 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 17, clientX: 90, clientY: 50, shiftKey: true }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 17, clientX: 90, clientY: 50, shiftKey: true }));
    fixture.detectChanges();

    expect(editor.annotations[0].end).toEqual({ x: 90, y: 90 });

    (fixture.nativeElement.querySelector('[aria-label="Select"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 18, button: 0, clientX: 90, clientY: 90 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 18, clientX: 150, clientY: 110, shiftKey: true }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 18, clientX: 150, clientY: 110, shiftKey: true }));

    expect(editor.annotations[0].end).toEqual({ x: 150, y: 150 });
  });

  it('should align lines and arrows horizontally or vertically while holding Shift', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Arrow"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 21, button: 0, clientX: 10, clientY: 10 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 21, clientX: 70, clientY: 40, shiftKey: true }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 21, clientX: 70, clientY: 40, shiftKey: true }));

    expect(editor.annotations[0].end).toEqual({ x: 70, y: 10 });

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 22, button: 0, clientX: 70, clientY: 10 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 22, clientX: 80, clientY: 100, shiftKey: true }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 22, clientX: 80, clientY: 100, shiftKey: true }));

    expect(editor.annotations[0].end).toEqual({ x: 10, y: 100 });
  });

  it('should move a freshly selected shape before drawing another one', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as {
      annotations: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>;
      selectedAnnotationId: string | null;
    };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Rectangle"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 11, button: 0, clientX: 30, clientY: 30 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 11, clientX: 120, clientY: 90 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 11, clientX: 120, clientY: 90 }));

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 12, button: 0, clientX: 60, clientY: 50 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 12, clientX: 80, clientY: 65 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 12, clientX: 80, clientY: 65 }));
    fixture.detectChanges();

    expect(editor.annotations).toHaveLength(1);
    expect(editor.annotations[0].start).toEqual({ x: 50, y: 45 });
    expect(editor.annotations[0].end).toEqual({ x: 140, y: 105 });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(editor.selectedAnnotationId).toBeNull();
  });

  it('should pan the image only from the pan tool with left drag', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { zoom: number; pan: { x: number; y: number } };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    editor.zoom = 2;
    (fixture.nativeElement.querySelector('[aria-label="Move image"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 13, button: 0, clientX: 40, clientY: 40 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 13, clientX: 70, clientY: 55 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 13, clientX: 70, clientY: 55 }));

    expect(editor.pan).toEqual({ x: 30, y: 15 });
  });

  it('should create a rectangle zoom callout with source metadata and movable target', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as {
      annotations: Array<{
        type: string;
        source: { x: number; y: number; width: number; height: number };
        target: { x: number; y: number; width: number; height: number };
        zoom: number;
        sourceTransform?: { sourceImageId?: string; version: number };
      }>;
    };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Rectangle zoom callout"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 14, button: 0, clientX: 30, clientY: 30 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 14, clientX: 80, clientY: 60 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 14, clientX: 80, clientY: 60 }));
    fixture.detectChanges();

    expect(editor.annotations).toHaveLength(1);
    expect(editor.annotations[0]).toMatchObject({
      type: 'callout',
      source: { x: 30, y: 30, width: 50, height: 30 },
      target: { x: 108, y: 30, width: 100, height: 60 },
      zoom: 2,
      sourceTransform: { sourceImageId: 'media-1', version: 1 },
    });

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 15, button: 0, clientX: 130, clientY: 45 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 15, clientX: 150, clientY: 65 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 15, clientX: 150, clientY: 65 }));

    expect(editor.annotations[0].source).toEqual({ x: 30, y: 30, width: 50, height: 30 });
    expect(editor.annotations[0].target).toEqual({ x: 128, y: 50, width: 100, height: 60 });
  });

  it('should draw zoom callout arrows from outline to outline', async () => {
    const fixture = await createEditor();
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    canvasOperations = [];
    (fixture.nativeElement.querySelector('[aria-label="Rectangle zoom callout"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 19, button: 0, clientX: 30, clientY: 30 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 19, clientX: 80, clientY: 60 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 19, clientX: 80, clientY: 60 }));

    const connectorMove = canvasOperations.find((operation) => (
      operation.name === 'moveTo' &&
      Math.abs(operation.args[0] - 108) < 0.1 &&
      Math.abs(operation.args[1] - 52.7) < 0.1
    ));
    const connectorLine = canvasOperations.find((operation) => (
      operation.name === 'lineTo' &&
      Math.abs(operation.args[0] - 80) < 0.1 &&
      Math.abs(operation.args[1] - 48.6) < 0.1
    ));

    expect(connectorMove).toBeTruthy();
    expect(connectorLine).toBeTruthy();
  });

  it('should lock zoom callout source to a square while holding Shift during creation', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: Array<{ source: { width: number; height: number }; target: { width: number; height: number } }> };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Circle zoom callout"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 20, button: 0, clientX: 40, clientY: 40 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 20, clientX: 100, clientY: 60, shiftKey: true }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 20, clientX: 100, clientY: 60, shiftKey: true }));

    expect(editor.annotations[0].source).toEqual({ x: 40, y: 40, width: 60, height: 60 });
    expect(editor.annotations[0].target).toEqual({ x: 128, y: 40, width: 120, height: 120 });
  });

  it('should create a circle zoom callout', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: Array<{ type: string; shape: string }> };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Circle zoom callout"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 16, button: 0, clientX: 40, clientY: 40 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 16, clientX: 90, clientY: 90 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 16, clientX: 90, clientY: 90 }));

    expect(editor.annotations[0]).toMatchObject({ type: 'callout', shape: 'circle' });
  });

  it('should erase annotations and restore them with Ctrl+Z', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: unknown[]; tool: string };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 6, button: 0, clientX: 10, clientY: 10 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 6, clientX: 80, clientY: 40 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 6, clientX: 80, clientY: 40 }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    expect(editor.tool).toBe('eraser');

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 7, button: 0, clientX: 20, clientY: 20 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 7, clientX: 20, clientY: 20 }));
    fixture.detectChanges();
    expect(editor.annotations).toHaveLength(0);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    fixture.detectChanges();
    expect(editor.annotations).toHaveLength(1);
  });

  it('should guard shortcuts while typing and support redo with Shift+Ctrl+Z', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: unknown[]; tool: string };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 8, button: 0, clientX: 10, clientY: 10 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 8, clientX: 80, clientY: 40 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 8, clientX: 80, clientY: 40 }));
    (fixture.nativeElement.querySelector('[aria-label="Text"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    expect(editor.tool).toBe('text');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    expect(editor.annotations).toHaveLength(0);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true }));
    expect(editor.annotations).toHaveLength(1);
  });

  it('should change the selected annotation color from a preset', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: Array<{ color: string }> };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Rectangle"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 9, button: 0, clientX: 30, clientY: 30 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 9, clientX: 120, clientY: 90 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 9, clientX: 120, clientY: 90 }));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.image-editor-color-button') as HTMLButtonElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Color #3fb950"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(editor.annotations[0].color).toContain('rgba(63, 185, 80');
  });

  it('should change the selected annotation stroke width after placement', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: Array<{ strokeWidth: number }> };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Rectangle"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 23, button: 0, clientX: 30, clientY: 30 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 23, clientX: 120, clientY: 90 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 23, clientX: 120, clientY: 90 }));
    fixture.detectChanges();

    const strokeInput = fixture.nativeElement.querySelector('.image-editor-control input[type="range"]') as HTMLInputElement;
    strokeInput.value = '12';
    strokeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(editor.annotations[0].strokeWidth).toBe(12);
  });

  it('should edit selected text in place', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: Array<{ text: string }> };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    (fixture.nativeElement.querySelector('[aria-label="Text"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement).value = 'Aim here';
    (fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement).dispatchEvent(new Event('input'));
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 24, button: 0, clientX: 60, clientY: 60 }));
    fixture.detectChanges();

    const inlineInput = fixture.nativeElement.querySelector('[aria-label="Edit selected text"]') as HTMLInputElement;
    inlineInput.value = 'Land here';
    inlineInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(editor.annotations[0].text).toBe('Land here');
  });

  it('should update color from the saturation value picker', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { color: string };

    (fixture.nativeElement.querySelector('.image-editor-color-button') as HTMLButtonElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    fixture.detectChanges();
    const picker = fixture.nativeElement.querySelector('.image-editor-sv-picker') as HTMLElement;
    Object.defineProperty(picker, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    picker.dispatchEvent(pointerEvent('pointerdown', { pointerId: 10, button: 0, clientX: 100, clientY: 0 }));
    fixture.detectChanges();

    expect(editor.color).toContain('rgba(');
    expect(editor.color).not.toBe('#f14c4c');
  });

  it('should zoom with the mouse wheel', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { zoom: number };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -120 }));
    fixture.detectChanges();

    expect(editor.zoom).toBeGreaterThan(1);
  });

  it('should emit selected save mode with a png blob', async () => {
    const fixture = await createEditor();
    const saves: ImageEditorSave[] = [];
    fixture.componentInstance.save.subscribe((result) => saves.push(result));

    (fixture.nativeElement.querySelector('[aria-label="Save image"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.image-editor-save-menu button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({
      mode: 'copy',
      name: 'lineup-edited.png',
      mimeType: 'image/png',
    });
    expect(saves[0].blob.type).toBe('image/png');
  });

  it('should keep the save choices menu above the edited image layer', async () => {
    const fixture = await createEditor();

    (fixture.nativeElement.querySelector('[aria-label="Save image"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const headerZIndex = Number.parseInt(getComputedStyle(fixture.nativeElement.querySelector('.image-editor-header')).zIndex, 10);
    const stageZIndex = Number.parseInt(getComputedStyle(fixture.nativeElement.querySelector('.image-editor-stage')).zIndex || '0', 10);

    expect(headerZIndex).toBeGreaterThan(stageZIndex);
    expect(fixture.nativeElement.querySelector('.image-editor-save-menu')).toBeTruthy();
  });

  it('should not close from Escape and should delete a freshly autoselected annotation', async () => {
    const fixture = await createEditor();
    const editor = fixture.componentInstance as unknown as { annotations: unknown[] };
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    const cancels: void[] = [];
    fixture.componentInstance.cancel.subscribe(() => cancels.push(undefined));

    (fixture.nativeElement.querySelector('[aria-label="Rectangle"]') as HTMLButtonElement).click();
    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 25, button: 0, clientX: 30, clientY: 30 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 25, clientX: 120, clientY: 90 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 25, clientX: 120, clientY: 90 }));
    expect(editor.annotations).toHaveLength(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cancels).toHaveLength(0);
    expect(editor.annotations).toHaveLength(0);
  });
});

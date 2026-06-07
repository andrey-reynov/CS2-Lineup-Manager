import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageEditorComponent, ImageEditorSave } from './image-editor';

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

  const event = new MouseEvent(type, { bubbles: true, clientX: init.clientX, clientY: init.clientY }) as PointerEvent;
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  return event;
}

function stubCanvas(): void {
  const context = {
    arc: () => undefined,
    beginPath: () => undefined,
    clearRect: () => undefined,
    drawImage: () => undefined,
    ellipse: () => undefined,
    fill: () => undefined,
    fillRect: () => undefined,
    fillText: () => undefined,
    lineTo: () => undefined,
    moveTo: () => undefined,
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

    (fixture.nativeElement.querySelector('.image-editor-footer .is-accent') as HTMLButtonElement).click();
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

  it('should cancel from Escape without changing annotations', async () => {
    const fixture = await createEditor();
    const cancels: void[] = [];
    fixture.componentInstance.cancel.subscribe(() => cancels.push(undefined));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cancels).toHaveLength(1);
    expect((fixture.componentInstance as unknown as { annotations: unknown[] }).annotations).toHaveLength(0);
  });
});

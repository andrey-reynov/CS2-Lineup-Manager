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
    beginPath: () => undefined,
    clearRect: () => undefined,
    drawImage: () => undefined,
    ellipse: () => undefined,
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

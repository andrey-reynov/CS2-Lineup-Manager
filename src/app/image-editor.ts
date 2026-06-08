import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type ImageEditorMedia = {
  id: string;
  name: string;
  url: string;
  blob: Blob;
  mimeType: string;
};

export type ImageEditorSaveMode = 'copy' | 'replace';

export type ImageEditorSave = {
  mode: ImageEditorSaveMode;
  blob: Blob;
  name: string;
  mimeType: 'image/png';
};

type EditorTool = 'select' | 'pan' | 'pen' | 'eraser' | 'arrow' | 'rectangle' | 'circle' | 'line' | 'text' | 'callout-rectangle' | 'callout-circle';
type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

type Point = {
  x: number;
  y: number;
};

type BaseAnnotation = {
  id: string;
  color: string;
  strokeWidth: number;
};

type PenAnnotation = BaseAnnotation & {
  type: 'pen';
  points: Point[];
};

type ShapeAnnotation = BaseAnnotation & {
  type: 'arrow' | 'rectangle' | 'circle' | 'line';
  start: Point;
  end: Point;
};

type TextAnnotation = BaseAnnotation & {
  type: 'text';
  position: Point;
  text: string;
  fontSize: number;
};

type CalloutAnnotation = BaseAnnotation & {
  type: 'callout';
  shape: 'rectangle' | 'circle';
  source: Bounds;
  target: Bounds;
  zoom: number;
  sourceTransform?: {
    upscaleEngine?: string;
    sourceImageId?: string;
    version: 1;
  };
};

type Annotation = PenAnnotation | ShapeAnnotation | TextAnnotation | CalloutAnnotation;

type DraftAnnotation = Annotation & {
  isDraft?: true;
  draftStart?: Point;
};

type DragState =
  | {
      mode: 'draw';
      annotation: DraftAnnotation;
    }
  | {
      mode: 'move';
      annotationId: string;
      start: Point;
      original: Annotation;
    }
  | {
      mode: 'resize';
      annotationId: string;
      handle: ResizeHandle;
      originalBounds: Bounds;
      original: Annotation;
    }
  | {
      mode: 'erase';
      erasedIds: Set<string>;
    }
  | {
      mode: 'pan';
      startClient: Point;
      startPan: Point;
    }
  | {
      mode: 'color';
      target: 'sv' | 'hue' | 'alpha';
    };

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ColorPickerPosition = {
  x: number;
  y: number;
};

const DEFAULT_COLORS = ['#f14c4c', '#e5a50a', '#3fb950', '#56b4e9', '#ffffff', '#111111'];
const CANVAS_FALLBACK_SIZE = 960;
const HANDLE_SIZE = 10;
const HANDLE_HIT_SIZE = 18;

@Component({
  selector: 'app-image-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-editor.html',
  styleUrl: './image-editor.scss',
})
export class ImageEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) media!: ImageEditorMedia;
  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly save = new EventEmitter<ImageEditorSave>();

  @ViewChild('canvas') private readonly canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('stage') private readonly stageRef?: ElementRef<HTMLElement>;

  protected readonly colors = DEFAULT_COLORS;
  protected readonly resizeHandleOptions: ResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  protected tool: EditorTool = 'pen';
  protected color = DEFAULT_COLORS[0];
  protected hue = 0;
  protected saturation = 70;
  protected value = 95;
  protected colorAlpha = 1;
  protected colorPickerOpen = false;
  protected colorPickerPosition: ColorPickerPosition = { x: 110, y: 92 };
  protected strokeWidth = 4;
  protected fontSize = 32;
  protected textValue = 'Text';
  protected selectedAnnotationId: string | null = null;
  protected freshAnnotationId: string | null = null;
  protected saveChoicesOpen = false;
  protected isLoading = true;
  protected errorMessage = '';
  protected zoom = 1;
  protected pan = { x: 0, y: 0 };

  private image: HTMLImageElement | null = null;
  private annotations: Annotation[] = [];
  private historyStack: Annotation[][] = [];
  private redoStack: Annotation[][] = [];
  private dragState: DragState | null = null;
  private canvasReady = false;
  private spacePressed = false;

  ngAfterViewInit(): void {
    this.canvasReady = true;
    this.loadImage();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['media'] && !changes['media'].firstChange) {
      this.resetEditor();
      if (this.canvasReady) {
        this.loadImage();
      }
    }
  }

  ngOnDestroy(): void {
    this.dragState = null;
  }

  protected selectTool(tool: EditorTool): void {
    this.tool = tool;
    if (tool !== 'select' && tool !== 'pan' && tool !== 'eraser') {
      this.selectedAnnotationId = null;
    }
    this.saveChoicesOpen = false;
  }

  protected setPresetColor(color: string): void {
    const hsv = this.hexToHsv(color);
    this.hue = hsv.h;
    this.saturation = hsv.s;
    this.value = hsv.v;
    this.updateCurrentColor(true);
  }

  protected setColorAlpha(value: number | string): void {
    this.colorAlpha = Math.max(0.05, Math.min(1, Number(value)));
    this.updateCurrentColor(true);
  }

  protected toggleColorPicker(event?: MouseEvent): void {
    if (event?.currentTarget instanceof HTMLElement) {
      const rect = event.currentTarget.getBoundingClientRect();
      this.colorPickerPosition = {
        x: rect.right + 10,
        y: Math.max(16, rect.top - 8),
      };
    }
    this.colorPickerOpen = !this.colorPickerOpen;
    this.saveChoicesOpen = false;
  }

  protected colorMenuStyle(): Record<string, string> {
    return {
      left: `${this.colorPickerPosition.x}px`,
      top: `${this.colorPickerPosition.y}px`,
    };
  }

  protected saturationValueBackground(): string {
    return `linear-gradient(0deg, #000, transparent), linear-gradient(90deg, #fff, hsl(${this.hue}, 100%, 50%))`;
  }

  protected saturationValueHandleStyle(): Record<string, string> {
    return {
      left: `${this.saturation}%`,
      top: `${100 - this.value}%`,
    };
  }

  protected hueHandleStyle(): Record<string, string> {
    return { left: `${(this.hue / 360) * 100}%` };
  }

  protected alphaHandleStyle(): Record<string, string> {
    return { left: `${this.colorAlpha * 100}%` };
  }

  protected alphaTrackBackground(): string {
    const opaqueColor = this.hsvToRgba(this.hue, this.saturation, this.value, 1);
    return `linear-gradient(90deg, transparent, ${opaqueColor})`;
  }

  protected selectedTextValue(): string {
    const selected = this.selectedAnnotation();
    return selected?.type === 'text' ? selected.text : '';
  }

  protected selectedTextEditorStyle(): Record<string, string> {
    const selected = this.selectedAnnotation();
    if (!selected || selected.type !== 'text') {
      return {};
    }

    return {
      ...this.screenBoundsStyle(this.annotationBounds(selected)),
      color: selected.color,
      fontSize: `${this.screenLength(selected.fontSize)}px`,
    };
  }

  protected onColorPointerDown(target: 'sv' | 'hue' | 'alpha', event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.dragState = { mode: 'color', target };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.updateColorFromPointer(target, event);
  }

  protected selectedBounds(): Bounds | undefined {
    const selected = this.selectedAnnotation();
    return selected ? this.annotationBounds(selected) : undefined;
  }

  protected selectionHandleStyle(handle: ResizeHandle): Record<string, string> {
    const box = this.selectedBounds();
    if (!box) {
      return {};
    }

    const point = this.handlePoint(box, handle);
    return {
      left: `${point.x}px`,
      top: `${point.y}px`,
    };
  }

  protected canvasTransform(): string {
    return `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
  }

  protected canvasCursorClass(): string {
    if (this.tool === 'pan') {
      return 'is-pan-tool';
    }

    if (this.selectedAnnotationId) {
      return 'has-selection';
    }

    return '';
  }

  protected selectedAnnotationType(): Annotation['type'] | undefined {
    return this.selectedAnnotation()?.type;
  }

  protected selectedCalloutShape(): CalloutAnnotation['shape'] | undefined {
    const selected = this.selectedAnnotation();
    return selected?.type === 'callout' ? selected.shape : undefined;
  }

  protected selectedSelectionStyle(): Record<string, string> {
    const selected = this.selectedAnnotation();
    if (!selected) {
      return {};
    }

    if (selected.type === 'line' || selected.type === 'arrow') {
      return {};
    }

    return this.screenBoundsStyle(selected.type === 'callout' ? selected.target : this.annotationBounds(selected));
  }

  protected selectedLineEndpointStyle(endpoint: 'start' | 'end'): Record<string, string> {
    const selected = this.selectedAnnotation();
    if (!selected || (selected.type !== 'line' && selected.type !== 'arrow')) {
      return {};
    }

    return this.screenPointStyle(endpoint === 'start' ? selected.start : selected.end);
  }

  protected selectedHandleStyle(handle: ResizeHandle): Record<string, string> {
    const selected = this.selectedAnnotation();
    if (!selected || selected.type === 'line' || selected.type === 'arrow') {
      return {};
    }

    return this.screenPointStyle(this.handlePoint(selected.type === 'callout' ? selected.target : this.annotationBounds(selected), handle));
  }

  protected zoomIn(): void {
    this.setZoom(this.zoom + 0.25);
  }

  protected zoomOut(): void {
    this.setZoom(this.zoom - 0.25);
  }

  protected resetZoom(): void {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
  }

  protected applyStrokeWidthToSelected(): void {
    const selectedId = this.selectedAnnotationId;
    if (!selectedId) {
      return;
    }

    this.rememberHistory();
    this.annotations = this.annotations.map((annotation) => (
      annotation.id === selectedId ? { ...annotation, strokeWidth: this.strokeWidth } : annotation
    ));
    this.render();
  }

  protected updateSelectedText(text: string): void {
    const selectedId = this.selectedAnnotationId;
    if (!selectedId) {
      return;
    }

    const selected = this.selectedAnnotation();
    if (!selected || selected.type !== 'text' || selected.text === text) {
      return;
    }

    this.rememberHistory();
    this.annotations = this.annotations.map((annotation) => (
      annotation.id === selectedId && annotation.type === 'text' ? { ...annotation, text } : annotation
    ));
    this.textValue = text;
    this.render();
  }

  protected canUndo(): boolean {
    return this.historyStack.length > 0;
  }

  protected canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  protected undo(): void {
    if (!this.canUndo()) {
      return;
    }

    const previous = this.historyStack.pop();
    if (!previous) {
      return;
    }

    this.redoStack.push(this.cloneAnnotations(this.annotations));
    this.annotations = previous;
    this.selectedAnnotationId = null;
    this.freshAnnotationId = null;
    this.render();
  }

  protected redo(): void {
    const next = this.redoStack.pop();
    if (!next) {
      return;
    }

    this.historyStack.push(this.cloneAnnotations(this.annotations));
    this.annotations = next;
    this.selectedAnnotationId = null;
    this.freshAnnotationId = null;
    this.render();
  }

  protected clear(): void {
    if (this.annotations.length === 0) {
      return;
    }

    this.rememberHistory();
    this.annotations = [];
    this.selectedAnnotationId = null;
    this.freshAnnotationId = null;
    this.render();
  }

  protected deleteSelected(): void {
    if (!this.selectedAnnotationId) {
      return;
    }

    this.rememberHistory();
    this.annotations = this.annotations.filter((annotation) => annotation.id !== this.selectedAnnotationId);
    this.selectedAnnotationId = null;
    this.freshAnnotationId = null;
    this.render();
  }

  protected onCanvasPointerDown(event: PointerEvent): void {
    if ((event.button !== 0 && event.button !== 1) || this.isLoading) {
      return;
    }

    event.preventDefault();
    this.colorPickerOpen = false;
    if (this.shouldPan(event)) {
      this.dragState = {
        mode: 'pan',
        startClient: { x: event.clientX, y: event.clientY },
        startPan: { ...this.pan },
      };
      this.canvasRef?.nativeElement.setPointerCapture?.(event.pointerId);
      return;
    }

    const point = this.canvasPoint(event);
    this.saveChoicesOpen = false;
    this.canvasRef?.nativeElement.setPointerCapture?.(event.pointerId);

    const handle = this.findSelectedHandleAt(point);
    if (handle && this.selectedAnnotationId) {
      const selected = this.selectedAnnotation();
      if (selected) {
        this.dragState = {
          mode: 'resize',
          annotationId: selected.id,
          handle,
          originalBounds: this.annotationBounds(selected),
          original: this.cloneAnnotation(selected),
        };
        this.rememberHistory();
      }
      return;
    }

    const selected = this.selectedAnnotation();
    if (selected && this.tool !== 'eraser' && this.tool !== 'pan') {
      const selectedHit = this.annotationHitTest(selected, point, 12);
      if (selectedHit) {
        this.freshAnnotationId = null;
        this.dragState = {
          mode: 'move',
          annotationId: selected.id,
          start: point,
          original: this.cloneAnnotation(selected),
        };
        this.rememberHistory();
        return;
      }

      if (this.tool !== 'select') {
        return;
      }
    }

    if (this.tool === 'eraser') {
      this.rememberHistory();
      const erasedIds = new Set<string>();
      this.eraseAt(point, erasedIds);
      this.dragState = { mode: 'erase', erasedIds };
      return;
    }

    if (this.tool === 'select') {
      const annotation = this.findAnnotationAt(point);
      this.selectedAnnotationId = annotation?.id ?? null;
      this.freshAnnotationId = null;
      this.syncControlsFromAnnotation(annotation);
      this.dragState = annotation
        ? {
            mode: 'move',
            annotationId: annotation.id,
            start: point,
            original: this.cloneAnnotation(annotation),
          }
        : null;
      if (annotation) {
        this.rememberHistory();
      }
      this.render();
      return;
    }

    if (this.tool === 'pan') {
      return;
    }

    if (this.tool === 'text') {
      const text = this.textValue.trim();
      if (!text) {
        return;
      }

      this.commitAnnotation({
        id: this.annotationId(),
        type: 'text',
        position: point,
        text,
        color: this.color,
        strokeWidth: this.strokeWidth,
        fontSize: this.fontSize,
      });
      return;
    }

    const annotation = this.createDraftAnnotation(point);
    this.dragState = { mode: 'draw', annotation };
    this.render(annotation);
  }

  protected onCanvasPointerMove(event: PointerEvent): void {
    if (!this.dragState) {
      return;
    }

    event.preventDefault();
    const dragState = this.dragState;
    if (dragState.mode === 'color') {
      this.updateColorFromPointer(dragState.target, event);
      return;
    }

    if (dragState.mode === 'pan') {
      this.pan = {
        x: dragState.startPan.x + event.clientX - dragState.startClient.x,
        y: dragState.startPan.y + event.clientY - dragState.startClient.y,
      };
      return;
    }

    const point = this.canvasPoint(event);
    if (dragState.mode === 'draw') {
      this.updateDraftAnnotation(dragState.annotation, point, event.shiftKey);
      this.render(dragState.annotation);
      return;
    }

    if (dragState.mode === 'erase') {
      this.eraseAt(point, dragState.erasedIds);
      return;
    }

    if (dragState.mode === 'resize') {
      this.annotations = this.annotations.map((annotation) => (
        annotation.id === dragState.annotationId
          ? this.resizeAnnotation(dragState.original, dragState.originalBounds, dragState.handle, point, event.shiftKey)
          : annotation
      ));
      this.render();
      return;
    }

    const dx = point.x - dragState.start.x;
    const dy = point.y - dragState.start.y;
    this.annotations = this.annotations.map((annotation) => (
      annotation.id === dragState.annotationId
        ? this.moveAnnotation(dragState.original, dx, dy)
        : annotation
    ));
    this.render();
  }

  protected onCanvasPointerUp(event: PointerEvent): void {
    if (!this.dragState) {
      return;
    }

    event.preventDefault();
    if (this.dragState.mode !== 'color') {
      this.canvasRef?.nativeElement.releasePointerCapture?.(event.pointerId);
    }
    if (this.dragState.mode === 'draw') {
      this.commitAnnotation(this.dragState.annotation);
    } else if (this.dragState.mode === 'color') {
      // Color changes are applied live.
    } else if (this.dragState.mode === 'erase') {
      if (this.dragState.erasedIds.size === 0) {
        this.historyStack.pop();
      }
    } else {
      this.render();
    }
    this.dragState = null;
  }

  protected onEditorWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.setZoom(this.zoom + (event.deltaY < 0 ? 0.25 : -0.25));
  }

  protected requestSave(): void {
    this.saveChoicesOpen = true;
  }

  protected async saveImage(mode: ImageEditorSaveMode): Promise<void> {
    this.saveChoicesOpen = false;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      this.errorMessage = 'Could not export edited image.';
      return;
    }

    this.save.emit({
      mode,
      blob,
      name: this.editedFileName(this.media.name),
      mimeType: 'image/png',
    });
  }

  @HostListener('window:keydown', ['$event'])
  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isTextEditingTarget(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      (event.target as HTMLElement).blur();
      return;
    }

    if (event.code === 'Space' && !this.isTextEditingTarget(event.target)) {
      event.preventDefault();
      this.spacePressed = true;
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !this.isTextEditingTarget(event.target)) {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && !this.isTextEditingTarget(event.target)) {
      event.preventDefault();
      this.deleteSelected();
      return;
    }

    if (event.key.toLowerCase() === 'e' && !this.isTextEditingTarget(event.target)) {
      event.preventDefault();
      this.selectTool('eraser');
      return;
    }

    if (event.key === 'Enter' && this.selectedAnnotationId && !this.isTextEditingTarget(event.target)) {
      event.preventDefault();
      this.selectedAnnotationId = null;
      this.freshAnnotationId = null;
      this.render();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.saveChoicesOpen = false;
      this.colorPickerOpen = false;
      if (this.selectedAnnotationId && this.selectedAnnotationId === this.freshAnnotationId) {
        this.annotations = this.annotations.filter((annotation) => annotation.id !== this.selectedAnnotationId);
        this.selectedAnnotationId = null;
        this.freshAnnotationId = null;
        this.render();
        return;
      }

      if (this.selectedAnnotationId) {
        this.selectedAnnotationId = null;
        this.freshAnnotationId = null;
        this.render();
      }
    }
  }

  @HostListener('window:keyup', ['$event'])
  protected onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      this.spacePressed = false;
    }
  }

  private resetEditor(): void {
    this.annotations = [];
    this.historyStack = [];
    this.redoStack = [];
    this.dragState = null;
    this.selectedAnnotationId = null;
    this.freshAnnotationId = null;
    this.saveChoicesOpen = false;
    this.isLoading = true;
    this.errorMessage = '';
    this.image = null;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
  }

  private loadImage(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.media) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth || image.width || CANVAS_FALLBACK_SIZE;
      canvas.height = image.naturalHeight || image.height || CANVAS_FALLBACK_SIZE;
      this.image = image;
      this.isLoading = false;
      this.render();
    };
    image.onerror = () => {
      canvas.width = CANVAS_FALLBACK_SIZE;
      canvas.height = CANVAS_FALLBACK_SIZE;
      this.image = null;
      this.isLoading = false;
      this.errorMessage = 'Could not load this image.';
      this.render();
    };
    image.src = this.media.url;
  }

  private render(draft?: Annotation): void {
    const canvas = this.canvasRef?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (this.image) {
      context.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    } else {
      context.fillStyle = '#1f1f24';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (const annotation of this.annotations) {
      this.drawAnnotation(context, annotation, annotation.id === this.selectedAnnotationId);
    }
    if (draft) {
      this.drawAnnotation(context, draft, false);
    }
  }

  private drawAnnotation(context: CanvasRenderingContext2D, annotation: Annotation, selected: boolean): void {
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = annotation.color;
    context.fillStyle = annotation.color;
    context.lineWidth = annotation.strokeWidth;

    if (annotation.type === 'pen') {
      this.drawPen(context, annotation);
    } else if (annotation.type === 'text') {
      context.font = `${annotation.fontSize}px sans-serif`;
      context.textBaseline = 'top';
      context.fillText(annotation.text, annotation.position.x, annotation.position.y);
    } else if (annotation.type === 'callout') {
      this.drawCallout(context, annotation);
    } else {
      this.drawShape(context, annotation);
    }

    context.restore();
  }

  private drawPen(context: CanvasRenderingContext2D, annotation: PenAnnotation): void {
    if (annotation.points.length === 0) {
      return;
    }

    context.beginPath();
    context.moveTo(annotation.points[0].x, annotation.points[0].y);
    for (const point of annotation.points.slice(1)) {
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  }

  private drawShape(context: CanvasRenderingContext2D, annotation: ShapeAnnotation): void {
    const x = Math.min(annotation.start.x, annotation.end.x);
    const y = Math.min(annotation.start.y, annotation.end.y);
    const width = Math.abs(annotation.end.x - annotation.start.x);
    const height = Math.abs(annotation.end.y - annotation.start.y);

    if (annotation.type === 'rectangle') {
      context.strokeRect(x, y, width, height);
      return;
    }

    if (annotation.type === 'circle') {
      context.beginPath();
      context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      context.stroke();
      return;
    }

    context.beginPath();
    context.moveTo(annotation.start.x, annotation.start.y);
    context.lineTo(annotation.end.x, annotation.end.y);
    context.stroke();
    if (annotation.type === 'arrow') {
      this.drawArrowHead(context, annotation.start, annotation.end, annotation.strokeWidth);
    }
  }

  private drawArrowHead(context: CanvasRenderingContext2D, start: Point, end: Point, strokeWidth: number): void {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const size = Math.max(12, strokeWidth * 4);
    context.beginPath();
    context.moveTo(end.x, end.y);
    context.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
    context.moveTo(end.x, end.y);
    context.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6));
    context.stroke();
  }

  private drawCallout(context: CanvasRenderingContext2D, annotation: CalloutAnnotation): void {
    const target = annotation.target;
    const source = annotation.source;
    const sourceCenter = this.boundsCenter(source);
    const targetCenter = this.boundsCenter(target);
    const arrowStart = this.boundsOutlinePoint(target, annotation.shape, sourceCenter);
    const arrowEnd = this.boundsOutlinePoint(source, annotation.shape, targetCenter);

    context.save();
    context.strokeStyle = annotation.color;
    context.lineWidth = annotation.strokeWidth;
    context.setLineDash([8, 6]);
    this.strokeBoundsShape(context, source, annotation.shape);
    context.setLineDash([]);

    context.save();
    this.clipBoundsShape(context, target, annotation.shape);
    if (this.image) {
      context.drawImage(
        this.image,
        source.x,
        source.y,
        source.width,
        source.height,
        target.x,
        target.y,
        target.width,
        target.height,
      );
    }
    context.restore();

    this.strokeBoundsShape(context, target, annotation.shape);

    context.beginPath();
    context.moveTo(arrowStart.x, arrowStart.y);
    context.lineTo(arrowEnd.x, arrowEnd.y);
    context.stroke();
    this.drawArrowHead(context, arrowStart, arrowEnd, annotation.strokeWidth);
    context.restore();
  }

  private strokeBoundsShape(context: CanvasRenderingContext2D, bounds: Bounds, shape: 'rectangle' | 'circle'): void {
    if (shape === 'rectangle') {
      context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      return;
    }

    context.beginPath();
    context.ellipse(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      bounds.width / 2,
      bounds.height / 2,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
  }

  private clipBoundsShape(context: CanvasRenderingContext2D, bounds: Bounds, shape: 'rectangle' | 'circle'): void {
    context.beginPath();
    if (shape === 'rectangle') {
      context.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    } else {
      context.ellipse(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
        bounds.width / 2,
        bounds.height / 2,
        0,
        0,
        Math.PI * 2,
      );
    }
    context.clip();
  }

  private createDraftAnnotation(point: Point): DraftAnnotation {
    if (this.tool === 'pen') {
      return {
        id: this.annotationId(),
        type: 'pen',
        points: [point],
        color: this.color,
        strokeWidth: this.strokeWidth,
        isDraft: true,
      };
    }

    if (this.tool === 'callout-rectangle' || this.tool === 'callout-circle') {
      return {
        id: this.annotationId(),
        type: 'callout',
        shape: this.tool === 'callout-circle' ? 'circle' : 'rectangle',
        source: { x: point.x, y: point.y, width: 1, height: 1 },
        target: { x: point.x + 36, y: point.y + 36, width: 2, height: 2 },
        zoom: 2,
        color: this.color,
        strokeWidth: this.strokeWidth,
        sourceTransform: {
          version: 1,
          sourceImageId: this.media.id,
        },
        isDraft: true,
        draftStart: point,
      };
    }

    return {
      id: this.annotationId(),
      type: this.tool,
      start: point,
      end: point,
      color: this.color,
      strokeWidth: this.strokeWidth,
      isDraft: true,
    } as DraftAnnotation;
  }

  private updateDraftAnnotation(annotation: DraftAnnotation, point: Point, lockAspect = false): void {
    if (annotation.type === 'pen') {
      annotation.points = [...annotation.points, point];
      return;
    }

    if (annotation.type === 'callout') {
      const start = annotation.draftStart ?? { x: annotation.source.x, y: annotation.source.y };
      annotation.source = this.boundsFromDrag(start, point, lockAspect ? 1 : undefined);
      annotation.zoom = 2;
      annotation.target = {
        x: annotation.source.x + annotation.source.width + 28,
        y: annotation.source.y,
        width: annotation.source.width * annotation.zoom,
        height: annotation.source.height * annotation.zoom,
      };
      return;
    }

    if (annotation.type === 'line' || annotation.type === 'arrow') {
      annotation.end = lockAspect ? this.lockLinePoint(annotation.start, point) : point;
      return;
    }

    if (annotation.type !== 'text') {
      annotation.end = lockAspect && (annotation.type === 'rectangle' || annotation.type === 'circle')
        ? this.lockPointToAspect(annotation.start, point, 1)
        : point;
    }
  }

  private commitAnnotation(annotation: Annotation): void {
    this.rememberHistory();
    this.annotations = [...this.annotations, this.cloneAnnotation(annotation)];
    this.selectedAnnotationId = annotation.id;
    this.freshAnnotationId = annotation.id;
    this.syncControlsFromAnnotation(annotation);
    this.render();
  }

  private canvasPoint(event: PointerEvent): Point {
    const canvas = this.canvasRef!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  private screenPointStyle(point: Point): Record<string, string> {
    const canvas = this.canvasRef?.nativeElement;
    const stage = this.stageRef?.nativeElement;
    if (!canvas || !stage) {
      return {};
    }

    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      left: `${canvasRect.left - stageRect.left + (point.x / Math.max(1, canvas.width)) * canvasRect.width}px`,
      top: `${canvasRect.top - stageRect.top + (point.y / Math.max(1, canvas.height)) * canvasRect.height}px`,
    };
  }

  private screenBoundsStyle(bounds: Bounds): Record<string, string> {
    const canvas = this.canvasRef?.nativeElement;
    const stage = this.stageRef?.nativeElement;
    if (!canvas || !stage) {
      return {};
    }

    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const scaleX = canvasRect.width / Math.max(1, canvas.width);
    const scaleY = canvasRect.height / Math.max(1, canvas.height);
    return {
      left: `${canvasRect.left - stageRect.left + bounds.x * scaleX}px`,
      top: `${canvasRect.top - stageRect.top + bounds.y * scaleY}px`,
      width: `${bounds.width * scaleX}px`,
      height: `${bounds.height * scaleY}px`,
    };
  }

  private screenLength(length: number): number {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return length;
    }

    const canvasRect = canvas.getBoundingClientRect();
    return length * (canvasRect.height / Math.max(1, canvas.height));
  }

  private eraseAt(point: Point, erasedIds: Set<string>): void {
    const annotation = this.findAnnotationAt(point);
    if (!annotation || erasedIds.has(annotation.id)) {
      return;
    }

    erasedIds.add(annotation.id);
    this.annotations = this.annotations.filter((item) => item.id !== annotation.id);
    if (this.selectedAnnotationId === annotation.id) {
      this.selectedAnnotationId = null;
      this.freshAnnotationId = null;
    }
    this.render();
  }

  private selectedAnnotation(): Annotation | undefined {
    return this.selectedAnnotationId
      ? this.annotations.find((annotation) => annotation.id === this.selectedAnnotationId)
      : undefined;
  }

  private syncControlsFromAnnotation(annotation: Annotation | undefined): void {
    if (!annotation) {
      return;
    }

    this.strokeWidth = annotation.strokeWidth;
    if (annotation.type === 'text') {
      this.textValue = annotation.text;
      this.fontSize = annotation.fontSize;
    }
  }

  private findSelectedHandleAt(point: Point): ResizeHandle | undefined {
    const selected = this.selectedAnnotation();
    if (selected?.type === 'line' || selected?.type === 'arrow') {
      const endpoints: Array<{ handle: ResizeHandle; point: Point }> = [
        { handle: 'nw', point: selected.start },
        { handle: 'se', point: selected.end },
      ];
      return endpoints.find((endpoint) => (
        Math.abs(point.x - endpoint.point.x) <= HANDLE_HIT_SIZE / 2 &&
        Math.abs(point.y - endpoint.point.y) <= HANDLE_HIT_SIZE / 2
      ))?.handle;
    }

    const box = this.selectedBounds();
    if (!box) {
      return undefined;
    }

    return this.resizeHandles().find((handle) => {
      const handlePoint = this.handlePoint(box, handle);
      return (
        Math.abs(point.x - handlePoint.x) <= HANDLE_HIT_SIZE / 2 &&
        Math.abs(point.y - handlePoint.y) <= HANDLE_HIT_SIZE / 2
      );
    });
  }

  private findAnnotationAt(point: Point): Annotation | undefined {
    return [...this.annotations].reverse().find((annotation) => {
      return this.annotationHitTest(annotation, point, 12);
    });
  }

  private annotationHitTest(annotation: Annotation, point: Point, padding: number): boolean {
    const box = this.annotationBounds(annotation);
    return (
      point.x >= box.x - padding &&
      point.x <= box.x + box.width + padding &&
      point.y >= box.y - padding &&
      point.y <= box.y + box.height + padding
    );
  }

  private annotationBounds(annotation: Annotation): { x: number; y: number; width: number; height: number } {
    if (annotation.type === 'pen') {
      const xs = annotation.points.map((point) => point.x);
      const ys = annotation.points.map((point) => point.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    }

    if (annotation.type === 'text') {
      return {
        x: annotation.position.x,
        y: annotation.position.y,
        width: Math.max(annotation.text.length * annotation.fontSize * 0.56, annotation.fontSize),
        height: annotation.fontSize,
      };
    }

    if (annotation.type === 'callout') {
      return {
        x: annotation.target.x,
        y: annotation.target.y,
        width: annotation.target.width,
        height: annotation.target.height,
      };
    }

    const x = Math.min(annotation.start.x, annotation.end.x);
    const y = Math.min(annotation.start.y, annotation.end.y);
    return {
      x,
      y,
      width: Math.abs(annotation.end.x - annotation.start.x),
      height: Math.abs(annotation.end.y - annotation.start.y),
    };
  }

  private resizeAnnotation(
    annotation: Annotation,
    originalBounds: Bounds,
    handle: ResizeHandle,
    point: Point,
    lockAspect = false,
  ): Annotation {
    if (annotation.type === 'line' || annotation.type === 'arrow') {
      return {
        ...annotation,
        start: handle === 'nw' ? (lockAspect ? this.lockLinePoint(annotation.end, point) : point) : annotation.start,
        end: handle === 'se' ? (lockAspect ? this.lockLinePoint(annotation.start, point) : point) : annotation.end,
      };
    }

    if (annotation.type === 'callout') {
      const nextTarget = this.resizedBounds(annotation.target, handle, point, lockAspect ? this.boundsAspect(originalBounds) : undefined);
      return {
        ...annotation,
        target: nextTarget,
        zoom: annotation.source.width > 0 ? nextTarget.width / annotation.source.width : annotation.zoom,
      };
    }

    const shouldLockAspect = lockAspect && (annotation.type === 'rectangle' || annotation.type === 'circle');
    const nextBounds = this.resizedBounds(originalBounds, handle, point, shouldLockAspect ? this.boundsAspect(originalBounds) : undefined);
    const sx = originalBounds.width === 0 ? 1 : nextBounds.width / originalBounds.width;
    const sy = originalBounds.height === 0 ? 1 : nextBounds.height / originalBounds.height;
    const scalePoint = (source: Point): Point => ({
      x: nextBounds.x + (source.x - originalBounds.x) * sx,
      y: nextBounds.y + (source.y - originalBounds.y) * sy,
    });

    if (annotation.type === 'pen') {
      return {
        ...annotation,
        points: annotation.points.map(scalePoint),
      };
    }

    if (annotation.type === 'text') {
      return {
        ...annotation,
        position: { x: nextBounds.x, y: nextBounds.y },
        fontSize: Math.max(8, annotation.fontSize * Math.max(sx, sy)),
      };
    }

    return {
      ...annotation,
      start: scalePoint(annotation.start),
      end: scalePoint(annotation.end),
    };
  }

  private resizedBounds(bounds: Bounds, handle: ResizeHandle, point: Point, aspectRatio?: number): Bounds {
    let left = bounds.x;
    let right = bounds.x + bounds.width;
    let top = bounds.y;
    let bottom = bounds.y + bounds.height;

    if (handle.includes('w')) {
      left = point.x;
    }
    if (handle.includes('e')) {
      right = point.x;
    }
    if (handle.includes('n')) {
      top = point.y;
    }
    if (handle.includes('s')) {
      bottom = point.y;
    }

    if (aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0) {
      return this.lockBoundsToAspect({ left, right, top, bottom }, handle, aspectRatio);
    }

    return {
      x: Math.min(left, right),
      y: Math.min(top, bottom),
      width: Math.max(1, Math.abs(right - left)),
      height: Math.max(1, Math.abs(bottom - top)),
    };
  }

  private moveAnnotation(annotation: Annotation, dx: number, dy: number): Annotation {
    if (annotation.type === 'pen') {
      return {
        ...annotation,
        points: annotation.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      };
    }

    if (annotation.type === 'text') {
      return {
        ...annotation,
        position: { x: annotation.position.x + dx, y: annotation.position.y + dy },
      };
    }

    if (annotation.type === 'callout') {
      return {
        ...annotation,
        target: {
          x: annotation.target.x + dx,
          y: annotation.target.y + dy,
          width: annotation.target.width,
          height: annotation.target.height,
        },
      };
    }

    return {
      ...annotation,
      start: { x: annotation.start.x + dx, y: annotation.start.y + dy },
      end: { x: annotation.end.x + dx, y: annotation.end.y + dy },
    };
  }

  private cloneAnnotations(annotations: Annotation[]): Annotation[] {
    return annotations.map((annotation) => this.cloneAnnotation(annotation));
  }

  private cloneAnnotation(annotation: Annotation): Annotation {
    if (annotation.type === 'pen') {
      return { ...annotation, points: annotation.points.map((point) => ({ ...point })) };
    }

    if (annotation.type === 'text') {
      return { ...annotation, position: { ...annotation.position } };
    }

    if (annotation.type === 'callout') {
      return {
        ...annotation,
        source: { ...annotation.source },
        target: { ...annotation.target },
        sourceTransform: annotation.sourceTransform ? { ...annotation.sourceTransform } : undefined,
      };
    }

    return { ...annotation, start: { ...annotation.start }, end: { ...annotation.end } };
  }

  private boundsCenter(bounds: Bounds): Point {
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }

  private boundsAspect(bounds: Bounds): number {
    return bounds.width / Math.max(1, bounds.height);
  }

  private boundsFromDrag(start: Point, point: Point, aspectRatio?: number): Bounds {
    if (aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0) {
      const lockedPoint = this.lockPointToAspect(start, point, aspectRatio);
      return {
        x: Math.min(start.x, lockedPoint.x),
        y: Math.min(start.y, lockedPoint.y),
        width: Math.max(1, Math.abs(lockedPoint.x - start.x)),
        height: Math.max(1, Math.abs(lockedPoint.y - start.y)),
      };
    }

    return {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.max(1, Math.abs(point.x - start.x)),
      height: Math.max(1, Math.abs(point.y - start.y)),
    };
  }

  private lockPointToAspect(start: Point, point: Point, aspectRatio: number): Point {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    const signX = dx < 0 ? -1 : 1;
    const signY = dy < 0 ? -1 : 1;
    let width = Math.abs(dx);
    let height = Math.abs(dy);

    if (width / Math.max(1, height) > aspectRatio) {
      height = width / aspectRatio;
    } else {
      width = height * aspectRatio;
    }

    return {
      x: start.x + width * signX,
      y: start.y + height * signY,
    };
  }

  private lockLinePoint(start: Point, point: Point): Point {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    return Math.abs(dx) >= Math.abs(dy)
      ? { x: point.x, y: start.y }
      : { x: start.x, y: point.y };
  }

  private lockBoundsToAspect(
    edges: { left: number; right: number; top: number; bottom: number },
    handle: ResizeHandle,
    aspectRatio: number,
  ): Bounds {
    let { left, right, top, bottom } = edges;
    const fixedX = handle.includes('w') ? right : left;
    const fixedY = handle.includes('n') ? bottom : top;
    const movingX = handle.includes('w') ? left : right;
    const movingY = handle.includes('n') ? top : bottom;
    const dx = movingX - fixedX;
    const dy = movingY - fixedY;
    const signX = dx < 0 ? -1 : 1;
    const signY = dy < 0 ? -1 : 1;
    let width = Math.abs(dx);
    let height = Math.abs(dy);

    if (handle === 'n' || handle === 's') {
      width = height * aspectRatio;
    } else if (handle === 'e' || handle === 'w') {
      height = width / aspectRatio;
    } else if (width / Math.max(1, height) > aspectRatio) {
      height = width / aspectRatio;
    } else {
      width = height * aspectRatio;
    }

    const nextMovingX = fixedX + width * signX;
    const nextMovingY = fixedY + height * signY;
    left = Math.min(fixedX, nextMovingX);
    right = Math.max(fixedX, nextMovingX);
    top = Math.min(fixedY, nextMovingY);
    bottom = Math.max(fixedY, nextMovingY);

    return {
      x: left,
      y: top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };
  }

  private boundsOutlinePoint(bounds: Bounds, shape: 'rectangle' | 'circle', toward: Point): Point {
    const center = this.boundsCenter(bounds);
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      return center;
    }

    const halfWidth = bounds.width / 2;
    const halfHeight = bounds.height / 2;
    if (shape === 'rectangle') {
      const scaleX = halfWidth / Math.max(0.001, Math.abs(dx));
      const scaleY = halfHeight / Math.max(0.001, Math.abs(dy));
      const scale = Math.min(scaleX, scaleY);
      return {
        x: center.x + dx * scale,
        y: center.y + dy * scale,
      };
    }

    const radiusX = Math.max(0.001, halfWidth);
    const radiusY = Math.max(0.001, halfHeight);
    const scale = 1 / Math.sqrt((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY));
    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale,
    };
  }

  private rememberHistory(): void {
    this.historyStack.push(this.cloneAnnotations(this.annotations));
    this.redoStack = [];
  }

  private updateCurrentColor(applyToSelection = false): void {
    this.color = this.hsvToRgba(this.hue, this.saturation, this.value, this.colorAlpha);
    if (applyToSelection) {
      this.applyColorToSelected();
    }
  }

  private applyColorToSelected(): void {
    const selectedId = this.selectedAnnotationId;
    if (!selectedId) {
      return;
    }

    this.rememberHistory();
    this.annotations = this.annotations.map((annotation) => (
      annotation.id === selectedId ? { ...annotation, color: this.color } : annotation
    ));
    this.render();
  }

  private updateColorFromPointer(target: 'sv' | 'hue' | 'alpha', event: PointerEvent): void {
    if (!(event.currentTarget instanceof HTMLElement)) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = this.clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const y = this.clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    if (target === 'sv') {
      this.saturation = x * 100;
      this.value = (1 - y) * 100;
    } else if (target === 'hue') {
      this.hue = x * 360;
    } else {
      this.colorAlpha = x;
    }
    this.updateCurrentColor(true);
  }

  private hsvToRgba(hue: number, saturation: number, value: number, alpha: number): string {
    const h = ((hue % 360) + 360) % 360;
    const s = saturation / 100;
    const v = value / 100;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    const [r1, g1, b1] = h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private hexToHsv(hex: string): { h: number; s: number; v: number } {
    const normalized = hex.replace('#', '');
    const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
    const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
    const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const h = delta === 0
      ? 0
      : max === r
        ? 60 * (((g - b) / delta) % 6)
        : max === g
          ? 60 * ((b - r) / delta + 2)
          : 60 * ((r - g) / delta + 4);
    return {
      h: (h + 360) % 360,
      s: max === 0 ? 0 : (delta / max) * 100,
      v: max * 100,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private handlePoint(bounds: Bounds, handle: ResizeHandle): Point {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    const x = handle.includes('w') ? bounds.x : handle.includes('e') ? right : centerX;
    const y = handle.includes('n') ? bounds.y : handle.includes('s') ? bottom : centerY;
    return { x, y };
  }

  private resizeHandles(): ResizeHandle[] {
    return this.resizeHandleOptions;
  }

  private setZoom(value: number): void {
    const nextZoom = Math.max(0.5, Math.min(5, value));
    this.zoom = nextZoom;
    if (nextZoom === 1) {
      this.pan = { x: 0, y: 0 };
    }
  }

  private shouldPan(event: PointerEvent): boolean {
    return this.zoom > 1 && (this.tool === 'pan' || this.spacePressed || event.button === 1);
  }

  private isTextEditingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
  }

  private annotationId(): string {
    return `annotation:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  }

  private editedFileName(name: string): string {
    const baseName = name.replace(/\.[^.]+$/, '');
    return `${baseName || 'image'}-edited.png`;
  }
}

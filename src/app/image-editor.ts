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

type EditorTool = 'select' | 'pen' | 'arrow' | 'rectangle' | 'circle' | 'line' | 'text';

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

type Annotation = PenAnnotation | ShapeAnnotation | TextAnnotation;

type DraftAnnotation = Annotation & {
  isDraft?: true;
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
    };

const DEFAULT_COLORS = ['#f14c4c', '#e5a50a', '#3fb950', '#56b4e9', '#ffffff', '#111111'];
const CANVAS_FALLBACK_SIZE = 960;

@Component({
  selector: 'app-image-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './image-editor.html',
  styleUrl: './image-editor.scss',
})
export class ImageEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) media!: ImageEditorMedia;
  @Output() readonly cancel = new EventEmitter<void>();
  @Output() readonly save = new EventEmitter<ImageEditorSave>();

  @ViewChild('canvas') private readonly canvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly colors = DEFAULT_COLORS;
  protected tool: EditorTool = 'pen';
  protected color = DEFAULT_COLORS[0];
  protected strokeWidth = 4;
  protected fontSize = 32;
  protected textValue = 'Text';
  protected selectedAnnotationId: string | null = null;
  protected saveChoicesOpen = false;
  protected isLoading = true;
  protected errorMessage = '';

  private image: HTMLImageElement | null = null;
  private annotations: Annotation[] = [];
  private redoStack: Annotation[][] = [];
  private dragState: DragState | null = null;
  private canvasReady = false;

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
    if (tool !== 'select') {
      this.selectedAnnotationId = null;
    }
    this.saveChoicesOpen = false;
  }

  protected setColor(color: string): void {
    this.color = color;
  }

  protected canUndo(): boolean {
    return this.annotations.length > 0;
  }

  protected canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  protected undo(): void {
    if (!this.canUndo()) {
      return;
    }

    this.redoStack.push(this.cloneAnnotations(this.annotations));
    this.annotations = this.annotations.slice(0, -1);
    this.selectedAnnotationId = null;
    this.render();
  }

  protected redo(): void {
    const next = this.redoStack.pop();
    if (!next) {
      return;
    }

    this.annotations = next;
    this.selectedAnnotationId = null;
    this.render();
  }

  protected clear(): void {
    if (this.annotations.length === 0) {
      return;
    }

    this.redoStack.push(this.cloneAnnotations(this.annotations));
    this.annotations = [];
    this.selectedAnnotationId = null;
    this.render();
  }

  protected deleteSelected(): void {
    if (!this.selectedAnnotationId) {
      return;
    }

    this.redoStack.push(this.cloneAnnotations(this.annotations));
    this.annotations = this.annotations.filter((annotation) => annotation.id !== this.selectedAnnotationId);
    this.selectedAnnotationId = null;
    this.render();
  }

  protected onCanvasPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.isLoading) {
      return;
    }

    event.preventDefault();
    const point = this.canvasPoint(event);
    this.saveChoicesOpen = false;
    this.canvasRef?.nativeElement.setPointerCapture?.(event.pointerId);

    if (this.tool === 'select') {
      const annotation = this.findAnnotationAt(point);
      this.selectedAnnotationId = annotation?.id ?? null;
      this.dragState = annotation
        ? {
            mode: 'move',
            annotationId: annotation.id,
            start: point,
            original: this.cloneAnnotation(annotation),
          }
        : null;
      this.render();
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
    const point = this.canvasPoint(event);
    if (dragState.mode === 'draw') {
      this.updateDraftAnnotation(dragState.annotation, point);
      this.render(dragState.annotation);
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
    this.canvasRef?.nativeElement.releasePointerCapture?.(event.pointerId);
    if (this.dragState.mode === 'draw') {
      this.commitAnnotation(this.dragState.annotation);
    } else {
      this.redoStack = [];
      this.render();
    }
    this.dragState = null;
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
    if ((event.target as HTMLElement | null)?.closest?.('.image-editor')) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel.emit();
    }
  }

  private resetEditor(): void {
    this.annotations = [];
    this.redoStack = [];
    this.dragState = null;
    this.selectedAnnotationId = null;
    this.saveChoicesOpen = false;
    this.isLoading = true;
    this.errorMessage = '';
    this.image = null;
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
    } else {
      this.drawShape(context, annotation);
    }

    if (selected) {
      const box = this.annotationBounds(annotation);
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.setLineDash([8, 6]);
      context.strokeRect(box.x - 6, box.y - 6, box.width + 12, box.height + 12);
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

  private updateDraftAnnotation(annotation: DraftAnnotation, point: Point): void {
    if (annotation.type === 'pen') {
      annotation.points = [...annotation.points, point];
      return;
    }

    if (annotation.type !== 'text') {
      annotation.end = point;
    }
  }

  private commitAnnotation(annotation: Annotation): void {
    this.annotations = [...this.annotations, this.cloneAnnotation(annotation)];
    this.redoStack = [];
    this.selectedAnnotationId = annotation.id;
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

  private findAnnotationAt(point: Point): Annotation | undefined {
    return [...this.annotations].reverse().find((annotation) => {
      const box = this.annotationBounds(annotation);
      return (
        point.x >= box.x - 12 &&
        point.x <= box.x + box.width + 12 &&
        point.y >= box.y - 12 &&
        point.y <= box.y + box.height + 12
      );
    });
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

    const x = Math.min(annotation.start.x, annotation.end.x);
    const y = Math.min(annotation.start.y, annotation.end.y);
    return {
      x,
      y,
      width: Math.abs(annotation.end.x - annotation.start.x),
      height: Math.abs(annotation.end.y - annotation.start.y),
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

    return { ...annotation, start: { ...annotation.start }, end: { ...annotation.end } };
  }

  private annotationId(): string {
    return `annotation:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  }

  private editedFileName(name: string): string {
    const baseName = name.replace(/\.[^.]+$/, '');
    return `${baseName || 'image'}-edited.png`;
  }
}

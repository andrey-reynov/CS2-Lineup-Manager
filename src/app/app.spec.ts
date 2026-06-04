import { TestBed } from '@angular/core/testing';
import { App } from './app';

function pointerEvent(type: string, init: PointerEventInit): PointerEvent {
  if (typeof PointerEvent !== 'undefined') {
    return new PointerEvent(type, { bubbles: true, ...init });
  }

  const event = new MouseEvent(type, { bubbles: true, clientX: init.clientX, clientY: init.clientY }) as PointerEvent;
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  return event;
}

function setBoardRect(board: Element): void {
  Object.defineProperty(board, 'getBoundingClientRect', {
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
}

async function createLineup(fixture: ReturnType<typeof TestBed.createComponent<App>>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  const compiled = fixture.nativeElement as HTMLElement;
  (compiled.querySelector('.map-button') as HTMLButtonElement).click();
  fixture.detectChanges();
  const board = compiled.querySelector('.map-board') as HTMLElement;
  setBoardRect(board);

  board.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 50, clientY: 50 }));
  fixture.detectChanges();
  (compiled.querySelector('.map-point') as HTMLButtonElement).click();
  fixture.detectChanges();
  (compiled.querySelector('.point-action-grid button') as HTMLButtonElement).click();
  fixture.detectChanges();
  await fixture.whenStable();

  return compiled;
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the app shell', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('CS2 Nades');
    expect(compiled.querySelector('.empty-board')?.textContent).toContain('Choose a map');
    expect(compiled.querySelector('.map-button.is-active')).toBeFalsy();
    expect(compiled.querySelectorAll('.map-point')).toHaveLength(0);
  });

  it('should show the selected map workspace', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('.map-button.is-active')?.textContent).toContain('Dust2');
    expect(compiled.querySelector('.map-button.is-active')?.textContent).toContain('0 lineups');
    expect(compiled.querySelector('.map-image')).toBeTruthy();
    expect(compiled.querySelector('.right-controls')).toBeTruthy();
  });

  it('should open new lineups in edit mode and save to view mode', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    compiled.querySelector('.map-board')?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
    fixture.detectChanges();
    (compiled.querySelector('.map-point') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('.point-action-grid button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('.point-details input')).toBeTruthy();
    expect(compiled.querySelector('.point-details-header')?.textContent).toContain('Edit lineup');
    expect(compiled.querySelector('.point-details-header')?.textContent).not.toContain('Smoke 1');

    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('.lineup-title')?.textContent).toContain('Untitled lineup');
    expect(compiled.querySelector('.edit-button')).toBeTruthy();
    expect(compiled.querySelector('.point-details input')).toBeFalsy();
  });

  it('should open saved marker clicks in view mode', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    compiled.querySelector('.map-board')?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
    fixture.detectChanges();
    (compiled.querySelector('.map-point') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('.point-action-grid button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('.point-details-header button') as HTMLButtonElement).click();
    fixture.detectChanges();

    (compiled.querySelector('.map-point') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.lineup-title')?.textContent).toContain('Untitled lineup');
    expect(compiled.querySelector('.point-action-menu')).toBeFalsy();
  });

  it('should show a selected lineup trajectory and hide it when no lineup is selected', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const board = compiled.querySelector('.map-board') as HTMLElement;
    const point = compiled.querySelector('.map-point') as HTMLButtonElement;

    point.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 50, clientY: 50 }));
    board.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 20, clientY: 20 }));
    board.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 20, clientY: 20 }));
    fixture.detectChanges();

    expect(compiled.querySelector('.trajectory-line')).toBeTruthy();
    expect(compiled.querySelector('.trajectory-vertex.is-start')).toBeTruthy();

    (compiled.querySelector('.point-details-header button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.trajectory-line')).toBeFalsy();
  });

  it('should drag the final point with zoom and pan aware coordinates', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const board = compiled.querySelector('.map-board') as HTMLElement;
    const point = compiled.querySelector('.map-point') as HTMLButtonElement;

    app.mapZoom.set(2);
    app.mapPan.set({ x: 10, y: 10 });
    app.trajectoryEditMode.set('edit');
    point.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientX: 50, clientY: 50 }));
    board.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 70, clientY: 70 }));
    board.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 70, clientY: 70 }));
    fixture.detectChanges();

    expect(app.selectedPoint().x).toBe(30);
    expect(app.selectedPoint().y).toBe(30);
  });

  it('should persist screenshot role assignments in the selected point media pool', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const point = app.selectedPoint();
    const media = {
      id: `${point.id}:media:test`,
      name: 'start.png',
      type: 'image' as const,
      mimeType: 'image/png',
      blob: new Blob(['start'], { type: 'image/png' }),
      url: 'blob:start',
      role: 'detail' as const,
    };

    app.updateSelectedPoint({ media: [media] });
    app.assignMediaRole(media.id, 'start');
    fixture.detectChanges();

    expect(app.selectedPoint().media[0].role).toBe('start');
    expect(compiled.querySelector('.guide-slot img')).toBeTruthy();
  });
});

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
  const rect = {
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
  Object.defineProperty(board, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  });
  Object.defineProperty(board.querySelector('.map-surface') ?? board, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      ...rect,
      toJSON: () => ({}),
    }),
  });
}

function setSurfaceRect(board: Element, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): void {
  Object.defineProperty(board.querySelector('.map-surface') ?? board, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
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

  board.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 50, clientY: 50 }));
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
    expect(Array.from(compiled.querySelectorAll('.nav-button')).some((button) => button.textContent?.includes('Home'))).toBe(false);
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
    expect(compiled.querySelector('.map-button.is-active')?.textContent).toContain('CT: 0 lineups');
    expect(compiled.querySelector('.map-button.is-active')?.textContent).toContain('T: 0 lineups');
    expect(compiled.querySelector('.map-button.is-active')?.textContent).toContain('Smoke: 0');
    expect(compiled.querySelector('.map-button.is-active')?.textContent).toContain('Flash: 0');
    expect(compiled.querySelectorAll('.map-lineup-breakdown')).toHaveLength(1);
    expect(compiled.querySelectorAll('.map-nade-breakdown')).toHaveLength(1);
    expect(compiled.querySelectorAll('.map-nade-breakdown i')).toHaveLength(3);
    expect(compiled.querySelector('.map-image')).toBeTruthy();
    expect(compiled.querySelector('.map-bottom-rail')).toBeTruthy();
    expect(compiled.querySelector('.right-controls')).toBeFalsy();
  });

  it('should show every grenade category for the selected side when the All nade filter is active', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance as any;

    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    app.addedPoints.set({
      'dust2:main': [
        {
          id: 'ct-smoke',
          label: '1',
          mapId: 'dust2',
          levelId: 'main',
          x: 20,
          y: 20,
          kind: 'custom',
          grenadeCategoryId: 'smoke',
          teamSide: 'ct',
          trajectory: { vertices: [] },
        },
        {
          id: 'ct-flash',
          label: '2',
          mapId: 'dust2',
          levelId: 'main',
          x: 40,
          y: 40,
          kind: 'custom',
          grenadeCategoryId: 'flash',
          teamSide: 'ct',
          trajectory: { vertices: [] },
        },
        {
          id: 't-flash',
          label: '3',
          mapId: 'dust2',
          levelId: 'main',
          x: 60,
          y: 60,
          kind: 'custom',
          grenadeCategoryId: 'flash',
          teamSide: 't',
          trajectory: { vertices: [] },
        },
      ],
    });
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.map-point')).toHaveLength(1);

    (compiled.querySelector('.all-filter-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.all-filter-button')?.classList.contains('is-active')).toBe(true);
    expect(compiled.querySelectorAll('.map-point')).toHaveLength(2);
    expect(compiled.querySelector('.grenade-filter .all-filter-button')).toBeTruthy();

    (Array.from(compiled.querySelectorAll('.side-filter button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'T')
      ?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.all-filter-button')?.classList.contains('is-active')).toBe(true);
    expect(compiled.querySelectorAll('.map-point')).toHaveLength(1);
  });

  it('should zoom with normalized plus and minus buttons', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance as any;
    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const board = compiled.querySelector('.map-board') as HTMLElement;
    setBoardRect(board);

    const zoomButtons = compiled.querySelectorAll('.zoom-controls button') as NodeListOf<HTMLButtonElement>;
    zoomButtons[1].click();
    fixture.detectChanges();

    expect(app.mapZoom()).toBe(1.25);

    zoomButtons[0].click();
    fixture.detectChanges();

    expect(app.mapZoom()).toBe(1);
    expect(app.mapPan()).toEqual({ x: 0, y: 0 });
  });

  it('should hide menu scrollbar by default and reveal it from settings', async () => {
    localStorage.removeItem('cs2nades:show-menu-scrollbar');
    localStorage.removeItem('cs2nades:user-settings');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.map-buttons')?.classList.contains('show-scrollbar')).toBe(false);

    (compiled.querySelector('.sidebar-footer .nav-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const checkbox = compiled.querySelector('.settings-toggle input') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(compiled.querySelector('.map-buttons')?.classList.contains('show-scrollbar')).toBe(true);
    expect(localStorage.getItem('cs2nades:show-menu-scrollbar')).toBe('true');
    expect(JSON.parse(localStorage.getItem('cs2nades:user-settings') ?? '{}').showMenuScrollbar).toBe(true);
    localStorage.removeItem('cs2nades:show-menu-scrollbar');
    localStorage.removeItem('cs2nades:user-settings');
  });

  it('should resize panels individually and together from panel edges', async () => {
    localStorage.removeItem('cs2nades:user-settings');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const host = fixture.debugElement.nativeElement as HTMLElement;

    const leftEdge = compiled.querySelector('.sidebar .panel-resize-edge') as HTMLElement;
    leftEdge.dispatchEvent(pointerEvent('pointerdown', { pointerId: 11, clientX: 330, clientY: 10 }));
    window.dispatchEvent(pointerEvent('pointermove', { pointerId: 11, clientX: 380, clientY: 10 }));
    window.dispatchEvent(pointerEvent('pointerup', { pointerId: 11, clientX: 380, clientY: 10 }));
    fixture.detectChanges();

    expect((fixture.componentInstance as any).leftPanelWidth()).toBe(380);
    expect((fixture.componentInstance as any).rightPanelWidth()).toBe(330);
    expect(host.style.getPropertyValue('--left-panel-width')).toBe('380px');

    (compiled.querySelector('.sidebar-footer .nav-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const resizeTogether = Array.from(compiled.querySelectorAll('.settings-toggle input'))[1] as HTMLInputElement;
    resizeTogether.checked = true;
    resizeTogether.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    const settings = JSON.parse(localStorage.getItem('cs2nades:user-settings') ?? '{}');
    expect(settings.resizePanelsTogether).toBe(true);

    (fixture.componentInstance as any).startPanelResize('right', pointerEvent('pointerdown', { pointerId: 12, clientX: 400, clientY: 10 }));
    window.dispatchEvent(pointerEvent('pointermove', { pointerId: 12, clientX: 360, clientY: 10 }));
    window.dispatchEvent(pointerEvent('pointerup', { pointerId: 12, clientX: 360, clientY: 10 }));
    fixture.detectChanges();

    expect((fixture.componentInstance as any).leftPanelWidth()).toBe(370);
    expect((fixture.componentInstance as any).rightPanelWidth()).toBe(370);

    localStorage.removeItem('cs2nades:user-settings');
  });

  it('should apply accent and team color preferences', async () => {
    localStorage.removeItem('cs2nades:user-settings');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const host = fixture.debugElement.nativeElement as HTMLElement;

    (compiled.querySelector('.sidebar-footer .nav-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    (Array.from(compiled.querySelectorAll('.settings-swatch'))[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.style.getPropertyValue('--vscode-accent')).toBe('#2ea043');

    (Array.from(compiled.querySelectorAll('[aria-label="CT color"] .settings-swatch'))[0] as HTMLButtonElement).click();
    (Array.from(compiled.querySelectorAll('[aria-label="T color"] .settings-swatch'))[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('[aria-label="CT color"]')?.textContent?.trim()).toBe('CT');
    expect(compiled.querySelector('[aria-label="T color"]')?.textContent?.trim()).toBe('T');
    expect(host.style.getPropertyValue('--team-ct')).toBe('#56b4e9');
    expect(host.style.getPropertyValue('--team-t')).toBe('#d55e00');
    expect(host.style.getPropertyValue('--vscode-accent')).toBe('#2ea043');
    localStorage.removeItem('cs2nades:user-settings');
  });

  it('should create draft spots with double click instead of single click', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const board = compiled.querySelector('.map-board') as HTMLElement;
    setBoardRect(board);

    board.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
    fixture.detectChanges();
    expect(compiled.querySelector('.map-point')).toBeFalsy();

    board.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 10, clientY: 10 }));
    fixture.detectChanges();
    expect(compiled.querySelector('.map-point')).toBeTruthy();
    expect(compiled.querySelector('.point-action-menu')).toBeTruthy();
  });

  it('should open new lineups in edit mode and save to view mode', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const board = compiled.querySelector('.map-board') as HTMLElement;
    setBoardRect(board);
    board.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 10, clientY: 10 }));
    fixture.detectChanges();
    (compiled.querySelector('.point-action-grid button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('.point-details input')).toBeTruthy();
    expect(compiled.querySelector('.point-details-header')?.textContent).toContain('Untitled lineup');
    expect(compiled.querySelector('.point-details-header')?.textContent).not.toContain('Smoke 1');

    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('.point-details-header')?.textContent).toContain('Untitled lineup');
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

    const board = compiled.querySelector('.map-board') as HTMLElement;
    setBoardRect(board);
    board.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 10, clientY: 10 }));
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

    expect(compiled.querySelector('.point-details-header')?.textContent).toContain('Untitled lineup');
    expect(compiled.querySelector('.point-action-menu')).toBeFalsy();
  });

  it('should show a selected lineup trajectory and hide it when no lineup is selected', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const board = compiled.querySelector('.map-board') as HTMLElement;

    board.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 20, clientY: 20 }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(compiled.querySelector('.trajectory-line')).toBeTruthy();
    expect(compiled.querySelector('.trajectory-vertex.is-start')).toBeTruthy();

    (compiled.querySelector('.point-details-header button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.trajectory-line')).toBeFalsy();
  });

  it('should place the draft trajectory vertex with a map click', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const board = compiled.querySelector('.map-board') as HTMLElement;

    board.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 20, clientY: 20 }));
    fixture.detectChanges();

    expect(app.selectedPoint().trajectory.vertices).toHaveLength(1);
    expect(app.selectedPoint().trajectory.vertices[0].x).toBe(20);
    expect(app.selectedPoint().trajectory.vertices[0].y).toBe(20);
    expect(app.trajectoryEditMode()).toBe('edit');
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

  it('should zoom relative to the centered map surface instead of the full board', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const board = compiled.querySelector('.map-board') as HTMLElement;
    setBoardRect(board);
    setSurfaceRect(board, { left: 25, top: 0, width: 50, height: 50 });
    const app = fixture.componentInstance as any;

    board.dispatchEvent(new WheelEvent('wheel', { bubbles: true, clientX: 25, clientY: 25, deltaY: -120 }));
    fixture.detectChanges();

    expect(app.mapZoom()).toBeGreaterThan(1);
    expect(app.mapPan().x).toBe(0);
  });

  it('should pan the map while trajectory creation remains uncommitted', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const board = compiled.querySelector('.map-board') as HTMLElement;
    app.mapZoom.set(2);
    app.mapPan.set({ x: 0, y: 0 });
    fixture.detectChanges();

    board.dispatchEvent(pointerEvent('pointerdown', { pointerId: 7, clientX: 50, clientY: 50 }));
    board.dispatchEvent(pointerEvent('pointermove', { pointerId: 7, clientX: 70, clientY: 70 }));
    board.dispatchEvent(pointerEvent('pointerup', { pointerId: 7, clientX: 70, clientY: 70 }));
    fixture.detectChanges();

    expect(app.mapPan()).toEqual({ x: 20, y: 20 });
    expect(app.trajectoryEditMode()).toBe('create');
    expect(app.draftTrajectoryVertex()).toBeTruthy();
    expect(app.selectedPoint().trajectory.vertices).toEqual([]);
  });

  it('should keep a lineup selected when clicking its point in edit mode', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    app.trajectoryEditMode.set('edit');
    fixture.detectChanges();

    (compiled.querySelector('.map-point') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(app.selectedPoint()).toBeTruthy();
    expect(compiled.querySelector('.point-details')).toBeTruthy();
  });

  it('should not click away while editing a lineup', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const board = compiled.querySelector('.map-board') as HTMLElement;
    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('.edit-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    board.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 80, clientY: 80 }));
    fixture.detectChanges();

    expect(compiled.querySelector('.point-details input')).toBeTruthy();
  });

  it('should keep the selected lineup when clicking the bottom rail', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const rail = compiled.querySelector('.map-bottom-rail') as HTMLElement;
    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    rail.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 50, clientY: 95 }));
    fixture.detectChanges();

    expect(compiled.querySelector('.point-details')).toBeTruthy();
    expect(compiled.querySelector('.map-point')).toBeTruthy();
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

  it('should order start media first and result media last in galleries', async () => {
    const fixture = TestBed.createComponent(App);
    await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const point = app.selectedPoint();
    const media = ['detail-a', 'result', 'start', 'detail-b'].map((id) => ({
      id,
      name: `${id}.png`,
      type: 'image' as const,
      mimeType: 'image/png',
      blob: new Blob([id], { type: 'image/png' }),
      url: `blob:${id}`,
      role: id === 'start' ? 'start' as const : id === 'result' ? 'result' as const : 'detail' as const,
    }));

    app.updateSelectedPoint({ media });
    fixture.detectChanges();

    expect(app.orderedMedia(app.selectedPoint()).map((item: { id: string }) => item.id)).toEqual([
      'start',
      'detail-a',
      'detail-b',
      'result',
    ]);
  });

  it('should navigate fullscreen preview with arrow keys', async () => {
    const fixture = TestBed.createComponent(App);
    await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const media = ['one', 'two'].map((id) => ({
      id,
      name: `${id}.png`,
      type: 'image' as const,
      mimeType: 'image/png',
      blob: new Blob([id], { type: 'image/png' }),
      url: `blob:${id}`,
      role: 'detail' as const,
    }));

    app.updateSelectedPoint({ media });
    app.openMediaPreview(media[0]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();

    expect(app.previewMedia()?.id).toBe('two');
  });

  it('should select media in edit mode and delete it with the Delete key', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const media = ['one', 'two'].map((id) => ({
      id,
      name: `${id}.png`,
      type: 'image' as const,
      mimeType: 'image/png',
      blob: new Blob([id], { type: 'image/png' }),
      url: `blob:${id}`,
      role: 'detail' as const,
    }));

    app.updateSelectedPoint({ media });
    fixture.detectChanges();

    (compiled.querySelector('.media-preview-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(app.selectedMediaId()).toBe('one');
    expect(compiled.querySelector('.media-tile.is-selected')).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    fixture.detectChanges();

    expect(app.selectedPoint().media.map((item: { id: string }) => item.id)).toEqual(['two']);
    expect(app.selectedMediaId()).toBeNull();
  });

  it('should open fullscreen preview from edit media on double click', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const media = {
      id: 'one',
      name: 'one.png',
      type: 'image' as const,
      mimeType: 'image/png',
      blob: new Blob(['one'], { type: 'image/png' }),
      url: 'blob:one',
      role: 'detail' as const,
    };

    app.updateSelectedPoint({ media: [media] });
    fixture.detectChanges();

    (compiled.querySelector('.media-preview-button') as HTMLButtonElement).dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true }),
    );
    fixture.detectChanges();

    expect(app.previewMedia()?.id).toBe('one');
    expect(compiled.querySelector('.media-preview')).toBeTruthy();
  });

  it('should zoom fullscreen preview with the mouse wheel', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const media = {
      id: 'one',
      name: 'one.png',
      type: 'image' as const,
      mimeType: 'image/png',
      blob: new Blob(['one'], { type: 'image/png' }),
      url: 'blob:one',
      role: 'detail' as const,
    };

    app.updateSelectedPoint({ media: [media] });
    app.openMediaPreview(media);
    fixture.detectChanges();

    (compiled.querySelector('.media-preview-stage') as HTMLElement).dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, deltaY: -120 }),
    );
    fixture.detectChanges();

    expect(app.previewZoom()).toBeGreaterThan(1);
  });

  it('should select only one mouse throw option at a time', async () => {
    const fixture = TestBed.createComponent(App);
    await createLineup(fixture);
    const app = fixture.componentInstance as any;

    app.selectMouseRequirement('left-click');
    app.selectMouseRequirement('right-click');
    fixture.detectChanges();

    expect(app.selectedPoint().requirements).not.toContain('left-click');
    expect(app.selectedPoint().requirements).toContain('right-click');
  });
});

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

function setWindowWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function stubObjectUrls(): void {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => `blob:${blob.type || 'edited'}:${Date.now()}`,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => undefined,
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

  board.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
  fixture.detectChanges();
  (compiled.querySelector('.point-action-grid button') as HTMLButtonElement).click();
  fixture.detectChanges();
  await fixture.whenStable();

  return compiled;
}

describe('App', () => {
  beforeEach(async () => {
    setWindowWidth(1280);
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

  it('should close and reopen the navigation panel', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.sidebar-close-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.app-shell')?.classList.contains('is-sidebar-closed')).toBe(true);
    expect(compiled.querySelector('.sidebar-open-button')).toBeTruthy();

    (compiled.querySelector('.sidebar-open-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.app-shell')?.classList.contains('is-sidebar-closed')).toBe(false);
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

  it('should show every grenade category for the selected team filter when the All nade filter is active', async () => {
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
    expect(compiled.querySelectorAll('.map-point')).toHaveLength(3);
    expect(compiled.querySelector('.grenade-filter .all-filter-button')).toBeTruthy();
    expect(
      (Array.from(compiled.querySelectorAll('.side-filter button')) as HTMLButtonElement[])
        .find((button) => button.textContent?.trim() === 'Any')
        ?.classList.contains('is-active'),
    ).toBe(true);

    (Array.from(compiled.querySelectorAll('.side-filter button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'T')
      ?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.all-filter-button')?.classList.contains('is-active')).toBe(true);
    expect(compiled.querySelectorAll('.map-point')).toHaveLength(1);
  });

  it('should show playlist rail count and filter lineups by any selected playlist', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance as any;

    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    app.playlists.set([
      {
        id: 'playlist-a',
        title: 'A',
        description: '',
        thumbnailName: 'a.png',
        thumbnailMimeType: 'image/png',
        thumbnailBlob: new Blob(['a'], { type: 'image/png' }),
        thumbnailUrl: 'blob:a',
      },
      {
        id: 'playlist-b',
        title: 'B',
        description: '',
        thumbnailName: 'b.png',
        thumbnailMimeType: 'image/png',
        thumbnailBlob: new Blob(['b'], { type: 'image/png' }),
        thumbnailUrl: 'blob:b',
      },
    ]);
    app.playlistMemberships.set({
      'playlist-a': ['lineup-a'],
      'playlist-b': ['lineup-b'],
    });
    app.addedPoints.set({
      'dust2:main': [
        { id: 'lineup-a', label: '1', mapId: 'dust2', levelId: 'main', x: 20, y: 20, kind: 'custom', grenadeCategoryId: 'smoke', teamSide: 'ct', trajectory: { vertices: [] } },
        { id: 'lineup-b', label: '2', mapId: 'dust2', levelId: 'main', x: 40, y: 40, kind: 'custom', grenadeCategoryId: 'smoke', teamSide: 'ct', trajectory: { vertices: [] } },
        { id: 'lineup-c', label: '3', mapId: 'dust2', levelId: 'main', x: 60, y: 60, kind: 'custom', grenadeCategoryId: 'smoke', teamSide: 'ct', trajectory: { vertices: [] } },
      ],
    });
    app.selectedPlaylistIds.set(['playlist-a', 'playlist-b']);
    fixture.detectChanges();

    expect(compiled.querySelector('.playlist-rail-button')?.textContent).toContain('2');
    expect(compiled.querySelector('.playlist-rail-button')?.textContent).toContain('Playlists');
    expect(compiled.querySelector('.playlist-rail-button')?.classList.contains('is-active')).toBe(true);
    expect(compiled.querySelectorAll('.map-point')).toHaveLength(2);
  });

  it('should persist lineup playlist assignment when the dropdown closes', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    let savedLineupId = '';
    let savedPlaylistIds: string[] = [];

    app.playlists.set([{
      id: 'playlist-a',
      title: 'A',
      description: '',
      thumbnailName: 'a.png',
      thumbnailMimeType: 'image/png',
      thumbnailBlob: new Blob(['a'], { type: 'image/png' }),
      thumbnailUrl: 'blob:a',
    }]);
    app.storage.setLineupPlaylists = async (lineupId: string, playlistIds: string[]) => {
      savedLineupId = lineupId;
      savedPlaylistIds = playlistIds;
    };
    app.storage.loadPlaylistMemberships = async () => ({ 'playlist-a': [savedLineupId] });

    app.openPlaylistAssignment();
    app.togglePlaylistAssignment('playlist-a', true);
    await app.closePlaylistAssignment();
    fixture.detectChanges();

    expect(savedLineupId).toBe(app.selectedPointId());
    expect(savedPlaylistIds).toEqual(['playlist-a']);
    expect(app.playlistMemberships()).toEqual({ 'playlist-a': [savedLineupId] });
  });

  it('should save playlist member removals from the playlist panel', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const app = fixture.componentInstance as any;
    let savedPlaylistId = '';
    let savedLineupIds: string[] = ['lineup-a'];
    const playlist = {
      id: 'playlist-a',
      title: 'A',
      description: '',
      thumbnailName: 'a.png',
      thumbnailMimeType: 'image/png',
      thumbnailBlob: new Blob(['a'], { type: 'image/png' }),
      thumbnailUrl: 'blob:a',
    };

    app.playlists.set([playlist]);
    app.playlistMemberships.set({ 'playlist-a': ['lineup-a'] });
    app.storage.setPlaylistLineups = async (playlistId: string, lineupIds: string[]) => {
      savedPlaylistId = playlistId;
      savedLineupIds = lineupIds;
    };
    app.storage.loadPlaylistMemberships = async () => ({ 'playlist-a': savedLineupIds });

    app.openPlaylistDetail(playlist);
    app.toggleSelectedPlaylistLineup('lineup-a', false);
    await app.saveSelectedPlaylistLineups();

    expect(savedPlaylistId).toBe('playlist-a');
    expect(savedLineupIds).toEqual([]);
    expect(app.playlistMemberships()).toEqual({ 'playlist-a': [] });
  });

  it('should require confirmation and slug before deleting playlist content', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const app = fixture.componentInstance as any;
    let deletedPlaylistId = '';
    let deletedContent = false;
    const playlist = {
      id: 'playlist-a',
      title: 'Shrouds lineups from 2016',
      description: '',
      thumbnailName: 'a.png',
      thumbnailMimeType: 'image/png',
      thumbnailBlob: new Blob(['a'], { type: 'image/png' }),
      thumbnailUrl: 'blob:a',
    };

    app.playlists.set([playlist]);
    app.playlistMemberships.set({ 'playlist-a': ['lineup-a'] });
    app.addedPoints.set({
      'dust2:main': [
        { id: 'lineup-a', label: '1', mapId: 'dust2', levelId: 'main', x: 20, y: 20, kind: 'custom', grenadeCategoryId: 'smoke', teamSide: 'ct', trajectory: { vertices: [] } },
      ],
    });
    app.openPlaylistDetail(playlist);
    app.storage.deletePlaylist = async (playlistId: string, deleteContentToo: boolean) => {
      deletedPlaylistId = playlistId;
      deletedContent = deleteContentToo;
    };
    app.storage.loadPlaylistMemberships = async () => ({});

    app.requestPlaylistDelete(true);
    app.updatePlaylistDeleteAcknowledged(true);
    app.updatePlaylistDeleteSlug('wrong');
    expect(app.canConfirmPlaylistDelete()).toBe(false);

    app.updatePlaylistDeleteSlug('shrouds-lineups-from-2016');
    expect(app.canConfirmPlaylistDelete()).toBe(true);
    await app.confirmPlaylistDelete();
    expect(app.playlistDeleteConfirmation().secondStep).toBe(true);

    await app.confirmPlaylistDelete();

    expect(deletedPlaylistId).toBe('playlist-a');
    expect(deletedContent).toBe(true);
    expect(app.playlists()).toEqual([]);
    expect(app.addedPoints()['dust2:main']).toEqual([]);
  });

  it('should edit a playlist thumbnail through the image editor', async () => {
    stubObjectUrls();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const app = fixture.componentInstance as any;

    app.playlistDraft.set({
      id: 'playlist-a',
      title: 'A',
      description: '',
      thumbnailName: 'thumb.png',
      thumbnailMimeType: 'image/png',
      thumbnailBlob: new Blob(['original'], { type: 'image/png' }),
      thumbnailUrl: 'blob:original',
    });

    app.openPlaylistThumbnailImageEditor();
    expect(app.imageEditorMedia()?.name).toBe('thumb.png');

    await app.saveEditedImage({
      mode: 'replace',
      name: 'thumb-edited.png',
      mimeType: 'image/png',
      blob: new Blob(['edited'], { type: 'image/png' }),
    });

    expect(app.imageEditorMedia()).toBeUndefined();
    expect(app.playlistDraft().thumbnailName).toBe('thumb-edited.png');
    expect(await app.playlistDraft().thumbnailBlob.text()).toBe('edited');
  });

  it('should generate a playlist thumbnail from the title when no image is selected', async () => {
    stubObjectUrls();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const app = fixture.componentInstance as any;
    let savedPlaylist: any;

    app.storage.savePlaylist = async (playlist: any) => {
      savedPlaylist = playlist;
    };
    app.storage.loadPlaylists = async () => savedPlaylist ? [savedPlaylist] : [];
    app.storage.loadPlaylistMemberships = async () => ({});

    app.createPlaylist();
    app.updatePlaylistDraftTitle('Shrouds lineups from 2016');
    await app.savePlaylistDraft();

    expect(savedPlaylist.thumbnailName).toBe('shrouds-lineups-from-2016-thumbnail.svg');
    expect(savedPlaylist.thumbnailMimeType).toBe('image/svg+xml');
    const svg = await savedPlaylist.thumbnailBlob.text();
    expect(svg).not.toContain('Shrouds lineups from 2016');
    expect(svg).not.toContain('<text');
    expect(savedPlaylist.thumbnailUrl).toContain('blob:image/svg+xml:');
  });

  it('should preview the generated playlist thumbnail when the title loses focus', async () => {
    stubObjectUrls();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance as any;

    app.createPlaylist();
    fixture.detectChanges();
    const titleInput = compiled.querySelector('.playlist-panel input[type="text"]') as HTMLInputElement;
    titleInput.value = 'Oil Pop Smoke Pack';
    titleInput.dispatchEvent(new Event('input'));
    titleInput.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    const draft = app.playlistDraft();
    expect(draft.thumbnailAutoGenerated).toBe(true);
    expect(draft.thumbnailName).toBe('oil-pop-smoke-pack-thumbnail.svg');
    const svg = await draft.thumbnailBlob.text();
    expect(svg).not.toContain('Oil Pop Smoke Pack');
    expect(svg).not.toContain('<text');
    expect(compiled.querySelector('.playlist-thumbnail-upload img')).toBeFalsy();
  });

  it('should hide map zoom buttons from the bottom rail', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.map-bottom-rail .zoom-controls')).toBeFalsy();
    expect(Array.from(compiled.querySelectorAll('.side-filter button')).map((button) => button.textContent?.trim()))
      .toEqual(['Any', 'CT', 'T']);
  });

  it('should render compact bottom rail controls when the center workspace is narrow', async () => {
    setWindowWidth(560);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.map-bottom-rail')?.classList.contains('is-compact')).toBe(true);
    expect(compiled.querySelectorAll('.rail-compact-button')).toHaveLength(3);
    expect(compiled.querySelector('.side-filter')).toBeFalsy();
    expect(compiled.querySelector('.grenade-filter')).toBeFalsy();
  });

  it('should keep the bottom rail compact in a narrow viewport after the sidebar collapses', async () => {
    setWindowWidth(860);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.app-shell')?.classList.contains('is-sidebar-closed')).toBe(true);
    expect(compiled.querySelector('.map-bottom-rail')?.classList.contains('is-compact')).toBe(true);
    expect(compiled.querySelectorAll('.rail-compact-button')).toHaveLength(3);
  });

  it('should keep the bottom rail compact after closing nav when the right panel overlaps the full rail', async () => {
    setWindowWidth(1200);
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;

    app.closeSidebar();
    fixture.detectChanges();

    expect(compiled.querySelector('.app-shell')?.classList.contains('is-sidebar-closed')).toBe(true);
    expect(compiled.querySelector('.map-bottom-rail')?.classList.contains('is-compact')).toBe(true);
  });

  it('should keep the bottom rail anchored to the viewport center when panels change', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const rail = compiled.querySelector('.map-bottom-rail') as HTMLElement;
    expect(getComputedStyle(rail).left).toBe('50%');
    expect(getComputedStyle(rail).transform).toContain('translateX(-50%)');

    const app = fixture.componentInstance as any;
    app.selectedPointId.set('manual-point');
    app.addedPoints.set({
      'dust2:main': [
        {
          id: 'manual-point',
          label: '1',
          mapId: 'dust2',
          levelId: 'main',
          x: 50,
          y: 50,
          kind: 'custom',
          grenadeCategoryId: 'smoke',
          teamSide: 'ct',
          trajectory: { vertices: [] },
        },
      ],
    });
    fixture.detectChanges();

    expect(getComputedStyle(rail).left).toBe('50%');
    expect(getComputedStyle(rail).transform).toContain('translateX(-50%)');
  });

  it('should update team filter from the compact rail popover', async () => {
    setWindowWidth(560);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance as any;

    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelectorAll('.rail-compact-button')[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.rail-popover.is-team')).toBeTruthy();

    (Array.from(compiled.querySelectorAll('.rail-popover-grid button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'T')
      ?.click();
    fixture.detectChanges();

    expect(app.selectedTeamSide()).toBe('t');
    expect(compiled.querySelector('.rail-popover')).toBeFalsy();
  });

  it('should update grenade filter from the compact rail popover', async () => {
    setWindowWidth(560);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance as any;

    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelectorAll('.rail-compact-button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.rail-popover.is-grenade')).toBeTruthy();

    (Array.from(compiled.querySelectorAll('.rail-popover-grid button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'Smoke')
      ?.click();
    fixture.detectChanges();

    expect(app.showAllLineups()).toBe(false);
    expect(app.selectedGrenadeCategoryId()).toBe('smoke');
    expect(compiled.querySelector('.rail-popover')).toBeFalsy();
  });

  it('should close compact rail popovers with Escape', async () => {
    setWindowWidth(560);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelectorAll('.rail-compact-button')[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.rail-popover')).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(compiled.querySelector('.rail-popover')).toBeFalsy();
  });

  it('should auto-collapse the navigation after selecting a map in compact-width conditions', async () => {
    setWindowWidth(560);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.app-shell')?.classList.contains('is-sidebar-closed')).toBe(true);
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
    expect(getComputedStyle(Array.from(compiled.querySelectorAll('.settings-swatch'))[1] as HTMLElement).transition)
      .toContain('background');
    localStorage.removeItem('cs2nades:user-settings');
  });

  it('should hide unused content workspace settings', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.sidebar-footer .nav-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('[aria-label="Content workspace"]')).toBeFalsy();
    expect(compiled.textContent).not.toContain('Locations');
  });

  it('should show legacy migration only when desktop storage still needs it', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance as any;

    (compiled.querySelector('.sidebar-footer .nav-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain('Migrate Legacy Data');
    expect(compiled.textContent).not.toContain('Export Legacy Backup');

    app.storageMigrationStatus.set({
      isDesktop: true,
      needsMigration: true,
      completed: false,
      contentRoot: 'C:\\Content',
      defaultContentRoot: 'C:\\Content',
    });
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Migrate Legacy Data');

    app.storageMigrationStatus.set({
      isDesktop: true,
      needsMigration: false,
      completed: true,
      contentRoot: 'C:\\Content',
      defaultContentRoot: 'C:\\Content',
    });
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain('Migrate Legacy Data');
  });

  it('should create draft spots with right click only and clear them on click away', async () => {
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
    expect(compiled.querySelector('.map-point')).toBeFalsy();
    expect(compiled.querySelector('.point-action-menu')).toBeFalsy();

    board.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
    fixture.detectChanges();
    expect(compiled.querySelector('.map-point')).toBeTruthy();
    expect(compiled.querySelector('.point-action-menu')).toBeTruthy();

    board.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 90, clientY: 90 }));
    fixture.detectChanges();
    expect(compiled.querySelector('.map-point')).toBeFalsy();
    expect(compiled.querySelector('.point-action-menu')).toBeFalsy();
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
    board.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
    fixture.detectChanges();
    (compiled.querySelector('.point-action-grid button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('.point-details input')).toBeTruthy();
    expect(compiled.querySelector('.point-details-header')?.textContent).toContain('Editing...');
    expect(compiled.querySelector('.point-details-header')?.textContent).not.toContain('Smoke 1');

    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('.point-details-header')?.textContent).toContain('Untitled lineup');
    expect(compiled.querySelector('.edit-button')).toBeTruthy();
    expect(compiled.querySelector('.point-details input')).toBeFalsy();
  });

  it('should edit and show lineup description below guide previews', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const textarea = compiled.querySelector('.point-details textarea') as HTMLTextAreaElement;

    textarea.value = 'Stand against the box and aim above the edge.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(app.selectedPoint().description).toBe('Stand against the box and aim above the edge.');

    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.lineup-description')?.textContent).toContain('Stand against the box');
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
    board.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
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

  it('should keep one final marker for multiple lineup variants on the same result spot', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const firstPointId = app.selectedPoint().id;

    app.addLineupVariantFromSelected(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.map-point')).toHaveLength(1);
    expect(app.selectedResultSpotVariants()).toHaveLength(2);
    expect(app.selectedPoint().id).not.toBe(firstPointId);
    expect(app.selectedPoint().resultSpotId).toBe(app.selectedResultSpotVariants()[0].resultSpotId);
    expect(app.selectedPointMode()).toBe('edit');
    expect(compiled.querySelector('.lineup-choice-list')).toBeFalsy();

    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('.point-details-header button[aria-label="Close"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('.map-point') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.lineup-choice-list')).toBeTruthy();
    (compiled.querySelector('.lineup-choice-card') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(app.selectedPoint().id).toBe(firstPointId);
    expect(app.lineupChooserOpen()).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(app.selectedPoint()).toBeTruthy();
    expect(app.lineupChooserOpen()).toBe(true);
    expect(compiled.querySelector('.lineup-choice-list')).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(app.selectedPoint()).toBeUndefined();
    expect(compiled.querySelector('.point-details')).toBeFalsy();
  });

  it('should attach existing shared media from the media pool modal', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const sharedMedia = {
      id: 'shared-media',
      name: 'shared.png',
      type: 'image' as const,
      mimeType: 'image/png',
      blob: new Blob(['shared'], { type: 'image/png' }),
      url: 'blob:shared',
      role: 'detail' as const,
      createdAt: '2026-06-07T00:00:00.000Z',
      sourceLineupTitle: 'Pool item',
    };

    app.mediaPoolOpen.set(true);
    app.mediaPoolAssets.set([sharedMedia]);
    fixture.detectChanges();

    expect(compiled.querySelector('.media-pool-modal')).toBeTruthy();
    (compiled.querySelector('.media-pool-item') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(app.mediaPoolOpen()).toBe(false);
    expect(app.selectedPoint().media.map((media: { id: string }) => media.id)).toContain('shared-media');
    expect(app.selectedPoint().media[0].role).toBe('detail');
  });

  it('should close a readonly selected lineup with Escape', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;

    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(app.selectedPointMode()).toBe('view');
    expect(compiled.querySelector('.point-details')).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(app.selectedPoint()).toBeUndefined();
    expect(compiled.querySelector('.point-details')).toBeFalsy();
  });

  it('should close fullscreen preview before closing the readonly lineup with Escape', async () => {
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
    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    app.openMediaPreview(media);
    fixture.detectChanges();

    expect(app.selectedPointMode()).toBe('view');
    expect(app.previewMedia()?.id).toBe('one');
    expect(compiled.querySelector('.point-details')).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(app.previewMedia()).toBeUndefined();
    expect(app.selectedPoint()).toBeTruthy();
    expect(compiled.querySelector('.point-details')).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(app.selectedPoint()).toBeUndefined();
    expect(compiled.querySelector('.point-details')).toBeFalsy();
  });

  it('should not close an edit-mode lineup with Escape', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;

    app.cancelTrajectoryInteraction();
    fixture.detectChanges();

    expect(app.selectedPointMode()).toBe('edit');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(app.selectedPoint()).toBeTruthy();
    expect(compiled.querySelector('.point-details input')).toBeTruthy();
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

  it('should not create a new point from map double click while editing a lineup', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const board = compiled.querySelector('.map-board') as HTMLElement;

    expect(app.selectedPoint()).toBeTruthy();
    board.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 80, clientY: 80 }));
    fixture.detectChanges();

    expect(compiled.querySelector('.point-action-menu')).toBeNull();
    expect(app.addedPoints()[app.currentLevelKey()]).toHaveLength(1);
  });

  it('should not delete media or trajectory vertices with Backspace while typing', async () => {
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

    app.updateSelectedPoint({
      media: [media],
      trajectory: { vertices: [{ id: 'vertex-1', x: 20, y: 20 }] },
    });
    app.selectedMediaId.set('one');
    fixture.detectChanges();

    const titleInput = compiled.querySelector('.point-details input') as HTMLInputElement;
    titleInput.focus();
    titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    fixture.detectChanges();

    expect(app.selectedPoint().media).toHaveLength(1);
    expect(app.selectedPoint().trajectory.vertices).toHaveLength(1);

    app.selectedMediaId.set(null);
    app.selectedTrajectoryVertexId.set('vertex-1');
    titleInput.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    fixture.detectChanges();

    expect(app.selectedPoint().media).toHaveLength(1);
    expect(app.selectedPoint().trajectory.vertices).toHaveLength(1);
  });

  it('should restart trajectory creation from the selected point with double click and context menu', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const point = compiled.querySelector('.map-point') as HTMLButtonElement;

    app.cancelTrajectoryInteraction();
    fixture.detectChanges();
    expect(app.trajectoryEditMode()).toBeNull();

    point.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();

    expect(app.trajectoryEditMode()).toBe('create');
    expect(app.draftTrajectoryVertex()).toBeTruthy();

    app.cancelTrajectoryInteraction();
    point.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
    fixture.detectChanges();
    expect(compiled.querySelector('.trajectory-context-menu')?.textContent).toContain('Add/Edit trajectory');

    (compiled.querySelector('.trajectory-context-menu button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(app.trajectoryEditMode()).toBe('create');
    expect(app.draftTrajectoryVertex()).toBeTruthy();
  });

  it('should continue or delete trajectory vertices from the vertex context menu', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;

    app.cancelTrajectoryInteraction();
    app.updateSelectedPoint({
      trajectory: {
        vertices: [
          { id: 'bend-1', x: 30, y: 30 },
          { id: 'start-1', x: 40, y: 40 },
        ],
      },
    });
    fixture.detectChanges();

    const vertices = compiled.querySelectorAll('.trajectory-vertex');
    vertices[1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 60, clientY: 60 }));
    fixture.detectChanges();

    expect(compiled.querySelector('.trajectory-context-menu')?.textContent).toContain('Continue');
    (Array.from(compiled.querySelectorAll('.trajectory-context-menu button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'Continue')
      ?.click();
    fixture.detectChanges();

    expect(app.trajectoryEditMode()).toBe('create');
    expect(app.draftTrajectoryVertex()).toMatchObject({ x: 40, y: 40 });

    app.cancelTrajectoryInteraction();
    fixture.detectChanges();
    const remainingVertices = compiled.querySelectorAll('.trajectory-vertex');
    remainingVertices[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
    fixture.detectChanges();

    expect(compiled.querySelector('.trajectory-context-menu')?.textContent).not.toContain('Continue');
    (Array.from(compiled.querySelectorAll('.trajectory-context-menu button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'Delete')
      ?.click();
    fixture.detectChanges();

    expect(app.selectedPoint().trajectory.vertices.map((vertex: { id: string }) => vertex.id)).toEqual(['start-1']);
  });

  it('should show only one trajectory context menu and close it on click away', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const board = compiled.querySelector('.map-board') as HTMLElement;
    const point = compiled.querySelector('.map-point') as HTMLButtonElement;

    app.cancelTrajectoryInteraction();
    app.updateSelectedPoint({
      trajectory: {
        vertices: [{ id: 'start-1', x: 40, y: 40 }],
      },
    });
    fixture.detectChanges();

    point.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.trajectory-context-menu')).toHaveLength(1);
    expect(compiled.querySelector('.trajectory-context-menu')?.textContent).toContain('Add/Edit trajectory');

    (compiled.querySelector('.trajectory-vertex') as HTMLButtonElement).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 60, clientY: 60 }),
    );
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.trajectory-context-menu')).toHaveLength(1);
    expect(compiled.querySelector('.trajectory-context-menu')?.textContent).toContain('Continue');
    expect(compiled.querySelector('.trajectory-context-menu')?.textContent).not.toContain('Add/Edit trajectory');

    board.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 90, clientY: 90 }));
    fixture.detectChanges();

    expect(compiled.querySelector('.trajectory-context-menu')).toBeFalsy();
  });

  it('should delete selected trajectory vertices with guarded Delete shortcut', async () => {
    const fixture = TestBed.createComponent(App);
    await createLineup(fixture);
    const app = fixture.componentInstance as any;

    app.cancelTrajectoryInteraction();
    app.updateSelectedPoint({ trajectory: { vertices: [{ id: 'vertex-1', x: 20, y: 20 }] } });
    app.selectedTrajectoryVertexId.set('vertex-1');
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    fixture.detectChanges();

    expect(app.selectedPoint().trajectory.vertices).toEqual([]);
  });

  it('should keep media and trajectory vertex selection mutually exclusive', async () => {
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

    app.cancelTrajectoryInteraction();
    app.updateSelectedPoint({
      media: [media],
      trajectory: { vertices: [{ id: 'vertex-1', x: 20, y: 20 }] },
    });
    app.selectedTrajectoryVertexId.set('vertex-1');
    fixture.detectChanges();

    (compiled.querySelector('.media-preview-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(app.selectedMediaId()).toBe('one');
    expect(app.selectedTrajectoryVertexId()).toBeNull();

    (compiled.querySelector('.trajectory-vertex') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(app.selectedMediaId()).toBeNull();
    expect(app.selectedTrajectoryVertexId()).toBeTruthy();
  });

  it('should unselect selected media and trajectory vertices on click away', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const board = compiled.querySelector('.map-board') as HTMLElement;
    const media = {
      id: 'one',
      name: 'one.png',
      type: 'image' as const,
      mimeType: 'image/png',
      blob: new Blob(['one'], { type: 'image/png' }),
      url: 'blob:one',
      role: 'detail' as const,
    };

    app.cancelTrajectoryInteraction();
    app.updateSelectedPoint({
      media: [media],
      trajectory: { vertices: [{ id: 'vertex-1', x: 20, y: 20 }] },
    });
    app.selectedMediaId.set('one');
    app.selectedTrajectoryVertexId.set('vertex-1');
    fixture.detectChanges();

    board.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 80, clientY: 80 }));
    fixture.detectChanges();

    expect(app.selectedMediaId()).toBeNull();
    expect(app.selectedTrajectoryVertexId()).toBeNull();
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

  it('should select media in edit mode and delete it with the guarded Delete key', async () => {
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

  it('should assign selected pool media to guide slots without drag and drop', async () => {
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

    (compiled.querySelector('.media-preview-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('.guide-role-grid .guide-slot') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(app.selectedPoint().media[0].role).toBe('start');
    expect(compiled.querySelector('.guide-role-grid .guide-slot img')).toBeTruthy();
  });

  it('should assign dragged media to guide slots with pointer fallback', async () => {
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
      pointerEvent('pointerdown', { pointerId: 11, clientX: 10, clientY: 10 }),
    );
    (compiled.querySelector('.guide-role-grid .guide-slot') as HTMLButtonElement).dispatchEvent(
      pointerEvent('pointerup', { pointerId: 11, clientX: 10, clientY: 10 }),
    );
    fixture.detectChanges();

    expect(app.selectedPoint().media[0].role).toBe('start');
    expect(app.draggedMediaId()).toBeNull();
  });

  it('should assign and delete media from the media context menu', async () => {
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
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }),
    );
    fixture.detectChanges();
    expect(compiled.querySelector('.media-role-actions')).toBeFalsy();
    expect(compiled.querySelector('.media-context-menu')).toBeTruthy();

    (Array.from(compiled.querySelectorAll('.media-context-menu button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'Start')
      ?.click();
    fixture.detectChanges();

    expect(app.selectedPoint().media[0].role).toBe('start');

    (compiled.querySelector('.media-preview-button') as HTMLButtonElement).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }),
    );
    fixture.detectChanges();
    (Array.from(compiled.querySelectorAll('.media-context-menu button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'Delete')
      ?.click();
    fixture.detectChanges();

    expect(app.selectedPoint().media).toEqual([]);
    expect(app.selectedMediaId()).toBeNull();
  });

  it('should open the image editor only for image media in edit mode', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const image = {
      id: 'image',
      name: 'image.png',
      type: 'image' as const,
      mimeType: 'image/png',
      blob: new Blob(['image'], { type: 'image/png' }),
      url: 'blob:image',
      role: 'detail' as const,
    };
    const video = {
      id: 'video',
      name: 'video.mp4',
      type: 'video' as const,
      mimeType: 'video/mp4',
      blob: new Blob(['video'], { type: 'video/mp4' }),
      url: 'blob:video',
      role: 'detail' as const,
    };

    app.updateSelectedPoint({ media: [image, video] });
    fixture.detectChanges();

    (compiled.querySelector('.media-preview-button') as HTMLButtonElement).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }),
    );
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('.media-context-menu button')).map((button) => button.textContent?.trim())).toContain('Edit');

    (Array.from(compiled.querySelectorAll('.media-context-menu button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'Edit')
      ?.click();
    fixture.detectChanges();

    expect(app.imageEditorMedia()?.id).toBe('image');
    expect(compiled.querySelector('app-image-editor')).toBeTruthy();

    app.closeImageEditor();
    fixture.detectChanges();
    (compiled.querySelectorAll('.media-preview-button')[1] as HTMLButtonElement).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }),
    );
    fixture.detectChanges();

    expect(Array.from(compiled.querySelectorAll('.media-context-menu button')).map((button) => button.textContent?.trim())).not.toContain('Edit');
  });

  it('should save edited images as a new copy without changing the original', async () => {
    stubObjectUrls();
    const fixture = TestBed.createComponent(App);
    await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const point = app.selectedPoint();
    const media = {
      id: 'one',
      name: 'one.jpg',
      type: 'image' as const,
      mimeType: 'image/jpeg',
      blob: new Blob(['one'], { type: 'image/jpeg' }),
      url: 'blob:one',
      role: 'start' as const,
    };
    const attached: Array<{ mediaId: string; role: string }> = [];

    app.storage.addMediaAsset = async (asset: unknown) => asset;
    app.storage.attachMediaToLineup = async (_lineupId: string, asset: { id: string }, role: string) => {
      attached.push({ mediaId: asset.id, role });
    };
    app.updateSelectedPoint({ media: [media] });
    app.imageEditorMediaId.set(media.id);

    await app.saveEditedImage({
      mode: 'copy',
      blob: new Blob(['edited'], { type: 'image/png' }),
      name: 'one-edited.png',
      mimeType: 'image/png',
    });

    expect(app.selectedPoint().media).toHaveLength(2);
    expect(app.selectedPoint().media[0]).toMatchObject({ id: 'one', role: 'start', mimeType: 'image/jpeg' });
    expect(app.selectedPoint().media[1]).toMatchObject({ name: 'one-edited.png', role: 'detail', mimeType: 'image/png' });
    expect(app.selectedMediaId()).toBe(app.selectedPoint().media[1].id);
    expect(app.imageEditorMedia()).toBeUndefined();
    expect(attached[0]).toMatchObject({ mediaId: app.selectedPoint().media[1].id, role: 'detail' });
    expect(point.id).toBe(app.selectedPoint().id);
  });

  it('should replace edited images while preserving media id and role', async () => {
    stubObjectUrls();
    const fixture = TestBed.createComponent(App);
    await createLineup(fixture);
    const app = fixture.componentInstance as any;
    const media = {
      id: 'one',
      name: 'one.jpg',
      type: 'image' as const,
      mimeType: 'image/jpeg',
      blob: new Blob(['one'], { type: 'image/jpeg' }),
      url: 'blob:one',
      role: 'result' as const,
    };

    app.storage.addMediaAsset = async (asset: unknown) => asset;
    app.storage.attachMediaToLineup = async () => undefined;
    app.updateSelectedPoint({ media: [media] });
    app.imageEditorMediaId.set(media.id);

    await app.saveEditedImage({
      mode: 'replace',
      blob: new Blob(['edited'], { type: 'image/png' }),
      name: 'one-edited.png',
      mimeType: 'image/png',
    });

    expect(app.selectedPoint().media).toHaveLength(1);
    expect(app.selectedPoint().media[0]).toMatchObject({
      id: 'one',
      role: 'result',
      name: 'one-edited.png',
      mimeType: 'image/png',
    });
    expect(app.selectedMediaId()).toBe('one');
    expect(app.imageEditorMedia()).toBeUndefined();
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

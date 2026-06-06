import { TestBed } from '@angular/core/testing';
import { App } from './app';

function setWindowWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
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
    value: () => ({ ...rect, toJSON: () => ({}) }),
  });
}

describe('UI smoke flow', () => {
  beforeEach(async () => {
    setWindowWidth(1280);
    localStorage.removeItem('cs2nades:user-settings');
    localStorage.removeItem('cs2nades:show-menu-scrollbar');
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('covers the core map, lineup, trajectory, and settings storage path flow', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance as any;

    expect(compiled.querySelector('.empty-board')?.textContent).toContain('Choose a map');

    (compiled.querySelector('.map-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    const board = compiled.querySelector('.map-board') as HTMLElement;
    setBoardRect(board);
    expect(board).toBeTruthy();
    expect(compiled.querySelector('.map-bottom-rail')).toBeTruthy();

    board.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
    fixture.detectChanges();
    expect(compiled.querySelector('.point-action-menu')).toBeTruthy();

    (compiled.querySelector('.point-action-grid button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(app.selectedPointMode()).toBe('edit');
    expect(compiled.querySelector('.point-details')).toBeTruthy();
    expect(compiled.querySelector('.trajectory-line')).toBeTruthy();

    board.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 25, clientY: 25 }));
    fixture.detectChanges();
    expect(app.selectedPoint().trajectory.vertices).toHaveLength(1);

    (compiled.querySelector('.nav-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('.settings-panel')).toBeTruthy();
    expect(compiled.querySelector('.settings-path-row')?.textContent).toContain('Content folder');
    expect(compiled.querySelector('.settings-path-row')?.textContent).toContain('Default AppData folder');
    expect(compiled.querySelector('.settings-action-row')?.textContent).not.toContain('Migrate Legacy Data');

    const originalPrompt = globalThis.prompt;
    globalThis.prompt = () => 'C:\\SmokeContent';
    try {
      (compiled.querySelector('.settings-path-button') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
    } finally {
      globalThis.prompt = originalPrompt;
    }

    expect(app.desktopContentRoot()).toBe('C:\\SmokeContent');
    expect(JSON.parse(localStorage.getItem('cs2nades:user-settings') ?? '{}').desktopContentRoot)
      .toBe('C:\\SmokeContent');
  });
});

import { TestBed } from '@angular/core/testing';
import { App } from './app';

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
});

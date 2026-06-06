import { Component, HostBinding, HostListener, computed, signal } from '@angular/core';
import { ContentWorkspace, ContentWorkspaceService } from './content-workspace';
import {
  GrenadeCategoryId,
  LineupStorage,
  StoredMap,
  StoredMedia,
  StoredPoint,
  StoredTrajectory,
  StoredTrajectoryVertex,
  TeamSide,
} from './lineup-storage';

type TrajectoryVertex = StoredTrajectoryVertex;
type Trajectory = StoredTrajectory;

type MapPoint = {
  id: string;
  label: string;
  mapId: string;
  levelId: string;
  x: number;
  y: number;
  kind: 'spawn' | 'bomb' | 'lineup' | 'custom';
  grenadeCategoryId?: GrenadeCategoryId;
  teamSide: TeamSide;
  title?: string;
  description?: string;
  requirements?: string[];
  media?: PointMedia[];
  heroMediaId?: string;
  trajectory?: Trajectory;
};

type PointMedia = StoredMedia;

type MapLevel = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  points: MapPoint[];
};

type TacticalMap = {
  id: string;
  name: string;
  location: string;
  tags: string[];
  navBackgroundUrl?: string;
  levels: MapLevel[];
};

type GrenadeCategory = {
  id: GrenadeCategoryId;
  label: string;
  iconUrl?: string;
};

type TeamSideOption = {
  id: TeamSide;
  label: string;
  iconUrl: string;
};

type TeamFilterOption = {
  id: TeamSideFilter;
  label: string;
  iconUrl?: string;
  isAny?: boolean;
};

type GrenadeFilterOption = {
  id: GrenadeCategoryId | 'all';
  label: string;
  iconUrl?: string;
  isLocalIcon?: boolean;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
  hasMoved: boolean;
};

type RequirementOption = {
  id: string;
  label: string;
  mouseButtons?: 'left' | 'right' | 'both';
};

type PointActionMenu = {
  pointId: string;
  x: number;
  y: number;
};

type AppView = 'home' | 'map' | 'settings';
type PointMode = 'view' | 'edit';
type TeamSideFilter = TeamSide | 'any';
type RailPopover = 'team' | 'grenade';
type TrajectoryEditMode = 'create' | 'edit';
type TrajectoryDragTarget =
  | { type: 'result'; pointId: string }
  | { type: 'vertex'; pointId: string; vertexId: string }
  | { type: 'append'; pointId: string };

type TrajectoryDragState = {
  pointerId: number;
  target: TrajectoryDragTarget;
  hasMoved: boolean;
};

type PreviewPanState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};

type UserSettings = {
  showMenuScrollbar: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  resizePanelsTogether: boolean;
  accentColorId: AccentColorId;
  teamCtColorId: TeamCtColorId;
  teamTColorId: TeamTColorId;
};

type AccentColorId = 'blue' | 'green' | 'gold' | 'red';
type TeamCtColorId = 'sky' | 'azure' | 'steel' | 'cyan';
type TeamTColorId = 'orange' | 'vermilion' | 'amber' | 'red';
type PanelSide = 'left' | 'right';

type AccentColorOption = {
  id: AccentColorId;
  label: string;
  color: string;
  hover: string;
  soft: string;
  focus: string;
};

type TeamColorOption<TId extends string> = {
  id: TId;
  label: string;
  color: string;
  soft: string;
};

type PanelResizeState = {
  side: PanelSide;
  pointerId: number;
  startClientX: number;
  startLeftWidth: number;
  startRightWidth: number;
};

const GRENADE_CATEGORIES: GrenadeCategory[] = [
  {
    id: 'smoke',
    label: 'Smoke',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/smokegrenade.svg',
  },
  {
    id: 'flash',
    label: 'Flash',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/flashbang.svg',
  },
  {
    id: 'molotov',
    label: 'Molotov',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/molotov.svg',
  },
  {
    id: 'he',
    label: 'HE',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/hegrenade.svg',
  },
];

const MOVEMENT_REQUIREMENTS: RequirementOption[] = [
  { id: 'crouch', label: 'Crouch' },
  { id: 'jump', label: 'Jump' },
  { id: 'run', label: 'Run' },
];

const MOUSE_REQUIREMENTS: RequirementOption[] = [
  { id: 'left-click', label: 'L', mouseButtons: 'left' },
  { id: 'both-click', label: 'M', mouseButtons: 'both' },
  { id: 'right-click', label: 'R', mouseButtons: 'right' },
];

const TEAM_SIDE_OPTIONS: TeamSideOption[] = [
  {
    id: 'ct',
    label: 'CT',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/defuser.svg',
  },
  {
    id: 't',
    label: 'T',
    iconUrl: '/cs2-assets-smoke/_raw/panorama/images/icons/equipment/c4.svg',
  },
];

const TEAM_FILTER_OPTIONS: TeamFilterOption[] = [
  { id: 'any', label: 'Any', iconUrl: '/icons/user_fill.svg', isAny: true },
  ...TEAM_SIDE_OPTIONS,
];

const GRENADE_FILTER_OPTIONS: GrenadeFilterOption[] = [
  { id: 'all', label: 'All', iconUrl: '/icons/tag.svg', isLocalIcon: true },
  ...GRENADE_CATEGORIES,
];

const POINT_ACTION_MENU_WIDTH = 200;
const POINT_ACTION_MENU_HEIGHT = 216;
const POINT_ACTION_MENU_GAP = 10;
const POINT_ACTION_MENU_EDGE_PADDING = 8;
const SHOW_MENU_SCROLLBAR_STORAGE_KEY = 'cs2nades:show-menu-scrollbar';
const USER_SETTINGS_STORAGE_KEY = 'cs2nades:user-settings';
const FULL_RAIL_REQUIRED_WIDTH = 520;
const RAIL_COMPACT_SAFETY_MARGIN = 16;
const MAP_STAGE_GUTTER = 36;
const COMPACT_RAIL_VIEWPORT_WIDTH = 920;
const AUTO_COLLAPSE_NAV_VIEWPORT_WIDTH = 920;
const ACCENT_COLOR_OPTIONS: AccentColorOption[] = [
  {
    id: 'blue',
    label: 'Blue',
    color: '#007acc',
    hover: '#0e639c',
    soft: 'rgba(0, 122, 204, 0.18)',
    focus: '#007fd4',
  },
  {
    id: 'green',
    label: 'Green',
    color: '#2ea043',
    hover: '#238636',
    soft: 'rgba(46, 160, 67, 0.18)',
    focus: '#3fb950',
  },
  {
    id: 'gold',
    label: 'Gold',
    color: '#b89500',
    hover: '#9e7f00',
    soft: 'rgba(184, 149, 0, 0.2)',
    focus: '#d7ba7d',
  },
  {
    id: 'red',
    label: 'Red',
    color: '#c74e39',
    hover: '#a33d2f',
    soft: 'rgba(199, 78, 57, 0.18)',
    focus: '#f14c4c',
  },
];
const TEAM_CT_COLOR_OPTIONS: Array<TeamColorOption<TeamCtColorId>> = [
  { id: 'sky', label: 'Sky', color: '#56b4e9', soft: 'rgba(86, 180, 233, 0.2)' },
  { id: 'azure', label: 'Azure', color: '#4b8dff', soft: 'rgba(75, 141, 255, 0.2)' },
  { id: 'steel', label: 'Steel', color: '#7aa2f7', soft: 'rgba(122, 162, 247, 0.2)' },
  { id: 'cyan', label: 'Cyan', color: '#00b7c3', soft: 'rgba(0, 183, 195, 0.2)' },
];
const TEAM_T_COLOR_OPTIONS: Array<TeamColorOption<TeamTColorId>> = [
  { id: 'orange', label: 'Orange', color: '#d58a38', soft: 'rgba(213, 138, 56, 0.2)' },
  { id: 'vermilion', label: 'Vermilion', color: '#d55e00', soft: 'rgba(213, 94, 0, 0.2)' },
  { id: 'amber', label: 'Amber', color: '#e5a50a', soft: 'rgba(229, 165, 10, 0.2)' },
  { id: 'red', label: 'Red', color: '#c74e39', soft: 'rgba(199, 78, 57, 0.2)' },
];
const DEFAULT_USER_SETTINGS: UserSettings = {
  showMenuScrollbar: false,
  leftPanelWidth: 330,
  rightPanelWidth: 330,
  resizePanelsTogether: false,
  accentColorId: 'blue',
  teamCtColorId: 'azure',
  teamTColorId: 'orange',
};
const PANEL_WIDTH_MIN = 280;
const PANEL_WIDTH_MAX = 420;

const DEFAULT_MAPS: TacticalMap[] = [
  {
    id: 'dust2',
    name: 'Dust2',
    location: 'Morocco',
    tags: ['Active Duty', 'Classic'],
    navBackgroundUrl: '/maps/dust2-nav.webp',
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'A Long, Mid, B Tunnels и плент B на одной схеме.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_dust2_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'mirage',
    name: 'Mirage',
    location: 'Morocco',
    tags: ['Active Duty', 'Mid Control'],
    navBackgroundUrl: '/maps/mirage-nav.webp',
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'A Site, Mid, Connector и B Apps для быстрых смоков.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_mirage_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'inferno',
    name: 'Inferno',
    location: 'Italy',
    tags: ['Active Duty', 'Utility Heavy'],
    navBackgroundUrl: '/maps/inferno-nav.webp',
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Banana, Mid и Apartments как базовые зоны для гранат.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_inferno_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'nuke',
    name: 'Nuke',
    location: 'United States',
    tags: ['Multi Level', 'Indoor'],
    navBackgroundUrl: '/maps/nuke-nav.webp',
    levels: [
      {
        id: 'upper',
        name: 'Верхний уровень',
        description: 'Yard, Heaven, Hut и верхний плент A.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_nuke_radar_psd.png',
        points: [],
      },
      {
        id: 'lower',
        name: 'Нижний уровень',
        description: 'Ramp, Secret, Control и нижний плент B.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_nuke_lower_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'ancient',
    name: 'Ancient',
    location: 'Mexico',
    tags: ['Active Duty', 'Temple'],
    navBackgroundUrl: '/maps/ancient-nav.webp',
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Donut, Mid и обе точки с зелеными проходами.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_ancient_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'anubis',
    name: 'Anubis',
    location: 'Egypt',
    tags: ['Active Duty', 'Canals'],
    navBackgroundUrl: '/maps/anubis-nav.webp',
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Canal, Mid, Bridge и оба плента.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_anubis_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'vertigo',
    name: 'Vertigo',
    location: 'United States',
    tags: ['Multi Level', 'Vertical'],
    navBackgroundUrl: '/maps/vertigo-nav.webp',
    levels: [
      {
        id: 'upper',
        name: 'Верхний уровень',
        description: 'A Ramp, Mid и верхний B.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_vertigo_radar_psd.png',
        points: [],
      },
      {
        id: 'lower',
        name: 'Нижний уровень',
        description: 'Лестницы, нижняя рампа и переходы под точками.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_vertigo_lower_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'overpass',
    name: 'Overpass',
    location: 'Germany',
    tags: ['Reserve', 'Long Rotations'],
    navBackgroundUrl: '/maps/overpass-nav.webp',
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Long, Toilets, Connector и B Water.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_overpass_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'cache',
    name: 'Cache',
    location: 'Ukraine',
    tags: ['Reserve', 'Classic'],
    navBackgroundUrl: '/maps/cache-nav.webp',
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'A Main, Mid, B Main и оба плента.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_cache_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'train',
    name: 'Train',
    location: 'Russia',
    tags: ['Reserve', 'Multi Level'],
    navBackgroundUrl: '/maps/train-nav.webp',
    levels: [
      {
        id: 'upper',
        name: 'Верхний уровень',
        description: 'Верхняя схема Train с внешним и внутренним плентом.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_train_radar_psd.png',
        points: [],
      },
      {
        id: 'lower',
        name: 'Нижний уровень',
        description: 'Нижний уровень Train для переходов и подземных позиций.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/de_train_lower_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'italy',
    name: 'Italy',
    location: 'Italy',
    tags: ['Hostage', 'Classic'],
    navBackgroundUrl: '/maps/italy-nav.webp',
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Hostage-карта Italy из локальных CS2 ассетов.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/cs_italy_radar_psd.png',
        points: [],
      },
    ],
  },
  {
    id: 'office',
    name: 'Office',
    location: 'United States',
    tags: ['Hostage', 'Classic'],
    navBackgroundUrl: '/maps/office-nav.webp',
    levels: [
      {
        id: 'main',
        name: 'Основной уровень',
        description: 'Hostage-карта Office из локальных CS2 ассетов.',
        imageUrl: '/cs2-assets-smoke/_raw/panorama/images/overheadmaps/cs_office_radar_psd.png',
        points: [],
      },
    ],
  },
];

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly maps = signal<TacticalMap[]>(DEFAULT_MAPS);
  protected readonly grenadeCategories = GRENADE_CATEGORIES;
  protected readonly teamSideOptions = TEAM_SIDE_OPTIONS;
  protected readonly teamFilterOptions = TEAM_FILTER_OPTIONS;
  protected readonly grenadeFilterOptions = GRENADE_FILTER_OPTIONS;
  protected readonly accentColorOptions = ACCENT_COLOR_OPTIONS;
  protected readonly teamCtColorOptions = TEAM_CT_COLOR_OPTIONS;
  protected readonly teamTColorOptions = TEAM_T_COLOR_OPTIONS;
  protected readonly movementRequirements = MOVEMENT_REQUIREMENTS;
  protected readonly mouseRequirements = MOUSE_REQUIREMENTS;
  protected readonly appView = signal<AppView>('home');
  protected readonly sidebarOpen = signal(true);
  protected readonly selectedMapId = signal<string | null>(null);
  protected readonly selectedLevelId = signal(DEFAULT_MAPS[0].levels[0].id);
  protected readonly selectedGrenadeCategoryId = signal(GRENADE_CATEGORIES[0].id);
  protected readonly selectedTeamSide = signal<TeamSideFilter>('any');
  protected readonly showAllLineups = signal(false);
  protected readonly isRailCompact = signal(false);
  protected readonly activeRailPopover = signal<RailPopover | null>(null);
  protected readonly addedPoints = signal<Record<string, MapPoint[]>>({});
  protected readonly draftPoint = signal<MapPoint | null>(null);
  protected readonly markerCounters = signal<Record<string, number>>({});
  protected readonly mapZoom = signal(1);
  protected readonly mapPan = signal({ x: 0, y: 0 });
  protected readonly selectedPointId = signal<string | null>(null);
  protected readonly selectedPointMode = signal<PointMode>('view');
  protected readonly pointActionMenu = signal<PointActionMenu | null>(null);
  protected readonly previewMediaId = signal<string | null>(null);
  protected readonly previewZoom = signal(1);
  protected readonly previewPan = signal({ x: 0, y: 0 });
  protected readonly importError = signal<string | null>(null);
  protected readonly contentWorkspace = signal<ContentWorkspace | undefined>(undefined);
  protected readonly draggedMediaId = signal<string | null>(null);
  protected readonly selectedMediaId = signal<string | null>(null);
  protected readonly trajectoryEditMode = signal<TrajectoryEditMode | null>(null);
  protected readonly selectedTrajectoryVertexId = signal<string | null>(null);
  protected readonly draftTrajectoryVertex = signal<TrajectoryVertex | null>(null);
  protected readonly hoveredTrajectorySegmentIndex = signal<number | null>(null);
  protected readonly userSettings = signal<UserSettings>(this.loadUserSettings());
  protected readonly showMenuScrollbar = computed(() => this.userSettings().showMenuScrollbar);
  protected readonly leftPanelWidth = computed(() => this.userSettings().leftPanelWidth);
  protected readonly rightPanelWidth = computed(() => this.userSettings().rightPanelWidth);
  protected readonly resizePanelsTogether = computed(() => this.userSettings().resizePanelsTogether);
  protected readonly selectedAccentColorId = computed(() => this.userSettings().accentColorId);
  protected readonly selectedTeamCtColorId = computed(() => this.userSettings().teamCtColorId);
  protected readonly selectedTeamTColorId = computed(() => this.userSettings().teamTColorId);
  protected readonly panelWidthMin = PANEL_WIDTH_MIN;
  protected readonly panelWidthMax = PANEL_WIDTH_MAX;

  @HostBinding('style.--vscode-accent')
  protected get hostAccentColor(): string {
    return this.currentAccentColor().color;
  }

  @HostBinding('style.--vscode-accent-hover')
  protected get hostAccentHoverColor(): string {
    return this.currentAccentColor().hover;
  }

  @HostBinding('style.--vscode-accent-soft')
  protected get hostAccentSoftColor(): string {
    return this.currentAccentColor().soft;
  }

  @HostBinding('style.--vscode-focus-ring')
  protected get hostFocusRingColor(): string {
    return this.currentAccentColor().focus;
  }

  @HostBinding('style.--team-ct')
  protected get hostTeamCtColor(): string {
    return this.currentTeamCtColor().color;
  }

  @HostBinding('style.--team-t')
  protected get hostTeamTColor(): string {
    return this.currentTeamTColor().color;
  }

  @HostBinding('style.--left-panel-width.px')
  protected get hostLeftPanelWidth(): number {
    return this.leftPanelWidth();
  }

  @HostBinding('style.--right-panel-width.px')
  protected get hostRightPanelWidth(): number {
    return this.rightPanelWidth();
  }

  private readonly storage = new LineupStorage();
  private readonly contentWorkspaceService = new ContentWorkspaceService();
  private dragState: DragState | null = null;
  private trajectoryDragState: TrajectoryDragState | null = null;
  private previewPanState: PreviewPanState | null = null;
  private panelResizeState: PanelResizeState | null = null;
  private suppressNextBoardClick = false;

  protected readonly selectedMap = computed(() => {
    return this.maps().find((map) => map.id === this.selectedMapId());
  });

  protected readonly selectedLevel = computed(() => {
    const map = this.selectedMap();
    return map?.levels.find((level) => level.id === this.selectedLevelId()) ?? map?.levels[0];
  });

  protected readonly currentPoints = computed(() => {
    const selectedGrenadeCategoryId = this.selectedGrenadeCategoryId();
    const selectedTeamSide = this.selectedTeamSide();
    const showAllLineups = this.showAllLineups();
    const selectedMap = this.selectedMap();
    const selectedLevel = this.selectedLevel();
    if (!selectedMap || !selectedLevel) {
      return [];
    }

    return [
      ...this.selectedLevel()!.points,
      ...(this.addedPoints()[this.currentLevelKey()] ?? []),
      ...(this.draftPoint() ? [this.draftPoint()!] : []),
    ].filter((point) => (
      !point.grenadeCategoryId ||
      (
        (selectedTeamSide === 'any' || point.teamSide === selectedTeamSide) &&
        (showAllLineups || point.grenadeCategoryId === selectedGrenadeCategoryId)
      )
    ));
  });

  protected readonly selectedPoint = computed(() => {
    const selectedPointId = this.selectedPointId();
    if (!selectedPointId) {
      return undefined;
    }

    return (this.addedPoints()[this.currentLevelKey()] ?? []).find((point) => point.id === selectedPointId);
  });

  protected readonly allSavedPoints = computed(() => {
    return Object.values(this.addedPoints()).flat();
  });

  protected readonly previewGallery = computed(() => {
    const point = this.selectedPoint();
    return point ? this.orderedMedia(point) : [];
  });

  protected readonly previewMedia = computed(() => {
    const previewMediaId = this.previewMediaId();
    if (!previewMediaId) {
      return undefined;
    }

    return this.previewGallery().find((media) => media.id === previewMediaId);
  });

  protected readonly selectedMedia = computed(() => {
    const selectedMediaId = this.selectedMediaId();
    const point = this.selectedPoint();
    if (!selectedMediaId || !point) {
      return undefined;
    }

    return (point.media ?? []).find((media) => media.id === selectedMediaId);
  });

  protected readonly previewMediaIndex = computed(() => {
    const previewMediaId = this.previewMediaId();
    if (!previewMediaId) {
      return -1;
    }

    return this.previewGallery().findIndex((media) => media.id === previewMediaId);
  });

  protected readonly selectedTrajectoryPoints = computed(() => {
    const point = this.selectedPoint();
    if (!point) {
      return [];
    }

    const vertices = point.trajectory?.vertices ?? [];
    const draft = this.draftTrajectoryVertex();
    return [
      { id: `${point.id}:result`, x: point.x, y: point.y, role: 'result' as const },
      ...vertices.map((vertex, index) => ({
        ...vertex,
        role: index === vertices.length - 1 ? 'start' as const : 'bend' as const,
      })),
      ...(draft ? [{ ...draft, role: 'draft' as const }] : []),
    ];
  });

  protected mapLineupCount(map: TacticalMap): number {
    return this.allSavedPoints().filter((point) => point.mapId === map.id).length;
  }

  protected mapTeamLineupCount(map: TacticalMap, teamSide: TeamSide): number {
    return this.allSavedPoints().filter((point) => point.mapId === map.id && point.teamSide === teamSide).length;
  }

  protected mapGrenadeLineupCount(map: TacticalMap, grenadeCategoryId: GrenadeCategoryId): number {
    return this.allSavedPoints().filter((point) => (
      point.mapId === map.id && point.grenadeCategoryId === grenadeCategoryId
    )).length;
  }

  constructor() {
    void this.loadStoredMaps();
    void this.loadStoredPoints();
    void this.ensureContentWorkspace();
  }

  protected selectMap(map: TacticalMap): void {
    this.cancelTrajectoryInteraction();
    this.appView.set('map');
    this.selectedMapId.set(map.id);
    this.selectedLevelId.set(map.levels[0].id);
    this.resetMapView();
    this.closePointEditor();
    this.draftPoint.set(null);
    if (this.shouldAutoCollapseSidebar()) {
      this.sidebarOpen.set(false);
    }
    this.updateRailCompactMode();
  }

  protected openSidebar(): void {
    this.sidebarOpen.set(true);
    this.updateRailCompactMode();
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
    this.updateRailCompactMode();
  }

  protected selectSettings(): void {
    this.cancelTrajectoryInteraction();
    this.appView.set('settings');
    this.selectedMapId.set(null);
    this.closePointEditor();
    this.draftPoint.set(null);
  }

  protected async onCustomMapSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const fallbackName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Custom map';
    const name = globalThis.prompt?.('Map name', fallbackName)?.trim() ?? fallbackName;
    if (!name) {
      return;
    }

    const id = this.uniqueMapId(name);
    const map: StoredMap = {
      id,
      name,
      location: 'Custom',
      tags: ['Custom'],
      levelId: 'main',
      levelName: 'Main',
      levelDescription: 'Custom radar image.',
      imageName: file.name,
      imageMimeType: file.type,
      imageBlob: file,
      imageUrl: URL.createObjectURL(file),
    };

    await this.storage.saveMap(map);
    this.addStoredMaps([map]);
    await this.ensureContentWorkspace();
    this.selectMap(this.toTacticalMap(map));
  }

  protected selectLevel(level: MapLevel): void {
    this.cancelTrajectoryInteraction();
    this.selectedLevelId.set(level.id);
    this.resetMapView();
    this.closePointEditor();
    this.draftPoint.set(null);
  }

  protected selectGrenadeCategory(category: GrenadeCategory): void {
    this.cancelTrajectoryInteraction();
    this.showAllLineups.set(false);
    this.selectedGrenadeCategoryId.set(category.id);
    this.closeRailPopover();
    this.closePointEditor();
  }

  protected selectTeamSide(teamSide: TeamSideFilter): void {
    this.cancelTrajectoryInteraction();
    this.selectedTeamSide.set(teamSide);
    this.closeRailPopover();
    this.closePointEditor();
  }

  protected selectAllLineups(): void {
    this.cancelTrajectoryInteraction();
    this.showAllLineups.set(true);
    this.closeRailPopover();
    this.closePointEditor();
  }

  protected setShowMenuScrollbar(showScrollbar: boolean): void {
    this.updateUserSettings({ showMenuScrollbar: showScrollbar });
  }

  protected setAccentColor(accentColorId: AccentColorId): void {
    if (!ACCENT_COLOR_OPTIONS.some((option) => option.id === accentColorId)) {
      return;
    }

    this.updateUserSettings({ accentColorId });
  }

  protected setResizePanelsTogether(resizeTogether: boolean): void {
    this.updateUserSettings({ resizePanelsTogether: resizeTogether });
  }

  protected setTeamCtColor(teamCtColorId: TeamCtColorId): void {
    if (!TEAM_CT_COLOR_OPTIONS.some((option) => option.id === teamCtColorId)) {
      return;
    }

    this.updateUserSettings({ teamCtColorId });
  }

  protected setTeamTColor(teamTColorId: TeamTColorId): void {
    if (!TEAM_T_COLOR_OPTIONS.some((option) => option.id === teamTColorId)) {
      return;
    }

    this.updateUserSettings({ teamTColorId });
  }

  protected currentAccentColor(): AccentColorOption {
    return ACCENT_COLOR_OPTIONS.find((option) => option.id === this.userSettings().accentColorId)
      ?? ACCENT_COLOR_OPTIONS[0];
  }

  protected currentTeamCtColor(): TeamColorOption<TeamCtColorId> {
    return TEAM_CT_COLOR_OPTIONS.find((option) => option.id === this.userSettings().teamCtColorId)
      ?? TEAM_CT_COLOR_OPTIONS[0];
  }

  protected currentTeamTColor(): TeamColorOption<TeamTColorId> {
    return TEAM_T_COLOR_OPTIONS.find((option) => option.id === this.userSettings().teamTColorId)
      ?? TEAM_T_COLOR_OPTIONS[0];
  }

  protected selectedTeamOption(): TeamFilterOption {
    return this.teamFilterOptions.find((option) => option.id === this.selectedTeamSide())
      ?? this.teamFilterOptions[0];
  }

  protected selectedGrenadeOption(): GrenadeFilterOption {
    if (this.showAllLineups()) {
      return this.grenadeFilterOptions[0];
    }

    return this.grenadeFilterOptions.find((option) => option.id === this.selectedGrenadeCategoryId())
      ?? this.grenadeFilterOptions[0];
  }

  protected isGrenadeFilterOptionActive(option: GrenadeFilterOption): boolean {
    return option.id === 'all'
      ? this.showAllLineups()
      : !this.showAllLineups() && this.selectedGrenadeCategoryId() === option.id;
  }

  protected toggleRailPopover(popover: RailPopover, event: MouseEvent): void {
    event.stopPropagation();
    this.activeRailPopover.update((activePopover) => activePopover === popover ? null : popover);
  }

  protected closeRailPopover(): void {
    this.activeRailPopover.set(null);
  }

  protected selectGrenadeFilterOption(option: GrenadeFilterOption): void {
    if (option.id === 'all') {
      this.selectAllLineups();
      return;
    }

    const category = this.grenadeCategories.find((grenadeCategory) => grenadeCategory.id === option.id);
    if (category) {
      this.selectGrenadeCategory(category);
    }
  }

  protected startPanelResize(side: PanelSide, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.panelResizeState = {
      side,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startLeftWidth: this.leftPanelWidth(),
      startRightWidth: this.rightPanelWidth(),
    };
  }

  protected updateSelectedPointTeamSide(teamSide: TeamSide): void {
    this.updateSelectedPoint({ teamSide });
  }

  protected grenadeCategoryForPoint(point: MapPoint): GrenadeCategory | undefined {
    return this.grenadeCategories.find((category) => category.id === point.grenadeCategoryId);
  }

  protected onBoardPointerDown(event: PointerEvent): void {
    if (this.trajectoryDragState) {
      return;
    }

    const target = event.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('.map-point') ||
      target.closest('.trajectory-vertex') ||
      target.closest('.trajectory-midpoint') ||
      target.closest('.point-details') ||
      target.closest('.point-action-menu') ||
      target.closest('.level-switcher') ||
      target.closest('.map-bottom-rail')
    ) {
      return;
    }

    if ((this.selectedPointMode() === 'edit' || this.trajectoryEditMode()) && this.mapZoom() <= 1) {
      return;
    }

    const board = event.currentTarget as HTMLElement;
    if (typeof board.setPointerCapture === 'function') {
      board.setPointerCapture(event.pointerId);
    }
    this.dragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: this.mapPan().x,
      startPanY: this.mapPan().y,
      hasMoved: false,
    };
  }

  protected onBoardPointerMove(event: PointerEvent): void {
    if (this.trajectoryDragState) {
      this.onTrajectoryPointerMove(event);
      return;
    }

    if (this.dragState && this.dragState.pointerId === event.pointerId) {
      this.updateMapPanFromDrag(event);
      return;
    }

    if (this.trajectoryEditMode() === 'create' && this.selectedPointMode() === 'edit') {
      this.updateDraftTrajectoryFromPointer(event);
    }
  }

  protected onBoardPointerUp(event: PointerEvent): void {
    if (this.trajectoryDragState) {
      this.onTrajectoryPointerUp(event);
      return;
    }

    if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    const board = event.currentTarget as HTMLElement;
    board.releasePointerCapture?.(event.pointerId);
    this.suppressNextBoardClick = this.dragState.hasMoved;
    this.dragState = null;
  }

  protected onBoardClick(event: MouseEvent): void {
    if (!this.selectedMap() || !this.selectedLevel()) {
      return;
    }

    if (this.isMapControlTarget(event.target as HTMLElement)) {
      return;
    }

    if (this.trajectoryEditMode() === 'create' && this.selectedPointMode() === 'edit') {
      if (this.suppressNextBoardClick) {
        this.suppressNextBoardClick = false;
        return;
      }

      this.placeDraftTrajectoryVertex(event);
      return;
    }

    if (this.selectedPointMode() === 'edit' || this.trajectoryEditMode()) {
      return;
    }

    if (this.suppressNextBoardClick) {
      this.suppressNextBoardClick = false;
      return;
    }

    this.closePointEditor();
  }

  protected onBoardDoubleClick(event: MouseEvent): void {
    this.createPointFromBoardAction(event);
  }

  protected onBoardContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.createPointFromBoardAction(event);
  }

  private createPointFromBoardAction(event: MouseEvent): void {
    if (!this.selectedMap() || !this.selectedLevel() || this.trajectoryEditMode()) {
      return;
    }

    if (this.isMapControlTarget(event.target as HTMLElement)) {
      return;
    }

    this.closePointActionMenu();
    const point = this.addPointFromBoardEvent(event, event.currentTarget as HTMLElement);
    if (!point) {
      return;
    }

    const board = event.currentTarget as HTMLElement;
    const rect = board.getBoundingClientRect();
    const position = this.getPointActionMenuPosition(event.clientX - rect.left, event.clientY - rect.top, rect);
    this.pointActionMenu.set({
      pointId: point.id,
      x: position.x,
      y: position.y,
    });
  }

  protected onBoardWheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoomAt(event.currentTarget as HTMLElement, event.clientX, event.clientY, event.deltaY < 0 ? 0.15 : -0.15);
  }

  protected zoomIn(event: MouseEvent): void {
    event.stopPropagation();
    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (board) {
      const rect = board.getBoundingClientRect();
      this.zoomAt(board, rect.left + rect.width / 2, rect.top + rect.height / 2, 0.25);
    }
  }

  protected zoomOut(event: MouseEvent): void {
    event.stopPropagation();
    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (board) {
      const rect = board.getBoundingClientRect();
      this.zoomAt(board, rect.left + rect.width / 2, rect.top + rect.height / 2, -0.25);
    }
  }

  protected openPointEditor(point: MapPoint, event: MouseEvent): void {
    event.stopPropagation();
    if (this.suppressNextBoardClick) {
      this.suppressNextBoardClick = false;
      return;
    }

    if (this.selectedPointId() === point.id && this.selectedPointMode() === 'edit') {
      return;
    }

    if (point.grenadeCategoryId) {
      this.selectedPointId.set(point.id);
      this.selectedPointMode.set('view');
      this.trajectoryEditMode.set(null);
      this.selectedTrajectoryVertexId.set(null);
      this.draftTrajectoryVertex.set(null);
      this.closePointActionMenu();
      this.updateRailCompactMode();
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (!board) {
      return;
    }

    const rect = board.getBoundingClientRect();
    const position = this.getPointActionMenuPosition(event.clientX - rect.left, event.clientY - rect.top, rect);
    this.selectedPointId.set(null);
    this.pointActionMenu.set({
      pointId: point.id,
      x: position.x,
      y: position.y,
    });
  }

  protected closePointEditor(): void {
    this.selectedPointId.set(null);
    this.selectedPointMode.set('view');
    this.cancelTrajectoryInteraction();
    this.closePointActionMenu();
    this.previewMediaId.set(null);
    this.resetPreviewView();
    this.draggedMediaId.set(null);
    this.selectedMediaId.set(null);
    this.updateRailCompactMode();
  }

  protected closePointActionMenu(): void {
    this.pointActionMenu.set(null);
  }

  protected deleteMarker(pointId: string, event: MouseEvent): void {
    event.stopPropagation();
    const key = this.currentLevelKey();
    this.addedPoints.update((points) => ({
      ...points,
      [key]: (points[key] ?? []).filter((point) => point.id !== pointId),
    }));
    void this.storage.deletePoint(pointId);
    this.closePointEditor();
  }

  protected updateSelectedPointTitle(value: string): void {
    this.updateSelectedPoint({ title: value });
  }

  protected updateSelectedPointDescription(value: string): void {
    this.updateSelectedPoint({ description: value });
  }

  protected displayDescription(point: MapPoint): string {
    return point.description?.trim() ?? '';
  }

  protected updateGuidePreviewFocus(event: MouseEvent): void {
    const slot = event.currentTarget as HTMLElement;
    const rect = slot.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = this.clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = this.clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    slot.style.setProperty('--preview-focus-x', `${x}%`);
    slot.style.setProperty('--preview-focus-y', `${y}%`);
  }

  protected toggleRequirement(requirementId: string, checked: boolean): void {
    const point = this.selectedPoint();
    const current = point?.requirements ?? [];
    const requirements = checked
      ? Array.from(new Set([...current, requirementId]))
      : current.filter((id) => id !== requirementId);

    this.updateSelectedPoint({ requirements });
  }

  protected selectMouseRequirement(requirementId: string): void {
    const point = this.selectedPoint();
    const current = point?.requirements ?? [];
    const mouseRequirementIds = new Set(this.mouseRequirements.map((requirement) => requirement.id));
    this.updateSelectedPoint({
      requirements: [
        ...current.filter((id) => !mouseRequirementIds.has(id)),
        requirementId,
      ],
    });
  }

  protected hasRequirement(point: MapPoint, requirementId: string): boolean {
    return (point.requirements ?? []).includes(requirementId);
  }

  protected onMediaFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addMediaFiles(input.files);
    }
    input.value = '';
  }

  protected openMediaPreview(media: PointMedia): void {
    if (this.draggedMediaId()) {
      return;
    }

    this.previewMediaId.set(media.id);
    this.resetPreviewView();
  }

  protected closeMediaPreview(): void {
    this.previewMediaId.set(null);
    this.resetPreviewView();
  }

  protected saveSelectedPoint(): void {
    const point = this.selectedPoint();
    if (point?.grenadeCategoryId) {
      void this.storage.savePoint(this.toStoredPoint(point));
      this.selectedPointMode.set('view');
      this.trajectoryEditMode.set(null);
      this.selectedTrajectoryVertexId.set(null);
    }
  }

  protected assignGrenadeToPoint(pointId: string, category: GrenadeCategory, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedGrenadeCategoryId.set(category.id);
    this.updatePointById(pointId, {
      grenadeCategoryId: category.id,
      teamSide: this.selectedConcreteTeamSide(),
    });
    this.selectedPointId.set(pointId);
    this.selectedPointMode.set('edit');
    this.updateRailCompactMode();
    this.trajectoryEditMode.set('create');
    this.selectedTrajectoryVertexId.set(null);
    this.draftPoint.set(null);
    this.closePointActionMenu();
    const point = this.selectedPoint();
    if (point?.grenadeCategoryId) {
      this.draftTrajectoryVertex.set({
        id: this.createTrajectoryVertexId(point.id),
        x: point.x,
        y: point.y,
      });
      void this.storage.savePoint(this.toStoredPoint(point));
    }
  }

  protected editSelectedPoint(): void {
    this.selectedPointMode.set('edit');
  }

  protected displayTitle(point: MapPoint): string {
    const title = point.title?.trim();
    return title ? title : 'Untitled lineup';
  }

  protected selectedRequirements(point: MapPoint, requirements: RequirementOption[]): RequirementOption[] {
    return requirements.filter((requirement) => this.hasRequirement(point, requirement.id));
  }

  protected guideMovementText(point: MapPoint): string {
    return this.selectedRequirements(point, this.movementRequirements)
      .map((requirement) => requirement.label)
      .join(' + ');
  }

  protected guideMouseRequirement(point: MapPoint): RequirementOption | undefined {
    return this.selectedRequirements(point, this.mouseRequirements)[0];
  }

  protected mediaForRole(point: MapPoint, role: 'start' | 'result'): PointMedia | undefined {
    return (point.media ?? []).find((media) => media.role === role);
  }

  protected detailMedia(point: MapPoint): PointMedia[] {
    return (point.media ?? []).filter((media) => !media.role || media.role === 'detail');
  }

  protected orderedMedia(point: MapPoint): PointMedia[] {
    const media = point.media ?? [];
    return [
      ...media.filter((item) => item.role === 'start'),
      ...media.filter((item) => !item.role || item.role === 'detail'),
      ...media.filter((item) => item.role === 'result'),
    ];
  }

  protected assignMediaRole(mediaId: string, role: 'start' | 'result'): void {
    const point = this.selectedPoint();
    if (!point) {
      return;
    }

    const media = point.media ?? [];
    const target = media.find((item) => item.id === mediaId);
    if (!target || target.type !== 'image') {
      return;
    }

    this.updateSelectedPoint({
      media: this.sortRoleMedia(media.map((item) => ({
        ...item,
        role: item.id === mediaId ? role : item.role === role ? 'detail' : item.role ?? 'detail',
      }))),
    });
  }

  protected assignSelectedMediaRole(role: 'start' | 'result', event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const media = this.selectedMedia();
    if (media) {
      this.assignMediaRole(media.id, role);
    }
  }

  protected onGuideRoleSlotClick(role: 'start' | 'result', event: MouseEvent): void {
    const selectedMedia = this.selectedMedia();
    if (selectedMedia?.type === 'image') {
      this.assignSelectedMediaRole(role, event);
      return;
    }

    const point = this.selectedPoint();
    const slotMedia = point ? this.guideSlotMedia(point, role) : undefined;
    if (slotMedia) {
      this.openMediaPreview(slotMedia);
    }
  }

  protected onGuideRoleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.dropEffect = 'move';
    }
  }

  protected onGuideRoleDrop(role: 'start' | 'result', event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const mediaId = this.draggedMediaId()
      ?? event.dataTransfer?.getData('application/x-cs2nades-media-id')
      ?? event.dataTransfer?.getData('text/plain');
    this.draggedMediaId.set(null);
    if (mediaId) {
      this.assignMediaRole(mediaId, role);
    }
  }

  protected onGuideRolePointerUp(role: 'start' | 'result', event: PointerEvent): void {
    if (!this.draggedMediaId()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.assignMediaRole(this.draggedMediaId()!, role);
    this.draggedMediaId.set(null);
  }

  protected onMediaDragStart(mediaId: string, event: DragEvent): void {
    event.stopPropagation();
    this.selectedMediaId.set(mediaId);
    this.draggedMediaId.set(mediaId);
    event.dataTransfer?.setData('application/x-cs2nades-media-id', mediaId);
    event.dataTransfer?.setData('text/plain', mediaId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  protected onMediaDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  protected onMediaDrop(targetMediaId: string, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const draggedMediaId = this.draggedMediaId()
      ?? event.dataTransfer?.getData('application/x-cs2nades-media-id')
      ?? event.dataTransfer?.getData('text/plain');
    this.draggedMediaId.set(null);
    if (!draggedMediaId || draggedMediaId === targetMediaId) {
      return;
    }

    const point = this.selectedPoint();
    const media = point?.media ?? [];
    const fromIndex = media.findIndex((item) => item.id === draggedMediaId);
    const toIndex = media.findIndex((item) => item.id === targetMediaId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const nextMedia = [...media];
    const [movedMedia] = nextMedia.splice(fromIndex, 1);
    nextMedia.splice(toIndex, 0, movedMedia);
    this.updateSelectedPoint({ media: this.sortRoleMedia(nextMedia) });
  }

  protected onMediaDragEnd(event: DragEvent): void {
    event.stopPropagation();
    this.draggedMediaId.set(null);
  }

  protected startMediaPointerDrag(mediaId: string, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    this.selectedMediaId.set(mediaId);
    this.draggedMediaId.set(mediaId);
  }

  protected selectMedia(media: PointMedia, event: MouseEvent): void {
    event.stopPropagation();
    if (this.draggedMediaId()) {
      return;
    }

    this.selectedMediaId.set(media.id);
  }

  protected openMediaPreviewFromEdit(media: PointMedia, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedMediaId.set(media.id);
    this.openMediaPreview(media);
  }

  protected isMediaSelected(mediaId: string): boolean {
    return this.selectedMediaId() === mediaId;
  }

  protected deleteSelectedMedia(): void {
    const point = this.selectedPoint();
    const selectedMediaId = this.selectedMediaId();
    if (!point || !selectedMediaId) {
      return;
    }

    const media = (point.media ?? []).filter((item) => item.id !== selectedMediaId);
    this.updateSelectedPoint({
      media,
      heroMediaId: point.heroMediaId === selectedMediaId ? undefined : point.heroMediaId,
    });
    if (this.previewMediaId() === selectedMediaId) {
      this.previewMediaId.set(null);
      this.resetPreviewView();
    }
    this.selectedMediaId.set(null);
  }

  protected deleteSelectedMediaFromButton(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.deleteSelectedMedia();
  }

  protected selectPreviewMedia(media: PointMedia, event?: MouseEvent): void {
    event?.stopPropagation();
    this.previewMediaId.set(media.id);
    this.resetPreviewView();
  }

  protected showPreviousPreviewMedia(event?: Event): void {
    event?.stopPropagation();
    const gallery = this.previewGallery();
    const index = this.previewMediaIndex();
    if (gallery.length === 0 || index < 0) {
      return;
    }

    const nextIndex = (index - 1 + gallery.length) % gallery.length;
    this.previewMediaId.set(gallery[nextIndex].id);
    this.resetPreviewView();
  }

  protected showNextPreviewMedia(event?: Event): void {
    event?.stopPropagation();
    const gallery = this.previewGallery();
    const index = this.previewMediaIndex();
    if (gallery.length === 0 || index < 0) {
      return;
    }

    const nextIndex = (index + 1) % gallery.length;
    this.previewMediaId.set(gallery[nextIndex].id);
    this.resetPreviewView();
  }

  protected zoomPreview(delta: number, event?: Event): void {
    event?.stopPropagation();
    const zoom = Math.max(1, Math.min(5, this.previewZoom() + delta));
    this.previewZoom.set(zoom);
    if (zoom === 1) {
      this.previewPan.set({ x: 0, y: 0 });
    }
  }

  protected onPreviewWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.zoomPreview(event.deltaY < 0 ? 0.25 : -0.25, event);
  }

  protected onPreviewPointerDown(event: PointerEvent): void {
    if (this.previewZoom() <= 1) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    const pan = this.previewPan();
    this.previewPanState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  }

  protected onPreviewPointerMove(event: PointerEvent): void {
    const panState = this.previewPanState;
    if (!panState || panState.pointerId !== event.pointerId) {
      return;
    }

    this.previewPan.set({
      x: panState.startPanX + event.clientX - panState.startClientX,
      y: panState.startPanY + event.clientY - panState.startClientY,
    });
  }

  protected onPreviewPointerUp(event: PointerEvent): void {
    const panState = this.previewPanState;
    if (!panState || panState.pointerId !== event.pointerId) {
      return;
    }

    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.previewPanState = null;
  }

  protected startResultPointDrag(point: MapPoint, event: PointerEvent): void {
    if (this.selectedPointId() !== point.id || this.selectedPointMode() !== 'edit') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.beginTrajectoryDrag(event, { type: 'result', pointId: point.id });
  }

  protected startTrajectoryVertexDrag(vertexId: string, event: PointerEvent): void {
    const point = this.selectedPoint();
    if (!point || this.selectedPointMode() !== 'edit') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.selectedTrajectoryVertexId.set(vertexId);
    this.beginTrajectoryDrag(event, { type: 'vertex', pointId: point.id, vertexId });
  }

  protected appendTrajectoryFromVertex(vertexId: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.suppressNextBoardClick) {
      this.suppressNextBoardClick = false;
      return;
    }

    const point = this.selectedPoint();
    if (!point || this.selectedPointMode() !== 'edit') {
      return;
    }

    const vertices = point.trajectory?.vertices ?? [];
    if (vertices.at(-1)?.id !== vertexId) {
      this.selectedTrajectoryVertexId.set(vertexId);
      return;
    }

    this.trajectoryEditMode.set('edit');
    const source = vertices.find((vertex) => vertex.id === vertexId);
    if (source) {
      this.addTrajectoryVertex(point, { x: source.x, y: source.y });
    }
  }

  protected insertTrajectoryVertexAfter(index: number, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.insertTrajectoryVertexAtSegment(index);
  }

  protected startTrajectorySegmentDrag(index: number, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const vertex = this.insertTrajectoryVertexAtSegment(index);
    const point = this.selectedPoint();
    if (!vertex || !point) {
      return;
    }

    this.beginTrajectoryDrag(event, { type: 'vertex', pointId: point.id, vertexId: vertex.id });
  }

  protected setHoveredTrajectorySegment(index: number | null): void {
    this.hoveredTrajectorySegmentIndex.set(index);
  }

  protected isTrajectorySegmentHovered(index: number): boolean {
    return this.hoveredTrajectorySegmentIndex() === index;
  }

  private insertTrajectoryVertexAtSegment(index: number): TrajectoryVertex | null {
    const point = this.selectedPoint();
    if (!point || this.selectedPointMode() !== 'edit') {
      return null;
    }

    const path = this.selectedTrajectoryPoints().filter((pathPoint) => pathPoint.role !== 'draft');
    const before = path[index];
    const after = path[index + 1];
    if (!before || !after) {
      return null;
    }

    const vertex: TrajectoryVertex = {
      id: this.createTrajectoryVertexId(point.id),
      x: (before.x + after.x) / 2,
      y: (before.y + after.y) / 2,
    };
    const vertices = [...(point.trajectory?.vertices ?? [])];
    vertices.splice(index, 0, vertex);
    this.updateSelectedPoint({ trajectory: { vertices } });
    this.selectedTrajectoryVertexId.set(vertex.id);
    this.trajectoryEditMode.set('edit');
    return vertex;
  }

  protected isTrajectoryVertexSelected(vertexId: string): boolean {
    return this.selectedTrajectoryVertexId() === vertexId;
  }

  protected isDraggingTrajectoryVertex(vertexId: string): boolean {
    return this.trajectoryDragState?.target.type === 'vertex' && this.trajectoryDragState.target.vertexId === vertexId;
  }

  protected isDraggingResultPoint(pointId: string): boolean {
    return this.trajectoryDragState?.target.type === 'result' && this.trajectoryDragState.target.pointId === pointId;
  }

  protected hasTrajectory(point: MapPoint): boolean {
    return (point.trajectory?.vertices.length ?? 0) > 0;
  }

  protected startPoint(point: MapPoint): TrajectoryVertex | undefined {
    return point.trajectory?.vertices.at(-1);
  }

  protected guideSlotMedia(point: MapPoint, role: 'start' | 'result'): PointMedia | undefined {
    return this.mediaForRole(point, role);
  }

  protected trajectorySvgPoints(): string {
    return this.trajectoryRenderPoints()
      .map((point) => `${point.x},${point.y}`)
      .join(' ');
  }

  protected trajectoryRenderPoints(): Array<{ x: number; y: number }> {
    const points = this.selectedTrajectoryPoints();
    if (points.length < 2) {
      return points;
    }

    const [result, next] = points;
    const dx = next.x - result.x;
    const dy = next.y - result.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.01) {
      return points;
    }

    const offset = Math.min(2.4, distance * 0.45);
    return [
      {
        x: result.x + (dx / distance) * offset,
        y: result.y + (dy / distance) * offset,
      },
      ...points.slice(1),
    ];
  }

  protected trajectorySegmentMidpoints(): Array<{ id: string; index: number; x: number; y: number }> {
    const points = this.selectedTrajectoryPoints().filter((point) => point.role !== 'draft');
    return points.slice(0, -1).map((point, index) => {
      const nextPoint = points[index + 1];
      return {
        id: `${point.id}:${nextPoint.id}:mid`,
        index,
        x: (point.x + nextPoint.x) / 2,
        y: (point.y + nextPoint.y) / 2,
      };
    });
  }

  protected async exportZip(): Promise<void> {
    const blob = await this.storage.exportZip(
      this.allSavedPoints().map((point) => this.toStoredPoint(point)),
      this.customStoredMaps(),
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cs2-nades-${new Date().toISOString().slice(0, 10)}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected async importZip(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    try {
      const { maps, points } = await this.storage.importZipData(file);
      await this.storage.replaceAllMaps(maps);
      await this.storage.replaceAll(points);
      this.maps.set(DEFAULT_MAPS);
      this.addStoredMaps(maps);
      this.applyStoredPoints(points);
      void this.ensureContentWorkspace();
      this.importError.set(null);
    } catch (error) {
      this.importError.set(error instanceof Error ? error.message : 'Import failed');
    }
  }

  @HostListener('window:paste', ['$event'])
  protected onPaste(event: ClipboardEvent): void {
    if (!this.selectedPoint()) {
      return;
    }

    const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    this.addMediaFiles(files);
  }

  @HostListener('window:keydown', ['$event'])
  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.activeRailPopover()) {
      event.preventDefault();
      this.closeRailPopover();
      return;
    }

    if (this.previewMedia()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeMediaPreview();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.showPreviousPreviewMedia(event);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.showNextPreviewMedia(event);
        return;
      }
    }

    if (event.key === 'Escape') {
      if (this.trajectoryEditMode() || this.trajectoryDragState || this.draftTrajectoryVertex()) {
        event.preventDefault();
        this.cancelTrajectoryInteraction();
      }
      return;
    }

    if (event.key === 'Enter' && this.trajectoryEditMode()) {
      event.preventDefault();
      this.commitTrajectoryInteraction();
      return;
    }

    if (
      !this.previewMedia() &&
      (event.key === 'Delete' || event.key === 'Backspace') &&
      this.selectedPointMode() === 'edit' &&
      this.selectedMediaId()
    ) {
      event.preventDefault();
      this.deleteSelectedMedia();
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedTrajectoryVertexId()) {
      event.preventDefault();
      this.deleteSelectedTrajectoryVertex();
    }
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.updateRailCompactMode();
  }

  @HostListener('window:click', ['$event'])
  protected onWindowClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.map-bottom-rail')) {
      this.closeRailPopover();
    }
  }

  @HostListener('window:pointermove', ['$event'])
  protected onWindowPointerMove(event: PointerEvent): void {
    const resizeState = this.panelResizeState;
    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const delta = event.clientX - resizeState.startClientX;
    const resizedWidth = this.clamp(
      resizeState.side === 'left'
        ? resizeState.startLeftWidth + delta
        : resizeState.startRightWidth - delta,
      PANEL_WIDTH_MIN,
      PANEL_WIDTH_MAX,
    );

    if (this.resizePanelsTogether()) {
      this.userSettings.update((settings) => ({
        ...settings,
        leftPanelWidth: resizedWidth,
        rightPanelWidth: resizedWidth,
      }));
      this.updateRailCompactMode();
      return;
    }

    this.userSettings.update((settings) => ({
      ...settings,
      ...(resizeState.side === 'left'
        ? { leftPanelWidth: resizedWidth }
        : { rightPanelWidth: resizedWidth }),
    }));
    this.updateRailCompactMode();
  }

  @HostListener('window:pointerup', ['$event'])
  protected onWindowPointerUp(event: PointerEvent): void {
    const resizeState = this.panelResizeState;
    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    this.panelResizeState = null;
    this.saveUserSettings(this.userSettings());
    this.updateRailCompactMode();
  }

  private addPointFromBoardEvent(event: MouseEvent, board: HTMLElement): MapPoint | null {
    const selectedMap = this.selectedMap();
    const selectedLevel = this.selectedLevel();
    if (!selectedMap || !selectedLevel) {
      return null;
    }

    const { x, y } = this.getMapPercentFromClientPoint(event.clientX, event.clientY, board);
    const key = this.currentLevelKey();
    const nextPointNumber = (this.markerCounters()[key] ?? 0) + 1;
    const point: MapPoint = {
      id: `${key}:custom:${Date.now()}`,
      label: String(nextPointNumber),
      mapId: selectedMap.id,
      levelId: selectedLevel.id,
      x,
      y,
      kind: 'custom',
      teamSide: this.selectedConcreteTeamSide(),
      title: '',
      description: '',
      requirements: [],
      media: [],
      trajectory: { vertices: [] },
    };

    this.markerCounters.update((counters) => ({
      ...counters,
      [key]: nextPointNumber,
    }));
    this.draftPoint.set(point);
    return point;
  }

  private beginTrajectoryDrag(event: PointerEvent, target: TrajectoryDragTarget): void {
    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (!board) {
      return;
    }

    if (typeof board.setPointerCapture === 'function') {
      board.setPointerCapture(event.pointerId);
    }
    this.trajectoryDragState = {
      pointerId: event.pointerId,
      target,
      hasMoved: false,
    };

    if (target.type === 'append') {
      this.draftTrajectoryVertex.set({
        id: this.createTrajectoryVertexId(target.pointId),
        ...this.getMapPercentFromClientPoint(event.clientX, event.clientY, board),
      });
    }
  }

  private onTrajectoryPointerMove(event: PointerEvent): void {
    const dragState = this.trajectoryDragState;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (!board) {
      return;
    }

    const point = this.selectedPoint();
    if (!point || point.id !== dragState.target.pointId) {
      return;
    }

    const position = this.getMapPercentFromClientPoint(event.clientX, event.clientY, board);
    dragState.hasMoved = true;
    if (dragState.target.type === 'result') {
      this.updateSelectedPoint(position, { save: false });
      return;
    }

    if (dragState.target.type === 'vertex') {
      this.updateTrajectoryVertex(dragState.target.vertexId, position, false);
      return;
    }

    this.draftTrajectoryVertex.set({
      id: this.draftTrajectoryVertex()?.id ?? this.createTrajectoryVertexId(point.id),
      ...position,
    });
  }

  private updateDraftTrajectoryFromPointer(event: PointerEvent): void {
    const point = this.selectedPoint();
    if (!point) {
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (!board) {
      return;
    }

    this.draftTrajectoryVertex.set({
      id: this.draftTrajectoryVertex()?.id ?? this.createTrajectoryVertexId(point.id),
      ...this.getMapPercentFromClientPoint(event.clientX, event.clientY, board),
    });
  }

  private onTrajectoryPointerUp(event: PointerEvent): void {
    const dragState = this.trajectoryDragState;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const board = (event.currentTarget as HTMLElement).closest('.map-board') as HTMLElement | null;
    if (board && typeof board.releasePointerCapture === 'function') {
      board.releasePointerCapture(event.pointerId);
    }
    this.trajectoryDragState = null;
    this.suppressNextBoardClick = dragState.hasMoved;

    const point = this.selectedPoint();
    if (!point || point.id !== dragState.target.pointId) {
      this.draftTrajectoryVertex.set(null);
      return;
    }

    if (dragState.target.type === 'append') {
      const draft = this.draftTrajectoryVertex();
      this.draftTrajectoryVertex.set(null);
      if (draft) {
        this.addTrajectoryVertex(point, draft);
      }
      return;
    }

    if (point.grenadeCategoryId) {
      void this.storage.savePoint(this.toStoredPoint(point));
    }
  }

  private addTrajectoryVertex(
    point: MapPoint,
    vertex: Pick<TrajectoryVertex, 'x' | 'y'> & Partial<Pick<TrajectoryVertex, 'id'>>,
  ): void {
    const nextVertex: TrajectoryVertex = {
      id: vertex.id ?? this.createTrajectoryVertexId(point.id),
      x: vertex.x,
      y: vertex.y,
    };
    const vertices = [...(point.trajectory?.vertices ?? []), nextVertex];
    this.updateSelectedPoint({ trajectory: { vertices } });
    this.selectedTrajectoryVertexId.set(nextVertex.id);
    this.trajectoryEditMode.set('edit');
  }

  private updateTrajectoryVertex(vertexId: string, patch: Pick<TrajectoryVertex, 'x' | 'y'>, save: boolean): void {
    const point = this.selectedPoint();
    if (!point) {
      return;
    }

    const vertices = (point.trajectory?.vertices ?? []).map((vertex) => (
      vertex.id === vertexId ? { ...vertex, ...patch } : vertex
    ));
    this.updateSelectedPoint({ trajectory: { vertices } }, { save });
  }

  private deleteSelectedTrajectoryVertex(): void {
    const point = this.selectedPoint();
    const selectedVertexId = this.selectedTrajectoryVertexId();
    if (!point || !selectedVertexId) {
      return;
    }

    const vertices = (point.trajectory?.vertices ?? []).filter((vertex) => vertex.id !== selectedVertexId);
    this.updateSelectedPoint({ trajectory: { vertices } });
    this.selectedTrajectoryVertexId.set(null);
  }

  private cancelTrajectoryInteraction(): void {
    this.trajectoryDragState = null;
    this.trajectoryEditMode.set(null);
    this.selectedTrajectoryVertexId.set(null);
    this.draftTrajectoryVertex.set(null);
  }

  private commitTrajectoryInteraction(): void {
    const point = this.selectedPoint();
    const draft = this.draftTrajectoryVertex();
    if (point && this.trajectoryEditMode() === 'create' && draft) {
      this.addTrajectoryVertex(point, draft);
    }
    this.trajectoryEditMode.set(null);
    this.selectedTrajectoryVertexId.set(null);
    this.draftTrajectoryVertex.set(null);
    const nextPoint = this.selectedPoint();
    if (nextPoint?.grenadeCategoryId) {
      void this.storage.savePoint(this.toStoredPoint(nextPoint));
    }
  }

  private createTrajectoryVertexId(pointId: string): string {
    return `${pointId}:trajectory:${Date.now()}:${Math.round(Math.random() * 100000)}`;
  }

  private loadUserSettings(): UserSettings {
    try {
      const rawSettings = globalThis.localStorage?.getItem(USER_SETTINGS_STORAGE_KEY);
      const parsedSettings = rawSettings ? JSON.parse(rawSettings) as Partial<UserSettings> : {};
      const accentColor = ACCENT_COLOR_OPTIONS.find((option) => option.id === parsedSettings.accentColorId);
      const legacyPanelWidth = (parsedSettings as Partial<UserSettings> & { panelWidth?: number }).panelWidth;
      const fallbackPanelWidth = Number(legacyPanelWidth ?? DEFAULT_USER_SETTINGS.leftPanelWidth);
      const teamCtColor = TEAM_CT_COLOR_OPTIONS.find((option) => option.id === parsedSettings.teamCtColorId);
      const teamTColor = TEAM_T_COLOR_OPTIONS.find((option) => option.id === parsedSettings.teamTColorId);
      return {
        showMenuScrollbar: typeof parsedSettings.showMenuScrollbar === 'boolean'
          ? parsedSettings.showMenuScrollbar
          : globalThis.localStorage?.getItem(SHOW_MENU_SCROLLBAR_STORAGE_KEY) === 'true',
        leftPanelWidth: this.clamp(Number(parsedSettings.leftPanelWidth ?? fallbackPanelWidth), PANEL_WIDTH_MIN, PANEL_WIDTH_MAX),
        rightPanelWidth: this.clamp(Number(parsedSettings.rightPanelWidth ?? fallbackPanelWidth), PANEL_WIDTH_MIN, PANEL_WIDTH_MAX),
        resizePanelsTogether: parsedSettings.resizePanelsTogether ?? DEFAULT_USER_SETTINGS.resizePanelsTogether,
        accentColorId: accentColor?.id ?? DEFAULT_USER_SETTINGS.accentColorId,
        teamCtColorId: teamCtColor?.id ?? DEFAULT_USER_SETTINGS.teamCtColorId,
        teamTColorId: teamTColor?.id ?? DEFAULT_USER_SETTINGS.teamTColorId,
      };
    } catch {
      return DEFAULT_USER_SETTINGS;
    }
  }

  private updateUserSettings(patch: Partial<UserSettings>): void {
    const settings = {
      ...this.userSettings(),
      ...patch,
    };
    this.userSettings.set(settings);
    this.saveUserSettings(settings);
  }

  private saveUserSettings(settings: UserSettings): void {
    try {
      globalThis.localStorage?.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      globalThis.localStorage?.setItem(SHOW_MENU_SCROLLBAR_STORAGE_KEY, String(settings.showMenuScrollbar));
    } catch {
      // Preference persistence is optional when storage is unavailable.
    }
  }

  private zoomAt(board: HTMLElement, clientX: number, clientY: number, delta: number): void {
    const oldZoom = this.mapZoom();
    const zoom = Math.max(1, Math.min(4, oldZoom + delta));
    if (zoom === oldZoom) {
      return;
    }

    const rect = this.getMapSurfaceRect(board);
    const pan = this.mapPan();
    const cursorX = clientX - rect.left;
    const cursorY = clientY - rect.top;
    const mapX = (cursorX - pan.x) / oldZoom;
    const mapY = (cursorY - pan.y) / oldZoom;

    this.mapZoom.set(zoom);

    if (zoom === 1) {
      this.mapPan.set({ x: 0, y: 0 });
      return;
    }

    this.mapPan.set({
      x: cursorX - mapX * zoom,
      y: cursorY - mapY * zoom,
    });
  }

  private updateMapPanFromDrag(event: PointerEvent): void {
    if (!this.dragState || this.mapZoom() <= 1) {
      return;
    }

    const dx = event.clientX - this.dragState.startClientX;
    const dy = event.clientY - this.dragState.startClientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.dragState.hasMoved = true;
    }

    this.mapPan.set({
      x: this.dragState.startPanX + dx,
      y: this.dragState.startPanY + dy,
    });
  }

  private placeDraftTrajectoryVertex(event: MouseEvent): void {
    const point = this.selectedPoint();
    const board = event.currentTarget as HTMLElement;
    if (!point) {
      return;
    }

    const draft = {
      id: this.createTrajectoryVertexId(point.id),
      ...this.getMapPercentFromClientPoint(event.clientX, event.clientY, board),
    };
    this.draftTrajectoryVertex.set(null);
    this.addTrajectoryVertex(point, draft);
  }

  private resetMapView(): void {
    this.mapZoom.set(1);
    this.mapPan.set({ x: 0, y: 0 });
  }

  private addMediaFiles(files: FileList | File[]): void {
    const point = this.selectedPoint();
    if (!point) {
      return;
    }

    const media = Array.from(files)
      .filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
      .map((file) => ({
        id: `${point.id}:media:${Date.now()}:${file.name}`,
        name: file.name,
        type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
        mimeType: file.type,
        blob: file,
        url: URL.createObjectURL(file),
        role: 'detail' as const,
      }));

    if (media.length === 0) {
      return;
    }

    const currentMedia = point.media ?? [];
    this.updateSelectedPoint({
      media: this.sortRoleMedia([...currentMedia, ...media]),
      heroMediaId: point.heroMediaId ?? currentMedia[0]?.id ?? media[0]?.id,
    });
  }

  private sortRoleMedia(media: PointMedia[]): PointMedia[] {
    return [
      ...media.filter((item) => item.role === 'start'),
      ...media.filter((item) => !item.role || item.role === 'detail'),
      ...media.filter((item) => item.role === 'result'),
    ];
  }

  private resetPreviewView(): void {
    this.previewZoom.set(1);
    this.previewPan.set({ x: 0, y: 0 });
    this.previewPanState = null;
  }

  private isMapControlTarget(target: HTMLElement): boolean {
    return Boolean(
      target.closest('button') ||
      target.closest('.point-details') ||
      target.closest('.point-action-menu') ||
      target.closest('.level-switcher') ||
      target.closest('.map-bottom-rail'),
    );
  }

  private selectedConcreteTeamSide(): TeamSide {
    const selectedTeamSide = this.selectedTeamSide();
    return selectedTeamSide === 'any' ? 'ct' : selectedTeamSide;
  }

  private updateRailCompactMode(): void {
    const useCompactRail = this.shouldUseCompactRail();
    this.isRailCompact.set(useCompactRail);
    if (!useCompactRail) {
      this.closeRailPopover();
    }
  }

  private shouldAutoCollapseSidebar(): boolean {
    return this.viewportWidth() < AUTO_COLLAPSE_NAV_VIEWPORT_WIDTH || this.shouldUseCompactRail();
  }

  private shouldUseCompactRail(): boolean {
    if (this.viewportWidth() < COMPACT_RAIL_VIEWPORT_WIDTH) {
      return true;
    }

    const availableWidth = this.availableRailWidth();
    return availableWidth < FULL_RAIL_REQUIRED_WIDTH + RAIL_COMPACT_SAFETY_MARGIN;
  }

  private availableRailWidth(): number {
    const leftReservedWidth = this.sidebarOpen() ? this.leftPanelWidth() + MAP_STAGE_GUTTER : MAP_STAGE_GUTTER;
    const rightReservedWidth = this.selectedPoint() ? this.rightPanelWidth() + MAP_STAGE_GUTTER : MAP_STAGE_GUTTER;
    return this.viewportWidth() - leftReservedWidth - rightReservedWidth;
  }

  private viewportWidth(): number {
    return globalThis.innerWidth || 1024;
  }

  private updateSelectedPoint(patch: Partial<MapPoint>, options: { save?: boolean } = {}): void {
    const selectedPointId = this.selectedPointId();
    if (!selectedPointId) {
      return;
    }

    const key = this.currentLevelKey();
    this.updatePointInLevel(key, selectedPointId, patch, options);
  }

  private updatePointById(pointId: string, patch: Partial<MapPoint>): void {
    const draftPoint = this.draftPoint();
    if (draftPoint?.id === pointId) {
      const nextPoint = { ...draftPoint, ...patch };
      this.addedPoints.update((points) => ({
        ...points,
        [this.currentLevelKey()]: [...(points[this.currentLevelKey()] ?? []), nextPoint],
      }));
      return;
    }

    this.updatePointInLevel(this.currentLevelKey(), pointId, patch);
  }

  private updatePointInLevel(
    key: string,
    pointId: string,
    patch: Partial<MapPoint>,
    options: { save?: boolean } = {},
  ): void {
    let nextSavedPoint: MapPoint | undefined;
    this.addedPoints.update((points) => ({
      ...points,
      [key]: (points[key] ?? []).map((point) => {
        if (point.id !== pointId) {
          return point;
        }

        nextSavedPoint = { ...point, ...patch };
        return nextSavedPoint;
      }),
    }));
    if (options.save !== false && nextSavedPoint?.grenadeCategoryId) {
      void this.storage.savePoint(this.toStoredPoint(nextSavedPoint));
    }
  }

  private async loadStoredPoints(): Promise<void> {
    const points = await this.storage.loadPoints();
    this.applyStoredPoints(points);
  }

  private async loadStoredMaps(): Promise<void> {
    this.addStoredMaps(await this.storage.loadMaps());
  }

  private async ensureContentWorkspace(): Promise<void> {
    const workspace = await this.contentWorkspaceService.ensureWorkspace(this.maps().map((map) => map.name));
    if (workspace) {
      this.contentWorkspace.set(workspace);
    }
  }

  private addStoredMaps(maps: StoredMap[]): void {
    if (maps.length === 0) {
      return;
    }

    this.maps.update((currentMaps) => {
      const defaults = new Set(DEFAULT_MAPS.map((map) => map.id));
      const customMaps = currentMaps.filter((map) => !defaults.has(map.id));
      const nextCustomMaps = maps.map((map) => this.toTacticalMap(map));
      const nextIds = new Set(nextCustomMaps.map((map) => map.id));
      return [
        ...DEFAULT_MAPS,
        ...customMaps.filter((map) => !nextIds.has(map.id)),
        ...nextCustomMaps,
      ];
    });
  }

  private applyStoredPoints(points: StoredPoint[]): void {
    const groupedPoints: Record<string, MapPoint[]> = {};
    const counters: Record<string, number> = {};
    for (const point of points) {
      const key = `${point.mapId}:${point.levelId}`;
      groupedPoints[key] = [...(groupedPoints[key] ?? []), this.fromStoredPoint(point)];
      const numericLabel = Number(point.label);
      counters[key] = Math.max(counters[key] ?? 0, Number.isFinite(numericLabel) ? numericLabel : 0);
    }

    this.addedPoints.set(groupedPoints);
    this.markerCounters.set(counters);
    this.draftPoint.set(null);
    this.closePointEditor();
  }

  private fromStoredPoint(point: StoredPoint): MapPoint {
    return {
      id: point.id,
      label: point.label,
      mapId: point.mapId,
      levelId: point.levelId,
      x: point.x,
      y: point.y,
      kind: point.kind,
      grenadeCategoryId: point.grenadeCategoryId,
      teamSide: point.teamSide,
      title: point.title,
      description: point.description ?? '',
      requirements: point.requirements,
      media: point.media,
      heroMediaId: point.heroMediaId,
      trajectory: point.trajectory ?? { vertices: [] },
    };
  }

  private toStoredPoint(point: MapPoint): StoredPoint {
    if (!point.grenadeCategoryId) {
      throw new Error('Draft point cannot be stored');
    }

    return {
      id: point.id,
      label: point.label,
      mapId: point.mapId,
      levelId: point.levelId,
      x: point.x,
      y: point.y,
      kind: 'custom',
      grenadeCategoryId: point.grenadeCategoryId,
      teamSide: point.teamSide,
      title: point.title ?? '',
      description: point.description ?? '',
      requirements: point.requirements ?? [],
      media: (point.media ?? []).map((media) => ({ ...media, role: media.role ?? 'detail' })),
      heroMediaId: point.heroMediaId,
      trajectory: point.trajectory ?? { vertices: [] },
    };
  }

  private customStoredMaps(): StoredMap[] {
    return this.maps()
      .filter((map) => !DEFAULT_MAPS.some((defaultMap) => defaultMap.id === map.id))
      .map((map) => {
        const storedMap = (map as TacticalMap & { storedMap?: StoredMap }).storedMap;
        if (storedMap) {
          return storedMap;
        }

        throw new Error(`Custom map cannot be exported without stored image data: ${map.name}`);
      });
  }

  private toTacticalMap(map: StoredMap): TacticalMap & { storedMap: StoredMap } {
    return {
      storedMap: map,
      id: map.id,
      name: map.name,
      location: map.location,
      tags: map.tags,
      navBackgroundUrl: map.imageUrl,
      levels: [
        {
          id: map.levelId,
          name: map.levelName,
          description: map.levelDescription,
          imageUrl: map.imageUrl,
          points: [],
        },
      ],
    };
  }

  private uniqueMapId(name: string): string {
    const baseId = this.slugify(name);
    const existingIds = new Set(this.maps().map((map) => map.id));
    let id = baseId;
    let index = 2;
    while (existingIds.has(id)) {
      id = `${baseId}-${index}`;
      index += 1;
    }

    return id;
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || `custom-map-${Date.now()}`;
  }

  private getMapPercentFromClientPoint(clientX: number, clientY: number, board: HTMLElement): Pick<MapPoint, 'x' | 'y'> {
    const rect = this.getMapSurfaceRect(board);
    const pan = this.mapPan();
    const zoom = this.mapZoom();
    const x = this.toPercent((clientX - rect.left - pan.x) / zoom, rect.width);
    const y = this.toPercent((clientY - rect.top - pan.y) / zoom, rect.height);

    return { x, y };
  }

  private getMapSurfaceRect(board: HTMLElement): DOMRect {
    return board.querySelector('.map-surface')?.getBoundingClientRect() ?? board.getBoundingClientRect();
  }

  private getPointActionMenuPosition(x: number, y: number, boardRect: DOMRect): Pick<PointActionMenu, 'x' | 'y'> {
    const opensRight = x + POINT_ACTION_MENU_GAP + POINT_ACTION_MENU_WIDTH <= boardRect.width;
    const opensDown = y + POINT_ACTION_MENU_GAP + POINT_ACTION_MENU_HEIGHT <= boardRect.height;
    const nextX = opensRight ? x + POINT_ACTION_MENU_GAP : x - POINT_ACTION_MENU_WIDTH - POINT_ACTION_MENU_GAP;
    const nextY = opensDown ? y + POINT_ACTION_MENU_GAP : y - POINT_ACTION_MENU_HEIGHT - POINT_ACTION_MENU_GAP;

    return {
      x: this.clamp(nextX, POINT_ACTION_MENU_EDGE_PADDING, boardRect.width - POINT_ACTION_MENU_WIDTH - POINT_ACTION_MENU_EDGE_PADDING),
      y: this.clamp(nextY, POINT_ACTION_MENU_EDGE_PADDING, boardRect.height - POINT_ACTION_MENU_HEIGHT - POINT_ACTION_MENU_EDGE_PADDING),
    };
  }

  private currentLevelKey(): string {
    return `${this.selectedMap()?.id ?? 'none'}:${this.selectedLevel()?.id ?? 'none'}`;
  }

  private toPercent(value: number, size: number): number {
    if (size <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (value / size) * 100));
  }

  private clamp(value: number, min: number, max: number): number {
    if (max < min) {
      return min;
    }

    return Math.max(min, Math.min(max, value));
  }
}

export type ContentWorkspace = {
  rootDir: string;
  contentDir: string;
  mapsDir: string;
  systemDir: string;
};

type TauriCore = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
};

export class ContentWorkspaceService {
  async ensureWorkspace(mapNames: string[]): Promise<ContentWorkspace | undefined> {
    const core = await this.loadTauriCore();
    if (!core) {
      return undefined;
    }

    return core.invoke<ContentWorkspace>('ensure_content_workspace', { mapNames });
  }

  private async loadTauriCore(): Promise<TauriCore | undefined> {
    if (!('__TAURI_INTERNALS__' in globalThis)) {
      return undefined;
    }

    try {
      return await import('@tauri-apps/api/core');
    } catch {
      return undefined;
    }
  }
}

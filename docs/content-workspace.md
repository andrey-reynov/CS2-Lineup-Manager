# Content Workspace

CS2 Nades uses a user-facing content workspace for files that should be easy to inspect, edit, back up, generate, or sync outside the app.

The desktop app creates this workspace in the operating system app-data folder, not in `Program Files`. Installed binaries and framework files are app internals; user content belongs in the workspace.

```text
CS2 Nades app data/
  Content/
    Maps/
      Dust2/
        Meta/
          map.json
          lineups.json
        User/
          Inbox/
          Media/
      Mirage/
        Meta/
        User/
          Inbox/
          Media/
  System/
```

## Folder Rules

- `Content/` is user-facing and portable.
- `Content/Maps/<map>/Meta/` contains app-readable JSON metadata.
- `Content/Maps/<map>/User/` belongs to the user and future automation.
- `User/Inbox/` is reserved for dropped screenshots, videos, notes, demos, or generated files that the app can auto-detect later.
- `User/Media/` is for media already associated with lineups.
- `System/` is reserved for app internals and should not be edited manually.

## Export Shape

ZIP exports keep the legacy `manifest.json` for compatibility and also include the content workspace shape:

```text
export.zip
  manifest.json
  Content/
    README.txt
    Maps/
      dust2/
        Meta/
          map.json
          lineups.json
        User/
          Inbox/
          Media/
            Window smoke/
              start-media-1-start.png
```

This makes exports useful both to the app and to people/scripts that want ordinary folders and JSON.

## Future Use

This foundation is intended for:

- manual screenshot/video drops,
- generated map packs,
- local scripts,
- LLM-assisted media classification,
- clean backup/sync/export workflows.

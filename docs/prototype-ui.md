# Prototype UI

The first screen renders real CS2 radar images exported from VPK assets under:

```text
public/cs2-assets-smoke/_raw/panorama/images/overheadmaps
```

Map markers are stored as percentage coordinates relative to the radar image.

Left-clicking the map adds a temporary marker at the clicked position. Resizing the window should keep markers anchored to the same map location.

See [cs2-asset-extraction.md](cs2-asset-extraction.md) for the asset extraction workflow.

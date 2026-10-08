# Camp Snallygaster external asset provenance

Camp Snallygaster may load third-party GLB models at runtime, but only when the source and redistribution license have been checked. The game keeps local fallback geometry and local collision bodies so gameplay does not depend on a remote visual asset.

## Accepted sources

| Runtime key | Asset | Source | License | Notes |
| --- | --- | --- | --- | --- |
| `counselor` | Quaternius Ultimate Modular Men — Casual Character | Quaternius pack mirrored in `Hhk187/Zomopocalypse` | CC0 | Rigged humanoid visual for remote counselors. Source pack is a Quaternius public-domain asset pack. |
| `camper` | Quaternius Ultimate Modular Men — Beach Character | Quaternius pack mirrored in `Hhk187/Zomopocalypse` | CC0 | Temporary camper visual until the teen meshes from Universal Base Characters are vendored directly. Gameplay scales camper roots to 50% of their previous rendered size. |
| `cooler` | Drinks Cooler | `3dassets.dev` asset 28560 | CC0 | Runtime GLB, approximately 4k triangles. |
| `canoe` | Canoe | `3dassets.dev` asset 28833 | CC0 | Runtime GLB. Local collision remains authoritative. |
| `cabin` | Driver Rest Cabin | `3dassets.dev` asset 34212 | CC0 | Used only as an optional visual detail/reference. Camp cabin collision and entrances remain local. |
| `bus` | City Bus Single Decker | `3dassets.dev` asset 34194 | CC0 | Includes named door/wheel nodes and open/close/roll animation clips. Local bus collision remains authoritative. |

## Approved character target

Quaternius **Universal Base Characters** is the preferred camper-character source. The current official pack page states that it contains regular and teen male/female humanoid models, an animation-friendly humanoid rig, glTF output, and a CC0 dedication. It is compatible with Quaternius' CC0 Universal Animation Library. When its teen files are vendored into this repository, they should replace the temporary Beach Character without changing gameplay code.

Official source: https://quaternius.com/packs/universalbasecharacters.html

## Rules

- Do not copy or redistribute proprietary models, textures, animation files, shaders, code, or audio ripped from commercial games.
- Do not treat a public GitHub repository as permission by itself. The underlying asset license must permit redistribution.
- Prefer CC0. CC-BY or permissive software licenses may be used only when attribution and redistribution requirements are satisfied.
- Imported render meshes never replace deterministic gameplay collision. Collision uses local Cannon bodies sized to the intended playable footprint.
- Every new external asset must be recorded in this document before it can be enabled by default.
- A failed remote asset request must fall back to local geometry rather than preventing the game from loading.

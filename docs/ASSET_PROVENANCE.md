# Camp Snallygaster external asset provenance

Camp Snallygaster may load third-party 3D models at runtime, but only when the source and redistribution license have been checked. The game keeps local fallback geometry and local collision bodies so gameplay does not depend on a remote visual asset.

## Accepted sources

| Runtime key | Asset | Source | License | Notes |
| --- | --- | --- | --- | --- |
| `camper`, `camperMale` | Quaternius Universal Base Characters — Teen Male Full Body | Quaternius pack vendored in `dustinc555/mygame` from the official Quaternius release | CC0 1.0 Universal | Actual teen-proportion humanoid camper body. Gameplay additionally scales the camper root to 50% of the previous rendered camper size. |
| `camperFemale` | Quaternius Universal Base Characters — Teen Female Full Body | Quaternius pack vendored in `dustinc555/mygame` from the official Quaternius release | CC0 1.0 Universal | Teen-proportion female humanoid body available to the camper visual pipeline. |
| `counselor` | Quaternius Ultimate Modular Men — Casual Character | Quaternius pack mirrored in `Hhk187/Zomopocalypse` | CC0 | Humanoid visual for remote counselors. Source pack is a Quaternius public-domain asset pack. |
| `cooler` | Drinks Cooler | `3dassets.dev` asset 28560 | CC0 | Runtime GLB. Local collision remains authoritative. |
| `canoe` | Canoe | `3dassets.dev` asset 28833 | CC0 | Runtime GLB. Local collision remains authoritative. |
| `cabin` | Driver Rest Cabin | `3dassets.dev` asset 34212 | CC0 | Optional visual reference/detail source. Camp cabin collision and entrances remain local and deterministic. |
| `bus` | City Bus Single Decker | `3dassets.dev` asset 34194 | CC0 | Includes door/wheel nodes and animation clips. Local bus collision remains authoritative. |
| `tree` | Young Conifer 3.6m | `3dassets.dev` asset 32685 | CC0 | Higher-detail forest set dressing placed around the camp perimeter. Tree collision remains a local upright blocker. |
| `cartons` | Parcel Stack, Small | `3dassets.dev` asset 34800 | CC0 | Taped carton stack used around maintenance/storage areas; local storage collision remains authoritative. |

## Character source verification

Quaternius **Universal Base Characters** is the camper-character source. The official pack describes regular and teen male/female humanoid models, animation-friendly topology, a humanoid rig, glTF output, and a CC0 dedication. The repository mirror used by the runtime preserves the Quaternius vendor directory and includes both `Teen_Male_FullBody.gltf` and `Teen_Female_FullBody.gltf` plus their referenced binary/texture files.

Official source: https://quaternius.com/packs/universalbasecharacters.html

Vendored mirror revision used by the runtime: `dustinc555/mygame@f2cc1affbca335b74ee44ecbd765db4bd17f0f05`

## Rules

- Do not copy or redistribute proprietary models, textures, animation files, shaders, code, or audio ripped from commercial games.
- Do not treat a public GitHub repository as permission by itself. The underlying asset license must permit redistribution.
- Prefer CC0. CC-BY or permissive software licenses may be used only when attribution and redistribution requirements are satisfied.
- Imported render meshes never replace deterministic gameplay collision. Collision uses local Cannon bodies sized to the intended playable footprint.
- Every new external asset must be recorded in this document before it can be enabled by default.
- A failed remote asset request must fall back to local geometry rather than preventing the game from loading.

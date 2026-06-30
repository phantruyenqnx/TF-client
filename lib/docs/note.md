BUG-03 — world.scene element ignored in spawnWorldFromSDF()

**Context:** Affects the SDF-file-loading code path only (offline/preview mode).
In live gz-sim mode, SceneManager.ts:412–418 already applies ambient from `sceneInfo`
broadcast by SceneBroadcaster. BUG-03 matters when loading SDF directly in browser.

Lag, zom in zom out. 
RTF not stable.
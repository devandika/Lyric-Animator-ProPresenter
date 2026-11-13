# Graph Report - Animasi lirik gemini  (2026-11-12)

## Corpus Check
- 85 files · ~93,008 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 1, .bat 1, .ico 1)

## Summary
- 332 nodes · 635 edges · 13 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c5ceba9d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- propresenterThemeParser.cjs
- ProPresenterLiveApp.jsx
- ThemedLyricStage.jsx
- Animate-Text Catalog & Specs
- package.json
- Electron Builder Packaging
- main.cjs
- ProPresenterConnector
- Animate-Text Spec Finder
- LiveLyricStage.jsx
- PNG App Icon Branding
- SVG App Icon Vector
- MediaLayer.jsx

## God Nodes (most connected - your core abstractions)
1. `ProPresenterConnector` - 21 edges
2. `parseProtoFields()` - 18 edges
3. `getField()` - 17 edges
4. `decodeSlide()` - 14 edges
5. `ProPresenterLiveApp()` - 13 edges
6. `decodeMediaAction()` - 10 edges
7. `findPresentationCueData()` - 10 edges
8. `build` - 10 edges
9. `ThemedLyricStage()` - 10 edges
10. `decodeTextElement()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `index.html Root Shell` --implements--> `ProPresenter Lyric Animator`  [INFERRED]
  index.html → PANDUAN_PROPRESENTER.md
- `ProPresenter Lyric Animator` --conceptually_related_to--> `Animate Text Skill`  [INFERRED]
  PANDUAN_PROPRESENTER.md → .agents/skills/animate-text/SKILL.md
- `Text Ownership Policy` --semantically_similar_to--> `showcase.stage Host Requirements`  [INFERRED] [semantically similar]
  .agents/skills/animate-text/references/implementation-notes.md → .agents/skills/animate-text/references/schema.md
- `App()` --calls--> `ProPresenterLiveApp()`  [EXTRACTED]
  src/App.jsx → src/components/ProPresenterLiveApp.jsx
- `ProPresenterLiveApp()` --calls--> `FavoriteSelect()`  [EXTRACTED]
  src/components/ProPresenterLiveApp.jsx → src/components/FavoriteSelect.jsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Animate Text Two-Tier Contract Architecture** — _agents_skills_animate_text_skill_animate_text, _agents_skills_animate_text_references_schema_portable_spec_schema, _agents_skills_animate_text_references_schema_exact_effect_schema, _agents_skills_animate_text_references_implementation_notes_library_stack_adapters [EXTRACTED 1.00]
- **Layout-Aware Kinetic Build Renderers** — _agents_skills_animate_text_references_catalog_kinetic_center_build, _agents_skills_animate_text_references_catalog_short_slide_right, _agents_skills_animate_text_references_catalog_short_slide_down, _agents_skills_animate_text_references_implementation_notes_layout_aware_effects, _agents_skills_animate_text_references_schema_showcase_renderer [EXTRACTED 1.00]
- **ProPresenter NDI-Free Sync and Output Pipeline** — panduan_propresenter_propresenter_lyric_animator, panduan_propresenter_propresenter_network_sync, panduan_propresenter_theme_slide_sync, panduan_propresenter_media_and_messages_layers, panduan_propresenter_fullscreen_display_output [EXTRACTED 1.00]

## Communities (13 total, 0 thin omitted)

### Community 0 - "propresenterThemeParser.cjs"
Cohesion: 0.08
Nodes (63): appPrefsCache, buildFontFamilyStack(), classifyMediaFile(), collectThemeFiles(), decodeColor(), decodeFill(), decodeMediaAction(), decodePath() (+55 more)

### Community 1 - "ProPresenterLiveApp.jsx"
Cohesion: 0.10
Nodes (29): react, react-dom, App(), src_assets_app_icon, ErrorBoundary, FavoriteSelect(), clampNumber(), DEFAULT_CONFIG (+21 more)

### Community 2 - "ThemedLyricStage.jsx"
Cohesion: 0.32
Nodes (14): buildCssBackground(), buildCssShadow(), buildSvgPathD(), buildTextBoxVisuals(), computeLayerOpacityTransition(), getBoxArea(), LyricStageSlot(), normalizeCompareText() (+6 more)

### Community 3 - "Animate-Text Catalog & Specs"
Cohesion: 0.07
Nodes (33): Hidden Bundled Specs (4 Website-Hidden Effects), kinetic-center-build (per-word), shared-axis-y (per-word), short-slide-down (per-word), short-slide-right (per-word), soft-blur-in (per-character), Text Effect Catalog (24 Specs, 20 Visible), typewriter (per-character) (+25 more)

### Community 4 - "package.json"
Cohesion: 0.06
Nodes (31): { contextBridge, ipcRenderer }, author, dependencies, koffi, motion, react, react-dom, description (+23 more)

### Community 5 - "Electron Builder Packaging"
Cohesion: 0.08
Nodes (24): build, appId, directories, files, linux, mac, nsis, portable (+16 more)

### Community 6 - "main.cjs"
Cohesion: 0.15
Nodes (17): { app, BrowserWindow, ipcMain, screen }, APP_ICON_PATH, APP_PNG_ICON_PATH, { getWindowsDisplays }, notifyLivePopoutStatus(), notifyProjectorStatus(), openLivePopoutWindow(), openProjectorOnDisplay() (+9 more)

### Community 7 - "ProPresenterConnector"
Cohesion: 0.18
Nodes (7): ProPresenterLiveApp(), extractActiveProps(), extractJsonObjectsFromBuffer(), fetchJsonWithTimeout(), flattenPresentationSlides(), normalizeSlideText(), ProPresenterConnector

### Community 8 - "Animate-Text Spec Finder"
Cohesion: 0.11
Nodes (18): catalog, query, rawQuery, readJson(), results, scoreSpec(), specsDir, terms (+10 more)

### Community 9 - "LiveLyricStage.jsx"
Cohesion: 0.16
Nodes (21): motion, applyStyleVarsToElement(), LiveLyricStage(), startSmoothFade(), appendFxLineContent(), appendFxText(), appendLineRows(), buildLyricDOM() (+13 more)

### Community 10 - "PNG App Icon Branding"
Cohesion: 0.29
Nodes (8): AI / Gemini-Assisted Visual Generation, Electron Desktop Application Branding, Electron App Icon (app-icon.png), Lyric Animation & Audio-Synced Motion, Three Stacked White-to-Ice-Blue Horizontal Pill Bars (Lyric Lines), Dual Undulating Wave Ribbons (Cyan-to-Magenta & Dark Blue), Four-Pointed Lavender-Pink Sparkle Star (Upper Right), Deep Indigo Squircle Frame with Purple-to-Cyan Gradient Border

### Community 11 - "SVG App Icon Vector"
Cohesion: 0.43
Nodes (8): SVG Indigo-Violet-Cyan Gradient Palette, Flowing Kinetic Wave Ribbon (Wiggle / Motion Motif), Animated Lyric Lines (Staggered Typography Bars), Lyric Animation & After Effects Motion Branding, After Effects 4-Point Motion Sparkle, Soft Drop Shadow Filter (softShadow), Outer Rounded App Squircle Frame, App Icon SVG (512x512)

### Community 12 - "MediaLayer.jsx"
Cohesion: 0.30
Nodes (11): evictOverflowWarmSlots(), getMediaKey(), getSlotWillChange(), MediaLayer(), MediaSlotItem(), releaseVideoElement(), buildProTransitionEnterFrames(), buildProTransitionExitFrames() (+3 more)

## Knowledge Gaps
- **93 isolated node(s):** `rawQuery`, `query`, `terms`, `catalog`, `visibleOrder` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 108 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `ProPresenterLiveApp.jsx` to `LiveLyricStage.jsx`, `ThemedLyricStage.jsx`, `package.json`, `MediaLayer.jsx`?**
  _High betweenness centrality (0.282) - this node is a cross-community bridge._
- **Why does `electron` connect `package.json` to `main.cjs`?**
  _High betweenness centrality (0.277) - this node is a cross-community bridge._
- **Why does `build` connect `Electron Builder Packaging` to `package.json`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `ProPresenterLiveApp()` (e.g. with `loadInitialConfig()` and `.clearSlideLayer()`) actually correct?**
  _`ProPresenterLiveApp()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `rawQuery`, `query`, `terms` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `propresenterThemeParser.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.08283730158730158 - nodes in this community are weakly interconnected._
- **Should `ProPresenterLiveApp.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09871794871794871 - nodes in this community are weakly interconnected._
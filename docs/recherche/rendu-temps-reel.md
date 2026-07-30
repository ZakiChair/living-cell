# Rendu temps réel navigateur — scène biomoléculaire vivante

## 0. Méthode, et avertissement sur les sources

Deux catégories de chiffres dans ce rapport :

- **[MESURÉ]** — mesuré par moi pendant cette session, sur cette machine : **MacBook Pro M4 Max (Mac16,6), 36 Go, GPU 32 cœurs**, Chrome, `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max)`, WebGL 2, buffer de dessin **3024×1502 (4,54 Mpx, DPR 2)**. Bancs dans `/private/tmp/claude-501/-Users-zakichair/25af8214-7291-491f-86a1-c3300b68227a/scratchpad/bench/` (`index.html`, `bench2.html`, `bench3.html`, `bench4.html`, `bench5.html`).
- **[SOURCE]** — issu d'une page primaire réellement récupérée (dépôt three.js via `gh`, WebKit, caniuse, registre npm, papier Mol*).

Les recherches web renvoient beaucoup de fermes de contenu SEO sur ce sujet (byteiota, utsubo, altersquare, webo360, digitalstrategyforce, testmuai, vr.org…). J'ai écarté leurs chiffres. **Deux contradictions vérifiées** :
- « Firefox 147+ supporte WebGPU » → faux : caniuse indique *disabled by default* sur toutes les versions Firefox.
- « WebGPURenderer déclaré production-ready en r171, septembre 2025 » → faux sur la date et non attesté : `gh api` donne **r171 = 2024-11-29**, et ses notes de version ne contiennent aucune déclaration de ce genre (r171 = codesplit des points d'entrée WebGL/WebGPU + introduction de `three.tsl.js`).

**Recadrage important dès maintenant.** La demande dit « milliers de particules ». À 1 000–20 000 éléments, sur desktop, la question de la performance du *nombre de particules* est close avant d'être posée : j'ai mesuré 20 000 sphères instanciées éclairées, animées **sur le CPU**, à 1,3 ms de CPU et 120 fps (plafond vsync). Le budget réel part ailleurs : **taux de remplissage (fill rate), post-traitement, et mobile**. Tout ce rapport est organisé autour de ça.

---

## 1. Three.js (r185, publié le 2026-07-01)

Version courante réelle : **r185**, `three@0.185.1` sur npm. [SOURCE: `gh api repos/mrdoob/three.js/releases`]

### 1.1 Poids de bundle réellement mesuré

Builds publiés, non tree-shakés, mesurés en téléchargeant les fichiers dist et en les compressant :

| Build | brut | gzip -9 | brotli -q11 |
|---|---|---|---|
| `three.module.min.js` + `three.core.min.js` (WebGL) | 733 Ko | **184 Ko** | **151 Ko** |
| `three.webgpu.min.js` + `three.core.min.js` (WebGPU + TSL) | 1 028 Ko | **279 Ko** | **227 Ko** |
| `postprocessing` 6.39.4 (pmndrs, lib complète) | 323 Ko | 112 Ko | 97 Ko |
| `GPUComputationRenderer.js` (addon) | 14 Ko | 3,8 Ko | — |

[MESURÉ] Note : `three.module.min.js` **et** `three.webgpu.min.js` importent tous deux `three.core.min.js` — il faut donc additionner. Avec tree-shaking par un bundler, une scène réelle descend nettement plus bas ; **estimation non mesurée : 110–140 Ko gzip** pour une scène WebGL typique.

### 1.2 InstancedMesh — limites pratiques [MESURÉ]

Icosaèdre détail 1 (80 triangles), `MeshStandardMaterial`, 1 draw call, `frustumCulled=false`, 4,54 Mpx :

| N | animation | ms/frame | fps | CPU (ms) |
|---|---|---|---|---|
| 5 000 | CPU (`setMatrixAt`) | 8,3 | 120 (vsync) | 0,3 |
| 20 000 | CPU | 8,3 | 120 | 1,3 |
| 50 000 | CPU | 8,3 | 120 | 3,2 |
| 100 000 | CPU | 8,3 | 120 | 6,3 |
| **200 000** | **CPU** | **16,4** | **61** | **12,6** |
| 200 000 | statique | 8,3 | 120 | 0,0 |
| 200 000 | vertex shader | 8,3 | 120 | 0,1 |
| 500 000 | vertex shader | 24,9 | 40 | 0,1 |
| 1 000 000 | vertex shader | 60,5 | 16,5 | 0,1 |

**Le résultat central : à 200 000 instances statiques la scène tourne à 120 fps avec 16 M de triangles par frame, mais à 200 000 instances animées côté CPU elle tombe à 61 fps — avec 12,6 ms passés dans le thread principal.** Le goulot n'est pas le GPU, c'est l'écriture et l'upload de 16 floats par instance et par frame.

Coût CPU mesuré : **≈ 63 ns par instance et par frame** pour `setMatrixAt` + `needsUpdate`. Autrement dit, sur un budget CPU de 4 ms : **≈ 60 000 instances animées par le CPU au maximum**, sur la machine la plus rapide de la gamme.

Si l'animation passe dans le vertex shader (attribut instancié + offset calculé en GLSL), le coût CPU tombe à ~0,1 ms et le plafond redevient géométrique : **≈ 330 000 sphères éclairées à 60 fps** (interpolation entre 200 k → ≤8,3 ms et 500 k → 24,9 ms).

Sensibilité à la complexité de la géométrie [MESURÉ] : 100 k instances détail 1 (80 tri) = 8,3 ms ; détail 2 (320 tri) = 8,3 ms ; détail 3 (1 280 tri) = 8,6 ms. **La densité de triangles n'est pas le facteur limitant à cette échelle** — jusqu'à 32 M tri/frame sans effet mesurable.

`MeshBasicMaterial` vs `MeshStandardMaterial` à 100 k et 200 k : **aucune différence mesurable**. La scène n'est pas fragment-bound tant que les sphères restent petites à l'écran.

### 1.3 Points / sprites [MESURÉ]

| N | animation | ms/frame | fps | CPU (ms) |
|---|---|---|---|---|
| 100 000 | CPU | 8,3 | 120 | 1,6 |
| 500 000 | CPU | 8,3 | 120 | 7,8 |
| 1 000 000 | CPU | 16,6 | 60 | 15,6 |
| 1 000 000 | vertex shader | 8,3 | 120 | 0,2 |
| 2 000 000 | vertex shader | 8,3 | 120 | 0,1 |
| 4 000 000 | vertex shader | 8,4 | 119 | 0,0 |
| **8 000 000** | **vertex shader** | **25,3** | **39,5** | 0,1 |

Plafond GPU pour de petits points additifs : **≈ 5–6 millions à 60 fps**. Plafond CPU si on écrit les positions en JS : **≈ 1 million**.

### 1.4 Le vrai plafond : le fill rate [MESURÉ]

300 000 points additifs, mesure du temps GPU par répétition + synchronisation :

| taille de sprite | ms GPU / rendu |
|---|---|
| ~38 px écran | **3,4** |
| ~115 px écran | **19,9** |

**×3 sur le diamètre = ×5,9 sur le temps.** Pour une scène « cellule lumineuse » avec halos additifs, c'est *ça* la contrainte, pas le nombre de particules. 300 k petits points coûtent 3,4 ms ; 300 k gros halos coûtent 19,9 ms et ne tiennent même pas 60 fps sur un M4 Max.

### 1.5 BatchedMesh — à éviter ici

`BatchedMesh` sert à batcher des géométries **différentes** partageant un matériau. Pour une scène biomoléculaire (N copies de la même protéine), `InstancedMesh` est le bon outil.

Problème primaire documenté et **toujours ouvert** : issue #28776, « Significant Performance Drop and High CPU Usage with BatchedMesh ». Le mainteneur **gkjohnson** y rapporte, sur son **MacBook Pro M1 Pro (2021)**, avec 200 000 cubes : *InstancedMesh et géométrie fusionnée à 120 fps, BatchedMesh à ~30 fps*. Cause probable identifiée : les buffers de `starts`/`counts` du multiDraw, **~1,6 Mo réuploadés chaque frame** pour 200 000 éléments, plus le tri et le frustum culling par objet faits sur le CPU. Un contributeur mesure aussi que `sortObjects` seul fait tomber 30 fps → 9 fps (temps passé dans `texSubImage2D` de l'`_indirectTexture`). [SOURCE: `gh issue view 28776 --repo mrdoob/three.js --comments`]

Nuance utile issue de #30352 : `InstancedMesh` **ne trie pas** ses instances, `BatchedMesh` **si**. Sur une scène transparente/additive dense, l'absence de tri d'InstancedMesh crée de l'overdraw. donmccurdy et gkjohnson concluent tous deux que le ralentissement rapporté dans cette issue est de l'overdraw, pas un défaut d'instanciation. [SOURCE: `gh issue view 30352`]

### 1.6 Shaders custom : trois voies, trois compromis

Les trois sont utilisées dans mes bancs.

- **`material.onBeforeCompile`** — vous injectez du GLSL dans un matériau standard et **vous gardez toute la chaîne three.js** : éclairage, ombres, brouillard, gestion des espaces colorimétriques, tone mapping. C'est ce que j'ai utilisé pour l'animation en vertex shader du §1.2 (remplacement du chunk `#include <begin_vertex>`, ~5 lignes). **Le meilleur rapport pouvoir/effort pour une scène artistique** — c'est la voie que je recommande. Fragilité : vous dépendez du nom des chunks internes, qui peuvent bouger entre releases ; et chaque `onBeforeCompile` distinct crée un programme distinct, donc gardez-en peu.
- **`ShaderMaterial` / `RawShaderMaterial`** — vous possédez tout, vous ne récupérez rien. Parfait pour les particules purement émissives (mes points additifs : 8 lignes de GLSL, aucun éclairage à récupérer). Mauvais choix dès que vous voulez des ombres ou un éclairage PBR cohérent avec le reste de la scène.
- **TSL (Three Shading Language)** — vous écrivez une fois, three.js compile vers WGSL **et** GLSL. Introduit comme entrée séparée `three.tsl.js` en r171. Nécessaire si vous visez `WebGPURenderer`, et seule voie pour écrire du compute portable (§3). Prix : couplage fort à l'API nœuds, et c'est précisément la couche visée par l'issue ouverte #33821 sur la lenteur de compilation des matériaux uniques.

### 1.7 Piège majeur : la taille des points

- **Safari sur Apple Silicon plafonne `gl_PointSize` à 64 px** (`ALIASED_POINT_SIZE_RANGE` = [1, 64] sur M1/M2, iPad et MacBook Pro), là où les autres plateformes annoncent 512–2048. [SOURCE: forum développeurs Apple, thread 714831 — signalé par un développeur, **sans réponse officielle d'Apple**]
- [MESURÉ] Sur **Chrome/ANGLE-Metal, M4 Max, `ALIASED_POINT_SIZE_RANGE` = [1, 511]** — donc le plafond de 64 est propre à l'implémentation WebGL de Safari, pas au matériel.
- **WebGPU ne supporte tout simplement pas les points de plus de 1 pixel.** Source primaire, la doc de `PointsNodeMaterial` dans three.js : *« WebGPU only supports point primitives with 1 pixel size. Consequently, this node has no effect when the material is used with Points and a WebGPU backend. If an application wants to render points with a size larger than 1 pixel, the material should be used with Sprite and instancing. »* [SOURCE: `src/materials/nodes/PointsNodeMaterial.js`]

**Conséquence de conception, à décider dès le départ : n'utilisez pas `THREE.Points` pour les particules visibles.** Utilisez des quads instanciés (2 triangles par particule, position/taille en attributs instanciés). Vous êtes alors identique sur Chrome, Safari, WebGL et WebGPU, sans plafond de taille, et vous gardez la possibilité de faire de l'impostor sphérique (§4).

---

## 2. Alternatives, et quand chacune est le bon choix

| Techno | poids (brotli mesuré) | maintenance | bon pour |
|---|---|---|---|
| **three.js WebGL** r185 | 151 Ko | très active | 3D animée, éclairage, post-traitement — **le défaut** |
| **three.js WebGPU** (`three/webgpu`) | 227 Ko | très active | >500 k particules avec interactions ; compute unifié |
| **PixiJS v8** (8.19.0) | 175 Ko | très active (push 2026-07-19) | si la DA finit en **2D** stylisée |
| **regl** 2.1.1 | 24 Ko | **quasi gelée** — dernier commit 2026-06-22 = ajout au README | vous écrivez 100 % du rendu vous-même |
| **Canvas2D pur** | 0 Ko | — | < ~2 000 éléments simples, ou fallback |
| **SVG + GSAP** | 25 Ko (gsap) | active | schéma pédagogique scripté, < ~500 nœuds |

**WebGPU — état du support** [SOURCE: caniuse.com/webgpu, récupéré cette session] : usage global **83,63 %**. Chrome/Edge **113+** ✔. Samsung Internet **24+** ✔. **Safari 26.0+ (macOS Tahoe 26, iOS/iPadOS/visionOS 26) : « support partiel »**. **Firefox : désactivé par défaut sur toutes les versions.** WebKit confirme que Safari 26 apporte les compute shaders et que WebGPU « supersedes WebGL on macOS, iOS, iPadOS, and visionOS ». [SOURCE: webkit.org/blog/16993]

[MESURÉ] Sur ce Mac, Chrome expose un adaptateur WebGPU Metal-3 avec : `maxComputeInvocationsPerWorkgroup` 1024, `maxComputeWorkgroupStorageSize` 32 768, `maxStorageBufferBindingSize` ≈ 4 Gio, features `subgroups`, `timestamp-query`, `float32-blendable`, `shader-f16`.

**Pièges WebGPU dans three.js, tous issus d'issues ouvertes du dépôt** [SOURCE: `gh api search/issues`] :
- **#30560** (ouverte) — « Current UBO system has severe performance issues with many render items ». Mugen87 : chaque objet a son propre UBO, tous rebindés et réuploadés chaque frame ; *« the more render objects you have in a scene, the sooner WebGPURenderer gets CPU limited »*. Mitigation : instancier/batcher (ce que vous faites de toute façon).
- **#33821** (ouverte, 2026-06-16) — « Material initialization is extremely slow compared to WebGLRenderer ». gkjohnson mesure, sur MacBook Pro, 10 000 meshes à matériaux uniques : **WebGPU ~2 100 ms vs WebGL ~131 ms (×16)**, et **~1 029 ms vs ~28 ms (×36)** dans la seconde méthode. Cause : le graphe de nœuds TSL est reconstruit pour chaque matériau unique. Non bloquant si vous avez peu de matériaux.
- **#29580** (ouverte) — « BatchedMesh Example much slower on WebGPU than WebGL on Android ». RenaudRohlinger : **`multiDraw` n'existe pas en WebGPU**, d'où la régression, surtout sur smartphones. Il note aussi un `GPUDeviceLostInfo` sur Safari Technology Preview au-delà de 1 024 éléments batchés (non reproduit par l'ingénieur WebKit sur un Mac Studio M2 — probablement spécifique machine).
- 19 issues ouvertes portent le label `WebGPURenderer`.

**PixiJS v8** : le blog officiel annonce, **sur MacBook Pro M3**, « Sprites + Container : 200 000 à 60 fps » et « Particles + ParticleContainer : 1 000 000 à 60 fps », soit >3× le ParticleContainer de v7. Contrepartie : les particules ne sont pas des sprites complets, et il faut déclarer explicitement quelles propriétés sont dynamiques (seule `position` l'est par défaut) ; tout doit partager une même texture de base. [SOURCE: pixijs.com/blog/particlecontainer-v8]

**GSAP** : entièrement gratuit, y compris commercial, depuis avril 2025 (Webflow a racheté GreenSock en octobre 2024) ; SplitText, MorphSVG, DrawSVG, ScrollTrigger, Inertia inclus. [SOURCE: webflow.com/blog/gsap-becomes-free, css-tricks.com]

---

## 3. Simulation de particules : où bascule le choix

[MESURÉ] Même physique des deux côtés (intégration de vitesse, attracteur central, champ de turbulence sinusoïdal). GPU = `GPUComputationRenderer` (ping-pong FBO RGBA32F, 2 passes par pas), chronométré avec **`EXT_disjoint_timer_query_webgl2`** (disponible sur cette machine). CPU = JS pur sur `Float32Array`, thread principal.

| N | CPU JS (ms/pas) | GPU ping-pong (ms/pas) | rapport |
|---|---|---|---|
| 10 000 | 0,233 | 0,052 | ×4,5 |
| 100 000 | 1,867 | 0,096 | ×19 |
| 1 000 000 | 18,03 | 0,625 | ×29 |
| 4 000 000 | 72,1 | 2,29 | ×31 |
| 16 000 000 | — | 10,83 | — |

Coût unitaire : **CPU ≈ 18 ns/particule/pas**, **GPU ≈ 0,6 ns/particule/pas** au-delà de 1 M (en dessous, le coût fixe des passes domine).

Avertissement de méthode : une première version de ce banc synchronisait avec `readPixels` sur le framebuffer par défaut, ce qui **ne synchronise pas** le travail fait dans des FBO — elle sous-estimait le GPU d'un facteur 10 (0,2 ms au lieu de 2,29 ms à 4 M). Les chiffres ci-dessus sont ceux des timer queries.

**Seuils recommandés** — et le seuil n'est pas *seulement* N :

- **N < 20 000 → CPU en JS.** 0,4 ms. Vous gardez tout le pilotage narratif, le picking, les déclencheurs, les trajectoires scriptées en JavaScript lisible. **C'est le régime de la demande telle que formulée.** Ne pas payer la complexité du GPGPU ici.
- **20 000 ≤ N ≤ 100 000 → zone grise.** Sur desktop le CPU tient (≤ 2 ms). Sur mobile, avec un CPU ~4× plus lent, 100 k coûte déjà ~7–8 ms sur un budget de 33 ms — donc basculer si le mobile compte.
- **N > 100 000 → GPGPU obligatoire.**
- **Facteur qui prime sur N : la relecture CPU.** Si vous devez lire les positions côté JS chaque frame (collision, picking, déclenchement d'événement, liaison d'une molécule à un ribosome), le GPGPU cesse d'être gratuit : `readPixels`/`readPixelsAsync` sérialise le pipeline. Gardez alors une petite population « narrative » sur le CPU (quelques dizaines d'agents) et la foule décorative sur le GPU. **C'est l'architecture que je recommande pour une scène animée artistique.**
- Second facteur : le **coût par particule**. Une interaction N² (voisinage, cohésion) bascule bien plus tôt — vers quelques milliers.

**Les trois techniques :**
- **Ping-pong FBO (WebGL2)** — `GPUComputationRenderer`, 3,8 Ko gzip, officiel three.js, très éprouvé. État lu comme texture dans le vertex shader du rendu (`MAX_VERTEX_TEXTURE_IMAGE_UNITS` = 16 mesuré ici). C'est le défaut.
  - **Prérequis à vérifier en premier, surtout sur mobile : les cibles de rendu flottantes.** `GPUComputationRenderer` a besoin de `EXT_color_buffer_float` pour un état RGBA32F. [MESURÉ] sur ce Mac : `EXT_color_buffer_float: true`, `EXT_float_blend: true`, `MAX_TEXTURE_SIZE: 16384` (soit 268 M de particules par texture — jamais la contrainte). Sur des GPU mobiles anciens, le repli est `HalfFloatType` (16 bits) : ~3 chiffres décimaux significatifs, ce qui suffit pour des vitesses mais **fait apparaître un pas quantifié visible sur des positions absolues** dans un grand volume. Parade : stocker la position en coordonnées relatives à un centre local, ou garder les positions en 32 bits et les vitesses en 16 bits.
- **Transform feedback (WebGL2)** — écrit dans des VBO plutôt que des textures, `RASTERIZER_DISCARD` activé. Un peu plus direct, mais three.js ne l'expose pas côté WebGLRenderer ; vous l'écrivez à la main.
- **Compute shaders (WebGPU)** — seuls à offrir mémoire partagée de groupe, atomiques et scatter arbitraire ; nécessaires pour un tri de particules, une grille de voisinage ou un SPH. C'est le seul cas où WebGPU est *nécessaire* et pas seulement plus élégant.

**Fait architectural important et vérifié dans le code** : le backend de repli WebGL de `WebGPURenderer` **implémente réellement les nœuds compute**, via transform feedback — `gl.beginTransformFeedback(gl.POINTS)`, `RASTERIZER_DISCARD`, `switchBuffers()` en ping-pong, puis `copyBufferToTexture` pour rendre le buffer échantillonnable au rendu. Vous écrivez donc le compute **une fois en TSL** et il tourne sur WebGPU comme sur WebGL2. Limites du repli, visibles dans le code : pas de `count` sous forme de tableau, pas d'`IndirectStorageBufferAttribute` (avertissements explicites), et par construction ni mémoire de groupe ni atomiques. [SOURCE: `src/renderers/webgl-fallback/WebGLBackend.js`, méthodes `compute()` et `createComputePipeline()`]

---

## 4. Rendu des macromolécules

### 4.1 ADN / ARN : ruban et squelette

Approche paramétrique, pas de PDB. Une double hélice est analytique :
`p(t) = (R·cos(ωt+φ), R·sin(ωt+φ), pitch·t)` pour chaque brin, φ = 0 et φ = π (ou un décalage asymétrique pour rendre les sillons majeur/mineur).

- **`TubeGeometry` + `CatmullRomCurve3`** — la voie standard three.js pour un squelette lisse. Coût : `tubularSegments × radialSegments × 2` triangles. Un brin de 400 segments × 8 radiaux = 6 400 tri : négligeable au vu du §1.2 (32 M tri/frame sans effet).
- **Piège** : `TubeGeometry` est **statique**. Animer la courbe impose de reconstruire la géométrie chaque frame (allocation + upload) — c'est le même piège CPU qu'au §1.2. Pour une hélice qui ondule, **générez la géométrie une fois en espace paramétrique (u = position le long, v = angle) et déformez-la dans le vertex shader**. Le CPU ne touche plus rien.
- **Alternative moins coûteuse** : rubans en `Line2`/`MeshLine` (moins de sommets que le tube pour un rendu comparable de face), utile si la caméra ne tourne pas autour.
- Les paires de bases : quads ou cylindres instanciés positionnés par le même paramétrage — un seul `InstancedMesh`.

### 4.2 Protéines : impostors sphériques vs metaballs

**Impostors sphériques** — un quad (ou triangle) instancié par atome, orienté caméra, dont le fragment shader fait l'intersection rayon/sphère analytiquement et écrit `gl_FragDepth`. Résultat : sphère parfaite à toute distance, 4 sommets par atome au lieu de 80–1 280, et normales exactes. C'est ce que fait Mol* : le papier décrit des *« ray-casted impostors for minimal memory use and fast, high-quality rendering »*. La littérature confirme que le raycast en billboard est l'approche la plus rapide sur GPU desktop et **la plus adaptée aux données dynamiques, car elle minimise le volume à streamer vers le GPU**. [SOURCE: papier moteur Mol*, PMC13032908 ; Improved Quadric Surface Impostors, ICVGIP 2012]

Coût réel à surveiller : écrire `gl_FragDepth` **désactive le early-Z** sur la plupart des GPU. À forte densité d'atomes qui se recouvrent, l'impostor peut devenir plus cher qu'une sphère instanciée basse résolution. Compte tenu du §1.2 (100 k sphères détail 1 = 8,3 ms, aucune sensibilité au nombre de triangles), **pour un rendu artistique je recommande l'`InstancedMesh` d'icosaèdres détail 1 ou 2 plutôt que l'impostor** : plus simple, compatible d'office avec l'éclairage/les ombres/le post-traitement de three.js, et le budget triangles n'est pas le problème. L'impostor devient intéressant au-delà de ~500 k atomes, ou si vous voulez une silhouette parfaite en gros plan.

**Metaballs / « blobs »** — deux familles :
- **Marching cubes** — maillage explicite. Coût indépendant de la résolution écran, mais la génération est lourde et se refait à chaque déformation. Pour référence, Mol* mesure une extraction d'isosurface sur une grille 128³ à **~40 ms en GPU contre ~550 ms en CPU** (AMD 7900X + RTX 4070 Ti). À 40 ms l'image, c'est hors budget temps réel si c'est refait chaque frame. [SOURCE: PMC13032908]
- **Screen-space (depth + lissage par curvature flow)** — on rend les particules en sphères, on lisse le tampon de profondeur, on reconstruit les normales. Pas de maillage, surface lisse, pas d'artefacts de grille. Coût proportionnel à la **résolution écran**, pas au nombre de particules — d'où la parade standard : **exécuter la passe à demi-résolution**. C'est l'approche à retenir pour un « blob » de protéine vivant et déformable. [SOURCE: van der Laan et al., *Screen space fluid rendering with curvature flow*, I3D 2009, ACM 10.1145/1507149.1507164]

Vu les mesures de fill rate (§1.4), le screen-space à demi-résolution est de loin le meilleur rapport qualité/coût.

### 4.3 Mol*, NGL, 3Dmol.js : verdict — **non**, pour cette scène

Poids mesurés (fichiers dist réels) :

| Lib | version | brut | gzip | brotli | dernier push |
|---|---|---|---|---|---|
| **Mol\*** (`build/viewer/molstar.js`) | 5.11.0 | 4,79 Mo | **1,37 Mo** | **1,08 Mo** | 2026-07-30 |
| **NGL** (`dist/ngl.js`) | 2.4.0 | 1,23 Mo | **348 Ko** | 280 Ko | **2025-04-14** |
| **3Dmol.js** (`build/3Dmol-min.js`) | 2.5.5 | 525 Ko | **153 Ko** | 124 Ko | 2026-05-22 |

À comparer aux **151 Ko brotli** de three.js WebGL complet.

Raisons de fond, au-delà du poids :
1. **Ce sont des moteurs de rendu concurrents, pas des couches.** Mol* « implémente son propre moteur de rendu web natif », pas three.js [SOURCE: PMC13032908]. Vous ne pouvez pas mettre une protéine Mol* dans votre scène three.js — il vous faudrait deux contextes WebGL. 3Dmol.js ne dépend pas de three non plus (deps npm : `pako`, `upng-js`, `iobuffer`, `netcdfjs`). NGL, lui, dépend de `three` **et** de `molstar` (registre npm) — donc il tire les deux.
2. **API orientée structure PDB, pas art direction.** Représentations (cartoon, surface, licorice), sélections, chargement de fichiers — pas de contrôle sur la couleur par instance, l'émissivité, les shaders custom, le post-traitement de *votre* scène.
3. **NGL est stagnant** — dernier push il y a plus de 15 mois. À écarter.

**Le bon usage de ces bibliothèques dans votre projet : hors ligne.** Chargez une structure PDB une fois, exportez les coordonnées d'atomes / points de contrôle du squelette dans un binaire compact (Float32Array), et rendez-les vous-même avec three.js. Vous payez 0 Ko de bundle et gardez tout le contrôle artistique. Si à l'inverse la scène devait être **scientifiquement exacte et interactive sur des structures réelles**, alors Mol* est le bon outil et le mégaoctet est justifié — mais ce n'est pas ce qui est demandé ici.

Point de calibrage sur ce que Mol* atteint : plus de 3 milliards d'atomes / 577 k instances (bouton présynaptique) à **~14–23 ms** en preset desktop, **~70 ms sur un portable Intel i7-1065G7** en preset performance, et **~240–370 ms sans LOD**. Le LOD est le facteur ×10–×15. [SOURCE: PMC13032908]

---

## 5. Effets d'ambiance : coût réel mesuré

[MESURÉ] Scène de base = 50 000 sphères instanciées animées en vertex shader, **2,27 ms** de GPU en rendu direct, à 4,54 Mpx. Post-traitement via `EffectComposer` de three.js. Mesure par répétition (K=3) + `readPixels` de synchronisation sur le framebuffer par défaut.

| Configuration | ms GPU / rendu | surcoût |
|---|---|---|
| Rendu direct (référence) | 2,27 | — |
| + `EffectComposer` nu (RenderPass + OutputPass) | 2,37 | **+0,10** |
| + `UnrealBloomPass` | 2,67 | **+0,30** |
| + `BokehPass` (profondeur de champ) | 7,77 | **+5,40** |
| + `SSAOPass` | 8,00 | **+5,63** |
| + les trois ensemble | 14,83 | **+12,46** |

**Le résultat contre-intuitif et exploitable : le bloom est presque gratuit (+0,30 ms), la profondeur de champ et le SSAO coûtent ~18× plus cher chacun.** `UnrealBloomPass` travaille sur une pyramide de mips sous-échantillonnée ; `BokehPass` et `SSAOPass` tournent à pleine résolution. Sur un budget 60 fps de 16,7 ms, DoF + SSAO consomment 11 ms — **sur la machine desktop la plus rapide disponible**.

Recommandations concrètes :
- **Bloom : oui, sans hésiter.** Meilleur rapport ambiance/coût pour une scène biomoléculaire lumineuse.
- **Profondeur de champ : oui, mais fausse.** Un vrai bokeh à pleine résolution est hors budget mobile. Alternative quasi gratuite : moduler l'opacité/la taille/le flou des sprites en fonction de `-mv.z` directement dans le shader des particules. Sur une scène de particules, personne ne voit la différence.
- **SSAO : non.** 5,6 ms pour un gain quasi nul sur des sphères convexes séparées, qui n'ont presque pas de cavités à occlure. Coupez-le et gardez l'ambiance via un éclairage hémisphérique + `FogExp2`.
- **Brouillard volumétrique — distinguez impérativement deux choses souvent confondues.** Le raymarching volumétrique (échantillonnage le long du rayon, éventuellement avec ombrage) est le plus cher de tous les effets de cette liste, à ne pas envisager sur mobile. Les *faux* brouillards — `FogExp2` (quelques instructions par fragment, coût nul) et quelques grands sprites additifs très flous en couches — donnent 80 % de l'effet pour ~1 % du coût. Pour un cytoplasme, le faux suffit largement. [Cette distinction est un raisonnement d'architecture, pas une mesure : je n'ai pas benché de raymarching volumétrique cette session.]
- Si vous prenez du post-traitement, `postprocessing` de pmndrs fusionne plusieurs effets en **une seule passe plein écran** au lieu d'en chaîner N, et utilise un triangle plein écran plutôt qu'un quad. Sa doc revendique explicitement de « minimiser le nombre d'opérations de rendu » par l'`EffectPass`. [SOURCE: pmndrs.github.io/postprocessing] Bibliothèque complète mesurée à 112 Ko gzip / 97 Ko brotli, mais tree-shakeable — n'importez que Bloom.

---

## 6. Budget de performance et stratégie de dégradation

### 6.1 Budgets

| Cible | budget image | budget GPU pratique | budget thread principal |
|---|---|---|---|
| Desktop 60 fps | 16,7 ms | ~12 ms | ~4 ms |
| Mobile 30 fps | 33,3 ms | ~24 ms | ~8 ms |

**Bundle raisonnable** pour ce type de page : **≤ 250 Ko brotli de JavaScript** au total. three.js WebGL (151 Ko) + votre code + bloom laisse de la marge. three.js WebGPU (227 Ko) le consomme presque entièrement. Mol* (1,08 Mo) le fait exploser d'un facteur 4.

### 6.2 Mobile — ce que je ne peux pas affirmer

**Je n'ai mesuré aucun appareil mobile.** L'émulation Chrome DevTools ne simule pas le GPU ; extrapoler serait de la fabrication. Ce que je peux dire honnêtement :

- Les coûts **CPU** (§1.2 : 63 ns/instance ; §3 : 18 ns/particule/pas) se transposent en les multipliant par le rapport de vitesse mono-cœur, **estimé à ×2–×3 pour un iPhone récent et ×4–×6 pour un Android milieu de gamme**. Estimation, non mesurée.
- Les coûts **fill rate** (§1.4, §5) sont ceux qui explosent le plus. Un iPhone à DPR 3 sur 390×844 rend 2,96 Mpx — comparable à mes 4,54 Mpx — mais avec un GPU d'un ordre de grandeur plus lent.
- **Le levier n°1 sur mobile est `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, voire 1,5.** Passer de DPR 3 à DPR 1,5 divise les fragments par 4.
- Le **throttling thermique** est réel : une scène stable en 60 s peut perdre 30–40 % après 5–10 minutes. Concevez la dégradation comme **dynamique**, pas comme un test unique au chargement.

Ordres de grandeur que je proposerais comme **point de départ à vérifier sur appareil réel** (non mesurés) : iPhone récent, 30 fps, DPR 2 → ~30–50 k quads instanciés animés en shader, bloom seul, pas de DoF ni SSAO. Android milieu de gamme → ~10–15 k, DPR 1,5, aucun post-traitement.

### 6.3 Détection et dégradation

**`prefers-reduced-motion`** — deux valeurs, `no-preference` et `reduce`. Réglages utilisateur : macOS 26 Tahoe → Réglages Système > Accessibilité > **Mouvement** > Réduire les animations (c'était *Moniteur* jusqu'à macOS 15) ; iOS → Réglages > Accessibilité > Mouvement ; Windows 11 → Accessibilité > Effets visuels ; Android 9+ → Accessibilité > Supprimer les animations. En JS : `window.matchMedia('(prefers-reduced-motion: reduce)')`, avec un écouteur `change` — la préférence peut changer en cours de session. MDN insiste : **c'est une préférence à honorer, pas un mandat**. [SOURCE: MDN]

Pour cette scène, `reduce` ne doit pas signifier « écran noir » : rendez **une image fixe ou quasi fixe** (particules figées ou dérive très lente, pas de rotation caméra, pas de pulsation), en gardant toute la richesse visuelle.

**Détection de GPU faible — trois niveaux, du moins au plus fiable :**

1. **`WEBGL_debug_renderer_info`** — [MESURÉ] fonctionne toujours dans Chrome et renvoie la vraie chaîne : `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max, Unspecified Version)`. Mais Safari et Tor renvoient des valeurs constantes, Firefox arrondit, et l'extension est désactivée si `privacy.resistFingerprinting` est vrai. **À traiter comme un indice, jamais comme une décision.** [SOURCE: MDN + comparaison ritter.vg]
2. **`detect-gpu`** (5.0.70, **4 Ko brotli mesuré**) — croise cette chaîne avec une table de benchmarks et renvoie un tier 0–3. Bon rapport signal/poids, mais hérite du problème précédent sur Safari.
3. **Mesure adaptative — la seule fiable, et celle que je recommande.** Mesurez le temps d'image réel sur les 60–120 premières frames, puis en continu. Si la moyenne glissante dépasse ~20 ms, dégradez d'un cran ; si elle reste sous ~12 ms pendant plusieurs secondes, remontez d'un cran (avec hystérésis pour éviter l'oscillation).

**Échelle de dégradation suggérée, dans cet ordre** (du moins au plus visible) :
1. DPR 2 → 1,5 → 1,25 → 1 *(le plus efficace, le moins visible)*
2. SSAO coupé, puis DoF coupé
3. Nombre de particules décoratives ÷2, puis ÷4
4. Bloom sur mip plus bas, puis coupé
5. Sphères détail 2 → 1 → 0
6. En dernier recours : image fixe + `prefers-reduced-motion`

Autres garde-fous : `powerPreference: 'high-performance'`, `antialias: false` (payez plutôt FXAA/SMAA dans le composer, ou rien), suspendre la boucle `requestAnimationFrame` quand l'onglet est masqué (`document.visibilityState`) ou quand le canvas sort du viewport (`IntersectionObserver`).

---

## 7. Recommandation classée

**1er — three.js r185, `WebGLRenderer` (WebGL 2).** Le choix par défaut, et pour cette scène le bon.
- Rendu : **quads instanciés** pour les particules (protéines, ions, vésicules) — jamais `THREE.Points`, à cause du plafond 64 px de Safari et de l'absence totale de points dimensionnés en WebGPU. Un `InstancedMesh` par famille visuelle. Icosaèdre détail 1–2 pour les protéines qui doivent avoir du volume.
- ADN/ARN : `TubeGeometry` généré **une fois** en espace paramétrique, déformé dans le vertex shader.
- Animation : **toute l'animation de foule dans le vertex shader** (attributs instanciés + uniforme de temps), via `onBeforeCompile` pour garder l'éclairage. C'est ce qui fait passer 200 k instances de 61 fps à 120 fps dans mes mesures, pour ~15 lignes de GLSL.
- Simulation : **CPU en JS pour tout ce qui est narratif** (quelques dizaines à quelques milliers d'agents scriptés, avec picking et déclencheurs) ; **shader pour la foule décorative**. À l'échelle demandée, aucun GPGPU n'est nécessaire.
- Post-traitement : **bloom seul**. DoF simulée dans le shader des particules. Pas de SSAO.
- Budget : ~151 Ko brotli, marche sur ~100 % du parc, comportement prévisible, aucune issue ouverte bloquante.

**2e — three.js r185, `WebGPURenderer` + TSL compute** — *seulement si* la scène dépasse ~500 k particules **ou** exige des interactions entre particules (voisinage, tri, collisions, SPH). Le compute TSL retombe automatiquement sur transform feedback en WebGL 2, donc vous n'écrivez qu'une fois. Prix à payer : **+76 Ko brotli**, Firefox toujours en repli WebGL, Safari 26 en support partiel, et trois régressions de performance ouvertes (#30560 UBO par objet, #33821 compilation des matériaux ×16–×36, #29580 pas de multiDraw). Mitigation naturelle : votre scène est massivement instanciée, ce qui est précisément le cas où #30560 ne mord pas.

**3e — PixiJS v8** — uniquement si la direction artistique bascule en 2D stylisée. Excellent moteur, chiffres officiels solides (1 M de particules à 60 fps sur M3), mais 175 Ko brotli pour renoncer à la profondeur, à l'éclairage et au ruban 3D d'ADN.

**4e — Canvas2D ou SVG+GSAP** — seulement comme **fallback** (`prefers-reduced-motion`, WebGL indisponible, tier GPU 0) ou pour un schéma pédagogique de moins de ~500 éléments. GSAP est désormais gratuit intégralement.

**Non recommandé — regl** : 24 Ko très élégants, mais projet en quasi-hibernation (le commit le plus récent est un ajout au README) et vous réécririez éclairage, instanciation et post-traitement à la main.

**Non recommandé — Mol\*, NGL, 3Dmol.js** dans la scène : moteurs de rendu concurrents (pas des couches three.js), 124 Ko à 1,08 Mo brotli, API orientée PDB. **Utilisez-les hors ligne** pour extraire des coordonnées, puis rendez vous-même. NGL est en plus stagnant (dernier push 2025-04-14).

---

## 8. Ce dont je ne suis pas sûr

1. **Tout le mobile.** Aucun appareil mobile mesuré ; l'émulation ne simule pas le GPU. Les ordres de grandeur du §6.2 sont des extrapolations à valider sur appareil réel. C'est la plus grosse lacune de ce rapport.
2. **Le plafond `gl_PointSize` = 64 de Safari** vient d'un signalement de développeur sur le forum Apple, **sans réponse officielle d'Apple**, et concerne M1/M2. Non revérifié sur M4 ni sur Safari 26. J'ai en revanche mesuré que Chrome/ANGLE renvoie 511 sur ce M4 Max. La recommandation « quads instanciés plutôt que Points » reste juste indépendamment, puisque WebGPU ne dimensionne pas les points du tout (fait, lui, vérifié dans le code three.js).
3. **Mes chiffres desktop sont un plafond haut, pas une moyenne.** M4 Max 32 cœurs GPU. Un MacBook Air M1/M2/M3 (8–10 cœurs GPU) rendra sans doute **3 à 5× moins** sur les cas GPU-bound ; le CPU (63 ns/instance, 18 ns/particule) bougera beaucoup moins. Non mesuré.
4. **Le plafond de vsync à 120 Hz masque les marges.** Toute ligne à « 8,3 ms / 120 fps » signifie « ≤ 8,3 ms », pas « = 8,3 ms ». Les mesures des §1.4, §3 et §5 utilisent répétition + synchronisation ou timer queries et ne souffrent pas de ce biais ; celles des §1.2 et §1.3 oui.
5. **La comparaison CPU/GPU du §3 dépend de la physique choisie.** ~20 opérations par particule. Une physique plus lourde déplace le seuil vers le bas, une physique triviale vers le haut. Le rapport asymptotique ×30 est plus robuste que les seuils absolus.
6. **Je n'ai pas mesuré de brouillard volumétrique raymarché**, ni les impostors sphériques, ni le screen-space fluid rendering. Les affirmations les concernant sont de la littérature (§4) ou du raisonnement d'architecture explicitement signalé comme tel (§5).
7. **Le tree-shaking de three.js** (« 110–140 Ko gzip ») est une estimation. Les chiffres de bundle mesurés portent sur les builds publiés non tree-shakés.
8. **Le support « partiel » de WebGPU dans Safari 26 selon caniuse** : non élucidé. J'ai récupéré les deux annonces WebKit concernées (blog 16993 « WWDC25 / Safari 26 beta » et blog 17333 « WebKit Features in Safari 26.0 ») : **ni l'une ni l'autre ne mentionne de limitation, de partie non implémentée ou d'écart avec la spécification**, et les compute shaders y sont explicitement annoncés. L'écart vient donc soit d'une nuance de la table caniuse que je n'ai pas identifiée, soit d'une différence de limites d'adaptateur. Cela **ne change pas la recommandation** — WebGL reste le choix n°1 quoi qu'il en soit, et le choix n°2 est déjà conditionné à ce support partiel. À vérifier sur un vrai Safari 26 avant de bâtir dessus.

---

## Sources primaires utilisées

- three.js : `gh api repos/mrdoob/three.js/releases` ; issues https://github.com/mrdoob/three.js/issues/28776 · https://github.com/mrdoob/three.js/issues/30352 · https://github.com/mrdoob/three.js/issues/30560 · https://github.com/mrdoob/three.js/issues/33821 · https://github.com/mrdoob/three.js/issues/29580 ; fichiers `src/renderers/webgl-fallback/WebGLBackend.js` et `src/materials/nodes/PointsNodeMaterial.js`
- WebGPU : https://caniuse.com/webgpu · https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/ · https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Mol* : https://pmc.ncbi.nlm.nih.gov/articles/PMC13032908/
- PixiJS : https://pixijs.com/blog/particlecontainer-v8
- postprocessing : https://pmndrs.github.io/postprocessing/public/docs/
- MDN : https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion · https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info
- gl_PointSize Apple Silicon : https://developer.apple.com/forums/thread/714831
- Screen space fluid rendering : https://dl.acm.org/doi/10.1145/1507149.1507164
- Impostors quadriques : https://www.csa.iisc.ac.in/~vijayn/research/papers/ImprovedQuadricSurfaceImpostorsICVGIP2012.pdf
- GSAP gratuit : https://webflow.com/blog/gsap-becomes-free · https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/
- Poids de bundle : registre npm (`registry.npmjs.org`) + mesure gzip -9 / brotli -q11 des fichiers dist réels servis par jsDelivr

Bancs de mesure conservés : `/private/tmp/claude-501/-Users-zakichair/25af8214-7291-491f-86a1-c3300b68227a/scratchpad/bench/index.html` (InstancedMesh + Points), `bench2.html` (animation vertex shader, plafonds, post), `bench3.html` (coût GPU par effet, fill rate), `bench4.html` (CPU vs GPGPU), `bench5.html` (GPGPU aux timer queries). Copie du rapport : `/private/tmp/claude-501/-Users-zakichair/25af8214-7291-491f-86a1-c3300b68227a/scratchpad/rapport.md`
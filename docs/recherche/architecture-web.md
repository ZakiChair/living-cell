Toutes les données sont réunies (versions npm exactes + mesures de bundle réelles faites localement avec three 0.185.1 et esbuild). Voici le rapport.

---

# Rapport d'architecture — Site vitrine/pédagogique avec scène 3D temps réel (état juillet 2026)

## 0. Versions vérifiées (registry npm, 30/07/2026)

| Paquet | Version | Licence |
|---|---|---|
| three | **0.185.1** (r185) | MIT |
| @react-three/fiber | **9.6.1** | MIT |
| @react-three/drei | **10.7.7** | MIT |
| vite | **8.2.0** (Rolldown/Oxc par défaut depuis la 8.0, mars 2026) | MIT |
| next | 16.2.12 | MIT |
| gsap | **3.15.0** | « Standard no-charge license » (gratuite, PAS open source) |
| lenis | 1.3.25 | MIT |
| motion (ex-framer-motion) | 12.43.0 | MIT |
| zustand | 5.0.14 | MIT |
| vitest | 4.1.10 | MIT |
| @playwright/test | 1.62.1 | Apache-2.0 |

Notes de contexte : Three.js publie ~1 release/mois (r184 en avril 2026) ; WebGPURenderer importable sans config depuis r171 mais WebGL reste la cible par défaut sûre. Vite 8 a remplacé esbuild+Rollup par Rolldown/Oxc (builds nettement plus rapides, migration quasi transparente depuis Vite 7).

## 1. Vite+TS+Three vanilla vs R3F vs Next.js

**Coût de rendu de R3F : nul par frame, réel au montage et en poids.** Les faits :
- Le reconciler R3F rend les composants **hors du cycle React** ; `useFrame` s'exécute directement dans la boucle `requestAnimationFrame`, identique à du vanilla. React n'intervient que quand des *props* changent. Pour une scène qui anime par mutation de refs, le surcoût par frame est négligeable (position officielle pmndrs, corroborée par les comparatifs 2026).
- Le vrai coût est ailleurs : **+164 kB gzip mesurés** (voir §2), coût de montage/démontage des composants, et surtout le **risque de mal s'en servir** (état React par frame = catastrophe).

**Pratiques anti-re-render (consensus documenté, doc « Performance pitfalls » R3F) :**
- Jamais de `setState` dans `useFrame` ; muter des `ref.current` directement.
- État global dans **zustand hors React** : `useStore.getState()` / `store.subscribe()` dans `useFrame` (lecture transiente), le hook réactif `useStore(selector)` réservé à l'UI DOM.
- `useMemo` / partage global pour géométries et matériaux ; jamais de création d'objets (`new Vector3()`) dans la boucle — les hisser hors du callback.
- `frameloop="demand"` + `invalidate()` pour les scènes qui ne bougent que sur interaction.
- Découpler UI DOM et Canvas : le `<Canvas>` dans un composant qui ne re-rend pas quand l'UI change.

**Quand le vanilla est plus sain :** scène unique pilotée par une simulation impérative (votre cas probable), millions d'objets, pipeline de rendu custom, expérimentations WebGPU, équipe d'une personne sans besoin de composabilité React. R3F gagne quand la scène est **déclarative et composée** (beaucoup d'objets conditionnels, réutilisation de composants 3D, écosystème drei : `<ScrollControls>`, `<Text>`, `<Environment>`, loaders suspendus).

**Next.js : à écarter ici.** Un site vitrine statique très visuel n'a besoin ni de SSR ni de routes serveur ; le SSR est même un piège avec WebGL (garde-fous `typeof window`, hydratation, double rendu). `next export` statique fonctionne mais ajoute de la machinerie pour zéro bénéfice. Ne se justifie que si SEO multi-pages riche + contenu éditorial important.

## 2. Chargement — chiffres mesurés (three 0.185.1, esbuild, minifié)

Mesures faites en session, pas des chiffres de blog :

| Bundle | min | gzip | brotli |
|---|---|---|---|
| Scène minimale vanilla (WebGLRenderer, mesh, lumières) | 513 kB | **130 kB** | 107 kB |
| Scène réaliste (+ GLTFLoader+Draco, OrbitControls, InstancedMesh, raycast, tone mapping) | 621 kB | **159 kB** | 131 kB |
| Minimal R3F (react + react-dom + fiber, sans drei) | 1 065 kB | **294 kB** | 237 kB |

Conclusions factuelles :
- Le cœur de Three.js (`WebGLRenderer`) est un monolithe : le tree-shaking ne descend jamais sous ~105-130 kB compressés. C'est le plancher.
- La pile React+R3F **double le poids compressé** (+164 kB gzip) avant le premier import drei. Acceptable sur desktop fibré, sensible sur mobile 3G/4G.
- Budget réaliste 2026 pour votre site : 130-250 kB gzip de JS + les **assets** (GLB Draco/meshopt, textures KTX2), qui domineront vite le JS.

**Stratégie de chargement recommandée :**
1. Shell HTML/CSS + texte pédagogique = chunk initial minuscule (rendu immédiat, bon LCP).
2. `import('./scene/…')` dynamique : Vite fait le split automatiquement ; Three.js entier part dans un chunk async.
3. Écran/état de chargement branché sur `LoadingManager` (vanilla) ou `useProgress` de drei (R3F) — vraie progression des assets, pas un spinner aveugle.
4. Lazy init au scroll seulement si la scène n'est **pas** le hero : `IntersectionObserver` avec `rootMargin: "400px"` pour précharger avant l'arrivée. Si la scène est au-dessus de la ligne de flottaison, précharger immédiatement mais différer l'init WebGL après le first paint (`requestIdleCallback`).
5. Assets : GLB compressé Draco ou meshopt, textures KTX2/basis, `<link rel="preload">` sur le modèle principal.

## 3. Animation / scroll

- **GSAP 3.15 : 100 % gratuit depuis avril 2025**, y compris **tous** les ex-plugins Club (ScrollTrigger, SplitText réécrit −50 % de taille, MorphSVG, DrawSVG…), suite au rachat par Webflow (oct. 2024). Vérifié sur la licence officielle : gratuit **y compris usage commercial** ; la seule restriction est de ne pas l'embarquer dans un outil no-code d'animation concurrent de Webflow. **Attention : gratuit ≠ open source** — Webflow garde la propriété intellectuelle, licence propriétaire « no-charge ». Pour un site vitrine c'est sans conséquence pratique.
- **Motion 12 (ex-Framer Motion)** : MIT, devenu indépendant de Framer, existe en vanilla JS (~12 kB gzip) et `motion/react`. Excellent pour micro-interactions UI React ; **inférieur à ScrollTrigger** pour le scrollytelling complexe (pin, scrub, timelines synchronisées sur une scène 3D).
- **Lenis 1.3** : MIT, ~4 kB, conçu explicitement pour synchroniser un scroll lissé avec des scènes WebGL et s'intègre officiellement à ScrollTrigger (`lenis.on('scroll', ScrollTrigger.update)`).

**Verdict** : GSAP ScrollTrigger (+ Lenis si scroll lissé voulu) est l'outil standard 2026 pour du scrollytelling 3D. `IntersectionObserver` natif suffit seulement pour des déclenchements binaires (fade-in de sections), pas pour du scrub.

## 4. Déploiement statique (état 2026)

| Plateforme | Gratuit | Limites | Piège |
|---|---|---|---|
| **Vercel Hobby** | oui | 100 GB/mois, builds CI intégrés | **usage non commercial uniquement** (CGU) |
| **Netlify Free** | oui | passé aux **crédits** : 300/mois ≈ **15 GB** bande passante, ~20 deploys | usage commercial autorisé, mais quota serré pour un site lourd en GLB |
| **GitHub Pages** | oui | 100 GB/mois, 1 GB de site, 10 builds/h | repo public obligatoire (gratuit), pas de headers custom (COOP/COEP, cache long) |
| **Cloudflare Pages** | oui | bande passante non mesurée | alternative solide si les assets sont lourds |

CI simple : un workflow GitHub Actions `npm ci && npm run build` + action de déploiement officielle (toutes en ont une). Un site Vite statique se déploie partout à coût zéro ; le critère discriminant est le **poids des assets 3D** × trafic (Netlify 15 GB se consomme vite avec des GLB de 5 MB) et la clause non-commerciale de Vercel.

## 5. Tests d'un projet essentiellement visuel

Ce qui vaut la peine :
1. **Vitest sur le moteur de simulation pur** (le meilleur ROI) : la logique métier/physique/pédagogique en fonctions pures sans import de `three` côté rendu — tests rapides, déterministes, sans GPU. Les types purs de Three (`Vector3`, `Matrix4`, `MathUtils`) sont utilisables dans Node sans WebGL, donc testables unitairement.
2. **Playwright pour le parcours** : navigation, sections pédagogiques, états de l'UI, présence du canvas, absence d'erreurs console (`page.on('pageerror')`), et le contrat « la scène a démarré » (évaluer un flag `window.__sceneReady` ou compter les frames).
3. **Captures de référence (`toHaveScreenshot`)** : réaliste en CI, avec réglages. En headless, Chromium rend via **ANGLE + SwiftShader** (rasterizer logiciel) : déterministe sur une même image Docker, mais **différent du rendu GPU local** → générer les baselines **dans le conteneur CI** (`--update-snapshots` dans le même environnement), figer la scène (graine RNG, `clock` fixe, désactiver l'animation via un query param `?freeze=1`), et tolérer `maxDiffPixelRatio: 0.01-0.02`. L'antialiasing et les tone mappings varient entre versions de SwiftShader — épingler la version de l'image Playwright.
4. **Si le rendu logiciel ne suffit pas** (post-processing lourd, différences trop grandes) : mode headed + `xvfb-run` sur runner Linux, voire runners GPU GitHub Actions (payants). Pour un site vitrine, SwiftShader + scène figée suffit dans 90 % des cas.
5. **Tests de perf** : pragmatiquement, un test Playwright qui mesure le FPS moyen sur 5 s (`requestAnimationFrame` compté dans `page.evaluate`) avec un seuil grossier (> 25-30 fps en SwiftShader) attrape les régressions catastrophiques (fuite d'objets, matériaux recréés par frame). Ne pas chercher plus fin en CI : le rendu logiciel n'est pas représentatif du GPU réel. Compléter par un audit Lighthouse (poids/LCP) en CI.
6. **Ne pas tester** : le pixel-perfect cross-browser du rendu 3D, les shaders unitairement — coût/bruit énorme, valeur faible. Les défauts visuels fins se jugent à l'œil.

## 6. Structure de fichiers recommandée

```
src/
├── simulation/        # PUR : zéro import DOM/renderer. Testé Vitest.
│   ├── model.ts       # état, types
│   ├── step.ts        # step(état, dt) → état  (déterministe, graine injectable)
│   └── __tests__/
├── scene/             # couche rendu Three.js (chunk lazy)
│   ├── createScene.ts # init renderer/caméra/lumières
│   ├── objects/       # meshes, matériaux (lisent l'état de simulation)
│   ├── loaders.ts     # GLB/KTX2 + LoadingManager
│   └── sync.ts        # simulation → objets 3D (le seul pont)
├── content/           # pédagogie = DONNÉES (fr.json / MD / TS typés)
│   └── etapes.ts      # textes, séquences, paramètres par section
├── ui/                # DOM : sections, overlays, contrôles, loader
├── scroll/            # Lenis + ScrollTrigger : timeline scroll → simulation/scene
└── main.ts            # shell léger + import() dynamique de scene/
e2e/                   # Playwright + captures de référence
```

Règles : `simulation/` n'importe jamais `scene/` (dépendance unidirectionnelle) ; le contenu pédagogique est de la donnée, pas du code, pour itérer sur les textes FR sans toucher au moteur ; `scroll/` est le seul endroit qui connaît à la fois la timeline et la simulation.

## 7. Recommandation classée

1. **Vite 8 + TypeScript + Three.js vanilla + zustand (vanilla store) + GSAP ScrollTrigger + Lenis** — **choix recommandé.** Bundle moitié moins lourd (130-160 kB gzip vs ~300), zéro couche d'abstraction entre la simulation et le rendu, pas de risque de re-renders, testabilité maximale de la simulation pure. Pour UN site avec UNE grosse scène pilotée par un moteur de simulation, la composabilité de R3F n'apporte rien qui justifie son poids.
2. **Vite + React + R3F 9 + drei 10** — si l'UI pédagogique autour de la scène est riche et interactive (quiz, panneaux dynamiques, état partagé complexe) ou si la scène est fortement compositionnelle. Coût par frame nul si bien utilisé, mais +164 kB gzip et discipline requise (refs, zustand transient, `frameloop="demand"`).
3. **Next.js 16** — seulement si le site devient multi-pages éditorial avec besoin SEO fort. Sur-machinerie pour un one-page.

Déploiement : **Cloudflare Pages ou GitHub Pages** si le site peut être public et/ou les assets lourds ; Vercel Hobby si strictement non commercial ; éviter Netlify Free pour un site à gros GLB (15 GB/mois).

## 8. Pièges connus

- **npm affiche three `0.x`** : versionnement r-releases, breaking changes possibles à chaque release mensuelle — épingler la version exacte, lire le migration guide à chaque bump.
- **drei 10 exige R3F 9 + React 19** ; les vieux tutos drei v9/React 18 sont périmés. R3F a aussi dû suivre le reconciler interne de React 19.2 — garder fiber et react synchronisés.
- **GSAP n'est pas MIT** : gratuit mais propriétaire (Webflow). Pas de fork possible, clause anti-concurrent no-code.
- **`setState` dans `useFrame`** = le piège n°1 R3F ; symétriquement en vanilla, créer des `Vector3`/matériaux dans la boucle = pression GC et chute de FPS.
- **Captures Playwright** : baselines générées sur macOS local ≠ rendu SwiftShader CI → toujours générer les baselines dans le conteneur, figer animation et RNG.
- **Vite 8/Rolldown** : quelques plugins Rollup legacy incompatibles ; vérifier `vite-plugin-glsl` et équivalents avant migration (repo rolldown-vite archivé en mars 2026, tout est dans Vite 8).
- **Tree-shaking Three.js** : ne pas espérer de miracle — le renderer est monolithique ; les vrais gains sont sur les assets (Draco/KTX2) et le code splitting, pas sur le tree-shaking du cœur.
- **Perte de contexte WebGL** (mobile, onglets multiples) : écouter `webglcontextlost`/`webglcontextrestored`, sinon écran noir silencieux.
- **GitHub Pages** : pas de headers custom → impossible d'activer COOP/COEP si un jour vous voulez SharedArrayBuffer (simulation dans un worker WASM multithread).

Sources : [npm registry](https://registry.npmjs.org) (versions vérifiées en direct), mesures de bundle locales (esbuild, three 0.185.1), [Vite 8 announcement](https://vite.dev/blog/announcing-vite8), [R3F releases](https://github.com/pmndrs/react-three-fiber/releases), [R3F v9 migration guide](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide), [R3F performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls), [Webflow makes GSAP 100% free](https://webflow.com/updates/gsap-becomes-free), [GSAP standard license](https://gsap.com/standard-license/), [Codrops — free GSAP plugins](https://tympanus.net/codrops/2025/05/14/from-splittext-to-morphsvg-5-creative-demos-using-free-gsap-plugins/), [Lenis](https://github.com/darkroomengineering/lenis), [Motion](https://motion.dev/), [Playwright WebGL on GPU (Promaton)](https://blog.promaton.com/testing-3d-applications-with-playwright-on-gpu-1e9cfc8b54a9), [createIT — headless WebGL Playwright](https://www.createit.com/blog/headless-chrome-testing-webgl-using-playwright/), [Playwright CI docs](https://playwright.dev/docs/ci), [Vercel free tier 2026](https://deploywise.dev/blog/vercel-free-tier-limits-2026), [Netlify free tier 2026](https://netli.fyi/blog/netlify-pricing-and-limits), [GitHub Pages limits](https://agentdeals.dev/vendor/github-pages), [three.js 2026 overview](https://www.utsubo.com/blog/threejs-2026-what-changed), [R3F vs Three.js 2026](https://www.creativedevjobs.com/blog/react-three-fiber-vs-threejs).
## Critique de complétude — 8 manques réels

---

### 1. L'arithmétique crowding × budget de rendu n'a jamais été faite. Elle interdit le produit tel que décrit.

Les deux rapports donnent les deux moitiés du calcul et personne ne les a multipliées. Science : 300 mg/mL, **20–30 % du volume**. Rendu : **~330 k instances animées en shader à 60 fps** sur M4 Max (~200 k avec marge), ~30–50 k estimé sur iPhone.

**Le chiffre dépend entièrement d'une décision de conception jamais énoncée : qu'est-ce qu'un objet rendu ?**

| Unité rendue | Objets / µm³ à 25 % | Volume finançable à 200 k | Arête du cube |
|---|---|---|---|
| Monomère ~50 kDa (~60 nm³) | ~4 × 10⁶ | 0,05 µm³ | **~0,37 µm** |
| Complexe reconnaissable, type ribosome (~2 500–3 000 nm³) | ~8–9 × 10⁴ | ~2,3 µm³ | **~1,3–1,5 µm** |

Facteur 4 en arête, 60 en volume, **selon un choix que personne n'a pris**. Sur mobile, diviser encore par ~6 (cube de 0,2 à 0,7 µm).

Dans les deux lectures, la conclusion tient : une cellule mammifère (~2 000 µm³) demande **10⁸ à 10¹⁰ objets**, soit 3 à 5 ordres de grandeur au-dessus du budget. **« Curseur de densité 0→100 % sur une cellule » — la signature de la DA n°1 — est physiquement infaisable.** Ce curseur n'existe que dans une dalle sub-micronique. C'est exactement ce que peint Goodsell, et personne ne l'a remarqué.

Deux corollaires que les rapports ratent aussi :
- **Occlusion** : à 100 % de densité, >99 % des instances sont invisibles derrière la première couche. Les dessiner est du gaspillage pur — il faut une dalle à profondeur bornée, pas un volume.
- **Les filaments sont quasi gratuits** : actine et microtubules portent une part énorme du volume encombré et sont de la géométrie tubulaire continue. Un plan encombré n'est donc pas uniformément cher — l'arbitrage est par famille, pas global.
- **Les deux interactions signature sont incompatibles à leurs extrêmes** : « filtrer = désaturer, jamais masquer, pour préserver le crowding » + densité 100 % = on paie des millions d'instances désaturées que personne ne voit.

**Comblement** : trancher l'unité rendue *avant* la DA, puis produire deux objets distincts — (a) une **vue cellule** assumée schématique et étiquetée comme telle, (b) une **« boîte de vérité »** de 0,3 à 1,5 µm où vivent le curseur de densité et le crowding honnête. Prototyper (b) sur un vrai iPhone avant de figer quoi que ce soit.

---

### 2. Les rapports se contredisent sur l'existence même d'une simulation — et c'est l'argument central du choix d'architecture.

Archi place `simulation/step.ts` (pur, déterministe, graine injectable) au centre, et **justifie vanilla plutôt que R3F précisément par « UNE grosse scène pilotée par un moteur de simulation »**. Rendu recommande de mettre **toute l'animation de foule dans le vertex shader** — fonction fermée d'un uniforme de temps, zéro état CPU, et c'est ce qui fait passer 200 k instances de 61 à 120 fps.

Si Rendu gagne, `simulation/` ne contient plus qu'une poignée d'agents narratifs, la couche testable en Vitest se réduit à peu de chose, et **le principal argument pour vanilla s'évapore** (il reste le poids : +164 ko gzip, ce qui est un argument différent et plus faible). Personne n'a réconcilié.

**Comblement** : décider la répartition foule/narratif *avant* de choisir le framework. Règle proposée : tout ce qui a besoin d'être lu par le CPU (picking, déclencheur, étiquette, événement scripté) reste en JS ; tout le reste est une fonction du temps en GLSL. Puis re-poser la question vanilla/R3F.

---

### 3. Il n'y a aucun brief — et la question la plus tranchante n'a pas été posée : l'axe du site est-il l'échelle ou le temps ?

Design propose « Powers of Ten cellulaire » (**scroll = échelle**). Science structure ses quatre sujets par **facteur temporel** (×1 000 ralenti pour les pompes, ×100 accéléré pour le trafic, ×20 pour la traduction, ×20 → ×10 000 pour l'ADN). **Les deux ne peuvent pas être simultanément la colonne vertébrale.** Si le scroll est l'échelle, le budget temps de Science n'a plus de support ; si le scroll est le temps, la DA n°3 disparaît.

Les autres questions à poser avant la première ligne :
1. **« Live » veut dire quoi ?** Simulé en temps réel, ou branché sur des données réelles (il n'y en a aucune) ?
2. **Public** : grand public, lycée, étudiants en bio, recruteurs ? Ça décide seul entre les 3 DA.
3. **Langue** : CLAUDE.md impose le français ; **toutes les sources sont en anglais** et le vocabulaire scientifique FR n'est nulle part. Qui écrit les textes ?
4. **Périmètre** : les 4 phénomènes, ou 1 fait très bien ? Un phénomène = simulation + DA + textes + a11y + mobile.
5. **Échéance et usage** : pièce de portfolio (contexte CV) ou produit vivant ? **Si commercial, Vercel Hobby est exclu par ses CGU** (déjà relevé par Archi, jamais tranché).

---

### 4. Le contour cel-shading — signature de la DA recommandée *et* obligation d'accessibilité — n'a jamais été mesuré.

Le rapport design fait du contour 1 px « non pas un choix esthétique mais une obligation », parce que trois de ses six teintes échouent au contraste 3:1. Le rapport rendu a mesuré bloom (+0,30 ms), DoF (+5,40), SSAO (+5,63) — **jamais l'outline**. Deux pièges non énoncés :

- **Inverted hull sur InstancedMesh** : l'offset est en espace objet. Sur un icosaèdre détail 1 (80 triangles) le contour est facetté, et **sa largeur varie avec la distance** — épais au premier plan, disparu au fond. Or ce qu'il faut est une largeur constante à l'écran. Ce n'est pas un swap, c'est un shader à écrire.
- **Détection de bord en post-traitement** : exige un prepass normal + profondeur pleine résolution, soit **la classe de coût du SSAO mesuré à 5,6 ms** — le budget desktop entier.
- Et aucune des deux voies ne donne le **contour intérieur entre instances de même teinte** qui se recouvrent, c'est-à-dire précisément ce que la lisibilité dans un amas exige.

**Comblement** : un banc outline (hull + screen-space width, et post-process edge) sur 100 k instances, **avant** de valider la DA n°1. Si les deux échouent, la DA n°1 tombe et la palette doit être re-validée sans dépendre du contour.

---

### 5. Rien n'est chiffré côté production. Trois chantiers invisibles.

**(a) Pipeline d'assets moléculaires.** Rendu dit « extraire les coordonnées via Mol* hors ligne, puis rendre soi-même » — en une phrase. Jamais dit : quelles structures, combien, quel outil, qui décime, comment on obtient les **silhouettes reconnaissables** dont dépend toute la doctrine Goodsell. C'est probablement le plus gros coût caché du projet.
*Licences vérifiées cette session* : données PDB = **CC0 1.0**, usage commercial libre. **Illustrations Goodsell / Molecule of the Month = CC-BY-4.0** — réutilisables, mais **l'attribution doit figurer dans la page livrée** si une image devient texture, calque ou tracé de référence. Un PDF Goodsell est déjà téléchargé dans `tool-results/` : le piège est actif, pas théorique.

**(b) Mobile.** Rendu l'admet : **zéro appareil mesuré**, et le qualifie lui-même de plus grosse lacune. Non traité en plus : le mode de panne réel d'iOS — dépassement mémoire → `CONTEXT_LOST_WEBGL` → canvas blanc ou rechargement d'onglet (documenté massivement, incl. CesiumJS sur iOS 18.2/18.3). Et **aucune maquette mobile** du HUD, du panneau latéral, du scrollytelling.
*Comblement* : matrice d'appareils (1 iPhone récent + 1 Android milieu de gamme, testés physiquement), handlers `webglcontextlost`/`webglcontextrestored` en exigence de départ, maquette mobile avant le code.

**(c) Couche DOM accessible.** Design la prescrit (un focusable par point d'intérêt, `aria-live`, sommaire cliquable qui saute la caméra) et cite `@react-three/a11y` comme outillage. **Vérifié : dernière publication il y a ~3 ans (v3.0.0), 3 dépendants.** Ce n'est pas une dépendance planifiable. Non décidé non plus : **étiquettes en DOM projeté** (reflow par frame, mais gratuit en a11y et en i18n FR) **ou SDF dans le canvas** (rapide, mais invisible aux lecteurs d'écran) — les deux rapports supposent implicitement des réponses opposées.
*Comblement* : DOM projeté + anti-collision, couche a11y chiffrée à part (3–5 j), cible WCAG 2.2 AA énoncée explicitement.

---

### 6. Le badge de facteur temporel est présenté comme le pilier de l'honnêteté, mais ce n'est pas un contrat de données — et il lui manque un second champ.

Règle d'or n°1 de Science : un facteur unique affiché par scène. Or **le facteur s'inverse à l'intérieur d'un même sujet** (trafic ×100 accéléré, mais NPC ×200 ralenti ; ADN ×20 puis ×10 000). Et la scène présentée comme la plus facile (traduction, « un facteur unique ×20 ») contient déjà une **ellipse** : une protéine de 300 aa ferait 17 minutes d'écran → « couper » et afficher un compteur. **Couper n'est pas un facteur.** Le compteur et le badge racontent alors deux histoires différentes exactement là où le rapport promet qu'ils ne le peuvent pas.

Côté archi, `content/etapes.ts` n'a **aucun champ** pour tout ça.

**Comblement** : contrat à deux champs — `facteur` **et** `ellision` (ce qui a été sauté, et combien) — dérivés de la **même constante** que le `dt` de simulation, avec un test Vitest qui échoue si le badge diverge de l'animation.

---

### 7. Personne n'a prévu de relecture humaine par un biologiste, ni de politique d'affichage des valeurs non vérifiées.

Le rapport science est solide (82 % Tier A, BNID cités), mais il reste **produit par un LLM et destiné à être publié sous le nom de Zaki, à visée pédagogique publique**. Les valeurs Tier B (concentrations ioniques individuelles, dimensions ADN, longueur du tunnel de sortie, fraction protéique de la membrane) sont marquées dans le rapport — **rien ne garantit qu'elles resteront marquées à l'écran**, et c'est précisément là que le site se ferait démonter.

**Comblement** : 2 h de relecture par un biologiste réel avant mise en ligne ; règle typographique qui **interdit d'afficher une valeur Tier B avec plus d'un chiffre significatif** et impose la formule « ordre de grandeur » ; les BNID en infobulle sur les chiffres Tier A (c'est aussi le marqueur de crédibilité n°7 de Design : la provenance citable).

---

### 8. Aucun critère de succès vérifiable, aucun garde-fou de performance — ce qui contredit directement CLAUDE.md §4.

Quatre rapports, des dizaines de mesures, et pas une seule ligne qui dise à quoi ressemble « fini ». Sans ça, le projet boucle indéfiniment sur l'esthétique.

**Comblement** — gates chiffrées, posées maintenant :
- **≥ 55 fps** sur le Mac de dev, **≥ 28 fps** sur l'iPhone cible, mesurés sur la scène la plus dense ;
- **≤ 250 ko brotli** de JS (le seuil que Rendu propose déjà, jamais promu en gate) ;
- **LCP < 2,5 s** en 4G simulée ;
- **0 erreur console**, y compris `webglcontextlost` non géré ;
- axe a11y sans violation critique + parcours clavier complet sans souris ;
- test Playwright FPS + budget de bundle **en CI** (Archi propose le FPS SwiftShader — utile seulement contre les régressions catastrophiques, à compléter par une passe manuelle sur appareil réel avant chaque release).

---

**Le seul point à traiter avant tout autre** : le n°1. Tant que « qu'est-ce qu'un objet rendu » et « quel volume montre-t-on à densité vraie » ne sont pas tranchés, la DA, le framework, le budget mobile et le pipeline d'assets sont tous fondés sur une hypothèse fausse d'un facteur 60 en volume.

Sources vérifiées cette session : [PDB CC0 / wwPDB usage policies](https://www.wwpdb.org/about/usage-policies) · [RCSB policies](https://www.rcsb.org/pages/policies) · [Goodsell Gallery PDB-101 (CC-BY-4.0)](https://pdb101.rcsb.org/sci-art/goodsell-gallery) · [@react-three/a11y npm](https://www.npmjs.com/package/@react-three/a11y/v/0.3.0) · [pmndrs/react-three-a11y](https://github.com/pmndrs/react-three-a11y) · [Vite 8.0 announcement](https://vite.dev/blog/announcing-vite8) · [three.js — WebGL2 context stays in memory on Safari #30047](https://github.com/mrdoob/three.js/issues/30047) · [WebGL crashing in iOS 18.2/18.3 (Apple Developer Forums)](https://developer.apple.com/forums/thread/778735) · [Browser memory limit on iOS](https://developer.apple.com/forums/thread/741624)
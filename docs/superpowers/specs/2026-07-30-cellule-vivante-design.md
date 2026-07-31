# Cellule vivante — document de design

**Date** : 2026-07-30
**Auteur** : Zaki Chair, avec Claude
**Statut** : conception validée, implémentation non commencée

---

## 1. Intention

Un site web qui présente une cellule eucaryote animale comme un système **vivant, mesuré et manipulable**, destiné à des étudiants en biologie (lycée, prépa, licence).

Quatre phénomènes sont traités :

| | Phénomène | Lot |
|---|---|---|
| A | Échanges de minéraux à la surface (transport membranaire) | 1 |
| B | Échanges et trafic de protéines (voie sécrétoire, import, dégradation) | 4 |
| C | Traduction ARNm → protéine dans le ribosome | 2 |
| D | Coupures des brins d'ADN et d'ARN (topoisomérases, CRISPR, épissage) | 3 |

**Critère de réussite** : un étudiant qui a passé vingt minutes sur le site sait citer trois ordres de grandeur justes, sait expliquer pourquoi un canal et une pompe ne vont pas à la même vitesse, et a vu de ses yeux ce qui arrive à une cellule dont on bloque la pompe Na⁺/K⁺.

**Critère d'échec** : le site est beau et l'étudiant n'en retient qu'une ambiance.

Ce critère est le point du projet, et il ne se mesure pas en images par seconde. Il est vérifié par un **auto-contrôle de trois questions à la fin de chaque chapitre** — du contenu dans `contenu/`, pas de la machinerie nouvelle. Une question porte sur un ordre de grandeur, une sur un mécanisme, une sur une idée fausse courante. Un chapitre dont on ne sait pas écrire les trois questions est un chapitre qui n'enseigne rien, et c'est un signal à traiter au moment de la rédaction, pas après.

**Ampleur.** L'architecture retenue est estimée à **45–60 jours-homme**, dont environ **35 % hors code** : rédaction française, production des silhouettes moléculaires, relecture par un biologiste, maquettes mobiles, accessibilité. C'est le chiffre le plus décisif de ce document.

### Hypothèses posées

- **Cellule eucaryote animale générique.** Pas de neurone (les potentiels d'action sont hors périmètre), pas de cellule végétale, pas de procaryote. Les valeurs bactériennes n'apparaissent qu'en comparaison explicite.
- **Français** pour toute l'interface, le contenu et les commentaires de code. Toutes les sources sont anglophones : la rédaction française est un chantier à part entière (§12).
- **Site statique**, sans backend, sans compte utilisateur, sans base de données.
- **Usage pédagogique et portfolio**, non commercial au sens marchand. Le déploiement retenu (§13) reste néanmoins compatible avec un usage commercial, pour ne pas se fermer de porte.

---

## 2. Les sept décisions fondatrices

Tout le reste du document en découle. Elles sont classées par gravité : revenir sur la première impose de tout réécrire.

### D1 — La simulation est à l'échelle des compartiments, jamais des molécules

Le moteur n'a pas d'entité « ion Na⁺ ». Il intègre une trentaine de variables d'état : concentrations par compartiment, potentiel de membrane, pool d'ATP, nombre d'ARNm, vitesse d'élongation. Des grandeurs et des flux, sur un pas de temps fixe.

**Pourquoi c'est non négociable.** Une cellule contient ~10⁹ ions Na⁺. Une simulation à agents plafonne vers quelques dizaines de milliers d'entités, soit un millionième du réel : on échoue simultanément sur la performance et sur la justesse, et l'étudiant en tire une intuition fausse de la densité et des cinétiques.

### D2 — Le rendu est un échantillonnage déclaré de l'état, pas l'état lui-même

Ce qui est à l'écran illustre le modèle. Le modèle dit 10⁷ Na⁺ par seconde, on en dessine 40, et **le facteur d'échantillonnage est affiché**, pas caché.

Corollaire : la couche de rendu lit l'état du moteur, ne l'écrit jamais. Le pont est unidirectionnel et tient dans un seul fichier.

**Répartition foule / narratif, à trancher une fois pour toutes** : tout ce que le processeur doit relire — sélection au clic, déclenchement d'événement, étiquette, séquence scriptée — reste en JavaScript. Tout le reste est une fonction du temps écrite en GLSL, sans état côté processeur. C'est ce qui fait passer 200 000 instances de 61 à 120 fps, et c'est ce qui garde le moteur mince et testable.

### D3 — Il n'y a pas d'horloge globale ; chaque scène déclare son facteur *et* son ellision

Les quatre phénomènes vivent sur des échelles de temps incompatibles : transport ionique en millisecondes, traduction d'une protéine en secondes, trajet RE→Golgi→membrane en dizaines de minutes, réparation d'une cassure double-brin en heures. « Tout à vitesse réelle » est impossible, pas seulement coûteux.

| Scène | Facteur | Justification |
|---|---|---|
| Membrane — pompe et canaux | ralenti ×1 000 | un cycle de pompe (7–20 ms) devient lisible en 7–20 s |
| Traduction et transcription | ralenti ×20 | un codon (167 ms chez le mammifère) devient 3,3 s |
| Trafic vésiculaire | **accéléré ×100** | un transit RE→surface (20–60 min) tient en 20–40 s |
| Import nucléaire | ralenti ×200 | passage < 10 ms → 2 s — **inversion de facteur, sous-scène séparée** |
| Épissage | accéléré ×50 | 5–10 min → 6–12 s |
| Cas9 accroché au produit | accéléré ×10 000 | minutes à heures → 3 s |

Le passage de « accéléré » à « ralenti » dans un même plan est interdit : on découpe en sous-scènes.

**Un facteur ne suffit pas.** La scène réputée la plus simple contient déjà une ellipse : une protéine de 300 acides aminés prendrait dix-sept minutes d'écran à ralenti ×20. On coupe après une dizaine de codons et on affiche un compteur — mais **couper n'est pas ralentir**, et à cet instant le badge et le compteur racontent deux histoires différentes.

Le contrat d'une scène porte donc **deux champs** : `facteur` (le rapport de vitesse) et `ellision` (ce qui a été sauté, et combien). Les deux dérivent de la même constante que le pas de temps de la simulation, et un test échoue si le badge diverge de ce que l'animation fait réellement.

### D4 — Les perturbations sont réversibles et le système revient à un repos défini

Le moteur a un état stationnaire explicite et une dynamique de relaxation, pas seulement une intégration vers l'avant. On bloque la pompe à l'ouabaïne, le potentiel dérive, les gradients s'effondrent ; on retire l'ouabaïne, la cellule récupère.

Sans ça, l'étudiant casse le système en dix secondes et n'apprend rien.

### D5 — Un fichier de données sourcé est l'origine unique de tout chiffre affiché

Une valeur à l'écran = une citation. Trois niveaux de confiance :

- **[A]** valeur récupérée d'une source primaire (BNID, DOI, chapitre Alberts) — citable telle quelle, **BNID affiché en infobulle** ;
- **[B]** ordre de grandeur de manuel non re-vérifié — **interdit d'afficher avec plus d'un chiffre significatif**, et toujours accompagné de la formule « ordre de grandeur » ;
- **[?]** la littérature ne tranche pas — on l'écrit, et cette prudence affichée est un gage de sérieux plutôt qu'une faiblesse.

Aucune constante numérique biologique ne vit dans un shader, un composant ou un fichier de scène.

**Ces données ont été rassemblées par un modèle de langage et vont être publiées sous le nom de Zaki, à visée pédagogique publique.** Une relecture par un biologiste réel, avant mise en ligne, est une condition de livraison, pas une option.

### D6 — Aucune molécule ne sait où elle va

Le mouvement est brownien, les rencontres sont des collisions, et **les essais ratés sont majoritaires et visibles**. C'est le critère de crédibilité que la quasi-totalité des animations rate — plus encore que la densité.

Conséquence concrète : quand un ARNt entre dans le site A du ribosome, on montre trois à cinq ARNt qui percutent et rebondissent avant l'accepté. Cette accumulation de rejets *est* le mécanisme de la fidélité de 10⁻³–10⁻⁴. La supprimer supprime la biologie.

Technique retenue (celle de Drew Berry) : animation par images-clés pour scripter le récit, mouvement stochastique superposé par-dessus.

### D7 — L'encombrement vrai n'existe que dans une boîte sub-micronique

**C'est le résultat qui a failli passer inaperçu, et il contraint tout.**

Une cellule mammifère fait ~2 000 µm³. À 25 % d'occupation volumique, elle contient entre **10⁸ et 10¹⁰ objets** selon ce qu'on appelle un objet. Le budget de rendu est de ~200 000 instances animées avec marge sur une machine de bureau rapide. L'écart est de **trois à cinq ordres de grandeur**.

*Le budget d'un téléphone n'est pas chiffré ici : aucun appareil n'a été mesuré, et la spec ne s'autorise pas plus de chiffre inventé sur elle-même que sur la biologie (§9.5).*

Le volume finançable dépend entièrement d'un choix jamais énoncé :

| Unité rendue | Objets / µm³ à 25 % | Volume tenable à 200 k | Arête du cube |
|---|---|---|---|
| Monomère ~50 kDa | ~4 × 10⁶ | 0,05 µm³ | **~0,37 µm** |
| Complexe reconnaissable (type ribosome) | ~8–9 × 10⁴ | ~2,3 µm³ | **~1,3–1,5 µm** |

Facteur 4 en arête, 60 en volume. **Décision retenue : l'unité rendue est le complexe reconnaissable**, cohérente avec la doctrine Goodsell — la silhouette porte l'information, donc l'objet minimal est ce qui a une silhouette identifiable.

Il en découle deux objets distincts et honnêtement étiquetés :

- **La vue cellule** (bande 1) est **assumée schématique**. Elle porte un badge d'ellision permanent : ce n'est pas une cellule à densité vraie, et le site le dit. C'est plus honnête qu'un encombrement à 2 % qu'on prétendrait réel.
- **La boîte de vérité** (bandes 2 et 3), une dalle de **0,3 à 1,5 µm** d'arête à profondeur bornée, où vivent l'encombrement réel et le curseur de densité.

Trois corollaires :

1. **Occlusion.** À 100 % de densité, plus de 99 % des instances sont cachées derrière la première couche. Les dessiner est du gaspillage pur : il faut une **dalle à profondeur bornée**, pas un volume.
2. **L'arbitrage est par famille, pas global.** Les filaments — actine, microtubules — portent une part énorme du volume encombré et sont de la géométrie tubulaire continue, donc quasi gratuits. Un plan encombré n'est pas uniformément cher.
3. **Les deux gestes signature sont incompatibles à leurs extrêmes.** « Filtrer en désaturant plutôt qu'en masquant » plus « densité à 100 % » revient à payer des millions d'instances désaturées que personne ne voit. Au-delà d'un seuil de densité, le filtre bascule en masquage réel, et l'interface le dit.

---

## 3. Architecture

### 3.1 Vue d'ensemble

```
┌──────────────────────────────────────────────────────────┐
│  contenu/          textes, chiffres sourcés, chapitres   │
│                    (données typées, aucune logique)      │
└────────────────────────┬─────────────────────────────────┘
                         │ lu par
       ┌─────────────────┴──────────────────┐
       ▼                                    ▼
┌──────────────────┐              ┌────────────────────────┐
│  simulation/     │─── état ───▶ │  scene/                │
│  PUR             │  (lecture    │  Three.js              │
│  zéro import 3D  │   seule)     │  bandes d'échelle      │
│  déterministe    │              │  échantillonnage       │
│  testé Vitest    │              └───────────┬────────────┘
└────────▲─────────┘                          │
         │ perturbations                      ▼
         │                          ┌────────────────────────┐
         └──────────────────────────│  ui/  DOM              │
                                    │  HUD, curseurs, fiches │
                                    └────────────────────────┘
```

**Règle de dépendance** : `simulation/` n'importe jamais `scene/` ni le DOM. C'est ce qui rend les critères de réussite testables sans GPU.

### 3.2 Le moteur — `simulation/`

Fonctions pures. Signature centrale :

```
avancer(etat: Etat, dt: number, perturbations: Perturbations) → Etat
```

- **Déterministe à graine injectable.** Aucun `Math.random()` implicite : le générateur est passé dans l'état. Deux exécutions à même graine donnent la même trajectoire — c'est ce qui rend les captures de référence possibles.
- **Pas de temps fixe** (par exemple 1 ms simulée), découplé de la fréquence d'affichage. Le rendu consomme l'état, il ne cadence pas le modèle. Un onglet à 30 fps ne doit pas simuler une cellule deux fois plus lente qu'un onglet à 60 fps.
- **État stationnaire calculable** et testable indépendamment de toute trajectoire.

Un module par phénomène (`membrane.ts`, `traduction.ts`, `coupures.ts`, `trafic.ts`), chacun avec son état et ses flux, plus un `etat.ts` qui les compose.

### 3.3 Le rendu — `scene/`

Three.js r185, `WebGLRenderer` (WebGL 2). Vanilla, pas React Three Fiber : la pile React+R3F double le poids compressé (+164 ko gzip mesurés) sans rien apporter à une scène unique pilotée par un moteur impératif.

Règles issues des bancs de performance réels (§9) :

- **Jamais `THREE.Points`.** Safari sur Apple Silicon plafonne `gl_PointSize` à 64 px, et WebGPU ne dimensionne pas les points du tout. On utilise des **quads instanciés** : identiques partout, sans plafond de taille.
- **Un `InstancedMesh` par famille visuelle.** Icosaèdre détail 1 ou 2 pour ce qui doit avoir du volume ; la densité de triangles n'est pas le facteur limitant (32 M de triangles par image sans effet mesurable).
- **Toute l'animation de foule dans le vertex shader**, via `onBeforeCompile` — on garde l'éclairage, les ombres et le tone mapping de Three.js pour une quinzaine de lignes de GLSL.
- **ADN et ARN** : `TubeGeometry` générée **une seule fois** en espace paramétrique (u = position le long du brin, v = angle), déformée dans le vertex shader. Reconstruire la géométrie chaque image est le même piège processeur.
- **Filaments du cytosquelette** : géométrie tubulaire continue, à privilégier pour porter du volume encombré à bas coût.
- Les bibliothèques moléculaires (Mol\*, NGL, 3Dmol.js) sont **écartées de la scène** : ce sont des moteurs de rendu concurrents, pas des couches Three.js, et elles pèsent de 124 ko à 1,08 Mo brotli contre 151 ko pour Three.js entier. Usage **hors ligne** uniquement (§8).

### 3.4 Les bandes d'échelle

Trois « mondes » se substituent en fondu pendant le zoom. Budget GPU constant à chaque étage.

| Bande | Champ | Statut de vérité | Ce qu'on voit |
|---|---|---|---|
| 1 — Cellule | ~20 µm | **schématique, badge d'ellision permanent** | organites en volumes, membrane comme surface, protéines en silhouettes de quelques pixels |
| 2 — Boîte de vérité | **jusqu'à 4 µm**, mesuré sur ordinateur | **densité vraie, dalle à profondeur bornée** | bicouche épaisse, pompes et canaux reconnaissables à leur silhouette, encombrement réel, curseur de densité |
| 3 — Macromolécule | ~25 nm | densité vraie, voisinage immédiat | un ribosome, un complexe de pompe, l'ADN à 2 nm, codons lisibles |

Le fondu se déclenche sur un seuil de distance caméra, avec hystérésis pour éviter le battement. Une seule bande est instanciée à la fois ; la suivante se prépare pendant le fondu.

**Objets-ponts** : au moins un objet reste identifiable entre deux bandes consécutives (le ribosome entre 1 et 2, la pompe entre 2 et 3). C'est ce qui empêche l'utilisateur de se perdre — la technique est de Drew Berry.

**L'échelle est vraie dans les trois bandes.** Pas de ribosome grossi « pour qu'on le voie ». Un ribosome fait cinq diamètres de membrane et quinze largeurs d'ADN, et c'est comme ça qu'il est dessiné. C'est le premier marqueur de crédibilité perçue. Ce qui varie d'une bande à l'autre, c'est la **densité représentée**, pas les proportions — et la bande 1 l'annonce.

### 3.5 Le contenu — `contenu/`

Le contenu pédagogique est **de la donnée typée**, jamais du code. Un chapitre déclare : titre, texte, bande d'échelle, facteur temporel, ellision, position de caméra, perturbations exposées, et les chiffres affichés — chacun référençant une entrée du fichier de données sourcé avec son niveau de confiance.

Cela permet d'itérer sur les textes français sans toucher au moteur, et rend le sommaire, la navigation clavier et l'alternative textuelle dérivables automatiquement de la même source.

---

## 4. Le modèle de la membrane (lot 1)

Le premier phénomène traité, parce que c'est le mieux chiffré et que son histoire de perturbation est la plus propre.

### 4.1 État

Deux compartiments : le **cytosol** (volume fini) et le **milieu extracellulaire** (bain, concentrations fixées par défaut).

| Variable | Valeur de repos | Confiance |
|---|---|---|
| [Na⁺] intracellulaire | ~12 mM | [B] |
| [Na⁺] extracellulaire | ~145 mM | [B] |
| [K⁺] intracellulaire | ~140 mM | [B] |
| [K⁺] extracellulaire | ~4 mM | [B] |
| [Cl⁻] intracellulaire | ~10 mM | [B] |
| [Cl⁻] extracellulaire | ~110 mM | [B] |
| [Ca²⁺] libre intracellulaire | ~100 nM | [A] Alberts ch. 11 |
| [Ca²⁺] extracellulaire | ~1–2 mM | [A] Alberts ch. 11 |
| Potentiel de membrane Vm | ≈ −70 mV | [A] |
| Pool d'ATP | — | paramètre |

Alberts formule prudemment « K⁺ typiquement 10 à 20 fois plus concentré à l'intérieur ». Ces valeurs étant de niveau [B], elles s'affichent en ordre de grandeur — « environ 140 contre 4 mM, cellule mammifère » — jamais avec une fausse précision.

### 4.2 Flux

**Pompe Na⁺/K⁺-ATPase** — 3 Na⁺ sortis, 2 K⁺ entrés, 1 ATP hydrolysé par cycle [A, Alberts ch. 11]. Électrogénique : une charge nette sortante par cycle. Taux modulé par la disponibilité en ATP, par [Na⁺] intracellulaire, et par l'inhibition à l'ouabaïne.

Turnover affiché : **« ~50 à 150 cycles/s selon température et tissu »**. La littérature est dispersée (enzyme purifiée 133–167 s⁻¹ ; conditions physiologiques rein de porc ~48 s⁻¹, lapin ~43 s⁻¹). Donner la fourchette **et sa raison** est plus crédible qu'un chiffre unique inventé.

**Canaux de fuite** — K⁺, Na⁺, Cl⁻, chacun avec sa conductance. Courant proportionnel à l'écart entre Vm et le potentiel d'équilibre de l'ion.

**Potentiel d'équilibre (Nernst, 37 °C)** : `E = (26,7 / z) · ln([X]ext / [X]int)` en mV.

Valeurs attendues au repos, qui servent de tests :

| Ion | E calculé |
|---|---|
| K⁺ | ≈ −95 mV |
| Na⁺ | ≈ +67 mV |
| Cl⁻ | ≈ −64 mV |
| Ca²⁺ | ≈ +132 mV |

**Potentiel de membrane** : intégré depuis le bilan de charge sur la capacité membranaire. Les rapports de conductance (`g_K : g_Na : g_Cl`, de l'ordre de `1 : 0,15 : 0,45`) sont des **paramètres de calibration**, ajustés pour que le repos tombe vers −70 mV — pas des constantes biologiques citables, et étiquetés comme tels dans le code.

### 4.3 Ce que le modèle doit enseigner

Trois erreurs très répandues que le modèle corrige structurellement :

1. **Pompe et canal ne vont pas à la même vitesse.** Canal ouvert : jusqu'à 10⁸ ions/s, soit plus de mille ions par milliseconde [A, Alberts NBK26910]. Pompe : ~10² cycles/s. Écart de **10⁵**.
   **À ralenti ×1 000, ce contraste se dessine tout seul** : la pompe devient un mécanisme lisible, et le canal devient physiquement indessinable en billes — on le rend en jet continu, ce qui est *plus* exact, pas moins. Le contraste visuel encode l'écart de vitesse sans une ligne de commentaire. C'est la meilleure décision de design du site, et elle est offerte par la biologie.
2. **La pompe ne fabrique pas le −70 mV.** Le potentiel de repos est un potentiel de diffusion du K⁺ rendu possible par les canaux de fuite. L'électrogénicité de la pompe n'ajoute que quelques millivolts. La pompe **entretient les gradients**. Le modèle le montre : couper la pompe ne fait pas chuter Vm instantanément, il le fait dériver lentement à mesure que les gradients s'érodent.
3. **Presque rien ne bouge, en proportion.** Un potentiel d'action ne déplace qu'environ 10⁻⁵ de la charge intracellulaire [A]. Le compteur d'ions transportés s'affiche à côté du stock total, sinon le site ment par omission.

### 4.4 Perturbations exposées

| Levier | Effet attendu | Réversible |
|---|---|---|
| Ouabaïne (0–100 %) | la pompe ralentit puis s'arrête ; les gradients s'érodent ; Vm dérive vers 0 | oui |
| ATP disponible | même famille d'effets, par une autre voie | oui |
| [K⁺] extracellulaire | dépolarisation immédiate (c'est le levier clinique de l'hyperkaliémie) | oui |
| Conductance des canaux K⁺ | Vm se rapproche ou s'éloigne de E_K | oui |

Chaque levier revient à sa valeur par défaut d'un clic, et un bouton « rétablir le repos » réinitialise l'état complet.

---

## 5. Direction artistique — « planche vivante »

Goodsell animé. La densité est le sujet ; on ne supprime rien, **on rend l'utilisateur responsable de la suppression** — dans la bande où la densité a un sens (D7).

### 5.1 Le principe

Une cellule réelle est saturée : **20 à 30 % du volume intracellulaire est occupé par des macromolécules**. La GFP diffuse à 27 µm²/s dans le cytoplasme contre 87 µm²/s dans l'eau [A, BNID 101997]. Presque toutes les animations effacent cet encombrement — non par ignorance, mais parce que c'est le prix de la narration : XVIVO a retiré 95 % du contenu de la cellule pour *The Inner Life of the Cell*.

Le site ne tranche pas cet arbitrage, il le rend manipulable — et il déclare l'échelle à laquelle sa réponse est honnête.

### 5.2 Palette — validée, non négociable sans revalidation

Fond ivoire `#F2EEE4` en clair, anthracite chaud `#1C1A17` en sombre. Six familles moléculaires, sous-ensemble Okabe-Ito : `#0072B2` bleu, `#009E73` vert bleuté, `#E69F00` orange, `#CC79A7` pourpre rosé, `#56B4E9` bleu ciel, `#D55E00` vermillon, plus un gris neutre pour « non identifié ».

La couleur code la **famille fonctionnelle**, jamais l'individu, et reste constante à l'intérieur d'une scène.

Contraintes dérivées de la validation :
- **Jamais plus de six familles simultanées.** Au-delà, regrouper en « autres » plutôt que d'inventer une septième teinte.
- **Le jaune `#F0E442` d'Okabe-Ito est écarté** comme porteur d'information : il sort de la bande de luminosité (contraste 1,29:1 sur fond clair). Réservé aux surbrillances et halos.
- **Jamais rouge/vert** comme couple porteur d'information.
- Toute palette ajoutée plus tard repasse par le validateur.

### 5.3 Le contour — mesuré, technique retenue

Le validateur donne un avertissement de contraste sur trois teintes sur six (`#E69F00` à 2,19:1, `#56B4E9` à 2,25:1, `#CC79A7` à 2,98:1, sous le seuil de 3:1 sur fond clair). Cet avertissement impose un encodage secondaire, et la doctrine Goodsell le fournit : contour systématique, silhouette distincte, étiquette au survol. Le contour n'est donc pas un choix esthétique, c'est une obligation d'accessibilité.

**Technique retenue : détection de bord en post-traitement**, sur la profondeur, quatre voisins. Mesurée à **0,15 ms**, indépendamment du nombre d'instances, puisqu'elle ne dépend que de la résolution.

La coque inversée, un temps pressentie, a été écartée : elle redessine chaque instance et coûte donc **100 % de la passe géométrique** — 4,58 ms à 200 000 instances, 10,06 ms à 400 000. Elle reste utilisable ponctuellement sur quelques objets mis en avant, où son coût est négligeable et où sa largeur réglable en pixels est un avantage.

Deux affirmations de cette spec ont été **réfutées par la mesure** :

- La détection de bord ne coûte pas la classe du SSAO. Le chiffre de 5,63 ms valait pour un effet bien plus lourd, à échantillonnage en hémisphère et flou, pas pour une détection de silhouette.
- Les deux techniques donnent bien le contour intérieur entre instances de même teinte qui se recouvrent, à condition que celles-ci ne s'interpénètrent pas — ce qui est le cas réel d'un encombrement moléculaire.

**La prémisse d'accessibilité tient sous la technique retenue, et c'est vérifié plutôt que supposé.** Profil de luminance mesuré sur les pixels, en travers du bord d'une sphère orange éclairée posée sur le fond ivoire :

| | Creux au bord | Contraste creux / fond |
|---|---|---|
| Sans contour | 0,2511 — pas de creux | 3,01:1 |
| Détection de bord | **0,1411** | **4,74:1** |

Sans contour, le bord ne creuse pas : l'objet se détache du fond au seul contraste de sa teinte. Avec la détection de bord, la frontière passe au-dessus du seuil de 3:1. L'encodage secondaire qu'exige le validateur existe donc bien.

**Coût induit** : la détection de bord impose une cible de rendu et une conversion colorimétrique explicite. Sans elle, la cible restant en linéaire, l'image finale est nettement assombrie. C'est un défaut rencontré en séance, pas une hypothèse.

Détail des mesures dans `docs/superpowers/rapports/lot-0.md`.

### 5.4 Rendu

Cel-shading : aplats et contour, pas de spéculaire, pas de PBR. La profondeur passe par l'assombrissement et un brouillard exponentiel, pas par le flou.

**La silhouette porte l'information.** Chaque molécule est reconnaissable à sa forme, pas à sa texture — c'est ce qui permet de lire une image saturée à 30 % d'occupation. C'est aussi ce qui fixe l'unité rendue de D7 : l'objet minimal est ce qui a une silhouette identifiable.

**L'incertitude est graphiquement distincte de la donnée** : forme précise = structure connue ; forme lisse et schématique = interpolation. Motif directement repris de Goodsell.

---

## 6. Interaction et parcours

### 6.1 Deux modes empilés

Déposer un étudiant dans une scène mésoscopique saturée sans guidage est un échec pédagogique. Le site empile donc deux modes, avec un bouton explicite pour passer de l'un à l'autre :

- **Mode découverte** (par défaut à la première visite) : caméra guidée, quatre chapitres, un plan par idée. Aucun HUD sauf une ligne de texte, le compteur d'échelle, le badge de facteur temporel et une barre de progression.
- **Mode exploration** : caméra libre, panneau latéral rétractable (arborescence des compartiments + légende cliquable), coin bas-droit pour les compteurs et curseurs, coin haut-droit pour l'échelle.

### 6.2 Les deux gestes signature

**Le curseur de densité 0 → 100 %.** À 0 %, un schéma de manuel ; à 100 %, la vérité encombrée. C'est *aussi* le curseur de difficulté pédagogique — repris de « The Crowded Cell » de *Life on Earth*.

**Il vit dans la boîte de vérité (bandes 2 et 3), pas dans la vue cellule** (D7). Dans la bande 1, le curseur est remplacé par le badge d'ellision, qui dit ce qui n'est pas montré. Prétendre un curseur de densité à l'échelle de la cellule entière serait exactement le genre de mensonge que le reste du site combat.

**La légende est le contrôleur.** Cliquer une famille moléculaire **désature tout le reste** au lieu de le masquer : filtrer sans perdre le contexte, donc sans perdre l'encombrement. Au-delà d'un seuil de densité où les instances désaturées deviennent invisibles et coûteuses, le filtre bascule en masquage réel — et l'interface l'indique.

### 6.3 Progression en spirale

Trois passages sur la même cellule, pas un parcours unique qui explique tout : compartiments et silhouettes, puis acteurs nommés et processus, puis densité réelle, cinétique et incertitude. Si on simplifie trop, l'étudiant croit que la cellule est simple ; si on donne tout, il abandonne.

### 6.4 Règles de HUD

- Le tiers central de l'écran reste toujours libre.
- Un seul plan de surimpression, une seule couleur d'encre. La couleur d'identité est portée par la molécule dans la scène ou par une pastille, jamais par le texte.
- Les nombres sont lissés sur 250–500 ms et affichés à 2 ou 3 chiffres significatifs — **et à un seul pour une valeur de niveau [B]** (D5).
- Un graphe superposé est une sparkline sans axes ni grille. S'il lui faut des axes, il va dans le panneau latéral.
- Sous chaque bloc de HUD, un voile ou un dégradé : la lisibilité ne dépend jamais de la chance que la scène soit sombre au bon endroit.
- Les badges de facteur et d'ellision sont permanents et ne se replient jamais.

---

## 7. Accessibilité

Contrainte de conception, pas finition. Cible : **WCAG 2.2 niveau AA**.

- **`prefers-reduced-motion`** : on **remplace**, on ne supprime pas. Le mouvement brownien continu devient un fondu entre deux états, la caméra coupe au lieu de voler, le zoom continu devient une série de paliers. La richesse visuelle est conservée.
- **Un interrupteur visible en haut de page** double la media query — l'OS n'est pas toujours réglé et le besoin est parfois ponctuel.
- **Couche DOM parallèle** pour le clavier : un canvas est opaque aux technologies d'assistance, il n'y a pas d'ordre de tabulation dans un contexte WebGL. Un arbre d'éléments focalisables, un par point d'intérêt, synchronisé avec la scène : le focus déplace la caméra, `Entrée` ouvre la fiche.
- **Étiquettes en DOM projeté**, pas en texture SDF dans le canvas. Le reflow par image est un coût réel, mais le DOM est gratuit en accessibilité et en typographie française (accents, espaces insécables) — et une étiquette invisible aux lecteurs d'écran ne vaut rien pour ce public.
- **`@react-three/a11y` est écarté** : dernière publication il y a environ trois ans, trois dépendants. Ce n'est pas une dépendance planifiable, et le projet est vanilla de toute façon.
- **Raccourcis documentés** derrière `?` : flèches = orbite, `+`/`−` = zoom, `Tab` = point d'intérêt suivant, `Échap` = vue d'ensemble, `Espace` = pause. `Tab` doit pouvoir sortir du canvas.
- **Alternative textuelle** : un résumé structuré en HTML sous la scène — liste ordonnée d'étapes, chacune avec un lien qui saute la caméra à cet instant. Il sert d'accessibilité, de navigation clavier et de sommaire pour tout le monde. Plus une région `aria-live="polite"` limitée aux événements discrets (« Échelle : 100 nanomètres »), jamais aux valeurs continues.
- **Cibles de pointage ≥ 24 × 24 px CSS**, y compris les points d'intérêt dessinés dans la scène.

---

## 8. Production d'assets et licences

Le coût caché le plus important du projet : les **silhouettes moléculaires reconnaissables** dont dépend toute la doctrine Goodsell.

**Chaîne retenue** : chargement d'une structure PDB hors ligne, extraction des coordonnées d'atomes ou des points de contrôle du squelette, décimation, export en binaire compact (`Float32Array`) versionné dans le dépôt. Le site ne charge jamais de bibliothèque moléculaire à l'exécution.

**Licences, vérifiées** :

| Ressource | Licence | Conséquence |
|---|---|---|
| Données structurales PDB | **CC0 1.0** | usage libre, y compris commercial, sans attribution obligatoire |
| Illustrations Goodsell / *Molecule of the Month* | **CC-BY-4.0** | réutilisables, mais **l'attribution doit figurer dans la page livrée** dès qu'une image devient texture, calque ou tracé de référence |

Le piège est actif, pas théorique : un PDF Goodsell a déjà été téléchargé pendant la phase de recherche. Toute image qui entre dans le pipeline visuel entre aussi dans le fichier de crédits.

---

## 9. Performance

### 9.1 Budgets

| Cible | Image | GPU | Fil principal | Statut |
|---|---|---|---|---|
| Desktop 60 fps | 16,7 ms | ~12 ms | ~4 ms | **mesuré** |
| Mobile 30 fps | 33,3 ms | ~24 ms | ~8 ms | arithmétique, jamais vérifiée sur appareil (§9.5) |

La ligne mobile n'est pas une mesure : c'est la simple division d'une seconde par trente. Ce qu'elle ne dit pas — et qu'on ne sait pas — c'est ce qu'un téléphone met réellement à rendre cette scène.

### 9.2 Ce qui coûte réellement

Mesuré sur MacBook Pro M4 Max, Chrome, WebGL 2, 4,54 Mpx :

- **Le nombre de particules n'est pas le problème** à l'échelle visée. 20 000 sphères instanciées animées sur le processeur coûtent 1,3 ms. L'animation en vertex shader repousse le plafond vers ~330 000.
- **Le taux de remplissage est le vrai plafond.** 300 000 points additifs à 38 px coûtent 3,4 ms de GPU ; les mêmes à 115 px coûtent 19,9 ms. Multiplier le diamètre par 3 multiplie le coût par 5,9. Les gros halos additifs sont l'ennemi.
- **Le bloom est presque gratuit** (+0,30 ms) parce qu'il travaille sur une pyramide sous-échantillonnée. **La profondeur de champ (+5,40 ms) et le SSAO (+5,63 ms) coûtent dix-huit fois plus.**

Décisions : **bloom oui, SSAO non, profondeur de champ simulée** dans le shader des particules en modulant opacité et taille selon la distance. Le contour par détection de bord ajoute 0,15 ms au même budget (§5.3).

**Nuance mesurée sur la boîte de vérité, qui vaut correction.** Le taux de remplissage est bien le plafond pour de grands halos additifs, mais **pas pour la dalle à densité vraie** : là, les complexes ne font que quelques pixels et c'est le traitement des sommets qui domine. Diviser le nombre de pixels par trois n'a fait passer le temps GPU que de 11,96 à 10,45 ms. La dalle est donc **limitée par la géométrie**, et son seul levier de réglage est le nombre d'instances, c'est-à-dire son arête.

### 9.3 Simulation

En dessous de 20 000 entités visibles, le processeur en JavaScript suffit largement et on garde tout le pilotage narratif, la sélection et les déclencheurs en JavaScript lisible. **C'est le régime du projet. Aucun GPGPU n'est nécessaire** — et il cesserait d'être gratuit dès qu'il faut relire les positions côté processeur pour déclencher un événement.

### 9.4 Dégradation

**Mesure adaptative en continu**, pas un test unique au chargement : le throttling thermique est réel et une scène stable pendant une minute peut perdre 30 à 40 % après dix minutes. Moyenne glissante du temps d'image, avec hystérésis. Au-delà de ~20 ms, on descend d'un cran ; en dessous de ~12 ms de façon soutenue, on remonte.

Échelle de dégradation, du moins au plus visible, **réordonnée après mesure** :

1. Profondeur de champ coupée
2. Bloom sur mip plus bas, puis coupé
3. Détail des sphères 2 → 1 → 0 — agit sur la géométrie, donc sur ce qui limite réellement la dalle
4. **Arête de la dalle réduite**, avec le badge mis à jour en conséquence — jamais la densité (voir ci-dessous). C'est le levier de fond, et le seul qui ait un effet proportionnel.
5. Ratio de pixels 2 → 1,5 → 1,25 → 1. Placé bas parce que **la mesure le dément comme premier recours** : diviser les pixels par trois n'a fait passer le temps GPU que de 11,96 à 10,45 ms sur la dalle. Il reste utile pour les scènes à grands halos, où le remplissage domine.
6. En dernier recours, image fixe

**Quand le budget manque, on rétrécit la dalle, jamais sa densité.** Une boîte de vérité à densité réduite n'est plus une boîte de vérité : c'est exactement la malhonnêteté que tout le reste de la spécification combat. Montrer un volume plus petit à densité juste reste vrai ; montrer le même volume à densité fausse ne l'est pas. Le badge annonce donc toujours l'arête courante, et toute réduction est une **conséquence énoncée du budget**, pas un plancher arbitraire.

### 9.5 Mobile — hors périmètre, par décision

**Le site vise l'ordinateur. Aucun appareil mobile n'a été mesuré, et la vérification a été écartée le 2026-07-31.**

Ce n'est pas un oubli à rattraper plus tard en silence, c'est un choix qui a trois conséquences qu'il faut écrire :

1. **Aucun chiffre mobile de ce document n'est vérifié.** La ligne mobile du §9.1 est une division, pas une mesure. Toute affirmation du type « ça tournera à 30 images par seconde sur iPhone » serait inventée.
2. **La porte de livraison mobile est retirée du §10.4.** Une porte qu'on ne franchit jamais n'est pas une porte, c'est une décoration. Mieux vaut une exigence de moins qu'une exigence fausse.
3. **L'arête tenable sur téléphone est inconnue.** Celle de 4 µm du §3.4 vaut pour un MacBook Pro M4 Max et pour lui seul.

Ce qu'on garde malgré tout, parce que ce sont des garde-fous et non des promesses :

- **Gestion de `webglcontextlost` et `webglcontextrestored` dès la première ligne.** Le mode de panne réel d'iOS est un dépassement mémoire menant à une perte de contexte, qui se traduit par un canvas blanc ou un rechargement d'onglet. Sans gestionnaire, la panne est silencieuse. C'est déjà implémenté dans le harnais des bancs, et ça ne coûte rien.
- **Le protocole de mesure reste prêt** dans `rapports/mesure-mobile.md` : le banc se pilote au toucher et relève seul la dérive thermique. Le jour où le mobile revient au périmètre, c'est une dizaine de minutes de travail, pas un chantier.

Si le mobile revient au périmètre, il faudra rouvrir cette section **avant** d'écrire la moindre ligne d'interface, pas après : une maquette mobile du HUD et du panneau latéral se conçoit en amont.

---

## 10. Tests et portes chiffrées

L'intérêt de la pureté du moteur est là : les critères pédagogiques deviennent des assertions.

### 10.1 Moteur — Vitest, sans GPU (le meilleur rapport valeur/effort)

- L'état de repos est stationnaire : à paramètres par défaut, les dérivées restent sous un seuil sur une longue intégration.
- Les potentiels d'équilibre valent les valeurs attendues (E_K ≈ −95 mV, E_Na ≈ +67 mV, E_Cl ≈ −64 mV) à tolérance près.
- La charge est conservée : la somme des courants correspond à la variation du potentiel via la capacité.
- Le blocage complet de la pompe dépolarise dans une fenêtre de temps énoncée.
- Le retrait de l'ouabaïne ramène l'état à moins d'un pourcentage donné du repos, en un temps borné.
- Le modèle est déterministe : même graine, même trajectoire.
- Le pas de temps est stable : diviser `dt` par deux ne change pas la trajectoire au-delà d'une tolérance.
- **Chaque chiffre affiché résout vers une entrée du fichier de données**, avec un niveau de confiance renseigné, et aucune valeur [B] n'est affichée avec plus d'un chiffre significatif.
- **Le badge de facteur et d'ellision correspond à ce que l'animation fait réellement** — le test échoue si les deux divergent.

### 10.2 Parcours — Playwright

Navigation entre chapitres, états de l'UI, réversibilité des perturbations vue depuis l'interface, absence d'erreur console, et le contrat « la scène a démarré ».

### 10.3 Captures de référence

Réalistes en CI **à condition de générer les images de référence dans le conteneur**, pas en local : le rendu headless passe par un rasteriseur logiciel, différent du GPU. Scène figée par paramètre d'URL, graine fixée, horloge fixée, tolérance de quelques pour mille de pixels.

### 10.4 Portes de livraison

Ce qui définit « fini », chiffré :

| Porte | Seuil |
|---|---|
| Images par seconde, Mac de développement, scène la plus dense | ≥ 55 |
| ~~Images par seconde, iPhone cible~~ | **retirée** — le mobile est hors périmètre (§9.5) |
| Poids du JavaScript | ≤ 250 ko brotli |
| LCP en 4G simulée | < 2,5 s |
| Erreurs console, y compris perte de contexte non gérée | 0 |
| Axe d'accessibilité | aucune violation critique |
| Parcours clavier complet sans souris | passant |
| Relecture par un biologiste | faite, avant mise en ligne |
| **Auto-contrôle de trois questions par chapitre** | **rédigé, et chaque réponse trouvable dans le chapitre** |

Le test d'images par seconde en CI tourne en rendu logiciel : il n'attrape que les régressions catastrophiques (fuite d'objets, matériaux recréés par image). Il ne remplace pas une passe manuelle sur appareil réel avant chaque livraison.

### 10.5 Ce qu'on ne teste pas

Le pixel-perfect entre navigateurs et les shaders unitairement : coût et bruit élevés, valeur faible. Les défauts visuels fins se jugent à l'œil et au navigateur — leçon déjà payée sur d'autres projets.

---

## 11. Découpage en lots

Chaque lot passe par son propre cycle spec → plan → implémentation.

### Lot 0 — Les trois bancs qui débloquent le reste

Court, mais bloquant. Aucune ligne de la scène finale n'est écrite avant.

**Le lot 0 est de l'implémentation, pas de la mesure passive** : les trois bancs demandent d'écrire du WebGL et des shaders. Il attend donc l'approbation de cette spécification et passe par un plan d'implémentation comme le reste. « Ce n'est qu'un banc » n'est pas une raison de commencer à coder.

| Porte | Question | Si ça échoue |
|---|---|---|
| **0a — Contour** | Une coque inversée à largeur constante à l'écran tient-elle le budget sur 100 k instances ? La détection de bord en post-traitement est-elle finançable ? Le contour intérieur entre instances de même teinte est-il obtenable ? | Repli nommé en §5.3 : d'abord séparer les familles par luminosité et silhouette seules ; sinon basculer sur la direction « coupe optique », déjà validée intégralement |
| **0b — Boîte de vérité** ✅ | Une dalle à densité vraie tient-elle 55 images/s sur le Mac ? **Oui, jusqu'à ~4,9 µm.** Le volet iPhone a été écarté (§9.5). | On réduit **l'arête** de la dalle et on l'annonce — jamais la densité (§9.4) |
| **0c — Silhouettes** | Combien de temps coûte réellement la production d'une silhouette moléculaire reconnaissable, de la structure PDB au binaire ? | On réduit le nombre de familles distinctes avant de s'engager sur quatre phénomènes |

### Lots suivants

| Lot | Contenu | Pourquoi cet ordre |
|---|---|---|
| **1 — Socle et membrane** | Moteur pur, rendu multi-bandes, chapitrage, palette, HUD, badges, dégradation adaptative, accessibilité de base, **phénomène A de bout en bout avec ses perturbations** | La membrane est le phénomène le mieux chiffré et sa perturbation est la plus propre à enseigner. Le lot valide l'architecture entière sur un cas réel. |
| **2 — Traduction** | Phénomène C. Bande 3, facteur ×20, polysomes, essais ratés d'ARNt, cliquet discret, tunnel de sortie | Un seul facteur couvre toute la scène, transcription comprise. C'est la scène la plus facile à rendre honnête — et la première à exercer le champ `ellision`. |
| **3 — Coupures** | Phénomène D. Quatre sous-scènes chapitrées : transcription, topoisomérases, CRISPR, épissage | Couvre dix ordres de grandeur temporels. Exerce à fond la mécanique des sous-scènes. |
| **4 — Trafic** | Phénomène B. Facteur accéléré ×100, manteaux COPII/COPI/clathrine, flux rétrograde, sous-scène séparée pour le pore nucléaire | **Le seul qui force l'échelle micrométrique**, donc le seul structurellement schématique. À faire en dernier, quand le badge d'ellision est rodé. |

Le lot 1 est jugé sur pièce avant d'engager les suivants.

---

## 12. Chantiers non logiciels

Ils sont chiffrés à part parce qu'ils ne se résolvent pas en écrivant du code.

- **Rédaction française.** Toutes les sources sont anglophones et le vocabulaire scientifique français n'est nulle part dans les rapports. Les textes sont rédigés puis relus, pas traduits mécaniquement.
- **Relecture par un biologiste.** Condition de livraison (D5), avant mise en ligne.
- ~~Maquette mobile du HUD et du panneau latéral~~ — **retiré** : le mobile est hors périmètre (§9.5). À rouvrir avant toute ligne d'interface si le périmètre change.
- **Fichier de crédits** tenu à jour au fil du pipeline d'assets (§8).

---

## 13. Pile technique

Versions vérifiées sur le registre npm au 2026-07-30.

| Paquet | Version | Licence |
|---|---|---|
| three | 0.185.1 (r185) | MIT |
| vite | 8.2.0 | MIT |
| typescript | — | Apache-2.0 |
| zustand (store vanilla) | 5.0.14 | MIT |
| gsap | 3.15.0 | gratuite, **propriétaire** (Webflow) |
| vitest | 4.1.10 | MIT |
| @playwright/test | 1.62.1 | Apache-2.0 |

**Écartés** : React Three Fiber (+164 ko gzip sans bénéfice ici), Next.js (aucun besoin de SSR ; le rendu serveur est un piège avec WebGL), Mol\*/NGL/3Dmol.js à l'exécution, `@react-three/a11y` (abandonné).

**Déploiement** : Cloudflare Pages ou GitHub Pages. Vercel Hobby est réservé à un usage non commercial par ses conditions ; Netlify Free est passé à un quota d'environ 15 Go par mois, serré pour un site à assets lourds.

---

## 14. Pièges identifiés

**Rendu**
- `three` est versionné en `0.x` avec des ruptures possibles à chaque release mensuelle : épingler la version exacte.
- `BatchedMesh` est plus lent qu'`InstancedMesh` sur ce type de scène (régression documentée, toujours ouverte). Pour N copies d'une même molécule, `InstancedMesh` est l'outil.
- `InstancedMesh` ne trie pas ses instances : sur une scène transparente dense, cela crée de l'overdraw.
- Créer des `Vector3` ou des matériaux dans la boucle de rendu = pression GC et chute de framerate.
- Sur iOS, la panne typique est une perte de contexte WebGL par dépassement mémoire, silencieuse sans gestionnaire.
- **`vertexColors: true` avec `setColorAt` rend tout noir, sans la moindre erreur.** Three.js définit `USE_COLOR` dans le vertex shader dès que `vertexColors` est vrai, ce qui déclare un attribut `color` que la géométrie n'a pas ; son défaut est (0,0,0) et il annule la couleur. `instanceColor` seul suffit : le fragment shader définit `USE_COLOR` de lui-même quand il existe.
- **Une mesure prise sous le budget d'image ne vaut rien.** Le GPU sous-cadence quand il a de la marge, et les écarts sous la milliseconde deviennent irrésolubles — au point de produire des surcoûts négatifs. Il faut saturer pour comparer.
- **Une cible de rendu reste en linéaire.** Sans conversion colorimétrique explicite dans la passe finale, l'image est nettement assombrie.
- **Le ribosome, le spliceosome et le pore nucléaire n'existent pas au format PDB.** Au-delà de 99 999 atomes, seul le mmCIF est publié, et il n'a pas de colonnes fixes : l'ordre des champs se lit dans l'en-tête de la boucle `_atom_site.`.

**Science**
- **Toujours étiqueter le type cellulaire.** « Un million de pompes par cellule » est vrai pour un néphron et faux d'un facteur 10⁵ pour un globule rouge (471 ± 70 pompes). Aucune moyenne inter-organismes.
- L'import mitochondrial est **mal contraint temporellement** ; les revues récentes le disent explicitement. Ne pas afficher de chiffre en secondes.
- Cas9 **ne disparaît pas après la coupure** : il reste accroché des minutes à des heures, au point d'être un frein à l'édition. Toutes les animations grand public le font s'évaporer, ce qui est l'inverse du fait le plus important sur cette enzyme.
- La géométrie de l'épissage est **à l'envers** dans tous les schémas : exon médian 120 pb contre intron moyen 5 419 pb, un facteur ~45. Si on raccourcit l'intron, on l'affiche.
- Topo I coupe **un** brin sans ATP ; Topo II coupe **les deux** avec ATP. Beaucoup de sources inversent ou fusionnent.

**Produit**
- Ne jamais faire bouger la caméra, changer la couleur et défiler le texte en même temps. Une variable animée à la fois.
- Pour comparer deux états, un curseur bat deux scènes successives : A et B au bout du même geste.
- Une belle animation circule hors de son contexte — le contexte doit être *dans* l'image, pas seulement autour.

---

## 15. Sources principales

**Biologie**
- Alberts *et al.*, *Molecular Biology of the Cell* — NBK26910, NBK26896, NBK26815
- BioNumbers (Milo & Phillips) — BNID 101997, 100483, 107783, 107426, 100059, 107952, 108032, 108028
- *Rate Limitation of the Na⁺,K⁺-ATPase Pump Cycle*, Biophys J
- *Kinetic Analysis of Secretory Protein Traffic*, J Cell Biol 143:1485
- *Probing the stability of the SpCas9–DNA complex after cleavage*, NAR 49:12411
- *Distributions of Exons and Introns in the Human Genome*, In Silico Biology

**Visualisation**
- Goodsell, Franzen & Herman, *From Atoms to Cells: Using Mesoscale Landscapes to Construct Visual Narratives*, J. Mol. Biol. 2018 — doi:10.1016/j.jmb.2018.06.009
- Drew Berry, *How to Stop your Molecules Looking Like They "Know" Where to Go* (2022)
- E.O. Wilson's *Life on Earth* (Digizyme) — « The Crowded Cell », « Molecular Families »
- cellPACK / CellPAINT / CellVIEW (Scripps)
- Bartosz Ciechanowski — ciechanow.ski
- Okabe-Ito / Wong, *Points of view: Color blindness*, Nature Methods 2011

**Technique**
- Bancs de performance mesurés en session (M4 Max, Chrome, WebGL 2)
- Issues three.js #28776, #30352, #30560, #33821, #29580, #30047
- MDN — `prefers-reduced-motion`, `WEBGL_debug_renderer_info`
- WCAG 2.2 — SC 2.3.3, SC 2.5.8, SC 1.4.1
- wwPDB usage policies (CC0) · PDB-101 Goodsell Gallery (CC-BY-4.0)

---

## 16. Ce qui reste ouvert

- **Le mobile est hors périmètre par décision** (§9.5), pas en attente. Aucun chiffre mobile n'est vérifié, la porte de livraison correspondante a été retirée, et le protocole reste prêt si le périmètre change.
- **Le passage d'un nuage de points Cα à une surface rendue n'est pas mesuré.** Il n'est pas nécessaire aux bandes 1 et 2, où les complexes se rendent en sphères instanciées ; il l'est à la bande 3.
- **Le paramétrage des conductances** du modèle de membrane est une calibration, pas une donnée. À ajuster et à documenter comme tel.
- **Les lots 2 à 4 ne sont pas spécifiés en détail.** Ils recevront leur propre cycle une fois le lot 1 jugé sur pièce.

# Références de design — visualisation cellulaire interactive sur le web

## 0. La tension centrale (à garder en tête pour tout le reste)

Un seul arbitrage structure ce domaine, et toutes les décisions de DA en découlent :

- **La crédibilité vient de la densité.** Une cellule réelle est saturée : **20 à 30 % du volume intracellulaire est occupé par des macromolécules**, ce qui modifie la diffusion, l'association des protéines et les vitesses de réaction enzymatique. Goodsell construit toute son œuvre là-dessus : le mésoscale (10–100 nm) est « largely the realm of interpretation », aucune technique ne l'image directement, et ce qui rend l'image vraie c'est l'encombrement.
- **La lisibilité vient de la suppression.** XVIVO a retiré **95 % du contenu de la cellule** pour dégager une vue exploitable dans *The Inner Life of the Cell* (https://xvivo.com/examples/the-inner-life-of-the-cell/, https://en.wikipedia.org/wiki/The_Inner_Life_of_the_Cell). Goodsell dit la même chose en une phrase : *« The first issue is to highlight a story from within a sea of competing molecules. Most commonly, much of the extraneous detail is simply omitted. »*

Presque toutes les animations « oublient » le molecular crowding non pas par ignorance mais parce que c'est le prix payé pour la narration. **La bonne réponse produit n'est pas de choisir un camp, c'est de rendre l'arbitrage manipulable par l'utilisateur** (voir §5, le curseur de densité).

Source primaire principale de cette section : Goodsell, Franzen & Herman, *From Atoms to Cells: Using Mesoscale Landscapes to Construct Visual Narratives*, J. Mol. Biol. 2018 — https://doi.org/10.1016/j.jmb.2018.06.009 (PDF plein texte : https://3dmoleculardesigns.com/hubfs/pdf/DavidGoodsellPaper-FromAtomstoCells.-3.pdf).

---

## 1. Les références canoniques

### 1.1 David Goodsell — les paysages moléculaires

- Pages : https://ccsb.scripps.edu/projects/mesoscale — portail éducatif RCSB : http://pdb101.rcsb.org — entretien : https://www.interaliamag.org/articles/david-goodsell-molecular-landscapes/ — synthèse : *Art and Science of the Cellular Mesoscale* https://pubmed.ncbi.nlm.nih.gov/32413324/

Ce qui fait le style, et qui est **directement transposable en shader / en canvas** :

1. **Non-photoréalisme assumé.** Aquarelle + encre pour les grands systèmes, images de synthèse quand les coordonnées atomiques existent, mais « a similar non-photorealistic style » dans les deux cas. En pratique : aplats + contour sombre (cel-shading), pas de spéculaire, pas de PBR.
2. **La silhouette porte l'information.** Chaque molécule est reconnaissable à sa forme, pas à sa texture. C'est ce qui permet de lire une image saturée à 20–30 % d'occupation volumique.
3. **La couleur code la famille fonctionnelle, pas l'individu.** Le principe, et non un code de couleurs universel : un jeu réduit de teintes, **une par famille ou par compartiment, constant à l'intérieur d'une scène donnée**, réattribué d'une scène à l'autre selon le récit. Exemple documenté (légende de la Fig. 6b de l'article J. Mol. Biol., scène CellPAINT) : vert = VIH, orangés et jaunes = plasma sanguin, bleu et magenta = surface du lymphocyte T. C'est un encodage catégoriel à faible cardinalité — exactement ce qu'il faut pour rester lisible dans un amas. Le même principe est réifié dans l'interface : la palette de « pinceaux moléculaires » de CellPAINT et la figure « Molecular Families » de *Life on Earth* (ADN / Protéines / Lipides / Glucides).
4. **L'échelle est vraie.** Les manuels dessinent les ribosomes et les pores nucléaires « considerably larger than the actual relative size to make them visible » ; Goodsell refuse ça. C'est le premier marqueur de crédibilité perçue.
5. **L'incertitude est rendue visible.** Sa figure Ebola pour le PDB mélange structures atomiques résolues et **cercles schématiques représentant le volume approximatif des portions non résolues**. C'est un motif de design réutilisable tel quel : *forme précise = donnée ; forme lisse/schématique = interpolation*. Goodsell insiste : « There is also a great need to develop effective methods to represent levels of certainty in mesoscale imagery. Combination of detailed and schematic representations is one simple, and readily comprehensible, approach ».

### 1.2 XVIVO / Harvard — *The Inner Life of the Cell* (2006)

- https://xvivo.com/examples/the-inner-life-of-the-cell/ — https://en.wikipedia.org/wiki/XVIVO_Scientific_Animation — vidéo : https://www.youtube.com/watch?v=wJyUtbn0O5Y

Ce qui marche : direction cinématographique (profondeur de champ, lumière volumétrique, caméra subjective), 14 mois de recherche scientifique, un récit unique et suivi (extravasation leucocytaire). Le troisième volet de la série BioVisions, **Protein Packing** (2014), est précisément l'aveu du problème : il a été fait pour montrer le crowding et le mouvement brownien que le premier film avait effacés.

Ce qui est reproché : le film a été critiqué par des scientifiques comme relevant de la science-fiction, voire de l'animisme — les molécules y « savent » où aller (voir aussi la discussion académique : https://www.tandfonline.com/doi/full/10.1080/09505431.2023.2240811). Il a aussi été détourné sans autorisation par le film *Expelled* (https://pandasthumb.org/archives/2008/04/david-bolinsky.html), rappel utile : une belle animation circule hors de son contexte, donc le contexte doit être *dans* l'image.

### 1.3 Drew Berry / WEHI.TV — le problème de l'agentivité

- https://www.wehi.edu.au/wehi-tv/ — https://www.wehi.edu.au/wehi-tv/body-code — https://www.drewberry.com/science — https://www.wehi.edu.au/staff/drew-berry/
- **Le talk décisif** : « How to Stop your Molecules Looking Like They "Know" Where to Go — The Problem of Agency in Molecular Animation » (23/07/2022) — https://www.youtube.com/watch?v=qbyzEiBvbXw — voir aussi https://bmc.med.utoronto.ca/news-events/2024/03/22/2024-bmc-speaker-series-drew-berry

C'est **le** critère de crédibilité que presque tout le monde rate, plus encore que le crowding : une molécule qui se dirige droit vers sa cible ment. Le vrai est fait de recherche aléatoire, de collisions ratées, d'agitation permanente. La recette de Berry, telle que la décrit Goodsell : *keyframe animation pour scripter l'histoire, puis mouvement stochastique superposé par-dessus*. Une astuce citée : simuler l'assemblage par dynamique puis **jouer la séquence à l'envers** (utilisée pour l'apoptosome, https://www.youtube.com/watch?v=DR80Huxp4y8) ; Berry commente : *« It works to reduce the sense of agency but is very tricky to plan and implement for animation production. »*

Autres techniques de Berry relevées par Goodsell : **usage cohérent de la couleur d'un bout à l'autre**, **transition douce du niveau de détail** entre échelles, et **inclusion d'objets repères reconnaissables qui font le pont entre deux échelles**. Ce dernier point est la clé UX d'un zoom cellule → protéine.

### 1.4 Janet Iwasa

- http://scienceofhiv.org — image *Egress* (bourgeonnement du VIH, ESCRT-III) réalisée avec le CHEETAH Center.

Parti pris différent de Berry : mouvements stochastiques **plus amples**, processus à échelles de temps plus longues, esthétique plus claire et plus « éditoriale ». Utile comme point milieu entre Goodsell et BioRender.

### 1.5 cellPACK / CellPAINT / CellVIEW / Mesoscope (Scripps — Olson, Autin, Goodsell)

- cellPACK : https://www.nature.com/nmeth/journal/v12/n1/full/nmeth.3204.html — https://pubmed.ncbi.nlm.nih.gov/25437435/ — https://bio.tools/cellpack
- CellPAINT : http://cellpaint.scripps.edu — https://pubmed.ncbi.nlm.nih.gov/30668455/
- Portail : https://ccsb.scripps.edu/projects/mesoscale
- Concours COVID CellPAINT : https://www.rcsb.org/news/5ed7c17cdab5c9354c274f56 — article associé : https://journals.plos.org/plosbiology/article?id=10.1371%2Fjournal.pbio.3000815

Ce qu'il faut en retenir pour un produit web :

- **cellPACK** remplit procéduralement un volume à partir d'une composition (protéome + concentrations + règles d'interaction). C'est-à-dire : la densité n'est pas dessinée à la main, elle est **générée** — donc paramétrable, donc animable en direct.
- **CellPAINT** est un logiciel de peinture avec une **palette de « pinceaux moléculaires »** (chaque pinceau = une molécule avec ses propriétés) et un **curseur de température** qui ajoute du mouvement diffusif à la scène. Deux idées d'UI directement volables.
- **CellVIEW** apporte le triptyque technique du rendu mésoscale : **niveau de détail hiérarchique**, **plans de coupe personnalisés**, **occlusion ambiante**. Sur le web, ça se traduit par : instancing GPU (la structure d'une molécule stockée une fois, répétée partout), imposteurs billboards aux échelles lointaines, SSAO pour lire la profondeur dans un amas.

### 1.6 Nanographics (TU Wien / KAUST)

- https://nanographics.at/

Le virion SARS-CoV-2 « authentique » reconstruit depuis des tomogrammes cryo-EM, un renderer moléculaire présenté comme le plus rapide au monde, une installation dôme interactive affichant des milliards d'atomes. Aucun visualiseur web public, mais c'est la référence haute pour « à quoi ressemble le photoréalisme moléculaire honnête ».

### 1.7 Synthèse : les 7 marqueurs de crédibilité

1. Échelles relatives exactes (pas de ribosome grossi).
2. Encombrement présent au moins une fois dans le parcours.
3. Mouvement brownien / absence d'agentivité.
4. Le solvant existe (l'eau et les ions ne sont pas du vide).
5. La couleur est un système constant sur toute l'expérience.
6. L'incertitude est graphiquement distincte de la donnée.
7. La provenance est citable (PDB ID, EMDB, article) — Goodsell mentionne l'*embedded citation* dans la visualisation comme piste active.

Et les 4 marqueurs de beauté : silhouette lisible, palette restreinte, contraste de densité (zones denses / respirations), et lumière qui sert la profondeur (AO, brouillard de profondeur) plutôt que le clinquant.

---

## 2. Sites interactifs primés en science / biologie

### 2.1 Awwwards — catégorie Sciences

Listing consultable : https://www.awwwards.com/websites/sciences/ (collection WebGL : https://www.awwwards.com/awwwards/collections/webgl/)

Lauréats effectivement listés sur cette page :

| Site | URL | Distinction |
|---|---|---|
| D2C Life Science | d2c-lifescience.com | Developer Award + Site of the Day (22/02/2026) |
| Gorilla Science | watchgorillascience.com | Honorable Mention (06/10/2025) |
| Science meets faith | kamidesgn.com/faith | Honorable Mention (22/01/2025) |
| Lens by Science | lens.science.clinic | Developer Award + Site of the Day (26/04/2021) |
| Temasek Life Sciences Lab. | anniversary.tll.org.sg | listé sans distinction |

Constat honnête : la catégorie « Sciences » d'Awwwards récompense surtout de la **communication d'entreprise de biotech** — WebGL, transitions, scroll piloté — et très peu de la **pédagogie scientifique**. Ne pas y chercher un modèle de contenu, seulement un modèle de facture technique.

### 2.2 Webby Awards

Archive : https://winners.webbyawards.com/ — catégories pertinentes : *Websites & Mobile Sites → General Desktop & Mobile Sites → Science* (https://winners.webbyawards.com/winners/websites-and-mobile-sites/general-desktop-mobile-sites/science) et *Learning & Education* (https://winners.webbyawards.com/winners/apps-software/software-services-platforms/learning-education).

**Non récupérable en l'état** : les pages de catégorie renvoient la coquille de navigation, la liste des lauréats étant derrière un compte. À consulter manuellement dans un navigateur connecté plutôt qu'à citer de seconde main.

### 2.2 bis FWA

https://thefwa.com/ — FWA of the Day, jury de plus de 500 professionnels dans 35 pays, fondé en 2000 (https://en.wikipedia.org/wiki/TheFWA). **Non exploitable pour cette recherche** : l'archive n'expose pas de filtre par secteur science/éducation récupérable, et le palmarès penche massivement vers le brand experience et l'automobile. À traiter comme référence de facture technique (WebGL, transitions) et non comme source de partis pris pédagogiques.

Point vérifiable en revanche : **Quanta Magazine** a remporté un Webby People's Voice 2025 et le National Magazine Award 2025 (meilleur numéro thématique) pour *The Unraveling of Space-Time* — https://www.quantamagazine.org/quantanews/quanta-wins-2025-national-magazine-award-for-best-single-topic-issue-and-webby-peoples-voice-award/

### 2.3 Les vraies références de contenu (non primées Awwwards, mais bien meilleures)

- **E.O. Wilson's *Life on Earth*** (Digizyme / Gaël McGill) — https://www.digizyme.com/loe.html — https://eowilsonfoundation.org/e-o-wilsons-life-on-earth/
  Contient les deux figures interactives les plus pertinentes du domaine, décrites en détail par Goodsell (Fig. 5 de l'article J. Mol. Biol.) :
  - **« The Crowded Cell »** : un **curseur 0 → 100 %** qui ajoute progressivement les molécules dans la scène. On part du schéma de manuel, on arrive au réel saturé. C'est l'objet de design le plus important de tout ce rapport.
  - **« Molecular Families »** : une **légende cliquable** (ADN / Protéines / Lipides / Glucides) qui **colore sélectivement** la famille choisie et laisse le reste en gris. Filtrer, ce n'est pas cacher : c'est désaturer.
- **Visual Science — Influenza** : https://visual-science.com/projects/influenza/illustration/ — illustration collaborative représentant l'état courant des connaissances structurales, explorée par **image map / hotspots** (cliquer une zone → panneau de détail). Modèle du « poster augmenté ».
- **Allen Cell Explorer** (Allen Institute) — https://www.allencell.org/3d-cell-viewer.html — https://cfe.allencell.org/ — tutoriel : https://alleninstitute.org/news/allen-cell-explorer-tutorial-navigating-the-3d-cell-viewer
  Le meilleur exemple de **donnée réelle explorable dans le navigateur** : milliers de cellules souches iPS humaines éditées génétiquement, vues en 3D, avec toggles par structure marquée, coupes, et un nuage de points (Cell Feature Explorer) lié à la vue 3D. C'est la référence pour l'UI « données + 3D » (§5).
- **Clarafi showcase** : https://clarafi.com/showcase/ — vitrine d'animations moléculaires où l'on voit la diversité des arbitrages random/directed motion.
- **PDB-101** : http://pdb101.rcsb.org — Molecule of the Month, la meilleure école de vulgarisation structurale, et la source directe du style Goodsell.

### 2.4 Les partis pris d'interaction, classés

| Parti pris | Contrôle utilisateur | Charge cognitive | Quand l'utiliser |
|---|---|---|---|
| **Caméra guidée / film** (XVIVO, WEHI) | nul | faible | première visite, effet « waouh », récit unique |
| **Scrollytelling** (scroll = temps ou profondeur) | moyen, familier | faible | narration linéaire avec 5–12 temps forts |
| **Hotspots sur image fixe** (Visual Science) | élevé, non linéaire | faible | poster de référence, consultation répétée |
| **Exploration libre 3D** (Allen 3D Viewer, CellPAINT) | total | forte | public expert ou seconde visite |
| **Curseurs paramétriques** (The Crowded Cell) | ciblé | très faible | faire *sentir* une variable (densité, température) |

Le bon produit **empile** ces modes : guidé d'abord, libre ensuite, avec un bouton explicite pour passer de l'un à l'autre.

---

## 3. Le scrollytelling scientifique

### 3.1 Bartosz Ciechanowski — le mètre-étalon

https://ciechanow.ski/ — articles types : https://ciechanow.ski/cameras-and-lenses/, https://ciechanow.ski/gears/, https://ciechanow.ski/bicycle/ — revue : https://css-tricks.com/bartosz-ciechanowskis-interactive-blog-posts/

Structure réelle de *Cameras and Lenses*, telle qu'observée sur la page :

- **Alternance stricte prose → figure.** Chaque concept est d'abord énoncé en texte, puis rendu manipulable. Plus de 20 démonstrations interactives dans un seul article.
- **Une figure = une variable.** Curseurs dédiés : temps de collecte des photons, diamètre du sténopé, épaisseur du verre, focale, ouverture, dispersion. Jamais un panneau à huit réglages.
- **Le drag est partout.** « You can drag around the demo to see it from other directions » — la scène 3D est repositionnable, la source lumineuse déplaçable.
- **Zéro scroll-jacking.** Le scroll reste le scroll. Les figures ne volent jamais la position de lecture.
- **L'autoplay est négociable et global.** Note explicite de l'auteur : « all animations are enabled, but if you find them distracting, or if you want to save power, you can globally pause all the following demonstrations ». **Un seul interrupteur pour toute la page**, placé en haut. C'est la meilleure implémentation de `prefers-reduced-motion` avant l'heure, et elle est manuelle en plus d'être automatique.
- **Progression en difficulté monotone** : détection de photons → sténopé → ondes et réfraction → systèmes de lentilles → aberrations.
- Canvas/WebGL, rendu temps réel, aucun framework externe.

**Ce qu'on lui vole** : la règle « une figure, une variable, un curseur », le pause global, et le refus du scroll-jacking.

### 3.2 Neal Agarwal — le scroll comme métrique

https://neal.fun/deep-sea (403 aux robots, mais le site est public), https://neal.fun/size-of-space — couverture : https://flowingdata.com/2019/12/05/scroll-scroll-scroll-through-the-depths-of-the-ocean/, https://css-tricks.com/neal-fun/

L'idée en une phrase, telle que formulée dans les revues : **« scrolling downward is not a metaphor for depth — it is depth »**. Le scroll n'est pas une navigation, c'est la **grandeur elle-même**. Corollaires : une seule interaction forte, jamais enterrée ; un compteur permanent (profondeur en mètres) qui rend l'effort tangible ; des jalons annotés qui récompensent la persévérance.

Pour une cellule, la transposition évidente est : **scroll = échelle** (cellule 10 µm → organite 1 µm → complexe 100 nm → protéine 5 nm → atome 0,1 nm), avec un compteur d'échelle permanent. Lignée assumée : *Powers of Ten* des Eames (http://www.eamesoffice.com/the-work/powers-of-ten/), explicitement cité par Goodsell comme la solution visuelle pionnière au problème du changement d'échelle, avec le zoom continu de Nelson Max pour *The Universe: We Are Born of Stars*.

### 3.3 Ce que dit la recherche

- **ScrollyVis** (Mörth, Bruckner, Smit — IEEE TVCG 2022) : https://arxiv.org/abs/2207.03616 — système d'auteur pour le scrollytelling *scientifique*, intégrant images, texte, vidéo mais aussi cartes interactives, champs scalaires et maillages. Argument central : le scroll « provides users with a sense of control, exploration and discoverability while still offering a simple and intuitive interface ». C'est la meilleure justification théorique du scroll comme mécanique de pilotage de caméra. Voir aussi https://mmiv.no/visualization/
- **The Impact of Scrollytelling on the Reading Experience of Long-Form Journalism** (ECCE 2023) : https://dl.acm.org/doi/fullHtml/10.1145/3605655.3605683 (accès direct bloqué en fetch ; PDF : https://digitaleconomy.wales/documents/ecce-2023-papers/06-The-Impact-of-Scrollytelling.pdf). Limites relevées : le scrollytelling est **contre-productif quand on veut comparer texte et figure**, quand **beaucoup de données changent à chaque scroll**, et pour tout usage de **consultation/recherche d'information** plutôt que de lecture linéaire.

### 3.4 Ce qui fatigue le lecteur — liste opérationnelle

1. **Le scroll-jacking.** Détourner l'inertie du scroll casse le seul repère que l'utilisateur possède. C'est la critique n°1 du format.
2. **Le débit.** Goodsell, sur les animations moléculaires en classe : elles « may introduce detailed interactions at such a rapid pace that the novice learner does not have time to process and internalize the information ». Et : « Experts often assume that novices "see" the same details that experts see ». Un plan par idée, et le droit de s'arrêter.
3. **Le changement simultané de tout.** Si la caméra bouge, que la couleur change et que le texte défile en même temps, rien n'est lu. Une variable animée à la fois.
4. **La longueur non bornée.** Sans indicateur de progression et sans sommaire, le lecteur ne sait pas s'il en a pour 3 ou 30 minutes.
5. **L'impossibilité de comparer.** Si l'état B efface l'état A, le lecteur ne peut pas faire la différence — d'où l'intérêt du curseur (A et B au bout du même geste) plutôt que de deux scènes successives.
6. **L'absence de sortie.** Il faut toujours un chemin « je veux juste explorer » ou « je veux juste lire le texte ».

### 3.5 La règle pédagogique

Goodsell énonce l'arbitrage exactement : « If they oversimplify the content, students think that the cell is "simple" and miss the nuanced complexities. If *all* the details are provided, novices become overwhelmed and can easily give up. » La sortie est la **zone proximale de développement** (Vygotsky) et surtout **l'apprentissage en spirale de Bruner** : on repasse plusieurs fois sur le même objet en creusant à chaque tour.

**Traduction produit : trois passages sur la même cellule, pas un seul parcours qui explique tout.** Passage 1 = silhouettes et compartiments. Passage 2 = acteurs nommés et processus. Passage 3 = densité réelle, cinétique, incertitude.

---

## 4. Quatre directions artistiques possibles

### A. Réaliste-mésoscopique (Goodsell / cellPACK)

- **Palette** : teintes rabattues, saturation moyenne, valeur claire ; fond ivoire ou anthracite chaud ; contour noir/brun 1 px partout ; aucun blanc pur, aucun noir pur.
- **Ambiance** : planche d'atlas, aquarelle, densité de tapisserie. Le regard « tombe » dans l'image.
- **Rendu** : cel-shading, aplats + outline, occlusion ambiante, zéro spéculaire, profondeur par assombrissement plutôt que par flou.
- **Avantages pédagogiques** : c'est la seule DA qui enseigne le crowding et l'échelle relative, c'est-à-dire les deux choses que le public ignore. Elle est aussi la plus honnête sur ce qu'on ne sait pas (schématique vs détaillé).
- **Risques** : illisible sans outillage (il *faut* les coupes, le LOD, le filtrage par famille) ; coûteuse en GPU si mal instanciée ; peut paraître « vieux manuel » à un public habitué au néon ; et sur petit écran, le bruit visuel gagne.

### B. Sombre-néon-fluorescent (microscopie confocale)

- Références : https://www.microscopyu.com/galleries/confocal, https://www.nikonsmallworld.com/techniques/confocal
- **Palette** : fond noir profond. Trois à quatre canaux fluorescents seulement. Additif : les recouvrements produisent du blanc, ce qui est **une information** (colocalisation).
- **Ambiance** : nocturne, contemplative, un peu clinique. Bloom léger, glow, grain de capteur, légère aberration chromatique.
- **Avantages pédagogiques** : c'est ce que les biologistes *voient réellement*, donc la seule DA qui prépare à lire une vraie image de labo. Le contraste maximal isole parfaitement l'objet d'intérêt. Les compteurs et le HUD y vivent naturellement (texte clair sur fond noir).
- **Risques** : le noir + néon glisse très vite vers le « dashboard de science-fiction » et perd toute crédibilité ; l'additif rend le daltonisme critique ; la lumière additive **détruit la notion de matière encombrée** — tout ce qui n'est pas marqué disparaît, ce qui reproduit exactement l'erreur du vide cellulaire ; enfin, le glow coûte cher en fill rate.

### C. Schématique-clair-éditorial (BioRender)

- Références : https://www.biorender.com/ — conventions couleur : https://www.biorender.com/blog/color-considerations-in-graphs
- **Palette** : fond blanc ou gris très clair, 5 à 7 teintes vectorielles franches, contours nets, typo sans-serif, étiquettes partout.
- **Ambiance** : figure d'article, diapositive, propre, imprimable.
- **Avantages pédagogiques** : nommage immédiat, aucune ambiguïté, transfert direct vers les cours et les publications, accessibilité facile (contraste maîtrisé, palettes déjà colorblind-friendly côté BioRender Graph).
- **Risques** : c'est la DA qui **ment le plus** — cellule vide, organites isolés, molécules géantes, tout ce que Goodsell reproche aux manuels ; uniformité visuelle massive (tout le monde puise dans la même bibliothèque de 50 000 icônes, les figures se ressemblent toutes) ; aucune émotion, donc aucune rétention chez un public non captif.

### D. Abstrait-poétique

- **Palette** : monochrome ou bichrome, dégradés longs, matière (papier, encre, particules), peu de contours.
- **Ambiance** : installation, générative, sonore. Le sens vient du mouvement et du rythme, pas de l'étiquetage.
- **Avantages pédagogiques** : transmet une *intuition* (le hasard, la vitesse, l'échelle, l'improbabilité de la vie) que le réalisme rate. Excellent en ouverture et en clôture d'expérience.
- **Risques** : ne transmet aucun fait vérifiable ; si c'est le mode dominant, l'utilisateur ne peut rien réutiliser ; les scientifiques la rejettent ; et elle est indéfendable si l'on prétend à l'exactitude.

---

## 5. UI pour la donnée live sur une scène 3D

### 5.1 Principes

1. **Le HUD ne doit jamais recouvrir le centre optique.** Réserver les coins et une bande latérale ; laisser le tiers central toujours libre.
2. **Un seul plan de surimpression, une seule couleur d'encre.** Le texte porte des tokens de texte (primaire / secondaire / atténué), jamais la couleur d'une série. La couleur d'identité est portée par une pastille ou par la molécule elle-même dans la scène.
3. **La légende est le contrôleur.** C'est le motif « Molecular Families » de *Life on Earth* : cliquer une entrée de légende **désature tout le reste** plutôt que de le masquer. On garde le contexte (donc le crowding) tout en isolant la cible. C'est aussi le meilleur substitut à une barre d'outils.
4. **Le curseur bat le bouton.** « The Crowded Cell » : un slider 0–100 % de densité. Le curseur de température de CellPAINT. Un curseur est réversible, comparable, sans état caché — il fait sentir une variable au lieu de la déclarer.
5. **Ancrer les compteurs, pas les étiquettes.** Les compteurs (nombre de molécules visibles, échelle courante en nm, temps simulé) vivent dans un cadre fixe. Les étiquettes d'objets vivent dans la scène, avec ligne de rappel et **anti-collision** : au-delà de 4–5 étiquettes simultanées, basculer en survol seulement.
6. **Un graphe superposé doit être minuscule et sans grille.** Sparkline 2 px, pas d'axes, pas de quadrillage, une valeur courante en clair, l'échelle dans l'infobulle. Si un graphe a besoin d'axes et d'une grille, il n'a rien à faire au-dessus de la 3D : il va dans le panneau latéral.
7. **Jamais deux échelles verticales.** Deux grandeurs de magnitudes différentes = deux sparklines empilées, pas un double axe.
8. **Lisibilité garantie par le substrat, pas par la chance.** Sous chaque bloc de HUD : un voile (surface à 70–85 % d'opacité + `backdrop-filter: blur`) ou un dégradé vignettant. Ne jamais compter sur la scène pour être sombre au bon endroit.
9. **Zone morte de survol.** Une infobulle qui suit le curseur au pixel près rend la scène impossible à orbiter. Déclencher au-delà d'un seuil de temps et figer la position.

### 5.2 Trois dispositions, par intention

- **Mode récit (scrollytelling)** : aucun HUD. Une seule ligne de texte, un compteur d'échelle, une barre de progression. Tout le reste est off.
- **Mode exploration** : panneau latéral rétractable à gauche (arborescence des compartiments + légende cliquable), coin bas-droit = compteurs et curseurs (densité, vitesse, coupe), coin haut-droit = échelle et boussole. Le panneau se replie en icônes.
- **Mode données** : split 60/40 — 3D à gauche, graphes à droite — avec **brossage croisé** (sélectionner un point du graphe surligne l'objet 3D et réciproquement). C'est exactement le pattern Allen Cell Feature Explorer ↔ 3D Cell Viewer (https://cfe.allencell.org/, https://www.allencell.org/3d-cell-viewer.html).

### 5.3 Ce qui tue une scène 3D

- Panneaux opaques rectangulaires occupant plus de 25 % de l'écran.
- Bordures blanches à 1 px partout (le « HUD de jeu vidéo »).
- Des nombres qui clignotent ou défilent à chaque frame — lisser sur 250–500 ms et n'afficher que 2 à 3 chiffres significatifs.
- Une légende à 12 entrées. Au-delà de 6–8 catégories, regrouper en « Autres » ou passer en petites multiples ; ne jamais générer une teinte supplémentaire à la volée.
- Le glassmorphism poussé au maximum : le flou coûte cher et le contraste s'effondre.

---

## 6. Accessibilité

### 6.1 Mouvement

- `prefers-reduced-motion` : https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — deux valeurs, `no-preference` et `reduce`. La recommandation MDN est explicite : **remplacer**, pas supprimer. « Animations such as scaling or panning large objects can be vestibular motion triggers » ; les transitions d'opacité et de couleur sont sûres, le scale et le pan ne le sont pas. Traduction pour une cellule : en mode réduit, le mouvement brownien continu devient un **fondu entre deux états**, la caméra ne vole plus mais **coupe** d'un plan à l'autre, et le zoom continu devient une série de paliers.
- WCAG 2.2 SC **2.3.3 Animation from Interactions** (niveau AAA) : https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html — « Motion animation triggered by interaction can be disabled, unless the animation is essential ». Note importante : le mouvement causé par le scroll de l'utilisateur est explicitement admis, « the user controls the essential scrolling movement ». Un scrollytelling n'est donc pas fautif par nature ; c'est le parallaxe décoratif qui l'est.
- **Toujours doubler la media query d'un interrupteur visible**, à la Ciechanowski (un seul bouton « mettre en pause toutes les animations » en haut de page). L'OS n'est pas toujours réglé, et le besoin est parfois ponctuel.

### 6.2 Couleur

- WCAG 1.4.1 *Use of Color* : la couleur ne doit jamais être le seul canal. Dans une scène cellulaire, l'identité passe donc par **couleur + silhouette + étiquette au survol**, ce qui tombe bien : c'est déjà la doctrine Goodsell.
- **Palette Okabe-Ito** (popularisée par Bang Wong, *Points of view: Color blindness*, Nature Methods 2011 ; correction : https://www.nature.com/articles/s41592-023-01974-0) — 8 couleurs conçues pour rester distinguables sous les trois principaux types de déficience : orange `#E69F00`, bleu ciel `#56B4E9`, vert bleuté `#009E73`, jaune `#F0E442`, bleu `#0072B2`, vermillon `#D55E00`, pourpre rosé `#CC79A7`, noir `#000000`. Le sous-ensemble Wong à 7 couleurs omet le noir. Recommandée par les revues Nature pour toutes les figures.
- **Ne jamais utiliser rouge/vert comme couple porteur d'information.** En imagerie de fluorescence, remplacer le rouge par le **magenta** ; la colocalisation ressort alors en blanc.
- **Séquentiel** : une seule teinte, claire → foncée, monotone en luminosité. **Divergent** : deux teintes + gris neutre au milieu. **Jamais d'arc-en-ciel**, et jamais de teinte au point médian d'un divergent.
- **Valider, ne pas estimer.** La séparation perceptuelle se calcule (ΔE en OKLab après simulation CVD) ; l'œil du concepteur n'est pas un instrument de mesure. J'ai passé les palettes du §7 au validateur — résultats et corrections ci-dessous, et **un résultat contre-intuitif à retenir** : *Okabe-Ito n'est pas automatiquement sûr en 7 slots*. Testé en catégoriel sur fond clair, toutes paires : le jaune `#F0E442` sort de la bande de luminosité (L 0,902, contraste 1,29:1 sur fond clair) et le couple `#CC79A7` ↔ `#009E73` tombe à ΔE 7,6 en deutéranopie. Conclusion opérationnelle : **utiliser le sous-ensemble de 6, réserver le jaune à un usage non porteur d'information** (surbrillance, halo), et ne jamais dépasser 6 familles simultanées — au-delà, regrouper en « autres » plutôt que de générer une 7e teinte.

### 6.3 Alternative textuelle à une animation

Une `alt` d'une ligne ne remplace pas une animation de 90 secondes. Le paquet minimal :

1. **Un résumé structuré du récit** en HTML sous la scène — une liste ordonnée d'étapes, chacune avec titre, une phrase, et un lien qui **saute la caméra à cet instant**. Ce sommaire sert à la fois de plan d'accessibilité, de navigation clavier et de table des matières pour tout le monde.
2. **Une transcription/description longue** liée par `aria-describedby` sur le canvas.
3. **Une région `aria-live="polite"`** qui annonce les changements d'état significatifs (« Échelle : 100 nanomètres. Objet au centre : ribosome. »), en la limitant aux événements discrets — jamais aux valeurs continues, sinon le lecteur d'écran devient inutilisable.
4. **Une image fixe légendée par étape** (le « multiple » de Goodsell : plusieurs panneaux figés valent une animation quand on ne peut pas animer).

### 6.4 Navigation clavier dans une scène 3D

Le point dur, à énoncer franchement : **un canvas est opaque pour les technologies d'assistance**. Il n'y a pas d'ordre de tabulation à l'intérieur d'un contexte WebGL. Le seul motif qui marche est la **couche DOM parallèle** :

- Un arbre d'éléments focalisables (boutons/liens) **hors écran ou visuellement discret**, un par point d'intérêt, synchronisé avec la scène : recevoir le focus déplace la caméra, `Entrée` ouvre le panneau d'information. Références : https://cerovac.com/a11y/2021/06/making-three-dimensional-web-user-interfaces-accessible/, https://annekagoss.medium.com/accessible-webgl-43d15f9caa21
- Outillage existant si le projet est en React Three Fiber : **`@react-three/a11y`** — https://github.com/pmndrs/react-three-a11y (gère focus, rôles, annonces, curseurs).
- `aria-label` descriptif sur le `<canvas>` lui-même, plus un `aria-labelledby` mis à jour dynamiquement quand la vue change (le motif du configurateur de canapé IKEA cité dans la littérature a11y).
- **Raccourcis explicites et documentés** : flèches = orbite, `+`/`-` = zoom, `Tab` = point d'intérêt suivant, `Échap` = revenir à la vue d'ensemble, `Espace` = pause du mouvement. Afficher la liste derrière une touche `?`.
- **Prévoir une sortie de focus** : `Tab` depuis le canvas doit pouvoir en sortir. Ne jamais capturer le clavier sans indication visible.
- **Cibles de pointage ≥ 24×24 px CSS** — WCAG 2.2 SC 2.5.8 *Target Size (Minimum)*, niveau **AA** : https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html. S'applique aux hotspots dessinés dans la scène, pas seulement aux boutons du HUD. Exception « espacement » utilisable si les cibles sont plus petites mais assez éloignées (un cercle de 24 px centré sur chacune ne doit en croiser aucune autre) — utile pour une constellation dense de points d'intérêt moléculaires.

---

## 7. Recommandation : trois directions artistiques distinctes et défendables

Chacune assume un arbitrage différent sur crowding vs lisibilité, et chacune a une langue de mouvement propre.

### Direction 1 — « Planche vivante » (Goodsell animé, avec curseur de vérité)

- **Position sur l'arbitrage** : la densité est le sujet. On ne supprime rien, **on rend l'utilisateur responsable de la suppression**.
- **Palette (validée)** : fond ivoire `#F2EEE4` en clair / anthracite chaud `#1C1A17` en sombre. Six familles moléculaires, sous-ensemble Okabe-Ito : bleu `#0072B2`, vert bleuté `#009E73`, orange `#E69F00`, pourpre rosé `#CC79A7`, bleu ciel `#56B4E9`, vermillon `#D55E00`, plus un gris neutre pour « non identifié ». Contour brun-noir 1 px sur chaque instance.
  **Résultat du validateur** (catégoriel, fond clair, paires adjacentes) : bande de luminosité PASS · plancher de chroma PASS · séparation CVD PASS (pire paire `#56B4E9`↔`#CC79A7`, ΔE 9,6 deutan / 8,5 tritan) · plancher vision normale PASS (pire paire `#009E73`↔`#0072B2`, ΔE 18,7) · **contraste sur fond : WARN** — `#E69F00` 2,19:1, `#56B4E9` 2,25:1, `#CC79A7` 2,98:1 sont sous 3:1. Ce WARN n'est pas ignorable : il **oblige** un encodage secondaire. Heureusement, c'est déjà la doctrine de la direction — contour systématique, silhouette distincte, étiquette au survol. Le contour 1 px n'est donc pas un choix esthétique, c'est une obligation d'accessibilité.
- **Rendu** : cel-shading + outline, SSAO, instancing GPU, imposteurs sphériques au-delà d'un seuil de distance, plans de coupe (la « métaphore de la coupe histologique » de Goodsell).
- **Mouvement** : brownien permanent, faible amplitude, haute fréquence. Aucune trajectoire dirigée. Les rares événements scriptés sont annoncés par le texte, jamais par la caméra qui « devine ».
- **Signature d'interaction** : **le curseur de densité 0–100 %**, présent en permanence, qui est *aussi* le curseur de difficulté pédagogique. À 0 % on a un schéma de manuel ; à 100 % on a la vérité. Plus la légende-filtre qui désature au lieu de masquer.
- **Défense** : c'est la seule direction qui corrige l'erreur que fait tout le reste du marché, et elle a une caution scientifique directe (Goodsell, cellPACK, PDB-101). Elle est aussi la plus originale en 2026 : personne ne fait de l'aquarelle mésoscale en temps réel dans un navigateur.
- **Risque assumé** : coût GPU et complexité de LOD. Prototyper le budget de rendu avant de valider la DA.

### Direction 2 — « Coupe optique » (confocal honnête, pas néon)

- **Position sur l'arbitrage** : on assume la suppression, mais on la **justifie physiquement** — dans une image de fluorescence, ce qui n'est pas marqué n'est réellement pas visible. Le vide n'est plus un mensonge, c'est un protocole.
- **Palette (corrigée après échec du validateur)** : fond `#07080B`.
  **Ma première proposition a échoué et c'est instructif.** Le quatuor « néon » spontané — cyan `#4DD9E8`, vert `#5FE08A`, magenta `#E85AC8`, ambre `#F0C040` — **FAIL** sur deux checks : bande de luminosité (les quatre entre L 0,69 et 0,83, trop clairs pour le mode sombre) et surtout **plancher vision normale** — cyan ↔ vert à ΔE 13,6 en vision normale et **2,6 en tritanopie**. Autrement dit, le couple cyan/vert du confocal, qui *paraît* évident, est presque indiscernable : c'est exactement le piège que le §6.2 dénonce, et j'y suis tombé en le rédigeant.
  **Palette retenue, toutes vérifications PASS** contre le fond `#07080B` : bleu `#3B6FD4` (canal noyau, type DAPI), vert `#22A05A` (canal GFP), magenta `#C93E9E` (canal rouge lointain), ambre `#C08420` (4ᵉ canal). Bande de luminosité PASS · chroma PASS · CVD PASS (pire paire `#C93E9E`↔`#22A05A`, ΔE 10,6 deutan / 7,6 tritan) · vision normale PASS (ΔE 25,0) · contraste ≥ 3:1 PASS sur les quatre. Le ΔE tritan de 7,6 reste dans la bande plancher 6–8, donc **encodage secondaire obligatoire** : c'est le rôle des boutons de canal nommés (« tubuline-GFP »), qui existent déjà dans le concept.
  **Conséquence de DA, à assumer** : la validation force à abandonner le pastel lumineux. Les teintes de base sont franches et de luminosité moyenne ; **l'effet néon doit venir du bloom et du fond noir, pas de la teinte elle-même**. C'est d'ailleurs plus fidèle au confocal réel, où le signal brut est sombre et où c'est l'étalement d'histogramme qui fait le glow. Blanc = colocalisation. Encre HUD achromatique : blanc à 90 % / 60 % / 38 %.
- **Rendu** : additif, bloom court et contrôlé (pas de halo mou), grain de capteur subtil, profondeur de champ étroite fidèle au confocal, **z-stack scrollable** — le scroll parcourt les coupes optiques, exactement comme au microscope.
- **Mouvement** : lent, flottant, avec un léger scintillement de photo-comptage. Les événements sont des apparitions/extinctions de signal, pas des déplacements de caméra.
- **Signature d'interaction** : **les toggles de canaux** (comme dans un vrai logiciel d'acquisition) et le z-stack au scroll. On enseigne la méthode en même temps que la biologie.
- **Défense** : c'est ce que voit un chercheur ; ça crée un pont direct vers la littérature et vers Allen Cell Explorer ; c'est spectaculaire sans être mensonger, à condition de nommer le protocole à l'écran.
- **Risque assumé** : la ligne est fine avec le « dashboard sci-fi ». Garde-fous : interdire les teintes de canal hors de la scène (le HUD reste achromatique), et ne jamais utiliser cyan et vert comme deux canaux simultanés porteurs d'information — c'est le couple que le validateur rejette.

### Direction 3 — « Powers of Ten cellulaire » (zoom continu, DA hybride qui change avec l'échelle)

- **Position sur l'arbitrage** : la DA n'est pas fixe, **elle est fonction de l'échelle** — précisément la technique que Goodsell attribue à Berry (« continuously change the representation to highlight features of the current level »).
- **Palette progressive** : à l'échelle tissu/cellule, éditorial clair (fond blanc cassé, aplats francs, étiquettes) ; à l'échelle organite, la palette se rabat et le crowding apparaît ; à l'échelle complexe/protéine, on passe en Goodsell pur ; à l'échelle atomique, monochrome + matière. Une seule teinte de continuité traverse toutes les échelles (par exemple le vert bleuté `#009E73` porté par un objet-repère unique — un ribosome, présent et reconnaissable à trois échelles consécutives).
- **Mouvement** : le scroll **est** l'échelle, avec un compteur permanent en nanomètres, à la manière de *The Deep Sea*. Jalons annotés à chaque décade. Aucun scroll-jacking : on peut remonter.
- **Signature d'interaction** : le compteur d'échelle + les **objets-ponts** qui restent identifiables entre deux niveaux, et un mini-plan « vous êtes ici » qui se remplit.
- **Défense** : c'est la lignée la plus éprouvée du domaine (Eames, Nelson Max, Berry, neal.fun) ; c'est le format le plus naturel pour le web (le scroll est gratuit, universel, accessible au clavier, et explicitement admis par WCAG 2.3.3) ; et il résout l'arbitrage en le **répartissant dans le temps** plutôt qu'en le tranchant.
- **Risque assumé** : quatre DA à produire au lieu d'une, et des transitions difficiles à réussir. C'est la direction la plus chère.

### Comment choisir

- Public large, objectif « faire comprendre l'échelle et l'encombrement » → **Direction 3**, avec la Direction 1 comme régime d'arrivée.
- Public étudiant/scientifique, objectif « lier à la donnée réelle » → **Direction 2**.
- Objectif « poser une signature visuelle forte et défendre une thèse » → **Direction 1**, qui est aussi la plus difficile à copier.

Les trois partagent une même base Okabe-Ito à 6 slots : la Direction 1 l'utilise telle quelle en catégoriel, la Direction 3 la fait dériver en luminosité avec l'échelle, et la Direction 2 est la variante re-steppée pour fond noir (mêmes familles de teinte, luminosité et chroma recalés). **C'est l'argument principal pour figer la palette *avant* de choisir la direction** : une seule validation à maintenir, et les trois DA restent interchangeables tard dans le projet.

### Note de méthode

Les deux palettes ci-dessus ont été passées au validateur du skill `dataviz` (`scripts/validate_palette.js`, ΔE OKLab après simulation deutan/protan/tritan). La Direction 1 est passée du premier coup avec un WARN de contraste exploitable ; la Direction 2 a **échoué** dans sa version intuitive et a dû être re-steppée. Toute palette ajoutée plus tard doit repasser par là — y compris les rampes séquentielles pour les cartes de densité, qui se vérifient sur la monotonie de luminosité et non sur les mêmes checks.

---

Copie de travail du rapport : `/private/tmp/claude-501/-Users-zakichair/25af8214-7291-491f-86a1-c3300b68227a/scratchpad/rapport-viz-cellulaire.md`
PDF source Goodsell téléchargé localement : `/Users/zakichair/.claude/projects/-Users-zakichair/25af8214-7291-491f-86a1-c3300b68227a/tool-results/webfetch-1785443303316-9s62nx.pdf`
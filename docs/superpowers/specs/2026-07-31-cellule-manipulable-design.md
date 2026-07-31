# La cellule qu'on manipule — conception

**Date** : 31 juillet 2026
**Point de départ** : `main` à `d3c4888`, et la revue du même jour
(`docs/superpowers/rapports/revue-2026-07-31.md`).
**Demande** : rendre la cellule interactive — pouvoir donner un brin d'ARN à un ribosome et voir
l'ADN se traduire, voir la synthèse d'ATP, et disposer de leviers d'action.

---

## 1. Ce que la demande implique, et que le produit n'a pas

Les trois choses demandées exigent toutes de l'**état**. Or le seul contrat exécuté aujourd'hui est
`animer(temps: number) => void` : chaque mécanisme est une fonction pure du temps écoulé, sans
mémoire, sans couplage, sans conservation (revue §3.3). Un ribosome à qui l'on « donne » un ARNm
doit se souvenir qu'il l'a reçu ; un compteur d'ATP doit se souvenir de ce qu'il a produit et
dépensé ; un levier doit changer ce qui arrive ensuite.

C'est exactement le point 11 de l'ordre de reprise de la revue — « la spec et le produit ne
décrivent plus la même chose », avec deux issues : construire le moteur de simulation (45–60
jours-homme) ou réécrire la spec pour un atlas animé.

**Ce programme prend une troisième voie, plus étroite et honnête que les deux** : un moteur
*minimal* — trois variables d'état et trois inhibiteurs — greffé sans toucher aux treize mécanismes
qui marchent. Pas une simulation de la cellule ; une simulation du **bilan énergétique** et de la
**chaîne gène → protéine**, qui sont précisément ce que la demande vise.

## 2. Prérequis non négociables

Tout ce qui est demandé est une interaction **rapprochée** : donner un brin d'ARN à un ribosome de
30 nm suppose d'être à l'échelle du ribosome. Or à cette échelle, les deux gestes que la page
annonce déjà sont morts :

- **La caméra ne suit pas la rotation de la scène.** À 5,5 µm de l'axe, la dérive tangentielle est
  de 304 nm/s ; le champ visuel en vue rapprochée fait 92 nm. Le sujet quitte le cadre en 0,30 s,
  alors que l'amortissement d'`OrbitControls` met deux secondes à y amener la caméra. Le mécanisme
  est donc sorti du champ **avant** que la caméra n'arrive.
- **Le survol coûte 9,74 ms par mouvement de souris**, soit plus qu'une image entière à 120 im/s.
  On ne peut pas poser un glisser-déposer sur un chemin de pointeur qui sature déjà le fil principal.

S'y ajoutent deux corrections qui ne sont pas de la cosmétique **pour ce programme précis** : le
compteur d'ATP va lire des débits, et deux d'entre eux sont faux aujourd'hui (revue §4.1, §4.2) —
la chaîne respiratoire fabrique 9,4 ATP par tour là où sa propre fiche en annonce 3, et le badge de
la bêta-oxydation affiche « accéléré ×5 » pour un ralenti ×5,4. Brancher un compteur sur des débits
faux, c'est le faire naître menteur.

## 3. Architecture

### 3.1 Où va le code, et pourquoi là

La revue ouvre sur un constat structurel (§2) : `src/noyau/` — 780 lignes pures et testées — n'est
importé que par les bancs. **Les 57 tests du projet portent à 100 % sur du code que la page
n'exécute pas**, et les 16 000 lignes de `src/cellule/` n'ont aucun test.

Le moteur d'état est la première chose de ce projet qui soit testable sans GPU. Elle va donc dans
`src/noyau/`, et la page l'importe. Ce n'est pas un rangement : c'est la réparation du défaut §2.

```
src/noyau/                     pur, sans Three.js, testé
  codeGenetique.ts             les 64 codons, sourcés
  gene.ts                      la séquence réelle du gène, et sa traduction
  etatCellule.ts               ATP, gradient Na+, force proton-motrice, inhibiteurs
  atelier.ts                   la machine à états de la chaîne gène → protéine

src/cellule/atelier/           la 3D et l'interface de l'atelier
  scene.ts                     le décor et les acteurs
  panneau.ts                   les commandes et la lecture
```

### 3.2 Le contrat des mécanismes n'est pas touché du tout

Il était prévu d'ajouter au contrat un champ optionnel `reagir?(etat)`, par lequel les mécanismes
existants auraient pu lire l'état. **Il n'a pas été écrit.** L'atelier étant autonome, aucun des
treize mécanismes n'a besoin de lire l'état, et un champ que personne n'implémente est de
l'API spéculative — ce que le §2 de `CLAUDE.md` interdit.

Le contrat `Mecanisme` est donc rigoureusement inchangé, et les 15 582 lignes de `src/cellule/` ne
subissent que des corrections de chiffres. (La vérification faite au passage reste utile pour la
suite : `mettreAEchelleReelle` reconstruit ses objets par `{...m}`, donc un champ ajouté au contrat
traverserait l'enveloppe sans disparaître.)

### 3.3 Le moteur : trois variables, pas trente

| Variable | Unité | Valeur au repos | Ce qu'elle représente |
|---|---|---|---|
| `atp` | mM | 3,0 | Concentration cytosolique d'ATP |
| `gradientNa` | sans unité, 0–1 | 1,0 | Fraction du gradient Na⁺/K⁺ normal |
| `forceProtonMotrice` | sans unité, 0–1 | 1,0 | Fraction de la force proton-motrice mitochondriale |

Un pas de temps fixe, une intégration explicite, aucune allocation. Le pas est découplé de
l'affichage : la boucle accumule le temps réel et consomme des pas de 1/60 s, si bien que le
comportement ne dépend pas de la cadence d'images.

**Les débits sont sourcés et déclarés**, ce qui est la première application du critère D5 de la
spec d'origine (« un fichier de données sourcé est l'origine unique de tout chiffre affiché »),
que la revue §3.4 relevait comme inversé — 178 chiffres en dur, zéro citation.

### 3.4 Les trois leviers, et pourquoi ceux-là

Chacun a une conséquence **vraie**, et deux des trois sont **contre-intuitives** — c'est ce qui en
fait un objet pédagogique plutôt qu'un bouton.

| Levier | Ce que l'étudiant attend | Ce qui arrive réellement |
|---|---|---|
| **Couper l'oxygène** | « la cellule s'arrête » | La force proton-motrice s'effondre, la respiration cesse, mais la glycolyse continue : il reste 2 ATP par glucose au lieu de ~30. La cellule ne meurt pas, elle s'appauvrit d'un facteur quinze. |
| **Oligomycine** (bloque l'ATP synthase) | « les protons s'arrêtent aussi » | **La force proton-motrice MONTE.** Les complexes continuent de pomper, et plus rien ne laisse revenir les protons. L'ATP s'effondre pendant que le gradient sature. L'énergie transite par un gradient, pas par une molécule — et c'est là qu'on le voit. |
| **Ouabaïne** (bloque la pompe Na⁺/K⁺) | « la cellule manque d'énergie » | **L'ATP MONTE**, parce que la pompe en consommait un cinquième à elle seule. Ce qui s'effondre, c'est le gradient Na⁺/K⁺ — donc le potentiel de membrane et tout ce qui en dépend. Bloquer une dépense n'est pas la même chose que couper un revenu. |

Le troisième levier est **mot pour mot le critère de réussite** que le projet s'était donné et que
la revue §3.3 déclarait hors d'atteinte : « … et a vu de ses yeux ce qui arrive à une cellule dont
on bloque la pompe Na⁺/K⁺ ».

## 4. L'atelier du gène

### 4.1 Pourquoi une scène neuve plutôt qu'un enchaînement des quatre existantes

Quatre mécanismes racontent déjà la chaîne, en quatre endroits déconnectés : `transcription`,
`epissage`, `exportNucleaire`, `traductionReticulum`. Les enchaîner suppose de pouvoir **démarrer**
un mécanisme sur commande et savoir quand il a **fini** — rien dans le contrat ne l'expose, et
chacun calcule sa phase depuis le temps absolu avec ses propres cycles internes (`DUREE_CYCLE`,
`PERIODE_TOPO`, `PAS_CYCLE`).

Vérification faite : `animer(temps)` n'emploie `temps` que sous des formes décalables (`temps % T`,
`temps / DUREE`), donc l'injection d'une horloge locale serait techniquement possible. Mais ces
quatre modules pèsent 3 468 lignes, se déroulent à quatre échelles et quatre endroits de la cellule,
et animent chacun plusieurs acteurs en parallèle (trois polymérases, cinq ribosomes). Les asservir
à une horloge commune reviendrait à les réécrire.

**Décision** : une scène neuve, autonome, qui porte la chaîne de bout en bout. Les quatre
mécanismes existants restent ce qu'ils sont — les vues « regarder ceci en isolation ».

### 4.2 Ce qui rend « voir se traduire l'ADN » vrai plutôt que décoratif

Aujourd'hui la transcription n'a **aucune identité de base** (un grain pour deux nucléotides) et la
traduction montre douze codons génériques. Pour qu'on voie de l'**ADN** être traduit, il faut que la
séquence détermine la protéine :

- une **séquence réelle et courte** : la région codant la chaîne B de l'insuline humaine, 30 codons,
  90 paires de bases ;
- la **table standard du code génétique**, les 64 codons ;
- les acides aminés **nommés et colorés par classe** chimique.

C'est petit à écrire, et c'est toute la différence entre une jolie animation et une fonction qui
signifie quelque chose. Un étudiant peut lire le codon sous le ribosome, et vérifier.

### 4.3 Les cinq étapes, et le geste demandé

1. **Transcrire.** L'utilisateur ouvre le gène. La polymérase parcourt les 90 paires de bases et
   produit un pré-ARNm dont la séquence est celle du brin codant, T remplacé par U.
2. **Coiffer.** La coiffe est posée dès le 25ᵉ nucléotide, pas à la fin — comme dans le mécanisme
   existant, qui a déjà raison là-dessus.
3. **Exporter.** Le brin franchit l'enveloppe. Court, parce que le mécanisme dédié le montre déjà en
   détail.
4. **Donner le brin au ribosome.** *C'est le geste demandé.* Le brin devient saisissable ; on le
   dépose sur l'une des deux sous-unités. Tant qu'il n'est pas déposé, rien ne se traduit.
5. **Traduire.** Codon par codon. À chaque pas : le codon lu s'affiche, l'ARNt porteur du bon
   anticodon arrive après trois à cinq essais ratés, l'acide aminé est nommé et ajouté à la chaîne,
   et **4 liaisons riches sont débitées du pool d'ATP** — 2 pour l'aminoacylation de l'ARNt
   (ATP → AMP), 1 pour eEF1A, 1 pour eEF2.

L'utilisateur peut avancer **pas à pas** ou laisser courir. Le pas à pas n'est pas un confort : à
ralenti ×20, trente codons prennent 102 secondes, et c'est la seule façon de lire une séquence.

### 4.4 La boucle qui relie tout

Sans elle, l'atelier et les leviers sont deux jouets séparés. Avec elle, c'est un système :

> Couper l'oxygène → la force proton-motrice s'effondre → la production d'ATP tombe à un quinzième →
> le pool baisse → **la traduction ralentit, puis s'arrête faute d'ATP**.

L'étudiant voit alors, sans un mot de commentaire, pourquoi une cellule privée d'oxygène cesse
d'abord de fabriquer des protéines.

## 5. Ce qui est retiré au passage

`vie.ts` contient une **troisième** traduction (`creerTraduction`), dont le champ `facteur` annonce
« ralenti ×20 » pour un accéléré ×3 — faux de signe et d'un facteur 59 (revue §5). Son interface
`Flux` duplique `Mecanisme` sans `justificationFacteur` ni `ellision`, et aucun de ses champs texte
n'est jamais lu par l'interface.

En écrire une quatrième sans retirer celle-là serait ajouter à la pile. `creerTraduction` est donc
supprimée ; les deux autres flux d'ambiance (`creerEchangesMineraux`, `creerTraficProteines`)
restent, car ils occupent le fond de la cellule et ne prétendent rien de faux à l'écran.

## 6. Tests

Le moteur d'état est la première chose de ce projet testable sans GPU, et les premiers tests de
l'histoire du dépôt à porter sur du code que la page exécute.

- **Code génétique** : les 64 codons présents une seule fois ; les trois codons stop ; la
  redondance connue (6 codons pour la leucine et la sérine, 1 pour le tryptophane et la méthionine).
- **Gène** : la séquence fait bien 90 bases, multiple de 3 ; sa traduction rend exactement
  `FVNQHLCGSHLVEALYLVCGERGFFYTPKT`, la chaîne B de l'insuline. **C'est le test qui garantit que ce
  qu'on voit à l'écran est de la biologie et pas du décor.**
- **État** : conservation (production − consommation = variation) ; retour à l'état stationnaire
  après une perturbation levée ; chacun des trois leviers produit le signe attendu sur chacune des
  trois variables — y compris les deux effets contre-intuitifs, qui sont ainsi verrouillés contre
  une « correction » ultérieure.
- **Atelier** : la machine à états refuse de traduire sans brin déposé ; le débit d'ATP par codon
  vaut 4 ; la traduction s'arrête quand le pool est vide et reprend quand il remonte.
- **Badge contre animation** (exigence D3 de la spec d'origine, jamais honorée) : un test compare le
  débit d'ATP annoncé par la fiche de la chaîne respiratoire à celui que le code produit.

## 6 bis. Ce que la construction a corrigé dans cette conception

Écrit après coup, parce que trois points de ce document se sont révélés faux à l'exécution.

- **La chaîne respiratoire n'avait pas de réserve.** Le contrôle respiratoire était borné à son
  régime de repos, si bien qu'une cellule réoxygénée mettait dix minutes à remonter au lieu de
  vingt secondes. La réserve respiratoire — une mitochondrie tourne à 1,5 à 3 fois son régime de
  repos quand l'ADP abonde — manquait purement et simplement.
- **Le gradient sodium ne s'effondre PAS sous anoxie.** Le test avait été écrit à « moins de 95 % » ;
  le modèle en rend 97, et c'est lui qui a raison. La pompe est vingt fois plus rapide que la fuite :
  même à 40 % de régime, elle tient le gradient. Un manque d'énergie partiel n'entame donc presque
  pas le potentiel de membrane — seul un blocage franc le fait, et c'est ce que fait l'ouabaïne.
- **Le plan de saisie du brin ne pouvait pas passer par le brin.** Mesuré en navigateur : le
  déplacement à l'écran est exact à 0,7 pixel près, mais le point déposé reste sur la ligne de visée
  du ribosome, trente-huit nanomètres devant lui. Viser juste ne suffisait pas à déposer. Le plan
  passe désormais par le ribosome.
- **Le fragment d'enveloppe a dû rétrécir.** Le plateau était dessiné à l'échelle vraie de bout en
  bout, et le pore de 120 nm écrasait des acteurs de 30. C'est le même arbitrage que la boîte de
  vérité : on ne peut pas être vrai partout à la fois, et il faut écrire lequel on sacrifie.

## 7. Vérification de livraison

Un `vitest` vert ne prouve rien sur le fait que l'utilisateur voie le ribosome. La revue a attrapé
le défaut §3.1 précisément parce qu'elle a regardé dans un vrai navigateur **rotation active et
réglages par défaut** — la première capture prise en conditions normales ne montrait aucun cycle de
Krebs, seulement du grain de cytosol.

La livraison est donc conditionnée à un passage en navigateur réel, rotation **active**, réglages
par défaut, où l'on vérifie que : le ribosome reste dans le cadre, le brin peut lui être donné, les
codons défilent lisiblement, la jauge d'ATP bouge, et couper l'oxygène arrête la traduction.

## 8. Hors périmètre

- **Le mobile**, sorti du périmètre par `d6b930d`. Rien n'est ajouté au chemin ≤ 900 px.
- **Le moteur de simulation complet** de la spec d'origine (D1, D2, D4). Ce programme ne le
  construit pas et ne prétend pas le remplacer : il construit un bilan énergétique et une chaîne
  gène → protéine, ce qui est bien plus étroit. La spec d'origine reste à trancher, et ce document
  ne tranche pas à sa place.
- **La relecture par un biologiste**, qui reste une condition de livraison (D5). La séquence de
  l'insuline et la table du code génétique sont déclarées avec leur source et leur niveau de
  confiance précisément pour rendre cette relecture possible.

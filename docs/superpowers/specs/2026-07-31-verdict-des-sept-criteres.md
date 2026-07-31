# Verdict sur les sept décisions fondatrices

**Date** : 31 juillet 2026, fin de journée.
**Objet** : trancher le point 11 de l'ordre de reprise de la revue — « la spec et le produit ne
décrivent plus la même chose » — qui est le seul de la liste à n'avoir jamais été traité.
**Portée** : les sept critères D1 à D7 de `2026-07-30-cellule-vivante-design.md`, confrontés au
produit tel qu'il est aujourd'hui.

---

## 1. Pourquoi la question a changé de forme

La revue posait deux issues : construire le moteur de simulation (45–60 jours-homme), ou réécrire la
spec pour l'atlas animé que le produit était. Ce n'est plus le bon choix, parce que le produit n'est
plus ni l'un ni l'autre : il a maintenant un **moteur d'état à trois variables**, des **leviers
réversibles**, et une **chaîne gène → protéine manipulable**. La question n'est donc plus « moteur
ou atlas », mais :

> **Quels critères gardent un sens pour un atlas animé, mesuré et manipulable, doté d'un bilan
> énergétique ?**

Ce document répond critère par critère. Trois issues possibles pour chacun : **TENU** (le critère
vaut et il est honoré), **RÉDUIT** (le critère vaut, mais son ampleur est ramenée à ce qui est
défendable), **RAYÉ** (le critère ne vaut plus, et il faut dire pourquoi).

---

## 2. Le verdict

| | Critère | Verdict | Ce qui est décidé |
|---|---|---|---|
| **D1** | Simulation à l'échelle des compartiments, ~30 variables d'état | **RÉDUIT** | La doctrine est tenue sans faille ; l'ampleur passe de 30 variables à 3, déclarées |
| **D2** | Le rendu est un échantillonnage déclaré de l'état | **RÉDUIT** | (a) et (b) tenus ; (c) la foule en GLSL est **rayée** |
| **D3** | Chaque scène déclare son facteur, un test échoue si le badge diverge | **TENU en structure, RÉDUIT en couverture** | Le badge est indérivable à la main ; 2 mécanismes sur 16 sont mesurés |
| **D4** | Perturbations réversibles, retour à un repos défini | **TENU** | Dans le périmètre du moteur, et testé |
| **D5** | Un fichier de données sourcé est l'origine unique de tout chiffre affiché | **RÉDUIT** | `contenu/` est **rayé** ; la contrainte de chiffres significatifs et les niveaux de confiance sont **tenus** |
| **D6** | Aucune molécule ne sait où elle va | **TENU** | Honoré, et sur la scène que le critère cite nommément |
| **D7** | L'encombrement vrai n'existe qu'en sub-micron | **TENU** | La boîte est enfin honnête ; le corollaire « dalle et non cube » est **reporté** |

---

## 3. Le détail, et ce qu'il engage

### D1 — RÉDUIT à trois variables, et c'est écrit

**La doctrine est tenue sans exception** : il n'existe aucune entité « ion Na⁺ » dans le produit,
tout est grandeur et flux, et le moteur intègre à pas fixe. C'est le fond du critère, et il n'a
jamais été trahi.

**L'ampleur ne l'est pas.** `etatCellule.ts` porte trois variables — ATP, force proton-motrice,
gradient Na⁺/K⁺ — là où la spec en annonçait une trentaine. Manquent en particulier le **potentiel
de membrane** et les **concentrations ioniques par compartiment**, que la spec citait le plus.

**Décision : on ne construit pas les trente.** Le moteur à trois variables produit déjà les trois
histoires que le critère de réussite demande, il est testé, et il est stationnaire par construction.
Passer à trente demanderait le chiffrage complet, pour un gain pédagogique que rien n'établit. Ce
qu'il faut, c'est **le dire** : le §4.1 de la spec d'origine liste des valeurs de repos (Na⁺ 12/145
mM, K⁺ 140/4, Vm −70 mV) qui n'existent nulle part et qui devaient servir de tests. Cette liste est
à barrer.

### D2 — la foule en GLSL est rayée

Trois clauses, trois sorts.

- **(a) Le facteur d'échantillonnage est affiché.** Tenu : les seize mécanismes déclarent leur
  `ellision`, un test échoue si l'un se tait, et un autre exige qu'elle ait de la substance.
- **(b) La couche de rendu lit l'état, ne l'écrit jamais.** Tenu.
- **(c) « Tout le reste est une fonction du temps écrite en GLSL, sans état côté processeur — c'est
  ce qui fait passer 200 000 instances de 61 à 120 images par seconde. »** **RAYÉE.** Le produit ne
  contient aucun shader écrit à la main et tient 372 000 instances à 107 images par seconde en
  JavaScript pur. La clause décrivait une optimisation dont la mesure a montré qu'elle n'était pas
  nécessaire. La barrer est plus honnête que la porter comme une dette.

### D3 — la structure est acquise, la couverture ne l'est pas

**Ce qui est acquis, et ne peut plus régresser :** un module ne peut plus rédiger un badge. Chaque
mécanisme déclare un *nombre*, `MecanismeBrut` interdit le champ texte, et un seul endroit décide
d'écrire « ralenti » ou « accéléré ». L'inversion qui a traîné des mois dans la bêta-oxydation est
devenue une erreur de compilation.

**Ce qui ne l'est pas :** le NOMBRE lui-même. Deux mécanismes sur seize confrontent leur facteur à
une mesure de l'animation — la chaîne respiratoire, dont la période du rotor et le débit d'ATP sont
tous deux mesurés, et l'atelier, dont le badge est calculé depuis la vitesse effective. Les quatorze
autres pourraient annoncer 5 pour un facteur de 50 sans que rien ne bronche.

**Décision : le critère est tenu, la couverture est un chantier ouvert et chiffré.** Le patron
existe (`respiration.test.ts`) ; le décliner coûte environ une journée. La prochaine cible est la
pompe Na⁺/K⁺, qui montre dix-huit sodiums pour trois annoncés.

**Une interdiction du critère est violée, et assumée :** « le passage de accéléré à ralenti dans un
même plan est interdit ». `endoExocytose` porte « deux temps : accéléré ×5, puis ralenti ×5 000 »
sur un seul mécanisme. Le geste est honnête — les deux temps sont déclarés, et une seule vitesse
serait fausse pour l'un des deux — mais il contredit la lettre du critère. **On garde le mécanisme
et on amende le critère**, en autorisant explicitement un badge composite quand les deux temps sont
déclarés.

### D4 — tenu

État stationnaire déduit et non réglé à la main, réversibilité testée pour l'anoxie et l'ouabaïne,
et le bouton « Rétablir le repos » que le §4.4 exigeait existe désormais. Le seul écart avec la
lettre du critère est que la réversibilité porte sur le **gradient** et non sur le **potentiel de
membrane**, qui n'existe pas — c'est la conséquence de D1, déjà déclarée.

### D5 — `contenu/` est rayé, la discipline est gardée

Le critère demandait trois choses. Elles ne se valent pas.

- **Un répertoire `contenu/` comme origine unique de tout chiffre affiché.** **RAYÉ.** Le produit
  compte plusieurs centaines de constantes biologiques réparties dans les modules qui les
  dessinent, et les extraire toutes déplacerait le problème sans le résoudre : un chiffre dans un
  fichier de données peut diverger de la géométrie exactement comme un chiffre dans un module.
  **Ce qui a réellement fonctionné, c'est autre chose** : faire *dériver* le chiffre affiché de la
  géométrie construite. La boîte de vérité annonce son arête parce qu'elle la calcule ; la chaîne
  respiratoire annonce son débit parce qu'un test le compte dans ses matrices. C'est la version qui
  marche, et elle est plus forte que l'origine unique.
- **Les identifiants BNID affichés en infobulle.** **REPORTÉ**, sans échéance. Aucun n'est affiché
  aujourd'hui.
- **« Aucune valeur de confiance [B] affichée avec plus d'un chiffre significatif. »** **TENU**
  depuis aujourd'hui. C'était violé par le code le plus récent — le panneau affichait « 3,00 mM »
  pour une valeur que son propre module déclare [B] — et c'est corrigé : les concentrations sont
  données en part du repos, avec l'ancrage à un chiffre.

**La relecture par un biologiste reste une condition de livraison, et elle n'a pas eu lieu.** Un
audit a collationné la séquence de l'insuline sur GenBank et y a trouvé une base fausse sur
quatre-vingt-dix ; c'est le genre de chose qu'une relecture humaine trouve, et le genre de chose
qu'aucun test du projet n'aurait vue.

### D6 — tenu

Six ARN de transfert approchent le ribosome, cinq repartent, un s'installe — sur la scène que le
critère cite nommément. Le comptage vit dans le noyau testé.

**Réserve à ne pas taire :** le tirage est déterministe, et il l'était mal — la suite d'essais était
un cycle de trois, et trois des six ARN de transfert ne pouvaient jamais gagner. C'est corrigé, mais
il faut rappeler ce que le critère retient : la technique de Drew Berry, « images-clés pour scripter
le récit, mouvement stochastique superposé ». Ce n'est pas une simulation stochastique, et le
critère ne le demande pas.

### D7 — tenu, avec un corollaire reporté

**Le volet principal est enfin honoré, et il ne l'était pas.** La boîte de vérité annonçait 25 %
d'occupation pour **3,9 % mesurés** — un facteur 6,4 sur la seule affirmation que la page présente
comme la vérité. Son arête est désormais déduite du volume réellement semé, un test la vérifie sur
la géométrie, et rien de l'interface ne peut plus l'éclaircir.

**Le corollaire « une dalle à profondeur bornée, pas un volume » est REPORTÉ.** La boîte reste un
cube de 680 nm là où une dalle porterait, au même budget, une arête latérale bien plus large. Le
calcul existe et il est testé (`areteTenable`) ; c'est le passage à une dalle qui reste à faire.
C'est une amélioration réelle et bornée, pas une dette d'honnêteté : le cube ne ment plus.

---

## 4. Ce qu'il faut barrer dans la spec d'origine

Ces sections décrivent des sous-systèmes qui n'existent pas et qu'aucune décision ne prévoit de
construire. Les laisser, c'est laisser l'écrit et le produit diverger — la cause de presque tout ce
que la revue a trouvé.

| Section | À faire |
|---|---|
| §13, pile technique | `zustand`, `gsap`, `@playwright/test` ne sont pas installés. Une seule dépendance : `three` |
| §3.4, bandes d'échelle | Trois mondes en fondu, hystérésis, objets-ponts : rien de tout cela. Une seule scène, un zoom continu |
| §5.3, contour par détection de bord | Le banc l'a retenu et mesuré ; le produit n'a aucune passe de post-traitement |
| §9.4, dégradation adaptative | `metrologie.ts` est écrit et testé, la boucle ne le lit pas |
| §3.5 et §6.1, `contenu/` et les quatre chapitres | Aucun mode découverte, aucune question d'auto-contrôle |
| §1 et lot 3, topoisomérase et CRISPR | Aucun mécanisme correspondant. Les pièges « science » du §14 sur Cas9 sont donc sans objet |
| §11, découpage en lots 1 à 4 | Le produit ne le suit pas et n'a jamais été jugé sur pièce lot par lot |
| §7, accessibilité | Le canvas porte désormais un rôle et une description, mais la couche DOM focalisable, l'alternative textuelle et les raccourcis n'existent pas. **C'est la seule ligne de cette table qui reste une VRAIE dette**, et une condition de publication |

---

## 5. Ce que le produit est, en une phrase

> Un **atlas animé, mesuré et manipulable** d'une cellule eucaryote animale : vingt-trois organites
> et seize mécanismes aux proportions réelles, un bilan énergétique à trois variables qu'on
> perturbe par trois inhibiteurs réversibles, et un atelier où l'on porte soi-même un brin d'ARN
> messager à un ribosome pour voir une séquence d'ADN réelle devenir une protéine.

Ce n'est pas la simulation que la spec d'origine décrivait. C'est plus que l'atlas que la revue
constatait. Et c'est, désormais, ce que les deux documents disent.

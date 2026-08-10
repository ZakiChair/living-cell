# Dossier de relecture scientifique — « La cellule »

**Ce document est GÉNÉRÉ** depuis les objets que la page livre réellement, par
`outils/dossierRelecture.ts`. Il ne peut donc pas être périmé par rapport au produit.
Le régénérer après toute modification :

```
npx tsx outils/dossierRelecture.ts > docs/relecture-scientifique.md
```

## Ce qui est demandé au relecteur

Le site s'adresse à des étudiants en biologie. Trois questions par affirmation :

1. **Est-ce faux ?** Un ordre de grandeur, une unité, une stœchiométrie, un mécanisme.
2. **Est-ce trompeur ?** Vrai mais formulé de façon à installer une intuition fausse.
3. **Manque-t-il l'essentiel ?** Une réserve dont l'absence rend l'affirmation abusive.

Les chiffres sont repérés en gras dans chaque fiche pour guider la lecture. Le champ
**Ellision** dit ce que l’animation coupe ou échantillonne : c’est là que se logent les
écarts entre ce qui est montré et ce qui est vrai, et il mérite autant d’attention que
la description.

---

## 1. Les données de référence

### 1.1 La séquence du gène

- **Gène** : Chaîne B de l'insuline — Moitié de l'hormone qui fait entrer le glucose dans les cellules.
- **Longueur** : 90 bases, 30 codons
- **Source** : NM_000207.3 (NCBI), région codant la chaîne B de la préproinsuline humaine
- **Confiance déclarée** : [A], collationnée

```
TTTGTGAACCAACACCTGTGCGGCTCACACCTGGTGGAAGCTCTCTACCTAGTGTGCGGG
GAACGAGGCTTCTTCTACACACCCAAGACC
```

Traduite par la table standard, elle donne : `FVNQHLCGSHLVEALYLVCGERGFFYTPKT`

> **À vérifier** : la séquence est-elle bien celle de NM_000207.3, base par base ? La
> région retenue s'arrête à la fin de la chaîne B ; le gène entier continue sur le
> peptide C puis la chaîne A. Est-ce dit assez clairement à l’étudiant ?

### 1.2 La table du code génétique

Les 64 codons sont tabulés dans `src/noyau/codeGenetique.ts`, dans l'ordre
canonique U, C, A, G. Trois codons stop, vingt acides aminés, et la redondance non
uniforme (six codons pour Leu, Ser et Arg ; un seul pour Met et Trp) est verrouillée par
test.

| Redondance | Acides aminés |
|---|---|
| 6 codons | Arg, Leu, Ser |
| 4 codons | Ala, Gly, Pro, Thr, Val |
| 3 codons | Ile |
| 2 codons | Asn, Asp, Cys, Gln, Glu, His, Lys, Phe, Tyr |
| 1 codons | Met, Trp |

### 1.3 Le modèle énergétique

Trois variables d'état gouvernent l'atelier et les trois leviers. Ce sont les seuls
chiffres du site qui pilotent une simulation plutôt que de décorer une animation.

| Grandeur | Valeur retenue | Confiance déclarée | À vérifier |
|---|---|---|---|
| ATP cytosolique au repos | 3 mM | [B] — fourchette 1 à 5 mM | la valeur médiane retenue est-elle défendable pour une cellule générique ? |
| Renouvellement complet du pool | 30 s | [B] | l'ordre de grandeur tient-il hors muscle ? |
| Part de la pompe Na⁺/K⁺ | 25 % du budget | [B] — 20 à 30 % | |
| Part de la synthèse protéique | 30 % | [B] — 20 à 30 % | |
| Part du reste (transport, biosynthèse) | 45 % | [B] | |
| ATP par glucose, glycolyse seule | 2 sur 30 | [A] | la valeur moderne de 30 est-elle celle à enseigner, plutôt que 36–38 ? |
| Réserve respiratoire | ×2 | [B] — 1,5 à 3 | |

**Les trois leviers et leurs effets, tels que le modèle les produit :**

| Levier | ATP | Force proton-motrice | Gradient Na⁺/K⁺ |
|---|---|---|---|
| Couper l'oxygène | tombe à ~5 % du repos | s'effondre | ne perd que ~3 % |
| Oligomycine | tombe à ~5 % | **monte de ~24 %** | intact |
| Ouabaïne | **monte de ~17 %** | intacte | tombe à zéro |

> **À vérifier** : les deux effets contre-intuitifs sont le cœur pédagogique du
> dispositif. Sont-ils justes, et les explications affichées les rendent-elles bien ?
> Le gradient qui résiste à l'anoxie est-il une conséquence acceptable, ou trompeuse ?

---

## 2. Les seize mécanismes

### 2.1 Glycolyse

**Siège** : Cytosol · **Facteur temporel affiché** : accéléré ×5

**Justification du facteur.** Le transit d'un glucose à travers les dix étapes ne dure pas le même temps selon l'état de la cellule : le rapport entre les réserves d'intermédiaires et le flux donne moins d'une seconde dans un muscle à l'effort, et plusieurs dizaines de secondes dans une cellule au repos. C'est ce dernier cas qui est joué ici : une dizaine de secondes à l'écran pour un tour complet, soit environ cinq fois plus vite que le réel.

**Description lue par l’étudiant.** La glycolyse coupe un glucose à six carbones en deux pyruvates à trois, dans le cytosol, sans oxygène et sans le moindre organite : c'est la voie la plus ancienne et la plus universelle, et une hématie, qui n'a pas de mitochondrie, ne vit que de celle-là. La cellule doit d'abord INVESTIR — deux ATP sont dépensés aux étapes 1 et 3, et on les voit partir avant que rien ne rentre ; au clivage par l'aldolase le cycle s'ouvre et se coupe en deux trioses, et tout ce qui suit se produit en double, ce qui est la seule raison pour laquelle la phase de récupération rend quatre ATP et deux NADH, soit un bilan NET de +2 ATP. Ces quatre ATP ne sortent d'aucun moteur rotatif : le phosphate saute directement d'un intermédiaire très énergétique sur une ADP de passage — c'est la phosphorylation au niveau du substrat, l'exact contraire de l'ATP synthase, qui exige une membrane et un gradient de protons. Les enzymes sont à la taille vraie : les dix tiennent dans 90 nm et chacune fait 5 à 9. Les sucres, eux, sont grossis d'environ trois fois — un glucose de 1 nm y est tracé sur 3 — sans quoi leurs carbones ne se compteraient pas. Seule la disposition est une convention — la chaîne est rangée en arc alors que ces enzymes sont en réalité dispersées dans le cytosol ; le substrat les trouve par collision, et l'on montre aussi les rencontres qui ne donnent rien. Les deux pyruvates sortent du cadre vers la mitochondrie s'il y a de l'oxygène, et vers la fermentation s'il n'y en a pas ; les deux NADH, eux, emportent leurs électrons vers la chaîne respiratoire, et ce sont eux qui relient cette voie à toutes les autres. La réglette du haut compte le tour en cours : deux ATP dépensés en anneaux creux, quatre produits, deux NADH, deux pyruvates, et en bas le solde net de deux ATP.

**Ellision — ce qui est coupé ou échantillonné.** Trois horloges cohabitent, et une seule est au facteur affiché. La chimie de chaque étape est en réalité de l'ordre de la milliseconde — la triose-phosphate isomérase traite près de dix mille molécules par seconde — et elle est donc ici RALENTIE. L'attente entre deux rencontres, elle, est COUPÉE : un intermédiaire dérive dans le cytosol avant de tomber sur l'enzyme suivante, et rien de cette attente n'est montré à l'échelle. La densité est réduite d'un facteur mille : ce volume contient réellement des dizaines de milliers de protéines, et une cellule mène des dizaines de milliers de glucoses de front — on n'en suit qu'un. Sont absents l'eau, les ions Mg²⁺ et H⁺, le transporteur GLUT qui fait entrer le glucose, le détail de la régulation de la phosphofructokinase (inhibée par l'ATP et le citrate, activée par l'AMP et le fructose-2,6-bisphosphate), et le devenir du NADH. Après le clivage, les deux trioses passent ici sur le même poste alors que chacun trouve sa propre copie de l'enzyme.

> **Chiffres à contrôler** : 90 nm · 1 nm · 90

### 2.2 Le destin du pyruvate : oxygène ou fermentation

**Siège** : Cytosol et mitochondrie · **Facteur temporel affiché** : accéléré ×5

**Justification du facteur.** Ce qui est accéléré ×5 ici est le RÉGIME, pas le geste enzymatique : dans un muscle qui démarre, l'oxygène local s'épuise puis revient en une trentaine de secondes — 35 s réelles deviennent 7 s d'écran, et les deux régimes se comparent dans le même plan, à la suite.

**Description lue par l’étudiant.** Le pyruvate sorti de la glycolyse se présente devant un aiguillage : avec de l'oxygène il entre dans la mitochondrie, où la pyruvate déshydrogénase lui retire un carbone — le CO₂ qui s'en va — et envoie les deux autres au cycle de Krebs, pour 30 à 32 ATP par glucose ; sans oxygène, la lactate déshydrogénase le réduit en lactate et le bilan reste aux 2 ATP de la glycolyse. La fermentation ne fabrique aucun ATP : sa seule fonction est de rendre le NAD⁺ que la glycolyse consomme, et c'est cette boucle — les navettes et la jauge — qu'il faut suivre, pas le lactate. L'oxygène, lui, ne pousse rien : il TIRE les électrons au bout de la chaîne, au complexe IV, et qu'il manque, la file se bloque de proche en proche jusqu'à la glycolyse, anneau par anneau. Molécules et enzymes sont dessinées trente à cinquante fois trop grosses pour rester visibles à côté d'une membrane : c'est un parti de représentation, pas une échelle.

**Ellision — ce qui est coupé ou échantillonné.** Trois horloges cohabitent, et une seule porte le facteur affiché. Les actes enzymatiques sont en réalité RALENTIS d'environ ×1 000 : la lactate déshydrogénase traite quelques centaines de molécules par seconde et un électron traverse la chaîne en quelques millisecondes ; à vitesse vraie on ne verrait qu'un flou. Les attentes de rencontre sont COUPÉES, et la densité divisée par plusieurs milliers. Sont absentes la glycolyse et les dix étapes du cycle de Krebs, qui sont des modules voisins ; le coenzyme A n'est pas dessiné ; l'ubiquinone et le cytochrome c sont sautés — un électron passe du complexe I au III puis au IV sans transporteur visible ; le complexe II et les FADH₂ du cycle de Krebs sont absents ; le gradient de protons est figuré par l'ATP synthase mais non compté (≈ 10 H⁺ pompés par NADH). Le NADH cytosolique ne traverse PAS la membrane : ce sont ses électrons qui passent, par la navette malate-aspartate, et c'est cela que montre l'hydrure qui franchit la paroi. La diffusion est brownienne mais BIAISÉE vers le poste visé : livrée au pur hasard, une rencontre demanderait ici des minutes — les refus, eux, sont réels et se voient. Enfin la vignette « levure », en bas à droite, est scriptée et non simulée.

> **Chiffres à contrôler** : 35 s · 7 s · 35 · 30 · 32 · 1 000 · 10

### 2.3 Bêta-oxydation des acides gras

**Siège** : Matrice mitochondriale · **Facteur temporel affiché** : ralenti ×5

**Justification du facteur.** Les quatre enzymes de la spirale tournent une dizaine de fois par seconde : un tour complet, diffusions comprises, prend environ un tiers de seconde, soit 1,8 s à l'écran. Les sept tours d'un palmitate durent réellement deux à trois secondes ; ici ils en prennent treize, soit un RALENTI d'environ 5 — et non un accéléré, comme le badge l'a longtemps annoncé à tort. L'entrée par la carnitine, plus lente que la spirale, prend trois secondes de plus.

**Description lue par l’étudiant.** Un acide gras ne traverse pas la membrane interne tout seul : il est activé en acyl-CoA au prix de deux ATP, son coenzyme A est échangé contre la CARNITINE, l'ensemble traverse, et le CoA lui est rendu de l'autre côté. Cette navette est l'étape limitante et le point de contrôle de toute l'oxydation des graisses — d'où la file qui attend dehors. Dans la matrice, quatre enzymes en boucle répètent la même séquence — oxydation, hydratation, oxydation, thiolyse — et la chaîne perd DEUX carbones à chaque tour : le palmitate, seize carbones, fait sept tours et donne huit acétyl-CoA, avec sept FADH₂ et sept NADH. La scène entière fait 45 nm de large : c'est un FRAGMENT de matrice, et non une mitochondrie, qui en fait deux mille. Les molécules y sont dessinées environ cinq fois trop grosses pour qu'on puisse compter leurs carbones — un palmitate de 2 nm y est tracé sur 11.

**Ellision — ce qui est coupé ou échantillonné.** Une pause AJOUTÉE d'une seconde et demie tient l'abaque complet en fin de cycle : elle n'existe pas dans la cellule, elle sert à laisser lire le bilan avant que tout reparte. L'ATTENTE, elle, est coupée, pas ralentie : dans le cytosol un acyl-CoA peut patienter très longtemps avant de trouver CPT1, et c'est justement pour cela que la porte est le point de contrôle. L'agitation thermique, elle, est RALENTIE d'environ ×10 000 — à cette échelle une molécule traverserait le champ en une fraction de milliseconde. La densité est réduite d'un facteur cent : à 500 g de protéines par litre, cette matrice contient des MILLIONS de molécules par µm³. Enfin le FAD de l'acyl-CoA déshydrogénase est en réalité un cofacteur PROSTHÉTIQUE, lié à demeure : ses électrons partent par la flavoprotéine ETF, pas la molécule. On le dessine en navette pour que le trajet de l'énergie se voie. Sont absents la lipase qui libère l'acide gras, l'albumine qui le transporte dans le sang, et les acides gras impairs ou insaturés, qui demandent des enzymes de plus.

> **Chiffres à contrôler** : 1,8 s · 45 nm · 2 nm · 45 · 11 · 10 000 · 500

### 2.4 Cycle de Krebs

**Siège** : Matrice mitochondriale · **Facteur temporel affiché** : accéléré ×5

**Justification du facteur.** Le temps qu'un carbone met à faire le tour des huit enzymes dépend du régime : de l'ordre d'une cinquantaine de secondes dans un muscle au repos, où le flux est faible et les réserves d'intermédiaires larges, et quelques secondes seulement à l'effort. Le tour dure ici dix secondes : accéléré ×5 par rapport au repos, et ralenti d'autant par rapport à l'effort.

**Description lue par l’étudiant.** Huit enzymes en anneau. L'acétyl-CoA à deux carbones — que livrent aussi bien le sucre que les acides gras et les acides aminés — se condense sur un oxaloacétate à quatre carbones pour donner le citrate à six ; le tour qui suit démonte ce citrate jusqu'à régénérer l'oxaloacétate, prêt à recommencer. Deux carbones s'échappent en chemin sous forme de CO₂, à l'isocitrate déshydrogénase puis à l'α-cétoglutarate déshydrogénase : c'est exactement le carbone que vous expirez en lisant cette phrase. Le cycle ne produit qu'une seule liaison riche par tour — un GTP, aussitôt converti en ATP — et là n'est pas l'essentiel : sa vraie récolte, ce sont trois NADH et un FADH₂, des transporteurs d'électrons qui montent vers la chaîne respiratoire de la crête et y valent neuf ATP de plus. Un glucose donne deux pyruvates, donc deux tours — les deux jetons du bas — et comme le cycle fournit aussi le squelette de plusieurs acides aminés, de l'hème et du glucose, on le dit amphibolique : il brûle et il construit.

**Ellision — ce qui est coupé ou échantillonné.** L'anneau est une convention de lecture, pas une structure : seule la succinate déshydrogénase est réellement fixée — c'est le complexe II, planté dans la membrane interne, dessiné ici contre la crête. Les sept autres flottent dans la matrice, où le substrat les trouve par collision. La scène fait 50 nm de large en tout : les huit enzymes s'y tiennent dans un anneau de 25 nm et chacune fait 4 à 5 nm, ce qui est l'ordre de grandeur vrai. Les billes de carbone, elles, sont GROSSIES : une liaison carbone-carbone y fait 1,1 nm pour 0,15 réels, sans quoi on ne pourrait pas les compter — et compter les carbones est tout l'objet de cette figure. Les molécules d'eau, les protons et le coenzyme A libre ne sont pas dessinés, et la vraie matrice est bien plus encombrée que ce brouillard de grains.

> **Chiffres à contrôler** : 50 nm · 25 nm · 5 nm · 1,1 nm · 50 · 25 · 15

### 2.5 Chaîne respiratoire et ATP synthase

**Siège** : Mitochondrie · **Facteur temporel affiché** : ralenti ×200

**Justification du facteur.** L'ATP synthase tourne à environ 130 tours par seconde : un tour prend 8 ms, ce qui devient 1,5 s à l'écran et se suit à l'œil — un ralenti de 200, arrondi depuis les 195 que donne le calcul exact. Rien n’est agrandi : la portion de crête représentée fait 160 nm, un complexe I en fait 20, et il faut donc descendre à cette échelle pour les voir — c'est ce que fait la caméra, et la barre en bas à droite dit où on en est.

**Description lue par l’étudiant.** La chaîne ne fabrique pas d'ATP : elle pompe des protons. Les électrons arrivés du NADH descendent une pente de potentiel rédox, de −320 mV jusqu'à +820 mV pour l'oxygène, et à chaque marche les complexes I, III et IV éjectent des protons hors de la matrice. Le complexe II, lui, ne pompe pas : il ne fait qu'injecter des électrons. Le gradient ainsi créé est la vraie monnaie d'énergie. Les protons qui redescendent traversent le rotor de l'ATP synthase et le font tourner ; la tête F1, tenue immobile par un bras statorique, voit sa tige tourner dedans et fabrique un ATP par tiers de tour. C'est le plus petit moteur rotatif connu. Au bout de la chaîne, l'oxygène accepte les électrons et devient de l'eau — il ne brûle rien, il tire.

**Ellision — ce qui est coupé ou échantillonné.** Le débit d'ATP est juste — trois par tour, deux par seconde d'écran — mais les EFFECTIFS sont échantillonnés : huit ATP et quatre molécules d'eau en vol à la fois, là où une crête réelle en libère un flot continu. Les quatorze électrons et les cent vingt protons sont de même des représentants, pas un inventaire. Une seule crête est montrée sur les quelques dizaines d'une mitochondrie, et les complexes y sont espacés régulièrement alors qu'ils sont en réalité rassemblés en supercomplexes mobiles.

> **Chiffres à contrôler** : 8 ms · 1,5 s · 160 nm · 130 · 200 · 195 · 160 · 20 · 320 · 820

### 2.6 Réplication : la fourche et ses fragments d'Okazaki

**Siège** : Noyau · **Facteur temporel affiché** : ralenti ×3

**Justification du facteur.** Une fourche humaine avance à ~30 nucléotides par seconde : un fragment d'Okazaki de 150 nt naît toutes les cinq secondes. Le cycle en prend quinze à l'écran — ralenti ×3, juste assez pour suivre l'amorçage.

**Description lue par l’étudiant.** La réplication est SEMI-CONSERVATIVE — suivez les couleurs : chaque duplex fille garde un brin parental sombre et gagne un brin neuf clair. Et elle est ASYMÉTRIQUE : la polymérase ne lit que dans un sens, alors le brin avancé est copié d'un trait derrière l'hélicase, tandis que l'autre est copié à REBOURS, par fragments : la primase pose une amorce d'ARN — en orange —, la polymérase δ, retenue par son anneau PCNA, étend le fragment le long de la boucle du trombone, FEN1 retire l'amorce du fragment précédent et la ligase soude. L'hélicase n'écarte pas les brins à la main : elle encercle une matrice et avance. Les RPA gainent le simple brin exposé, et en amont la topoisomérase détend la vrille que la fourche pousse devant elle — la même contrainte que montre la transcription.

**Ellision — ce qui est coupé ou échantillonné.** Le fragment est raccourci (22 grains pour ~150 nt) et le duplex échantillonné à un grain pour deux paires de bases. La cellule bêta adulte ne se divise presque jamais — ~0,5 % par an — et cette fourche est donc une démonstration de ce qui se passe dans les cellules qui se divisent, pas un événement fréquent de celle-ci ; la même machinerie sert aussi à la réparation. Pas d'origine de réplication ni de chargement du CMG (phase G1), pas de point de contrôle, pas de télomères. La boucle du trombone est une hypothèse d'école bien étayée, pas une photographie.

> **Chiffres à contrôler** : 150 nt · 30 · 150 · 0,5 % · 22

### 2.7 Mitose : le fuseau, la cohésine, le pincement

**Siège** : Cytosquelette · **Facteur temporel affiché** : accéléré ×120

**Justification du facteur.** Une mitose de cellule humaine dure de l'ordre d'une heure, dont la moitié pour la seule métaphase ; le cycle tient ici en 30 s, soit un accéléré d'environ ×120. L'anaphase réelle, elle, ne prend que quelques minutes : à ce facteur elle reste un instant — et c'en est un.

**Description lue par l’étudiant.** Une cellule ne « copie » pas son noyau : elle le DÉMONTE. La chromatine se condense en chromosomes — deux chromatides sœurs tenues par la COHÉSINE, le grain violet du centromère —, l'enveloppe nucléaire se défait, et le fuseau bâti par les deux centrosomes capture chaque chromosome pour l'amener à la plaque métaphasique, où tout oscille et attend. Le déclic est biochimique : quand le dernier kinétochore est capturé, la séparase clive la cohésine — regardez le grain violet sauter — et les sœurs partent chacune vers son pôle : l'anaphase est une rupture, pas un glissement. Deux enveloppes se referment, les chromosomes se décondensent, et l'anneau d'actomyosine pince le cytoplasme en deux. Toute l'anatomie du reste du site — centrosome dupliqué, microtubules dynamiques, moteurs — trouve ici son emploi.

**Ellision — ce qui est coupé ou échantillonné.** C'EST UNE MAQUETTE, posée dans le cytoplasme comme la vignette levure de la fermentation : la cellule bêta adulte ne se divise presque jamais (~0,5 % par an) et l'écorché entier est interphasique — la mitose est montrée parce qu'elle est universelle, sur une cellule stylisée de un micromètre. Quatre chromosomes pour quarante-six. Le point de contrôle du fuseau est réduit à l'attente métaphasique : aucune capture ratée n'est montrée, alors que la congression réelle en est pleine. Condensine, kinétochores, séparase et Aurora ne sont pas dessinés — on ne voit que leurs effets : la condensation, la capture, l'instant où la cohésine saute.

> **Chiffres à contrôler** : 30 s · 30 · 120 · 0,5 %

### 2.8 Transcription de l'ADN en ARN

**Siège** : Noyau · **Facteur temporel affiché** : ralenti ×20

**Justification du facteur.** L'ARN polymérase II avance ici à 60 nucléotides par seconde, soit 17 ms par nucléotide : à l'écran chaque nucléotide prend 0,33 s, soit un ralenti de 20, et un tour d'hélice de 10,5 paires de bases 3,5 s. Même facteur que la traduction, pour que les deux vitesses se comparent directement. Ces 60 nt/s font 3,6 kb/min : la vitesse mesurée in vivo va de 1 à 6 kb/min selon le gène, et la fiche de l'épissage prend 2 kb/min, l'autre bout de la même fourchette. Ce n'est pas une contradiction, c'est une dispersion réelle.

**Description lue par l’étudiant.** L'ARN polymérase II ouvre la double hélice sur douze à quatorze paires de bases, copie le brin matrice et referme le duplex derrière elle : cette bulle de 4 nm qui se déplace est toute la mécanique du procédé. Le transcrit sort par un canal latéral et s'allonge, coiffé dès son vingt-cinquième nucléotide, bien avant que la polymérase ait fini. Trois enzymes se suivent sur le même gène, et comme aucune ne tourne autour de l'ADN, chacune entasse les tours devant elle et les arrache derrière : la contrainte reste piégée entre les nucléosomes qui ancrent le segment, le gène se vrille, et il faut qu'une topoisomérase passe le relâcher. Les nucléotides libres, eux, ne savent pas où est le site actif : à chaque instant un seul des huit qui rôdent autour de l'enzyme est en train d'y être incorporé, les sept autres se cognent pour rien.

**Ellision — ce qui est coupé ou échantillonné.** Le gène montré ne fait que 500 pb : un gène humain en fait dix à cent mille, et la polymérase mettrait plus de vingt minutes d'écran à en parcourir quatre mille. Chaque brin est échantillonné à un grain pour deux nucléotides (5 par tour au lieu de 10,5), et hors du gène il n'est tracé qu'un barreau toutes les 21 pb. L'ARN naissant est dessiné replié, un grain pour 7 nucléotides. Le surenroulement est amplifié — 1,8 tour de surplus, et une vrille de 5 nm — sans quoi il resterait invisible, et la topoisomérase est ramenée à une visite toutes les 26 s. L'enroulement nucléosomal est schématisé en spirale autour de l'axe de la fibre, et le duplex est dessiné à 2,5 nm de large au lieu de 2. La polymérase, enfin, est translucide : à sa taille réelle elle cacherait entièrement la bulle.

> **Chiffres à contrôler** : 17 ms · 0,33 s · 3,5 s · 60 nt · 3,6 kb/min · 6 kb/min · 2 kb/min · 60 · 17 · 33 · 20 · 10 · 4 nm · 500 pb · 21 pb · 5 nm · 26 s · 2,5 nm · 500 · 21 · 26

### 2.9 Épissage de l'ARN par le spliceosome

**Siège** : Noyau · **Facteur temporel affiché** : accéléré ×50

**Justification du facteur.** L'épissage d'un intron prend 5 à 10 minutes ; à ×50 il tient en 9 secondes. La transcription des 16 737 pb du transcrit, 8,4 minutes à 2 kb/min, en occupe 10. Ces 2 kb/min sont le bas de la fourchette mesurée in vivo, 1 à 6 kb/min ; la fiche de la transcription prend 60 nt/s, soit 3,6 kb/min, plus haut dans la même fourchette.

**Description lue par l’étudiant.** Le pré-ARN messager sort de la polymérase par petits blocs codants — les exons — séparés de très longs introns : chez l'humain le rapport est de 45 pour 1, l'inverse de ce que montrent les schémas. Pour chaque intron, le spliceosome s'assemble de zéro : U1 reconnaît le site 5', U2 le point de branchement, puis le tri-snRNP U4/U6·U5 arrive et U1 et U4 repartent, U6 prenant la place de U1. L'intron est alors coupé et refermé sur lui-même en LASSO par une liaison 2'-5' à l'adénosine du branchement, les exons sont soudés, et le lasso est débranché puis digéré. L'épissage du premier intron commence — et forme son lasso — bien avant que la polymérase ait fini de transcrire le gène.

**Ellision — ce qui est coupé ou échantillonné.** Intron raccourci ×3,4 : 5 419 pb feraient 1,63 µm, il en est dessiné 0,48. L'exon garde sa longueur vraie (120 pb, 0,036 µm). 4 exons et 3 introns au lieu de 8,8 et 7,8 en moyenne, et la queue 3' du lasso est portée de 0,5 % à 8 % de l'intron pour rester visible.

> **Chiffres à contrôler** : 16 737 pb · 2 kb/min · 6 kb/min · 60 nt · 3,6 kb/min · 10 · 50 · 16 737 · 60 · 45 · 5 419 pb · 1,63 µm · 120 pb · 0,036 µm · 0,5 % · 8 % · 5 419 · 63 · 48 · 120 · 036

### 2.10 Export de l'ARN messager

**Siège** : Enveloppe nucléaire · **Facteur temporel affiché** : ralenti ×200

**Justification du facteur.** Une importine reconnue franchit le pore en moins de dix millisecondes : à ×200 la traversée dure deux secondes, juste au-dessus du seuil où l'œil décroche. Le mRNP, lui, met 50 à 350 ms, soit dix à soixante-dix secondes à l'écran — c'est pourquoi il reste si longtemps en travers du canal alors que les navettes le doublent. Attention : c'est un RALENTI, à l'inverse de l'endocytose et de l'exocytose, dont le badge annonce un accéléré. Les plans sont dans la même cellule et n'ont pas la même horloge : d'où le badge, propre à chaque mécanisme.

**Description lue par l’étudiant.** Le canal du pore n'est pas un trou : il est bourré de nucléoporines FG, des chaînes protéiques désordonnées qui forment un hydrogel. Un cargo ne franchit rien, il FOND dedans par interactions transitoires — d'où les 2,5 ms de séjour de l'importine β et les 7,1 ms de la transportine. L'ARN messager, lui, n'est jamais nu : empaqueté de protéines en mRNP, il doit se déplier pour entrer en file, tête la première, et l'hydrogel s'écarte localement sur son passage. Le pore lui-même est symétrique et passif : la directionnalité vient du gradient RanGTP nucléaire / RanGDP cytosolique, et c'est bien RanGTP qu'on voit percuter l'importine et lui faire lâcher son cargo. Tout autour, des molécules abordent le pore et repartent : les essais infructueux sont l'immense majorité.

**Ellision — ce qui est coupé ou échantillonné.** Un noyau porte des milliers de pores et chacun laisse passer plusieurs centaines de molécules par seconde ; on en montre un seul, et une trentaine de molécules. Les trente nucléoporines différentes sont dessinées comme une seule famille — seul le relief les sépare. Le maillage FG est réduit à quarante chaînes au lieu de deux cents environ, sans quoi on ne verrait plus rien traverser. Enfin l'hydrolyse du RanGTP côté cytosol, qui recharge le gradient, n'est pas montrée.

> **Chiffres à contrôler** : 350 ms · 200 · 50 · 350 · 2,5 ms · 7,1 ms

### 2.11 Traduction : un polysome au travail

**Siège** : Cytosol · **Facteur temporel affiché** : ralenti ×20

**Justification du facteur.** Un ribosome de mammifère pose 5 à 6 acides aminés par seconde : un codon dure 170 ms, qui deviennent 3,4 s à l’écran — un ralenti de 20. Une bactérie irait quatre fois plus vite.

**Description lue par l’étudiant.** Un ARNm n’est jamais lu par un seul ribosome, et il n’est jamais tendu : il est en pelote, sa coiffe tenue contre sa queue poly-A par eIF4G, et cinq ribosomes le parcourent en file — c’est un polysome. Chacun avance par cliquets discrets, un codon à la fois, et reste parfaitement immobile entre deux pas. Avant chaque pas, trois à cinq ARNt viennent percuter le ribosome et repartent, la plupart sans même tomber sur le site A : c’est cette accumulation de rejets, et rien d’autre, qui fait la fidélité de la traduction. Le bon ARNt cède son acide aminé, la liaison peptidique est formée par l’ARN ribosomique lui-même, les sous-unités pivotent, et la chaîne sort par le tunnel de dix nanomètres où elle commence déjà à se replier — le ribosome le plus avancé porte la plus longue.

**Ellision — ce qui est coupé ou échantillonné.** Douze codons seulement, puis le ribosome se défait et un autre repart en amont : une protéine de 300 acides aminés demanderait dix-sept minutes d’écran à ce ralenti. Le pas d’un codon est vrai — 0,9 nm, un trentième du ribosome — donc ce qui rend le cliquet lisible n’est pas la distance mais le RYTHME : trois secondes d’immobilité complète, puis tout d’un coup. La rotation des deux sous-unités est portée de 8° à 20°, et les résidus de la chaîne sont espacés de 0,9 nm au lieu de 0,35, sans quoi l’ajout d’un acide aminé serait invisible. Les trente premiers résidus restent cachés dans le tunnel, comme en vrai. Trois à cinq rejets par codon est un minorant : il y en a souvent plus de dix. Les facteurs d’élongation eEF1A et eEF2, et le GTP qu’ils consomment, ne sont pas dessinés — à 1 nm ils ne feraient pas un pixel.

> **Chiffres à contrôler** : 170 ms · 3,4 s · 170 · 20 · 0,9 nm · 1 nm · 300 · 35

### 2.12 Translocation : SRP, Sec61 et peptide signal

**Siège** : Réticulum endoplasmique rugueux · **Facteur temporel affiché** : ralenti ×20

**Justification du facteur.** Même horloge que le polysome : 170 ms par codon, 3,4 s à l’écran, ralenti de 20. La chaîne traverse la membrane exactement au rythme où elle sort du tunnel. La pause imposée par la SRP tient dans la même horloge : une douzaine de secondes d’écran pour un arrêt réel de l’ordre de la minute.

**Description lue par l’étudiant.** Comment un ribosome se retrouve-t-il amarré à la membrane ? Suivez celui qui dérive en haut : dès que le PEPTIDE SIGNAL — les premiers résidus de sa chaîne, en orange — émerge du tunnel, la particule violette le reconnaît. C’est la SRP, six protéines sur un ARN : son domaine M coiffe le peptide, son domaine Alu occupe le site des facteurs d’élongation, et la traduction S’ARRÊTE — le ribosome est escorté, remis à son récepteur SR contre un canal Sec61 libre, et là seulement la lecture repart. Dès lors la chaîne ne sort plus dans le cytosol : elle traverse la membrane à mesure qu’elle sort du tunnel. Sous chaque canal, la PEPTIDASE DU SIGNAL coupe l’adresse sitôt émergée — regardez le bout orange se détacher et se dissoudre : la protéine mûre ne le porte plus. Les ribosomes qui cognent la membrane sans peptide signal repartent : rien ne les retient.

**Ellision — ce qui est coupé ou échantillonné.** La SRP n’est jouée que sur UN ribosome, en boucle de démonstration : à la fin du cycle il s’efface et reparaît au cytosol — dans la cellule, il resterait amarré jusqu’au bout de sa protéine. Les GTPases de la SRP et de son récepteur, et le GTP qu’elles consomment à la remise du ribosome, ne sont pas dessinées. Le repliement assisté par les chaperons n’est pas montré ici — il a sa propre scène. Douze codons, puis on reprend — comme pour le polysome. Sur les cent cinquante ribosomes de ce fragment de membrane, on ne suit la chaîne que de quatre.

> **Chiffres à contrôler** : 170 ms · 3,4 s · 170 · 20

### 2.13 Repliement : BiP, PDI et les trois ponts

**Siège** : Réticulum endoplasmique rugueux · **Facteur temporel affiché** : accéléré ×30

**Justification du facteur.** La proinsuline met de l’ordre de dix minutes à se replier et à recevoir ses ponts disulfure dans le réticulum ; le cycle tient ici en 20 s, soit un accéléré d’environ ×30. Le geste de la PDI, lui, est bien plus rapide que ça — c’est l’ATTENTE entre deux prises en charge qui domine.

**Description lue par l’étudiant.** Un fil n’est pas une protéine. La proinsuline qui vient de traverser Sec61 pend dans la lumière du réticulum ; BiP — violet — la tient le temps qu’elle se compacte, et la PDI — vert d’eau — vient poser ses TROIS PONTS DISULFURE, les barreaux orange : B7–A7, B19–A19, A6–A11. Parmi les quinze appariements possibles de ses six cystéines, un seul est le bon, et la PDI défait autant qu’elle fait. Suivez les trois chaînes : deux partent vers le Golgi, la troisième s’est trompée — mauvais pont, repliement de travers — et prend l’autre chemin, vers la dégradation. Chez la souris Akita, une seule cystéine mutée suffit : la proinsuline s’accumule, le réticulum sature, la cellule bêta meurt. Le repliement n’est pas un détail de fabrication, c’est là que se joue le diabète néonatal.

**Ellision — ce qui est coupé ou échantillonné.** Un grain pour trois acides aminés, et des positions de cystéines approchées à cette échelle. La calnexine et la calréticuline, qui surveillent les protéines GLYCOSYLÉES, ne sont pas dessinées — la proinsuline n’est pas glycosylée, et c’est BiP qui la tient. Le glutathion qui fixe le potentiel rédox de la lumière est invisible. La chaîne ratée part vers la dégradation en ligne droite : la rétrotranslocation par ERAD n’est pas encore montrée. La part d’échec lit le stress du réticulum dans le modèle — au repos une chaîne sur trois, davantage quand l’atelier déborde.

> **Chiffres à contrôler** : 20 s · 20 · 30

### 2.14 Golgi : citernes qui mûrissent, sucres qui s'ajoutent

**Siège** : Appareil de Golgi · **Facteur temporel affiché** : accéléré ×50

**Justification du facteur.** Une protéine met une vingtaine de minutes à traverser le Golgi ; le transit tient ici en 24 s, soit un accéléré d'environ ×50. À cette échelle les vésicules COPII semblent des navettes pressées : en vrai leur trajet dure une ou deux minutes.

**Description lue par l’étudiant.** Le Golgi ne fait pas passer les protéines de citerne en citerne : c'est la CITERNE ENTIÈRE qui avance. Née côté cis de la fusion des vésicules COPII venues du réticulum, elle mûrit en avançant dans la pile, son cargo dedans, pendant que les vésicules COPI — orange — renvoient ses enzymes en arrière : une citerne médiane a des enzymes médianes parce que le recyclage l'y maintient, pas parce qu'elle est immobile. À chaque étage, des enzymes différentes taillent les sucres du cargo — l'antenne verte qui pousse à l'étage médian. Au bout, la face trans se défait en vésicules : pour la proinsuline, un GRANULE IMMATURE bourgeonne, et sa maturation est une autre scène.

**Ellision — ce qui est coupé ou échantillonné.** Quatre citernes au lieu de cinq à huit, et une seule pile. Les glycosyltransférases elles-mêmes ne sont pas dessinées : on ne voit que leur œuvre, l'antenne verte qui pousse à l'étage médian — et la proinsuline réelle n'est PAS glycosylée : le cargo figuré vaut pour les centaines d'autres protéines qui transitent en même temps qu'elle. Les manteaux COPII et COPI sont réduits à la teinte de leur vésicule. Le tri de sortie — mannose-6-phosphate vers les lysosomes, granules vers la sécrétion régulée — est résumé au seul bourgeon du granule.

> **Chiffres à contrôler** : 24 s · 24 · 50

### 2.15 Maturation du granule : convertases, peptide C, cristal de zinc

**Siège** : Appareil de Golgi · **Facteur temporel affiché** : accéléré ×150

**Justification du facteur.** La conversion de la proinsuline et la cristallisation prennent de l'ordre d'une heure dans le granule ; le cycle tient ici en 24 s, soit un accéléré d'environ ×150. Les coupes elles-mêmes sont des gestes d'enzyme, bien plus rapides : c'est l'acidification progressive qui donne son tempo à la maturation.

**Description lue par l’étudiant.** Le granule qui vient du trans-Golgi ne contient pas d'insuline : il contient de la PROINSULINE — une seule chaîne, B et A reliées par le peptide C, le grain gris du milieu. La maturation est une usine : les plaques de clathrine repartent avec les protéines mal adressées, le pH tombe, et les CONVERTASES passent — PC1/3 coupe à la jonction B–C, PC2 à la jonction C–A, la carboxypeptidase E ébarbe. L'insuline libérée cristallise en hexamères autour du zinc que ZnT8 pompe dans le granule : c'est le cœur dense des clichés de microscopie. Le peptide C, lui, ne part pas : dissous dans le halo, il sera co-sécrété MOLE POUR MOLE avec l'insuline — c'est lui qu'on dose en clinique pour savoir si un pancréas fabrique encore, car l'insuline injectée n'en a pas.

**Ellision — ce qui est coupé ou échantillonné.** Dix proinsulines pour les dizaines de milliers d'un granule réel, et chacune réduite à trois grains — B, C, A. La baisse de pH (6,5 → 5,5), qui active les convertases et précipite le cristal, n'est pas figurée : on n'en voit que les effets. La pompe à protons qui la produit n'est pas dessinée — ZnT8, lui, l'est, parce que le zinc se voit dans le cristal. Les résidus basiques que la CPE ébarbe après les coupes sont sous la taille du grain. Le granule est immobile : dans la cellule il voyage pendant qu'il mûrit.

> **Chiffres à contrôler** : 24 s · 24 · 150

### 2.16 Kinésine et dynéine sur le microtubule

**Siège** : Cytosquelette · **Facteur temporel affiché** : ralenti ×100

**Justification du facteur.** La kinésine fait environ cent pas PRODUCTIFS par seconde, de 8 nm chacun, soit 800 nm/s : un pas dure 10 ms dans la cellule, il en prend une à l'écran. On verra pourtant une tentative et demie par seconde — une sur trois échoue et ne fait pas avancer la molécule, il faut donc compter les pas qui aboutissent, pas les balancements.

**Description lue par l’étudiant.** Vue rapprochée d'un tronçon de microtubule, à trois micromètres du centrosome ; les tubes sont ceux de cette démonstration, un peu plus épais que ceux du cytosquelette parce que les tubulines y sont dessinées en relief. Le rail n'est pas lisse : treize protofilaments de dimères α/β y forment un damier hélicoïdal, et c'est sur ce damier que les moteurs posent leurs pieds. La kinésine marche main sur main vers l'extrémité plus, à la périphérie, en tirant sa vésicule ; la dynéine, reconnaissable à ses anneaux AAA+ au bout de longues tiges, la croise en sens inverse vers le centre — c'est le trafic à double sens de l'axone. Aucun des deux ne sait où il va : la tête libre cherche son site en diffusant et manque son coup une fois sur trois, et après une centaine de pas le moteur lâche, part en promenade brownienne et se raccroche ailleurs par collision.

**Ellision — ce qui est coupé ou échantillonné.** Le pas lui-même dure moins de 100 µs, contre une dizaine de millisecondes d'attente d'ATP : il est étiré au quart du cycle, sinon il tiendrait dans une seule image. L'ATP n'est pas dessinée — 1 nm de large, elle ferait moins d'un pixel. Le damier de tubuline n'est posé que sur 0,9 µm de rail : les 52 000 tubulines d'un tube entier coûteraient dix fois le budget. Enfin, le décrochage est arrangé deux fois : un moteur libre quitterait le cadre en un dixième de seconde d'écran, sa promenade est donc fortement ralentie ; et c'est la MÊME molécule qu'on voit revenir se poser plus loin, alors que dans la cellule celle qui lâche est perdue et c'en est une autre, parmi le millier qui traînent là, qui prend sa place.

> **Chiffres à contrôler** : 8 nm · 800 nm · 10 ms · 800 · 10 · 1 nm · 0,9 µm · 100 · 52 000

### 2.17 Instabilité dynamique du microtubule

**Siège** : Cytosquelette · **Facteur temporel affiché** : accéléré ×3

**Justification du facteur.** Le tube pousse d'environ 1,8 µm/min et s'effondre à 17 µm/min. Accéléré trois fois, il remplit les 0,38 µm de la fenêtre gravée en quatre secondes et les reperd en moins d'une demi-seconde : les deux vitesses sont montrées telles quelles, et c'est leur rapport de près de dix qui doit sauter aux yeux.

**Description lue par l’étudiant.** La même charpente, mais par son bout, à huit micromètres et demi du centre. Les dimères de tubuline libres — en vert, chargés de GTP — cognent contre l'extrémité plus au hasard : presque tous repartent, quelques-uns s'ajoutent, et le tube pousse par pas de 8 nm, un protofilament à la fois, ce qui lui donne un bout effiloché et jamais plat. Tant que la couronne de GTP tient au sommet, l'édifice tient ; dès qu'elle est perdue, les treize protofilaments s'écartent en cornes de bélier et le tube se défait près de dix fois plus vite qu'il n'a poussé. C'est l'instabilité dynamique : un microtubule ne se raccourcit pas, il s'effondre — puis repart.

**Ellision — ce qui est coupé ou échantillonné.** La FRÉQUENCE, elle, est comprimée : dans la cellule une catastrophe survient toutes les minutes ou deux, ici toutes les cinq secondes — parce que la fenêtre gravée ne fait que 0,38 µm et que le tube la remplit aussitôt. Le damier de tubuline n'est dessiné qu'autour de l'extrémité plus ; au-delà le tube est lisse. Le pool libre est réduit à 160 dimères là où la cellule en compte des dizaines de millions, leur diffusion est fortement ralentie — à l'échelle réelle ils traverseraient le cadre en un millième de seconde — et un seul est absorbé par image alors que cent quarante-six s'ajoutent chaque seconde. L'hydrolyse du GTP en GDP n'est pas figurée : le vert du capuchon devient gris quand la tubuline s'enfonce dans le réseau, et c'est tout.

> **Chiffres à contrôler** : 1,8 µm · 17 µm · 0,38 µm · 17 · 38 · 8 nm · 160

### 2.18 Endocytose par puits de clathrine

**Siège** : Membrane plasmique · **Facteur temporel affiché** : accéléré ×2,3

**Justification du facteur.** Un puits de clathrine met 30 à 60 s à se creuser, à se pincer et à perdre son manteau. Le cycle complet dure ici 20 s d'écran pour 45 s réelles, soit un accéléré de ×2,3 environ. Aucun ralenti : à cette échelle de temps, l'endocytose est déjà lisible à l'œil nu.

**Description lue par l’étudiant.** Un manteau de clathrine se polymérise sous la membrane, la courbe, et l'enfonce jusqu'à ne plus laisser qu'un col. La dynamine s'enroule autour de ce col comme un ressort, hydrolyse du GTP et le pince : la vésicule se détache. Le manteau se défait alors aussitôt — sans ce décapage, la vésicule ne pourrait fusionner avec rien et la clathrine ne servirait qu'une fois. Les récepteurs ne sont pas prélevés au hasard : ils sont retenus par le manteau à mesure que leur errance les y amène, et le fret se retrouve concentré dans la vésicule.

**Ellision — ce qui est coupé ou échantillonné.** Le pincement lui-même — la scission par la dynamine — dure moins d'une seconde et n'est donc pas ralenti par rapport au reste : il passe vite, comme en vrai. Les adaptateurs AP2 qui cousent le manteau aux récepteurs, l'actine qui pousse le puits, et Hsc70 qui arrache les triskèles ne sont pas dessinés ; on ne voit que leur effet. Chaque arête est tracée comme un seul segment alors que deux jambes de triskèles s'y chevauchent. Les deux puits abortifs ne creusent pas la membrane, seul leur manteau est figuré.

> **Chiffres à contrôler** : 60 s · 20 s · 45 s · 30 · 60 · 20 · 45

### 2.19 Sécrétion d'insuline : calcium, SNARE et granule

**Siège** : Membrane plasmique · **Facteur temporel affiché** : deux temps : accéléré ×5, puis ralenti ×5 000

**Justification du facteur.** Deux temps, parce qu'une seule vitesse serait fausse pour l'un des deux. L'errance et l'amarrage de la vésicule prennent une trentaine de secondes : ils occupent les 6,7 premières secondes d'écran, soit un accéléré d'environ ×5. La fermeture éclair des SNARE et l'ouverture du pore, elles, durent moins de 1 ms et sont étalées sur les 5 s suivantes — un ralenti de ×5 000. Sans ce ralenti, la fusion serait une image et demie.

**Description lue par l’étudiant.** Un granule d'insuline erre sous la membrane : son cœur cristallin — l'hormone en hexamères autour de deux zincs — se devine par le halo. Quand il passe à portée, ses v-SNARE rencontrent les t-SNARE de la membrane et les quatre hélices se referment comme une fermeture éclair, du bout libre vers les membranes ; mais la fermeture s'arrête là, ARMÉE : rien ne fusionne sans calcium. Ce sont les canaux voisins qui décident — ils ne s'ouvrent que si le glucose a fermé les canaux K-ATP et dépolarisé la membrane. Leur bouffée ne porte qu'à cinquante nanomètres, et la synaptotagmine du granule la détecte : ses domaines C2 plongent, la fusion part. Un pore de moins de 2 nm s'ouvre, le cristal se dissout dans le milieu extérieur — voilà l'insuline dans le sang. La membrane du granule ne disparaît pas : elle S'AJOUTE à la surface de la cellule, et il faudra que l'endocytose la reprenne.

**Ellision — ce qui est coupé ou échantillonné.** Le granule est dessiné à 150 nm de diamètre, la MOITIÉ du granule d'insuline réel : à taille vraie, le faisceau SNARE de 12 nm — le sujet de la scène — deviendrait invisible contre son flanc. Munc13 et Munc18 qui préparent la syntaxine, et NSF/α-SNAP qui redéfont le complexe après coup, ne sont pas dessinés ; les complexes SNARE disparaissent simplement une fois la fusion faite. Chaque hélice est figurée par 13 grains au lieu de la soixantaine de résidus qu'elle compte. La bouffée calcique appartient à la chorégraphie — une fusion montrée est une fusion dont le canal voisin s'est ouvert — mais le calcium AMBIANT, lui, vient du modèle : comptez les ions bleus au repos puis sous glucose. Le mouvement des vésicules est une errance à deux sinus, pas une intégration brownienne : la propriété conservée est l'absence de cap, pas la statistique du déplacement.

> **Chiffres à contrôler** : 1 ms · 5 s · 5 000 · 2 nm · 150 nm · 12 nm · 150 · 12 · 13

### 2.20 Pompe Na⁺/K⁺ et canal potassique

**Siège** : Membrane plasmique · **Facteur temporel affiché** : ralenti ×1 000

**Justification du facteur.** Un cycle de pompe prend 7 à 20 ms, ce qui devient une douzaine de secondes à l'écran et se suit état par état. À ce même ralenti, le canal devrait débiter cent mille ions par seconde d'écran : il est donc physiquement indessinable en billes, et c'est pourquoi il est rendu en jet. Ce contraste n'est pas un effet de style, c'est la mesure de l'écart.

**Description lue par l’étudiant.** La pompe traverse quatre conformations. En E1 elle est ouverte vers l'intérieur et lie trois ions sodium ; l'ATP la phosphoryle et la ferme ; elle bascule en E2-P ouverte vers le dehors, lâche le sodium et prend deux ions potassium ; la déphosphorylation la ramène au départ. Trois charges sortent, deux entrent : la pompe est électrogénique et contribue de quelques millivolts au potentiel de repos. Elle ne le fabrique pas, contrairement à ce qu'on lit partout — le potentiel de repos est un potentiel de diffusion du potassium, rendu possible par les canaux de fuite comme celui de droite. La pompe, elle, entretient les gradients contre la diffusion, et c'est un travail permanent qui coûte le quart du budget énergétique d’une cellule générique — et jusqu’à la moitié dans un neurone.

**Ellision — ce qui est coupé ou échantillonné.** Les EFFECTIFS sont multipliés par six : dix-huit sodiums et douze potassiums traversent par cycle, là où la pompe réelle en déplace trois et deux. Le rapport 3:2 est conservé — c'est lui qui fait de la pompe une pompe électrogénique, et c'est le fait qui porte —, mais un étudiant qui compte les billes compte un échantillon, pas un cycle. À trois et deux, la scène ne montrerait presque rien entre deux conformations. Le jet du canal, lui, est coupé et non ralenti : cent mille ions par seconde d'écran ne se dessinent pas. Une seule pompe et un seul canal sont montrés là où un micromètre carré de membrane en porte des centaines, et l'ATP consommé — un par cycle — est figuré sans son cortège de phosphorylations intermédiaires.

> **Chiffres à contrôler** : 20 ms · 20

### 2.21 Dégradation par le protéasome

**Siège** : Cytosol · **Facteur temporel affiché** : accéléré ×10

**Justification du facteur.** Une chaîne complète — engagement, dépliement, dernier peptide — prend environ 23 s sur protéine purifiée ; à ×10 elle tient en 2,3 s à l'écran. Au même facteur le protéasome dessiné avale une cible toutes les sept secondes environ, soit une par minute réelle : dans la fourchette mesurée de 0,05 à 5 protéines par minute.

**Description lue par l’étudiant.** On montre partout la synthèse des protéines, jamais leur destruction : les deux tournent pourtant en parallèle en permanence. Une cible reçoit une chaîne d'ubiquitines posées une à une par une ligase E3 ; en dessous de quatre maillons en liaison K48 le protéasome la refuse, et elle rebondit sur le chapeau. Au-delà, le chapeau 19S la retient, retire la chaîne en bloc pour la recycler, puis DÉPLIE la protéine et la fait passer en brin étiré dans le tonneau 20S, dont le pore de 1,3 nm est trop étroit pour une protéine repliée. Il en ressort des peptides de deux à trente acides aminés.

**Ellision — ce qui est coupé ou échantillonné.** Trois horloges cohabitent ici, et une seule est au facteur affiché. L'attente entre deux rencontres est COUPÉE, pas ralentie : dans le cytosol une cible met des minutes à des heures avant de croiser une E3 puis un protéasome. L'agitation thermique est à l'inverse RALENTIE d'environ cent mille — le coefficient de diffusion dessiné vaut 3·10⁻⁵ µm²/s contre 3 µm²/s en cytosol, où une protéine traverserait ce champ en un cinquième de milliseconde et ne montrerait qu'un flou. La densité, enfin, est divisée par quarante : ce volume contient réellement quelques centaines de protéines, on en dessine sept ; les ubiquitines libres sont au contraire bien plus nombreuses ici qu'en solution, sans quoi le recyclage serait invisible. Sont absents l'enzyme d'activation E1, l'enzyme de conjugaison E2, et les chaînes K63 ou K11, qui ne mènent pas au protéasome.

> **Chiffres à contrôler** : 23 s · 2,3 s · 23 · 10 · 05 · 1,3 nm · 3 µm

---

## 3. Les 18 familles d'organites

### 3.1 Membrane plasmique

**Rôle affiché** : Ferme la cellule et trie tout ce qui entre et sort.

La membrane plasmique n'est pas une paroi mais un film : deux couches de lipides dos à dos, cinq nanomètres en tout, quatre mille fois plus fin que la cellule est large. La moitié de sa masse est faite de protéines plantées de part en part — pompes, canaux, récepteurs — si nombreuses que la surface tient de la mosaïque plutôt que du ballon. Le lipide isole, les protéines choisissent : la cellule reste chimiquement distincte du monde tout en négociant avec lui.

### 3.2 Cytosquelette

**Rôle affiché** : Charpente dynamique : elle tient la forme de la cellule et sert de rails au transport interne.

Des réseaux de fibres protéiques traversent tout le cytoplasme et lui donnent sa tenue : sans eux, la cellule s'affaisserait comme une poche d'eau. Les microtubules, les plus épais, rayonnent du centrosome vers la périphérie et servent de rails aux moteurs moléculaires qui déplacent vésicules et chromosomes. Sous la membrane, un feutrage serré de filaments d'actine — le cortex — fixe la forme de la surface et permet à la cellule de ramper, de se contracter et de se diviser. L'ensemble se démonte et se reconstruit sans arrêt : c'est une charpente qui se réinvente en quelques minutes.

### 3.3 Centrosome

**Rôle affiché** : Centre organisateur des microtubules : c'est de lui que part toute la charpente.

Le centrosome est le point de départ des microtubules, un nuage de matériel péricentriolaire qui les amorce autour de deux centrioles disposés à angle droit. Chaque centriole est un barillet creux de neuf triplets de microtubules ; cette symétrie d'ordre 9 est conservée à l'identique de l'algue verte à l'être humain. Avant la division, le centrosome se duplique et les deux copies migrent aux pôles opposés de la cellule pour bâtir le fuseau qui séparera les chromosomes.

### 3.4 Réticulum endoplasmique rugueux

**Rôle affiché** : Fabrique et replie les protéines destinées à l’export et aux membranes.

Le réticulum endoplasmique rugueux est un empilement de citernes aplaties dont la membrane prolonge directement celle de l’enveloppe nucléaire : les deux compartiments n’en forment qu’un. Sa face cytosolique est couverte de ribosomes — ce sont eux qui la rendent « rugueuse » — qui poussent la protéine naissante dans la lumière des citernes au fur et à mesure qu’ils la lisent. Les protéines y sont repliées, contrôlées, puis expédiées vers l’appareil de Golgi par vésicules. Une cellule qui sécrète beaucoup en est remplie : la cellule bêta, qui fabrique de l’insuline en continu, porte la pile développée qu’on voit ici — huit citernes de cinq micromètres — et un plasmocyte en serait plus couvert encore.

### 3.5 Réticulum endoplasmique lisse

**Rôle affiché** : Fabrique les lipides et neutralise les toxiques.

Le réticulum lisse prolonge le rugueux, mais sa membrane ne porte aucun ribosome : elle est nue, et le voisin grenu s'arrête net à la frontière. Au lieu de citernes aplaties, il forme un lacis de tubules ramifiés qui se rejoignent en carrefours renflés. Ses enzymes y assemblent les lipides des membranes et les hormones stéroïdes, et y dégradent alcool et médicaments. Il sert enfin de coffre à calcium, qu'il relâche dans le cytosol au moment voulu.

### 3.6 Noyau

**Rôle affiché** : Conserve l'ADN et gouverne la cellule en exportant ses ARN messagers.

Le noyau met les chromosomes à l'abri du cytoplasme derrière une enveloppe faite de deux membranes accolées, séparées par un espace de quarante nanomètres. Rien ne franchit cette double paroi ailleurs que par les pores nucléaires, des anneaux de protéines qui percent les deux membranes à la fois et filtrent le trafic dans les deux sens. À l'intérieur, la chromatine remplit tout le volume : c'est l'ADN enroulé sur des protéines, relâché là où les gènes se lisent, compacté ailleurs. La masse dense qu'on aperçoit dedans est le nucléole, l'atelier où les ribosomes sont assemblés avant de sortir travailler dans le cytoplasme.

### 3.7 Appareil de Golgi

**Rôle affiché** : Trie, modifie et emballe les protéines venues du réticulum.

Une pile de citernes aplaties et incurvées, empilées comme des assiettes creuses. Les protéines entrent par la face cis, la plus large, tournée vers le noyau et le réticulum ; elles traversent la pile citerne après citerne et ressortent par la face trans sous forme de vésicules. À chaque étage, des enzymes différentes taillent et complètent leurs chaînes de sucres : c'est la glycosylation. Le Golgi est le bureau de tri de la cellule, il décide de la destination finale de chaque protéine.

### 3.8 Mitochondrie

**Rôle affiché** : Fabrique l'ATP, la monnaie énergétique de la cellule.

La mitochondrie est enveloppée de deux membranes. L'interne se replie en crêtes qui plongent dans la matrice : ces replis multiplient la surface disponible pour la chaîne respiratoire, là où l'oxygène est consommé et l'ATP assemblée. Plus une cellule travaille, plus ses crêtes sont serrées — un muscle cardiaque en est bourré. Elle garde un ADN circulaire à elle, vestige de la bactérie qu'elle a été. Et elle ne vit pas seule : les mitochondries fusionnent et se scindent sans cesse, et les chapelets étranglés qu'on voit ici sont des tubules d'un même réseau, saisis entre deux fissions. Dix-huit segments sont dessinés — une cellule bêta réelle en porte des centaines, quatre à huit pour cent de son volume.

### 3.9 Lysosomes

**Rôle affiché** : Digèrent et recyclent : l'estomac de la cellule.

Un lysosome est une poche d'enzymes hydrolytiques qui démonte ce que la cellule a ingéré, et ses propres organites usés. Une pompe à protons maintient son intérieur à pH 4,5-5, deux unités et demie sous le cytosol : les hydrolases n'y sont actives que là, si bien qu'une fuite ne digère pas la cellule. Le contenu granuleux visible ici par transparence est ce matériel en cours de digestion — c'est lui qui a valu à ces vésicules leur premier nom, corps denses.

### 3.10 Peroxysomes

**Rôle affiché** : Oxydent les longues chaînes grasses et détruisent le peroxyde d'hydrogène.

Le peroxysome coupe les acides gras à très longue chaîne que la mitochondrie ne sait pas attaquer, et détoxifie l'alcool dans le foie. Ces oxydations produisent du peroxyde d'hydrogène, un poison, que la catalase logée dans la même vésicule casse aussitôt en eau et en oxygène : produire et neutraliser au même endroit, c'est toute l'idée. L'octaèdre central figure le cœur cristallin d'urate oxydase, sa signature en microscopie — décrit chez le rat et beaucoup de mammifères, mais le gène est inactivé chez l'humain. Il ne vient pas du Golgi : il se divise, ou bourgeonne du réticulum.

### 3.11 Vésicules de transport

**Rôle affiché** : Portent les protéines du Golgi jusqu’à la membrane.

Ce sont les navettes de la voie sécrétoire : elles bourgeonnent de la face trans du Golgi, traversent le cytoplasme en chapelets et fusionnent avec la membrane plasmique, qui libère leur contenu au-dehors. Une vésicule ne naît jamais nue : un manteau protéique — COPII, COPI ou clathrine — déforme la membrane, la découpe, puis se démonte aussitôt le bourgeon détaché. Les dix vésicules encore proches du Golgi le portent ici, en cage polyédrique translucide ; les autres l'ont déjà perdu. C'est ce détail que les vulgarisations oublient, et sans lui on ne comprend pas comment une membrane plate devient une bulle.

### 3.12 Boîte de vérité

**Rôle affiché** : Le cytoplasme à sa densité réelle : 25 % du volume

Dans cette dalle de 1164 nm de côté sur 200 nm d'épaisseur — l'ordre d'une coupe épaisse de microscopie électronique —, et nulle part ailleurs dans cette cellule, l'encombrement est celui de la biologie : 157 000 protéines, complexes, ribosomes et ARN, tous dessinés à leur taille vraie, du grain de 5 nm au ribosome de 25 nm. Une protéine ne traverse jamais un tel milieu en ligne droite ; elle rebondit sur ses voisines, et c'est pourquoi la GFP y diffuse trois fois plus lentement que dans l’eau. Cette densité ne peut pas être tenue partout : à l'échelle de la cellule entière il faudrait des centaines de millions d'objets, contre les deux cent mille que la carte graphique dessine à 60 images par seconde. Si cette région est une dalle et non un cube, c'est pour cette raison : au-delà de la première couche, plus de 99 % des objets sont cachés par ceux de devant. Borner l'épaisseur rend donc visible presque deux fois plus de cytoplasme, au même budget. Partout ailleurs dans cette cellule, le cytosol est éclairci d'environ trois ordres de grandeur : le grain que vous y voyez est un échantillon, pas un inventaire.

> **Chiffres à contrôler** : 25 % · 25 · 1164 nm · 200 nm · 5 nm · 25 nm · 99 % · 1164 · 200 · 157 000 · 60 · 99

### 3.13 Cytosol

**Rôle affiché** : Le milieu, jamais vide

Le cytosol est un gel encombré, pas une solution : 300 mg de protéines par millilitre, un cinquième à un tiers du volume occupé, et une bonne part de l'eau retenue à la surface des macromolécules. Le semis dessiné ici est honnête sur sa propre limite : sa densité est réduite d'environ trois ordres de grandeur par rapport au réel, faute de budget de rendu — 60 000 objets là où la biologie en met des centaines de millions. À l'échelle de la cellule il donne le grain fin qu'on voit en microscopie électronique ; en zoomant il se résout en objets isolés, là où le vrai cytosol serait un mur. Pour voir cette densité vraie, il faut entrer dans la boîte de vérité.

> **Chiffres à contrôler** : 300 · 60 000

### 3.14 Pores nucléaires

**Rôle affiché** : Seule porte du noyau : filtre tout ce qui entre et tout ce qui sort.

Le complexe du pore nucléaire est la plus grosse machine de la cellule : une trentaine de protéines différentes, les nucléoporines, assemblées en huit exemplaires autour d'un canal unique. L'anneau côté cytosol porte des filaments libres qui pêchent les cargos ; côté noyau, huit filaments plongent et se referment sur un anneau distal — c'est le panier, la silhouette qui signe l'enveloppe nucléaire. Un noyau en porte de quelques centaines à plusieurs milliers selon son activité. Le canal fait 40 nanomètres, ce qui suffit largement : un ARN messager empaqueté en fait 15 à 35. Il peut se dilater jusqu'à 70, mais c'est une réponse au STRESS — manque d'énergie, choc osmotique — et non un élargissement à la demande d'un cargo. Les petites molécules diffusent librement, les grosses ne franchissent le maillage que munies du bon signal d'adressage. Un cargo reconnu traverse en moins de dix millisecondes.

> **Chiffres à contrôler** : 40 · 15 · 35 · 70

### 3.15 Matrice mitochondriale

**Rôle affiché** : Le compartiment le plus concentré de la cellule, entre les crêtes.

Entre les crêtes il n'y a pas de vide : la matrice est une pâte d'enzymes où se déroule le cycle de Krebs, qui démonte les nutriments et charge les transporteurs alimentant la chaîne respiratoire. On y voit aussi des granules denses de calcium, réserve tampon de la cellule, et surtout des nucléoïdes : la mitochondrie possède son propre ADN, circulaire comme celui d'une bactérie, souvenir de l'organisme libre qu'elle a été. Cet ADN ne vient que de la mère, ce qui en fait la trace la plus lisible des lignées humaines.

### 3.16 Ribosomes libres

**Rôle affiché** : Traduisent les ARN messagers en protéines, en plein cytosol.

Ce semis de grains est ce qui donne au cytoplasme sa texture granuleuse en microscopie électronique — le mot « ribosome » vient de là. Chacun est fait de deux sous-unités emboîtées, une grande et une petite, qui se referment sur un ARN messager le temps d'assembler une protéine puis se séparent. Ceux-ci sont libres : ils fabriquent les protéines qui resteront dans le cytosol, tandis que leurs jumeaux accrochés au réticulum produisent les protéines destinées à être exportées ou insérées dans une membrane.

### 3.17 Nucléosomes

**Rôle affiché** : Empaquettent l'ADN : deux mètres de double hélice dans six micromètres.

Un nucléosome, ce sont 147 paires de bases enroulées 1,7 fois autour d'un octamère d'histones : un palet de onze nanomètres. Il y en a une trentaine de millions dans un noyau humain, et ce sont eux qui remplissent réellement le volume — pas quelques fils dans une bulle, un feutre saturé. La densité n'y est pas la même partout : contre l'enveloppe, l'hétérochromatine est compactée et muette ; vers le centre, l'euchromatine relâchée laisse lire les gènes. Enfin chaque chromosome reste groupé dans son territoire au lieu de se disperser — ce sont les régions de teintes différentes.

> **Chiffres à contrôler** : 147

### 3.18 Machinerie nucléaire

**Rôle affiché** : Lit les gènes et découpe les ARN : polymérases, facteurs, spliceosomes.

Entre les nucléosomes circule tout ce qui travaille sur l'ADN : les ARN polymérases qui recopient les gènes, les facteurs de transcription qui décident lesquels, les spliceosomes qui découpent les ARN à peine transcrits. Ces complexes se tiennent surtout là où la chromatine est desserrée, vers le centre du noyau — contre l'enveloppe, la chromatine compactée ne se lit pas. Les grosses masses sombres sont des corps nucléaires : taches d'épissage et corps de Cajal, où les facteurs sont stockés et remis en état entre deux usages.

---

## 4. L'atelier du gène

La chaîne pédagogique, d'un bout à l'autre : l'ARN polymérase copie les quatre-vingt-dix bases du fragment codant la chaîne B en ouvrant la double hélice sur treize à la fois, le transcrit reçoit sa coiffe dès le vingt-cinquième nucléotide ; le fragment est contrôlé, polyadénylé puis franchit le pore nucléaire — qui n'est pas un trou mais un hydrogel où le brin doit fondre — et attend. Il n'ira nulle part tout seul : c'est vous qui le donnez au ribosome, et rien ne se traduit avant. Ensuite le ribosome lit un codon à la fois, trois à cinq ARN de transfert viennent cogner avant le bon, et l'acide aminé désigné s'ajoute à la chaîne. La séquence est celle de la chaîne B de l'insuline humaine : la protéine qui s'affiche résidu par résidu est déterminée par les bases du gène, par la table standard du code génétique et par rien d’autre. Ces quatre-vingt-dix bases proviennent de la région codante du gène INS humain, collationnée sur GenBank (NM_000207.3) et épinglées base par base par un test.

**Ellision.** C'EST UN PLATEAU, pas une vue de la cellule : les organites sont retirés le temps de la scène, car à trois cents nanomètres le noyau n'est plus un contexte mais une paroi opaque devant le sujet. Le fragment d'enveloppe et l'anneau du pore sont réduits à 150 nm de côté — un pore réel en fait 120 de large et écraserait des acteurs qui, eux, gardent leurs dimensions exactes : 29 nm pour le gène, 30 pour le ribosome, 54 pour le messager. Le mécanisme « Export nucléaire » montre le pore à sa vraie taille. Un grain d'ARN messager pour trois nucléotides, soit un par codon. Le RIBOSOME EST FIXE ET LE BRIN DÉFILE : dans la cellule c’est l’inverse, mais c'est le même mouvement vu d'un autre repère, et celui-ci garde le ribosome au centre du cadre. Six ARN de transfert sont montrés là où le cytosol en contient des centaines de milliers. Un seul ribosome est représenté alors qu'un ARNm actif en porte toujours plusieurs — c'est un polysome, et le mécanisme « Synthèse des protéines » le montre. L'épissage est absent : ce segment n'a pas d'intron, ce qui est vrai de la région montrée mais pas du gène entier. Enfin les protéines qui accompagnent le transcrit — le mRNP — ne sont pas dessinées, alors qu'un ARNm n'est jamais nu.

> **Chiffres à contrôler** : 150 nm · 29 nm · 150 · 120 · 29 · 30 · 54

---

## 5. Ce qui a déjà été collationné sur source

Ces chiffres ont été confrontés à la littérature le 1ᵉʳ août 2026. Le relecteur peut les
survoler et concentrer son attention ailleurs — mais rien ne lui interdit de les contester.

| Affirmation du site | Source | Verdict |
|---|---|---|
| Séquence du gène INS, 90 bases | NM_000207.3 (NCBI) | **exacte**, collationnée base par base |
| Les 64 codons du code génétique | table 1 du NCBI | **exacte**, vérifiée codon par codon |
| Pompe Na⁺/K⁺ : un quart du budget d'ATP | 19–28 % publiés, BNID 107962 | dans la fourchette |
| Synthèse protéique : 30 % du budget | 25–30 % publiés | haut de la fourchette, défendable |
| Ribosome : 5 à 6 acides aminés par seconde, 170 ms par codon | 5,2 à 6 aa/s, BNID 107952 | **exacte** |
| ATP synthase : 130 tours par seconde, 7,7 ms par tour | 130 rps à saturation d'ATP | **exacte** ; ⚠️ la vitesse monte à ~350 rps à 37 °C selon la température et la charge |
| 30 ATP par glucose, dont 2 par la glycolyse | 30–32 modernes, P/O de 2,5 et 1,5 | **exacte**, et à jour — les 36–38 des vieux manuels sont écartés |

> **Ce qui reste ouvert sur ces points** : la vitesse de l'ATP synthase dépend fortement de la
> température et de la charge en ADP. Le site retient 130 tours par seconde, valeur mesurée à
> saturation d'ATP ; à 37 °C la vitesse maximale publiée est bien plus haute. Le badge « ralenti
> ×200 » en dépend directement.

---

## 6. Ce que le relecteur ne verra pas ici

Ce dossier couvre le TEXTE. Trois choses lui échappent et demandent la page :

- **Les proportions** : tout est dessiné à l'échelle vraie sauf ce que les ellisions
  déclarent. Un écart de taille se voit à l’écran, pas dans une fiche.
- **Les cinétiques relatives** : un canal qui débite cent mille fois plus qu'une pompe
  est rendu par un contraste visuel, sans un mot.
- **Le geste** : donner un brin d'ARN à un ribosome, et couper l'oxygène pour voir la
  traduction s’arrêter.

*Généré depuis 21 mécanismes, 18 familles d'organites et 90 bases.*

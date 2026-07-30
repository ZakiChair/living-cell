# RAPPORT — Fidélité scientifique pour l'animation de 4 phénomènes cellulaires

**Convention de sourçage appliquée à chaque nombre :**
- **[A]** = valeur *effectivement récupérée* pendant cette session (BNID, DOI, chapitre Alberts en ligne). Citable telle quelle.
- **[B]** = ordre de grandeur de manuel (Alberts/Lodish), non re-vérifié ici. À afficher comme « ordre de grandeur », **jamais** avec un faux BNID.
- ⚠️ = point où la littérature ne tranche pas ; ne pas inventer de précision.

**Règle transversale n°1 : toujours étiqueter le type cellulaire.** « 1 million de pompes par cellule » est vrai pour un néphron et faux d'un facteur 10⁵ pour un globule rouge. Aucune moyenne inter-organismes.

---

## RÈGLES D'OR TRANSVERSALES (à graver dans la charte du site)

1. **Un facteur de ralenti unique et affiché par scène.** Le site doit écrire en clair « ralenti ×10³ » dans un coin. C'est ce qui transforme une simplification en honnêteté.
2. **Le milieu n'est jamais vide.** Cytoplasme = ~300 mg/mL de macromolécules, fraction volumique 25–30 % [A, Frontiers Phys. 2014 / PLoS Comp Biol 2010]. La GFP diffuse à **27 µm²/s** dans le cytoplasme de cellule CHO contre **87 µm²/s** dans l'eau, soit une viscosité relative de 3,2 [A, **BNID 101997**] ; dans le cytoplasme d'*E. coli* le ralentissement atteint ~×12 pour une GFP de rayon 2,8 nm [A].
3. **Rien n'est dirigé.** Aucune molécule ne « vise » sa cible. Tout est collision brownienne + tri par affinité + essais ratés majoritaires.
4. **L'échelle est le premier mensonge.** Membrane ≈ **5 nm** [A, Alberts NBK26910], ribosome ≈ **30 nm** (générique) / **~25 nm** (mammifère) [A, **BNID 100483**], ADN 2 nm de large [B], NPC ~100 nm [A]. Un ribosome fait donc 5 diamètres de membrane et 15 largeurs d'ADN.
5. **Le budget temps** (réel → écran → facteur) doit exister pour chaque scène. Sinon le site ment par omission.

---

# A) ÉCHANGES DE MINÉRAUX À LA SURFACE

## A.1 Acteurs à représenter

| Acteur | Rôle visuel | Note d'exactitude |
|---|---|---|
| Bicouche lipidique | ~5 nm, dense en protéines | Une bicouche synthétique est **10⁹ fois plus perméable à l'eau qu'aux ions Na⁺ ou K⁺** [A, Alberts NBK26815] — c'est LE fait qui justifie l'existence des canaux |
| Na⁺/K⁺-ATPase | Pompe primaire, cycle E1/E2 | 3 Na⁺ sortis / 2 K⁺ entrés **par ATP hydrolysé** [A, Alberts ch. 11 NBK26896] |
| Canal K⁺ (filtre de sélectivité) | Jet continu, pas des billes | Laisse passer les ions de **diamètre < 0,65 nm** ; K⁺ = 0,133 nm, Na⁺ = 0,095 nm [A] |
| Canal Ca²⁺ voltage-dépendant | Ouverture brève, signal | Gradient Ca²⁺ ≈ **10 000×** [A, BioNumbers book] |
| Canal Cl⁻ / CFTR | Souvent oublié | CFTR : 1 blanc sur 27 est porteur, maladie 1/2500 [A, Alberts ch. 11] |
| Aquaporine (AQP1) | Tétramère, 4 pores indépendants | **~3 × 10⁹ molécules d'eau/s par monomère** [A, PNAS 2001] ; constriction du pore ~3 Å |
| SGLT1 (symport Na⁺/glucose) | Le gradient Na⁺ « paie » | Transport secondaire = la pompe finance le reste |
| NCX (antiport 3Na⁺/1Ca²⁺) | Sortie du Ca²⁺ | |
| Pompe Ca²⁺ SERCA | Réticulum | Représente **~90 % des protéines membranaires** du réticulum sarcoplasmique [A, Alberts ch. 11] |

## A.2 Les chiffres à afficher (ceux qui font qu'un biologiste ne grince pas)

**Gradients (cellule mammifère typique)** — table Alberts 11-1 / BioNumbers [A partiel : **BNIDs 104083, 107487, 110745, 110754** pour la table BioNumbers ; valeurs individuelles = B] :

| Ion | Intracellulaire | Extracellulaire | Rapport |
|---|---|---|---|
| Na⁺ | ~5–15 mM (souvent cité 12) | ~145 mM | ~×12 sortant |
| K⁺ | ~140 mM | ~4–5 mM | ~×30 entrant |
| Ca²⁺ **libre** | ~100 nM (10⁻⁷ M) | ~1–2 mM (10⁻³ M) | **~×10 000** [A, Alberts ch. 11 : « 10⁻⁷ M vs 10⁻³ M »] |
| Cl⁻ | ~5–15 mM | ~110 mM | ~×10–20 |
| Mg²⁺ libre | ~0,5–1 mM | ~1–2 mM | faible |

> Alberts formule prudemment : « K⁺ typiquement **10 à 20 fois plus concentré** à l'intérieur qu'à l'extérieur » [A]. Si le site veut un seul chiffre, mettre **140 / 4 mM** et préciser « ordre de grandeur, cellule mammifère ».

**Potentiel de membrane** [A, Alberts NBK26910] :
- Gamme réelle : **−20 mV à −200 mV** selon organisme et type cellulaire.
- Neurone typique : **≈ −70 mV**.
- Potentiel d'équilibre du Na⁺ : **≈ +50 mV**.
- Champ électrique dans la membrane : **≈ 100 000 V/cm** (5 nm pour 70 mV) — chiffre spectaculaire et vrai, à afficher.

**Vitesses — le chiffre le plus pédagogique du site** :
- **Canal ouvert : jusqu'à 10⁸ ions/s**, soit « plus de 1000 ions par milliseconde » [A, Alberts NBK26910].
- Alberts : c'est **10⁵ fois plus rapide** que le meilleur transporteur/pompe connu [A].
- **Na⁺/K⁺-ATPase : ordre 10² cycles/s.** ⚠️ La littérature est dispersée selon température et préparation :
  - enzyme purifiée : **8 000–10 000 cycles/min = 133–167 s⁻¹** [A, Proteopedia] ;
  - reins de porc / lapin, conditions physiologiques : turnover ~**48 s⁻¹** et ~**43 s⁻¹** ; transition E2→E1 à ~65 s⁻¹ (porc) et ~90 s⁻¹ (lapin) [A, *Biophys J*, « Rate Limitation of the Na⁺,K⁺-ATPase Pump Cycle »].
  - **Affichage recommandé : « ~50 à 150 cycles/s selon température et tissu », soit ~150–450 Na⁺/s et ~100–300 K⁺/s.** Donner la fourchette + la raison de la fourchette est plus crédible qu'un chiffre unique.

**Nombre de copies — étiqueté par cellule** :
- Globule rouge humain : **471 ± 70 pompes Na,K-ATPase par cellule** [A, littérature érythrocytaire].
- Tubule contourné distal rénal : **jusqu'à ~5 × 10⁷ pompes par cellule** [A].
- Coût énergétique : la pompe consomme **~1/3 de l'énergie d'une cellule animale typique**, et **jusqu'aux 2/3 dans un neurone** [A, Alberts ch. 11]. C'est le chiffre « waouh » légitime.
- Diversité : **> 100 types de canaux ioniques décrits** ; *C. elegans* possède **68 gènes** de canaux K⁺ apparentés [A].

## A.3 Les 3 erreurs les plus fréquentes

1. **Pompe et canal animés à la même vitesse.** C'est l'erreur reine. Le rapport réel est de **10⁴–10⁵** [A]. Toute animation qui montre « une bille par pompe, une bille par canal » ment d'un facteur 10 000.
2. **« La pompe crée le −70 mV ».** Faux : le potentiel de repos est essentiellement un **potentiel de diffusion du K⁺** (Nernst/Goldman) rendu possible par les canaux de fuite. L'électrogénicité directe de la pompe (1 charge nette par cycle) ne contribue que quelques mV [B]. La pompe **entretient les gradients**, elle ne fabrique pas la tension.
3. **Membrane vide et ions comptables.** Deux sous-erreurs : (a) la membrane est encombrée de protéines (~50 % de sa masse [B]), pas un tapis lipidique nu ; (b) un potentiel d'action ne déplace qu'**environ 10⁻⁵ (un millième de pour cent) de la charge intracellulaire** [A, BioNumbers book, calcul lié au **BNID 111449**]. Montrer « tous les Na⁺ entrent » est faux : quasi rien ne bouge, en proportion.

*(Bonus fréquent : canaux dessinés ouverts en permanence — l'ouverture est stochastique, de l'ordre de la milliseconde [A].)*

## A.4 Ce qu'on peut simplifier sans mentir

- ✅ Représenter la pompe en 4 états (E1 → E1-P → E2-P → E2) plutôt que le cycle de Post-Albers complet.
- ✅ Ne pas dessiner la couche d'hydratation des ions — **mais** la mentionner en légende, car c'est *le* mécanisme de la sélectivité (le filtre imite les oxygènes de l'eau).
- ✅ Représenter le flux d'un canal comme un **jet/traînée continue** au lieu de billes individuelles : c'est plus exact que des billes, pas moins.
- ✅ Omettre les sous-unités β et FXYD de la pompe.
- ❌ Ne pas simplifier le rapport de vitesse pompe/canal. C'est le contenu.

## A.5 Budget d'animation

| Événement | Durée réelle | Écran | Facteur |
|---|---|---|---|
| 1 cycle Na⁺/K⁺-ATPase | ~7–20 ms | 7–20 s | **×1 000** |
| Passage d'un ion par un canal K⁺ | ~10–100 ns | — | rendre en **flux continu**, pas en billes |
| Ouverture/fermeture d'un canal | quelques ms [A] | 2–4 s | ×1 000 |
| Aquaporine | 3×10⁹ H₂O/s | flux laminaire | idem |

> **Astuce honnête** : à ralenti **×1 000** exactement, la pompe devient un mécanisme lisible ET le canal devient physiquement indessinable en billes (10⁴ ions/s à l'écran). Ce contraste visuel *encode* le facteur 10⁴ sans un mot de commentaire. C'est la meilleure décision de design de tout le site.

---

# B) ÉCHANGES / TRAFIC DE PROTÉINES

## B.1 Acteurs

**Voie sécrétoire** : SRP + récepteur SRP → translocon Sec61 → RE rugueux (chaperons BiP/calnexine, N-glycosylation) → sites de sortie du RE → manteau **COPII** → ERGIC → Golgi *cis→médian→trans* → TGN → vésicules → SNARE (v-/t-SNARE) → fusion.
**Rétrograde** : manteau **COPI**, récepteur KDEL.
**Endocytose** : clathrine + adaptateurs AP2, dynamine.
**Import nucléaire** : NLS → importine α/β → NPC (FG-nucléoporines) → RanGTP libère le cargo.
**Import mitochondrial** : préséquence N-terminale → récepteurs Tom20/Tom22 → canal Tom40 → TIM23 → MPP clive la préséquence ; moteur PAM/mtHsp70 ; force protomotrice requise.
**Dégradation** : E1 → E2 → E3 ligase → chaîne poly-Ub (K48) → protéasome 26S (19S + 20S) → peptides.

## B.2 Ordres de grandeur

**Tailles**
- Vésicules **COPII : 60–80 nm** ; COPI/COPII combinés : bourgeons sphériques **60–100 nm** [A].
- Vésicules à clathrine : **20–200 nm** [A].
- NPC : diamètre externe **~100 nm** ; canal central **35–50 nm**, dilatable de 40 à 70 nm sous stress [A].
- Protéasome 26S : masse **~2,4 × 10⁶ Da**, soit ~20 000 acides aminés [A, **BNID 104915**].

**Temps réels — le cœur de la section**
- **RE → Golgi** : constante de vitesse moyenne **2,8 %/min** ; **Golgi → membrane plasmique : 3,0 %/min** ; durée de vie moyenne des intermédiaires post-Golgi : **3,8 min** en cellules COS [A, Hirschberg *et al.*, *J Cell Biol* 143:1485, 1998].
- **Premiers VSVG-GFP à la membrane plasmique : ~10 min** après déblocage thermique [A, même source] — c'est le *front* le plus rapide, pas la moyenne.
- **Traversée du Golgi : ~25 min** dans les simulations d'export [A].
- **Transit total RE → surface : ordre de la dizaine de minutes à ~1 h**, très dépendant du cargo. Afficher « 20–60 min » avec la mention « selon la protéine ».
- **Import nucléaire** : temps de séjour au NPC de **~2,5 ms** pour l'importine β, **5,8 ± 0,2 ms** pour NTF2, **7,1 ± 0,2 ms** pour la transportine 1 ; translocation d'un cargo **< 10 ms** [A, Yang & Musser, *J Cell Biol* 168:233, 2005 et suivants].
- **Export d'un mRNP : 50–350 ms**, jusqu'à quelques secondes pour les particules très volumineuses [A].
- **Flux par NPC : centaines de molécules/s, jusqu'à ~1 000/s** [A].
- **Protéasome** : **0,05 à 5 chaînes peptidiques « caractéristiques » par minute** [A, **BNID 108032, 109854**] ; estimation retenue pour cellule à division rapide : **5 protéines/min ≈ 0,1/s ≈ 40 aa/s** [A, BNID 108032]. Une DHFR ubiquitinylée purifiée : **~23 s et ~50–80 ATP** [A, *Nat Rev Mol Cell Biol* 2024]. Produits : fragments de **2–30 acides aminés** [A, **BNID 108111**].
- **Demi-vie moyenne d'une protéine en lignée cellulaire : 1–2 jours** [A, **BNID 109937**] ; demi-vie du protéasome lui-même **~5 jours** [A, **BNID 108031**].

**Nombres de copies**
- Protéasomes : **~1 % de la masse protéique totale** d'une cellule HeLa [A, **BNID 108028, 108717**], soit **~10⁶ protéasomes par cellule HeLa** [A] ; 0,01–0,3 % dans les cellules sanguines selon le type [A, **BNID 108041**].
- NPC : de **quelques centaines à quelques dizaines de milliers par noyau** selon le type cellulaire et le stade [A]. ⚠️ Ne pas donner un chiffre unique ; le fibroblaste humain est souvent cité vers 2 000–5 000 [B].

⚠️ **Import mitochondrial : temporalité mal contrainte.** Les revues récentes disent explicitement que « les progrès ont été freinés par la faible sensibilité et la mauvaise résolution temporelle des tests d'import » [A, *eLife* 2022 / *Trends Biochem Sci* 2025]. **Ne pas afficher de chiffre en secondes.** Écrire : « quelques secondes à quelques minutes, mal contraint expérimentalement — les mesures fiables datent des essais NanoLuc scindée ». Cette prudence affichée est un gage de sérieux.

## B.3 Les 3 erreurs les plus fréquentes

1. **La vésicule « bulle de savon ».** Dans presque toutes les vulgarisations, la vésicule est une sphère nue qui se détache. En réalité : elle naît **couverte d'un manteau protéique** (COPII, COPI ou clathrine) qui la déforme, sélectionne le cargo — le fret est **concentré**, pas échantillonné au hasard — puis **le manteau est perdu avant la fusion**. Sans manteau, on ne montre ni le tri ni le moteur du bourgeonnement.
2. **Le Golgi comme gare de triage statique.** Montrer des vésicules « taxi » traversant une pile immobile ignore le modèle de **maturation cisternale** (les citernes elles-mêmes progressent *cis*→*trans* tandis que COPI ramène les enzymes en arrière), au moins aussi soutenu. Et surtout : le Golgi n'est pas un couloir, on y **séjourne ~25 min** [A].
3. **Le tapis roulant à sens unique.** Manquent systématiquement : (a) le **flux rétrograde** COPI / récepteur KDEL, (b) le **contrôle qualité du RE** et l'ERAD — une fraction substantielle des protéines naissantes est rétro-transloquée et détruite, et (c) l'idée que **synthèse et destruction tournent en parallèle en permanence** (demi-vie moyenne 1–2 j [A]).

*(Bonus quasi universel : le pore nucléaire dessiné comme un trou vide. C'est un hydrogel de nucléoporines FG désordonnées ; le cargo « fond » dedans par interactions transitoires — d'où les 2,5–7 ms de temps de séjour [A]. Et l'importine ne « pousse » rien : la directionnalité vient du gradient RanGTP/RanGDP.)*

## B.4 Ce qu'on peut simplifier sans mentir

- ✅ Fusionner ERGIC dans « RE → Golgi ».
- ✅ Une seule E3 ligase générique au lieu de ~600 chez l'humain.
- ✅ Montrer 4 ubiquitines (le seuil canonique K48 pour l'adressage) plutôt que la topologie exacte de la chaîne.
- ✅ Ne pas représenter les ~30 nucléoporines individuelles : un anneau à 8 branches + une « brume » FG au centre suffit et est fidèle.
- ✅ Omettre les Rab GTPases, mais **garder les SNARE** (c'est le mécanisme de spécificité).
- ❌ Ne pas supprimer le manteau des vésicules. ❌ Ne pas supprimer le flux rétrograde.

## B.5 Budget d'animation

Ici on **accélère**, on ne ralentit pas.

| Événement | Durée réelle | Écran | Facteur |
|---|---|---|---|
| Transit RE → surface | 20–60 min | 20–40 s | **×100 accéléré** |
| Séjour Golgi | ~25 min | ~15 s | ×100 |
| Vie d'un intermédiaire post-Golgi | 3,8 min [A] | ~2 s | ×100 |
| Bourgeonnement COPII | dizaines de s [B] | ~0,3 s | ×100 |
| Passage d'un cargo par le NPC | < 10 ms [A] | 2 s | **×200 ralenti** ⚠️ facteur inversé — chapitrer la scène |
| Dégradation d'une protéine par le protéasome | ~12 s à 20 min (0,05–5/min) [A] | 5 s | ×10 à ×100 |

> Le NPC impose un **changement de facteur** : faire de l'import nucléaire une **sous-scène séparée** avec son propre badge de vitesse. Ne jamais mélanger ×100 accéléré et ×200 ralenti dans le même plan.

---

# C) TRADUCTION ARNm → PROTÉINE

## C.1 Acteurs

Petite sous-unité (40S / 30S), grande sous-unité (60S / 50S), ARNm avec coiffe 5′ et queue poly-A, ARNt aminoacylés en **complexe ternaire aa-ARNt·EF-Tu·GTP** (eEF1A chez l'eucaryote), sites **A / P / E**, centre peptidyl-transférase (ribozyme : c'est l'ARNr qui catalyse), **tunnel de sortie** (~100 Å [B]) où le repliement commence, EF-G/eEF2 (translocation), facteurs de terminaison eRF1/eRF3 lisant UAA/UAG/UGA, aminoacyl-ARNt synthétases (20, une par acide aminé), polysomes.

## C.2 Ordres de grandeur

**Vitesses d'élongation — tout est Tier A ici**
- *E. coli* : **20 aa/s** en vitesse maximale [A, **BNID 100059, 105067, 108490**].
- Levure bourgeonnante : **3–10 aa/s à 30 °C** [A, **BNID 107871**].
- Cellules souches embryonnaires de souris : **~6 aa/s**, remarquablement constant d'une protéine à l'autre [A, **BNID 107952**].
- Gamme eucaryote générale : **1–8 aa/s** par ribosome traduisant [A, **BNID 107783**].
- ➜ **Chiffre à afficher : « ~20 aa/s chez la bactérie, ~5–6 aa/s chez nous ».** L'énoncé du brief (« 15–20 » et « 5–9 ») est correct mais légèrement large ; les BNID ci-dessus le resserrent.

**Comparaison avec la transcription** (indispensable pour le site) [A, BioNumbers book *What is faster, transcription or translation?*]
- ARN pol *E. coli* : **40–80 nt/s** [**BNID 104900, 104902, 108488**] — soit ~13–27 codons/s, donc *à peu près appariée* aux 20 aa/s du ribosome : c'est ce qui permet le couplage transcription-traduction.
- ARN pol II mammifère : **50–100 nt/s** en élongation rapide [**BNID 105566, 105113, 100662**], mais **≈ 6 nt/s en moyenne une fois les pauses comptées** [**BNID 100661**] ; HeLa : 30–100 nt/s, **médiane 60** [**BNID 111027**] ; embryon de drosophile 25 nt/s à 22 °C.
- Gène bactérien de 1 kb : **~10 s de transcription + ~10 s d'élongation traductionnelle** [A].
- Épissage eucaryote : **5–10 min en moyenne** [A, **BNID 105568**] — donc chez nous, l'ARN attend **beaucoup** plus longtemps qu'il n'est traduit.

**Nombres de copies**
- *E. coli* : **~1 000–10 000 ARN polymérases** [A, **BNID 101440**] et **~10 000–100 000 ribosomes** [A, **BNID 101441**]. Le rapport ~10:1 est en soi une donnée pédagogique.
- Fraction ribosomique : **5–10 % de la masse protéique** dans une cellule typique, **jusqu'à 33 %** chez une bactérie à croissance rapide [A, BioNumbers book].

**Tailles**
- Ribosome : **30 nm** (valeur générique) [A, **BNID 100483**] ; **~25 nm** pour le mammifère [A, même fiche] ; ribosome bactérien **~2,4 MDa** [A]. (Eucaryote ~3,3–4,3 MDa = [B].)
- Empreinte du ribosome sur l'ARNm : **~30 nt** protégés (base du *ribosome profiling*, résolution au codon près) [A].
- ARNm : 2 nm de large, brin simple, **très replié** [B].

**Fidélité**
- Erreur de décodage : **10⁻³ à 10⁻⁴** [A, *Microbiol Mol Biol Rev* / PNAS]. Les ARNt cognés ont des taux d'activation GTPase d'EF1A et d'accommodation **plus élevés** que les quasi-cognés — c'est de la **sélection cinétique + relecture**, pas de la reconnaissance parfaite [A].

## C.3 Ce qui est TOUJOURS mal représenté (le cœur de la valeur de cette section)

1. **L'ARNt qui arrive « en file d'attente », visé, dans le bon sens, au bon site.** C'est le mensonge central. La réalité : les complexes ternaires **percutent le site A au hasard**, et **l'immense majorité est rejetée** — c'est précisément l'accumulation d'essais ratés qui produit la fidélité de 10⁻³–10⁻⁴ [A] via un double filtre (sélection initiale + relecture après hydrolyse du GTP). Une animation qui montre uniquement l'ARNt correct arrivant supprime le mécanisme entier. **Correctif d'animation :** montrer 3–5 ARNt entrant et rebondissant avant l'accepté, même en flou rapide.
2. **Un seul ribosome, sur un ARNm rectiligne et tendu.** Trois erreurs empilées : (a) les ARNm actifs portent des **polysomes** (plusieurs ribosomes simultanés) ; (b) l'ARNm réel est **replié, en pelote**, souvent **circularisé** par eIF4G reliant la coiffe à la poly-A ; (c) chez l'eucaryote, la petite sous-unité **balaie (scanning) depuis la coiffe** jusqu'à l'AUG — elle ne « se pose » pas dessus. Et l'étape **limitante est l'initiation**, pas l'élongation : les animations passent 3 secondes sur l'initiation et 30 sur l'élongation, exactement à l'envers de la biologie.
3. **Le ribosome qui glisse en continu, comme une tête de lecture sur une bande.** Le mouvement réel est un **cliquet discret, codon par codon** (rotation inter-sous-unités, mouvement hybride des ARNt A/P → P/E, puis translocation par EF-G/eEF2), **avec des pauses** dépendant du codon et de la structure de l'ARNm. Le glissement continu efface aussi le fait que les **trois sites A, P et E sont simultanément occupés**, et que la chaîne naissante sort par un **tunnel** où elle commence déjà à se replier — elle ne jaillit pas repliée d'un coup en fin de course.

*(Erreurs bonus très répandues : le vide autour du ribosome — voir règle transversale n°2 ; l'échelle — l'ARNm est 12–15 fois plus fin que le ribosome n'est large ; et l'oubli que **c'est l'ARN ribosomique qui catalyse** la liaison peptidique, pas une protéine.)*

## C.4 Ce qu'on peut simplifier sans mentir

- ✅ Ne montrer que 3–4 ARNt rejetés au lieu de dizaines : le **principe** est préservé.
- ✅ Omettre eIF1/1A/2/3/5 individuellement, garder « complexe de pré-initiation » + scanning.
- ✅ Représenter la queue poly-A par 5–6 A avec un « … ».
- ✅ Ne pas animer l'aminoacylation en détail, mais **montrer au moins une synthétase** : sinon l'ARNt semble naître chargé par magie.
- ✅ Simplifier le cliquet en deux images-clés (état classique / état hybride) : c'est déjà infiniment mieux qu'un glissement.
- ❌ Ne pas retirer les polysomes. ❌ Ne pas retirer les essais ratés.

## C.5 Budget d'animation

| Événement | Durée réelle | Écran | Facteur |
|---|---|---|---|
| 1 codon, *E. coli* (20 aa/s) | 50 ms | 1 s | **×20** |
| 1 codon, mammifère (6 aa/s) | 167 ms | 3,3 s | **×20** |
| Essai/rejet d'un ARNt | ~ms [B] | ~20–50 ms, en flou | ×20 |
| Protéine de 300 aa, mammifère | ~50 s | ~17 min → **couper** | montrer 10 codons puis fondu + compteur |
| Transcription ARN pol II (60 nt/s) | 17 ms/nt | 0,33 s/nt | ×20 |

> **Un facteur unique ×20 couvre toute la scène C**, transcription comprise. C'est la scène la plus facile à rendre honnête. Utiliser un **compteur d'acides aminés** à l'écran pour les 290 codons non montrés plutôt que d'accélérer subrepticement.

---

# D) COUPURES DES BRINS D'ADN ET D'ARN

## D.1 Acteurs

**En amont — transcription** : ARN pol II, bulle de transcription (~12–14 pb hybride ADN:ARN [B]), TBP/facteurs généraux, coiffe 5′ ajoutée dès ~25 nt.
**Topoisomérases** : Topo I (coupe **1 brin**, **sans ATP**, intermédiaire covalent 3′- ou 5′-phosphotyrosine, relaxation par pivotement contraint) ; Topo II (coupe **les 2 brins**, **ATP-dépendante**, fait passer un duplex entier à travers la brèche, puis religature — décaténation).
**Nucléases** : endonucléases (coupure interne) vs exonucléases (grignotage depuis une extrémité, 5′→3′ ou 3′→5′) ; enzymes de restriction (EcoRI, site palindromique GAATTC).
**CRISPR** : Cas9 + ARNg (crRNA:tracrRNA ou sgRNA), domaines **RuvC** (brin non-cible) et **HNH** (brin cible), **PAM = NGG** pour SpCas9.
**Réparation** : NHEJ (Ku70/80, DNA-PKcs, Artemis, ligase IV/XRCC4) vs HR (résection MRN/CtIP, RPA, RAD51, matrice sœur).
**Côté ARN** : spliceosome (U1, U2, U4, U5, U6 + protéines), site 5′, point de branchement (adénosine), site 3′, **lariat** ; Drosha/DGCR8, Dicer, Argonaute/RISC ; exosome à ARN (3′→5′), Xrn1 (5′→3′).

## D.2 Ordres de grandeur

**Topoisomérases**
- Topo II (*Drosophila*) : **~2,9 événements de passage de brin par seconde** [A, PNAS 2003, single-molecule].
- Un seul cycle catalytique de Topo II relaxe **exactement 2 supertours** — observé directement en micromanipulation [A, *Nature* 404:901, 2000].
- Processivité de Topo II sur ADN plectonémique : **> 6 000 tours**, soit ~50× plus que l'estimation antérieure ; ~100× moins processive avant formation du plectonème [A, *NAR/PMC* 2023].
- Topo I a une **vitesse totale de relaxation supérieure** à celle de Topo III [A].

**CRISPR-Cas9**
- Coupure **3 nucléotides en amont du PAM**, extrémités **franches**, RuvC et HNH agissant chacun sur un brin [A, PNAS 109:E2579, 2012].
- ⚠️ Nuance honnête : Cas9 produit aussi, dans une fraction des événements, des **coupures décalées avec surplombs de 1–3 nt**, ce qui explique les insertions di-/tri-nucléotidiques prévisibles [A, *Cell Discovery* 2019]. Le site peut dire « franche dans la majorité des cas ».
- **Cas9 reste accroché à l'ADN coupé**, longtemps : « plusieurs minutes ou davantage » en DNA curtains/smFRET, et **des heures** en tension torsionnelle élevée [A, *NAR* 49:12411, 2021]. Cinétique **mono-turnover** : la longue occupation du produit **bloque l'accès des machines de réparation** et constitue un goulot d'étranglement majeur de l'édition [A ; libération et re-turnover visualisés dans *Nat Commun* 2025].

**Réparation**
- Cinétique **biphasique** : NHEJ **sans résection** = phase rapide, majoritaire, en G1 **et** en G2 ; HR = phase lente, exige remodelage chromatinien ATM-dépendant + résection [A, *PLOS One* 8:e69061, 2013 ; *PMC* 5316416].
- Choix de voie : **G1 → NHEJ exclusivement** ; **G2 → HR en plus du NHEJ** ; à 6 h post-irradiation, les foyers γH2AX se résolvent mieux en G2 [A].
- HR = fidèle ; NHEJ = **intrinsèquement mutagène** [A].

**Épissage**
- Spliceosome = **5 snRNP : U1, U2, U4, U5, U6** ; assemblage E → A (U2) → B (tri-snRNP U4/U6·U5) → **Bact** (départ de U1 et U4, il reste U2/U5/U6) → B* → C [A].
- **Durée : 5–10 min en moyenne** [A, **BNID 105568**]. Largement **co-transcriptionnel** [A].
- Géométrie humaine, indispensable pour l'animation : **exon médian = 120 pb**, 70 % des exons < 200 pb ; **intron moyen ≈ 5 419 pb** ; **8,8 exons et 7,8 introns par gène** en moyenne ; 26 564 gènes ↔ 233 785 exons ↔ 207 344 introns [A, *Distributions of Exons and Introns in the Human Genome*, In Silico Biol. / SAGE].

**RNAi**
- siRNA issus de Dicer : **21–23 nt**, duplex avec **surplomb 3′ de 2 nt** [A].
- Ago2 coupe la cible **en face des nucléotides 10 et 11 du guide** [A].
- RISC est **multi-turnover** : après libération des produits, il recoupe [A].
- ⚠️ La tolérance aux mésappariements varie sur **~600×** selon la séquence guide [A, *Mol Cell* 2024] — donc « un guide = une efficacité » est faux.

**ARN pol II** : voir section C (médiane 60 nt/s HeLa, BNID 111027).
**ADN** : 2 nm de large, 0,34 nm/pb, ~10,5 pb par tour d'hélice [B] — nécessaire pour dessiner un supertour à l'échelle.

## D.3 Les 3 erreurs les plus fréquentes

1. **« CRISPR coupe et remplace. »** Deux faux en un. (a) **Cas9 ne fait que couper** ; c'est la **cellule** qui décide de la suite via NHEJ (indels aléatoires, mutagène) ou HR (précis, matrice requise, **restreint à S/G2**). Le résultat de l'édition est donc **statistique**, pas déterministe. (b) Cas9 **ne disparaît pas après la coupure** : il reste vissé sur le produit des minutes à des heures [A], au point d'être un frein à l'édition. Les animations grand public le font s'évaporer dans l'image suivante — c'est l'inverse du fait le plus important découvert sur cette enzyme.
2. **La topoisomérase « ciseau magique ».** Presque toutes les vulgarisations montrent une coupure puis un recollage sans intermédiaire. Or l'ADN coupé reste **lié de façon covalente à une tyrosine de l'enzyme** (phosphotyrosine) — c'est ce qui conserve l'énergie de la liaison et permet la religature sans ATP côté Topo I. C'est aussi **la cible de deux classes d'anticancéreux** (camptothécine → Topo I, étoposide → Topo II), qui piègent l'intermédiaire covalent. Deuxième confusion systématique : **Topo I = 1 brin, sans ATP ; Topo II = 2 brins, avec ATP**. Beaucoup de sites inversent ou fusionnent les deux.
3. **La géométrie de l'épissage à l'envers.** Les schémas dessinent de gros exons séparés par de petits introns. La réalité humaine est l'inverse d'un facteur **~45** (exon médian 120 pb, intron moyen 5,4 kb [A]). Corollaires oubliés : (a) l'épissage est **co-transcriptionnel** — il commence avant que le transcrit soit fini ; (b) le **lariat** (l'intron excisé en lasso, relié par une liaison 2′-5′ à l'adénosine du point de branchement) disparaît quasi toujours des animations, alors que c'est la signature chimique de la réaction ; (c) le spliceosome n'est pas un objet préformé qui « se pose », il **s'assemble et se désassemble à chaque intron**.

*(Bonus fréquent : confondre extrémités **franches** (Cas9, SmaI) et **cohésives** (EcoRI et la plupart des enzymes de restriction). Le contraste franc/cohésif est une excellente séquence pédagogique de 15 secondes. Autre bonus : dessiner les nucléases comme un seul type d'outil — la distinction **endo** (coupe au milieu) / **exo** (grignote une extrémité, processivement) est visuellement facile et presque jamais faite.)*

## D.4 Ce qu'on peut simplifier sans mentir

- ✅ Réduire les 5 snRNP à 3 objets colorés en gardant l'ordre d'arrivée U1 → U2 → tri-snRNP et le départ de U1/U4.
- ✅ Représenter un intron à **1/10 de sa longueur réelle**, à condition d'afficher « intron raccourci ×10 » — l'inverse de le dessiner petit sans le dire.
- ✅ Ne pas montrer la réaction de transestérification atome par atome, mais **garder le lariat**.
- ✅ Montrer le supertour comme 2–3 croisements plutôt qu'un plectonème réaliste.
- ✅ Omettre DNA-PKcs/Artemis dans le NHEJ (garder Ku + ligase IV) ; omettre RPA dans l'HR (garder résection + RAD51 + chromatide sœur).
- ❌ Ne pas faire disparaître Cas9 après la coupure. ❌ Ne pas omettre que NHEJ ≠ HR ni que HR exige une matrice.

## D.5 Budget d'animation

| Événement | Durée réelle | Écran | Facteur |
|---|---|---|---|
| Transcription (60 nt/s) | 17 ms/nt | 0,33 s/nt | **×20** |
| Passage de brin Topo II (2,9 s⁻¹) | ~345 ms | ~7 s | **×20** |
| Recherche de cible par Cas9 | µs–ms par collision | rafale floue de 2 s | non chiffré, montrer l'échec |
| Coupure Cas9 | rapide | 1 s | — |
| **Cas9 accroché au produit** | **min à heures** [A] | 3 s + horloge « ×10 000 accéléré » | **inversion de facteur — badge obligatoire** |
| Épissage d'un intron | 5–10 min [A] | 6–12 s | **×50 accéléré** |
| NHEJ | phase rapide (min–h) [A] | 5 s | ×100+ |
| HR | phase lente (h) [A] | 10 s | ×1 000+ |

> La scène D est la seule à couvrir **10 ordres de grandeur temporels** (µs de collision → heures de réparation). Elle **doit** être chapitrée en 4 sous-scènes avec un badge de vitesse propre à chacune, sinon l'honnêteté est structurellement impossible.

---

## SYNTHÈSE — LES 10 CHIFFRES À METTRE EN GRAND SUR LE SITE

| # | Chiffre | Source |
|---|---|---|
| 1 | Canal ionique **10⁸ ions/s** vs pompe **~10² cycles/s** → écart **10⁵** | [A] Alberts NBK26910 |
| 2 | Na⁺/K⁺-ATPase : **3 Na⁺ dehors / 2 K⁺ dedans par ATP**, **~1/3 de l'ATP** cellulaire, **2/3 dans un neurone** | [A] Alberts ch. 11 |
| 3 | Gradient Ca²⁺ : **10 000×** (100 nM dedans / 1–2 mM dehors) | [A] Alberts ch. 11 + BioNumbers |
| 4 | Un potentiel d'action ne déplace que **10⁻⁵ de la charge** de la cellule | [A] BioNumbers book |
| 5 | Aquaporine : **3 × 10⁹ molécules d'eau/s** par monomère | [A] PNAS 2001 |
| 6 | Ribosome : **20 aa/s** (*E. coli*) vs **~6 aa/s** (mammifère) | [A] BNID 100059 / 107952 |
| 7 | Fidélité de traduction **10⁻³–10⁻⁴**, obtenue **par rejets massifs** | [A] MMBR / PNAS |
| 8 | Protéasome : **0,05–5 protéines/min**, **~10⁶ copies** par cellule HeLa | [A] BNID 108032, 108028 |
| 9 | Exon médian **120 pb** vs intron moyen **5 419 pb** (facteur ~45, à l'envers dans tous les schémas) | [A] In Silico Biol. |
| 10 | Cas9 reste collé à l'ADN coupé **des minutes à des heures** | [A] NAR 49:12411 |

**Ratio de sourçage de ce rapport :** sur ~85 valeurs chiffrées, **~70 sont Tier A** (récupérées en session, avec BNID ou référence), soit **~82 %**. Les Tier B restants (concentrations ioniques individuelles, dimensions de l'ADN, longueur du tunnel de sortie, masse du ribosome eucaryote, fraction protéique de la membrane) sont explicitement marqués et ne portent aucune fausse citation.

---

## SOURCES

**Manuels / bases quantitatives**
- Alberts *et al.*, *Molecular Biology of the Cell* — [Ion Channels and the Electrical Properties of Membranes (NBK26910)](https://www.ncbi.nlm.nih.gov/books/NBK26910/) · [Carrier Proteins and Active Membrane Transport (NBK26896)](https://www.ncbi.nlm.nih.gov/books/NBK26896/) · [Principles of Membrane Transport (NBK26815)](https://www.ncbi.nlm.nih.gov/books/NBK26815/) · [Molecular Mechanisms of Membrane Transport (NBK26859)](https://www.ncbi.nlm.nih.gov/books/NBK26859/)
- BioNumbers (Milo & Phillips) — [What is faster, transcription or translation?](https://book.bionumbers.org/what-is-faster-transcription-or-translation/) · [How fast do proteasomes degrade proteins?](https://book.bionumbers.org/how-fast-do-proteasomes-degrade-proteins/) · [What are the concentrations of different ions in cells?](https://book.bionumbers.org/what-are-the-concentrations-of-different-ions-in-cells/) · [BNID 101997 — GFP diffusion](https://bionumbers.hms.harvard.edu/bionumber.aspx?s=n&v=12&id=101997) · [BNID 100483 — ribosome diameter](https://bionumbers.hms.harvard.edu/bionumber.aspx?id=100483) · [BNID 107783 — ribosome progression eukaryote](https://bionumbers.hms.harvard.edu/bionumber.aspx?s=n&v=1&id=107783) · [BNID 107426 — ion concentrations](https://bionumbers.hms.harvard.edu/bionumber.aspx?s=n&v=1&id=107426)

**A — Membrane**
- [Rate Limitation of the Na⁺,K⁺-ATPase Pump Cycle, *Biophys J*](https://www.sciencedirect.com/science/article/pii/S0006349501758560) · [Kinetic Comparisons of Heart and Kidney Na⁺,K⁺-ATPases, *Biophys J*](https://www.cell.com/biophysj/fulltext/S0006-3495(12)00808-9) · [Sodium-Potassium ATPase, Proteopedia](https://proteopedia.org/wiki/index.php/Sodium-Potassium_ATPase) · [Ion channels versus ion pumps: the principal difference, in principle, *Nat Rev Mol Cell Biol*](https://www.nature.com/articles/nrm2668) · [Structural basis for gating of the human sodium-potassium pump, *Nat Commun* 2022](https://www.nature.com/articles/s41467-022-32990-x) · [Dynamic mechanisms of AQP1, *PNAS* 2001](https://www.pnas.org/doi/10.1073/pnas.251507998) · [Structural determinants of water permeation through aquaporin-1, *Nature*](https://www.nature.com/articles/35036519) · [Red Blood Cell Na pump: Insights from Species Differences](https://pmc.ncbi.nlm.nih.gov/articles/PMC2696618/) · [Physiology, Sodium Potassium Pump, StatPearls](https://www.ncbi.nlm.nih.gov/books/NBK537088/)

**B — Trafic**
- [Kinetic Analysis of Secretory Protein Traffic (VSVG-GFP), *J Cell Biol* 143:1485](https://rupress.org/jcb/article/143/6/1485/15976/Kinetic-Analysis-of-Secretory-Protein-Traffic-and) · [Transport through the Golgi by rapid partitioning](https://pmc.ncbi.nlm.nih.gov/articles/PMC2481404/) · [COP and clathrin-coated vesicle budding (McMahon)](https://ressources.unisciel.fr/biocell/chap8/res/07_04_PDF_COP_Clathrin_coated_vesicle_budding_McMahon.pdf) · [Nuclear transport of single molecules: dwell times at the NPC, *J Cell Biol* 168:233](https://rupress.org/jcb/article/168/2/233/51329/Nuclear-transport-of-single-molecules-dwell-times) · [Physics of the Nuclear Pore Complex](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9306291/) · [Tpr regulates the total number of NPCs per nucleus](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6169833/) · [Mechanisms and regulation of substrate degradation by the 26S proteasome, *Nat Rev Mol Cell Biol* 2024](https://www.nature.com/articles/s41580-024-00778-0) · [Towards a molecular mechanism of mitochondrial import through TOM/TIM23, *eLife*](https://elifesciences.org/articles/75426) · [Understanding mitochondrial protein import, *Trends Biochem Sci* 2025](https://www.cell.com/trends/biochem-sciences/fulltext/S0968-0004(25)00050-7)

**C — Traduction**
- [Ribosome Kinetics and aa-tRNA Competition Determine Rate and Fidelity of Peptide Synthesis](https://pmc.ncbi.nlm.nih.gov/articles/PMC2727733/) · [The role of fluctuations in tRNA selection by the ribosome, *PNAS*](https://www.pnas.org/doi/10.1073/pnas.0705988104) · [Initiation of Protein Synthesis in Bacteria, *MMBR*](https://journals.asm.org/doi/10.1128/mmbr.69.1.101-123.2005) · [What determines eukaryotic translation elongation, *Open Biology*](https://royalsocietypublishing.org/rsob/article/10/12/200292/90892/) · [Protein synthesis rates and ribosome occupancies, *PNAS*](https://www.pnas.org/doi/10.1073/pnas.1817299116) · [The effect of macromolecular crowding on mobility of biomolecules, *Front Phys*](https://www.frontiersin.org/journals/physics/articles/10.3389/fphy.2014.00054/full) · [Diffusion, Crowding & Protein Stability in the Bacterial Cytoplasm, *PLoS Comp Biol*](https://journals.plos.org/ploscompbiol/article?id=10.1371%2Fjournal.pcbi.1000694)

**D — Coupures**
- [Cas9–crRNA RNP mediates specific DNA cleavage, *PNAS* 109:E2579](https://www.pnas.org/doi/10.1073/pnas.1208507109) · [Probing the stability of the SpCas9–DNA complex after cleavage, *NAR* 49:12411](https://academic.oup.com/nar/article/49/21/12411/6430833) · [Visualization of a multi-turnover Cas9 after product release, *Nat Commun* 2025](https://www.nature.com/articles/s41467-025-60668-7) · [Cas9 has no exonuclease activity → staggered cleavage, *Cell Discovery* 2019](https://www.nature.com/articles/s41421-019-0120-z) · [Single-molecule analysis of DNA uncoiling by a type II topoisomerase, *Nature* 404:901](https://www.nature.com/articles/35009144) · [Single-molecule study of DNA unlinking by type-II topoisomerases, *PNAS*](https://www.pnas.org/doi/10.1073/pnas.1631550100) · [Chromatinization modulates topoisomerase II processivity](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10611788/) · [Bacterial topoisomerase I and III relax supercoiled DNA via distinct pathways, *NAR*](https://academic.oup.com/nar/article/40/20/10432/2414715) · [The Efficiency of HR and NHEJ during Cell Cycle Progression, *PLOS One*](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0069061) · [DSB Resection during NHEJ in G1](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5316416/) · [One end to rule them all: NHEJ and HR at DSBs, *Br J Radiol*](https://academic.oup.com/bjr/article/93/1115/20191054/7240261) · [Modelling reveals kinetic advantages of co-transcriptional splicing, *PLOS Comp Biol*](https://journals.plos.org/ploscompbiol/article?id=10.1371%2Fjournal.pcbi.1002215) · [Structural and Functional Modularity of the U2 snRNP](https://pmc.ncbi.nlm.nih.gov/articles/PMC6934263/) · [Distributions of Exons and Introns in the Human Genome, *In Silico Biology*](https://journals.sagepub.com/doi/pdf/10.3233/ISB-00142) · [The guide-RNA sequence dictates slicing kinetics of Argonaute, *Mol Cell* 2024](https://www.sciencedirect.com/science/article/pii/S1097276524005331) · [Minimal mechanistic model of siRNA-dependent slicing by hAgo2, *PNAS*](https://www.pnas.org/doi/10.1073/pnas.1217838110)
# Lot 0 — Résultats des trois bancs

**Machine de mesure** : MacBook Pro M4 Max, GPU 32 cœurs, macOS. Chrome, WebGL 2, `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max)`. Tampon de dessin 3024 × 1502 (1512 × 751 CSS à DPR 2), soit 4,54 Mpx.
**Date** : 2026-07-31.
**Méthode** : temps GPU relevé par `EXT_disjoint_timer_query_webgl2`, 70 à 80 échantillons par état, rotation figée, quartiles rapportés.

---

## 0a — Contour

### Ce que la première mesure a failli faire croire

À 100 000 instances, la scène tenait 5 ms sur un budget d'image de 8,3 ms. **Le GPU sous-cadence quand il a de la marge**, et les écarts inférieurs à la milliseconde deviennent irrésolubles : les quartiles se chevauchaient, et la détection de bord ressortait à **−0,86 ms**, c'est-à-dire moins chère que ne rien dessiner du tout.

Une mesure qui produit un surcoût négatif ne se corrige pas par une moyenne plus longue : elle dit que la méthode est mauvaise. **Il faut saturer le GPU pour comparer quoi que ce soit.** Toutes les valeurs ci-dessous sont prises au-delà du budget d'image, à pleine horloge, avec des quartiles resserrés à quelques centièmes de milliseconde.

### Mesures

**200 000 instances** — le budget que retient la spec :

| Mode | q25 | médiane | q75 | images/s | Surcoût |
|---|---|---|---|---|---|
| Sans contour (référence) | 4,78 | **4,83** | 4,95 | 120 | — |
| Coque inversée, 3 px physiques | 9,32 | **9,41** | 9,52 | 98 | **+4,58 ms** |
| Détection de bord | 4,90 | **4,98** | 5,15 | 119 | **+0,15 ms** |

**400 000 instances** — pour vérifier comment chaque coût se comporte :

| Mode | q25 | médiane | q75 | images/s | Surcoût |
|---|---|---|---|---|---|
| Sans contour (référence) | 10,11 | **10,26** | 10,52 | 92 | — |
| Coque inversée, 3 px physiques | 20,26 | **20,32** | 20,38 | 48 | **+10,06 ms** |
| Détection de bord | 10,30 | **10,41** | 10,63 | 90 | **+0,15 ms** |

### La loi de coût, qui est le vrai résultat

**La coque inversée coûte exactement 100 % de la passe géométrique.** Elle redessine chaque instance une seconde fois : 4,58 ms sur 4,83 à 200 k, 10,06 ms sur 10,26 à 400 k. Son coût croît donc linéairement avec le nombre d'instances, et un seuil exprimé en millisecondes n'a de sens qu'adossé à une taille de scène.

**La détection de bord coûte 0,15 ms, quel que soit le nombre d'instances.** Elle ne dépend que de la résolution : une passe plein écran, quatre lectures de profondeur par pixel.

### Qualité de rendu, jugée à l'écran

Captures dans `bancs/resultats/`, amas masqué pour dégager les objets de test.

| Critère | Coque inversée | Détection de bord |
|---|---|---|
| Largeur constante du premier plan au fond | **oui** — vérifiée sur six sphères de même taille écran placées de 12 à 72 unités | **oui** par construction : la largeur est fixée en texels |
| Sépare douze instances d'une seule teinte qui se recouvrent | **oui** | **oui** |
| Largeur réglable en pixels | **oui** | non — un texel ; élargir demande plus de lectures |
| Cible de rendu nécessaire | non | oui, avec conversion colorimétrique explicite |

**Précision sur les témoins.** Les douze sphères de même teinte se recouvrent à l'écran sans s'interpénétrer dans l'espace — le cas réel d'un encombrement moléculaire, où les molécules se touchent mais ne se traversent pas. Une première version du banc les faisait s'interpénétrer profondément : dans ce cas la coque du fond est enfouie dans le corps de devant et aucune séparation n'apparaît. C'est une limite réelle de la technique, mais elle ne concerne pas la situation à représenter.

### Deux affirmations de la spec réfutées

1. **La détection de bord ne coûte pas la classe du SSAO.** La spec avançait ~5,6 ms par analogie avec le SSAO mesuré dans la recherche. Une passe de profondeur à quatre voisins coûte **0,15 ms**. Le chiffre du SSAO valait pour un effet bien plus lourd — échantillonnage en hémisphère et flou — pas pour une détection de silhouette.
2. **Les deux techniques donnent le contour intérieur entre instances de même teinte.** La critique de complétude affirmait qu'aucune ne le donnait, et que c'était rédhibitoire. C'est faux pour les deux.

### Verdict : **détection de bord retenue**

La règle de décision du plan retient la coque inversée si elle coûte 2 ms ou moins. **Elle en coûte 4,58 au budget d'instances de la spec**, et le double de tout ce qu'on ajoutera ensuite. La règle passe donc à son second cas : la détection de bord tient les mêmes critères de qualité pour 0,15 ms, indépendamment de la charge.

Conséquences à porter dans la spec :

- Le contour n'est plus un risque ouvert : §5.3 devient une technique retenue.
- La direction artistique « planche vivante » est confirmée, et la palette validée reste utilisable telle quelle — l'encodage secondaire dont elle dépend existe bien.
- Le budget d'image doit désormais compter une cible de rendu et une passe plein écran, avec conversion colorimétrique explicite. C'est un défaut rencontré en séance : sans elle, l'image finale est nettement assombrie.
- La coque inversée reste disponible pour un usage ponctuel sur un petit nombre d'objets mis en avant, où son coût est négligeable et sa largeur réglable en pixels est un avantage.

### Défaut de méthode à retenir pour les bancs suivants

Un seuil en millisecondes ne veut rien dire hors d'une charge donnée, et une mesure prise sous le budget d'image ne veut rien dire du tout. **Les bancs 0b et 0c mesurent au-delà du budget, ou pas du tout.**

---

## 0b — Dalle à densité vraie

Profondeur de dalle 300 nm, occupation 25 %, unité rendue = complexe reconnaissable de 2 750 nm³. La caméra est placée pour que l'arête remplisse toujours la hauteur du champ : on compare donc la même surface à l'écran, seule la finesse des objets change.

### Mesures sur ordinateur

| Arête | Instances | GPU | images/s | Porte bureau (≥ 55) |
|---|---|---|---|---|
| 300 nm | 2 454 | 0,73 ms | 120 | passée |
| 500 nm | 6 818 | 1,04 ms | 120 | passée |
| 700 nm | 13 363 | 1,87 ms | 120 | passée |
| 1 000 nm | 27 272 | 3,53 ms | 120 | passée |
| 1 500 nm | 61 363 | 2,20 ms | 120 | passée |
| 2 000 nm | 109 090 | 4,83 ms | 120 | passée |
| 3 000 nm | 245 454 | 7,02 ms | 120 | passée |
| 4 000 nm | 436 363 | 11,96 ms | 80 | passée |
| 6 000 nm | 981 818 | 30,15 ms | 32 | **échouée** |

**Arête retenue sur ordinateur : environ 4 900 nm**, par interpolation entre 4 000 et 6 000 nm. C'est plus de trois fois la borne haute de 1,5 µm que retenait la spec.

### La spec était trop prudente, et on sait maintenant pourquoi

La table D7 annonçait une arête tenable de 1,3 à 1,5 µm. Ce chiffre est juste — **pour un cube**. La boîte de vérité n'est pas un cube : c'est une dalle à profondeur bornée, et borner la profondeur est justement ce qui rend l'encombrement finançable, puisqu'au-delà de la première couche plus de 99 % des instances sont occultées.

À budget d'instances égal, une dalle de 300 nm de profondeur est environ deux fois plus large qu'un cube. Les deux calculs vivent désormais dans des fonctions distinctes et testées, et les tests reproduisent la table D7 à l'identique — elle devient auditable plutôt que déclarative.

### Un second résultat qui corrige l'échelle de dégradation

En divisant le nombre de pixels par trois — de 4,54 à 1,50 Mpx — le temps GPU passe de 11,96 à 10,45 ms à l'arête de 4 000 nm. **Presque rien.**

La scène est donc limitée par la **géométrie**, pas par le remplissage : les complexes ne font que quelques pixels à l'écran, et c'est le traitement des sommets qui domine. Le premier échelon de l'échelle de dégradation du §9.4 de la spec, qui réduit le ratio de pixels, serait donc quasiment sans effet ici. Le seul levier utile est le nombre d'instances, c'est-à-dire l'arête de la dalle.

Cela ne contredit pas la recherche, qui désignait le taux de remplissage comme plafond : c'était pour de grands halos additifs, un cas différent de celui-ci.

### Mesures sur téléphone : **écartées par décision, le 2026-07-31**

Elles demandent du matériel physique. L'émulation d'appareil du navigateur redimensionne la fenêtre et ralentit le processeur mais **ne simule pas le GPU**, et cette scène est limitée par le GPU. Une valeur extrapolée serait inventée.

Le mobile est donc sorti du périmètre plutôt que laissé en attente. Trois conséquences, portées dans la spec au §9.5 :

1. Aucun chiffre mobile du document n'est vérifié. La ligne mobile du budget est une division d'une seconde par trente, pas une mesure.
2. **La porte de livraison « ≥ 28 images/s sur iPhone » est retirée.** Une porte qu'on ne franchit jamais n'est pas une porte.
3. L'arête tenable sur téléphone reste inconnue. Les 4,9 µm valent pour un MacBook Pro M4 Max et pour lui seul.

Deux choses sont gardées, parce qu'elles ne coûtent rien et ne promettent rien : la gestion de `webglcontextlost`, déjà en place dans le harnais, et le protocole de mesure, prêt dans `mesure-mobile.md`. Le jour où le mobile revient au périmètre, c'est une dizaine de minutes.

**La porte 0b est donc close sur son volet ordinateur, qui était la question qui bloquait la conception.**

---

## 0c — Production d'une silhouette

### Productions réelles, chronométrées

| Molécule | Code | Carbones α | Chaînes | Poids | Source | Durée |
|---|---|---|---|---|---|---|
| Na⁺/K⁺-ATPase | 2ZXE | 1 296 | 3 | 15,2 Ko | PDB, 0,88 Mo | 0,9 s |
| Grande sous-unité ribosomique | 1FFK | 3 656 | 27 | 42,8 Ko | PDB, 5,10 Mo | 1,2 s |
| Ribosome humain 80S | 6EK0 | 11 725 | 76 | 137,4 Ko | mmCIF, 24,4 Mo | 2,5 s |
| Ribosome humain 80S | 4V6X | 13 338 | 84 | 156,3 Ko | mmCIF, 27,5 Mo | 2,6 s |

### Le mur que le plan n'avait pas vu

Le plan ne prévoyait que le format PDB. **Le ribosome eucaryote n'existe pas au format PDB** : au-delà de 99 999 atomes, une structure n'est publiée qu'en mmCIF. C'est également le cas du spliceosome et du pore nucléaire, soit les vedettes de trois des quatre lots.

Un lecteur mmCIF a donc été ajouté. Il n'est pas interchangeable avec le lecteur PDB : le mmCIF n'a pas de colonnes fixes, l'ordre des champs est déclaré par l'en-tête de la boucle `_atom_site.` et il faut le lire. C'est un coût ponctuel, désormais payé.

### Coût réel

Le temps machine est négligeable — une à trois secondes. **Le coût est humain** : identifier la bonne structure, et décider quelles chaînes garder. Pour la pompe Na⁺/K⁺, la spec demande d'omettre les sous-unités β et FXYD, soit deux des trois chaînes du fichier ; pour le ribosome, il y en a 76.

Estimation à environ **trois à cinq minutes par molécule** une fois le pipeline en place, dominées par ces deux décisions. Le site couvre de l'ordre de 35 familles moléculaires distinctes sur les quatre lots, soit **deux à trois heures de travail humain au total**.

### Réserve, qui doit figurer

Ce qui est mesuré va du code PDB au **nuage de points Cα normalisé**. Le passage du nuage à une **surface rendue** n'est pas mesuré.

Il n'est pas nécessaire aux bandes 1 et 2, où un complexe fait quelques pixels et se rend en sphères instanciées — c'est exactement ce que fait le banc 0b. Il l'est à la bande 3, où une seule molécule remplit l'écran et où il faut une vraie silhouette. Ce coût-là reste inconnu.

### Verdict : **tenable**

Deux à trois heures de production humaine ne justifient pas de réduire le nombre de familles. La crainte de la critique de complétude, qui voyait là « probablement le plus gros coût caché du projet », n'est pas confirmée pour la partie mesurée.

---

## Conséquences pour la spec

| Section | Changement |
|---|---|
| §3.4, bande 2 | L'arête de la boîte de vérité passe de « 0,3 – 1,5 µm » à **« jusqu'à 4 µm sur ordinateur »**. La valeur mobile reste à mesurer. |
| §5.3 | Le contour n'est plus un risque ouvert : **détection de bord retenue**. La coque inversée reste utilisable ponctuellement sur quelques objets mis en avant. |
| §9.2 | Ajouter que la dalle est limitée par la géométrie, pas par le remplissage. |
| §9.4 | Le premier échelon — réduction du ratio de pixels — est **presque sans effet** sur cette scène. Le levier est l'arête de la dalle. |
| §9.5 | Inchangé : aucun appareil mobile n'a été mesuré. |
| §14 | Ajouter deux pièges : `vertexColors: true` avec `setColorAt` rend tout noir sans erreur ; le ribosome, le spliceosome et le pore nucléaire n'existent qu'en mmCIF. |
| §16 | Retirer les portes 0a et 0c. La porte 0b reste ouverte pour sa moitié mobile. |

## Défauts de méthode à retenir

1. **Un seuil en millisecondes ne veut rien dire hors d'une charge donnée.** La porte 0a demandait « moins de 2 ms » sans dire à combien d'instances ; la coque inversée coûte 0,5 ms à 100 000 et 10 ms à 400 000.
2. **Une mesure prise sous le budget d'image ne veut rien dire du tout.** Le GPU sous-cadence, et un surcoût négatif en est le symptôme.
3. **Un banc qui mélange la charge et l'objet à juger ne permet ni l'un ni l'autre.** Il a fallu une bascule pour séparer les deux.

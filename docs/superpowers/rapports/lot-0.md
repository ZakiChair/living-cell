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

*À compléter — tâches 9 et 10.*

## 0c — Production d'une silhouette

*À compléter — tâche 11.*

# Tâche 10 — mesure sur téléphone réel

> **État : ÉCARTÉE le 2026-07-31.** Le mobile est sorti du périmètre du projet — voir §9.5 de la spec pour les trois conséquences, dont le retrait de la porte de livraison correspondante.
>
> Ce document reste en place parce que le protocole est prêt et le banc outillé : si le mobile revient au périmètre, la mesure prend une dizaine de minutes. Rien de ce qui suit n'est à faire aujourd'hui.

Elle demande du matériel physique, et c'était la seule mesure du lot 0 qui ne pouvait pas être automatisée.

Pourquoi elle ne peut pas être contournée : l'émulation d'appareil du navigateur redimensionne la fenêtre et ralentit le processeur, mais **ne simule pas le GPU**. Or le banc 0b est limité par la géométrie côté GPU. Une valeur extrapolée serait inventée, et la spec interdit explicitement d'en afficher une.

---

## Ce qu'il faut lancer

Depuis le dossier du projet, sur le Mac :

```bash
cd ~/Projects/cellule-vivante
npm run banc -- --port 5199
```

Puis, sur le téléphone connecté au **même réseau Wi-Fi**, ouvrir :

```
http://192.168.0.21:5199/bancs/0b-dalle.html?arete=1500&profondeur=300
```

Si l'adresse a changé, la retrouver par `ipconfig getifaddr en0`.

## Comment naviguer sur le téléphone

**Toucher la moitié gauche de l'écran** recule d'une arête, **la moitié droite** avance. Les arêtes disponibles sont 300, 500, 700, 1 000, 1 500, 2 000, 3 000, 4 000 et 6 000 nm. Chaque changement remet le chronomètre du palier à zéro.

Le panneau fait le travail de surveillance à ta place :

- `sur ce palier` — le temps écoulé depuis le dernier changement d'arête ;
- `à 1 min` — la cadence relevée automatiquement à la première minute ;
- `dérive depuis` — l'écart en pourcentage entre maintenant et cette première minute, c'est-à-dire le throttling thermique rendu visible ;
- `minimum` — la plus basse cadence vue sur le palier.

## Ce qu'il faut relever

Pour **chaque appareil** — au minimum un iPhone récent et un Android milieu de gamme :

1. **Le modèle exact et la version du système.**
2. Sur l'arête de 1 500 nm, laisser tourner **cinq minutes sans toucher à l'appareil**, puis noter `images/s`, `à 1 min` et `dérive depuis`. C'est la valeur à cinq minutes qui compte : une scène stable en une minute peut perdre 30 à 40 % ensuite.
3. **La plus grande arête qui garde au moins 28 images/s à cinq minutes.** Monter d'un palier, attendre, redescendre si la porte échoue.
4. **Si le panneau affiche « CONTEXTE WEBGL PERDU »**, le noter avec l'arête à laquelle c'est arrivé. C'est le mode de panne typique d'iOS par dépassement mémoire, et il doit figurer au rapport même s'il ne survient qu'une fois.

Garder l'écran allumé pendant les cinq minutes : une mise en veille suspend la boucle de rendu et fausse la mesure.

## Repères mesurés sur le Mac, pour comparaison

MacBook Pro M4 Max, Chrome, 4,54 Mpx, profondeur 300 nm, occupation 25 % :

| Arête | Instances | GPU | images/s |
|---|---|---|---|
| 1 000 nm | 27 272 | 3,53 ms | 120 |
| 1 500 nm | 61 363 | 2,20 ms | 120 |
| 2 000 nm | 109 090 | 4,83 ms | 120 |
| 3 000 nm | 245 454 | 7,02 ms | 120 |
| 4 000 nm | 436 363 | 11,96 ms | 80 |
| 6 000 nm | 981 818 | 30,15 ms | 32 |

**Ce qu'on ne sait pas** : le rapport de vitesse entre ce GPU et celui d'un téléphone. Les estimations qui circulent vont de 5 à 15 fois, et personne ne les a vérifiées sur cette scène. Si le rapport est de 8, l'arête tenable sur téléphone serait de l'ordre de 1 500 nm — mais c'est une extrapolation, pas une mesure, et elle ne doit pas entrer dans la spec avant d'avoir été confirmée.

**Ce qu'on sait** : la scène est limitée par la géométrie et non par le remplissage. Diviser le nombre de pixels par trois n'a fait passer le temps GPU que de 11,96 à 10,45 ms. Le réglage du ratio de pixels — premier échelon de dégradation de la spec — sera donc peu efficace sur téléphone. Le levier utile est l'arête de la dalle.

## Où porter le résultat

- `docs/superpowers/rapports/lot-0.md`, section 0b, colonnes mobiles.
- `docs/superpowers/specs/2026-07-30-cellule-vivante-design.md`, §9.5, en remplacement de « aucun appareil mobile n'a été mesuré ».

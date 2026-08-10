# Refonte réalisme — « toute la cellule en détail »

**Date** : 2026-08-10 · **Approche retenue** : A, « fermer la boucle d'abord » (validée par Zaki)

## Diagnostic (revue du 2026-08-10)

Le produit contient deux mondes découplés : une simulation à ~45 variables
(`systemeCellulaire.ts` : ATP/ADP, GHK, canal K-ATP Hill n=4, pools proinsuline→granules,
sécrétion Ca²⁺ Hill n=3) et 16 chorégraphies 3D qui n'importent jamais cet état. Le seul
pont est `activiteMecanisme()` : un scalaire qui module la vitesse d'une horloge par
mécanisme (`main.ts:915-922`). Conséquence : inversion systématique — ce qui est modélisé
n'est pas montré (force proton-motrice, K-ATP, granules, Ca²⁺), ce qui est montré n'est
pas modélisé (Post-Albers, spliceosome, hydrogel FG…).

Trois fils faux : `transport-moteur` piloté par `f.transportGolgi` (flux RE→Golgi, pas la
kinésine) ; `instabilite-dynamique` piloté par une lecture d'ATP sans flux ; comptes de
pores nucléaires contradictoires (`noyau.ts` 60 vs `poresNucleaires.ts` 48). Nœud central :
le capteur glucokinase est câblé sur le glucose EXTERNE (`systemeCellulaire.ts:509`), le
métabolisme simulé ne porte pas le signal.

Morphologie : cellule générique de 20 µm sans aucun objet spécifique bêta — pas de granule
d'insuline (réel : ~10 000, 10 % du volume), mitochondries en 6 haricots isolés (réel :
réseau, 4-8 % du volume), RER sous-dimensionné.

## Invariants à préserver

- Le contrat d'honnêteté : `ellision` obligatoire (testée), badge temporel dérivé
  (`MecanismeBrut` rend l'écriture manuelle non compilable), harnais `periode.ts` qui
  mesure les scènes livrées, dossier de relecture généré.
- Les tests existants (~200 unitaires) restent verts à chaque lot ; `npm test` inclut tsc.
- Style visuel (Okabe-Ito, échelles vraies déclarées, plan de coupe unique).
- Chaque constante nouvelle est sourcée avec confiance [A]/[B].

## Architecture du couplage (Lot 0)

`Mecanisme.animer(temps)` devient `animer(temps, contexte)` où `Contexte` est un objet
typé en LECTURE SEULE dérivé de `SystemeCellulaire` (jamais le système lui-même) :
concentrations normalisées, potentiel de membrane, Ca²⁺, Δp, comptes de pools. Les scènes
restent des fonctions pures (temps, contexte) → géométrie ; l'écriture dans l'état reste
l'exclusivité des EDO. `activiteMecanisme()` survit comme modulation d'horloge mais les
scènes peuvent maintenant changer de COMPORTEMENT (rotor plus lent si Δp bas, SNARE
déclenchés par Ca²⁺, granules dont le compte suit `e.insulineGranules`).

## Les cinq lots

### Lot 0 — Le pont
1. `Contexte` typé + signature `animer(temps, contexte)` (rétro-compatible : contexte
   optionnel au début du chantier, obligatoire à la fin du lot).
2. Réparer les trois fils faux (transport-moteur → flux propre, instabilité → flux
   tubuline/état, un seul compte de pores partagé via contrat).
3. Nœud glucokinase : le signal ATP/ADP dérive du métabolisme simulé (glycolyse +
   respiration portent la marge nécessaire), plus du glucose externe.
4. Corps de bêta : granules d'insuline (cœur dense + halo, pool visible suivant
   `e.insulineGranules`), réseau mitochondrial (fusion des capsules en réseau tubulaire),
   RER développé. Diamètre : conservé à 20 µm AVEC ellision déclarée (une bêta réelle fait
   10-13 µm) — le rescaling global est trop invasif pour son gain.
   → vérifier : tests anatomie + nouveaux tests granules/réseau, gate navigateur.

### Lot 1 — La vie d'une protéine (le phare)
Chaîne causale continue INS → insuline sécrétée, chaque étape lisant les pools réels :
1. SRP/peptide signal : reconnaissance, pause de traduction, accostage Sec61, clivage
   par la peptidase du signal (complète `translocation-sec61`).
2. Repliement dans le RE : BiP, PDI, formation des TROIS ponts disulfure de la
   proinsuline ; échec → `proteinesMalRepliees`.
3. Golgi : transport COPII (vésicule RE→cis), glycosylation figurée, tri trans.
4. Maturation du granule : PC1/3 et PC2 + carboxypeptidase E, excision du peptide C
   visible, cristallisation insuline-Zn (cœur dense + halo).
5. Sécrétion régulée : glucose → ATP/ADP → fermeture K-ATP → dépolarisation → entrée
   Ca²⁺ → synaptotagmine → fusion SNARE d'un GRANULE (plus une vésicule anonyme).
   → vérifier : la chaîne complète se déroule quand le glucose monte, s'arrête quand il
   descend ; périodes mesurées par le harnais ; ellisions déclarées par scène.

### Lot 2 — Réplication + mitose
1. Fourche de réplication : hélicase MCM, primase, pol δ/ε, brin continu vs fragments
   d'Okazaki + ligase, topoisomérase en amont. Sur le gène INS existant.
2. Mitose : condensation (condensine), fuseau depuis les deux centrosomes,
   kinétochores, métaphase→anaphase (séparase/cohésine), cytocinèse par anneau d'actomyosine.
3. Ellision d'identité : « la bêta adulte se divise ~0,5 %/an ; montré car universel ».
   → vérifier : périodes (fourche ~50 nt/s eucaryote), anatomie (fuseau dans la cellule),
   comptes de chromosomes cohérents avec ce que la scène peut porter (déclaré).

### Lot 3 — Profondeur métabolique
1. Glycolyse : glucokinase (capteur, S0.5 ~8 mM, pas d'inhibition produit) en poste
   d'entrée, régulation PFK-1 (ATP/AMP/F-2,6-BP) figurée.
2. Krebs : anaplérose — pyruvate carboxylase (~40 % du pyruvate en bêta), sortie citrate.
3. Chaîne : ubiquinone et cytochrome c en transporteurs visibles, rotor piloté par Δp
   du modèle, c-ring 8c/3 ATP.
4. Membrane : canal K-ATP réel (Kir6.2/SUR1) remplaçant le canal générique, leviers
   sulfonylurée (ferme) et diazoxide (ouvre) dans l'atelier.
   → vérifier : les leviers pharmacologiques produisent les effets attendus DANS le modèle
   (sulfonylurée ⇒ sécrétion sans glucose ; diazoxide ⇒ silence malgré glucose), tests EDO.

### Lot 4 — Le destin
1. UPR : capteurs IRE1 (épissage XBP1), PERK (pause traduction via eIF2α), ATF6 ;
   pilotés par `proteinesMalRepliees`/`stressRE` existants.
2. ERAD : rétrotranslocation → ubiquitine → protéasome (branche la scène existante).
3. Autophagie : phagophore → autophagosome (LC3) → fusion lysosome ; mitophagie.
4. Apoptose : Bax/Bak, libération cytochrome c, apoptosome, caspase 3 — le `destin`
   du modèle cesse d'être un label.
   → vérifier : stress RE soutenu déclenche UPR puis apoptose dans le modèle ET à l'écran ;
   tests de seuils.

## Hors périmètre (dette déclarée, pas oubliée)

Épissage alternatif/NMD, incrétines/GLP-1/AMPc, couplage îlot (connexine 36), voies de
signalisation (PI3K, mTOR, AMPK), actine dynamique/myosine du transport terminal,
sécrétion biphasique, structures PDB dans les scènes (pipeline existant non branché).
Chaque omission pertinente rejoint l'`ellision` de la scène concernée.

## Critères de succès globaux

- 0/16 → les scènes lisent l'état : rotor, pompe, SNARE, granules, K-ATP au minimum.
- La sécrétion d'insuline est une histoire continue visible, du gène au milieu externe.
- `npm test` vert à chaque commit ; dossier de relecture régénéré à chaque lot.
- Gate navigateur (capture + fps) à la fin de chaque lot visuel.

# Cellule bêta intégrée — plan d’implémentation

## Goal

Construire une cellule beta pancreatique humaine interactive, scientifiquement coherente et lisible, qui relie la stimulation par le glucose a la secretion d'insuline, a sa reconstitution biosynthetique, au stress cellulaire et a une comparaison laboratoire temoin-traite.

## Architecture

`EtatCellule` demeure le contrat central et compatible. `src/noyau/systemeCellulaire.ts` porte les variables biologiques, les flux, les seuils et le pas de simulation. `src/cellule/laboratoire.ts` orchestre les protocoles, les instances temoin-traite et leurs mesures comparatives. Les modules de scene, vie, atelier et panneau affichent des projections en lecture seule de l'etat. Les animations biologiques sont pilotees par activite ; la foule decorative reste isolee du modele.

## Tech stack

- TypeScript pour le modele, les orchestration et les interfaces.
- Moteur de rendu et scene deja presents dans l'application pour les projections visuelles.
- HTML existant pour les zones de laboratoire, controles et panneaux.
- Scripts npm existants pour la future execution de qualite, sans les lancer dans cette session.

## Global constraints

- Preserver la compatibilite additive de `EtatCellule` et les comportements existants.
- Garder les equations qualitatives, bornees, deterministes et explicables.
- Ne jamais confondre decor narratif et indicateur biologique.
- Documenter les simplifications et ne pas presenter le modele comme un outil medical.
- Ne pas executer de tests, de build, de lint, de verification manuelle ou de commande git dans cette session.
- Toute validation ulterieure necessitera une autorisation explicite.

## Taches

- [ ] **Lot 0 - Verite biologique et contrat d'etat.**
  - Fichiers : `src/noyau/systemeCellulaire.ts`, `docs/relecture-scientifique.md`.
  - Interfaces : etendre `EtatCellule` avec les stocks normalises, indicateurs de flux, etats de stress, destin cellulaire et metadonnees de seuil ; definir les invariants glucose, ATP, KATP, Vm, Ca, insuline, INS, ARN, RE, Golgi, granules, ROS et autophagie.
  - Resultat : un vocabulaire unique, des bornes et des simplifications biologiques documentees avant toute projection graphique.

- [ ] **Lot 1 - Stocks et flux.**
  - Fichiers : `src/noyau/systemeCellulaire.ts`, `src/cellule/vie.ts`, `src/cellule/atelier/panneau.ts`.
  - Interfaces : ajouter un pas de simulation qui calcule entrees, consommations, productions, transferts et pertes ; exposer une vue de bilan pour les panneaux.
  - Resultat : chaque stock affiche son niveau et ses flux attribuables, sans valeur negative ni creation implicite de ressource.

- [ ] **Lot 2 - Boucle glucose-ATP-KATP-Vm-Ca-insuline.**
  - Fichiers : `src/noyau/systemeCellulaire.ts`, `src/cellule/vie.ts`, `src/cellule/scene.ts`, `src/cellule/atelier/panneau.ts`, `cellule.html`.
  - Interfaces : introduire les calculateurs de metabolisme du glucose, rapport ATP/ADP, ouverture KATP, potentiel membranaire, entree calcique et exocytose ; relier leurs indicateurs a la membrane, aux canaux, aux granules et au panneau.
  - Resultat : la scene visualise une chaine causale complete et la secretion depend de Ca ainsi que du stock de granules.

- [ ] **Lot 3 - Cycle INS-ARN-RE-Golgi-granules.**
  - Fichiers : `src/noyau/systemeCellulaire.ts`, `src/cellule/vie.ts`, `src/cellule/scene.ts`, `src/cellule/atelier/panneau.ts`, `cellule.html`.
  - Interfaces : ajouter les etapes de transcription INS, ARN, production RE, maturation Golgi et formation de granules, avec files de transit et rendements explicites.
  - Resultat : la capacite de secretion se reconstitue dans le temps et les organites rendent visible le transit proteique.

- [ ] **Lot 4 - ROS, stress du RE, autophagie et destin.**
  - Fichiers : `src/noyau/systemeCellulaire.ts`, `src/cellule/vie.ts`, `src/cellule/scene.ts`, `src/cellule/atelier/panneau.ts`, `docs/relecture-scientifique.md`.
  - Interfaces : ajouter les calculateurs ROS, charge et stress du RE, recyclage autophagique, penalites de rendement et transitions de destin cellulaire ; publier des causes lisibles dans la vue de bilan.
  - Resultat : les surcharges ont des consequences visibles et reversibles dans les plages prevues, ou conduisent a une defaillance explicable au-dela des seuils.

- [ ] **Lot 5 - Laboratoire temoin-traite, integration et controles.**
  - Fichiers : `src/cellule/laboratoire.ts`, `main.ts`, `src/noyau/atelier.ts`, `src/cellule/vie.ts`, `src/cellule/atelier/panneau.ts`, `cellule.html`, `index.html`, `src/cellule/scene.ts`, `package.json`, `docs/relecture-scientifique.md`.
  - Interfaces : fournir un protocole reproductible, deux instances `EtatCellule`, une configuration de traitement ciblee et une sortie comparative synchronisee des trajectoires et ecarts.
  - Resultat : l'utilisateur peut lancer, observer et comparer temoin et traite sans que le traitement modifie silencieusement les hypotheses du modele ; les controles, les scenes, la foule decorative et la documentation restent raccordes aux interfaces publiques existantes.

## Validation ulterieure

Aucune commande de validation ni action git ne fait partie de ce plan d'execution immediat. Les tests, le build, le lint et la verification visuelle devront faire l'objet d'une autorisation explicite avant leur lancement.

# Cellule beta integree - specification de conception

## Decision de produit

La cellule representee est une cellule beta pancreatique humaine, integree dans un environnement de laboratoire vivant. Elle doit rendre intelligible, a l'echelle d'une scene interactive, le lien causal entre le glucose extracellulaire, la production d'ATP, l'excitabilite membranaire, l'entree de calcium et la secretion d'insuline. La fidelite recherchee est mecanistique et pedagogique : les processus doivent etre scientifiquement coherents sans pretendre simuler une cellule complete au niveau quantitatif clinique.

## Perimetre fonctionnel

Le systeme est organise en six lots dependants, dans cet ordre :

0. **Verite biologique et invariants.** Formaliser les variables, leurs unites de representation, les etats limites, les relations causales et les simplifications assumees. Le modele ne doit jamais produire de secretion d'insuline sans signal calcique, ni de hausse durable d'ATP sans apport de glucose ou reserve explicitement modelisee.
1. **Stocks et flux.** Representer les stocks de glucose, ATP, calcium, insuline, precurseurs proteiques, granules, ROS et ressources de recyclage, avec des flux bornes et visibles. Chaque variation doit etre attribuable a une source et a une destination.
2. **Boucle glucose -> ATP -> KATP -> Vm -> Ca -> insuline.** Implementer la boucle de stimulation-secretion : l'entree et le metabolisme du glucose augmentent le rapport ATP/ADP, ferment les canaux KATP, depolarisent Vm, ouvrent les canaux calciques, augmentent Ca et declenchent l'exocytose des granules d'insuline disponibles.
3. **Cycle INS -> ARN -> RE -> Golgi -> granules.** Modeliser la reconstitution de la capacite secretoire : demande ou baisse des reserves stimule l'expression INS, suivie de la production d'ARN, traduction et maturation dans le reticulum endoplasmique, transit par le Golgi et formation de granules matures.
4. **ROS, stress du RE, autophagie et destin cellulaire.** Ajouter les effets de charge metabolique et proteique : ROS et stress du RE perturbent les rendements, l'autophagie recycle une partie des composants endommages et le destin cellulaire evolue entre homeostasie, adaptation, stress et defaillance selon des seuils explicites.
5. **Laboratoire temoin-traite.** Proposer une comparaison synchronisee entre une cellule temoin et une cellule traitee. Les deux partagent le meme protocole de base, mais le traitement modifie des parametres identifies et compare les trajectoires, stocks et indicateurs biologiques.

## Architecture cible

L'architecture doit rester compatible avec `EtatCellule` existant. Les nouvelles donnees sont ajoutees de facon additive, avec valeurs par defaut deterministes et sans casser les consommateurs actuels. L'etat logique reste la source unique de verite ; les scenes, panneaux et animations lisent des projections de cet etat et n'ecrivent pas directement les stocks biologiques.

Le moteur cellulaire expose des pas de simulation et des actions de protocole. Le laboratoire compose une ou deux instances d'etat et applique des interventions parametrees. Les couches de scene transforment les indicateurs en signes visuels, tandis que les panneaux fournissent une lecture chiffre et explicable des mecanismes.

## Principes de rendu

Le rendu est pilote par l'activite biologique : intensite des organites, trafic vesiculaire, mouvements membranaires, etat des canaux, densite de granules, signaux de stress et secretion doivent decouler de mesures ou de seuils issus de l'etat. Une activite plus forte doit etre perceptible sans que la scene devienne illisible.

La foule, les personnages et les elements narratifs decoratifs sont une couche separee. Ils peuvent renforcer l'ambiance du laboratoire, mais ne constituent pas une preuve d'activite cellulaire et ne doivent ni modifier les equations ni servir d'indicateur principal d'un stock ou d'un flux.

## Limites assumees

- Le modele est qualitatif et parametrique, non un simulateur pharmacocinetique ou electrophysiologique valide pour la decision medicale.
- Les concentrations absolues, cinetiques moleculaires fines et heterogeneite intercellulaire sont simplifiees en variables normalisees et seuils documentes.
- La regulation par incretines, systeme nerveux, cellules voisines, vascularisation et immunite est hors perimetre, sauf extension explicite ulterieure.
- Le traitement du lot 5 est une intervention de simulation reproductible ; il ne represente pas une recommandation therapeutique.

## Criteres d'acceptation

- Les six lots sont implementes dans l'ordre causal et peuvent etre observes depuis l'interface.
- Un apport de glucose declenche une trajectoire coherente ATP, KATP, Vm, Ca puis secretion, si des granules sont disponibles.
- L'absence de glucose ou l'epuisement des granules empeche une secretion artificielle et reste visible dans les indicateurs.
- Le cycle INS, ARN, RE, Golgi et granules reconstitue progressivement la reserve apres secretion, avec les retards attendus par le modele.
- ROS et stress du RE degradent explicitement l'efficacite ; l'autophagie produit un effet de recyclage borne et le destin cellulaire est explicable par les seuils atteints.
- Le laboratoire affiche cote a cote un temoin et un traite, avec parametres, differences de trajectoire et lecture des causes.
- Les mises a jour de `EtatCellule` restent compatibles avec les appels existants et toute representation visuelle derive de l'etat logique.
- Les elements decoratifs restent independants du calcul cellulaire.

## Validation ulterieure

La validation comportementale, scientifique et d'integration n'est pas executee dans cette session. Elle necessitera une autorisation explicite avant toute execution de tests, de build ou de verification manuelle.

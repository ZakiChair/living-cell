import { poserLesBadges, type Mecanisme } from './contrat.js'
import { mettreAEchelleReelle } from './echelleReelle.js'
import { creerRespiration } from './respiration.js'
import { creerTraductionReticulum } from './traductionReticulum.js'
import { creerTranscription } from './transcription.js'
import { creerEpissage } from './epissage.js'
import { creerExportNucleaire } from './exportNucleaire.js'
import { creerEndoExocytose } from './endoExocytose.js'
import { creerTransportMoteur } from './transportMoteur.js'
import { creerPompeSodiumPotassium } from './pompeSodiumPotassium.js'
import { creerProteasome } from './proteasome.js'
import { creerGlycolyse } from './glycolyse.js'
import { creerKrebs } from './krebs.js'
import { creerBetaOxydation } from './betaOxydation.js'
import { creerFermentation } from './fermentation.js'
import { creerRepliementRE } from './repliementRE.js'
import { creerTransitGolgi } from './transitGolgi.js'
import { creerMaturationGranule } from './maturationGranule.js'
import { creerReplicationAdn } from './replicationAdn.js'
import { creerMitose } from './mitose.js'

/**
 * Tous les mécanismes de la cellule.
 *
 * L'ordre décide de celui du panneau, et il raconte deux histoires.
 *
 * D'abord l'ÉNERGIE, parce que tout le reste en dépend, et dans l'ordre où le
 * carbone la traverse : le glucose est coupé dans le cytosol, son pyruvate
 * choisit entre l'oxygène et la fermentation, les acides gras entrent par une
 * autre porte, tout converge sur le cycle de Krebs qui ne produit presque pas
 * d'ATP mais des transporteurs d'électrons, et ceux-ci finissent sur la chaîne
 * respiratoire qui fournit les neuf dixièmes du total.
 *
 * Ensuite l'INFORMATION, dans le sens où elle circule : transcrire, épisser,
 * exporter, traduire. Puis ce qui bouge la matière : transporter, faire entrer
 * et sortir, pomper. Et pour finir, détruire — la moitié oubliée de la vie
 * d'une protéine.
 */
export function creerMecanismes(): Mecanisme[] {
  // Tout passe par la remise à l'échelle réelle : plusieurs modules ont été
  // construits agrandis, et c'est ce qui les faisait ressembler à des planches
  // de manuel posées dans le cytoplasme plutôt qu'à la cellule elle-même.
  // Les badges sont POSÉS ici, depuis le facteur numérique de chaque
  // mécanisme : aucun module ne rédige plus « ralenti » ou « accéléré », donc
  // aucun ne peut se tromper de sens.
  return poserLesBadges(
    mettreAEchelleReelle([
    // Énergie
    ...creerGlycolyse(),
    ...creerFermentation(),
    ...creerBetaOxydation(),
    ...creerKrebs(),
    ...creerRespiration(),
    // Information — d'abord copier le livre, puis le lire
    ...creerReplicationAdn(),
    ...creerMitose(),
    ...creerTranscription(),
    ...creerEpissage(),
    ...creerExportNucleaire(),
    ...creerTraductionReticulum(),
    ...creerRepliementRE(),
    ...creerTransitGolgi(),
    ...creerMaturationGranule(),
    // Matière
    ...creerTransportMoteur(),
    ...creerEndoExocytose(),
    ...creerPompeSodiumPotassium(),
      ...creerProteasome(),
    ]),
  )
}

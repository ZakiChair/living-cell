/**
 * Mesure du temps d'image et décision de dégradation.
 *
 * Le throttling thermique étant réel — une scène stable une minute peut perdre
 * 30 à 40 % après dix minutes — la mesure est continue, pas un test unique au
 * chargement. L'hystérésis empêche le niveau de qualité d'osciller.
 */

export type Verdict = 'degrader' | 'stable' | 'ameliorer'

export interface Compteur {
  ajouter(ms: number): void
  moyenne(): number
  imagesParSeconde(): number
  verdict(): Verdict
  nombreEchantillons(): number
}

export interface OptionsCompteur {
  /** Nombre d'images gardées dans la fenêtre glissante. */
  taille?: number
  /** Au-dessus de cette moyenne en millisecondes, on dégrade. */
  seuilHaut?: number
  /** En dessous de cette moyenne, on peut remonter d'un cran. */
  seuilBas?: number
  /** Nombre d'images consécutives sous le seuil bas avant de remonter. */
  patience?: number
}

export function creerCompteur(options: OptionsCompteur = {}): Compteur {
  const taille = options.taille ?? 60
  const seuilHaut = options.seuilHaut ?? 20
  const seuilBas = options.seuilBas ?? 12
  const patience = options.patience ?? 120

  const fenetre = new Float64Array(taille)
  let curseur = 0
  let remplissage = 0
  let somme = 0
  let imagesCalmes = 0

  return {
    ajouter(ms: number): void {
      if (remplissage === taille) somme -= fenetre[curseur]!
      else remplissage++
      fenetre[curseur] = ms
      somme += ms
      curseur = (curseur + 1) % taille

      if (ms < seuilBas) imagesCalmes++
      else imagesCalmes = 0
    },

    moyenne(): number {
      return remplissage === 0 ? 0 : somme / remplissage
    },

    imagesParSeconde(): number {
      const m = remplissage === 0 ? 0 : somme / remplissage
      return m === 0 ? 0 : 1000 / m
    },

    nombreEchantillons(): number {
      return remplissage
    },

    verdict(): Verdict {
      // Tant que la fenêtre n'est pas pleine, la moyenne n'est pas représentative.
      if (remplissage < taille) return 'stable'
      const m = somme / remplissage
      if (m > seuilHaut) return 'degrader'
      if (m < seuilBas && imagesCalmes >= patience) return 'ameliorer'
      return 'stable'
    },
  }
}

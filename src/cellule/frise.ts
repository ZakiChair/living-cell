import type { Mecanisme } from './mecanismes/contrat.js'

/**
 * La frise des horloges : toutes les échelles de temps du site, sur un axe.
 *
 * La doctrine du site tient en une phrase — « couper n'est pas ralentir » —
 * et chaque mécanisme la porte dans son badge. Mais les badges se lisent un
 * par un ; la frise les pose ENSEMBLE sur un axe logarithmique, du tour de
 * rotor (huit millisecondes) à la mitose (une heure) : six ordres de
 * grandeur, et c'est exactement pourquoi aucune horloge commune n'existe.
 * Chaque point est cliquable et emmène à sa scène.
 */

export interface PointFrise {
  cle: string
  nom: string
  facteur: string
  /** Durée réelle du cycle observé, en secondes. */
  cycleReel: number
  /** Position sur l'axe logarithmique, de 0 (le plus bref) à 1 (le plus long). */
  x: number
}

/** Durée lisible : « 8 ms », « 360 ms », « 45 s », « 20 min », « 1 h ». */
export function formaterDuree(secondes: number): string {
  // `toPrecision` bascule en notation scientifique dès trois chiffres :
  // 360 ms devenait « 3,6e+2 ms ». Deux chiffres significatifs sous dix,
  // l'entier au-delà.
  const compact = (v: number): string =>
    v < 10 ? v.toPrecision(2).replace(/\.0$/, '').replace('.', ',') : String(Math.round(v))
  if (secondes < 1) return `${compact(secondes * 1000)} ms`
  if (secondes < 60) return `${compact(secondes)} s`
  if (secondes < 3600) return `${Math.round(secondes / 60)} min`
  return `${compact(secondes / 3600)} h`
}

/**
 * Les points de la frise, triés du cycle le plus bref au plus long.
 * Seuls les mécanismes qui déclarent un observable y figurent : la frise ne
 * porte que des durées MESURÉES par le harnais, jamais des estimations.
 */
export function pointsDeFrise(
  mecanismes: ReadonlyArray<Pick<Mecanisme, 'cle' | 'nom' | 'facteur' | 'observable'>>,
): PointFrise[] {
  const mesurables = mecanismes
    .filter((m) => m.observable && Number.isFinite(m.observable.cycleReel) && m.observable.cycleReel > 0)
    .map((m) => ({
      cle: m.cle,
      nom: m.nom,
      facteur: m.facteur,
      cycleReel: m.observable!.cycleReel,
    }))
    .sort((a, b) => a.cycleReel - b.cycleReel)

  if (mesurables.length === 0) return []
  const minLog = Math.log10(mesurables[0]!.cycleReel)
  const maxLog = Math.log10(mesurables[mesurables.length - 1]!.cycleReel)
  const etendue = Math.max(1e-9, maxLog - minLog)
  return mesurables.map((m) => ({
    ...m,
    x: (Math.log10(m.cycleReel) - minLog) / etendue,
  }))
}

/** Graduations décennales couvrant l'étendue des points, avec leur position. */
export function graduations(points: PointFrise[]): Array<{ etiquette: string; x: number }> {
  if (points.length === 0) return []
  const minLog = Math.log10(points[0]!.cycleReel)
  const maxLog = Math.log10(points[points.length - 1]!.cycleReel)
  const etendue = Math.max(1e-9, maxLog - minLog)
  const sorties: Array<{ etiquette: string; x: number }> = []
  for (let d = Math.ceil(minLog); d <= Math.floor(maxLog); d++) {
    sorties.push({ etiquette: formaterDuree(Math.pow(10, d)), x: (d - minLog) / etendue })
  }
  return sorties
}

export function creerFrise(
  mecanismes: ReadonlyArray<Mecanisme>,
  surChoix: (cle: string) => void,
): { bouton: HTMLButtonElement; panneau: HTMLElement } {
  const points = pointsDeFrise(mecanismes)

  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.id = 'frise-declencheur'
  bouton.className = 'laboratoire-declencheur'
  bouton.textContent = 'Horloges'
  bouton.setAttribute('aria-expanded', 'false')
  bouton.setAttribute('aria-controls', 'frise-horloges')

  const panneau = document.createElement('aside')
  panneau.id = 'frise-horloges'
  panneau.className = 'frise-horloges'
  panneau.hidden = true
  panneau.setAttribute('aria-label', 'Frise des échelles de temps')

  const lignes = points
    .map(
      (p) => `
    <li>
      <button type="button" class="frise-entree" data-cle="${p.cle}">
        <span class="frise-nom">${p.nom}</span>
        <span class="frise-piste"><span class="frise-point" style="left:${(p.x * 100).toFixed(1)}%"></span></span>
        <span class="frise-duree">${formaterDuree(p.cycleReel)} <em>${p.facteur}</em></span>
      </button>
    </li>`,
    )
    .join('')
  const ticks = graduations(points)
    .map(
      (g) =>
        `<span class="frise-tick" style="left:${(g.x * 100).toFixed(1)}%">${g.etiquette}</span>`,
    )
    .join('')

  panneau.innerHTML = `
    <header><div><p class="laboratoire-surtitre">ÉCHELLES DE TEMPS</p><h2>La frise des horloges</h2></div><button type="button" class="frise-fermer" aria-label="Fermer la frise">Fermer</button></header>
    <p class="laboratoire-note">Un cycle de rotor dure huit millisecondes, une mitose une heure : six ordres de
    grandeur séparent les mécanismes de cette cellule, et c'est pourquoi aucune horloge commune
    n'existe — chaque scène déclare son facteur, et « couper n'est pas ralentir ». Chaque durée
    ci-dessous est MESURÉE sur la scène livrée par le harnais de période. Cliquez pour y aller.</p>
    <div class="frise-axe" aria-hidden="true">${ticks}</div>
    <ul class="frise-liste">${lignes}</ul>`

  const style = document.createElement('style')
  style.textContent = `
    .frise-horloges{position:fixed;z-index:30;top:1rem;right:1rem;width:min(34rem,calc(100vw - 2rem));max-height:calc(100vh - 2rem);overflow:auto;box-sizing:border-box;padding:1.2rem;border:1px solid #cbd8df;border-radius:1rem;background:#fffaf0;color:#182433;box-shadow:0 1.25rem 3.5rem #18243333;font:400 .9rem/1.45 system-ui}
    .frise-horloges header{display:flex;align-items:center;justify-content:space-between;gap:.75rem}
    .frise-horloges h2{margin:0;font-size:1.2rem}
    .frise-fermer{border:1px solid #9eafb9;border-radius:.45rem;background:#fffef9;color:#182433;padding:.45rem .55rem;font:inherit;cursor:pointer}
    .frise-axe{position:relative;height:1.4rem;margin:0.9rem 0 .2rem;border-bottom:1px solid #9eafb9}
    .frise-tick{position:absolute;bottom:0;transform:translateX(-50%);font-size:.68rem;color:#44515c;padding-bottom:.15rem;border-left:1px solid #cbd8df;padding-left:.2rem}
    .frise-liste{list-style:none;margin:.4rem 0 0;padding:0;display:grid;gap:.15rem}
    .frise-entree{display:grid;grid-template-columns:11.5rem 1fr 7.5rem;align-items:center;gap:.6rem;width:100%;border:0;background:none;color:inherit;padding:.28rem .2rem;font:inherit;cursor:pointer;border-radius:.4rem;text-align:left}
    .frise-entree:hover,.frise-entree:focus-visible{background:#e9f4f8}
    .frise-nom{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem}
    .frise-piste{position:relative;height:.5rem;border-radius:999px;background:#eef0e9}
    .frise-point{position:absolute;top:50%;transform:translate(-50%,-50%);width:.62rem;height:.62rem;border-radius:999px;background:#0072b2}
    .frise-duree{font-size:.78rem;font-weight:700;text-align:right}
    .frise-duree em{font-style:normal;font-weight:400;color:#44515c}
    @media(max-width:900px){.frise-horloges{inset:auto 0 0 0;width:100%;max-height:82vh;border-radius:1rem 1rem 0 0}.frise-entree{grid-template-columns:1fr;gap:.15rem}.frise-piste{order:3}.frise-axe{display:none}}
  `
  document.head.append(style)

  bouton.addEventListener('click', () => {
    panneau.hidden = !panneau.hidden
    bouton.setAttribute('aria-expanded', String(!panneau.hidden))
  })
  panneau.querySelector('.frise-fermer')?.addEventListener('click', () => bouton.click())
  document.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Escape' && !panneau.hidden) bouton.click()
  })
  for (const entree of panneau.querySelectorAll<HTMLButtonElement>('.frise-entree')) {
    entree.addEventListener('click', () => {
      const cle = entree.dataset.cle
      if (!cle) return
      if (!panneau.hidden) bouton.click()
      surChoix(cle)
    })
  }

  return { bouton, panneau }
}

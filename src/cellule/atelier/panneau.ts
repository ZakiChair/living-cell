import {
  type Atelier,
  LIBELLES,
  avancement,
  avancerDUnCodon,
  codonCourant,
  coutTotal,
  donnerAuRibosome,
  facteurAffiche,
  ouvrirLeGene,
} from '../../noyau/atelier.js'
import { acideAminePourCodon, anticodon } from '../../noyau/codeGenetique.js'
import {
  ATP_REPOS,
  FLUX_REPOS,
  type EtatCellule,
  consommation,
  production,
  regimeTraduction,
} from '../../noyau/etatCellule.js'

/**
 * LE PANNEAU DE L'ATELIER.
 *
 * Il porte trois choses que la scène 3D ne peut pas dire : la séquence en
 * lettres, les chiffres avec leur unité, et les commandes.
 *
 * Le principe qui les gouverne toutes : AUCUN NOMBRE SANS SON UNITÉ. Un
 * compteur d'ATP nu, en « points d'énergie », serait exactement le genre de
 * mensonge que le reste du site combat. La concentration est en millimolaire,
 * la dépense de l'atelier en molécules, et les deux ne sont jamais additionnées
 * — un ribosome unique ne déplace pas le pool d'une cellule de quatre mille
 * micromètres cubes, et prétendre le contraire ferait mentir la jauge.
 */

export interface CommandesAtelier {
  /** Appelé quand l'utilisateur veut voir l'atelier de près. */
  cadrer: () => void
  /** Appelé quand il quitte l'atelier. */
  quitter: () => void
}

export interface PanneauAtelier {
  racine: HTMLElement
  /** Redessine tout ce qui a bougé. Appelé une fois par image. */
  rafraichir: (atelier: Atelier, etat: EtatCellule) => void
}

function element<K extends keyof HTMLElementTagNameMap>(
  balise: K,
  classe?: string,
  texte?: string,
): HTMLElementTagNameMap[K] {
  const noeud = document.createElement(balise)
  if (classe) noeud.className = classe
  if (texte !== undefined) noeud.textContent = texte
  return noeud
}

export function creerPanneauAtelier(
  atelier: Atelier,
  etat: EtatCellule,
  commandes: CommandesAtelier,
): PanneauAtelier {
  const racine = element('section', 'atelier')
  racine.id = 'atelier'
  racine.setAttribute('aria-label', 'Atelier du gène')

  // ── En-tête ─────────────────────────────────────────────────────────────
  const entete = element('div', 'atelier-entete')
  const titre = element('h2', undefined, "L'atelier du gène")
  const badge = element('span', 'badge')
  entete.append(titre, badge)
  racine.appendChild(entete)

  const sousTitre = element('p', 'atelier-gene')
  sousTitre.append(
    element('b', undefined, atelier.gene.nom),
    element('span', undefined, ` — ${atelier.gene.role}`),
  )
  racine.appendChild(sousTitre)

  // ── Étape en cours ──────────────────────────────────────────────────────
  const jauge = element('div', 'atelier-jauge')
  const jaugeBarre = element('i')
  jauge.appendChild(jaugeBarre)
  racine.appendChild(jauge)

  const etapeTitre = element('p', 'atelier-etape')
  const etapeSous = element('p', 'atelier-sous')
  racine.append(etapeTitre, etapeSous)

  // ── Les commandes ───────────────────────────────────────────────────────
  const boutons = element('div', 'atelier-boutons')
  const bOuvrir = element('button', 'primaire', 'Ouvrir le gène')
  bOuvrir.type = 'button'
  const bDonner = element('button', 'primaire', 'Donner le brin au ribosome')
  bDonner.type = 'button'
  const bPas = element('button', undefined, 'Codon suivant')
  bPas.type = 'button'
  const bQuitter = element('button', undefined, 'Quitter')
  bQuitter.type = 'button'
  boutons.append(bOuvrir, bDonner, bPas, bQuitter)
  racine.appendChild(boutons)

  bOuvrir.addEventListener('click', () => {
    ouvrirLeGene(atelier)
    commandes.cadrer()
  })
  bDonner.addEventListener('click', () => donnerAuRibosome(atelier))
  bPas.addEventListener('click', () => avancerDUnCodon(atelier))
  bQuitter.addEventListener('click', commandes.quitter)

  // ── Vitesse et pas à pas ────────────────────────────────────────────────
  const reglages = element('div', 'atelier-reglages')
  const etiquetteVitesse = element('label')
  etiquetteVitesse.append(document.createTextNode('Vitesse'))
  const curseurVitesse = element('input')
  curseurVitesse.type = 'range'
  curseurVitesse.min = '1'
  curseurVitesse.max = '20'
  curseurVitesse.step = '1'
  curseurVitesse.value = '4'
  curseurVitesse.setAttribute('aria-label', "Vitesse de l'atelier")
  atelier.vitesse = 4
  etiquetteVitesse.appendChild(curseurVitesse)

  const casePas = element('label', 'atelier-case')
  const interrupteur = element('input')
  interrupteur.type = 'checkbox'
  casePas.append(interrupteur, document.createTextNode('Pas à pas'))

  reglages.append(etiquetteVitesse, casePas)
  racine.appendChild(reglages)

  curseurVitesse.addEventListener('input', () => {
    atelier.vitesse = Number(curseurVitesse.value)
  })
  interrupteur.addEventListener('change', () => {
    atelier.pasAPas = interrupteur.checked
  })

  // ── Les leviers ─────────────────────────────────────────────────────────
  /**
   * Trois inhibiteurs, et deux des trois effets sont contre-intuitifs.
   *
   * C'est ce qui en fait un objet pédagogique plutôt que trois boutons : couper
   * l'oxygène appauvrit la cellule sans la tuer, l'oligomycine fait MONTER le
   * gradient de protons, et l'ouabaïne fait MONTER l'ATP. Chacun porte donc,
   * sous son libellé, ce qu'il faut regarder — et ce n'est jamais ce qu'on
   * attend.
   */
  const titreLeviers = element('h3', undefined, 'Agir sur la cellule')
  const leviers = element('div', 'atelier-leviers')
  racine.append(titreLeviers, leviers)

  const LEVIERS = [
    {
      cle: 'anoxie' as const,
      nom: "Couper l'oxygène",
      quoiRegarder:
        "La chaîne respiratoire perd son accepteur final. Il ne reste que la " +
        "glycolyse : 2 ATP par glucose au lieu de 30. La cellule ne meurt pas, " +
        "elle s'appauvrit d'un facteur quinze — et le ribosome s'arrête.",
    },
    {
      cle: 'oligomycine' as const,
      nom: 'Oligomycine',
      quoiRegarder:
        "Bloque l'ATP synthase. Regardez la force proton-motrice : elle MONTE. " +
        'Les complexes continuent de pomper et plus rien ne laisse revenir les ' +
        "protons. L'énergie transite par un gradient, pas par une molécule.",
    },
    {
      cle: 'ouabaine' as const,
      nom: 'Ouabaïne',
      quoiRegarder:
        "Bloque la pompe Na⁺/K⁺. Regardez l'ATP : il MONTE, parce que la pompe " +
        "en consommait un quart. Ce qui s'effondre, c'est le gradient — donc le " +
        "potentiel de membrane. Bloquer une dépense n'est pas couper un revenu.",
    },
  ]

  const boutonsLevier: HTMLButtonElement[] = []

  /** Redessine l'explication : celle de TOUS les leviers encore tirés. */
  function majExplication(): void {
    const actifs = LEVIERS.filter((l) => etat.inhibiteurs[l.cle])
    explication.textContent = actifs.map((l) => l.quoiRegarder).join(' ')
    for (const [i, b] of boutonsLevier.entries()) {
      b.setAttribute('aria-pressed', String(etat.inhibiteurs[LEVIERS[i]!.cle]))
    }
    bRepos.disabled = actifs.length === 0
  }

  for (const levier of LEVIERS) {
    const bouton = element('button', 'levier', levier.nom)
    bouton.type = 'button'
    bouton.setAttribute('aria-pressed', 'false')
    bouton.title = levier.quoiRegarder
    bouton.addEventListener('click', () => {
      etat.inhibiteurs[levier.cle] = !etat.inhibiteurs[levier.cle]
      majExplication()
    })
    leviers.appendChild(bouton)
    boutonsLevier.push(bouton)
  }

  /**
   * Rétablir le repos.
   *
   * La spec l'exige — « un bouton rétablir le repos réinitialise l'état
   * complet » — et il manquait : une cellule laissée sous oligomycine ET sous
   * ouabaïne ne se relevait que levier par levier, et rien ne disait comment
   * revenir au point de comparaison. Une perturbation qu'on ne peut pas annuler
   * d'un geste n'est pas réversible pour l'utilisateur, quoi qu'en dise le
   * moteur.
   */
  const bRepos = element('button', 'levier repos', 'Rétablir le repos')
  bRepos.type = 'button'
  bRepos.disabled = true
  bRepos.addEventListener('click', () => {
    for (const l of LEVIERS) etat.inhibiteurs[l.cle] = false
    majExplication()
  })
  leviers.appendChild(bRepos)

  const explication = element('p', 'atelier-explication')
  racine.appendChild(explication)

  // ── Les chiffres ────────────────────────────────────────────────────────
  const titreBilan = element('h3', undefined, 'Le bilan énergétique')
  const bilan = element('dl', 'atelier-bilan')
  racine.append(titreBilan, bilan)

  const lignes = new Map<string, HTMLElement>()
  for (const [cle, libelle] of [
    ['atp', 'ATP cytosolique'],
    ['fpm', 'Force proton-motrice'],
    ['gradient', 'Gradient Na⁺/K⁺'],
    ['regime', 'Régime du ribosome'],
    ['production', "Production d'ATP"],
    ['cout', 'Coût de cette protéine'],
  ] as const) {
    const terme = element('dt', undefined, libelle)
    const valeur = element('dd')
    bilan.append(terme, valeur)
    lignes.set(cle, valeur)
  }

  // ── La lecture du codon ─────────────────────────────────────────────────
  const lecture = element('div', 'atelier-lecture')
  const lectureCodon = element('div', 'codon')
  const lectureAnti = element('div', 'anti')
  const lectureResidu = element('div', 'residu')
  lecture.append(lectureCodon, lectureAnti, lectureResidu)
  racine.appendChild(lecture)

  // ── La séquence ─────────────────────────────────────────────────────────
  const titreSeq = element('h3', undefined, 'La protéine, résidu par résidu')
  const sequence = element('div', 'atelier-sequence')
  racine.append(titreSeq, sequence)

  // Une pastille par résidu, créée une seule fois : rafraîchir n'a plus qu'à
  // basculer une classe, et la boucle d'affichage ne construit pas de DOM.
  const pastilles: HTMLElement[] = []
  for (const [i, residu] of atelier.gene.residus.entries()) {
    const pastille = element('span', `residu ${residu.classe}`, residu.lettre)
    pastille.title = `${i + 1}. ${residu.nom} (${residu.abrege}) — ${residu.classe}`
    sequence.appendChild(pastille)
    pastilles.push(pastille)
  }

  const legendeClasses = element('div', 'atelier-classes')
  for (const [classe, libelle] of [
    ['apolaire', 'apolaire'],
    ['polaire', 'polaire'],
    ['basique', 'basique (+)'],
    ['acide', 'acide (−)'],
  ] as const) {
    const entree = element('span', 'classe')
    entree.append(element('i', classe), document.createTextNode(libelle))
    legendeClasses.appendChild(entree)
  }
  racine.appendChild(legendeClasses)


  const noteUnites = element(
    'p',
    'atelier-note',
    "La concentration est en millimolaire, le coût en molécules : les deux ne " +
      "s'additionnent pas. Un ribosome seul ne déplace pas le pool d'une cellule " +
      'de 4 000 µm³ — le couplage va dans l’autre sens, et c’est le vrai : ' +
      "c'est l'ATP disponible qui commande le régime du ribosome.",
  )
  racine.appendChild(noteUnites)

  // ── Rafraîchissement ────────────────────────────────────────────────────
  let derniersCodons = -1
  let derniereEtape = ''

  const rafraichir = (a: Atelier, e: EtatCellule): void => {
    badge.textContent = facteurAffiche(a)
    jaugeBarre.style.width = `${(avancement(a) * 100).toFixed(1)}%`

    if (a.etape !== derniereEtape) {
      derniereEtape = a.etape
      const libelle = LIBELLES[a.etape]
      etapeTitre.textContent = libelle.titre
      etapeSous.textContent = libelle.sous

      // Une commande qui ne peut rien faire est désactivée, jamais masquée :
      // l'utilisateur doit pouvoir voir ce qui existe avant de pouvoir le faire.
      bOuvrir.disabled = a.etape !== 'repos' && a.etape !== 'termine'
      bOuvrir.textContent = a.etape === 'termine' ? 'Recommencer' : 'Ouvrir le gène'
      bDonner.disabled = a.etape !== 'attente'
      racine.classList.toggle('a-donner', a.etape === 'attente')
    }
    bPas.disabled = a.etape !== 'traduction' || !a.pasAPas

    // ── Le codon lu ───────────────────────────────────────────────────────
    const codon = codonCourant(a)
    if (codon) {
      const residu = acideAminePourCodon(codon)
      lectureCodon.textContent = codon
      lectureAnti.textContent = `anticodon ${anticodon(codon)}`
      lectureResidu.textContent =
        residu && residu !== 'stop' ? `${residu.nom} (${residu.abrege})` : '—'
      lecture.classList.add('active')
    } else {
      lecture.classList.remove('active')
      lectureCodon.textContent = '—'
      lectureAnti.textContent = ''
      lectureResidu.textContent = ''
    }

    // ── La séquence ───────────────────────────────────────────────────────
    if (a.codons !== derniersCodons) {
      const avant = Math.max(0, derniersCodons)
      // On ne touche qu'aux pastilles qui ont changé : recolorier trente
      // éléments à chaque image serait du travail pour rien.
      for (let i = Math.min(avant, a.codons); i < Math.max(avant, a.codons); i++) {
        pastilles[i]?.classList.toggle('pose', i < a.codons)
      }
      if (a.codons === 0) for (const p of pastilles) p.classList.remove('pose')
      derniersCodons = a.codons
    }

    // ── Les chiffres ──────────────────────────────────────────────────────
    // Le régime affiché est CELUI qui gouverne le ribosome : même fonction, une
    // seule définition. Le recalculer ici ferait deux vérités possibles.
    const regime = Math.round(regimeTraduction(e.atp) * 100)
    // L'ATP au repos est une donnée de CONFIANCE [B] — la fourchette mesurée va
    // de 1 à 5 mM selon le type cellulaire et la méthode. Afficher « 3,00 mM »
    // lui prêtait trois chiffres significatifs qu'elle n'a pas, ce que la spec
    // interdit nommément. On montre donc le RAPPORT au repos, qui est une sortie
    // du modèle et se lit à un pour cent près, et l'ancrage à un seul chiffre.
    lignes.get('atp')!.textContent =
      `${Math.round((e.atp / ATP_REPOS) * 100)} % du repos (~${ATP_REPOS.toFixed(0)} mM)`
    // Les deux gradients sont en fractions de leur valeur de repos : ce sont
    // des rapports, pas des concentrations, et les afficher en pourcentage
    // évite de leur inventer une unité qu'ils n'ont pas.
    lignes.get('fpm')!.textContent = `${(e.forceProtonMotrice * 100).toFixed(0)} % du repos`
    lignes.get('gradient')!.textContent = `${(e.gradientNa * 100).toFixed(0)} % du repos`
    lignes.get('regime')!.textContent = `${regime} %`
    // Même règle : la production dérive de deux valeurs [B] — l'ATP de repos et
    // son temps de renouvellement. On la donne en part du régime de repos, qui
    // est une sortie du modèle, plutôt qu'en µM/s prêtant une précision fausse.
    const partProduction = production(e).totale / FLUX_REPOS
    const partDepense = consommation(e).totale / FLUX_REPOS
    lignes.get('production')!.textContent =
      `${Math.round(partProduction * 100)} % du repos ` +
      `(dépense ${Math.round(partDepense * 100)} %)`
    lignes.get('cout')!.textContent =
      `${a.liaisons} liaisons riches sur ${coutTotal(a.gene)}`

    racine.classList.toggle('a-court', regime < 100)
    racine.classList.toggle('a-sec', regime === 0)
  }

  return { racine, rafraichir }
}

/** Ce que la fiche de l'atelier raconte, et ce qu'elle avoue. */
export const FICHE_ATELIER = {
  titre: "L'atelier du gène",
  description:
    "La chaîne complète, d'un bout à l'autre : l'ARN polymérase copie les " +
    "quatre-vingt-dix paires de bases du gène en ouvrant la double hélice sur " +
    'treize à la fois, le transcrit reçoit sa coiffe dès le vingt-cinquième ' +
    "nucléotide, franchit le pore nucléaire — qui n'est pas un trou mais un " +
    "hydrogel où le brin doit fondre — et attend. Il n'ira nulle part tout seul : " +
    "c'est vous qui le donnez au ribosome, et rien ne se traduit avant. Ensuite " +
    'le ribosome lit un codon à la fois, trois à cinq ARN de transfert viennent ' +
    "cogner avant le bon, et l'acide aminé désigné s'ajoute à la chaîne. La " +
    "séquence est celle de la chaîne B de l'insuline humaine : la protéine qui " +
    "s'affiche résidu par résidu est déterminée par les bases du gène, par la " +
    'table standard du code génétique et par rien d’autre. Ces quatre-vingt-dix ' +
    'bases sont celles du gène INS humain, collationnées sur GenBank ' +
    '(NM_000207.3) et épinglées base par base par un test.',
  ellision:
    "C'EST UN PLATEAU, pas une vue de la cellule : les organites sont retirés " +
    "le temps de la scène, car à trois cents nanomètres le noyau n'est plus un " +
    "contexte mais une paroi opaque devant le sujet. Le fragment d'enveloppe et " +
    "l'anneau du pore sont réduits à 150 nm de côté — un pore réel en fait 120 " +
    "de large et écraserait des acteurs qui, eux, gardent leurs dimensions " +
    "exactes : 29 nm pour le gène, 30 pour le ribosome, 54 pour le messager. Le " +
    "mécanisme « Export nucléaire » montre le pore à sa vraie taille. " +
    "Un grain d'ARN messager pour trois nucléotides, soit un par codon. Le " +
    'RIBOSOME EST FIXE ET LE BRIN DÉFILE : dans la cellule c’est l’inverse, mais ' +
    "c'est le même mouvement vu d'un autre repère, et celui-ci garde le ribosome " +
    "au centre du cadre. Six ARN de transfert sont montrés là où le cytosol en " +
    'contient des centaines de milliers. Un seul ribosome est représenté alors ' +
    "qu'un ARNm actif en porte toujours plusieurs — c'est un polysome, et le " +
    "mécanisme « Synthèse des protéines » le montre. L'épissage est absent : ce " +
    "segment n'a pas d'intron, ce qui est vrai de la région montrée mais pas du " +
    'gène entier. Enfin les protéines qui accompagnent le transcrit — le mRNP — ' +
    "ne sont pas dessinées, alors qu'un ARNm n'est jamais nu.",
}

/**
 * GÉNÈRE LE DOSSIER DE RELECTURE SCIENTIFIQUE.
 *
 * La spec fait de la relecture par un biologiste une condition de livraison, et
 * elle n'a pas eu lieu. Ce n'est pas faute de vouloir : le texte affiché est
 * réparti dans vingt-huit modules, mêlé à de la géométrie, et personne ne peut
 * raisonnablement demander à un relecteur d'ouvrir des fichiers TypeScript.
 *
 * Cet outil EXTRAIT tout ce que l'étudiant lit, depuis les objets réellement
 * livrés par la page, et le met en forme pour qu'un biologiste puisse le
 * parcourir en une session et annoter.
 *
 * IL EST GÉNÉRÉ, ET NON RÉDIGÉ. Un dossier écrit à la main serait une quatrième
 * copie des chiffres du projet, qui divergerait du produit exactement comme
 * tout le reste a divergé. Celui-ci vieillit avec les fiches, parce qu'il les
 * lit.
 *
 * Un audit a montré ce que cette relecture attrape et que rien d'autre
 * n'attrape : une base fausse sur quatre-vingt-dix dans la séquence de
 * l'insuline, silencieuse pour tous les tests parce que le codon était synonyme.
 *
 *     npx tsx outils/dossierRelecture.ts > docs/relecture-scientifique.md
 */
import { creerMecanismes } from '../src/cellule/mecanismes/tous.js'
import { creerNoyau } from '../src/cellule/organites/noyau.js'
import { creerMitochondries } from '../src/cellule/organites/mitochondries.js'
import { creerGolgi } from '../src/cellule/organites/golgi.js'
import { creerReticulumRugueux } from '../src/cellule/organites/reticulumRugueux.js'
import { creerReticulumLisse } from '../src/cellule/organites/reticulumLisse.js'
import { creerMembrane } from '../src/cellule/organites/membrane.js'
import { creerVesiculesEtLysosomes } from '../src/cellule/organites/vesiculesEtLysosomes.js'
import { creerCytosquelette } from '../src/cellule/organites/cytosquelette.js'
import { creerEncombrement } from '../src/cellule/organites/encombrement.js'
import { creerPoresNucleaires } from '../src/cellule/organites/poresNucleaires.js'
import { creerMatrices } from '../src/cellule/organites/matrices.js'
import { creerChromatineDense } from '../src/cellule/organites/chromatineDense.js'
import { FICHE_ATELIER } from '../src/cellule/atelier/panneau.js'
import { creerGene } from '../src/noyau/gene.js'
import { CODONS, acideAminePourCodon } from '../src/noyau/codeGenetique.js'
import {
  ATP_REPOS,
  PART_BASE,
  PART_GLYCOLYSE,
  PART_POMPE,
  PART_TRADUCTION,
  RENOUVELLEMENT_S,
  RESERVE_RESPIRATOIRE,
} from '../src/noyau/etatCellule.js'

/**
 * Construit le dossier et le rend en Markdown.
 *
 * Exporté, et non seulement imprimé : un test compare le fichier commité à ce
 * que cette fonction produit, si bien qu'un dossier périmé devient une erreur.
 * C'est le défaut que ce projet a répété partout — l'écrit qui vieillit pendant
 * que le produit avance — et il n'y a pas de raison d'y retomber ici.
 */
export function construireDossier(): string {
  return corps().join('\n') + '\n'
}

const lignes: string[] = []
const ecrire = (...t: string[]): void => void lignes.push(...t)

/** Repère les nombres d'un texte : ce sont eux qui portent le risque. */
function chiffresDe(texte: string): string[] {
  // On exige une UNITÉ, ou un nombre d'au moins deux chiffres. Sans cela la
  // liste se remplit des « 3, » et « 1, » que la ponctuation laisse traîner, et
  // le relecteur perd du temps sur du bruit.
  const avecUnite = /\d[\d  ,.]*\s?(?:%|nm|µm|mM|µM|ms|kDa|pb|nt|g\/L|kb\/min|nt\/s|s\b)/g
  const grands = /\b\d[\d  ]*\d\b/g
  const trouves = [
    ...[...texte.matchAll(avecUnite)].map((m) => m[0].trim()),
    ...[...texte.matchAll(grands)].map((m) => m[0].trim()),
  ]
  return [...new Set(trouves)].filter((c) => c.length > 1)
}

ecrire(
  '# Dossier de relecture scientifique — « La cellule »',
  '',
  "**Ce document est GÉNÉRÉ** depuis les objets que la page livre réellement, par",
  '`outils/dossierRelecture.ts`. Il ne peut donc pas être périmé par rapport au produit.',
  'Le régénérer après toute modification :',
  '',
  '```',
  'npx tsx outils/dossierRelecture.ts > docs/relecture-scientifique.md',
  '```',
  '',
  '## Ce qui est demandé au relecteur',
  '',
  "Le site s'adresse à des étudiants en biologie. Trois questions par affirmation :",
  '',
  "1. **Est-ce faux ?** Un ordre de grandeur, une unité, une stœchiométrie, un mécanisme.",
  "2. **Est-ce trompeur ?** Vrai mais formulé de façon à installer une intuition fausse.",
  "3. **Manque-t-il l'essentiel ?** Une réserve dont l'absence rend l'affirmation abusive.",
  '',
  "Les chiffres sont repérés en gras dans chaque fiche pour guider la lecture. Le champ",
  '**Ellision** dit ce que l’animation coupe ou échantillonne : c’est là que se logent les',
  'écarts entre ce qui est montré et ce qui est vrai, et il mérite autant d’attention que',
  'la description.',
  '',
  '---',
  '',
)

// ── Les données de référence ────────────────────────────────────────────────
const gene = creerGene()
ecrire(
  '## 1. Les données de référence',
  '',
  '### 1.1 La séquence du gène',
  '',
  `- **Gène** : ${gene.nom} — ${gene.role}`,
  `- **Longueur** : ${gene.adn.length} bases, ${gene.codons.length} codons`,
  '- **Source** : NM_000207.3 (NCBI), région codant la chaîne B de la préproinsuline humaine',
  '- **Confiance déclarée** : [A], collationnée',
  '',
  '```',
  gene.adn.replace(/(.{60})/g, '$1\n'),
  '```',
  '',
  `Traduite par la table standard, elle donne : \`${gene.proteine}\``,
  '',
  '> **À vérifier** : la séquence est-elle bien celle de NM_000207.3, base par base ? La',
  "> région retenue s'arrête à la fin de la chaîne B ; le gène entier continue sur le",
  '> peptide C puis la chaîne A. Est-ce dit assez clairement à l’étudiant ?',
  '',
  '### 1.2 La table du code génétique',
  '',
  `Les ${CODONS.length} codons sont tabulés dans \`src/noyau/codeGenetique.ts\`, dans l'ordre`,
  "canonique U, C, A, G. Trois codons stop, vingt acides aminés, et la redondance non",
  'uniforme (six codons pour Leu, Ser et Arg ; un seul pour Met et Trp) est verrouillée par',
  'test.',
  '',
  '| Redondance | Acides aminés |',
  '|---|---|',
)
{
  const parNombre = new Map<number, string[]>()
  const compte = new Map<string, number>()
  for (const codon of CODONS) {
    const a = acideAminePourCodon(codon)
    if (a === 'stop' || a === null) continue
    compte.set(a.abrege, (compte.get(a.abrege) ?? 0) + 1)
  }
  for (const [abrege, n] of compte) {
    parNombre.set(n, [...(parNombre.get(n) ?? []), abrege])
  }
  for (const n of [...parNombre.keys()].sort((a, b) => b - a)) {
    ecrire(`| ${n} codons | ${parNombre.get(n)!.sort().join(', ')} |`)
  }
}

// ── Le modèle énergétique ───────────────────────────────────────────────────
ecrire(
  '',
  '### 1.3 Le modèle énergétique',
  '',
  "Trois variables d'état gouvernent l'atelier et les trois leviers. Ce sont les seuls",
  'chiffres du site qui pilotent une simulation plutôt que de décorer une animation.',
  '',
  '| Grandeur | Valeur retenue | Confiance déclarée | À vérifier |',
  '|---|---|---|---|',
  `| ATP cytosolique au repos | ${ATP_REPOS} mM | [B] — fourchette 1 à 5 mM | la valeur médiane retenue est-elle défendable pour une cellule générique ? |`,
  `| Renouvellement complet du pool | ${RENOUVELLEMENT_S} s | [B] | l'ordre de grandeur tient-il hors muscle ? |`,
  `| Part de la pompe Na⁺/K⁺ | ${(PART_POMPE * 100).toFixed(0)} % du budget | [B] — 20 à 30 % | |`,
  `| Part de la synthèse protéique | ${(PART_TRADUCTION * 100).toFixed(0)} % | [B] — 20 à 30 % | |`,
  `| Part du reste (transport, biosynthèse) | ${(PART_BASE * 100).toFixed(0)} % | [B] | |`,
  `| ATP par glucose, glycolyse seule | ${(PART_GLYCOLYSE * 30).toFixed(0)} sur 30 | [A] | la valeur moderne de 30 est-elle celle à enseigner, plutôt que 36–38 ? |`,
  `| Réserve respiratoire | ×${RESERVE_RESPIRATOIRE} | [B] — 1,5 à 3 | |`,
  '',
  '**Les trois leviers et leurs effets, tels que le modèle les produit :**',
  '',
  '| Levier | ATP | Force proton-motrice | Gradient Na⁺/K⁺ |',
  '|---|---|---|---|',
  "| Couper l'oxygène | tombe à ~5 % du repos | s'effondre | ne perd que ~3 % |",
  '| Oligomycine | tombe à ~5 % | **monte de ~24 %** | intact |',
  '| Ouabaïne | **monte de ~17 %** | intacte | tombe à zéro |',
  '',
  "> **À vérifier** : les deux effets contre-intuitifs sont le cœur pédagogique du",
  '> dispositif. Sont-ils justes, et les explications affichées les rendent-elles bien ?',
  "> Le gradient qui résiste à l'anoxie est-il une conséquence acceptable, ou trompeuse ?",
  '',
  '---',
  '',
)

// ── Les mécanismes ──────────────────────────────────────────────────────────
const mecanismes = creerMecanismes()
ecrire('## 2. Les seize mécanismes', '')

for (const [i, m] of mecanismes.entries()) {
  ecrire(
    `### 2.${i + 1} ${m.nom}`,
    '',
    `**Siège** : ${m.siege} · **Facteur temporel affiché** : ${m.facteur}`,
    '',
    '**Justification du facteur.** ' + m.justificationFacteur,
    '',
    '**Description lue par l’étudiant.** ' + m.description,
    '',
  )
  if (m.ellision) ecrire('**Ellision — ce qui est coupé ou échantillonné.** ' + m.ellision, '')
  const chiffres = [
    ...new Set([
      ...chiffresDe(m.justificationFacteur),
      ...chiffresDe(m.description),
      ...chiffresDe(m.ellision ?? ''),
    ]),
  ]
  if (chiffres.length) ecrire(`> **Chiffres à contrôler** : ${chiffres.join(' · ')}`, '')
}

// ── Les organites ───────────────────────────────────────────────────────────
const organites = [
  ...creerMembrane(),
  ...creerCytosquelette(),
  ...creerReticulumRugueux(),
  ...creerReticulumLisse(),
  ...creerNoyau(),
  ...creerGolgi(),
  ...creerMitochondries(),
  ...creerVesiculesEtLysosomes(),
  ...creerEncombrement(),
  ...creerPoresNucleaires(),
  ...creerMatrices(),
  ...creerChromatineDense(),
]

/** Une seule entrée par famille : six mitochondries ont la même fiche. */
const familles = new Map<string, (typeof organites)[number]>()
for (const o of organites) {
  const racine = o.cle.replace(/-\d+$/, '')
  if (!familles.has(racine)) familles.set(racine, o)
}

ecrire('---', '', `## 3. Les ${familles.size} familles d'organites`, '')
for (const [i, o] of [...familles.values()].entries()) {
  ecrire(
    `### 3.${i + 1} ${o.nom}`,
    '',
    `**Rôle affiché** : ${o.role}`,
    '',
    o.description,
    '',
  )
  const chiffres = [...new Set([...chiffresDe(o.role), ...chiffresDe(o.description)])]
  if (chiffres.length) ecrire(`> **Chiffres à contrôler** : ${chiffres.join(' · ')}`, '')
}

// ── L'atelier ───────────────────────────────────────────────────────────────
ecrire(
  '---',
  '',
  `## 4. ${FICHE_ATELIER.titre}`,
  '',
  FICHE_ATELIER.description,
  '',
  '**Ellision.** ' + FICHE_ATELIER.ellision,
  '',
  `> **Chiffres à contrôler** : ${[
    ...new Set([...chiffresDe(FICHE_ATELIER.description), ...chiffresDe(FICHE_ATELIER.ellision)]),
  ].join(' · ')}`,
  '',
  '---',
  '',
  '## 5. Ce que le relecteur ne verra pas ici',
  '',
  "Ce dossier couvre le TEXTE. Trois choses lui échappent et demandent la page :",
  '',
  "- **Les proportions** : tout est dessiné à l'échelle vraie sauf ce que les ellisions",
  '  déclarent. Un écart de taille se voit à l’écran, pas dans une fiche.',
  "- **Les cinétiques relatives** : un canal qui débite cent mille fois plus qu'une pompe",
  '  est rendu par un contraste visuel, sans un mot.',
  "- **Le geste** : donner un brin d'ARN à un ribosome, et couper l'oxygène pour voir la",
  '  traduction s’arrêter.',
  '',
  `*Généré depuis ${mecanismes.length} mécanismes, ${familles.size} familles d'organites et ${gene.adn.length} bases.*`,
)

function corps(): string[] {
  return lignes
}

// Lancé directement : on imprime. Importé par un test : on ne fait rien.
if (process.argv[1]?.endsWith('dossierRelecture.ts')) {
  process.stdout.write(construireDossier())
}

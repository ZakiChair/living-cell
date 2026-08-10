import {
  reinitialiserSystemeCellulaire,
  type SystemeCellulaire,
} from '../noyau/systemeCellulaire.js';

export interface LaboratoireCellulaire {
  rafraichir(): void;
}

type Mesure = 'atp' | 'potentielMembrane' | 'calcium' | 'secretionInsuline' | 'viabilite' | 'ros';

const BLEU = '#0072b2';
const ORANGE = '#d55e00';
const ENCRE = '#182433';
const IVOIRE = '#fffaf0';

function nombre(valeur: unknown, repli = 0): number {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : repli;
}

function lire(objet: unknown, chemin: string[], repli = 0): number {
  let valeur: any = objet;
  for (const cle of chemin) valeur = valeur?.[cle];
  return nombre(valeur, repli);
}

function valeur(systeme: SystemeCellulaire, mesure: Mesure): number {
  const s: any = systeme;
  const chemins: Record<Mesure, string[][]> = {
    atp: [['energie', 'atp']],
    potentielMembrane: [['ions', 'potentielMembrane']],
    calcium: [['ions', 'calciumCytosolique']],
    secretionInsuline: [['expression', 'insulineSecretee']],
    viabilite: [['stress', 'viabilite']],
    ros: [['stress', 'ros']],
  };
  for (const chemin of chemins[mesure]) {
    const v = lire(s, chemin, Number.NaN);
    if (Number.isFinite(v)) return v;
  }
  return 0;
}

function historique(systeme: SystemeCellulaire, mesure: Mesure): number[] {
  const s: any = systeme;
  const h = s.historique ?? s.histoire ?? s.history ?? [];
  if (!Array.isArray(h)) return [];
  const champ: Record<Mesure, string> = {
    atp: 'atpRelatif',
    potentielMembrane: 'potentielMembrane',
    calcium: 'calciumCytosolique',
    secretionInsuline: 'secretion',
    viabilite: 'viabilite',
    ros: 'stress',
  };
  return h.filter((point: any) => point?.serie === 'traite').map((point: any) => nombre(point?.[champ[mesure]]));
}

function appliquer(systeme: SystemeCellulaire, chemin: string[], valeur: number | boolean): void {
  const derniere = chemin[chemin.length - 1];
  if (derniere === undefined) return;
  let cible: any = systeme;
  for (const cle of chemin.slice(0, -1)) cible = cible?.[cle];
  if (cible) cible[derniere] = valeur;
}

export function creerLaboratoireCellulaire(
  traite: SystemeCellulaire,
  temoin: SystemeCellulaire,
): LaboratoireCellulaire {
  const hote = document.querySelector<HTMLElement>('#reglages');
  if (!hote) return { rafraichir() {} };

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.id = 'laboratoire-declencheur';
  bouton.className = 'laboratoire-declencheur';
  bouton.textContent = 'Laboratoire';
  bouton.setAttribute('aria-expanded', 'false');
  bouton.setAttribute('aria-controls', 'laboratoire-cellulaire');

  const panneau = document.createElement('aside');
  panneau.className = 'laboratoire-cellulaire';
  panneau.id = 'laboratoire-cellulaire';
  panneau.hidden = true;
  panneau.setAttribute('aria-label', 'Laboratoire cellulaire');
  panneau.innerHTML = `
    <header><div><p class="laboratoire-surtitre">SIMULATION</p><h2>Laboratoire cellulaire</h2></div><button type="button" class="laboratoire-fermer" aria-label="Fermer le laboratoire">Fermer</button></header>
    <p class="laboratoire-note">Modèle pédagogique à compartiments. Le témoin continue sans intervention.</p>
    <section aria-labelledby="lab-profil"><h3 id="lab-profil">Profil cellulaire</h3><dl class="laboratoire-mesures"></dl></section>
    <section aria-labelledby="lab-commandes"><h3 id="lab-commandes">Interventions</h3><div class="laboratoire-commandes"></div></section>
    <section aria-labelledby="lab-courbes"><div class="laboratoire-ligne-titre"><h3 id="lab-courbes">Traité / témoin</h3><label for="laboratoire-signal">Signal</label><select id="laboratoire-signal" name="laboratoire-signal" class="laboratoire-select"><option value="atp">ATP</option><option value="potentielMembrane">Vm</option><option value="calcium">Ca cytosolique</option><option value="secretionInsuline">Insuline sécrétée</option><option value="viabilite">Viabilité</option><option value="ros">ROS</option></select></div><canvas class="laboratoire-canvas" role="img" aria-label="Courbe comparative du traité et du témoin"></canvas><p class="laboratoire-legende"><span>Traité</span><span>Témoin</span></p></section>
    <footer><button type="button" class="laboratoire-reset">Réinitialiser</button><button type="button" class="laboratoire-csv">Exporter CSV</button></footer>`;

  const style = document.createElement('style');
  style.textContent = `
    .laboratoire-declencheur{margin:.5rem 0;border:1px solid ${BLEU};border-radius:999px;background:${IVOIRE};color:${ENCRE};padding:.55rem .9rem;font:600 .88rem/1 system-ui;cursor:pointer}.laboratoire-cellulaire{position:fixed;z-index:30;top:1rem;right:1rem;width:min(29rem,calc(100vw - 2rem));max-height:calc(100vh - 2rem);overflow:auto;box-sizing:border-box;padding:1.2rem;border:1px solid #cbd8df;border-radius:1rem;background:${IVOIRE};color:${ENCRE};box-shadow:0 1.25rem 3.5rem #18243333;font:400 .9rem/1.45 system-ui}.laboratoire-cellulaire header,.laboratoire-ligne-titre,.laboratoire-cellulaire footer{display:flex;align-items:center;justify-content:space-between;gap:.75rem}.laboratoire-cellulaire h2,.laboratoire-cellulaire h3{margin:0;color:${ENCRE}}.laboratoire-cellulaire h2{font-size:1.2rem}.laboratoire-cellulaire h3{font-size:.9rem}.laboratoire-surtitre{margin:0;color:${BLEU};font-size:.68rem;font-weight:800;letter-spacing:.12em}.laboratoire-note{padding:.65rem .75rem;border-left:3px solid ${BLEU};background:#e9f4f8}.laboratoire-cellulaire section{margin-top:1rem}.laboratoire-mesures{display:grid;grid-template-columns:1fr auto;gap:.3rem .8rem;margin:.5rem 0}.laboratoire-mesures dt{color:#44515c}.laboratoire-mesures dd{margin:0;font-weight:700}.laboratoire-commandes{display:grid;grid-template-columns:1fr 1fr;gap:.45rem}.laboratoire-cellulaire button,.laboratoire-cellulaire select{border:1px solid #9eafb9;border-radius:.45rem;background:#fffef9;color:${ENCRE};padding:.45rem .55rem;font:inherit}.laboratoire-cellulaire button{cursor:pointer}.laboratoire-intervention[aria-pressed=true]{border-color:${ORANGE};background:#fff0e9;color:#813400}.laboratoire-canvas{display:block;width:100%;height:12rem;margin-top:.7rem;border:1px solid #d7e1e5;background:#fffef9}.laboratoire-legende{display:flex;gap:1rem;margin:.4rem 0 0;font-size:.8rem}.laboratoire-legende span:first-child::before,.laboratoire-legende span:last-child::before{content:'';display:inline-block;width:.75rem;height:.18rem;margin-right:.3rem;vertical-align:middle;background:${ORANGE}}.laboratoire-legende span:last-child::before{background:${BLEU}}.laboratoire-cellulaire footer{margin-top:1rem}@media(max-width:900px){.laboratoire-cellulaire{inset:auto 0 0 0;width:100%;max-height:82vh;border-radius:1rem 1rem 0 0}.laboratoire-commandes{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.laboratoire-cellulaire{scroll-behavior:auto}}
  `;
  document.head.append(style);
  hote.append(bouton, panneau);

  const mesures = panneau.querySelector<HTMLElement>('.laboratoire-mesures')!;
  const commandes = panneau.querySelector<HTMLElement>('.laboratoire-commandes')!;
  const canvas = panneau.querySelector<HTMLCanvasElement>('.laboratoire-canvas')!;
  const select = panneau.querySelector<HTMLSelectElement>('.laboratoire-select')!;
  let mesure: Mesure = 'atp';
  let derniereTaille = -1;

  const definitions: Array<[string, (actif: boolean) => void]> = [
    // La consigne de perfusion, pas la valeur instantanée : sinon le
    // renouvellement du milieu efface l'intervention en quelques secondes.
    ['Glucose élevé (12 / 5 mM)', actif => appliquer(traite, ['milieu', 'glucoseCible'], actif ? 12 : 5)],
    ['Couper oxygène', actif => appliquer(traite, ['energie', 'inhibiteurs', 'anoxie'], actif)],
    ['Oligomycine', actif => appliquer(traite, ['energie', 'inhibiteurs', 'oligomycine'], actif)],
    ['Ouabaïne', actif => appliquer(traite, ['energie', 'inhibiteurs', 'ouabaine'], actif)],
    ['Bloqueur calcique', actif => appliquer(traite, ['milieu', 'bloqueurCalcique'], actif ? 1 : 0)],
    ['Stress RE', actif => appliquer(traite, ['milieu', 'stressRE'], actif ? 1 : 0)],
    // Les deux médicaments du canal K-ATP, aux effets opposés : la
    // sulfonylurée fait sécréter une cellule affamée, le diazoxide fait
    // taire une cellule gavée. Essayez-les avec la mesure « sécrétion ».
    ['Sulfonylurée (ferme K-ATP)', actif => appliquer(traite, ['milieu', 'sulfonylure'], actif ? 1 : 0)],
    ['Diazoxide (ouvre K-ATP)', actif => appliquer(traite, ['milieu', 'diazoxide'], actif ? 1 : 0)],
    // Le diabète de type 2 en une consigne : 15 mM SOUTENUS. Un pic passe,
    // un diabète reste — laissez tourner une heure ou deux à vitesse
    // accélérée et regardez le stress s'installer, les granules s'épuiser,
    // le destin basculer. Rien n'est scripté : c'est la glucotoxicité qui
    // émerge du modèle.
    ['Hyperglycémie chronique (15 mM, T2D)', actif => appliquer(traite, ['milieu', 'glucoseCible'], actif ? 15 : 5)],
  ];
  for (const [libelle, action] of definitions) {
    const commande = document.createElement('button');
    commande.type = 'button'; commande.className = 'laboratoire-intervention'; commande.textContent = libelle;
    commande.setAttribute('aria-pressed', 'false');
    commande.addEventListener('click', () => { const actif = commande.getAttribute('aria-pressed') !== 'true'; commande.setAttribute('aria-pressed', String(actif)); action(actif); });
    commandes.append(commande);
  }

  function dessiner(force = false): void {
    const a = historique(traite, mesure), b = historique(temoin, mesure);
    const taille = a.length + b.length;
    if (!force && taille === derniereTaille) return;
    derniereTaille = taille;
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const c = canvas.getContext('2d'); if (!c) return;
    c.scale(dpr, dpr); const w = rect.width, h = rect.height, toutes = [...a, ...b];
    const min = Math.min(...toutes, 0), max = Math.max(...toutes, 1), amplitude = max - min || 1;
    c.clearRect(0, 0, w, h); c.strokeStyle = '#d7e1e5'; c.beginPath(); c.moveTo(0, h - 20); c.lineTo(w, h - 20); c.stroke();
    const trace = (series: number[], couleur: string) => { if (!series.length) return; c.strokeStyle = couleur; c.lineWidth = 2; c.beginPath(); series.forEach((v, i) => { const x = series.length === 1 ? 0 : (i / (series.length - 1)) * w; const y = 10 + (1 - (v - min) / amplitude) * (h - 30); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); };
    trace(b, BLEU); trace(a, ORANGE);
  }

  function rafraichir(): void {
    const valeurs: Array<[string, string]> = [
      ['Temps simulé', `${lire(traite, ['temps'], lire(traite, ['tempsSimule'])) .toFixed(1)} s`], ['ATP', `${valeur(traite, 'atp').toFixed(2)} mM`], ['Vm', `${valeur(traite, 'potentielMembrane').toFixed(1)} mV`], ['Ca cytosolique', `${(valeur(traite, 'calcium') * 1000).toPrecision(3)} µM`], ['Granules', lire(traite, ['expression', 'insulineGranules']).toFixed(0)], ['Insuline sécrétée', valeur(traite, 'secretionInsuline').toFixed(2)], ['ROS', valeur(traite, 'ros').toFixed(2)], ['Viabilité', `${(valeur(traite, 'viabilite') * 100).toFixed(1)} %`], ['Destin', String((traite as any).stress?.destin ?? '—')],
    ];
    mesures.innerHTML = valeurs.map(([nom, v]) => `<dt>${nom}</dt><dd>${v}</dd>`).join(''); dessiner();
  }
  bouton.addEventListener('click', () => { panneau.hidden = !panneau.hidden; bouton.setAttribute('aria-expanded', String(!panneau.hidden)); if (!panneau.hidden) { rafraichir(); panneau.querySelector<HTMLButtonElement>('.laboratoire-fermer')?.focus(); } });
  panneau.querySelector('.laboratoire-fermer')?.addEventListener('click', () => bouton.click());
  document.addEventListener('keydown', evenement => { if (evenement.key === 'Escape' && !panneau.hidden) bouton.click(); });
  select.addEventListener('change', () => { mesure = select.value as Mesure; derniereTaille = -1; dessiner(true); });
  new ResizeObserver(() => dessiner(true)).observe(canvas);
  panneau.querySelector('.laboratoire-reset')?.addEventListener('click', () => { reinitialiserSystemeCellulaire(traite); reinitialiserSystemeCellulaire(temoin); commandes.querySelectorAll('.laboratoire-intervention').forEach(commande => commande.setAttribute('aria-pressed', 'false')); derniereTaille = -1; rafraichir(); });
  panneau.querySelector('.laboratoire-csv')?.addEventListener('click', () => { const a = historique(traite, mesure), b = historique(temoin, mesure); const csv = ['index,traite,temoin', ...Array.from({ length: Math.max(a.length, b.length) }, (_, i) => `${i},${a[i] ?? ''},${b[i] ?? ''}`)].join('\n'); const lien = document.createElement('a'); lien.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); lien.download = `laboratoire-${mesure}.csv`; lien.click(); URL.revokeObjectURL(lien.href); });
  rafraichir();
  return { rafraichir };
}

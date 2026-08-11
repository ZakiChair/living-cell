/**
 * La glycémie d'une journée saine : trois repas, une nuit.
 *
 * C'est la consigne que le scénario « journée type » du laboratoire fait
 * suivre au milieu de perfusion. Les chiffres sont ceux d'un profil
 * glycémique continu normal [B] : à jeun 4,5-5 mM, pics post-prandiaux vers
 * 8-10 mM culminant 45 à 60 minutes après le repas, retour sous 6,5 mM en
 * deux heures. La cellule doit y répondre par trois vagues d'insuline
 * biphasiques — et retrouver le calme entre chacune : c'est la différence
 * entre un repas et un diabète.
 */

/**
 * Un repas : une bosse asymétrique — montée sigmoïde (l'estomac se vide
 * progressivement, la glycémie ne saute pas), pic vers 50 minutes, décrue
 * exponentielle en une heure et demie.
 */
function repas(heure: number, debut: number, hauteur: number): number {
  const ecart = heure - debut;
  if (ecart <= 0) return 0;
  return (
    hauteur *
    ((ecart * ecart) / (ecart * ecart + 0.55 * 0.55)) *
    Math.exp(-ecart / 1.5)
  );
}

/** Glycémie cible en mM à l'heure donnée (0 à 24, décimale). */
export function glycemieJournee(heure: number): number {
  const h = ((heure % 24) + 24) % 24;
  const base = 4.8;
  return (
    base +
    repas(h, 7.4, 9.0) + // petit-déjeuner
    repas(h, 12.6, 11.0) + // déjeuner
    repas(h, 19.2, 10.0) + // dîner
    // L'aube : la glycémie remonte doucement avant le réveil (cortisol,
    // production hépatique) — le « phénomène de l'aube » des diabétologues.
    0.4 * Math.exp(-Math.pow(h - 6.2, 2) / 1.8)
  );
}

/** Durée réelle d'une journée, en secondes : la constante du scénario. */
export const JOURNEE_S = 86_400;

/** Compression du scénario : 24 h vécues en ~2 minutes d'écran. */
export const ACCELERATION_JOURNEE = 720;

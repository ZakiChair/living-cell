/**
 * Géométrie du contour par coque inversée.
 *
 * Une coque gonflée d'une constante en espace objet donne un contour dont
 * l'épaisseur à l'écran varie avec la distance : épais devant, invisible au
 * fond. Pour obtenir une largeur constante en pixels, l'offset doit croître
 * proportionnellement à la distance et à la taille du champ de vision.
 */

/** Élément [1][1] de la matrice de projection perspective : 1 / tan(fov / 2). */
export function projection11(fovDegres: number): number {
  return 1 / Math.tan((fovDegres * Math.PI) / 360)
}

/**
 * Décalage à appliquer le long de la normale, en unités de scène, pour obtenir
 * un contour de `largeurPx` pixels à l'écran.
 *
 * @param zVue           profondeur du sommet en espace vue (négatif devant la caméra)
 * @param largeurPx      largeur voulue du contour, en pixels
 * @param hauteurEcranPx hauteur du tampon de dessin, en pixels
 * @param p11            élément [1][1] de la matrice de projection
 */
export function offsetContour(
  zVue: number,
  largeurPx: number,
  hauteurEcranPx: number,
  p11: number,
): number {
  return (-zVue * largeurPx * 2) / (hauteurEcranPx * p11)
}

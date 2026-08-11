import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

/**
 * Les trois signatures fonctionnelles de la cellule bêta que le modèle devait
 * encore apprendre :
 * 1. La sécrétion est BIPHASIQUE — un pic (le pool amarré part), puis un
 *    plateau plus bas (limité par la mobilisation de la réserve). C'est ce
 *    que mesure toute épreuve d'hyperglycémie provoquée.
 * 2. Stimulée, elle OSCILLE — le calcium et la sécrétion pulsent par vagues
 *    de plusieurs minutes, jamais en continu. L'insuline plasmatique pulse
 *    avec, et la perte de cette pulsatilité est un signe précoce du T2D.
 * 3. Le GLP-1 AMPLIFIE sans déclencher — sans glucose il ne fait rien, avec
 *    glucose il multiplie. C'est toute la sécurité des agonistes (sémaglutide) :
 *    pas d'hypoglycémie, contrairement aux sulfonylurées.
 */

type Systeme = ReturnType<typeof creerSystemeCellulaire>;

function minutesDurant(systeme: Systeme, minutes: number, releve?: number[]) {
  for (let m = 0; m < minutes * 4; m++) {
    avancerSystemeCellulaire(systeme, 15);
    releve?.push(systeme.ions.calciumCytosolique);
  }
  return systeme;
}

function stimule(glucose = 12): Systeme {
  const systeme = creerSystemeCellulaire(creerEtat());
  systeme.milieu.glucoseCible = glucose;
  return systeme;
}

describe("la sécrétion est biphasique", () => {
  it("le pool amarré se vide en première phase, puis la mobilisation le limite", () => {
    const s = stimule();
    const amarresAvant = s.expression.granulesAmarres;
    minutesDurant(s, 4);
    const amarresApres = s.expression.granulesAmarres;
    expect(amarresAvant).toBeGreaterThan(0.5);
    expect(amarresApres).toBeLessThan(0.55 * amarresAvant);
  });

  it("le débit du premier quart d'heure dépasse nettement celui du second", () => {
    const s = stimule();
    minutesDurant(s, 5);
    const premierePhase = s.expression.insulineSecretee;
    minutesDurant(s, 15);
    const secondePhase = (s.expression.insulineSecretee - premierePhase) / 3;
    expect(premierePhase).toBeGreaterThan(1.4 * secondePhase);
    // Mais la seconde phase EXISTE : le plateau n'est pas un arrêt.
    expect(secondePhase).toBeGreaterThan(0.15 * premierePhase);
  });

  it("au repos, le pool amarré se reconstitue", () => {
    const s = stimule();
    minutesDurant(s, 6);
    const vide = s.expression.granulesAmarres;
    s.milieu.glucoseCible = 5;
    minutesDurant(s, 25);
    expect(s.expression.granulesAmarres).toBeGreaterThan(vide * 1.5);
  });
});

describe("la cellule stimulée oscille", () => {
  it("le calcium pulse par vagues de quelques minutes, il ne monte pas en continu", () => {
    const s = stimule();
    minutesDurant(s, 6); // passer la première phase
    const trace: number[] = [];
    minutesDurant(s, 20, trace);
    const maximum = Math.max(...trace);
    const minimum = Math.min(...trace);
    // L'amplitude relative des vagues : au moins un quart de la valeur haute.
    expect(maximum - minimum).toBeGreaterThan(0.25 * maximum);
    // Et plusieurs vagues : on compte les remontées franches.
    const moyenne = trace.reduce((a, b) => a + b, 0) / trace.length;
    let pics = 0;
    let audessus = trace[0]! > moyenne;
    for (const v of trace) {
      if (!audessus && v > moyenne * 1.05) {
        pics++;
        audessus = true;
      } else if (audessus && v < moyenne * 0.95) {
        audessus = false;
      }
    }
    expect(pics).toBeGreaterThanOrEqual(2);
  });

  it("au repos, rien n'oscille : le calcium reste bas et stable", () => {
    const s = creerSystemeCellulaire(creerEtat());
    minutesDurant(s, 6);
    const trace: number[] = [];
    minutesDurant(s, 10, trace);
    expect(Math.max(...trace)).toBeLessThan(0.0004);
    expect(Math.max(...trace) - Math.min(...trace)).toBeLessThan(0.3 * Math.max(...trace));
  });
});

describe("le réticulum est un vrai coffre à calcium", () => {
  it("le RE tient son calcium des centaines de fois au-dessus du cytosol", () => {
    const s = minutesDurant(creerSystemeCellulaire(creerEtat()), 10);
    expect(s.ions.calciumRE).toBeGreaterThan(100 * s.ions.calciumCytosolique);
    expect(s.ions.calciumRE).toBeGreaterThan(0.05);
    expect(s.ions.calciumRE).toBeLessThan(0.8);
  });
});

describe("le GLP-1 amplifie sans déclencher", () => {
  it("sans glucose, le GLP-1 ne sécrète RIEN — la sécurité des agonistes", () => {
    const sans = stimule(3);
    const avec = stimule(3);
    avec.milieu.glp1 = 1;
    minutesDurant(sans, 15);
    minutesDurant(avec, 15);
    expect(avec.expression.insulineSecretee).toBeLessThan(
      2 * Math.max(sans.expression.insulineSecretee, 0.01),
    );
  });

  it("avec glucose, il multiplie la réponse", () => {
    const seul = stimule(12);
    const potentialise = stimule(12);
    potentialise.milieu.glp1 = 1;
    minutesDurant(seul, 15);
    minutesDurant(potentialise, 15);
    expect(potentialise.expression.insulineSecretee).toBeGreaterThan(
      1.4 * seul.expression.insulineSecretee,
    );
  });
});

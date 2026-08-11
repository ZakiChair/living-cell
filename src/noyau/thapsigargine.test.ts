import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

/**
 * La thapsigargine : l'outil le plus utilisé de toute la biologie du calcium.
 * Elle bloque la SERCA — et tout ce que le réservoir faisait s'arrête : les
 * vagues cessent, le calcium du réticulum fuit sans retour, et les chaperons
 * de la lumière, qui travaillent AU calcium, lâchent leurs clients — le
 * stress du réticulum monte. C'est le lien calcium↔UPR, produit par le
 * modèle et non affirmé.
 */

type Systeme = ReturnType<typeof creerSystemeCellulaire>;

function minutesDurant(systeme: Systeme, minutes: number, releve?: number[]) {
  for (let m = 0; m < minutes * 4; m++) {
    avancerSystemeCellulaire(systeme, 15);
    releve?.push(systeme.ions.calciumCytosolique);
  }
  return systeme;
}

describe("la thapsigargine vide le coffre et allume l'UPR", () => {
  it("SERCA bloquée, le calcium du réticulum s'effondre", () => {
    const traite = creerSystemeCellulaire(creerEtat());
    traite.milieu.thapsigargine = 1;
    minutesDurant(traite, 40);
    const temoin = minutesDurant(creerSystemeCellulaire(creerEtat()), 40);
    expect(traite.ions.calciumRE).toBeLessThan(0.25 * temoin.ions.calciumRE);
  });

  it("les vagues cessent : la cellule stimulée n'oscille plus", () => {
    const traite = creerSystemeCellulaire(creerEtat());
    traite.milieu.glucoseCible = 12;
    traite.milieu.thapsigargine = 1;
    minutesDurant(traite, 8);
    const trace: number[] = [];
    minutesDurant(traite, 15, trace);
    const max = Math.max(...trace);
    const min = Math.min(...trace);
    expect(max - min).toBeLessThan(0.15 * max);
  });

  it("le réticulum privé de calcium entre en stress", () => {
    const traite = creerSystemeCellulaire(creerEtat());
    traite.milieu.thapsigargine = 1;
    minutesDurant(traite, 60);
    const temoin = minutesDurant(creerSystemeCellulaire(creerEtat()), 60);
    expect(traite.stress.stressRE).toBeGreaterThan(0.2);
    expect(temoin.stress.stressRE).toBeLessThan(0.12);
  });
});

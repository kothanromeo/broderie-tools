<div align="center">

# Broderie Tools

**Ouvrir et convertir les fichiers de broderie machine (PES, PEC, DST, JEF, EXP), dans le navigateur.**

[**→ Ouvrir la visionneuse**](https://broderie-tools.kothanromeo.dev/) · [Convertisseur](https://broderie-tools.kothanromeo.dev/convertir-fichier-broderie/) · [Guides](https://broderie-tools.kothanromeo.dev/guides/) · [Signaler un problème](https://github.com/kothanromeo/broderie-tools/issues)

![Tests](https://github.com/kothanromeo/broderie-tools/actions/workflows/ci.yml/badge.svg)
![Licence MIT](https://img.shields.io/badge/licence-MIT-blue)

</div>

---

Les fichiers de broderie ne s'ouvrent qu'avec la machine ou le logiciel de sa marque. Broderie Tools les affiche dans n'importe quel navigateur, y compris sur téléphone, et les convertit d'un format à l'autre sans envoyer le motif sur internet.

## Fonctionnalités

- **Lecture** des formats PES (versions 1 à 10, fils de l'en-tête PES ou palette PEC), PEC, DST (Tajima, en-tête et couleurs « TC »), JEF (Janome) et EXP (Melco, Bernina).
- **Aperçu** sur canvas : rendu de fil en relief, fonds au choix, zoom à la molette ou au doigt, sauts affichables, export PNG.
- **Simulation** de la broderie point par point.
- **Informations** : dimensions en mm et en pouces, cadre minimal, points, coupes, sauts, longueur de fil, durée estimée, fils dans l'ordre avec nom et référence.
- **Conversion** vers PES (version 1 avec bloc PEC et vignettes), DST, JEF et EXP : déplacements longs découpés, couleurs ramenées à la palette Brother ou Janome, limites de chaque format signalées.

Les lecteurs et les convertisseurs sont vérifiés point par point avec [pyembroidery](https://github.com/EmbroidePy/pyembroidery) : mêmes positions de points, mêmes couleurs et même emprise dans les deux sens. Le PES produit est identique, octet pour octet, à celui de pyembroidery.

## Structure

```
src/lib/embroidery/
├── pattern.ts    Modèle commun, emprise, blocs de couleur, distance de couleurs, cadres
├── read.ts       Lecteurs PES/PEC, DST, JEF, EXP et détection du format
├── write.ts      Écriture PES, DST, JEF, EXP
├── palettes.ts   Palettes de fils Brother (PEC) et Janome (JEF), vignette PEC vierge
└── sample.ts     Motif de démonstration dessiné par programme
src/scripts/
├── render.ts     Dessin sur canvas
└── emb-ui.ts     Interface
```

## Développement

```bash
npm install
npm run dev     # http://localhost:4321/
npm test        # tests Vitest
npm run build   # site statique dans dist/
```

## Limites

Les formats VP3, VIP, HUS, PCS, XXX et les fichiers de travail (EMB, ART, PXF) ne sont pas lus. Le redimensionnement n'est pas proposé : un fichier de points ne s'agrandit pas sans recalculer la densité.

## Crédits

Les palettes de fils Brother et Janome et le modèle de vignette PEC reprennent les valeurs de pyembroidery (licence MIT).

## Licence

[MIT](LICENSE) © Roméo Kothan

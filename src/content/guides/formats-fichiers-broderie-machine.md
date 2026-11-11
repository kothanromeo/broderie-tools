---
title: "Quel format de fichier de broderie pour quelle machine ? PES, DST, JEF, EXP, VP3…"
seoTitle: "Format de broderie : PES, DST, JEF, EXP, VP3 — lequel pour ma machine ?"
description: "PES pour Brother, JEF pour Janome, DST pour Tajima, EXP pour Bernina, VP3 pour Husqvarna : le tableau des formats de broderie et ce que chacun contient."
keywords: ["format broderie machine", "format pes", "format dst", "format jef", "format exp", "format vp3", "fichier broderie brother", "fichier broderie janome", "format broderie bernina", "format broderie husqvarna", "format broderie singer", "quel format machine à broder"]
published: 2026-11-11
faq:
  - q: "Ma machine Brother peut-elle lire un fichier DST ?"
    a: "<p>Beaucoup de machines Brother récentes acceptent aussi le DST, mais pas toutes, et les couleurs ne s’afficheront pas. Le PES reste le format le plus sûr pour une Brother.</p>"
  - q: "Pourquoi les motifs sont-ils souvent vendus en plusieurs formats ?"
    a: "<p>Parce que chaque marque a le sien. Les créateurs exportent le même motif dans une dizaine de formats et les livrent dans une archive ZIP : il suffit de prendre celui de votre machine.</p>"
  - q: "Quelle est la différence entre un fichier de broderie et un fichier de travail ?"
    a: "<p>Un fichier de broderie (PES, DST, JEF…) contient des points prêts à coudre. Un fichier de travail (EMB, PXF, BE…) contient les formes et les réglages du logiciel de création : il permet de modifier ou de redimensionner proprement le motif, mais la machine ne le lit pas.</p>"
---

Chaque fabricant de machines à broder a créé son propre format de fichier. Résultat : un motif acheté en ligne arrive souvent dans une archive avec dix fichiers, et il faut savoir lequel ouvrir. Voici le tableau de correspondance, et ce que chaque format garde vraiment.

## Le tableau des formats

| Format | Marques | Couleurs des fils | Remarques |
|---|---|---|---|
| **PES** | Brother, Babylock, certaines Bernette | oui | Le plus répandu chez les particuliers. Contient un bloc « PEC » lu par la machine. |
| **PEC** | Brother (anciennes machines) | oui, palette Brother | La partie « machine » du PES, seule. |
| **JEF** | Janome, Elna | oui, palette Janome | Variante JEF+ pour les machines récentes. |
| **DST** | Tajima et la plupart des machines professionnelles | **non** | Format universel des ateliers de broderie. |
| **EXP** | Melco, Bernina | non | Bernina utilise aussi l’ART pour ses logiciels. |
| **VP3**, **VIP** | Husqvarna Viking, Pfaff | oui | |
| **HUS** | Husqvarna Viking (anciennes) | oui | Données compressées. |
| **PCS** | Pfaff (anciennes) | oui | |
| **XXX** | Singer | oui | |

La [visionneuse](/) lit aujourd’hui les formats PES, PEC, DST, JEF et EXP, qui couvrent la grande majorité des machines.

## Ce qu’il y a dans un fichier de broderie

Quel que soit le format, le contenu est le même : une **suite de points**, chacun défini par un déplacement en dixièmes de millimètre par rapport au précédent. S’y ajoutent des commandes :

- **saut** : la machine déplace le cadre sans piquer ;
- **coupe** : la machine coupe le fil (sur les modèles équipés) ;
- **changement de couleur** : la machine s’arrête pour que vous changiez de fil ;
- **fin**.

Les formats se distinguent par la façon de coder ces déplacements (un, deux ou trois octets par point) et par ce qu’ils gardent en plus :

- les **couleurs des fils** : le PES et le JEF les notent, souvent sous forme de numéro dans la palette de la marque ; le DST et l’EXP n’en gardent aucune trace ;
- le **nom du motif**, l’auteur, la date ;
- une **vignette** que la machine affiche à l’écran (PES).

## Le DST, cas particulier

Le DST vient des machines industrielles Tajima. Il est accepté presque partout, ce qui en fait un bon format d’échange. Mais il n’enregistre **pas les couleurs** : une fois converti en DST, un motif garde ses changements de fil, mais la machine choisira ses couleurs d’affichage. Il faudra suivre la fiche couleurs fournie avec le motif.

## Changer de format

Si votre machine ne lit pas le format reçu, le [convertisseur](/convertir-fichier-broderie/) transforme un fichier PES, DST, JEF ou EXP dans un autre de ces formats, sans toucher aux points. Les précautions sont détaillées dans [convertir un fichier de broderie sans rien perdre](/guides/convertir-fichier-broderie-pes-dst/).

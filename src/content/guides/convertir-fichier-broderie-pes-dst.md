---
title: "Convertir un fichier de broderie (PES, DST, JEF) sans rien perdre"
seoTitle: "Convertir PES en DST, DST en PES, JEF en PES : les précautions"
description: "Ce que l’on garde et ce que l’on perd en convertissant un motif entre PES, DST, JEF et EXP : couleurs, coupes, taille. Et pourquoi ne pas l’agrandir."
keywords: ["convertir pes en dst", "convertir dst en pes", "convertir jef en pes", "convertir pes en jef", "conversion fichier broderie", "perte couleurs dst", "agrandir motif broderie", "redimensionner broderie", "convertisseur broderie gratuit", "pes vers dst", "dst vers jef", "coupe de fil broderie"]
published: 2026-11-11
faq:
  - q: "Peut-on convertir un fichier de broderie en image ?"
    a: "<p>Oui pour l’aperçu : la visionneuse enregistre le motif en image PNG. L’inverse, transformer une image en motif de broderie, demande un logiciel de numérisation et un vrai travail de conception.</p>"
  - q: "Pourquoi mon motif converti s’arrête-t-il plus souvent ?"
    a: "<p>Si la machine marque un arrêt à chaque changement de couleur, c’est normal. Si elle s’arrête sans raison, le format d’arrivée code peut-être les coupes autrement : en JEF et en EXP, certaines machines ne coupent pas le fil automatiquement et il faut le faire à la main.</p>"
---

Convertir un motif de broderie, c’est réécrire la même suite de points dans un autre format. Bien fait, le motif brodé est strictement identique. Mais chaque format a ses limites, et il vaut mieux les connaître avant de lancer la machine.

## Ce qui ne change jamais

- **Les points** : chaque point garde sa position, au dixième de millimètre près, et le même ordre.
- **Les changements de fil** : la machine s’arrêtera aux mêmes endroits.
- **La taille** du motif.

Quand un déplacement est trop long pour le format d’arrivée (plus de 12,1 mm d’un coup en DST, 12,7 mm en JEF et EXP), il est découpé en plusieurs sauts plus courts. Le tracé brodé ne change pas.

## Ce qui peut changer

**Les couleurs.** Le PES et le JEF notent les fils sous forme de numéro dans la palette de leur marque (64 couleurs pour Brother, 78 pour Janome). En convertissant, chaque fil est remplacé par la teinte la plus proche de la palette d’arrivée. Le DST et l’EXP, eux, n’enregistrent pas de couleur du tout. Dans tous les cas, gardez la fiche couleurs fournie avec le motif.

**Les coupes de fil.** Le PES a une commande de coupe. Le DST n’en a pas : une coupe y est représentée par trois petits sauts que les machines interprètent comme « couper ». En JEF et en EXP, les coupes deviennent de simples sauts : selon la machine, le fil sera coupé automatiquement ou devra l’être à la main.

**Le nom et la vignette.** Le nom du motif est conservé dans la limite de longueur du format (8 caractères en PES, 16 en DST). Pour le PES, une vignette est générée pour l’écran de la machine.

## Pourquoi ne pas agrandir un motif en le convertissant

C’est la question la plus fréquente, et la réponse est contre-intuitive : **un fichier de broderie ne se redimensionne pas comme une image**. Il contient des points, pas des formes. Agrandi de 30 %, un remplissage dont les points étaient serrés à 0,4 mm passe à 0,52 mm : on voit le tissu à travers. Réduit, les points se chevauchent, le fil s’accumule et casse.

Au-delà de 10 % environ, il faut repartir du fichier de travail dans un logiciel de création, qui recalcule la densité. Le [convertisseur](/convertir-fichier-broderie/) ne propose donc volontairement pas de changer la taille.

## Vérifier avant de broder

1. Ouvrez le fichier converti dans la [visionneuse](/) : l’aperçu, les dimensions et le nombre de couleurs doivent être ceux d’origine.
2. Vérifiez que le motif tient dans votre cadre (voir [les tailles de cadre](/guides/taille-cadre-broderie/)).
3. Faites un essai sur une chute du même tissu, avec le même entoilage.

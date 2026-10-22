# L’Ouvrage du Genjutsu de Zaoki

Refonte locale de la présentation, avec le contenu des 11 doubles pages originales, repaginé automatiquement selon la place disponible. Les pages restent courtes, sans défilement intérieur. Les textes ont été comparés à `reference_current_site/index.html` du pack fourni. Contenu RP conservé, avec la correction demandée ensuite : « souffrance physique, émotionnelle, psychologique et existentielle ». Les quatre illustrations sont les fichiers officiels de `images/chapters/`, copiés sans retouche ni recadrage. L’image officielle de Meiro diffère de celle de l’ancien site : la version officielle du pack est utilisée.

## Ouvrir le livre

Sous Windows, double-cliquer sur **Lancer-le-livre.cmd**. Node.js doit être installé. Le lanceur démarre un petit serveur local caché et ouvre le navigateur.

Ou dans ce dossier :

```sh
npm run dev
```

Puis ouvrir **http://127.0.0.1:4173**. Aucune installation de dépendances n’est nécessaire. L’ouverture directe de `index.html` par double-clic peut empêcher le chargement du modèle GLB ; utiliser le serveur local.

## Commandes et lecture

- Cliquer sur le livre ou appuyer sur Entrée pour l’ouvrir.
- Bords de page, boutons et flèches du clavier pour feuilleter.
- Deux pages côte à côte à partir de 480 px ; sur petit téléphone, une page à la fois avec glissement horizontal pour tourner.
- Ruban rouge ou bouton Sommaire pour choisir une section.
- « Refermer l’ouvrage » revient à la couverture.

## Organisation

- `content/book.js` : contenu original et ordre des doubles pages.
- `styles/manuscript.css` : décor, cuir, papier, pages et responsive.
- `js/manuscript.js` : lecture, feuilletage recto/verso, sommaire, clavier et tactile.
- `js/boneHand.js` : préchargement, synchronisation de la prise, lumières, ombres et libération des ressources.
- `assets/models/bone_hand.glb` : main optimisée, 14 308 triangles, 17 os, animation `Grip`.
- `sources/bone_hand.blend` : source Blender 4.5 LTS, maillage, UV, matériaux et armature.
- `sources/build_hand.py` : génération reproductible du modèle dans Blender.
- `assets/textures/bone/` : Base Color, Roughness et Normal en 1024 × 1024.
- `js/vendor/` : Three.js 0.180.0, GLTFLoader et licence MIT embarqués ; aucun CDN au lancement.

## Main et couverture

L’ouverture dure environ 3,9 secondes : approche, fermeture des doigts, maintien de 0,3 seconde, levée, relâchement et retrait. Le point de prise suit une trajectoire contrainte autour de la reliure. L’angle obtenu pilote à la fois la couverture HTML et son équivalent 3D ; `CoverGripPoint` et `HandGripPoint` sont superposés durant la prise. La perspective Three.js correspond à la perspective CSS de 1800 px. Les dimensions et le cadrage sont calculés à partir du livre et du viewport.

Le pouce se replie latéralement dans l’espace sous la couverture, les quatre doigts restent au-dessus. Des surfaces de profondeur masquent les os situés derrière le livre. Le rendu utilise une lumière chaude, une lumière de bord violette et une ombre légère. Le ratio de pixels est plafonné à 1,25 sur petit écran, 1,75 ailleurs ; le rendu est limité à environ 60 images par seconde et arrêté à la fin de l’ouverture.

Si WebGL, le module ou le GLB est indisponible, l’ouverture CSS continue sans main. Un clic avant la fin du préchargement déclenche aussi cette ouverture immédiate. Le mouvement réduit est respecté. Les performances réelles dépendent de l’appareil ; les tests mobiles sont des simulations de viewport dans Chrome, pas des tests sur téléphone physique.

## Vérifications

- Contrôle JavaScript et construction statique.
- Comparaison des 22 pages au contenu original, et empreintes SHA-256 des quatre illustrations officielles.
- Chrome : 1440 × 900, 2560 × 1080, 1366 × 768, 390 × 844, 360 × 640 et paysage 844 × 390.
- Ouverture réelle, navigation, sommaire, libération du canvas, mode sans WebGL, GLB manquant, module manquant, clic immédiat et mouvement réduit.
- Échantillonnage de la prise : écart des points inférieur à 0,001 unité ; absence de collision du pouce avec le bloc de pages dans les positions contrôlées.
- Rapports dans `verification/`. Safari et les appareils physiques n’ont pas été testés.

## Déploiement statique

```sh
npm run check
npm run build
```

Le dossier `dist/` contient les fichiers du site, sans la source Blender. Il peut être servi par un hébergement statique. `vercel.json` configure la commande de build et le dossier de sortie pour Vercel. Aucun déploiement public n’a été effectué.

## Décor

Le décor de la table a été généré avec l’outil ImageGen intégré. Le fichier et le prompt complet figurent dans `assets/decor/writing-room.png` et `sources/decor-prompt.txt`. Les images officielles des chapitres n’ont pas été générées ni modifiées. Le papier et les ornements sont des SVG légers.

Documentation technique : [Three.js](https://threejs.org/docs/).

## Livre Blender et aura de genjutsu

`assets/models/book_frame.glb` contient les variantes ouverte et fermée : couvertures de cuir, tranches superposées, coins en laiton, reliure, cordon tressé, sceau et pompon. Les deux variantes totalisent 25 952 triangles. La source éditable est `sources/book_frame.blend` et le script reproductible `sources/build_book.py`.

`js/bookScene.js` éclaire les pièces du livre ouvert. `js/genjutsuAura.js` anime trois filaments d’énergie et 110 particules violettes. Leur intensité augmente à l’ouverture et pendant le feuilletage. L’encre reste dans le HTML pour préserver sa netteté et son accessibilité. Les mouvements réduits conservent un halo fixe. Les rendus ambiants sont limités à environ 25 images/s et suspendus quand l’onglet est masqué.

La pagination finale a été vérifiée aux formats 1440 × 900, 589 × 884, 390 × 844, 360 × 640, 844 × 390 et 2560 × 1080 : aucun mot perdu, aucun débordement de page. Les rapports antérieurs à la pagination concernent la main et les mécanismes de secours. Le rendu final du cadre, l’ouverture et le sommaire ont aussi été contrôlés dans l’aperçu intégré.
La fumée violette procédurale entoure désormais le livre, avec une poussée à l’ouverture et un souffle de 2,4 secondes au feuilletage. Elle reste derrière les pages pour préserver la lecture. La correction du folio 04 a été vérifiée visuellement ; les 22 pages sources ont été comparées pour confirmer que seule la phrase demandée a changé (verification/smoke-content-update.json).

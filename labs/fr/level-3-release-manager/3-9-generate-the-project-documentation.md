---
id: lab-3-9
title: "Lab 3.9 - Générer la documentation du projet Salesforce"
description: "Générez une documentation lisible d'une org Salesforce non documentée avec sfdx-hardis : objets, flows, Apex et permissions, à partir des sources dans Git."
level: 3
lab: 9
lang: fr
source_rev: "4661bc03d2558cec0b10dc8f320de2e8a4617d66"
screenshots:
  - annotated/vscode/documentation-workbench--generate-and-deploy
depends_on:
  commands: [hardis:doc:project2markdown]
  flags: []
  config: [docDeployToOrg, docDeployToCloudflare, mermaidTheme]
  panels: [documentationWorkbench, documentationConfig]
  docs: [salesforce-project-doc-generate]
---

# Lab 3.9 - Générer la documentation du projet Salesforce

**Niveau** : 3 Release Manager

**Durée** : ~20 min

**Vous allez** : produire une documentation lisible d'une org que personne n'a documentée depuis deux
ans, à partir des sources que vous avez déjà.

## La situation

Victor connaissait cette org. Victor est parti.

Ce qui existe : deux ans de métadonnées dans un repository git. Ce qui n'existe pas : la moindre
description de ce à quoi servent les objets, de la façon dont les flows s'articulent, ou de la
raison pour laquelle le planificateur se comporte comme il le fait.

Vous n'allez pas écrire cela à la main. L'essentiel peut être généré, et la part qui ne le peut pas
est exactement celle qui mérite le temps d'une personne.

## Avant de commencer

- [ ] [Lab 3.8](3-8-monitor-your-production-org.md) terminé
- [ ] Sur `integration`, à jour : la documentation décrit ce que l'équipe a mergé

## Les étapes

### 1. Ouvrir le Documentation Workbench

![Le Documentation Workbench, avec les parties à inclure, le bouton Generate et les cibles de publication](../../_assets/annotated/vscode/documentation-workbench--generate-and-deploy.png)

Tout dans ce lab se passe sur cet unique écran. Trois parties comptent :

1. **Include** **(1)**, qui décide de ce qui est documenté. Huit cases : Objects, Flows & Process
   Builders, Profiles & Permissions, Automations, Lightning Pages, Apex, Lightning Web Components et
   Installed Packages. Tout coché est ce que vous voulez la première fois
2. **Generate Documentation** **(2)**, le bouton qui produit les pages
3. **Deploy Documentation** **(3)**, plus bas, qui les publie

À gauche d'**Include** se trouve une deuxième colonne, **Formats & History**. Laissez-la tranquille
pour l'instant, mais notez que **With Flow History** est cochée par défaut. Cette case est le sujet
de l'étape 4, et sans elle les pages de flow n'ont aucun diagramme d'historique.

### 2. Générer

Cliquez sur **Generate Documentation** **(2)**. Il lit les sources de `force-app/` et produit un jeu
de pages markdown sous `docs/`.

Cela prend quelques minutes sur un petit projet comme Helios.

### 3. Lire ce qu'il a produit

Quatre sortes de pages, et il vaut la peine de les distinguer :

| Page                                | Ce qu'elle contient                                                                                                              | Qui la lit                                                          |
|-------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| **Pages d'objet**                   | Chaque champ avec son type, sa description et son help text, les règles de validation, les types d'enregistrement, les relations | Un admin à qui on demande de modifier quelque chose                 |
| **Pages de flow**                   | Un diagramme lisible de chaque flow, plus ses conditions d'entrée et ses éléments                                                | Quiconque doit comprendre l'automatisation sans ouvrir Flow Builder |
| **Pages Apex**                      | Les classes, leurs méthodes, leur ApexDoc                                                                                        | Un développeur                                                      |
| **Pages de packages et de profils** | Ce qui est installé, ce que les permission sets accordent                                                                        | Un audit                                                            |

Ouvrez `docs/objects/Installation__c.md`. Chaque champ que vous et vos collègues avez créé au fil des
trois niveaux y est, avec les descriptions que vous avez écrites dans Setup.

**Les champs sans description produisent une ligne avec une cellule vide.** C'est la sortie honnête,
et c'est l'argument pour les deux secondes qu'il faut pour les remplir. Regardez combien de vides a
votre org.

### 4. Regarder les diagrammes de flow

Ouvrez la page de `Installation_Assign_Crew`.

Le flow est rendu sous forme de diagramme Mermaid : le déclencheur, les conditions d'entrée, les
décisions et leurs issues. Il est lisible par quelqu'un qui n'a jamais ouvert un flow Salesforce,
c'est-à-dire la plupart des gens qui vous demanderont ce qu'il fait.

Il y a une deuxième chose à remarquer : `Installation_Assign_Crew-history.md` est posé à côté,
montrant comment le flow a changé au fil du temps, construit à partir de l'historique git. Cela
répond à "quand ce flow s'est-il mis à faire cela", ce qui est sinon un long après-midi. Elle existe
parce que **With Flow History** était cochée, ce qui passe `--with-history` au générateur.
Décochez-la et la page n'est tout simplement pas écrite.

### 5. Combler les pires lacunes à la main

Une documentation générée vous dit **ce que** l'org contient. Elle ne peut pas vous dire **pourquoi**.

Passez quinze minutes à ajouter ce que seule une personne peut ajouter :

1. Un paragraphe en haut de la page Installation disant ce qu'est une installation dans le métier
2. Une phrase sur le planificateur expliquant le délai de préparation, qui a l'air arbitraire dans le
   code
3. Une note sur le plafond de capacité d'équipe disant que c'est une règle de sécurité, pas une règle
   de coût

Ces trois paragraphes valent plus que les quarante autres pages, et ils sont la raison pour laquelle
ce lab se trouve à la fin d'un niveau plutôt qu'au début.

**Protégez chaque page que vous modifiez.** Chaque page générée commence par deux lignes de
commentaire, et la seconde dit `<!-- DO_NOT_OVERWRITE_DOC=FALSE -->`. Passez-la à `TRUE` sur les
pages où vous écrivez. La génération suivante laisse une page `TRUE` tranquille, et réécrit toutes
les autres pages depuis les sources, paragraphe compris. Sur un projet qui commite sa documentation,
cette ligne est ce qui garde les mots d'une personne en vie d'une exécution nocturne à l'autre.

### 6. La publier

La section **Deploy Documentation** **(3)** propose trois cartes, chacune avec le même bouton
**Deploy** :

- **Deploy to Cloudflare Pages** la publie sous forme de site, comme la documentation sfdx-hardis
  elle-même est publiée
- **Deploy to Confluence** la publie dans un espace Confluence, et demande un token d'API Confluence
  configuré au préalable
- **Deploy to Salesforce** construit le HTML et le téléverse comme ressource statique, avec une page
  Visualforce et un onglet personnalisé, pour que la documentation soit accessible depuis
  l'intérieur de Salesforce. C'est plafonné par la limite de 5 Mo des ressources statiques, cela
  convient donc à un petit projet

Les mêmes trois existent comme clés de configuration, `docDeployToCloudflare`, `docDeployToConfluence`
et `docDeployToOrg`, et c'est ainsi que le workflow de monitoring republie la documentation chaque
nuit sans que personne clique. Celles de Cloudflare et de Salesforce s'excluent mutuellement :
activez les deux et seule celle de Salesforce tourne.

Pour ce lab, générez et lisez. Publier est une décision de projet, et commiter aussi : ce cours garde
`docs/` et le `mkdocs.yml` généré hors de git (`.gitignore` les liste), parce qu'ils sont
reconstruits depuis les sources dès que quelqu'un le demande, et qu'un release manager ne fait pas
passer de fonctionnalités, ni leur documentation, par des Pull Requests à lui.

### 7. En faire une habitude, pas un événement

Une documentation générée une fois est périmée en un mois. La génération est une commande, elle peut
donc tourner selon une planification comme le fait le monitoring, et le monitoring du [Lab 3.8](3-8-monitor-your-production-org.md) le fait
déjà : sa sauvegarde nocturne régénère la documentation de la production avant de se terminer.
Publier celle-là, avec les clés ci-dessus, est la façon dont un projet obtient une documentation que
personne n'a à penser à mettre à jour.

<details markdown="1"><summary>Sous le capot : qui lit quoi</summary>

La commande était :

    sf hardis:doc:project2markdown

qui lit :

- les répertoires de packages déclarés dans `sfdx-project.json`, donc `force-app/` : objets, champs,
  flows, Apex, permission sets, packages
- `manifest/` pour une page décrivant les manifestes eux-mêmes
- `config/.sfdx-hardis.yml` pour la configuration de projet qu'elle documente, qui devient
  `docs/sfdx-hardis-params.md` et `docs/sfdx-hardis-branches-and-orgs.md`
- l'**historique git**, pour les diagrammes du "qu'est-ce qui a changé et quand", quand
  `--with-history` est passé

et écrit du markdown sous `docs/`, plus un `mkdocs.yml` pour que le résultat soit un site et non un
tas de fichiers. Elle ne remplace pas un `mkdocs.yml` que vous auriez déjà, mais elle le modifie :
elle réécrit le bloc `nav` et ajoute les scripts, styles et fonctionnalités de thème dont les pages
générées ont besoin. Une navigation que vous auriez écrite à la main est donc reconstruite à
l'exécution suivante, ce qui vaut d'être su avant d'y passer une soirée.

Les diagrammes de flow sont du Mermaid, généré depuis le XML du flow. Cela veut dire qu'ils sont du
texte dans le repository : ils se diffent, se relisent et se versionnent comme tout le reste, et ils
ne se décalent jamais par rapport au flow qu'ils décrivent.

Deux commandes voisines à connaître :

- `sf hardis:doc:override-prompts` permet à un projet de remplacer les prompts d'IA utilisés quand
  les descriptions sont générées plutôt que lues
- `sf hardis:doc:plugin:generate` est ce qui génère la documentation de sfdx-hardis elle-même, ce qui
  est une preuve d'existence raisonnable que la sortie est lisible

Si le projet a un fournisseur d'IA configuré, le générateur peut aussi écrire les descriptions
manquantes plutôt que de laisser des vides. Utile, et pas un substitut aux trois paragraphes de
l'étape 5 : un modèle peut décrire ce qu'est un champ, pas pourquoi le métier en a besoin.

</details>

## Ce que vous devez voir

- Un dossier `docs/` avec des pages d'objets, de flows et d'Apex
- `docs/objects/Installation__c.md` listant chaque champ des trois niveaux
- Un diagramme lisible de `Installation_Assign_Crew`
- Trois paragraphes que vous avez écrits vous-même, sur une page marquée
  `DO_NOT_OVERWRITE_DOC=TRUE`
- Rien à commiter : **Source Control** ne montre aucune modification issue de la génération

## En cas de problème

**La génération échoue sur un flow.**
Un flow avec un élément inhabituel peut faire trébucher le générateur de diagrammes. La page est
quand même produite, sans le diagramme. Signalez-le comme une issue sur sfdx-hardis si vous en
rencontrez un.

**Les pages d'objets sont presque vides.**
Les sources sont là mais les descriptions non. C'est l'org, pas l'outil.

**Le dossier docs est énorme et la Pull Request impossible à relire.**
Attendu la première fois. Dites-le dans la description de la Pull Request. Les régénérations
suivantes produisent de petits diffs.

## Vérifiez votre travail

Welcome page > **Training: Level 3** > **Check my work**, puis choisissez le Lab 3.9.

## Pour aller plus loin

- [Générer la documentation](https://sfdx-hardis.cloudity.com/salesforce-project-doc-generate/)

[Suite : Lab 3.10 - Épreuve finale : mener un cycle de release hebdomadaire](3-10-capstone-run-a-weekly-release-cycle.md){ .md-button .md-button--primary }

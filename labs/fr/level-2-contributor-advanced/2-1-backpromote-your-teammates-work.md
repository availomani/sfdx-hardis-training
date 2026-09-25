---
id: lab-2-1
title: "Lab 2.1 - Backpromote : remettre votre org au niveau de l'équipe"
description: "Votre org de développement est en retard sur integration. Faites-y entrer les stories mergées par vos collègues avec le panneau Backpromote de sfdx-hardis, en gardant votre propre travail."
level: 2
lab: 1
lang: fr
source_rev: "071fe1a5506146b9a09ca8741a6d6d137a5d5d47"
screenshots:
  - annotated/vscode/backpromote-result--what-it-did
  - annotated/vscode/pipeline-cards--backpromote
  - annotated/vscode/backpromote-loading
  - annotated/vscode/backpromote
depends_on:
  commands: [hardis:work:backpromote, hardis:work:refresh]
  flags: []
  config: [backpromoteScanLimit]
  panels: [backpromote, pipeline]
  docs: [salesforce-devops-backpromote]
---

# Lab 2.1 - Backpromote : remettre votre org au niveau de l'équipe

**Niveau** : 2 Contributeur avancé

**Durée** : ~15 min

**Vous allez** : faire entrer dans votre propre org de dev les stories mergées par trois collègues,
décider quoi garder quand l'outil vous le demande, et apprendre ce qu'un backpromote ne fera jamais
pour vous.

## La situation

Vous étiez absent deux semaines. Pendant ce temps, trois stories ont été mergées dans `integration`
et déployées. Votre org `helios-dev` ressemble encore au jour de votre départ.

Construisez votre story suivante là-dessus et vous produirez un diff plein de choses qui ressemblent
à des suppressions, parce que votre org n'a pas ce que celle de tout le monde a. C'est la façon la
plus courante pour un contributeur de défaire par accident le travail d'un collègue.

## Avant de commencer

- [ ] Niveau 1 terminé, ou **Training: Level 2 > Reset this level** sur le niveau 2
- [ ] `helios-dev` connectée dans **Orgs Manager**
- [ ] Aucune modification non commitée à laquelle vous tenez

## Les étapes

### 1. Faire entrer le travail de votre collègue

Les deux semaines d'absence doivent exister avant que vous puissiez les rattraper. Un clic les
fabrique : **Training: Level 2** > **Simulate my teammates**, et prenez **US-017 Record who signed an
installation off**.

Cela crée la branche de Romain dans votre propre fork à partir de votre `integration` actuelle,
commite sa modification sous son nom et ouvre la Pull Request. Relisez-la comme vous le feriez pour
celle d'un collègue, puis **mergez-la**.

`integration` porte maintenant trois Pull Requests mergées que votre org n'a jamais vues sous forme
de déploiement : vos deux stories du Niveau 1, qui ne sont dans `helios-dev` que parce que vous les y
avez construites, et celle de Romain, qui en est très loin.

### 2. Ouvrir Backpromote

Dans le panneau **DevOps Pipeline**, sous **Project Contribution Workflow**, cliquez sur la carte
**Backpromote (Beta)** **(1)**.

![La carte Backpromote du panneau DevOps Pipeline](../../_assets/annotated/vscode/pipeline-cards--backpromote.png)

Il calcule son plan avant de vous montrer quoi que ce soit :

1. **Target sandbox** **(1)** est l'org dans laquelle le travail descend, `helios-dev`
2. **Parent branch** **(2)** est l'endroit d'où il vient, `integration`
3. Les trois lignes **(3)** lisent votre org, listent les Pull Requests mergées dans `integration`,
   et calculent la différence entre les deux

![Le panneau Backpromote calculant son plan](../../_assets/annotated/vscode/backpromote-loading.png)

"Backpromote" désigne la direction, et c'est elle qui compte : le travail remonte normalement
**vers le haut**, de votre branche vers integration, puis uat, puis production. Un backpromote le
fait **redescendre**, d'une branche majeure vers votre propre environnement, pour que vous
construisiez sur ce que l'équipe a et non sur ce dont vous vous souvenez.

### 3. Voir à quel point vous êtes en retard

Le bloc **WHERE** en haut du panneau y répond, et c'est le seul endroit qui le fasse.
**3 Pull Requests in the window** : trois stories ont été mergées dans `integration` depuis la
dernière fois que quelque chose est descendu dans votre org.

C'est ce compteur, pas votre mémoire, qui vous dit si un rafraîchissement est nécessaire. Un lundi
après une semaine d'absence, il mérite d'être lu avant toute chose.

### 4. Choisir ce qui descend

Quand le plan est prêt, le panneau se remplit. Les Pull Requests mergées sont listées de la plus
récente à la plus ancienne **(1)** : choisissez la plus ancienne que vous voulez, et tout ce qui va
de là jusqu'à la tête d'`integration` **(2)** descend. En dessous, ce qui diffère entre `integration`
et votre org est listé par type de métadonnée, chaque élément avec sa propre case **(3)**.

![Le panneau Backpromote, avec les Pull Requests mergées et ce qu'elles font descendre](../../_assets/annotated/vscode/backpromote.png)

Parcourez la liste plutôt que de cliquer sur "tout" :

| Ce que vous voyez                                  | Ce qu'il faut faire                                                    |
|----------------------------------------------------|------------------------------------------------------------------------|
| De la métadonnée des trois stories mergées         | **Prenez-la.** C'est tout l'objet de la manœuvre                       |
| Quelque chose que vous êtes en train de construire | **Laissez-le.** Un backpromote écraserait votre travail en cours       |
| Quelque chose que vous ne reconnaissez pas du tout | **Prenez-le.** Si c'est sur `integration`, c'est la vérité de l'équipe |

Pour un fichier que les deux côtés ont modifié, le panneau propose une troisième réponse à côté de
**Overwrite** et **Keep org version** : **Merge**. Il écrit le fichier avec les deux versions
dedans, balisées, et vous choisissez entre elles dans l'éditeur de merge de VS Code, exactement
comme le [Lab 2.7](2-7-resolve-a-git-merge-conflict.md) vous fait résoudre un conflit de Pull Request. Servez-vous-en quand les deux
modifications sont réelles et qu'il vous faut les deux.

La règle en cas d'hésitation : `integration` gagne. C'est la réalité partagée, et votre org en est
une copie que vous avez le droit de modifier temporairement.

### 5. Le lancer et lire le résultat

Cliquez sur **Backpromote to helios-dev** **(1)**. Le panneau déroule l'exécution étape par étape
**(2)**, et quand il a fini il vous dit ce qui s'est passé **(3)**.

![Le panneau Backpromote, terminé, avec son résumé](../../_assets/annotated/vscode/backpromote-result--what-it-did.png)

Lisez le résumé plutôt que la couleur :

- combien d'éléments ont atteint votre org, et combien en ont été supprimés
- sur quelles Pull Requests il a écrit son historique, pour que le backpromote suivant sache où
  commencer

Les trois stories ne portent aucune deployment action. Quand celles que vous ramenez en portent, le
résumé dit aussi combien ont tourné, ont été sautées ou ont échoué, et **combien d'actions manuelles
vous attendent dans la sandbox**, ce que rien ne peut faire à votre place.

Cliquez ensuite sur **Back to `<votre branche>`** **(4)**. C'est le dernier bouton du panneau et
celui que les gens ratent, et la note suivante explique pourquoi il compte.

<details markdown="1"><summary>Sous le capot : ce que Backpromote vient de faire</summary>

Le panneau a lancé :

    sf hardis:work:backpromote

qui a :

1. Récupéré `integration` et l'a comparée à votre branche
2. Construit un plan : les composants qui diffèrent, et pour chacun s'il est ajouté, modifié ou
   supprimé
3. Déployé ceux que vous avez sélectionnés dans votre org de dev, avec le même moteur de déploiement
   que la CI
4. Noté ce qu'il a fait, pour qu'une deuxième exécution ne refasse pas le même travail

Trois choses qu'il ne fait délibérément **pas**, et les connaître économise un après-midi :

- **Il n'apporte pas d'enregistrements tout seul.** Il déploie de la métadonnée, et il lance les
  deployment actions que les Pull Requests mergées ont déclarées, ce qui est l'endroit où vivrait un
  chargement de données. Si la story d'un collègue avait besoin de données de référence et que
  personne n'a déclaré d'action pour cela, ces données ne sont pas dans votre org, et aucun
  déploiement ne les y mettra jamais. Le [Lab 2.4](2-4-ship-reference-data-and-a-batch-with-deployment-actions.md) traite exactement de ce problème
- **Il n'annule pas ce que vous avez fait à la main.** Si vous avez modifié dans votre org quelque
  chose qu'`integration` a aussi modifié, le déploiement l'écrase. C'est pour cela que vous lisez la
  liste
- **Il ne touche pas aux orgs partagées.** Un backpromote refuse une org de production, et toute org
  dans laquelle déploie une branche majeure. Il n'écrit jamais que dans une sandbox de développeur,
  une scratch org ou une org Developer Edition

Et une chose qu'il fait et que personne n'attend la première fois :

!!! warning "Il vous laisse sur la branche de backpromote"
    Le déploiement tourne depuis une branche appelée `backpromote/integration/<votre org>`, et **le
    checkout y reste quand la commande se termine**. Le panneau le dit, et propose le bouton
    **Back to `<votre branche>`** **(4)** pour le défaire : il restaure les modifications qu'il avait
    mises de côté avant l'exécution, puis propose un merge de la branche parente.

    Prenez ce bouton. Si vous ne le faites pas, **New User Story** repart quand même de la cible que
    vous choisissez, rien ne casse donc, mais ce que vous aviez en cours reste rangé derrière une
    branche que vous avez oubliée. La branche sur laquelle vous êtes est toujours dans le coin en bas
    à gauche de VS Code.

L'historique n'est pas sur votre ordinateur non plus. sfdx-hardis note ce qui a atteint votre sandbox
dans un **commentaire Backpromotes** sur chaque Pull Request qu'il a fait descendre, pour que le
backpromote suivant sache où commencer, depuis n'importe quelle machine et n'importe quel collègue.
C'est aussi pourquoi la commande a besoin d'un token de fournisseur git : sans lui, elle ne peut pas
lire son propre historique, et elle s'arrête.

<!-- command-links:start -->
Documentation de la commande : [hardis:work:backpromote](https://sfdx-hardis.cloudity.com/hardis/work/backpromote/)
<!-- command-links:end -->

</details>

## Ce que vous devez voir

Ouvrez `helios-dev` et vérifiez que la métadonnée des trois stories mergées y est. En particulier
`Panels_Required__c` et `Crew_Notes__c` du Niveau 1, si vous avez fait le Niveau 1 dans une autre
org.

## En cas de problème

**Le panneau dit qu'il n'y a rien à backpromoter.**
Votre org est déjà au niveau d'`integration`, ce qui arrive si vous venez de terminer le Niveau 1
dans la même org. Rien à faire : passez à la suite.

**Le déploiement échoue sur un composant qui dépend d'autre chose.**
Prenez l'ensemble complet plutôt qu'un sous-ensemble. La métadonnée a des dépendances, et une demi-
story ne se déploie souvent pas.

**Votre propre travail en cours a été écrasé.**
Il était dans la liste et vous l'avez pris. Reconstruisez-le dans l'org : il est toujours dans votre
branche si vous l'aviez commité, et le déploiement n'a changé que l'org.

## Vérifiez votre travail

Welcome page > **Training: Level 2** > **Check my work**, puis choisissez le **Lab 2.1**.

## Pour aller plus loin

- [Backpromote](https://sfdx-hardis.cloudity.com/salesforce-devops-backpromote/)

[Suite : Lab 2.2 - Corriger une erreur de déploiement due à une dépendance manquante](2-2-fix-a-missing-dependency-deployment-error.md){ .md-button .md-button--primary }

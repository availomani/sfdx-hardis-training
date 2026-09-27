---
id: lab-2-1
title: "Lab 2.1 - Backpromote : remettre votre org au niveau de l'équipe"
description: "Votre org de développement est en retard sur integration. Faites-y entrer les stories mergées par vos collègues avec le panneau Backpromote de sfdx-hardis, en gardant votre propre travail."
level: 2
lab: 1
lang: fr
source_rev: "6af1d01c9f033ddcbab49bac53353ec66cfd482b"
screenshots:
  - annotated/vscode/sidebar-commands-custom-menu-2--training-menu
  - annotated/web/github-pr-files
  - annotated/web/github-pr-merge
  - annotated/web/github-pr-merge-squash
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

Les deux semaines d'absence doivent exister avant que vous puissiez les rattraper. Romain n'existe
pas, mais son travail si : la formation le rejoue dans **votre propre** fork, sous la forme d'une
Pull Request que vous mergez.

#### 1a. Lancer Simulate my teammates

Dans la liste des commandes sfdx-hardis, dépliez **Training: Level 2** **(1)** et cliquez sur
**Simulate my teammates** **(2)**. La même entrée se trouve sur la page Welcome, sous
**Training: Level 2**.

![Le menu Training du Niveau 2 dans la liste des commandes sfdx-hardis](../../_assets/annotated/vscode/sidebar-commands-custom-menu-2--training-menu.png)

Un panneau de commande s'ouvre et pose trois questions. Répondez ainsi :

| Question                               | Réponse                                                     |
|----------------------------------------|-------------------------------------------------------------|
| Which teammate work do you need?       | **US-017 Record who signed an installation off**            |
| Create it?                             | **Yes**                                                     |
| Merge it for you once its checks pass? | **Yes**, sauf si vous voulez la merger vous-même (étape 1b) |

Si VS Code demande d'abord comment autoriser la commande Training, choisissez **Always allow**,
comme dans [Lab 1.2](../level-1-contributor-basics/1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md).

La commande crée la branche `training/mate-us-017-sign-off` à partir de votre `integration` actuelle,
commite la modification de Romain sous son nom, la pousse sur votre fork GitHub et ouvre la Pull
Request. Le panneau affiche son adresse : gardez-la, elle sert à l'étape 1b.

Avec **Yes** à la dernière question, le panneau attend ensuite les deux checks de la Pull Request,
deux à quatre minutes environ, et la merge dès qu'ils sont verts tous les deux. Il écrit
**Pull Request merged into its base branch**, puis **Done**. Vous pouvez sauter l'étape 1b et passer
directement à l'étape 2. Si vous la mergez vous-même sur GitHub pendant que le panneau attend, il
s'en aperçoit et s'arrête là aussi.

S'il dit qu'un check a échoué, ou qu'il n'a pas pu merger, rien n'est perdu : la Pull Request est
toujours ouverte, et l'étape 1b permet de terminer.

<details markdown="1"><summary>Sous le capot : ce que Simulate my teammates a fait</summary>

L'entrée Training a lancé :

    node scripts/training.mjs simulate --level 2

Elle a appliqué le jeu de patches de `scripts/simulate/us-017-sign-off/` à votre copie de travail,
l'a commité avec le nom et l'email de Romain, a poussé la branche et ouvert la Pull Request avec
`gh pr create`. Vos propres modifications non commitées, s'il y en avait, ont été mises de côté
d'abord et remises en place à la fin.

Avec **Yes** au merge, elle vous a d'abord rendu votre propre branche, puis a demandé à GitHub
l'état des checks de la Pull Request toutes les vingt secondes (`gh pr checks`), et lancé
`gh pr merge --squash` dès qu'ils étaient tous verts, **Simulate Deployment to Major Org** et
**Mega-Linter** compris. La même règle que le bouton : la branche `integration` de votre fork est
protégée, et GitHub refuserait le merge tant qu'un check est rouge ou en cours.

</details>

#### 1b. Ou la relire et la merger vous-même sur GitHub

Seulement si vous avez répondu **No**, ou si le panneau n'a pas pu merger.

1. Ouvrez la Pull Request : cliquez sur l'adresse affichée par le panneau, ou ouvrez votre fork sur
   GitHub (`github.com/my-username/sfdx-hardis-training`), cliquez sur l'onglet **Pull requests**,
   puis sur **US-017 Record who signed an installation off**
2. Cliquez sur **Files changed** **(1)**. La liste des fichiers à gauche **(2)** en contient deux,
   le permission set `Helios_Delivery_Manager` et le layout `Installation`. Chaque ligne du diff
   **(3)** est une modification, verte quand elle est ajoutée et rouge quand elle est supprimée.
   Romain ne fait qu'ajouter : l'accès en lecture et en modification sur `Signed_Off_By__c`, et le
   champ sur le layout. C'est cela, la relecture : vérifier que la Pull Request fait ce que dit son
   titre, et rien d'autre

   ![L'onglet Files changed d'une Pull Request d'un collègue](../../_assets/annotated/web/github-pr-files.png)

   L'image montre une Pull Request d'un collègue plus tardive, US-052 : la vôtre montre les deux
   fichiers de Romain, et les onglets et les boutons sont les mêmes.

3. Revenez sur l'onglet **Conversation** et descendez en bas de la page. Tant qu'un check tourne
   encore, la boîte indique **Merging is blocked** : attendez, la page se met à jour toute seule.
   Quand elle indique **All checks have passed**, le bouton **Merge pull request** **(1)** est actif

   ![La boîte de merge d'une Pull Request, avec tous les checks passés](../../_assets/annotated/web/github-pr-merge.png)

4. Cliquez sur la petite flèche **(1)** à droite du bouton vert, choisissez **Squash and merge**
   **(2)**, puis cliquez sur **Squash and merge** et **Confirm squash and merge**. Le badge en haut
   de la page devient violet et indique **Merged**

   ![Le menu de méthode de merge d'une Pull Request, avec Squash and merge](../../_assets/annotated/web/github-pr-merge-squash.png)

C'est le même merge qu'au [Lab 1.6](../level-1-contributor-basics/1-6-pull-request-deployment-check-and-merge.md), étape 4. Un
check qui échoue ici n'est pas de votre faute et n'est pas à corriger : relancez **Simulate my
teammates**, elle recrée la branche et la Pull Request.

#### 1c. Où vous en êtes

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

**Simulate my teammates dit qu'aucun check n'a tourné sur la Pull Request.**
L'onglet Checks de la Pull Request est vide : GitHub Actions est désactivé sur votre fork.
Le [Lab 1.6](../level-1-contributor-basics/1-6-pull-request-deployment-check-and-merge.md), étape 2, explique comment l'activer.
Mergez-la ensuite vous-même, étape 1b.

**Le panneau dit "Nothing to commit".**
La modification de Romain est déjà dans votre `integration` : vous l'avez mergée plus tôt, et le
panneau affiche l'adresse de cette Pull Request mergée. Passez à l'étape 2.

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

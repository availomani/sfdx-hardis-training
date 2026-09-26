---
id: lab-3-5
title: "Lab 3.5 - Promouvoir en UAT et écrire les notes de version"
description: "Protégez ce que l'UAT garde pour elle avec package-no-overwrite, promouvez integration vers UAT, lisez ses deployment actions et écrivez les notes de version."
level: 3
lab: 5
lang: fr
source_rev: "f23aca466021abbfa96066a9fe688eb25b279ab8"
screenshots:
  - annotated/vscode/devops-pipeline-level3--create-promotion
  - annotated/vscode/pipeline-branch-modal-level3--what-it-carries
  - annotated/vscode/pipeline-branch-modal-uat--no-merge-target
  - annotated/vscode/package-no-overwrite-edit--add-type
  - annotated/vscode/package-no-overwrite-add-type--type
  - annotated/web/github-pr-promotion-actions
  - annotated/web/github-pr-release-notes
depends_on:
  commands: [hardis:doc:release-notes, hardis:project:deploy:smart]
  flags: []
  config: [mergeTargets, availableTargetBranches, packageNoOverwritePath]
  panels: [pipeline, deploymentAction]
  docs: [salesforce-devops-deploy-major-branches, hardis/doc/salesforce-devops-release-notes]
---

# Lab 3.5 - Promouvoir en UAT et écrire les notes de version

**Niveau** : 3 Release Manager

**Durée** : ~35 min

**Vous allez** : protéger un réglage que l'UAT garde pour elle, faire votre première promotion entre
deux branches majeures, lire les deployment actions qu'elle transporte, et produire le document que
le métier lit vraiment.

## La situation

Tout ce que l'équipe a construit cette semaine est dans `integration`. Les testeurs métier
travaillent en UAT. Lundi matin, ils s'attendent à y trouver le travail de la semaine, avec une note
disant ce qui a changé.

Une promotion entre branches majeures n'est pas une Pull Request de contributeur. Elle transporte
plusieurs stories à la fois, elle peut transporter des deployment actions déclarées des semaines plus
tôt par des personnes différentes, et l'org dans laquelle elle déploie contient de vrais testeurs.

## Avant de commencer

- [ ] [Lab 3.4](3-4-merge-colliding-pull-requests.md) terminé : US-018 et US-019 mergées dans `integration`
- [ ] `helios-uat` connectée : la scratch org créée au Niveau 1, configurée comme org de `uat` depuis
- [ ] Authentification JWT fonctionnelle pour `uat` ([Lab 3.1](3-1-configure-the-pipeline-up-to-production.md))

## Les étapes

### 1. Voir ce que vous êtes sur le point de livrer

Ouvrez le panneau **DevOps Pipeline** et cliquez sur le nœud `integration` du diagramme. Une fenêtre
s'ouvre sur cette branche, intitulée **Pull Requests in integration**.

![La fenêtre de branche d'integration, listant ce qu'elle transporte](../../_assets/annotated/vscode/pipeline-branch-modal-level3--what-it-carries.png)

**Pull Requests** **(1)** est la liste qui compte : chaque Pull Request mergée dans `integration`
depuis la dernière promotion vers `uat`, avec qui l'a mergée et quand. Cette liste **est** la
livraison. Lisez-la avant de créer quoi que ce soit : si une story qui s'y trouve ne doit pas sortir
cette semaine, c'est le moment, pas après le déploiement.

**Deployment Actions** **(2)** est la liste des actions que ces Pull Requests transportaient,
rassemblées au même endroit, et l'étape 4 y revient. **Tickets** à côté est la même chose pour les
stories, chacune avec son titre, lu depuis le backlog que le projet déclare comme son système de
ticketing. Un quatrième onglet, **Apex Tests**, n'apparaît que sur un projet qui active
`enableDeploymentApexTestClasses`, et celui-ci ne le fait pas.

Le pied de page contient les deux boutons qu'utilise l'étape 7 : **(3)** génère les notes de ce qui a
déjà été promu, **(4)** prévisualise les notes de ce qui ne l'a pas été.

!!! note "Vide, avec un sélecteur Go Live à la place ?"
    La fenêtre montre ce qui attend d'être promu **vers l'étage suivant**. Une branche qui n'a pas
    d'étage suivant, c'est-à-dire dont `mergeTargets` est vide, n'a rien à promouvoir : le panneau
    montre donc un sélecteur **Go Live** **(1)** et les notes de version d'un go-live déjà mergé
    dedans, à la place :

    ![La même fenêtre sur une branche sans cible de merge](../../_assets/annotated/vscode/pipeline-branch-modal-uat--no-merge-target.png)

    Sur `main`, c'est la vue normale et elle le restera toujours : la production est la fin du
    pipeline.

    Sur `integration`, cela veut dire que le fichier de branche a perdu sa cible de merge, qu'il
    avait depuis le Lab 1.2. Cliquez sur **Training: Level 3 > Set up my training environment**, qui
    la réécrit. Il rafraîchit l'org et l'URL de connexion d'un fichier qui existe déjà et laisse le
    reste tranquille, ce que vous avez posé au Lab 3.1 survit donc.

### 2. Protéger ce que l'UAT garde pour elle

Un composant de l'application Helios est censé être différent dans chaque org : le remote site
setting `Helios_Warehouse`, l'adresse du système de stock de l'entrepôt avec lequel les lots de
panneaux sont réservés. La production parle au vrai entrepôt, l'UAT au système de test de
l'entrepôt. Un admin a posé cette adresse en UAT à la main, et le repository porte celle de
production.

Voyez-le vous-même : dans `helios-uat`, **Setup > Remote Site Settings**, ouvrez `Helios_Warehouse`,
**Edit**, et mettez **Remote Site URL** à `https://warehouse-test.helios.invalid`, comme l'a fait
l'admin UAT. **Save**.

Passons à la promotion. Elle envoie le package entier, remote site setting compris, et remettrait
l'adresse de production en UAT sans un mot. Le **gestionnaire d'écrasement** est fait exactement pour
cela : tout ce qui est listé dans `manifest/package-no-overwrite.xml` est retiré du déploiement quand
l'org cible le possède déjà, et créé quand elle ne l'a pas.

Le fichier n'existe pas encore, et vous n'avez pas à l'écrire. Dans le panneau **DevOps Pipeline**,
ouvrez le menu **Deployment packages**, celui qui ouvrait **Package XML** au [Lab 1.5](../level-1-contributor-basics/1-5-retrieve-commit-and-publish-your-changes.md), et choisissez
**No Overwrite**. Le visualiseur de package s'ouvre sur une liste vide. Activez le **Edit mode**
**(1)**, puis cliquez sur **Add Type** **(2)**.

![Le visualiseur de package sur la liste no-overwrite vide, en mode édition](../../_assets/annotated/vscode/package-no-overwrite-edit--add-type.png)

Tapez `RemoteSiteSetting`, le nom que Salesforce donne à ce type de composant, dans **Metadata Type
API Name** **(1)**, et cliquez sur **Add** **(2)**.

![La fenêtre Add Metadata Type du visualiseur de package](../../_assets/annotated/vscode/package-no-overwrite-add-type--type.png)

La nouvelle ligne **RemoteSiteSetting** a un bouton **Add member** : cliquez dessus, tapez
`Helios_Warehouse`, et **Add**. Le visualiseur a écrit `manifest/package-no-overwrite.xml` pour vous,
avec la forme de `manifest/package.xml` : un bloc par type de composant, ses membres listés par nom.
**Edit File** l'ouvre en texte, si vous voulez le voir.

Puis **Training: Level 3** > **Publish my pipeline configuration**, et mergez sa Pull Request une
fois verte, comme au [Lab 3.1](3-1-configure-the-pipeline-up-to-production.md) : la liste de ce qui ne doit jamais être écrasé est de la configuration
de pipeline, comme le reste.

!!! note "Créé là où il manque, jamais écrasé là où il est"
    Une org neuve, une sandbox fraîche par exemple, n'a pas encore de `Helios_Warehouse`, et le
    déploiement le crée depuis le repository. À partir de là il appartient à cette org. Le gestionnaire
    d'écrasement ne compare pas les versions : présent veut dire protégé.

### 3. Créer la Pull Request de promotion

Dans le diagramme **DevOps Pipeline**, la flèche d'`integration` vers `uat` porte une pastille
**+ PR** **(1)**. Cliquez dessus : GitHub s'ouvre sur une nouvelle Pull Request d'`integration` vers
`uat`, les deux branches déjà renseignées.

![La pastille + PR sur la flèche d'integration vers uat](../../_assets/annotated/vscode/devops-pipeline-level3--create-promotion.png)

La pastille est là parce qu'aucune Pull Request n'est ouverte sur cette flèche. Dès que vous en créez
une, la pastille est remplacée par le numéro de la Pull Request et son statut.

!!! note "Pas le bouton de promotion de la fenêtre de branche"
    Une fenêtre de branche peut aussi afficher un bouton **Create promotion from <branche> (Beta)**
    et une case à cocher sur chaque ligne. Ce projet active cette fonctionnalité
    ([Lab 3.1](3-1-configure-the-pipeline-up-to-production.md)), mais `allowedPromotionSteps` n'autorise qu'une seule étape, `uat` vers
    `preprod` : la fenêtre d'`integration` n'a donc ni l'un ni l'autre. Vous les rencontrerez tous
    les deux sur la fenêtre d'`uat` à l'étape 7.

    Cette fonctionnalité transporte un **sous-ensemble** de ce qui attend, et elle existe pour la
    semaine où le métier valide une story et pas celle d'à côté. Ce que vous faites ici, c'est tout
    promouvoir, ce que transporte une simple Pull Request d'une branche vers la suivante, et ce que
    vous devriez faire presque toutes les semaines. Le [Lab 3.10](3-10-promote-a-subset-with-promotion-branches.md) est l'exception.

Intitulez-la pour les humains qui la liront, pas pour git, et appelez-la une **promotion** :

> Promotion 2026-09: crew capacity cap, quote PDF

**Release** est le mot réservé à la Pull Request vers `main`, la production, et à rien d'autre. Le
métier lit "release" comme "c'est en ligne", et une Pull Request vers `uat` ne met rien en ligne.
Gardez les deux mots distincts et une liste de Pull Requests se lit comme l'histoire de ce qui a
atteint la production.

Mergez-la avec **Merge pull request**, jamais avec un squash : une promotion transporte chaque commit
des stories qu'elle promeut, et la promotion suivante, le retrofit et les notes de version ont tous
besoin de les retrouver un par un ([Lab 1.6](../level-1-contributor-basics/1-6-pull-request-deployment-check-and-merge.md)).

### 4. Lire les deployment actions qu'elle transporte

Une fois le contrôle lancé, le commentaire sfdx-hardis gagne deux sections, **Pre-deployment Actions
Results** et **Post-deployment Actions Results**. Ce qu'une promotion ajoute par-dessus est le
paragraphe qui nomme la portée **(1)** : chaque Pull Request qu'elle transporte, chacune un lien.

![Les deployment actions rassemblées sur la Pull Request de promotion](../../_assets/annotated/web/github-pr-promotion-actions.png)

Chaque action que n'importe quel contributeur a déclarée sur n'importe laquelle des stories mergées
est rassemblée dans un seul tableau, avec son libellé, son type, son statut et un lien de retour vers
la Pull Request d'où elle vient. Tout ce qui demande un humain reçoit une **liste de cases au-dessus
du tableau**, intitulée *Manual Actions to perform before proceeding with deployment* ou *after
deployment*. Les deux listes atterrissent sur des jobs différents : le job de contrôle porte celle
d'avant **(2)**, pour que vous puissiez agir pendant que vous décidez, et le job de merge porte celle
d'après. Les actions post-déploiement **(3)** affichent **skipped** sur le contrôle : un contrôle ne
change rien dans l'org, elles attendent donc le merge.

**Lisez-le avant de merger.** Deux choses à chercher :

| Ce que vous voyez        | Ce que cela veut dire pour vous                                                                         |
|--------------------------|---------------------------------------------------------------------------------------------------------|
| Une **étape manuelle**   | Quelqu'un doit cliquer quelque chose en UAT. Ce quelqu'un, c'est vous, et cela n'arrivera pas sans plan |
| Un **import de données** | Des enregistrements vont être écrits en UAT. Les testeurs peuvent y avoir les leurs                     |

Vous ne pouvez pas modifier l'action d'un contributeur depuis ici : elle appartient à sa Pull Request
et à toutes les orgs qui suivent celle-ci, une mauvaise action se corrige donc dans une nouvelle Pull
Request et non dans cette promotion.

La liste de cases est l'exception, et ce n'est pas de la décoration. **Cochez une case une fois que
vous avez fait la chose dans l'org**, et le job sfdx-hardis suivant relit la case et note l'action
comme faite. Laissez-la décochée et la promotion suivante vous la redemandera.

### 5. Merger et regarder le déploiement

Mergez la promotion. L'exécution **Process Deployment (sfdx-hardis)** démarre, cette fois sur `uat`.

C'est le premier déploiement vers cette org par la pipeline : il sera donc plus gros que ceux vers
integration, l'UAT est en retard de tout ce que l'équipe a fait. Comptez plusieurs minutes.

L'étape de délivrabilité est une étape **pre-deploy** : sa place est avant le merge, comme le dit
l'étape 4. Si vous l'avez faite dans `helios-uat` et avez coché sa case, le log de ce job le dit :
*Manual action Set Email Deliverability to All Email has been confirmed as done in org branch uat*.
Sinon, faites-la maintenant et cochez la case : le prochain job qui porte cette Pull Request
l'enregistre.

Puis lisez le log à la recherche du gestionnaire d'écrasement, au-dessus du déploiement, parmi les
lignes qui commencent par `[NoOverwrite]` :

```
Type RemoteSiteSetting: 1 item(s) skipped because they already exist in the target org (protected), 0 item(s) to deploy
```

`helios-uat` a déjà `Helios_Warehouse`, la promotion l'a donc laissé hors du package, et le
**Final package.xml to deploy** affiché juste après a un élément de moins.

### 6. Vérifier avec des yeux de testeur

Ouvrez `helios-uat` et vérifiez que les deux stories sont réellement utilisables, pas seulement
déployées :

- Une équipe plus grande que le plafond est ramenée au plafond à l'enregistrement. La règle s'exécute
  quand une installation planifiée reçoit son équipe, et UAT n'en a plus aucune au statut planifié
  depuis le remplissage de la taille d'équipe du [Lab 2.3](../level-2-contributor-advanced/2-3-fix-broken-records-with-an-apex-deployment-action.md) : créez-en une. Sur n'importe quelle
  installation, mettez `Status` à `Planned`, `Crew Capacity Cap` à 3 et `Crew Size` à 6 dans la même
  modification, et enregistrez. Il affiche 3, et elle est passée à `Scheduled`
- La permission du PDF de devis est sur le permission set des managers
- **Setup > Remote Site Settings** dit toujours `https://warehouse-test.helios.invalid` pour
  `Helios_Warehouse` : la promotion ne l'a pas touché

Déployé et utilisable sont deux états différents, et l'écart entre eux est presque toujours une
permission ou une donnée de référence.

### 7. Générer les notes de version

Ouvrez le panneau **DevOps Pipeline** et cliquez sur le nœud `uat`, comme vous aviez cliqué sur
`integration` à l'étape 1. Dans le pied de page de cette fenêtre, le bouton de gauche affiche
maintenant **Generate Promotion Notes for uat**. Cliquez dessus.

Cette fenêtre a la colonne de cases à cocher et le bouton **Create promotion from uat (Beta)** dont
parlait la note ci-dessus, parce qu'`uat` est la source de la seule étape de promotion que ce projet
autorise. Ignorez les deux jusqu'au [Lab 3.10](3-10-promote-a-subset-with-promotion-branches.md).

Il pose une question, **Select the merge commit for this release or promotion**, en listant les
merges qui ont atterri sur `uat`, du plus récent au plus ancien. Prenez celui du haut, **Merge pull
request #N from *votre-pseudo*/integration** : la promotion que vous venez de merger. Les notes
couvrent ce que ce merge a apporté dans `uat`, et rien d'avant.

Le bouton est nommé d'après ce qu'est la branche. `uat` merge dans `preprod` : ce qui y est arrivé
est donc une promotion. Sur une branche sans cible de merge, `main`, le même bouton affiche
**Generate Release Notes for Latest Release in main**, et une fois que vous choisissez un go-live
dans le sélecteur en haut de la fenêtre, il affiche **Generate Release Notes for** ce go-live.

À côté, **Preview Upcoming Promotion Notes from uat** fait la même chose pour ce qui n'a pas encore
été promu. C'est celui à utiliser un mercredi, quand quelqu'un demande ce que contiendra la livraison
de jeudi.

Vous obtenez un document markdown listant les Pull Requests, leurs auteurs, leurs stories et les
étapes manuelles, généré depuis l'historique des merges plutôt que depuis la mémoire de quelqu'un. Il
atterrit sous `hardis-report/release-notes/`, dans un dossier nommé d'après le tag de version et la
date, ou d'après la branche cible et la date quand il n'y a pas de tag, donc ici `uat-<date>`.
Markdown et PDF à chaque fois, plus un tableur quand il y a de quoi le remplir.

Sur cette promotion, les notes générées s'ouvrent ainsi :

```
# Promotion Notes - uat

| Metric           | Value |
|------------------|-------|
| Pull Requests    | 19    |
| Tickets          | 15    |
| Contributors     | 1     |
| Added / Modified | 33    |
```

Viennent ensuite un tableau des tickets, un des Pull Requests avec leurs auteurs et dates de merge,
les métadonnées modifiées par type, et les deployment actions avec leur statut dans `uat` : l'étape
manuelle de délivrabilité **success** si vous avez coché sa case avant le merge et **manual**
sinon, les imports et la planification **success**.

Lisez-les puis améliorez-les. Des notes générées sont une liste complète, et une note de version que
le métier lit a besoin de deux choses que le générateur ne peut pas connaître :

1. **Une phrase en haut disant à quoi sert cette livraison.** "Les équipes ne peuvent plus être
   surdimensionnées, et les commerciaux peuvent générer des PDF de devis."
2. **Les étapes manuelles, formulées comme des instructions à une personne nommée**, pas comme une
   liste technique

Puis donnez-les aux gens qui les lisent. Ouvrez la Pull Request de promotion que vous avez mergée,
**...** en haut à droite de sa description, **Edit**, et collez les notes améliorées à la place de la
description d'une ligne. Une Pull Request mergée reste modifiable, et c'est là qu'est la livraison :
son lien est ce que vous envoyez au métier, et ce vers quoi les notes de version de la promotion
suivante renvoient.

![Les notes de version améliorées, dans la description de la Pull Request de promotion](../../_assets/annotated/web/github-pr-release-notes.png)

La phrase **(1)** dit à quoi sert la promotion, dans les mots du métier. L'étape manuelle **(2)**
nomme qui la fait, où, et ce qui casse si personne ne la fait. Le reste est un court tableau de ce
qu'il faut tester, et un pointeur vers la liste générée complète pour qui la veut.

<details markdown="1"><summary>Sous le capot : ce qui a généré les notes, et ce qu'est vraiment une promotion</summary>

La commande était :

    sf hardis:doc:release-notes --mode post --target-branch uat

qui parcourt l'historique git entre deux références, rassemble les commits de merge, fait
correspondre chacun à sa Pull Request via l'API du fournisseur git, et en tire le titre, l'auteur, le
corps et les deployment actions déclarées.

**Cet appel d'API est la partie qui peut échouer en silence.** La commande a besoin d'un token de
fournisseur git, pris dans l'environnement (`GITHUB_TOKEN` ou `CI_SFDX_HARDIS_GITHUB_TOKEN` sur
GitHub). Sans token, elle ne s'arrête pas : elle avertit, rassemble zéro Pull Request, et vous écrit
un document parfaitement mis en forme et vide. Une note de version vide est plus souvent un token
manquant qu'une livraison vide.

**C'est aussi pourquoi une promotion n'est jamais squashée.** Les notes retrouvent chaque story
depuis le commit que sa Pull Request a laissé sur `integration`, commit de merge ou commit unique
d'un squash indifféremment : c'est pourquoi une Pull Request de feature peut être squashée. Une
promotion squashée dans `uat` remplacerait tous ces commits par un seul qu'aucune story n'a produit,
et les notes d'`uat` nommeraient la promotion et rien de ce qu'elle transportait. Le rapport DORA du
[Lab 3.6](3-6-release-to-production-and-read-dora-metrics.md) s'appuie sur le même lien.

**Une promotion est une Pull Request ordinaire.** Il n'y a pas de machinerie de promotion spéciale
dans l'installation par défaut : `integration` dans `uat` est une branche mergée dans une autre
branche, et le job de déploiement sur `uat` se comporte comme celui sur `integration`. Ce qui diffère
est seulement ce que la configuration dit d'`uat` : son org, ses cibles de merge, et si le
déploiement delta s'applique entre branches majeures
(`enableDeltaDeploymentBetweenMajorBranches`, désactivé par défaut, parce qu'une promotion est le
pire moment pour découvrir que l'org cible a dérivé).

Il existe une fonctionnalité en Beta pour les équipes qui doivent promouvoir un **sous-ensemble** de
ce qui attend, plutôt que tout : les [branches de
promotion](https://sfdx-hardis.cloudity.com/salesforce-devops-promotion-branches/). Le
[Lab 3.10](3-10-promote-a-subset-with-promotion-branches.md) s'en sert, délibérément tard, parce que cela prend son sens une fois que vous avez
fait quelques livraisons de la façon ordinaire.

<!-- command-links:start -->
Documentation de la commande : [hardis:doc:release-notes](https://sfdx-hardis.cloudity.com/hardis/doc/release-notes/)
<!-- command-links:end -->

</details>

## Ce que vous devez voir

- La branche `uat` portant tout ce qu'`integration` avait
- Une exécution **Process Deployment (sfdx-hardis)** verte sur `uat`
- Les deux stories fonctionnelles dans `helios-uat`
- `Helios_Warehouse` dans `helios-uat` pointant toujours vers l'entrepôt de test
- Les notes de version dans la description de la Pull Request de promotion

## En cas de problème

**Le contrôle échoue avec des erreurs d'authentification pour uat.**
[Lab 3.1](3-1-configure-the-pipeline-up-to-production.md) pour la branche `uat` : les secrets, et la pré-autorisation de l'External Client App dans
`helios-uat`.

**Le déploiement échoue sur quelque chose qui marchait en integration.**
Les orgs diffèrent. En général il manque en UAT une fonctionnalité, une licence, ou un composant que
quelqu'un y a supprimé à la main. Lisez l'erreur et vérifiez l'org.

**La Pull Request de promotion montre des centaines de fichiers.**
C'est attendu sur une première promotion : l'UAT est en retard de tout l'historique. Cela se calme
après celle-là.

**Les notes de version sont vides.**
Trois causes, par ordre de probabilité : le mauvais commit de merge a été choisi, vérifiez donc que
le haut de la liste était bien la promotion ; pas de token de fournisseur git dans l'environnement,
la recherche de Pull Requests n'a donc rien renvoyé et s'est contentée d'avertir ; ou les merges ont
été squashés, il n'y a donc aucun lien à retrouver.

## Vérifiez votre travail

Welcome page > **Training: Level 3** > **Check my work**, puis choisissez le **Lab 3.5**.

## Pour aller plus loin

- [Déployer vers les orgs majeures](https://sfdx-hardis.cloudity.com/salesforce-devops-deploy-major-branches/)
- [Notes de version](https://sfdx-hardis.cloudity.com/hardis/doc/salesforce-devops-release-notes/)

[Suite : Lab 3.6 - Livrer en production et lire vos métriques DORA](3-6-release-to-production-and-read-dora-metrics.md){ .md-button .md-button--primary }

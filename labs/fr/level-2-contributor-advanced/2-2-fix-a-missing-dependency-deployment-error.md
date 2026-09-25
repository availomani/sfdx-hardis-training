---
id: lab-2-2
title: "Lab 2.2 - Corriger une erreur de déploiement due à une dépendance manquante"
description: "Modifiez un flow Salesforce existant, puis lisez correctement un contrôle de déploiement de Pull Request en échec et ajoutez le champ que le package avait oublié."
level: 2
lab: 2
lang: fr
source_rev: "73eac21691ef803b05712d5adfd945e732097fd5"
screenshots:
  - annotated/web/github-pr-check-failed
  - annotated/web/github-pr-flow-diff
  - annotated/salesforce/flow-builder-crew-warning
  - annotated/salesforce/flow-builder-start-conditions
  - annotated/salesforce/flow-builder-formula
  - annotated/salesforce/flow-builder-add-element
  - annotated/vscode/pipeline-cards--new-user-story
  - annotated/vscode/metadata-retriever
  - annotated/vscode/pipeline-cards--save-publish
depends_on:
  commands: [hardis:work:new, hardis:work:save, hardis:project:deploy:smart]
  flags: [--check]
  config: []
  panels: [pipeline, packageXml]
  docs: [salesforce-devops-solve-deployment-errors, salesforce-devops-retrieve]
---

# Lab 2.2 - Corriger une erreur de déploiement due à une dépendance manquante

**Niveau** : 2 Contributeur avancé

**Durée** : ~25 min

**Vous allez** : modifier un flow qui tourne déjà en production, rencontrer votre premier contrôle de
déploiement en échec, lire l'erreur correctement, et trouver ce que votre package a oublié.

## La situation

> **US-021 - Warn the planner when a crew is too small**
>
> As a planner, I want one warning on the installation when the assigned crew is smaller than the
> panels need, so that I fix it before the van leaves, and not a new task every time I save.

Le flow existe déjà. `Installation Crew Warning` est arrivé avec l'application Helios quand vous avez
monté vos orgs au Niveau 1 : il crée une tâche pour le planificateur dès que moins de deux personnes
sont affectées, et il le fait à **chaque** enregistrement, ce dont les planificateurs se plaignent.
Vous le modifiez, vous le publiez, et le contrôle échoue avec une erreur à propos d'un champ que vous
avez pourtant sous les yeux dans l'org.

Ce lab parle de l'écart entre "ça existe dans mon org" et "c'est dans le package".

## Avant de commencer

- [ ] [Lab 2.1](2-1-backpromote-your-teammates-work.md) terminé
- [ ] `helios-dev` au niveau d'`integration`

## Les étapes

### 1. Prendre la story

Dans le panneau **DevOps Pipeline**, sous **Project Contribution Workflow** **(1)**, cliquez sur
**New User Story** **(2)**, la même carte qu'au [Lab 1.3](../level-1-contributor-basics/1-3-start-a-user-story-on-a-git-branch.md).

![Les cartes de contribution du panneau DevOps Pipeline](../../_assets/annotated/vscode/pipeline-cards--new-user-story.png)

Répondez : type **Feature**, nom `US-021-crew-size-warning`, org `helios-dev`. La cible est
`integration` sans qu'on vous le demande, comme au Niveau 1.

### 2. Modifier le flow d'avertissement

D'abord le champ dont le flow a besoin pour ne pas avertir deux fois. Dans `helios-dev`,
**Setup > Object Manager > Installation > Fields & Relationships > New** :

| Paramètre     | Valeur                 |
|---------------|------------------------|
| Data Type     | **Checkbox**           |
| Field Label   | `Crew Warning Sent`    |
| Field Name    | `Crew_Warning_Sent__c` |
| Default Value | Décoché                |

Laissez **Visible** décoché pour tous les profils, comme au Lab 1.4, et sur le dernier écran
décochez **Installation Layout** : personne d'autre que le flow n'a besoin de cette case, elle ne va
donc sur aucune page.

Puis le flow. **Setup > Flows**, ouvrez **Installation Crew Warning**. Il est actif, Flow Builder
ouvre donc la version qui tourne : chaque modification que vous faites est enregistrée comme une
**nouvelle version**, et l'ancienne continue de tourner jusqu'à ce que vous activiez la vôtre.

![Le flow Installation Crew Warning dans Flow Builder](../../_assets/annotated/salesforce/flow-builder-crew-warning.png)

Trois modifications, et l'image ci-dessus montre où chacune commence :

1. Élément **Start** : cliquez sur **Edit** **(1)** dessus. Sous **Set Entry Conditions**, le flow
   tourne déjà quand `Crew Size` n'est pas nul **(1)**. Cliquez sur **Add Condition** **(2)** et
   ajoutez la seconde, `Panels Required`, **Is Null**, `False`, puis **Done** en bas du panneau

    ![Les conditions d'entrée de l'élément Start](../../_assets/annotated/salesforce/flow-builder-start-conditions.png)

2. La décision **Crew Too Small** lit une ressource de type formule, `crewTooSmall`. Ouvrez la
   **Toolbox** **(2)** en haut à gauche du canevas, et cliquez sur `crewTooSmall` sous **Formulas**.
   Mettez à jour sa **Description** **(1)**, `True when eight panels a person do not cover the job,
   and no warning was sent yet`, et remplacez sa **Formula** **(2)** par celle ci-dessous, puis
   **Done** **(3)** :

    ![La fenêtre Edit Formula de la ressource crewTooSmall](../../_assets/annotated/salesforce/flow-builder-formula.png)

    ```
    AND(
      {!$Record.Crew_Size__c} * 8 < {!$Record.Panels_Required__c},
      NOT({!$Record.Crew_Warning_Sent__c})
    )
    ```

    Une personne pose environ huit panneaux par jour : l'équipe est trop petite quand huit panneaux
    par personne ne couvrent pas le chantier, et l'avertissement ne part que s'il n'a pas déjà été
    envoyé. Copiez-la plutôt que de la taper
3. Après **Create Warning Task**, cliquez sur le **+** **(3)** sur la ligne en dessous, et choisissez
   **Update Triggering Record** **(1)** sous **Shortcuts**. Appelez l'élément `Mark Warning Sent`,
   donnez-lui une description, et mettez `Crew Warning Sent` à `True`. Reliez ensuite son chemin
   **fault** à l'élément `Log Fault` existant, comme l'élément de tâche

    ![Le menu Add Element, avec Update Triggering Record](../../_assets/annotated/salesforce/flow-builder-add-element.png)

**Save As New Version** **(4)**. La fenêtre qui s'ouvre contient la description du flow : remplacez-la
par `Warns the planner when the crew assigned to an installation is too small for the panels it
needs.`, puisque le flow ne prévient plus à chaque enregistrement. Puis **Activate**, le bouton qui remplace **Deactivate** sur la
nouvelle version.

!!! info "Pourquoi le flow a un chemin de fault"
    Un élément d'enregistrement qui n'en a pas échoue en silence : le flow s'arrête, l'utilisateur ne
    voit rien, et la Task censée avertir le planificateur n'apparaît jamais. Sur un vrai projet, le
    chemin de fault envoie le message quelque part où quelqu'un le lit. Ici il se contente de le
    garder, parce que ce que la pipeline contrôle est qu'un chemin de fault existe. Le flow d'origine
    en avait déjà un, et votre nouvel élément le suit.

Testez : ouvrez une installation, mettez `Panels Required` à 40 et `Crew Size` à 2, enregistrez. Une
tâche apparaît dans son **Activity**. Enregistrez à nouveau : pas de deuxième tâche. C'est la story
qui fonctionne, dans votre org. La case à cocher elle-même reste invisible : aucun permission set ne
l'accorde, parce que personne d'autre que le flow n'en a besoin.

### 3. Publier le flow, et regarder le contrôle échouer

Faites-le descendre comme le Niveau 1 vous l'a appris : **DevOps Pipeline > Commit changes**,
**Recent Changes**, **Search Metadata**. La story porte sur le flow, cochez donc le flow
`Installation_Crew_Warning`, récupérez-le, et commitez-le depuis **Source Control**.

!!! warning "Regardez ce que vous n'avez pas récupéré"
    Le retriever a aussi listé `Installation__c.Crew_Warning_Sent__c`, le champ que vous avez créé en
    premier. Vous l'avez laissé décoché, et rien n'a rien dit. Continuez et publiez quand même : tout
    l'intérêt de ce lab est de rencontrer l'échec qui suit, et d'apprendre à le lire.

Puis **Save / Publish** **(1)**.

![La carte Save / Publish du panneau DevOps Pipeline](../../_assets/annotated/vscode/pipeline-cards--save-publish.png)

Poussez, ouvrez la Pull Request vers `integration` dans votre fork (votre copie personnelle du
repository du cours sur GitHub, par exemple `github.com/my-username/sfdx-hardis-training`), et
attendez.

Le contrôle échoue, et le commentaire sfdx-hardis sur la Pull Request nomme le composant sous
**Deployment errors** **(1)** :

![Le commentaire sfdx-hardis d'un contrôle de déploiement en échec](../../_assets/annotated/web/github-pr-check-failed.png)

```
Installation_Crew_Warning field integrity exception: unknown (The field "Crew_Warning_Sent__c"
for the object "Installation__c" doesn't exist.)
```

Sous **Flow changes** **(2)**, le commentaire pointe vers un deuxième commentaire à lui : le diff
visuel du flow. Il dessine le flow, et colore ce que votre story a modifié. Le nouvel élément
**Mark Warning Sent** est en vert **(1)**, et les tableaux sous le schéma marquent chaque propriété
modifiée avec un carré rouge pour l'ancienne valeur et un vert pour la nouvelle : la description
**(2)**, la formule **(3)**. Un relecteur lit votre modification de flow là, sans ouvrir Flow Builder
ni son XML.

![Le diff visuel du flow Installation Crew Warning, publié sur la Pull Request](../../_assets/annotated/web/github-pr-flow-diff.png)

Votre Pull Request ne peut pas être mergée tant que ce contrôle est rouge : `integration` la refuse,
pour vous comme pour n'importe qui.

Lisez cela deux fois. Le champ **existe**. Vous le voyez dans l'org. Vous l'avez créé il y a dix
minutes et le flow que vous venez de tester le lit.

### 4. Lire le package avant de lire quoi que ce soit d'autre

Quand un déploiement dit que quelque chose n'existe pas, la première question n'est jamais "est-ce
dans l'org". C'est **"est-ce dans le package"**.

Ouvrez le package : panneau **DevOps Pipeline**, menu **Deployment packages**, **Package XML**, comme
au [Lab 1.5](../level-1-contributor-basics/1-5-retrieve-commit-and-publish-your-changes.md). Tapez `Crew_Warning` dans sa zone de filtre. La ligne **Flow** liste votre flow.
**CustomField** ne liste pas `Installation__c.Crew_Warning_Sent__c`.

On envoie à l'org d'intégration un flow qui lit un champ que le package ne porte pas, et l'org
d'intégration n'a pas ce champ non plus. Du point de vue de Salesforce, l'erreur est exactement
juste.

Le package est construit à partir de ce que vos commits ont changé, et le champ n'a jamais été
commité : regardez là où vivent les champs,
`force-app/main/default/objects/Installation__c/fields/`, il n'y est pas. Il n'existe qu'à un seul
endroit, `helios-dev`, et une pipeline ne lit jamais l'org d'un développeur.

### 5. Récupérer ce dont le flow dépend

Ouvrez le panneau **Metadata Retriever** :

1. Vérifiez que l'org en haut à droite **(1)** est `helios-dev`
2. Tapez `Crew_Warning_Sent__c` dans **Metadata Name** **(2)**
3. Cliquez sur **Search Metadata** **(3)**, puis cochez le champ dans les résultats et récupérez-le

![Le panneau Metadata Retriever, avec son sélecteur d'org, ses filtres et le bouton Search Metadata](../../_assets/annotated/vscode/metadata-retriever.png)

Le champ apparaît sous `force-app/main/default/objects/Installation__c/fields/`.

L'habitude à retenir : quand vous modifiez quelque chose qui **lit** un autre composant, récupérez
aussi ce composant. Un flow lit des champs, une présentation de page les affiche, un permission set
les accorde. Tout ce qui est nouveau parmi eux voyage avec la story, ou la story ne se déploie pas.

### 6. Publier à nouveau

Le champ est maintenant dans `force-app/`. Commitez-le depuis **Source Control**, puis **Save /
Publish** à nouveau. `manifest/package.xml` liste à la fois le champ et le flow. Poussez, et le
contrôle passe au vert. Mergez.

<details markdown="1"><summary>Sous le capot : pourquoi l'erreur disait ce qu'elle disait</summary>

Le job de contrôle a lancé :

    sf hardis:project:deploy:smart --check

qui a remis `manifest/package.xml` à Salesforce comme déploiement de validation : la liste que Save /
Publish tient à jour à partir du diff git entre votre branche et `integration`. Salesforce a compilé
le flow, cherché `Installation__c.Crew_Warning_Sent__c` dans le package **et** dans l'org cible, ne
l'a trouvé ni dans l'un ni dans l'autre, et a refusé.

Le point important est l'ordre des deux questions :

1. **Est-ce dans le package ?** `manifest/package.xml`, et derrière lui le diff git : ce que vous
   avez récupéré et commité
2. **Est-ce dans l'org cible ?** Ne posez celle-ci qu'une fois que la réponse à la première est oui

La plupart des erreurs de déploiement qui disent "does not exist" relèvent de la question 1, et la
plupart des gens passent vingt minutes sur la question 2 d'abord.

**Le flow est parti comme une nouvelle version.** Un flow est versionné dans l'org : Flow Builder a
enregistré le vôtre en version 2, et le déploiement envoie sa définition. L'org d'intégration garde
sa version 1 en historique, inactive, exactement comme `helios-dev` le fait.

<!-- command-links:start -->
Documentation de la commande : [hardis:project:deploy:smart](https://sfdx-hardis.cloudity.com/hardis/project/deploy/smart/)
<!-- command-links:end -->

</details>

## Ce que vous devez voir

- `manifest/package.xml` listant `Installation__c.Crew_Warning_Sent__c` et
  `Installation_Crew_Warning`
- Le contrôle de la Pull Request vert
- Après le merge, le flow présent et actif dans `helios-integration`

## En cas de problème

**La récupération ne ramène rien.**
Le sélecteur d'org du Metadata Retriever pointe vers une autre org. Il doit indiquer `helios-dev`, là
où vous avez créé le champ.

**Le contrôle échoue maintenant parce que le flow est inactif.**
Salesforce refuse, dans certaines configurations, de déployer un flow actif par-dessus un flow actif
de même version. Désactivez l'ancienne version dans l'org cible, ou incrémentez la version du flow
dans votre org et récupérez à nouveau.

**Le contrôle échoue sur un champ de Task.**
Votre élément Create Records renseigne un champ que l'org d'intégration n'a pas, parce que vous en
avez choisi un propre à votre org. Simplifiez : le sujet et le WhatId suffisent.

## Vérifiez votre travail

Welcome page > **Training: Level 2** > **Check my work**, puis choisissez le **Lab 2.2**.

## Pour aller plus loin

- [Résoudre les erreurs de déploiement](https://sfdx-hardis.cloudity.com/salesforce-devops-solve-deployment-errors/)
- [Problèmes de récupération de sources](https://sfdx-hardis.cloudity.com/salesforce-devops-retrieve/)

[Suite : Lab 2.3 - Réparer des enregistrements cassés avec une deployment action Apex](2-3-fix-broken-records-with-an-apex-deployment-action.md){ .md-button .md-button--primary }

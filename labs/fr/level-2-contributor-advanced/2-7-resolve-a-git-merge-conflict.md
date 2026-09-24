---
id: lab-2-7
title: "Lab 2.7 - Résoudre un conflit de merge Git avec un collègue"
description: "Une collègue a mergé en premier sur le même flow et le même permission set. Résolvez les deux conflits Git dans VS Code sans perdre le travail de personne."
level: 2
lab: 7
lang: fr
source_rev: "a34ea6fe2995834d2ab32fd72793082b541c84c8"
screenshots:
  - annotated/vscode/sidebar-commands-custom-menu-2--training-menu
  - annotated/vscode/pipeline-cards--new-user-story
  - annotated/vscode/git-palette-fetch--fetch
  - annotated/vscode/git-palette-merge--merge
  - annotated/vscode/git-merge-pick--origin-integration
  - annotated/vscode/git-merge-conflicts--merge-changes
  - annotated/vscode/git-merge-editor--parts
  - annotated/vscode/git-merge-editor--accept-both
  - annotated/vscode/git-merge-editor-accepted--result
depends_on:
  commands: [hardis:work:save, hardis:work:refresh]
  flags: []
  config: [autoCleanTypes]
  panels: [pipeline, commandExecution]
  docs: [salesforce-devops-work-on-user-story-profiles, salesforce-devops-config-overwrite]
---

# Lab 2.7 - Résoudre un conflit de merge Git avec un collègue

**Niveau** : 2 Contributeur avancé

**Durée** : ~35 min

**Vous allez** : affronter un vrai conflit de merge sur deux fichiers qui entrent en conflit de façon
très différente, et résoudre les deux sans perdre le travail de personne.

## La situation

Mariia Pyvovarchuk travaillait sur **US-018 - Cap the crew size a planner can assign**, dans le même
flow et le même permission set que vous. Elle a mergé ce matin. Pas vous.

> Les conflits Git sur un projet Salesforce prennent presque toujours l'une de deux formes : un
> permission set où deux personnes ont ajouté des entrées différentes, et un Flow où deux personnes
> ont changé la logique. Le premier est mécanique. Le second exige que vous compreniez les deux
> modifications.

## Avant de commencer

- [ ] [Lab 2.6](2-6-permission-sets-and-profiles.md) terminé et mergé
- [ ] Rien en attente dans le panneau **Source Control** auquel vous teniez encore

## Les étapes

### 1. Démarrer votre propre modification

**New User Story** **(2)**, sous **Project Contribution Workflow** **(1)**. Nom
`US-034-crew-override`, org `helios-dev`.

![La carte New User Story du panneau DevOps Pipeline](../../_assets/annotated/vscode/pipeline-cards--new-user-story.png)

Dans `helios-dev` :

1. Ouvrez le flow `Installation Assign Crew` et ajoutez une décision pour qu'une installation dont le
   type de toiture est `Flat` reçoive une équipe d'au moins 3 personnes, quoi que le flow ait décidé
   par ailleurs. Reliez-la à la **même affectation** sur laquelle le flow se termine déjà, pour que
   la nouvelle règle tourne après le changement de statut
2. Sur le permission set `Helios Delivery Manager`, accordez l'accès en écriture sur
   `Installation__c.Crew_Notes__c`, pour qu'un planificateur puisse dire pourquoi une équipe a été
   renforcée

Récupérez le flow et le permission set, commitez-les, et **arrêtez-vous là** : ne publiez pas encore.

### 2. Pendant que vous construisiez, Mariia a mergé

Mariia n'existe pas. Son travail, si, et la formation le reproduit à l'intérieur de **votre propre**
fork pour que vous puissiez réellement le relire et le merger. Faites-le **après** que votre propre
modification existe, parce que c'est la situation dont parle ce lab : vous avez branché, elle a
mergé, et aucun des deux ne savait pour l'autre.

**Training: Level 2** **(1)** > **Simulate my teammates** **(2)**, depuis la Welcome page ou depuis
la liste des commandes sfdx-hardis, et choisissez
**US-018 Cap the crew size a planner can assign**.

![Le menu Training du niveau 2 dans la liste des commandes sfdx-hardis](../../_assets/annotated/vscode/sidebar-commands-custom-menu-2--training-menu.png)

Cela crée la branche `training/mate-us-018-crew-capacity` à partir de votre `integration` actuelle,
commite les modifications de Mariia sous son nom, la pousse sur votre fork (votre copie personnelle
du repository du cours sur GitHub, par exemple `github.com/my-username/sfdx-hardis-training`), et
ouvre la Pull Request.

Relisez-la rapidement, puis **mergez-la**. Mariia est maintenant dans `integration`, et vous êtes en
retard.

<details markdown="1"><summary>Sous le capot : pourquoi la collègue est rejouée plutôt que préexistante</summary>

La commande a lancé :

    node scripts/training.mjs simulate

qui a copié les fichiers de `scripts/simulate/us-018-crew-capacity/files/` par-dessus votre copie de
travail, les a commités avec le nom et l'e-mail de Mariia, a poussé la branche sur **votre** fork et
y a ouvert la Pull Request avec `gh pr create`.

Il ne peut pas en être autrement. Une Pull Request vit dans un repository : vous ne pouvez pas en
relire une qui existe chez quelqu'un d'autre. Et une branche livrée dans le repository il y a des
mois ne partagerait pas d'ancêtre sensé avec l'`integration` que vous avez construite au fil de cinq
labs : le conflit serait donc soit absent, soit absurde.

Le même jeu de correctifs a produit les vraies Pull Requests de collègues sur le repository public
de formation : ce que vous relisez est donc, octet pour octet, ce que montrent les captures d'écran.

</details>

### 3. Publier, et voir la Pull Request refuser de merger

Publiez maintenant votre propre modification : **Save / Publish**, poussez, et ouvrez la Pull Request
vers `integration`.

GitHub affiche :

> This branch has conflicts that must be resolved
> `force-app/main/default/flows/Installation_Assign_Crew.flow-meta.xml`
> `force-app/main/default/permissionsets/Helios_Delivery_Manager.permissionset-meta.xml`

Deux fichiers, deux sortes de problèmes complètement différentes.

Ni l'un ni l'autre n'est git qui fait des difficultés. Les deux modifications sont réelles, les deux
sont voulues, et dans les deux fichiers vous avez écrit tous les deux au même endroit : Mariia a
accordé un champ sur le permission set à une ligne de là où vous avez accordé le vôtre, et elle a
relié le même élément d'affectation dans le flow à une décision à elle. Un outil de merge ne peut pas
savoir lequel de deux connecteurs doit l'emporter. Vous, si.

### 4. Faire entrer integration dans votre branche

Ouvrez le panneau **Source Control**, l'icône de trois petits cercles reliés par des traits dans la
barre de gauche.

Assurez-vous d'abord que votre machine sait ce que Mariia a mergé. Ouvrez la **Command Palette** :
**View > Command Palette** dans la barre de menus, ou `Ctrl+Shift+P` (`Cmd+Shift+P` sur un Mac).
Tapez `Git: Fetch` et choisissez **Git: Fetch** **(1)**. Rien ne change dans vos fichiers : le fetch
ne fait que télécharger ce qui est nouveau sur GitHub.

![La Command Palette filtrée sur Git: Fetch](../../_assets/annotated/vscode/git-palette-fetch--fetch.png)

Puis la Command Palette à nouveau, tapez `Git: Merge`, et choisissez **Git: Merge...** **(1)**. La
même commande est dans le menu **...** en haut du panneau Source Control, sous **Branch**.

![La Command Palette filtrée sur Git: Merge](../../_assets/annotated/vscode/git-palette-merge--merge.png)

VS Code demande quelle branche faire entrer. Tapez `integration` et choisissez **origin/integration**
**(1)**, listée sous **remote branches** : la copie d'`integration` qui est sur GitHub, avec le
travail de Mariia dedans. Pas l'`integration` toute seule si elle est aussi listée : c'est la copie
de votre machine, que vous n'avez pas mise à jour depuis que vous avez branché.

![Le sélecteur de branche de Git: Merge..., avec origin/integration](../../_assets/annotated/vscode/git-merge-pick--origin-integration.png)

Deux fichiers reviennent marqués en conflit. Ils apparaissent dans le panneau sous **Merge Changes**
**(1)**, chacun avec un **!** **(2)**, et la barre d'état dit qu'un merge est en cours.

![Le panneau Source Control avec les fichiers en conflit sous Merge Changes](../../_assets/annotated/vscode/git-merge-conflicts--merge-changes.png)

<details markdown="1"><summary>Sous le capot : ce qu'a lancé Merge Branch</summary>

    git fetch origin
    git merge origin/integration

Un conflit n'est pas une erreur. C'est git qui dit que deux personnes ont écrit au même endroit et
qu'il ne devinera pas laquelle le pensait.

</details>

### 5. Résoudre le permission set : prendre les deux

Cliquez sur le fichier de permission set sous **Merge Changes**, puis sur **Resolve in Merge Editor**
en bas à droite du fichier. VS Code ouvre son éditeur de merge : **Incoming** **(1)**, la version de
Mariia venue d'`integration`, à gauche, **Current** **(2)**, la vôtre, à droite, et le **Result**
**(3)** que vous construisez en bas, qui part de la version depuis laquelle vous avez tous les deux
branché.

![L'éditeur de merge sur le permission set Helios Delivery Manager](../../_assets/annotated/vscode/git-merge-editor--parts.png)

Celui-ci est mécanique, et vous pouvez trancher sans comprendre le XML : **les deux entrées ont leur
place**. Mariia a accordé un champ, vous en avez accordé un autre, et un permission set en contient
autant qu'il en faut. Gardez les deux côtés : cliquez sur **Accept Incoming** **(1)** au-dessus de la
ligne surlignée du volet **Incoming**, puis sur **Accept Current** **(2)** au-dessus de celle du
volet **Current**.

![L'éditeur de merge, avec Accept Incoming et Accept Current](../../_assets/annotated/vscode/git-merge-editor--accept-both.png)

Lisez maintenant le **Result** **(1)** avant toute chose :

![L'éditeur de merge après avoir accepté les deux côtés, avec Complete Merge](../../_assets/annotated/vscode/git-merge-editor-accepted--result.png)

L'éditeur a gardé les deux lignes, et les a mises dans le même bloc : un seul `<fieldPermissions>`
avec deux lignes `<field>`, ce que Salesforce refuse. Git merge des lignes, pas des permissions. Vous
voulez deux blocs complets, un par champ, le `Crew_Capacity_Cap__c` de Mariia en premier et votre
`Crew_Notes__c` en second. Tapez-le dans le volet **Result** : après la première ligne `<field>`,
ajoutez les quatre lignes qui ferment le premier bloc et ouvrent le second :

```xml
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
```

Copiez-les d'ici : on ne demande à personne d'écrire du XML de mémoire. La section sous le capot
ci-dessous montre le résultat que vous visez. Cliquez ensuite sur **Complete Merge** **(2)**.

**Prendre les deux** est la bonne réponse pour presque tous les conflits de permission set. Choisir
un côté est la façon dont la permission d'un collègue disparaît en silence, sans que personne s'en
aperçoive avant que quelqu'un ne voie plus un champ.

<details markdown="1"><summary>Sous le capot : à quoi ressemblait vraiment le conflit</summary>

Git entre en conflit sur des lignes, pas sur du XML : les marqueurs ont donc atterri à l'intérieur
d'un bloc plutôt qu'autour de deux :

```xml
    <fieldPermissions>
        <editable>true</editable>
<<<<<<< HEAD
        <field>Installation__c.Crew_Notes__c</field>
=======
        <field>Installation__c.Crew_Capacity_Cap__c</field>
>>>>>>> origin/integration
        <readable>true</readable>
    </fieldPermissions>
```

Une fois les quatre lignes ajoutées, le résultat contient deux blocs complets, par ordre
alphabétique, ce qui est de toute façon la façon dont Salesforce les écrit :

```xml
    <fieldPermissions>
        <editable>true</editable>
        <field>Installation__c.Crew_Capacity_Cap__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Installation__c.Crew_Notes__c</field>
        <readable>true</readable>
    </fieldPermissions>
```

</details>

### 6. Résoudre le flow : comprendre les deux, puis décider

Celui-là, vous ne pouvez pas le résoudre en prenant les deux, parce que les deux modifications sont
dans le même chemin de décision.

- **La modification de Mariia** plafonne l'équipe à ce que l'installation autorise : jamais plus de N
- **La vôtre** porte l'équipe à au moins 3 sur les toitures plates : jamais moins de 3

Lues séparément, les deux sont correctes. Ensemble, elles peuvent se contredire sur une toiture plate
dont le plafond est 2.

C'est le moment qui compte, et la réponse n'est pas technique : **allez demander à Mariia**. Sur un
vrai projet, un conflit dans la logique métier est une conversation, pas une stratégie de merge.

Pour ce lab, la décision a été prise pour vous : **le plafond l'emporte**. Une équipe plus grande que
ce que l'installation autorise est un problème de sécurité ; une équipe de 2 sur une toiture plate
est une journée lente. Résolvez de sorte que votre minimum s'applique **seulement s'il ne dépasse pas
le plafond de Mariia**.

Faites-le dans Flow Builder, pas dans le fichier. Un flow est stocké sous forme de XML que personne
ne sait lire de façon fiable, développeurs compris, et un flow qui se déploie mais se comporte mal
est pire qu'un flow qui échoue.

1. Ouvrez le fichier de flow sous **Merge Changes** dans l'éditeur de merge, de la même façon.
   Cliquez sur **Accept Incoming** au-dessus de chaque conflit du volet **Incoming**, puis sur
   **Complete Merge** : la version entière de Mariia l'emporte pour l'instant
2. **Save / Publish User Story** n'est pas encore ce que vous voulez. Envoyez d'abord ce que le merge
   a apporté dans votre org de dev, pour que `helios-dev` ait le champ de Mariia, son autorisation et
   son plafond : dans l'**Explorer**, clic droit sur le dossier `force-app`, puis **SFDX: Deploy This
   Source to Org**, la même commande que le [Lab 2.5](2-5-pass-code-quality-and-apex-test-coverage.md) utilisait sur une classe

   Elle déploie tous les fichiers du dossier tels qu'ils sont sur votre machine, et rien d'autre. La
   commande sfdx-hardis **Push from local files to Salesforce org** enverrait à votre org toutes les
   modifications que git a vues depuis la dernière synchronisation, suppressions comprises, ce qui
   est plus que ce que cette étape demande

3. Ouvrez **Flow Builder** dans l'org, sur `Installation_Assign_Crew`, et rajoutez votre règle de
   toiture plate, **avant** son plafond : le flow porte d'abord l'équipe d'une toiture plate à trois,
   et son plafond, qui tourne maintenant en dernier, a le dernier mot
4. Revenez dans VS Code, faites descendre le flow reconstruit avec **Commit changes**, commitez-le,
   et publiez

Plus long à décrire, bien plus rapide à faire, et vous voyez ce que vous construisez.

<details markdown="1"><summary>Sous le capot : le résoudre dans le fichier à la place</summary>

Si vous savez lire du XML de flow et que vous y tenez : prenez la version de Mariia de l'élément et
de ses connecteurs comme base, rajoutez votre décision de toiture plate après son plafond, et
supprimez tous les marqueurs de conflit. Publiez ensuite, ce qui rejoue les règles de nettoyage sur
ce que vous avez écrit à la main.

Le risque n'est pas que cela échoue. Le risque est que cela se déploie et que les décisions
s'exécutent dans un ordre que vous n'aviez pas prévu, ce qu'aucun contrôle n'attrape et qu'aucun test
de ce projet ne couvre.

</details>

### 7. Terminer le merge et revalider

**Complete Merge** a déplacé chaque fichier de **Merge Changes** vers **Staged Changes**. Quand les
deux y sont, la zone de message affiche déjà
`Merge remote-tracking branch 'origin/integration'` : cliquez sur **Commit**, puis sur
**Sync Changes** pour pousser.

Puis **republiez** : **Save / Publish User Story**. Cela compte. Le merge a produit du XML à la main,
et publier rejoue les règles de nettoyage dessus et reconstruit `manifest/package.xml` à partir de ce
que votre branche change désormais. Sauter cette étape est la façon dont un marqueur de conflit
oublié atteint un déploiement.

Regardez le contrôle passer au vert, puis mergez.

### 8. Vérifier que les deux modifications ont survécu

Dans `helios-integration` :

- Le flow plafonne l'équipe, la règle de Mariia
- Le flow renforce les équipes de toiture plate, votre règle, sans casser le plafond
- Le permission set accorde les deux champs

S'il manque l'un des deux côtés, la résolution a perdu du travail, et l'audit du badge le dira.

## Ce que vous devez voir

- Aucun marqueur de conflit nulle part : cherchez `<<<<<<<` dans le repository
- Les deux permissions de champ dans `Helios_Delivery_Manager`
- Les deux comportements dans le flow

## En cas de problème

**`Error parsing file: Element assignments is duplicated at this location in type Flow`.**
Votre résolution a laissé le flow avec ses éléments dans le désordre. Un fichier de flow groupe tous
les éléments de même nature : toutes les affectations, puis toutes les décisions. Si votre merge a
déposé un élément conservé entre deux blocs d'une autre nature, remontez-le auprès des siens. L'ordre
à l'intérieur de chaque groupe n'a pas d'importance, le groupement si.

**`Element field is duplicated at this location in type PermissionSetFieldPermissions`.**
Vous avez gardé les deux côtés à l'intérieur d'une seule autorisation au lieu de garder les deux
autorisations. Un bloc `<fieldPermissions>` nomme un champ : la correction est deux blocs, pas un
bloc avec deux lignes `<field>`.

**Le flow refuse de se déployer après le merge : "duplicate element name".**
Vous avez gardé les deux côtés d'un élément qui ne peut exister qu'une fois. Les noms d'éléments de
flow sont uniques. Renommez-en un ou supprimez-en un.

**Vous avez perdu votre modification entièrement.**
Vous avez accepté le côté de Mariia sur tout le fichier. Dans le panneau **Source Control**, menu
**...** > **Branch** > **Abort Merge**, puis reprenez l'étape 4.

**Le contrôle échoue sur un marqueur de conflit.**
Cherchez `<<<<<<<`, `=======` et `>>>>>>>` dans tout le repository. Un marqueur dans un fichier XML
est parfois toléré syntaxiquement par git et toujours fatal pour Salesforce.

**Vous n'arrivez pas du tout à démêler.**
**Training: Level 2 > Reset this level**, puis refaites depuis l'étape 1. Perdre vingt minutes vaut
mieux que merger quelque chose que vous ne comprenez pas.

## Vérifiez votre travail

Welcome page > **Training: Level 2** > **Check my work**, puis choisissez le **Lab 2.7**.

Le contrôle vérifie des **résultats, pas une procédure** : les deux modifications présentes et
correctes sur `integration`, aucun marqueur restant. Peu importe comment vous y êtes arrivé, y
compris en résolvant dans l'éditeur web de GitHub ou en refaisant le travail dans Flow Builder, cela
passe.

## Pour aller plus loin

- [Profils et permission sets](https://sfdx-hardis.cloudity.com/salesforce-devops-work-on-user-story-profiles/)
- [Gestion des écrasements](https://sfdx-hardis.cloudity.com/salesforce-devops-config-overwrite/)

[Suite : Lab 2.8 - Se remettre d'avoir commité la mauvaise métadonnée](2-8-recover-from-committing-the-wrong-metadata.md){ .md-button .md-button--primary }

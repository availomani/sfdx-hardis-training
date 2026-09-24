---
id: lab-1-6
title: "Lab 1.6 - Ouvrir une Pull Request, passer le contrôle de déploiement, merger"
description: "Ouvrez une Pull Request GitHub, lisez le contrôle de déploiement sfdx-hardis et son commentaire, mergez, et regardez la CI/CD déployer votre modification dans l'org d'intégration."
level: 1
lab: 6
lang: fr
source_rev: "a34ea6fe2995834d2ab32fd72793082b541c84c8"
screenshots:
  - annotated/web/github-pr-checks
  - annotated/web/github-pr-comment
  - annotated/web/github-pr-merge
  - annotated/vscode/devops-pipeline--deployment-status
  - annotated/web/github-pr-deployed
  - annotated/vscode/work-save-completed
  - annotated/web/github-pr-merge-squash
depends_on:
  commands: [hardis:project:deploy:smart]
  flags: [--check]
  config: [testLevel, apexTestsMinCoverageOrgWide, genericTicketingProviderRegex, genericTicketingProviderUrlBuilder, genericTicketingProviderDetailsUrlBuilder]
  panels: [pipeline]
  docs: [salesforce-devops-pull-request-github, salesforce-devops-handle-merge-request-results, salesforce-devops-solve-megalinter-errors, salesforce-devops-setup-integration-generic-ticketing]
---

# Lab 1.6 - Ouvrir une Pull Request, passer le contrôle de déploiement, merger

**Niveau** : 1 Contributeur, les bases

**Durée** : ~20 min

**Vous allez** : faire contrôler votre travail par un robot avant qu'un humain le fasse, lire ce
qu'il dit, et mettre US-014 dans l'org d'intégration partagée.

## La situation

Votre branche est sur GitHub. Vous demandez maintenant qu'elle soit mergée, et il se passe quelque
chose d'intéressant : avant que quiconque la regarde, un job prend vos modifications et répète le
déploiement dans l'org d'intégration. Salesforce compile tout et lance les tests, puis jette le
résultat au lieu de le garder, l'org reste donc exactement comme elle était. Le job lance aussi les
linters, et écrit tout le verdict sur la Pull Request.

C'est tout l'intérêt de cette façon de travailler. Vous apprenez que votre déploiement échoue pendant
qu'il est encore à vous de le corriger, pas le soir de la mise en production.

!!! info "La Pull Request, en une phrase"
    Une Pull Request demande qu'une branche soit fusionnée dans une autre, la vôtre dans `integration`
    ici. C'est une page sur GitHub qui contient trois choses : ce que votre branche change, le
    résultat de chaque contrôle qui a tourné dessus, et la conversation sur l'opportunité de la
    faire entrer. Rien ne bouge tant que quelqu'un ne clique pas sur Merge. Tout le monde dit "PR".

## Avant de commencer

- [ ] [Lab 1.5](1-5-retrieve-commit-and-publish-your-changes.md) terminé : la branche est poussée sur votre fork (votre copie personnelle du repository du
      cours sur GitHub, par exemple `github.com/my-username/sfdx-hardis-training`)
- [ ] [Lab 1.2](1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md) terminé : **Set up my training environment** a activé Actions et posé l'identifiant de
      CI

## Les étapes

### 1. Ouvrir la Pull Request

Retournez au panneau où **Save / Publish** s'est terminé au [Lab 1.5](1-5-retrieve-commit-and-publish-your-changes.md). Tout en bas se trouve une barre
d'actions, et la première est **Create Pull Request** **(1)**. Cliquez : l'extension ouvre GitHub sur
la bonne page, avec la base et la tête déjà renseignées.

![La fin de la commande Save / Publish, avec sa barre d'actions](../../_assets/annotated/vscode/work-save-completed.png)

Deux autres éléments de cette barre méritent d'être connus dès maintenant, parce que des labs
suivants s'en servent. **(2)** est le `package.xml` généré par la commande, celui que vous avez lu au
[Lab 1.5, étape 6](1-5-retrieve-commit-and-publish-your-changes.md#6-lire-le-package-avant-de-pousser). **(3)** ouvre les Deployment Actions de cette Pull Request, ce dont parle tout le
[Lab 2.3](../level-2-contributor-advanced/2-3-fix-broken-records-with-an-apex-deployment-action.md).

!!! note "Si vous avez fermé ce panneau"
    Rien n'est perdu, et il y a deux chemins de retour. Relancez **Save / Publish my User Story** :
    chaque étape vérifie avant d'agir, il n'y a plus rien à commiter ni à pousser, et elle se
    termine sur la même barre d'actions. Ou ouvrez votre fork
    (`github.com/my-username/sfdx-hardis-training`) sur GitHub : il affiche une bannière qui propose
    d'ouvrir une Pull Request pour la branche que vous venez de pousser. La pastille **+ PR** que
    vous avez peut-être remarquée dans le diagramme DevOps Pipeline est pour les branches majeures,
    pas pour votre branche de feature.

Vérifiez deux choses avant de cliquer, à chaque fois sans exception :

1. **base** est `integration`, dans **votre** fork
2. **compare** est `features/US-014-panels-required`

!!! danger "Vérifiez le repository de base"
    GitHub met par défaut comme base d'une Pull Request de fork le repository **d'origine**. Si la base
    dit `hardisgroupcom/sfdx-hardis-training`, cliquez dessus et remplacez-la par votre propre fork.
    Une Pull Request ouverte en amont ne peut pas atteindre votre org, ne passera jamais au vert, et
    ajoute du bruit dans un repository qu'utilisent quelques centaines d'autres apprenants.

Le titre indique **Features/us 014 panels required** : GitHub l'invente à partir du nom de branche
dès qu'une branche porte plus d'un commit, et la vôtre en porte deux, celui que vous avez écrit et
celui qu'a ajouté Save / Publish. Remplacez-le par la première ligne du message de commit que vous
avez écrit au [Lab 1.5, étape 4](1-5-retrieve-commit-and-publish-your-changes.md), `US-014 Panels
Required on Installation`.

La zone de description n'est pas vide : ce repository fournit un template de Pull Request, et
GitHub l'y place pour vous. **Remplacez-le entièrement.** Sous **What this changes**, collez le
reste de ce même message de commit, le paragraphe qui explique pourquoi ; renseignez l'identifiant
de la story ; et dites où le relecteur doit regarder. Supprimez les lignes de commentaire et tout
titre sous lequel vous n'avez rien à mettre. Un template est un rappel de ce qu'il faut écrire, pas
quelque chose à rendre tel quel.

C'est ce que le relecteur lit en premier. Cliquez sur **Create pull request**.

### 2. Regarder les contrôles tourner

Ouvrez l'onglet **Checks** **(1)**. Deux d'entre eux comptent ici, et les deux démarrent tout seuls :

| Contrôle                                      | Ce qu'il fait                                                                                  |
|-----------------------------------------------|------------------------------------------------------------------------------------------------|
| **Simulate Deployment (sfdx-hardis)** **(3)** | Déploie votre métadonnée dans `helios-integration` en mode validation, et lance les tests Apex |
| **Mega-Linter** **(2)**                       | Lance les linters de qualité de code sur le repository                                         |

![L'onglet Checks d'une Pull Request, listant les jobs qui ont tourné](../../_assets/annotated/web/github-pr-checks.png)

Cliquez sur l'un ou l'autre pour lire son log pendant qu'il tourne. Le contrôle de déploiement prend
environ deux minutes, et vous pouvez le voir s'authentifier avec votre secret, calculer ce qui a
changé, et lancer le déploiement.

!!! warning "Aucun contrôle du tout ? Actions est désactivé sur votre fork"
    Si l'onglet Checks est vide et que rien ne démarre jamais, GitHub n'a pas activé Actions sur
    votre copie du repository. Il le fait pour tout nouveau fork, et c'est volontaire : un fork
    pourrait sinon lancer les workflows de quelqu'un d'autre dans votre compte dès sa création.
    **Set up my training environment** les active quand il le peut, et le dit quand il ne le peut
    pas.

    Ouvrez l'onglet **Actions** de votre fork (`github.com/my-username/sfdx-hardis-training`) et
    cliquez sur **I understand my workflows, go ahead and enable them**. Un seul clic. Revenez
    ensuite ici et lancez **Training: Level 1 > Trigger my workflows** : il pousse une modification
    d'une ligne sur votre branche, et c'est ce qui fait démarrer les contrôles sur une Pull Request
    ouverte pendant qu'Actions était désactivé.

    C'est une affaire de fork, et rien que de fork. Sur un vrai projet, vous rejoignez un
    repository dont l'automatisation tourne déjà, et il n'y a rien à activer.

### 3. Lire le commentaire sfdx-hardis

Quand le contrôle de déploiement se termine, sfdx-hardis écrit un commentaire sur l'onglet
**Conversation**. C'est la chose la plus utile de la page.

![Le commentaire sfdx-hardis sur une Pull Request](../../_assets/annotated/web/github-pr-comment.png)

1. **La bannière** **(1)** dit si le déploiement simulé a réussi
2. **Ce qui changerait** **(2)**. Pas une liste de vos fichiers : sfdx-hardis envoie le package
   entier, `manifest/package.xml`, et Salesforce répond quelle part en diffère : `34 sent to the org,
   5 would change (1 created, 4 updated, 0 deleted, 29 unchanged)`. Le composant créé est votre
   champ, et les composants mis à jour incluent la présentation de page et les deux permission sets
   que vous avez modifiés
3. **La couverture Apex** **(3)**, face à l'objectif que fixe ce projet
4. **Les tickets** **(4)**, les stories qu'il a reconnues dans votre nom de branche et vos messages
   de commit, chacune avec son titre et un lien vers sa page dans le backlog

En dessous, un résumé de vos commits et le nom du job qui a écrit le commentaire.

<details markdown="1"><summary>Sous le capot : d'où viennent les titres des stories</summary>

Le cours n'a pas d'outil de ticketing : son backlog est le système de ticketing.
`config/.sfdx-hardis.yml` le déclare avec trois clés du fournisseur de ticketing générique :

- `genericTicketingProviderRegex: "(US-[0-9]{3})"` trouve `US-014` dans le nom de branche et les
  commits
- `genericTicketingProviderUrlBuilder` en fait le lien, `.../BACKLOG/US-014/`
- `genericTicketingProviderDetailsUrlBuilder` pointe sur `.../BACKLOG/US-014.json`, un petit fichier
  que le site du cours publie pour chaque story. sfdx-hardis lit son `subject` et l'écrit à côté du
  lien

Un vrai projet pointe ces clés vers son propre outil de ticketing, ou utilise le connecteur JIRA,
Azure Boards ou ServiceNow à la place.

</details>

!!! note "Vos chiffres peuvent différer d'une unité ou deux"
    L'image est un vrai commentaire d'une vraie exécution de ce lab, gardé tel quel. Un composant que
    Salesforce range légèrement différemment dans votre org peut passer de inchangé à mis à jour, et
    ce n'est pas un problème : ce qui compte, c'est que votre champ soit celui qui est créé.

### 4. Merger

Les deux contrôles verts, le commentaire dit succès. De retour sur l'onglet **Conversation**, faites
défiler jusqu'en bas : la boîte de merge affiche **All checks have passed** et **No conflicts with
base branch**, et le bouton est actif.

Il est actif *parce que* les deux sont verts. La mise en place de votre environnement au [Lab 1.2](1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md) a
protégé `integration` : tant qu'un contrôle tourne ou est rouge, la boîte affiche **Merging is
blocked** et le bouton reste gris, pour vous comme pour n'importe qui d'autre. C'est la règle de toute
vraie pipeline, et ici GitHub l'impose au lieu de faire confiance à chacun pour lire les contrôles
d'abord.

![La boîte de merge d'une Pull Request, tous les contrôles passés](../../_assets/annotated/web/github-pr-merge.png)

Le bouton vert a une petite flèche à sa droite **(1)**. Cliquez sur la flèche, choisissez **Squash
and merge** **(2)**, puis cliquez sur **Squash and merge** et **Confirm squash and merge**.

![Le menu de méthode de merge d'une Pull Request, avec Squash and merge](../../_assets/annotated/web/github-pr-merge-squash.png)

Le squash transforme les commits de votre branche en un seul commit sur `integration`, titré comme
votre Pull Request. La story apparaît comme une seule ligne dans l'historique d'`integration` au lieu
de tous les commits intermédiaires que vous avez faits en la construisant, et une ligne est ce que
lit le release manager quand il promeut.

!!! warning "Le squash est pour les Pull Requests de feature, et pour rien d'autre"
    **Squash and merge** est juste dans exactement un cas : une Pull Request venant d'une **branche
    de feature**, une User Story ou un correctif, vers sa branche majeure. Partout ailleurs, servez-
    vous du **Merge pull request** simple : un retrofit, une branche de promotion, et toute Pull
    Request d'une branche majeure vers la suivante (`integration` vers `uat`, `uat` vers `preprod`,
    `preprod` vers `main`). Ces merges doivent garder les commits tels quels, parce que la promotion
    suivante et le retrofit suivant comparent les branches commit par commit, et un squash à cet
    endroit fait croire à git que le travail n'a jamais été mergé. Le Niveau 3 y revient.

GitHub retient la méthode que vous avez choisie la dernière fois, vérifiez donc l'étiquette du bouton
avant chaque merge.

Supprimez ensuite la branche. GitHub propose un bouton pour cela. Une branche mergée qui traîne est
une chose de plus dans la liste de tout le monde, sans aucun bénéfice.

!!! note "À quoi sert le linter, puisqu'il n'avait rien à dire"
    MegaLinter lit tout le repository, pas seulement votre modification, et signale tout ce qui enfreint
    les règles de qualité du projet. Il n'a rien trouvé ici parce que ce repository est propre. Quand il
    trouve quelque chose, il l'écrit sur la Pull Request de la même façon que le contrôle de
    déploiement, et le fait qu'une trouvaille fasse échouer le job ou non est un choix que le projet
    fait dans `.mega-linter.yml`. Un job qui échoue bloque le merge, comme le contrôle de
    déploiement. Le Niveau 2 a un lab où il vous bloque, exprès.

### 5. Regarder le vrai déploiement

Merger dans `integration` démarre un deuxième job, et celui-là n'est pas un contrôle : il déploie
pour de vrai.

Revenez dans VS Code et ouvrez le panneau **DevOps Pipeline**. La flèche qui va de la branche
`integration` vers son org porte une pastille, et pendant le déploiement cette pastille le dit et
clignote. C'est l'écran à regarder, et celui que vous garderez ouvert sur un vrai projet : il
répond à "est-ce que mon travail est dans l'org" sans quitter l'éditeur.

![Le panneau DevOps Pipeline, avec le statut du déploiement sur la flèche vers l'org](../../_assets/annotated/vscode/devops-pipeline--deployment-status.png)

La pastille est aussi un lien : cliquez dessus et GitHub s'ouvre sur le log de cette exécution,
**Process Deployment (sfdx-hardis)**, qui prend environ trois minutes. Vous n'avez pas besoin de le
lire aujourd'hui. Il est là pour le jour où quelque chose échoue, et le [Lab 3.3](../level-3-release-manager/3-3-deploy-to-integration-and-read-the-log.md) est le lab qui
en lit un ligne par ligne.

Quand le déploiement se termine, il écrit un deuxième commentaire sur la Pull Request que vous venez
de merger :

![Le commentaire que sfdx-hardis écrit après le déploiement de merge](../../_assets/annotated/web/github-pr-deployed.png)

1. **Deployment successful** **(1)**, et cette fois l'org a vraiment changé
2. **Ce qui a changé** **(2)**, sous la même forme que ce que le contrôle annonçait : `5 changed`
   là où le contrôle disait `5 would change`
3. **Quick Deploy** **(3)**. Le job de merge n'est pas parti de rien. Il a libéré la validation que
   le contrôle de Pull Request avait déjà faite, c'est pourquoi il n'a pas relancé les tests Apex une
   deuxième fois et pourquoi il a pris deux minutes plutôt que cinq

Ouvrez ensuite `helios-integration` depuis **Orgs Manager** et regardez une installation.

`Panels Required` est là. Vous l'avez construit dans une org et il est arrivé dans une autre, et vous
n'avez rien déployé à la main.

`helios-uat` ne l'a pas, et ne doit pas encore l'avoir. Le travail passe d'`integration` à `uat`
quand un release manager le promeut, plusieurs stories à la fois, et c'est le Niveau 3.

<details markdown="1"><summary>Sous le capot : ce qu'ont lancé les deux jobs</summary>

Le contrôle de Pull Request a lancé :

    sf hardis:project:deploy:smart --check

`--check` est un **déploiement de validation** : Salesforce compile tout, lance les tests et rend
compte de ce qu'il ferait, puis jette le résultat. Votre org n'est pas modifiée. C'est pourquoi on
peut le lancer sans risque à chaque push.

Le job après le merge a lancé la même commande **sans** `--check`, sur la même org. Même code, même
configuration, à un flag près. Un contrôle qui passe suivi d'un déploiement qui échoue est rare, et
quand cela arrive c'est presque toujours parce que quelqu'un a modifié l'org cible à la main entre
les deux.

Les deux jobs s'authentifient d'abord, via le hook sfdx-hardis qui lit `SFDX_AUTH_URL_INTEGRATION`,
le secret que **Set up my training environment** a écrit au [Lab 1.2](1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md). Les fichiers de workflow sont
dans `.github/workflows/`, et ils valent d'être lus une fois : une trentaine de lignes chacun.

Le niveau de test vient de `config/.sfdx-hardis.yml` :

    testLevel: RunLocalTests
    apexTestsMinCoverageOrgWide: 80

`RunLocalTests` lance tous les tests de l'org sauf ceux des packages gérés. 75 % est le minimum
Salesforce, et ce projet demande 80, comme la plupart des vrais.

<!-- command-links:start -->
Documentation de la commande : [hardis:project:deploy:smart](https://sfdx-hardis.cloudity.com/hardis/project/deploy/smart/)
<!-- command-links:end -->

</details>

## Ce que vous devez voir

- La Pull Request mergée, avec un commentaire sfdx-hardis vert au-dessus du merge
- L'exécution **Process Deployment (sfdx-hardis)** verte dans l'onglet Actions
- `Panels Required` présent sur l'objet Installation dans `helios-integration`

C'est une boucle de livraison complète. Chaque story, pendant tout le temps que vous passerez sur ce
projet, sera cette boucle.

## En cas de problème

**Les contrôles ne démarrent jamais.**
Actions est encore désactivé sur votre fork (`github.com/my-username/sfdx-hardis-training`). GitHub
cache cet interrupteur derrière une bannière qu'aucune commande ne peut atteindre : ouvrez l'onglet
**Actions** de votre fork et cliquez sur **I understand my workflows, go ahead and enable them**.
Relancer **Set up my training environment** ne le fera pas à votre place : il n'y a pas d'API
derrière cette bannière.

Votre branche a été poussée pendant qu'ils étaient désactivés, donc rien ne s'est exécuté dessus.
**Poussez-la à nouveau**, avec un commit de plus sur la branche, et les deux contrôles démarrent.
Rouvrir la Pull Request ne suffit pas : cela relance le contrôle de déploiement, alors que
Mega-Linter s'exécute au push, et le merge reste bloqué sur le contrôle qui n'est jamais venu.

**Le contrôle échoue à l'authentification :** *No authentication found for org integration*.
Le secret manque, est mal nommé, ou est tronqué. Il doit s'appeler exactement
`SFDX_AUTH_URL_INTEGRATION` et sa valeur doit commencer par `force://`. La réparation la plus rapide
est **Training: Level 1 > Set up my training environment**, qui le réécrit. Ouvrez ensuite l'onglet
**Checks** de votre Pull Request et cliquez sur **Re-run all jobs**.

**Le contrôle échoue avec `INVALID_CROSS_REFERENCE_KEY` sur le permission set.**
Le permission set accorde un champ qui n'est pas dans votre package. Vous avez récupéré le permission
set sans le champ. Refaites le [Lab 1.5, étape 3](1-5-retrieve-commit-and-publish-your-changes.md#3-prendre-les-votres-laisser-le-reste) et prenez les deux.

**Le contrôle reste bloqué sur "Expected".**
Le workflow attend un job qui ne tournera jamais, en général parce que la base de la Pull Request
est le repository d'origine et non votre fork (`github.com/my-username/sfdx-hardis-training`).
Fermez-la et rouvrez-la avec la bonne base.

**La boîte de merge dit Merging is blocked, et le bouton est gris.**
Un contrôle requis tourne encore, ou il a échoué. Attendez-le, ou ouvrez-le depuis l'onglet
**Checks**, corrigez sur votre branche ce qu'il signale, et repoussez : les contrôles retournent tout
seuls. Il n'y a pas de contournement, et ce n'est pas censé en avoir.

**Le déploiement réussit mais le champ n'est pas dans l'org.**
Regardez la liste des composants déployés dans le commentaire. Si le champ n'y est pas, c'est qu'il
n'est pas dans `manifest/package.xml`, et le [Lab 1.5, étape 6](1-5-retrieve-commit-and-publish-your-changes.md#6-lire-le-package-avant-de-pousser) est là où vous le lisez.

## Vérifiez votre travail

Welcome page > **Training: Level 1** > **Check my work**, puis choisissez le **Lab 1.6**.

## Pour aller plus loin

- [Créer la Pull Request sur GitHub](https://sfdx-hardis.cloudity.com/salesforce-devops-pull-request-github/)
- [Lire les résultats de la Pull Request](https://sfdx-hardis.cloudity.com/salesforce-devops-handle-merge-request-results/)
- [Résoudre les erreurs MegaLinter](https://sfdx-hardis.cloudity.com/salesforce-devops-solve-megalinter-errors/)

[Suite : Lab 1.7 - Épreuve finale : livrer une User Story tout seul](1-7-capstone-deliver-a-user-story-on-your-own.md){ .md-button .md-button--primary }

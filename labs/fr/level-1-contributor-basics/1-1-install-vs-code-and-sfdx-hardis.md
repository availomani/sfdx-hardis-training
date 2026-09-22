---
id: lab-1-1
title: "Lab 1.1 - Installer VS Code, Git et sfdx-hardis"
description: "Installez Git, Node.js, VS Code et l'extension sfdx-hardis, puis laissez son panneau Setup installer la CLI Salesforce et les plugins sans taper une commande."
level: 1
lab: 1
lang: fr
source_rev: "3da26b76cc8d4ae750c2ff7df3bae9c4d23b08f5"
screenshots:
  - annotated/web/git-download
  - annotated/web/vscode-download
  - annotated/web/nodejs-download
  - annotated/vscode/extensions-install
  - annotated/vscode/welcome--first-open
  - annotated/vscode/welcome--setup-button
  - annotated/vscode/setup
  - annotated/vscode/setup--ready
depends_on:
  commands: []
  flags: []
  config: []
  panels: [welcome, setup]
  docs: [salesforce-devops-use-install, vscode-extension]
---

# Lab 1.1 - Installer VS Code, Git et sfdx-hardis

**Niveau** : 1 Contributeur, les bases

**Durée** : ~15 min

**Vous allez** : transformer un ordinateur ordinaire en machine capable de faire du Salesforce
DevOps, sans taper une seule commande.

## La situation

Votre premier matin dans une équipe Salesforce, celle-ci ou une vraie. Avant qu'on puisse vous
confier un ticket, cinq choses doivent être sur votre machine, et la dernière installe la plupart
des autres à votre place.

!!! tip "Ce lab se suffit à lui-même"
    C'est la même liste que vous soyez ici pour la formation ou que vous rejoigniez un projet qui a
    déjà un pipeline, et elle se moque du fournisseur git de ce projet : GitHub, GitLab, Azure
    DevOps et Bitbucket fonctionnent tous pareil à partir d'ici. Si quelqu'un vous a envoyé ici pour
    vous équiper avant votre premier jour, **terminez ce lab et arrêtez-vous**. Le Lab 1.2 est là où
    commence la partie propre à la formation : orgs Salesforce gratuites, repository d'entraînement,
    données fictives. Rien de tout cela n'a sa place sur un vrai projet.

!!! tip "Pas de VS Code ? Un onglet ou un autre éditeur suffit"
    [Agentforce Vibes](https://www.salesforce.com/agentforce/developers/vibe-coding/ide/) est VS Code dans Google Chrome, lancé depuis une org Salesforce :
    une sandbox de développement, ou l'org Developer Edition gratuite pour laquelle le
    [Lab 1.2](1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md) vous inscrit, ce qui veut dire
    que ce chemin ne coûte rien et ne demande rien que vous ne créiez déjà ici. Tout ce cours y
    fonctionne. Deux différences et pas une
    de plus : la CLI Salesforce est déjà là, donc la partie du panneau Setup qui l'installe n'a rien
    à faire, et l'extension vient d'[Open VSX](https://open-vsx.org/extension/NicolasVuillamy/vscode-sfdx-hardis)
    et non du Visual Studio Marketplace. Chaque panneau, chaque bouton et chaque étape ci-dessous
    sont les mêmes, et les captures d'écran aussi : elles ont été prises dans VS Code de bureau, qui
    est le même éditeur.

    [Cursor](https://cursor.com/) et les autres éditeurs construits sur VS Code fonctionnent pareil, et depuis
    le même Open VSX. Quel que soit celui que vous utilisez, la suite de ce lab est écrite pour ce
    que vous y voyez.

## Avant de commencer

- [ ] Un ordinateur sur lequel vous pouvez installer des logiciels, et le droit de le faire, **ou**
      n'importe quelle org Salesforce depuis laquelle lancer Agentforce Vibes : une sandbox de
      développement, ou l'org Developer Edition gratuite du Lab 1.2

## Les étapes

### 1. Installer VS Code et l'extension

!!! tip "Dans Agentforce Vibes, commencez aux extensions"
    Les trois téléchargements ci-dessous sont déjà dans l'onglet : Git, Node.js et l'éditeur
    lui-même viennent avec. Passez-les et allez directement à **l'installation des extensions**,
    vers la fin de cette étape. Une différence là-bas : la vue Extensions d'un IDE dans le
    navigateur cherche dans
    [Open VSX](https://open-vsx.org/extension/NicolasVuillamy/vscode-sfdx-hardis) et non dans le
    Visual Studio Marketplace, et le pack est le même, sous le même nom. Et partout où ce lab dit de
    redémarrer VS Code, rechargez l'onglet du navigateur : cela fait la même chose, c'est-à-dire
    permettre à l'éditeur de voir ce qui vient d'être installé.

D'abord [Git](https://git-scm.com/downloads). Git est l'outil qui enregistre chaque version d'un
projet et la déplace entre votre portable et l'endroit où votre équipe garde le projet, et tout le
reste de ce cours repose dessus. Vous n'aurez jamais à taper une commande Git : l'extension les
lance pour vous, et vous montre laquelle elle a lancée. La page de téléchargement propose votre
système d'exploitation en haut : sous Windows, prenez **Click here to download** **(1)**,
l'installeur autonome 64 bits.

![La page de téléchargement de Git pour Windows](../../_assets/annotated/web/git-download.png)

**Acceptez toutes les valeurs par défaut proposées par l'installeur**, et sous Windows cela compte
plus qu'il n'y paraît. Ces valeurs par défaut incluent **Git Bash**, un terminal de style Unix livré
avec Git, et sfdx-hardis s'en sert : plusieurs des commandes que l'extension lance pour vous sont des
commandes shell que l'invite de commandes Windows ne comprend pas. Si vous décochez les composants
Git Bash, des pans entiers de ce cours échouent avec des erreurs qui n'ont l'air d'avoir aucun
rapport avec Git.

Deux écrans méritent d'être lus plutôt que cliqués au pas de course :

- **Select Components** : laissez **Git Bash Here** et **Git GUI Here** cochés
- **Adjusting your PATH environment** : gardez l'option du milieu, celle qui est recommandée, *Git
  from the command line and also from 3rd-party software*, pour que VS Code trouve Git

macOS et Linux ont déjà un shell Unix, il n'y a donc rien à choisir de ce côté.

!!! note "Vous l'avez peut-être déjà"
    Beaucoup de machines l'ont. Installez-le quand même : l'installeur reconnaît un Git existant et
    propose de le mettre à jour. Le panneau Setup de l'étape 2 le contrôle aussi, et vous dit s'il
    manque.

!!! tip "Vérifier que Git Bash est bien là, sous Windows"
    Faites un clic droit sur n'importe quel dossier : le menu doit proposer **Open Git Bash here**.
    Dans VS Code, vous trouverez aussi **Git Bash** dans la liste déroulante du terminal, à côté de
    PowerShell. Si aucun des deux n'apparaît, relancez l'installeur Git et gardez les valeurs par
    défaut cette fois.

Ouvrez ensuite [Visual Studio Code](https://code.visualstudio.com/) et prenez le téléchargement qui
correspond à votre machine. Sous Windows c'est le bouton **Windows** **(1)** ; les deux cartes à côté
contiennent les versions macOS et Linux.

![La page de téléchargement de Visual Studio Code, une carte par système d'exploitation](../../_assets/annotated/web/vscode-download.png)

Puis [Node.js](https://nodejs.org/), **en version 22 au minimum, 24 recommandée**. Deux choses à ne
pas rater sur cette page :

1. le sélecteur de version **(1)**. Celle marquée **LTS** est le choix sûr, tant qu'elle affiche 22
   ou plus
2. **Windows Installer (.msi)** **(2)**, ou l'équivalent pour votre machine

![La page de téléchargement de Node.js, avec le sélecteur de version et les boutons d'installeur](../../_assets/annotated/web/nodejs-download.png)

Les deux sont des installeurs suivant-suivant-terminer.

!!! warning "Redémarrez VS Code après avoir installé Git ou Node.js"
    Les deux installeurs s'ajoutent au **PATH**, la liste des endroits où votre machine cherche une
    commande. Un programme ne lit cette liste qu'à son démarrage : un VS Code déjà ouvert au moment
    de l'installation ne les trouve donc toujours pas, et le panneau Setup de l'étape 2 les signale
    manquants alors qu'ils sont là. Fermez VS Code complètement, toutes fenêtres comprises, et
    rouvrez-le.

    La même chose vaut pour un terminal que vous aviez déjà ouvert.

Ouvrez ensuite VS Code et installez les extensions. L'icône **Extensions** **(1)** se trouve dans la
barre étroite de gauche, et ressemble à quatre petits carrés dont l'un est détaché. Cliquez dessus,
tapez `hardis` dans la zone de recherche **(2)**, et cliquez sur **Install** sur **SFDX Hardis
Extension Pack for Salesforce, by Cloudity** **(3)**, publié par Nicolas Vuillamy.

![La vue Extensions de VS Code, avec hardis tapé dans la zone de recherche](../../_assets/annotated/vscode/extensions-install.png)

Le pack installe sfdx-hardis lui-même ainsi que les outils qui vont avec : Git Graph, qui dessine vos
branches, le support YAML et Markdown que les fichiers de configuration utilisent, et le visualiseur
de logs Apex. Les niveaux suivants s'en servent, prenez donc le pack plutôt que l'extension seule
juste au-dessus.

Une nouvelle icône apparaît dans la barre de gauche **(1)**. Cliquez dessus : l'onglet **Welcome**
**(2)** s'ouvre, et c'est par cet onglet que commence chaque lab de ce cours.

![VS Code avec l'onglet Welcome de sfdx-hardis ouvert](../../_assets/annotated/vscode/welcome--first-open.png)

### 2. Laisser le panneau Setup installer le reste

Il vous faut la CLI Salesforce et quelques plugins. Vous n'allez pas les installer à la main :
l'extension a un panneau qui vérifie ce qui manque et l'installe.

!!! tip "Dans Agentforce Vibes, la CLI Salesforce est déjà là"
    Sa carte est verte avant même que vous commenciez, et le panneau n'a plus que les plugins à
    installer. Lancez le même **Run pending installs** et lisez la même liste ; elle est simplement
    plus courte.

Sur la Welcome page, le bouton en haut à gauche du bandeau d'en-tête **(1)** ouvre le panneau Setup.
Il n'y a pas de carte appelée Setup : le bouton porte l'état de vos dépendances, il affiche donc
**Check in progress** tant qu'il cherche, puis soit **Dependencies up to date**, soit
**N update(s) needed**. Survolez-le et l'infobulle dit **Open Setup**. Attendez la fin du contrôle,
puis cliquez.

![L'en-tête de la Welcome page, avec à sa gauche le bouton d'état des dépendances](../../_assets/annotated/vscode/welcome--setup-button.png)

Le panneau liste chaque dépendance dont le pipeline a besoin, avec la version que vous avez et la
version à jour. Celles qu'il faut connaître par leur nom :

- **Salesforce CLI** - le programme auquel parle chaque outil Salesforce de votre machine
- **sfdx-hardis** - le complément qui ajoute les commandes User Story à cette CLI
- **SFDMU** - charge et extrait des enregistrements, c'est ainsi que vos orgs reçoivent leurs données
- **sfdx-git-delta** - calcule ce qui a changé entre deux versions du projet, c'est ce que les
  déploiements envoient
- **Salesforce Extension Pack** - l'outillage Salesforce officiel pour VS Code

Node.js et **Git** **(3)** ont aussi chacun leur carte : le panneau contrôle ce que vous avez
installé à l'étape 1 et le dit.

![Le panneau Setup, listant chaque dépendance avec sa version](../../_assets/annotated/vscode/setup.png)

L'image a été prise sur une machine où tout était déjà en place : chaque carte est verte et ne
propose rien d'autre que **Re-check** **(2)**, et le bandeau du haut n'a rien à proposer **(1)**.

Votre première exécution ne ressemblera pas à cela. Tout ce qui manque ou n'est pas à jour passe à
l'orange et son bouton affiche **Install** ou **Upgrade**, et le bandeau du haut porte alors
**Run pending installs** **(1)**. Servez-vous de celui-là : il met toute la liste en file d'attente
et rend compte de chaque élément au fur et à mesure.

Cela prend quelques minutes. C'est la partie la plus longue de ce lab, et la seule que vous ne
referez jamais.

!!! warning "Redémarrez VS Code une fois les installations terminées"
    La CLI Salesforce atterrit elle aussi sur le PATH, la même règle s'applique donc : fermez
    VS Code et rouvrez-le avant de continuer. Appuyez ensuite sur **Re-check** dans le panneau
    Setup. Tout ce qui était encore rouge pour cette raison passe au vert.

<details markdown="1"><summary>Sous le capot : ce que le panneau Setup vient de faire</summary>

Pour chaque dépendance manquante, il a lancé la commande npm toute simple que vous auriez lancée
vous-même, par exemple :

    npm install --global @salesforce/cli
    sf plugins install sfdx-hardis
    sf plugins install sfdmu
    sf plugins install sfdx-git-delta

puis il a relancé `sf version` et `sf plugins` et comparé les réponses aux versions publiées sur le
registre npm. Cette comparaison est toute la raison d'être du panneau : un pipeline casse de façon
déroutante quand une personne a deux versions majeures de retard, et personne ne s'en aperçoit
jusqu'à ce qu'un déploiement échoue.

</details>

## Ce que vous devez voir

Le panneau **Setup** sans rien à installer :

![Le panneau Setup une fois tout installé](../../_assets/annotated/vscode/setup--ready.png)

La ligne à lire est le résumé du haut **(1)**. Il nomme tout ce qui manque encore, et manquant est le
seul état qui vous bloque. Chaque carte en dessous est verte, **Salesforce CLI** **(2)** compris,
sans rien d'autre à faire que **Re-check**.

Un **Upgrade** orange sur l'une d'elles n'est pas un échec : cela veut dire qu'une version plus
récente existe, et le bouton ira la chercher quand vous en aurez envie.

C'est tout ce lab. Votre machine peut maintenant faire tourner tout ce que la suite du cours, et tout
projet Salesforce qui utilise sfdx-hardis, va lui demander.

## En cas de problème

**Le panneau Setup dit que la CLI Salesforce manque alors qu'il vient de l'installer.**
Elle a atterri quelque part qui n'était pas sur le PATH d'un terminal déjà ouvert. Fermez VS Code
complètement et rouvrez-le.

**L'extension n'apparaît pas après son installation.**
Rechargez la fenêtre : **View > Command Palette**, puis **Developer: Reload Window**.

**Le panneau Setup affiche une ligne rouge que vous n'arrivez pas à faire passer.**
Cliquez sur la ligne. Le panneau dit ce qu'il a tenté et ce qu'on lui a répondu, et ce message est
presque toujours la réponse.

## La suite

Si vous êtes venu ici pour équiper un vrai projet, vous avez fini : ouvrez le repository de votre
équipe et le panneau **DevOps Pipeline** vous dira le reste.

Si vous suivez la formation, le [Lab 1.2](1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md) vous construit un petit environnement de travail : une org
Salesforce gratuite, trois scratch orgs créées à partir d'elle, une copie du projet, et un pipeline.
C'est la dernière étape d'installation.

## Pour aller plus loin

- [Installer sfdx-hardis](https://sfdx-hardis.cloudity.com/salesforce-devops-use-install/)
- [L'extension VS Code](https://sfdx-hardis.cloudity.com/vscode-extension/)

[Suite : Lab 1.2 - Créer votre Dev Hub, vos scratch orgs et votre pipeline CI/CD](1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md){ .md-button .md-button--primary }

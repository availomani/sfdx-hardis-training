---
id: lab-1-2
title: "Lab 1.2 - Créer votre Dev Hub, vos scratch orgs et votre pipeline CI/CD"
description: "Inscrivez-vous à une org Salesforce Developer Edition gratuite, puis laissez un clic créer un Dev Hub, trois scratch orgs, votre fork GitHub et son pipeline CI/CD."
level: 1
lab: 2
lang: fr
source_rev: "4661bc03d2558cec0b10dc8f320de2e8a4617d66"
screenshots:
  - annotated/web/sf-signup
  - annotated/web/gh-cli-download
  - annotated/vscode/orgs-manager
  - annotated/vscode/clone-repository
  - annotated/vscode/org-select-alias
  - annotated/vscode/welcome--training-menu
  - annotated/vscode/training-menu-authorization
  - annotated/vscode/devops-pipeline-disconnected--github-auth
  - annotated/vscode/devops-pipeline-fresh--read-it
depends_on:
  commands: [hardis:org:select, hardis:org:data:import]
  flags: []
  config: [developmentBranch, availableTargetBranches, targetUsername, instanceUrl, mergeTargets, customCommands]
  panels: [pipeline, orgManager, welcome]
  docs: [salesforce-devops-git-tokens, salesforce-devops-clone-repository, salesforce-devops-setup-auth-github]
---

# Lab 1.2 - Créer votre Dev Hub, vos scratch orgs et votre pipeline CI/CD

**Niveau** : 1 Contributeur, les bases

**Durée** : ~30 min, dont l'essentiel à attendre

**Vous allez** : vous inscrire à une org Salesforce gratuite, et laisser une seule commande la
transformer en tout ce dont le cours a besoin : trois orgs de plus, une copie du projet, et un
pipeline câblé dessus.

## La situation

**Ce lab n'est pas le métier, et rien de tout cela n'arrive sur un vrai projet.**

Là-bas, tout cela existe avant votre arrivée : les orgs ont été créées par celui ou celle qui a
monté le projet, le repository est là depuis des années, et son pipeline déploie depuis des mois.
Vous arriveriez, vous ouvririez le projet, et vous commenceriez sur un ticket.

Ce cours ne peut pas vous prêter l'environnement d'une équipe, il vous en fait donc construire un
petit. Vous faites deux choses à la main, vous inscrire à une org et la connecter, et une commande
fait le reste pendant que vous lisez. Le travail commence au [Lab 1.3](1-3-start-a-user-story-on-a-git-branch.md), et tout ce qui suit ressemble
à une vraie journée.

## Avant de commencer

- [ ] [Lab 1.1](1-1-install-vs-code-and-sfdx-hardis.md) terminé : le panneau Setup tout vert
- [ ] Un compte GitHub
- [ ] Une adresse e-mail que vous pouvez consulter

!!! info "Si vous n'avez pas de compte GitHub"
    En créer un prend deux minutes et ne coûte rien. Ouvrez
    [github.com/signup](https://github.com/signup) et donnez une adresse e-mail, un mot de passe et
    un nom d'utilisateur. GitHub vous envoie un code par e-mail pour confirmer l'adresse, et c'est
    tout : le plan gratuit fait tout ce dont ce cours a besoin, et il ne demande jamais de carte.

    Choisissez le nom d'utilisateur avec un minimum de soin. Il devient une partie de l'adresse de
    tout ce que vous mettrez là-bas, `github.com/<votre-nom-utilisateur>/sfdx-hardis-training` dans
    quelques minutes, et les gens le lisent. Votre nom, ou le pseudo que vous utilisez déjà
    ailleurs, vaut mieux que tout ce que vous voudrez changer plus tard.

    **Si vous avez déjà un compte, servez-vous-en.** Personnel ou professionnel, ancien ou nouveau,
    cela ne change rien ici. La seule chose à savoir sur un compte professionnel : certaines
    entreprises restreignent ce que leurs membres ont le droit de forker. Si le fork de l'étape 5
    est refusé, c'est pour cela, et un compte personnel vous débloque.

## Les étapes

### 1. Créer votre org Developer Edition

Allez sur [developer.salesforce.com/signup](https://developer.salesforce.com/signup) et
inscrivez-vous. C'est gratuit, cela n'expire jamais tant que vous l'utilisez, et aucune carte
bancaire n'est demandée.

Le formulaire demande vos prénom, nom, intitulé de poste, entreprise et pays ou région, puis trois
choses qui décident si l'inscription aboutit :

1. **Work email** **(1)**, une vraie adresse que vous pouvez consulter, parce que l'inscription est
   confirmée par e-mail
2. la case qui accepte le **Main Services Agreement** **(2)**. La case de pixel de suivi en dessous
   est facultative, vous pouvez la laisser tranquille
3. **Sign me up** **(3)**

![Le formulaire d'inscription Salesforce Developer Edition](../../_assets/annotated/web/sf-signup.png)

Vous ne choisissez pas de nom d'utilisateur : il est généré et vous est envoyé. Ouvrez l'e-mail de
confirmation et définissez un mot de passe. L'e-mail porte aussi ce nom d'utilisateur. Il ressemble
à une adresse e-mail mais n'en est pas une, et c'est avec lui que vous vous connectez. Gardez-le
quelque part.

C'est la seule org à laquelle vous vous inscrivez, et elle a deux rôles dans ce cours :

| Quand          | Ce qu'est cette org                                                                 |
|----------------|-------------------------------------------------------------------------------------|
| Niveaux 1 et 2 | Votre **Dev Hub** : l'org qui crée les trois autres, et rien de plus                |
| Niveau 3       | La **production**, dernier arrêt du pipeline que vous aurez fini de monter d'ici là |

!!! info "Les scratch orgs, en un paragraphe"
    Une **scratch org** est une org Salesforce temporaire qu'une commande crée en deux minutes, à
    partir d'une org appelée **Dev Hub**. Elle démarre vide, vit jusqu'à 30 jours, et se jette quand
    vous avez fini. Les équipes s'en servent parce qu'une org neuve que personne n'a touchée est
    l'endroit le plus honnête où tester un déploiement. Une org Developer Edition gratuite peut
    jouer le rôle de Dev Hub et garder **trois scratch orgs** vivantes à la fois, ce qui est
    exactement le nombre qu'utilise ce cours.

!!! note "Une org Developer Edition est désactivée après une longue période d'inactivité. Terminez un niveau en quelques semaines et vous ne rencontrerez jamais ce cas."

### 2. La connecter dans Orgs Manager

De retour dans VS Code, sur la Welcome page, cliquez sur **Orgs Manager**.

![Le tableau Orgs Manager, avec les orgs de formation et leur état de connexion](../../_assets/annotated/vscode/orgs-manager.png)

L'image a été prise à la fin de ce lab. Pour l'instant votre tableau est vide.

1. Cliquez sur **Add Org** **(1)**, puis choisissez **🌍 Login to another org**, la première entrée
   de la liste qui s'ouvre
2. On vous demande à quelle adresse vous connecter, et la sandbox est proposée. **Changez-la** :
   prenez **☢️ Other: Dev org, Production org or DevHub org (login.salesforce.com)**, parce qu'une
   org Developer Edition n'est pas une sandbox. Choisissez la réponse sandbox ici et la page de
   connexion refuse votre nom d'utilisateur
3. Votre navigateur ouvre la page de connexion Salesforce. Connectez-vous avec le nom d'utilisateur
   reçu par e-mail, et autorisez l'accès

De retour dans VS Code, le panneau vous demande encore une chose :

![Le panneau demandant quel nom donner à l'org qui vient d'être connectée](../../_assets/annotated/vscode/org-select-alias.png)

**What name do you want to give this org?** La zone **(1)** est déjà remplie avec une suggestion,
tirée de l'adresse web de l'org elle-même. Sur une Developer Edition, cette adresse est une chaîne
inventée par Salesforce, `orgfarm-9f2a1c7e4b` ou quelque chose d'approchant, qui ne vous dit rien de
ce à quoi sert l'org.

**Remplacez-la par `helios-prod`**, puis cliquez sur **Validate** **(2)**.

Production peut sembler un bien grand nom pour une org vide. C'est le rôle qu'aura cette org à la fin
du cours, et lui donner son nom définitif maintenant évite d'avoir à renommer quoi que ce soit plus
tard.

Ce nom s'appelle un **alias**, et c'est lui que vous verrez et cliquerez désormais : dans ce panneau,
dans le diagramme du pipeline, partout où le cours nomme une org. Les trois orgs créées à l'étape 5
reçoivent le leur automatiquement, et elles apparaissent dans ce tableau sous ces noms **(2)**,
chacune avec un **Connected** vert **(3)**. **C'est par ce panneau que vous vous connectez à une org
pour tout le reste du cours**, et c'est aussi là que vous vérifiez sur quelle org vous êtes pointé,
ce qui évite plus de confusions que n'importe quoi d'autre dans cette formation.

<details markdown="1"><summary>Sous le capot : ce que connecter une org vient de faire</summary>

Le panneau a lancé :

    sf hardis:org:select

qui a ouvert votre navigateur, laissé Salesforce vous authentifier, et rangé un refresh token OAuth
dans votre profil utilisateur (`~/.sfdx`). Rien n'est stocké dans le projet, et rien n'est commité :
l'identifiant est à vous et reste sur votre machine. Puis il a nommé l'org :

    sf alias set helios-prod=you.helios@heliostraining.invalid

L'alias est le nom que tout le reste utilise. Toute commande sfdx-hardis qui veut une org accepte
désormais `--target-org helios-prod`, et la CLI Salesforce elle-même aussi.

</details>

### 3. Récupérer le repository

Il vous faut le projet de formation sur votre machine avant que la commande de l'étape 5 puisse en
construire quoi que ce soit. Prenez la copie de l'équipe pour l'instant : elle est en lecture seule,
et l'étape 5 la transforme en la vôtre.

Dans VS Code, sans dossier ouvert, cliquez sur l'icône **Source Control** **(1)** dans la barre
étroite de gauche. Elle propose deux boutons. Prenez **Clone Repository** **(2)**.

![Le panneau Source Control de VS Code avant l'ouverture d'un dossier](../../_assets/annotated/vscode/clone-repository.png)

Puis :

1. Collez `https://github.com/hardisgroupcom/sfdx-hardis-training.git` et appuyez sur Entrée
2. Choisissez le dossier où le mettre. VS Code crée un dossier `sfdx-hardis-training` à l'intérieur
   de celui que vous choisissez : choisissez donc l'endroit où vous voulez que vivent **tous** vos
   repositories désormais. Si vous n'avez pas encore un tel endroit, créez-en un : `C:\git` sous Windows,
   `~/git` sous macOS et Linux. Chemin court, pas d'espaces, et pas dans OneDrive ni dans un dossier
   qui se synchronise, parce qu'un client de synchronisation et un repository git se disputent les mêmes
   fichiers
3. Quand on vous le demande, cliquez sur **Open** pour travailler dans le clone

Si GitHub vous demande de vous connecter, laissez VS Code s'en charger : **Sign in with your
browser** suffit.

!!! note "Vous n'avez pas besoin d'un dossier vide au préalable"
    **Clone Repository** demande où mettre le projet, il n'y a donc rien à préparer. Les deux boutons
    de l'image n'apparaissent que tant qu'aucun dossier n'est ouvert : dès qu'il y en a un, le
    panneau Source Control affiche les modifications de ce dossier à la place.

<details markdown="1"><summary>Sous le capot : ce que l'ouverture du dossier a appris à l'extension</summary>

L'extension a lu une poignée de fichiers, et elle les relit dès qu'ils changent, vous n'avez donc
jamais à recharger la fenêtre :

- `sfdx-project.json`, qui dit que les sources Salesforce vivent dans `force-app`
- `config/.sfdx-hardis.yml`, la configuration du projet : branches majeures, règles de nettoyage,
  menu Training
- `config/project-scratch-def.json`, la forme des scratch orgs que ce projet crée
- `config/branches/`, un fichier par branche majeure, qui dit dans quelle org elle déploie

Ces fichiers de branche ne contiennent rien de vos informations tant que l'étape 5 ne les a pas
remplis.

</details>

### 4. Installer la CLI GitHub

Un outil d'abord, et uniquement pour cela. La commande de l'étape 5 utilise la [CLI
GitHub](https://cli.github.com/), appelée `gh`, pour faire votre copie du repository et mettre en
place son automatisation. Sur sa page d'accueil, ouvrez la liste d'installation **(1)** et prenez le
téléchargement de votre machine : **Windows - Download MSI** **(2)**, ou **macOS - Download
binary**. Acceptez les valeurs par défaut de l'installeur.

![La page d'accueil de la CLI GitHub, avec la liste d'installation ouverte sur le MSI Windows](../../_assets/annotated/web/gh-cli-download.png)

!!! warning "Redémarrez VS Code après l'avoir installée"
    L'installeur ajoute `gh` au **PATH**, et un VS Code déjà ouvert ne voit pas le changement avant
    de redémarrer. Fermez VS Code complètement, toutes fenêtres comprises, et rouvrez-le sur le
    projet. Sautez cette étape et l'étape 5 s'arrête aussitôt en disant que la CLI GitHub n'est pas
    installée.

Vous n'aurez jamais à lancer `gh` vous-même. La commande de l'étape 5 s'en sert et vous connecte via
votre navigateur la première fois qu'elle en a besoin.

!!! tip "À quoi ressemble la connexion"
    La première exécution s'arrête sur une ligne du genre `Your one-time code is 5989-F9D9`, et
    ouvre [github.com/login/device](https://github.com/login/device) dans votre navigateur. Saisissez
    ce code là-bas, approuvez la connexion, et revenez : la commande repart toute seule, et ne
    redemandera plus rien. Si le navigateur ne s'est pas ouvert, l'adresse est affichée juste sous
    le code.

!!! note "Celle-ci est pour le cours, et pour GitHub"
    Elle est là pour qu'un seul clic puisse vous remettre un pipeline qui marche au lieu d'une
    douzaine de formulaires. Rien d'autre dans le cours n'en a besoin, et rien dans sfdx-hardis non
    plus : ce projet vit sur GitHub, et les projets GitLab, Azure DevOps et Bitbucket fonctionnent
    exactement pareil sans elle. Sur un vrai projet vous rejoindriez un repository qui existe déjà, avec
    son automatisation déjà en marche, et vous n'installeriez jamais ceci.

### 5. Mettre en place votre environnement de formation

Rouvrez la Welcome page. Au-dessus des cartes intégrées se trouve un titre **CUSTOM MENUS** **(1)**,
qui contient trois cartes **(2)**, une par niveau.

![La Welcome page, avec le groupe CUSTOM MENUS et les trois cartes Training](../../_assets/annotated/vscode/welcome--training-menu.png)

!!! note "D'où viennent ces cartes"
    Elles ne font pas partie du produit. N'importe quel projet peut déclarer ses propres menus dans
    son `config/.sfdx-hardis.yml`, et l'extension les affiche ici, marqués `(custom)`, pour que vous
    puissiez toujours distinguer les commandes d'un projet de celles que sfdx-hardis livre. Ce projet
    déclare un menu par niveau, et chacun ne contient que les commandes de ce niveau.

Cliquez sur **Training: Level 1**, puis sur **Set up my training environment** **(1)**.

La première fois que vous cliquez sur une carte Training, VS Code ne la lance pas. Il demande comment
vous voulez l'autoriser **(2)**, et affiche la commande qu'il s'apprête à lancer. Un menu
personnalisé lance quelque chose que le projet a écrit, pas quelque chose que l'extension livre :
l'extension refuse donc de le lancer dans votre dos. Lisez la ligne, vérifiez qu'elle dit
`node scripts/training.mjs`, puis cliquez sur **Always allow** **(3)**.

![VS Code demandant comment autoriser la commande Training, avec Always allow](../../_assets/annotated/vscode/training-menu-authorization.png)

**Always allow** répond pour tout le menu, pas seulement pour cette carte. Les entrées Training des
trois niveaux cessent de demander, et rien d'autre ne cesse : l'extension reconnaît une commande
Training à sa forme et au repository que vous avez cloné, donc une commande personnalisée de
n'importe quel autre projet vous demandera toujours d'abord, dans ce dossier comme dans tous les
autres.

!!! warning "Lisez la ligne avant d'autoriser"
    **Allow once** ne lance que cette fois-ci, **Always allow** s'en souvient. Les deux conviennent
    ici : vous voyez ce qui est lancé, et le repository est celui que vous avez cloné. Sur un projet monté
    par quelqu'un d'autre, lisez d'abord cette ligne. C'est le seul moment où quoi que ce soit vous
    montre ce que fait vraiment un menu personnalisé.

La commande ne demande pas quelle org utiliser : vous en avez connecté une, nommée `helios-prod`,
elle prend donc celle-là, le dit, et ne demande qu'un oui avant de changer quoi que ce soit. Puis
elle déroule huit étapes et vous tient au courant au fur et à mesure :

```text
Developer Edition org: helios-prod

1 of 8  Your own copy of the repository
OK  origin is now your-handle/sfdx-hardis-training, and the shared repository is upstream.

2 of 8  Actions turned on
OK  Actions are on.

3 of 8  Your Dev Hub
OK  helios-prod is a Dev Hub now.

4 of 8  Your three scratch orgs
OK  helios-dev is created, for 30 days.
OK  helios-integration is created, for 30 days.
OK  helios-uat is created, for 30 days.

5 of 8  The Helios app in each of them
OK  helios-dev holds the app, your permission set and the sample data.
...

6 of 8  The credentials the CI jobs use
OK  SFDX_AUTH_URL_INTEGRATION is set on your-handle/sfdx-hardis-training.
OK  SFDX_AUTH_URL_UAT is set on your-handle/sfdx-hardis-training.

7 of 8  Which org each branch deploys to
OK  integration now names the org of every branch, and is pushed.

8 of 8  Changes through a Pull Request, merged once green
OK  integration now takes changes through a Pull Request only, merged once its checks are green.
OK  uat now takes changes through a Pull Request only, merged once its checks are green.
```

Comptez quinze à vingt minutes, presque entièrement sur les étapes 4 et 5, quand Salesforce crée les
orgs et que l'application est déployée dans les trois à la fois. Rien ne s'affiche pendant ce
temps-là. Ce n'est pas bloqué.

La lancer deux fois est sans danger : chaque étape vérifie avant d'agir, et une org qui existe déjà
est conservée. Si l'une des étapes ne peut pas être faite depuis ici, elle le dit et vous indique sur
quel bouton cliquer à la place.

<details markdown="1"><summary>Sous le capot : ce que "Set up my training environment" vient de faire</summary>

La carte lance une seule commande, déclarée par ce projet dans `config/.sfdx-hardis.yml` sous
`customCommands` :

    node scripts/training.mjs init

qui à son tour lance de vraies commandes que vous retrouverez sur de vrais projets. Le Dev Hub est un
paramètre, déployé comme de la métadonnée. Chaque scratch org, c'est :

    sf org create scratch --definition-file config/project-scratch-def.json \
      --alias helios-dev --target-dev-hub helios-prod --duration-days 30

et chacune est ensuite alimentée :

    sf project deploy start --source-dir force-app --target-org helios-dev
    sf org assign permset --name Helios_Delivery_Manager --target-org helios-dev
    sf hardis:org:data:import --path scripts/data/HeliosBaseline --target-org helios-dev

L'ordre de ces trois-là compte, et pas de la façon dont vous l'imagineriez. Un déploiement de
métadonnées n'accorde **aucune sécurité au niveau des champs à qui que ce soit**, pas même à un
administrateur système. Chargez les données avant d'affecter le permission set et le chargement
échoue sur des champs que l'utilisateur courant ne peut pas voir, avec un message d'erreur qui ne
dit rien des permissions.

Le chargement de données est un **upsert sur un identifiant externe**, le lancer deux fois met donc à
jour les mêmes 235 enregistrements au lieu d'en créer 470. Tout ce qui, dans ce cours, peut être
lancé deux fois, peut être lancé deux fois.

Il a fait pointer ce dossier vers vos orgs, dans le répertoire `.sf` ignoré par git :

    sf config set target-dev-hub=helios-prod target-org=helios-dev

Et il a protégé `integration` et `uat` avec un appel à l'API GitHub par branche : modifications
uniquement par Pull Request, mergée seulement une fois ses contrôles verts, pour tout le monde. Vous
poserez la même règle sur `preprod` et `main` au [Lab 3.1](../level-3-release-manager/3-1-configure-the-pipeline-up-to-production.md) :

    gh api -X PUT repos/<your-handle>/sfdx-hardis-training/branches/integration/protection \
      -F "required_pull_request_reviews[required_approving_review_count]=0" \
      -f "required_status_checks[contexts][]=Simulate Deployment to Major Org" \
      -f "required_status_checks[contexts][]=Mega-Linter" \
      -F enforce_admins=true ...

`enforce_admins` est la partie qui compte : sans elle, le propriétaire du fork, c'est-à-dire vous,
pourrait encore merger sur du rouge. La mise en place de l'environnement et la réinitialisation d'un
niveau lèvent cette protection le temps du seul push qu'elles font elles-mêmes sur ces branches, et
la remettent juste après.

</details>

### 6. Ce qu'elle vient de faire

Sept choses, chacune du vrai travail sur un vrai projet, et aucune à refaire vous-même :

- **Votre propre copie du repository**, son *fork*, sous votre compte GitHub. Votre clone pousse là-bas
  désormais, et continue de tirer depuis le repository de l'équipe. Le fork porte les deux branches
  qu'utilise le pipeline aujourd'hui, `integration` et `uat`, plus `main`. Vous ajouterez `preprod`
  vous-même au [Lab 3.1](../level-3-release-manager/3-1-configure-the-pipeline-up-to-production.md)
- **Actions activées.** GitHub désactive les workflows sur chaque nouveau fork jusqu'à ce que le
  propriétaire dise le contraire, et un fork où ils sont éteints ressemble exactement à une formation
  cassée
- **`helios-prod` est devenue un Dev Hub**, ce qui est un seul interrupteur dans Setup, et ne se
  rebascule pas
- **Trois scratch orgs**, chacune contenant l'application Helios, votre permission set et les données
  d'exemple :

| Org                  | À quoi elle sert                                                                      |
|----------------------|---------------------------------------------------------------------------------------|
| `helios-dev`         | Votre org de développement, celle où vous construisez. Personne d'autre n'y travaille |
| `helios-integration` | L'org d'intégration partagée, où le travail de l'équipe est mergé et déployé          |
| `helios-uat`         | La recette utilisateur, où le métier teste ce que l'intégration a rassemblé           |

- **Dans quelle org déploie chaque branche**, écrit dans l'unique fichier de configuration par
  branche du projet, dans `config/branches/`, commité sur `integration` et poussé sur votre fork
  (votre copie personnelle du repository du cours sur GitHub, par exemple
  `github.com/my-username/sfdx-hardis-training`). Le repository ne pouvait pas le savoir : vos orgs
  n'existaient pas quand il a été écrit. C'est poussé parce que le contrôle du badge clone votre fork
  (`github.com/my-username/sfdx-hardis-training`) et lit ce qui s'y trouve réellement. `uat` reçoit
  les mêmes fichiers avec sa première promotion, au [Lab 3.5](../level-3-release-manager/3-5-promote-to-uat-and-write-release-notes.md), comme tout changement qui l'atteint
- **`integration` et `uat` protégées.** Une Pull Request vers l'une ou l'autre ne peut être mergée
  qu'une fois que tous les contrôles que GitHub lance dessus sont terminés et verts, et cette règle
  vaut aussi pour vous, propriétaire du fork. Sur un vrai projet, quelqu'un a mis cela en place dès
  le premier jour : un merge sur un contrôle rouge ne déploie rien, ou la moitié de quelque chose, et
  c'est la personne suivante qui s'en aperçoit
- **Un identifiant par job de CI.** Les jobs de CI sont les jobs automatisés que GitHub lance pour
  vous, sur ses machines plutôt que sur les vôtres, et ces machines ne peuvent pas atteindre une org
  Salesforce sans identifiant. Ils sont gardés comme secrets du repository, nommés
  `SFDX_AUTH_URL_INTEGRATION` et `SFDX_AUTH_URL_UAT`

!!! warning "Les scratch orgs expirent au bout de 30 jours"
    C'est le principe des scratch orgs, et cela convient très bien à une formation. Si vous revenez
    au bout d'un mois et qu'une org a disparu, recliquez sur **Set up my training environment**,
    depuis le menu Training du niveau où vous en êtes. Il ne reconstruit que ce qui a expiré, pointe
    le pipeline vers la nouvelle org et met le secret à jour.

    Ne les supprimez pas pour le plaisir : un Dev Hub Developer Edition ne peut créer que quelques
    nouvelles scratch orgs par jour.

!!! danger "À propos de ces identifiants, et pourquoi ils sont une exception assumée"
    Une auth URL SFDX embarque un **refresh token OAuth de longue durée**. Quiconque le lit a votre
    org jusqu'à sa révocation, et il ne peut pas être renouvelé sans se réauthentifier. La
    documentation sfdx-hardis le dit clairement : [ne l'utilisez jamais pour une org
    majeure](https://sfdx-hardis.cloudity.com/salesforce-devops-setup-auth/).

    Ce conseil est juste, et il parle de vraies orgs majeures. Ici les orgs sont des scratch orgs
    jetables contenant des installations solaires fictives, dans un repository qui vous appartient, pour
    une formation. Le marché est le suivant : un débutant atteint un pipeline qui marche dès sa
    première heure au lieu de son deuxième jour.

    **Le Lab 3.1 met JWT en place proprement pour les quatre orgs, et supprime ces secrets.** Si vous
    ne faites que les niveaux 1 et 2, supprimez les secrets quand vous avez terminé : les scratch
    orgs, elles, se suppriment toutes seules.

### 7. Laisser l'extension parler à GitHub

La commande que vous venez de lancer a utilisé la CLI GitHub. L'**extension** a sa propre connexion à
GitHub, et il lui en faut une aussi : sans elle, le diagramme du pipeline sait dessiner vos branches
mais ne sait rien de vos Pull Requests.

Sur la Welcome page, cliquez sur **DevOps Pipeline**. En haut du panneau se trouve une **icône
GitHub** **(1)**. Elle est **grise** tant que l'extension n'est pas connectée, et son infobulle dit
**Connect to GitHub**.

![Le panneau DevOps Pipeline, avec l'icône GitHub dans son en-tête](../../_assets/annotated/vscode/devops-pipeline-disconnected--github-auth.png)

Cliquez dessus. VS Code demande **How would you like to authenticate to GitHub?** et propose deux
réponses :

- **Sign in with VS Code**, qui ouvre votre navigateur et qui est ce qu'il vous faut ici
- **Use Personal Access Token (PAT)**, pour un hébergeur auquel VS Code ne sait pas se connecter, ou
  un compte que vous gardez à part

Prenez **Sign in with VS Code** et approuvez la demande dans le navigateur. L'icône passe du gris à
la couleur, son infobulle devient **Connected to GitHub**, et le panneau gagne ce qu'il ne pouvait
pas montrer avant : les Pull Requests sur vos branches, et le commutateur **Show feature branches**.

### 8. Regarder le pipeline avant de toucher à quoi que ce soit

![Le panneau DevOps Pipeline après la mise en place : deux branches, chacune avec son org](../../_assets/annotated/vscode/devops-pipeline-fresh--read-it.png)

Deux branches, deux orgs, et des flèches. C'est tout votre pipeline aujourd'hui, et il mérite une
minute parce que tous les diagrammes que vous rencontrerez plus tard sont celui-ci avec plus de
choses dedans.

1. **`integration`** et **`uat`** **(1)** sont des branches git, les deux branches *majeures* que ce
   projet a pour l'instant. Majeure veut dire que l'équipe les partage : le travail de chacun finit
   là, et personne ne construit directement dessus
2. Les deux boîtes de droite **(2)** sont les orgs Salesforce que ces branches possèdent, celles que
   la mise en place a nommées `helios-integration` et `helios-uat`. Le diagramme les étiquette
   d'après leur branche, on lit donc **Integration** et **Uat**. Une branche, une org, et cet
   appariement est ce que la mise en place que vous venez de lancer a écrit
3. Les **flèches** **(3)** sont les déploiements, et le chemin que prend le travail. Tout ce qui
   atteint `integration` est déployé dans son org par un robot, sans que personne ne clique sur quoi
   que ce soit. Faire avancer le travail d'`integration` vers `uat` est une **promotion**, et c'est
   le travail du release manager, ce que le Niveau 3 fait de vous

Rien d'autre n'est dessiné, parce que rien d'autre n'existe encore. Vous n'avez aucune branche à vous
en cours et aucune Pull Request ouverte, le diagramme n'a donc rien à ajouter. Le [Lab 1.3](1-3-start-a-user-story-on-a-git-branch.md) pose la
première boîte à gauche de cette image, et à partir de là elle se remplit.

Votre `helios-dev` n'est pas dans le diagramme non plus, et c'est correct : le diagramme montre où le
travail est déployé, et rien n'est jamais déployé dans l'org où vous construisez.

!!! note "`preprod` et `main` manquent exprès"
    Votre fork (`github.com/my-username/sfdx-hardis-training`) a une branche `main`, et pas encore de
    `preprod`, et le diagramme ne montre ni l'une ni l'autre : une branche ne fait partie du pipeline
    qu'à partir du moment où quelqu'un dit dans quelle org elle déploie, et personne ne l'a fait.

    C'est la forme de ce cours. Les niveaux 1 et 2 sont le travail d'un contributeur, qui se passe
    entre une branche de feature et `integration`. Le niveau 3 est le travail d'un release manager,
    et son premier lab câble `preprod` et `main` dans ce même diagramme, avec `helios-prod` en
    production.

## Ce que vous devez voir

De retour dans le panneau DevOps Pipeline, cliquez sur **Refresh**. `integration` et `uat`, chacune
avec son org, et l'icône GitHub en haut en couleur plutôt qu'en gris. Dans **Orgs Manager**, quatre
orgs : `helios-prod`, `helios-dev`, `helios-integration` et `helios-uat`, toutes **Connected**.

C'est toute la plomberie, et la dernière que vous verrez. À partir du [Lab 1.3](1-3-start-a-user-story-on-a-git-branch.md) vous faites le métier
au lieu de vous préparer à le faire : un ticket, une branche, une modification, une Pull Request, un
déploiement.

## En cas de problème

**Il dit que la CLI GitHub n'est pas installée, alors que vous venez de l'installer.**
VS Code était ouvert pendant l'installation et ne la voit pas encore. Fermez VS Code complètement,
rouvrez-le, et recliquez sur la carte. Si le message persiste, installez-la depuis
[cli.github.com](https://cli.github.com/), comme le montre l'étape 4.

**Il dit qu'aucune org connectée n'a été trouvée.**
L'étape 2 n'est pas finie : connectez votre org Developer Edition dans **Orgs Manager** et nommez-la
`helios-prod`.

**Il dit que le Dev Hub n'a pas pu être activé.**
Ouvrez `helios-prod` depuis **Orgs Manager**, allez dans **Setup**, tapez `Dev Hub` dans la zone
Quick Find, activez **Enable Dev Hub**, puis recliquez sur la carte.

**Il dit que le Dev Hub a déjà ses scratch orgs actives.**
Un Dev Hub Developer Edition en garde trois vivantes à la fois, et quelque chose d'autre consomme le
quota. Ouvrez `helios-prod`, puis **App Launcher > Active Scratch Orgs**, supprimez celles que ce
cours n'a pas créées, et recliquez sur la carte.

**Il dit que le quota quotidien est épuisé.**
Vous avez créé et supprimé des scratch orgs plusieurs fois aujourd'hui. Le quota revient sous 24
heures : recliquez sur la carte demain, et tout ce qui est déjà fait est conservé. Supprimer une
scratch org ne rend pas son quota, résistez donc à l'envie de supprimer et recréer :
**Reset this level** remet les branches en place sans toucher aux orgs, et **Clean up a training
org** en vide une sans la supprimer.

**Une commande échoue avec `TotalRequests Limit exceeded`.**
Une org Developer Edition répond à un nombre fixe d'appels API par jour, et une longue session de
déploiements, d'alimentation et de monitoring peut les épuiser. Rien n'est cassé et rien n'est
perdu : votre travail est sur votre fork. Le quota revient au fil des heures qui suivent, c'est donc
le moment de lire les blocs Sous le capot des labs que vous avez faits, et de revenir cliquer plus
tard.

**Il dit qu'Actions n'a pas pu être activé depuis ici.**
GitHub cache cet interrupteur derrière une bannière sans API. Ouvrez l'onglet **Actions** de votre
fork (`github.com/my-username/sfdx-hardis-training`) et cliquez sur **I understand my workflows, go
ahead and enable them**. Un clic, et la commande n'a plus rien à faire.

**L'onglet Actions n'affiche aucun workflow.**
Vous avez forké à la main à un moment donné en laissant "Copy the `main` branch only" coché.
Supprimez le fork sur GitHub et recliquez sur **Set up my training environment** : il ne copie jamais
la branche par défaut toute seule.

**Le diagramme du pipeline est vide.**
L'extension n'a pas trouvé `config/.sfdx-hardis.yml`. Vous avez ouvert le mauvais dossier : ce doit
être la racine du clone, le dossier qui contient directement `sfdx-project.json`.

**Le pipeline affiche des branches mais aucune Pull Request.**
L'extension n'est pas connectée à GitHub. C'est l'étape 7, et l'icône en haut du panneau est grise.

**VS Code n'arrive pas à pousser et redemande des identifiants en boucle.**
Déconnectez-vous de GitHub dans VS Code (icône **Accounts**, en bas à gauche) et reconnectez-vous
avec votre navigateur.

## Vérifiez votre travail

Welcome page > **Training: Level 1** > **Check my work**, puis choisissez le Lab 1.2.

## Pour aller plus loin

- [Cloner le repository](https://sfdx-hardis.cloudity.com/salesforce-devops-clone-repository/)
- [Créer un token d'accès Git](https://sfdx-hardis.cloudity.com/salesforce-devops-git-tokens/)
- [Authentification GitHub Actions](https://sfdx-hardis.cloudity.com/salesforce-devops-setup-auth-github/)

[Suite : Lab 1.3 - Démarrer une User Story sur sa propre branche Git](1-3-start-a-user-story-on-a-git-branch.md){ .md-button .md-button--primary }

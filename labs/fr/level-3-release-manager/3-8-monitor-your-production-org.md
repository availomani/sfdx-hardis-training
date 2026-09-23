---
id: lab-3-8
title: "Lab 3.8 - Monitorer votre org de production"
description: "Mettez en place le monitoring nocturne sfdx-hardis sur votre org Salesforce de production, lisez son premier rapport, et décidez quelles alertes méritent d'être reçues."
level: 3
lab: 8
lang: fr
source_rev: "7c72aa9f55c70ee2149f4d1fc01cf3571e086f86"
screenshots:
  - annotated/vscode/org-monitoring--not-a-monitoring-repo
  - annotated/vscode/monitoring-config--what-it-watches
  - annotated/vscode/org-monitoring--first-report
  - annotated/web/github-run-workflow
depends_on:
  commands: [hardis:org:configure:monitoring]
  flags: []
  config: [monitoringRepository, monitoringCommands, monitoringDisable, notificationConfig, msTeamsWebhookUrl]
  panels: [monitoringConfig, orgMonitoring]
  docs: [salesforce-monitoring-home, salesforce-monitoring-config-github, salesforce-monitoring-grafana-v2]
---

# Lab 3.8 - Monitorer votre org de production

**Niveau** : 3 Release Manager

**Durée** : ~35 min

**Vous allez** : mettre en place un monitoring nocturne sur la production, lire son premier rapport,
et décider de ce qui mérite qu'on vous en parle.

## La situation

Vous savez maintenant ce qui a été livré et quand. Vous ne savez pas dans quel état est la production
entre deux livraisons.

Sur une org que Victor a tenue deux ans, cela voudrait dire : des utilisateurs inactifs qui occupent
encore des licences, une Connected App dont personne ne se souvient d'avoir autorisé, de l'Apex sur
une version d'API vieille de quatre ans, un job planifié en échec toutes les nuits depuis mars.
Personne ne regarde, parce que regarder suppose de penser à regarder.

Le monitoring est la part du métier de release manager qui se joue quand rien n'est livré.

## Avant de commencer

- [ ] [Lab 3.7](3-7-hotfix-and-retrofit.md) terminé
- [ ] `helios-prod` connectée dans **Orgs Manager**
- [ ] Un repository GitHub vide à vous, avec `monitoring` dans son nom
- [ ] Environ 20 de ces 35 minutes seront la première exécution du monitoring

## Les étapes

### 1. Créer d'abord le second repository, vous-même

Le monitoring vit **toujours** dans son propre repository, séparé de celui depuis lequel votre
pipeline déploie. Pas en général, pas par préférence : toujours. C'est la partie que les gens
ratent, et c'est celle qui coûte cher à défaire une fois qu'une année de commits nocturnes s'est
empilée au mauvais endroit.

`sf hardis:org:configure:monitoring` ne crée pas ce repository pour vous. Il vérifie le nom de celui
dans lequel il se trouve, et si ce nom ne contient pas `monitoring` il demande **Do you use a
separate repository for your monitoring deployment sources?**, avec deux réponses :

- *Yes, I'm sure because I know what I'm doing, like Roman 😊*, qui continue quoi qu'il arrive
- *Mmmmm no, let me create another repo with the word "monitoring" in its name !*, qui arrête la
  commande

**Prenez la seconde.** La question existe parce que la commande ne peut pas être certaine à partir
d'un nom seul, pas parce que les deux sont des alternatives. Dans un repository dont le nom contient
bien `monitoring`, la question n'est jamais posée, et c'est l'état dans lequel vous voulez être
avant de commencer.

Donc, avant toute chose : créez un repository privé vide appelé `sfdx-hardis-training-monitoring`
sur GitHub. Faites-le ensuite descendre comme le [Lab
1.2](../level-1-contributor-basics/1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md) a fait
descendre celui-ci : **File > Open Folder** sur un dossier vide, panneau **Source Control**, **Clone
Repository**, et collez l'adresse du bouton vert **Code** de votre nouveau repository. Rien dans ce
lab ne se passe dans le repository où vous travaillez depuis le début du cours.

Pourquoi deux repositories, et c'est la même raison que sur les vrais projets :

| Raison                      | Détail                                                                                                                                                |
|-----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| Des permissions différentes | Le monitoring détient les identifiants de la production. Chaque contributeur a accès au repository de sources, et n'a pas besoin de celui-ci          |
| Un rythme différent         | Le monitoring commite toutes les nuits. Mélanger cet historique avec celui de vos sources rend les deux illisibles                                    |
| Un contenu différent        | Le monitoring stocke des sauvegardes nocturnes de l'org. Il grossit, et il ne doit pas grossir dans le repository que les gens clonent tous les jours |

Votre repository de sources et votre repository de monitoring sont deux choses différentes avec deux
publics différents. Si vous vous surprenez sur le point de répondre oui à cette question, le bon
mouvement est de vous arrêter et de créer le second repository, si tard que cela paraisse.

### 2. Lancer la configuration

Depuis le repository de monitoring, ouvrez l'**Org Monitoring Workbench** depuis la Welcome page et
cliquez sur **Install Org Monitoring**.

!!! note "Pas de bouton de ce nom ?"
    C'est que vous êtes dans le mauvais dossier. Ouvrez le même panneau depuis le repository où vous
    travaillez depuis le début du cours et vous obtenez ceci à la place :

    ![L'Org Monitoring Workbench ouvert depuis un repository CI/CD](../../_assets/annotated/vscode/org-monitoring--not-a-monitoring-repo.png)

    **Org Monitoring Not Present (CI/CD Repo)** **(1)** est le panneau qui vous dit qu'il
    n'installera pas le monitoring ici, et **Learn More** **(2)** est tout ce qu'il propose. Un
    projet qui a noté où vit son repository de monitoring reçoit un bouton **Open Monitoring Repository**
    à côté. Le bouton d'installation n'existe que là où ce qu'il installe a sa place.

La commande tourne dans un panneau et pose ses questions une à une, comme au [Lab 3.1](3-1-configure-the-pipeline-up-to-production.md) :

1. **Did you configure the sfdx-hardis monitoring pre-requisites on your Git server ?** La deuxième
   réponse, *ℹ️ No, bring me to the documentation!*, ouvre cette page et met fin à la commande :
   lisez-la donc d'abord si ce n'est pas fait
2. **Please select or connect to the org that you want to monitor** - `helios-prod`. Comme au
   [Lab 3.1](3-1-configure-the-pipeline-up-to-production.md), en faire l'org par défaut relance la commande : rechoisissez-la donc dans le nouveau
   panneau
3. **Branch monitoring_... does not exist on the remote server. Do you want to push it?** - oui.
   Celle-ci vient avant le certificat, pas après, et elle n'apparaît que la première fois
4. Puis les questions de certificat du [Lab 3.1](3-1-configure-the-pipeline-up-to-production.md), inchangées et dans le même ordre : auto-signé,
   laisser sfdx-hardis configurer l'External Client App, certificat chiffré sous forme de fichier,
   puis le même arrêt pendant que vous stockez les deux secrets, cette fois dans le repository de
   **monitoring**, puis le nom, l'e-mail de contact et le profil de l'application. La liste des
   profils est dans la langue de l'utilisateur de l'org, comme au [Lab 3.1](3-1-configure-the-pipeline-up-to-production.md)
5. **Do you want to save the configuration on the remote server (auto-commit)?** - oui

Pour finir, elle écrit le workflow sur `main` et le dit : *The monitoring workflow on main now runs
monitoring_...*. GitHub ne planifie que les workflows de la branche par défaut, et ne propose
**Run workflow** que pour ceux-là : le workflow qui lance chaque org monitorée vit donc sur `main` et
liste chaque branche de monitoring.

Elle ne demande jamais de nom de repository ni de fournisseur git, parce qu'elle n'en crée aucun.
L'authentification est le même code qu'au [Lab 3.1](3-1-configure-the-pipeline-up-to-production.md)
: External Client App, JWT, deux secrets à stocker, cette fois dans le repository de **monitoring**.
La clé atterrit dans `./.ssh/` plutôt que dans `config/branches/.jwt/`, et la configuration dans un
`.sfdx-hardis.yml` à la racine du repository, sur une branche appelée `monitoring_` plus le domaine
de l'org, tirée de `main`. Le repository était vide : elle donne donc d'abord à `main` un commit
vide d'où partir. Une branche par org monitorée est la façon dont un seul repository en surveille
plusieurs.

### 3. Choisir ce qu'il surveille

Ouvrez le panneau **Monitoring Config Workbench**. Une ligne par contrôle, et six colonnes :
**Command** **(1)**, **Frequency** **(2)**, puis **Messaging**, **Email** et **API** **(3)**, qui
sont la sévérité à partir de laquelle chaque canal est alimenté, et une dernière colonne d'actions
par ligne.

![Le Monitoring Config Workbench, avec la liste des contrôles, leur fréquence et leur routage par canal](../../_assets/annotated/vscode/monitoring-config--what-it-watches.png)

Il y a une trentaine de contrôles, ils viennent du produit et non de votre fichier de configuration,
et ils sont tous activés par défaut à des fréquences choisies par le produit : certains quotidiens,
d'autres hebdomadaires, d'autres mensuels. C'est le bon défaut et le mauvais réglage de long terme.

Pour une première exécution, laissez tout activé. Vous êtes sur le point de découvrir lesquels disent
quelque chose d'utile sur **cette** org-là, et cela ne se sait pas d'avance.

### 4. Le lancer une fois à la main

N'attendez pas cette nuit. Le workflow, **Org Monitoring sfdx-hardis**, est planifié à `0 0 * * *`
(minuit UTC) et accepte aussi un lancement manuel. Dans le repository de monitoring, ouvrez
**Actions**, cliquez sur **Org Monitoring sfdx-hardis** **(1)** dans la liste de gauche, puis sur
**Run workflow**
**(2)**. Laissez la branche sur `main` **(3)** et cliquez sur le **Run workflow** vert **(4)**.

![Le menu Run workflow du workflow Org Monitoring sur GitHub](../../_assets/annotated/web/github-run-workflow.png)

L'exécution apparaît dans la liste quelques secondes plus tard : cliquez dessus pour la suivre.

Elle prend un moment, l'essentiel étant la sauvegarde de l'org. Quand elle se termine, le repository
contient une sauvegarde complète des sources de la production et un jeu de rapports.

### 5. Lire le premier rapport

Ouvrez le panneau **Org Monitoring Workbench** dans VS Code, pointé sur le repository de monitoring.

![L'Org Monitoring Workbench, ouvert sur le repository CI/CD au lieu du repository de monitoring](../../_assets/annotated/vscode/org-monitoring--first-report.png)

Vérifiez d'abord la bannière **(1)**. **Org Monitoring Not Present (CI/CD Repo)** veut dire que vous
avez ouvert le mauvais dossier : ce panneau lit le repository de monitoring, pas celui où vous
travaillez depuis le début du cours. Ouvrez le repository de monitoring et la bannière disparaît.

Chaque contrôle est une carte, et les deux à ouvrir en premier sont **Detect calls to deprecated API
versions** **(2)** et **Detect unsecured Connected Apps in an org** **(3)**.

Soyez honnête sur ce que vous regardez. `helios-prod` est une org Developer Edition vieille de
quelques jours, avec un utilisateur dedans et une application que vous avez déployée vous-même. Rien
ne l'alimente avec les trouvailles qu'a une org de deux ans, et un rapport qui revient presque propre
n'est pas un rapport cassé.

Presque propre, pas propre : la première exécution est rouge. Le job **Monitoring** échoue sur
**Detect if org limits are close to be reached**, avec une limite à 100 % : `ActiveScratchOrgs`,
3 sur 3. `helios-prod` est aussi votre Dev Hub, et vos trois scratch orgs de formation occupent tous
ses emplacements. C'est une vraie trouvaille, le genre pour lequel un contrôle de limites existe :
sur un vrai Dev Hub, cela veut dire que personne dans l'équipe ne peut créer de scratch org tant
qu'une autre n'a pas expiré.

Et **Detect unsecured Connected Apps** en a une aussi : **Salesforce CLI**, marquée *Unsecured*.
C'est l'application par laquelle passe chaque `sf org login`, y compris les vôtres, et sur une org
Developer Edition elle est ouverte à tout utilisateur capable de se connecter. Sur une org de
production, c'est la première trouvaille à porter à l'équipe sécurité : un admin peut la restreindre
aux utilisateurs approuvés, et la CLI continue de fonctionner pour eux.

Ce que vous lisez, c'est la **forme** de chaque trouvaille, pour la reconnaître sur une vraie org :

| Trouvaille sur une vraie org                  | Ce que cela veut dire vraiment                                                                        |
|-----------------------------------------------|-------------------------------------------------------------------------------------------------------|
| **Des utilisateurs inactifs toujours actifs** | Des licences payées, et des comptes qui peuvent encore se connecter                                   |
| **Une Connected App non sécurisée**           | Quelque chose peut atteindre vos données de production et personne ne se souvient de l'avoir approuvé |
| **De l'Apex sur une vieille version d'API**   | Cela cassera à une release Salesforce, à une date que vous ne maîtrisez pas                           |

La seule trouvaille que vous devriez vraiment attendre ici est dans la **sauvegarde** plutôt que
dans un contrôle : la règle de validation que le [Lab 3.7](3-7-hotfix-and-retrofit.md) a corrigée
est dans l'org avec sa nouvelle formule, et elle est maintenant dans l'historique git du repository
de monitoring, datée. C'est la réponse à "quand est-ce que cela a changé", et c'est la part du
monitoring qui se rentabilise en premier.

### 6. Décider ce qui est du bruit, ce qui est la vraie compétence

C'est l'étape qui décide si le monitoring survit six mois.

Passez chaque trouvaille en revue et mettez-la dans l'un de trois paniers :

| Panier                           | Ce que vous faites                                                       | Exemple                                       |
|----------------------------------|--------------------------------------------------------------------------|-----------------------------------------------|
| **Agir maintenant**              | Corrigez-la cette semaine                                                | La Connected App non sécurisée                |
| **Suivre**                       | Mettez-la au backlog comme une story                                     | La vieille version d'API                      |
| **Faire taire, avec une raison** | Désactivez-la dans la configuration, avec un commentaire disant pourquoi | Un contrôle qui ne s'applique pas à cette org |

Sur `helios-prod`, `ActiveScratchOrgs` va dans **Suivre** : c'est réel, c'est attendu tant que le
cours tourne, et cela expirera avec les scratch orgs. Faire taire tout le contrôle de limites pour
elle cacherait toutes les autres limites avec, ce qui est exactement la mauvaise façon de faire
taire.

**Faire taire est légitime.** Un rapport de monitoring avec quarante trouvailles sur lesquelles
personne n'agit est pire que pas de monitoring, parce qu'il apprend à l'équipe que le rapport est du
bruit. Un rapport avec quatre trouvailles qui comptent toutes est lu tous les matins.

Ce qui n'est pas légitime, c'est de faire taire quelque chose parce que c'est gênant. Écrivez la
raison dans le fichier de configuration, et la personne suivante pourra ne pas être d'accord avec
vous en connaissance de cause.

### 7. Router une notification

Un rapport que personne n'ouvre n'est pas du monitoring.

Configurez **un** canal : Slack, Teams, Google Chat ou e-mail. Un seul suffit, et plus d'un le
premier jour veut dire le même message qui arrive deux fois et qui est ignoré des deux côtés.

De retour dans le **Monitoring Config Workbench**, les colonnes **Messaging**, **Email** et **API**
contiennent la sévérité à partir de laquelle chaque canal est alimenté, par contrôle. Réglez-les pour
que seuls les échecs et les trouvailles critiques soient envoyés. Un message nocturne "tout va bien"
est lu une semaine et filtré pour toujours ensuite.

Ces réglages sont écrits sous `notificationConfig` dans le `.sfdx-hardis.yml` du repository de
monitoring, une entrée par type de notification, fusionnée par-dessus les valeurs par défaut du
produit.

### 8. Le rendre trouvable

Le prochain release manager aura besoin du repository de monitoring dès son premier jour, et le seul
endroit où il regardera est le projet. De retour dans le repository de sources : **DevOps Pipeline**
> menu engrenage > **Pipeline Settings**, portée **Global Settings**, onglet **Salesforce Project**.
**Monitoring repository** : **Edit**, collez l'adresse de votre repository de monitoring,
`https://github.com/<votre-pseudo>/sfdx-hardis-training-monitoring`, et **Save**. Puis
**Training: Level 3** > **Publish my pipeline configuration** : c'est de la configuration de
pipeline, comme le reste.

À partir de là, l'**Org Monitoring Workbench** ouvert depuis le repository de sources propose
**Open Monitoring Repository** au lieu d'une impasse.

<details markdown="1"><summary>Sous le capot : ce qui tourne chaque nuit</summary>

La commande était :

    sf hardis:org:configure:monitoring

et elle a copié les fichiers de CI de **tous** les fournisseurs git à la fois, pas seulement GitHub.
Le workflow qu'elle a généré pour GitHub a quatre jobs :

1. **Backup** tourne en premier, seul : `sf hardis:org:monitor:backup` récupère toute l'org en format
   source et la commite. L'historique git de ce repository devient une réponse à "qu'est-ce qui a changé
   en production, et quand", que rien d'autre ne vous donne. Quand la récupération est faite, la même
   commande régénère la documentation de projet du [Lab 3.9](3-9-generate-the-project-documentation.md) avant de se terminer
2. Puis trois jobs en parallèle, chacun n'attendant que la sauvegarde : `sf hardis:org:test:apex`,
   MegaLinter, et `sf hardis:org:monitor:all`

`monitor:all` est là où vivent les contrôles. Il lance lui-même les commandes
`sf hardis:org:diagnose:*`, une par contrôle, puis applique les seuils et envoie les notifications.
Vous ne les trouverez pas listées dans le workflow.

`monitoringCommands` dans le `.sfdx-hardis.yml` du repository de monitoring n'est **pas** la liste
des contrôles : la liste est intégrée au produit, une trentaine, et cette clé ne fait que remplacer
des entrées par leur clé ou en ajouter de nouvelles. La laisser vide lance quand même tout.
`monitoringDisable` est l'interrupteur par contrôle, par clé du contrôle plutôt que par libellé, et
mettre la `frequency` d'un contrôle à `off` le sort aussi de l'exécution. `notificationConfig`
décide de ce qui part où, et à partir de quelle sévérité.

La sauvegarde nocturne est la partie sous-estimée. Quand quelqu'un demande "quand cette règle de
validation a-t-elle changé", la réponse est un `git log` sur le repository de monitoring, et cela
fonctionne même pour les modifications que personne n'a faites par la pipeline.

Si votre organisation utilise Grafana, les résultats peuvent alimenter des [tableaux de bord prêts à
l'emploi](https://sfdx-hardis.cloudity.com/salesforce-monitoring-grafana-v2/). C'est hors sujet ici,
et il est bon de savoir que cela existe.

<!-- command-links:start -->
Documentation des commandes : [hardis:org:configure:monitoring](https://sfdx-hardis.cloudity.com/hardis/org/configure/monitoring/), [hardis:org:monitor:backup](https://sfdx-hardis.cloudity.com/hardis/org/monitor/backup/), [hardis:org:test:apex](https://sfdx-hardis.cloudity.com/hardis/org/test/apex/), [hardis:org:monitor:all](https://sfdx-hardis.cloudity.com/hardis/org/monitor/all/)
<!-- command-links:end -->

</details>

## Ce que vous devez voir

- Un second repository, créé par vous, avec une exécution du workflow **Org Monitoring sfdx-hardis** : la
  sauvegarde, les tests Apex et MegaLinter au vert, et le job Monitoring au rouge sur
  `ActiveScratchOrgs`
- Une sauvegarde complète des sources de `helios-prod` commitée dedans
- Un premier rapport que vous avez lu et trié, aussi court soit-il
- Un canal de notification configuré
- `monitoringRepository` dans `config/.sfdx-hardis.yml` sur `integration`, pointant dessus

## En cas de problème

**Le workflow de monitoring échoue à l'authentification.**
Comme au [Lab 3.1](3-1-configure-the-pipeline-up-to-production.md) : l'External Client App a besoin
que l'utilisateur soit pré-autorisé, et les secrets doivent être dans le repository de
**monitoring**, pas dans celui des sources.

**Actions ne propose pas de Run workflow pour Org Monitoring sfdx-hardis.**
Le workflow n'est pas sur `main`. La commande l'y écrit à la fin, sur GitHub, et le dit. Si elle a
dit qu'elle n'y arrivait pas, copiez `.github/workflows/org-monitoring.yml` de la branche de
monitoring vers `main` et suivez les commentaires `MANUAL` qu'il contient.

**La sauvegarde dépasse le temps imparti.**
Une grosse org met longtemps. Sur une org Developer Edition cela ne devrait pas arriver : si c'est le
cas, regardez sur quel type de métadonnée elle bloque et excluez-le.

**Les notifications n'arrivent jamais.**
Le webhook est faux, ou le seuil est au-dessus de ce que le rapport a produit. Baissez le seuil
temporairement pour prouver que le canal fonctionne, puis remontez-le.

**Le rapport a quarante trouvailles.**
Attendu pour une première exécution sur n'importe quelle vraie org, et peu probable sur une org
Developer Edition vieille de quelques jours. L'étape 6 est le lab dans les deux cas.

**La commande refuse de tourner.**
Vous lui avez dit que vous n'êtes pas dans un repository de monitoring séparé, ce qui est la bonne
réponse quand vous ne l'êtes pas. Revenez à l'étape 1 et créez celui de monitoring.

## Vérifiez votre travail

Welcome page > **Training: Level 3** > **Check my work**, puis choisissez le **Lab 3.8**.

## Pour aller plus loin

- [Monitoring d'org](https://sfdx-hardis.cloudity.com/salesforce-monitoring-home/)
- [Monitoring sur GitHub](https://sfdx-hardis.cloudity.com/salesforce-monitoring-config-github/)
- [Tableaux de bord Grafana](https://sfdx-hardis.cloudity.com/salesforce-monitoring-grafana-v2/)

[Suite : Lab 3.9 - Générer la documentation du projet Salesforce](3-9-generate-the-project-documentation.md){ .md-button .md-button--primary }

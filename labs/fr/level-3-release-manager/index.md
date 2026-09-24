---
title: "Niveau 3 - Release manager Salesforce DevOps"
description: "Tenez une pipeline CI/CD Salesforce avec sfdx-hardis : environnements, authentification JWT, promotions, notes de version, hotfixes, monitoring et métriques DORA."
id: l3-home
level: 3
lang: fr
source_rev: "fc6954d3c4e0728198f404d0be20439b291214d5"
---

# Niveau 3 - Release manager Salesforce DevOps

**Durée** : environ 7 h.

**Prérequis** : le [Niveau 1](../level-1-contributor-basics/index.md) **et** le
[Niveau 2](../level-2-contributor-advanced/index.md). Les deux sont obligatoires, et l'audit du
badge les contrôle tous les deux avant de regarder quoi que ce soit ici.

## Pourquoi le Niveau 2 n'est pas facultatif

Un release manager relit les erreurs de déploiement, les deployment actions et les conflits des
autres. C'est exactement ce que le Niveau 2 vous fait traverser. Quelqu'un qui n'a jamais résolu une
erreur de déploiement ne peut pas juger si un contributeur a bien résolu la sienne, et les revues
qu'il fera porteront sur la mise en forme.

Si vous avez sauté le Niveau 2, faites-le. Ce sont quatre heures, et c'est la différence entre
approuver des Pull Requests et les comprendre.

## L'histoire

Victor Squeeker est parti. Il était le release manager, il a monté la pipeline il y a deux ans, et il
ne l'a jamais fini.

Ce dont vous héritez fonctionne, au sens où les contributeurs livrent dans `integration` tous les
jours et où le métier teste dans `uat`. Ce qu'il n'a pas :

- **Ni preprod ni production dans la pipeline.** Les branches existent. Rien n'y déploie
- **Pas d'authentification de CI correcte.** Il y a deux secrets de refresh token que quelqu'un a
  ajoutés à la hâte
- **Pas de monitoring.** Personne n'apprend qu'il y a un problème en production avant qu'un
  utilisateur n'appelle
- **Ni notes de version ni métriques.** Personne ne sait dire ce qui a été livré le mois dernier ni
  combien de temps cela a pris
- **Pas de documentation générée.** L'org a deux ans et la seule description qui en existe,
  c'était Victor

Votre première semaine consiste à finir la pipeline. Ensuite, vous la faites tourner.

## Le menu Training

Tout ce que ce cours vous demande de lancer en dehors des boutons du produit lui-même tient dans un
seul menu. Ouvrez la **Welcome page**, et sous **CUSTOM MENUS** cliquez sur la carte
**Training: Level 3**. Ses commandes prennent alors toute la page :

![Le menu de formation du niveau 3, ouvert sur la Welcome page](../../_assets/annotated/vscode/welcome-custom-menu-3.png)

Elles sont dix, et les labs les appellent par ces noms :

| Commande                              | Ce qu'elle fait                                                                                       |
|---------------------------------------|-------------------------------------------------------------------------------------------------------|
| **Set up my training environment**    | Reconstruit une scratch org qui a expiré, et pointe la pipeline dessus                                |
| **Where am I?**                       | Dit à quel niveau et à quel lab vous en êtes, et ce qu'il faut faire ensuite                          |
| **Set up one of my training orgs**    | Déploie l'application Helios et ses données dans une org que vous choisissez                          |
| **Simulate my teammates**             | Crée les branches et Pull Requests de collègues dont un lab a besoin                                  |
| **Publish my pipeline configuration** | Ouvre une Pull Request vers `integration` avec la configuration que vous avez modifiée                |
| **Check my work**                     | Vérifie le lab que vous venez de terminer et affiche votre reçu                                       |
| **Claim my badge**                    | Contrôle le niveau entier, puis ouvre votre demande de badge déjà remplie                             |
| **Update my course**                  | Apporte les changements reçus par le cours depuis votre fork, par une Pull Request vers `integration` |
| **Reset this level**                  | Remet votre repository au début du Niveau 3                                                           |
| **Clean up a training org**           | Retire l'application Helios et ses données d'une org                                                  |

Il y a un menu par niveau, et chacun ne contient que ce dont ce niveau a besoin : rien de ce que vous
avez sous les yeux ne concerne un lab que vous n'avez pas encore atteint.

Les mêmes commandes sont dans la vue **SFDX HARDIS** de la barre de gauche, sous
**Training: Level 3**. Les deux chemins lancent la même chose.

## Ce que vous allez faire

| Lab                                                       | Titre                                                          | Durée  |
|-----------------------------------------------------------|----------------------------------------------------------------|--------|
| [3.1](3-1-configure-the-pipeline-up-to-production.md)     | Configurer la pipeline CI/CD jusqu'à la production             | 75 min |
| [3.2](3-2-review-a-contributor-pull-request.md)           | Relire et merger la Pull Request d'un contributeur             | 25 min |
| [3.3](3-3-deploy-to-integration-and-read-the-log.md)      | Lire le log de déploiement, et ce que .forceignore lui cache   | 25 min |
| [3.4](3-4-merge-colliding-pull-requests.md)               | Trois Pull Requests se percutent : choisir l'ordre de merge    | 35 min |
| [3.5](3-5-promote-to-uat-and-write-release-notes.md)      | Promouvoir en UAT et écrire les notes de version               | 35 min |
| [3.6](3-6-release-to-production-and-read-dora-metrics.md) | Livrer en production et lire vos métriques DORA                | 35 min |
| [3.7](3-7-hotfix-and-retrofit.md)                         | La production est cassée : hotfix et retrofit                  | 35 min |
| [3.8](3-8-monitor-your-production-org.md)                 | Monitorer votre org de production                              | 35 min |
| [3.9](3-9-generate-the-project-documentation.md)          | Générer la documentation du projet Salesforce                  | 20 min |
| [3.10](3-10-promote-a-subset-with-promotion-branches.md)  | Promouvoir un sous-ensemble avec les promotion branches (Beta) | 55 min |
| [3.11](3-11-capstone-run-a-weekly-release-cycle.md)       | Épreuve finale : mener un cycle de release hebdomadaire        | 45 min |

## Une org de plus

Les niveaux 1 et 2 ont tourné sur une org Developer Edition, `helios-prod`, et les trois scratch orgs
qu'elle a créées : `helios-dev`, `helios-integration` et `helios-uat`. Ce niveau ajoute la production
et l'étape qui la précède, et demande une inscription de plus.

Avant le Lab 3.1, inscrivez-vous à une org Developer Edition gratuite de plus sur
[developer.salesforce.com/signup](https://developer.salesforce.com/signup) et connectez-la dans
**Orgs Manager** avec l'alias `helios-preprod`. Alimentez ensuite les deux orgs Developer Edition
avec **Training: Level 3 > Set up one of my training orgs** : `helios-preprod`, et `helios-prod`,
qui jusqu'ici ne faisait que créer les autres et ne contenait rien.

`helios-prod` reçoit les mêmes sources que les autres orgs. Rien n'alimente un historique de
déploiement : le rapport DORA du Lab 3.6 ne voit donc que l'alimentation et les déploiements que vous
faites vous-même.

Si une scratch org a expiré depuis le Niveau 2, **Training: Level 3 > Set up my training
environment** la reconstruit d'abord.

## Votre rôle change

Aux niveaux 1 et 2, vous construisiez des User Stories et ouvriez leurs Pull Requests. Un release
manager ne le fait pas. Vos collègues ouvrent les Pull Requests, **Simulate my teammates** les joue,
et vous les relisez, les mergez ou les renvoyez. Ce que vous créez vous-même, c'est la pipeline : sa
configuration, que **Publish my pipeline configuration** envoie vers `integration` par une Pull
Request, et les promotions d'une branche majeure à la suivante, `integration` vers `uat`, `uat` vers
`preprod`, `preprod` vers `main`.

[Commencer par le Lab 3.1](3-1-configure-the-pipeline-up-to-production.md){ .md-button .md-button--primary }

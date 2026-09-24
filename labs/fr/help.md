---
title: "Aide"
description: "Où poser votre question quand une étape du cours ne fonctionne pas, et ce que Cloudity propose à une équipe qui utilise sfdx-hardis sur un vrai projet Salesforce : mise en place, formation et support."
id: help
lang: fr
source_rev: "dd2d4d4ea73edc165941a654aca1555f82185c60"
---

# Aide

## Le cours et les outils sont gratuits

Tout ce que ce cours enseigne est open source. La CLI sfdx-hardis et l'extension VS Code qui la
pilote sont publiées sous licence AGPL-3.0, sur GitHub, et leur usage ne coûte rien :
[hardisgroupcom/sfdx-hardis](https://github.com/hardisgroupcom/sfdx-hardis) et
[hardisgroupcom/vscode-sfdx-hardis](https://github.com/hardisgroupcom/vscode-sfdx-hardis). Les labs
que vous lisez, leurs captures d'écran et le projet Helios Energy sur lequel ils reposent sont dans
[hardisgroupcom/sfdx-hardis-training](https://github.com/hardisgroupcom/sfdx-hardis-training), aux
mêmes conditions. Il n'y a pas de version payante du produit derrière une page de ce cours, ni de
version payante du cours.

Les deux viennent de [Cloudity](https://cloudity.com/), un cabinet de conseil Salesforce. Cloudity a
construit sfdx-hardis pour ses propres équipes de delivery, le publie au grand jour et continue de
le maintenir là. N'importe qui peut ouvrir une issue ou une Pull Request, et une bonne partie de ce
qui sort chaque mois a commencé par le rapport de bug de quelqu'un.

## Quand une étape du cours ne fonctionne pas

1. Ouvrez le bloc **En cas de problème** de l'étape. Il liste les deux ou trois façons dont cette
   étape échoue d'habitude, et quoi faire pour chacune.
2. Laissez un commentaire en bas de la page. Chaque page de ce cours se termine par une zone de
   commentaires, adossée aux GitHub Discussions : dites quelle étape, ce que vous avez cliqué et ce
   que vous avez vu. C'est le moyen le plus rapide de faire corriger la page, et cela aide la
   personne suivante bloquée au même endroit.
3. Pour le produit plutôt que pour le cours, lisez la
   [documentation sfdx-hardis](https://sfdx-hardis.cloudity.com/) et cherchez dans les
   [issues](https://github.com/hardisgroupcom/sfdx-hardis/issues) avant d'en ouvrir une.

## Quand le cours a changé après votre fork

Les pages des labs sont toujours à jour : vous les lisez sur ce site. Ce que contient votre fork
est figé au jour où vous l'avez créé : les scripts derrière le menu **Training**, les stories de
collègues de **Simulate my teammates**, les règles de **Check my work** et la configuration du
projet. Quand le cours ajoute un lab ou corrige l'un de ces éléments, votre fork ne le reçoit pas
tout seul.

Chaque commande du cours vous le dit : elle compare d'abord votre fork au cours, et indique combien
de changements vous manquent. **Where am I?** l'affiche toujours. Les changements des pages de
labs, des traductions, du site et les badges des autres participants sont ignorés : vous les lisez
ici, et ils ne changent rien à ce que votre fork exécute.

Pour récupérer les changements, cliquez sur **Update my course** dans le menu Training de votre
niveau. La commande merge le cours dans une branche à elle, créée depuis votre `integration`, et
ouvre une Pull Request vers `integration`, comme tout changement dans ce cours. Attendez ses
contrôles, mergez-la avec **Merge pull request**, jamais en squash, puis faites **Pull** dans le
panneau Source Control. Votre travail est conservé.

Si le cours et vous avez modifié le même fichier, la commande s'arrête, annule tout et nomme les
fichiers. Faites alors soit **Reset this level**, qui recommence le niveau depuis son état actuel et
jette votre travail sur `integration` dans ce niveau, soit le merge à la main, comme le
[Lab 2.7](level-2-contributor-advanced/2-7-resolve-a-git-merge-conflict.md) résout un conflit.

## De l'aide sur un vrai projet

Ce cours se déroule dans une entreprise fictive, avec des orgs gratuites et un repository que vous
créez pour vous. Un vrai projet apporte ce qu'aucun cours ne peut vous donner : une org avec dix
ans d'histoire dedans, une équipe qui doit continuer à livrer pendant que la pipeline se construit,
et un calendrier de releases. Cloudity fait ce travail en prestation, par-dessus le même produit
open source que ce cours enseigne.

- **Mise en place.** Votre équipe pilote et un expert Cloudity relit le modèle de branches, le
  pipeline et la configuration, ou bien Cloudity met toute la pipeline en place sur votre plateforme
  Git et vous le transmet.
- **Formation.** Des sessions pour les contributeurs, les release managers et les chefs de projet,
  et l'accompagnement au changement qui fait qu'une nouvelle façon de travailler tient dans la
  durée.
- **Support.** Un abonnement qui garde un expert Cloudity joignable après la mise en production,
  avec une priorité sur les incidents de déploiement, et un release manager en prestation quand
  personne n'occupe le poste.

## Le support est ce qui finance la maintenance de sfdx-hardis

sfdx-hardis est gratuit à utiliser. Il n'est pas gratuit à maintenir. Trois releases Salesforce par
an, des types de métadonnées qui changent de forme, des API qui bougent sous le produit, des bugs
trouvés par des équipes qui déploient en production un vendredi : quelqu'un doit faire ce travail,
semaine après semaine, et chez Cloudity ce quelqu'un est payé pour.

Ce sont les abonnements de support qui le financent, et qui financent la gratuité de ce cours. Si
votre équipe fait ses livraisons avec sfdx-hardis, un abonnement est le moyen le plus direct de
garder le projet vivant et en mouvement, et il met vos demandes d'évolution devant les personnes
qui décident de ce qui sort ensuite.

[Ce que propose Cloudity](https://sfdx-hardis.cloudity.com/salesforce-devops-home/#get-help-from-cloudity){ .md-button .md-button--primary }

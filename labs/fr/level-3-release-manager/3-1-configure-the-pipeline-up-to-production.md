---
id: lab-3-1
title: "Lab 3.1 - Configurer le pipeline CI/CD jusqu'à la production"
description: "Étendez un pipeline Salesforce à deux étages jusqu'à la production : branches, protections, et chaque org configurée et authentifiée en JWT par Add/Configure Org."
level: 3
lab: 1
lang: fr
source_rev: "4661bc03d2558cec0b10dc8f320de2e8a4617d66"
screenshots:
  - annotated/vscode/devops-pipeline--one-column
  - annotated/web/github-new-branch
  - annotated/web/github-branch-rules
  - annotated/web/github-branch-rule
  - annotated/vscode/pipeline-settings-menu--add-org
  - annotated/vscode/configure-auth-branch--branch-question
  - annotated/vscode/configure-auth-variables--secrets
  - annotated/web/github-secrets-actions
  - annotated/web/github-secret-new
  - annotated/vscode/pipeline-config--target-branches
  - annotated/vscode/pipeline-config-user-stories--target-branches
  - annotated/vscode/pipeline-config-deployment--deployment-tab
  - annotated/vscode/pipeline-cards--save-publish
  - annotated/vscode/work-save-completed
  - annotated/vscode/devops-pipeline-level3--four-stages
depends_on:
  commands: [hardis:project:configure:auth]
  flags: []
  config: [availableTargetBranches, availableTargetBranchesLabels, productionBranch, mergeTargets, targetUsername, instanceUrl, orgAuthenticationMode]
  panels: [pipeline, pipelineConfig, orgManager, commandExecution, promptInput]
  docs: [salesforce-devops-setup-home, salesforce-devops-setup-auth, salesforce-devops-setup-auth-github, salesforce-devops-setup-existing-org]
---

# Lab 3.1 - Configurer le pipeline CI/CD jusqu'à la production

**Niveau** : 3 Release Manager

**Durée** : ~75 min

**Vous allez** : transformer un pipeline à deux étages en un pipeline à quatre étages qui atteint la
production, donner à chaque étage son org et un identifiant avec lequel un vrai projet peut vivre, et
publier tout cela de la façon dont toute modification atteint une branche majeure : par une Pull
Request.

## La situation

Ouvrez le panneau **DevOps Pipeline** et regardez ce que Victor a laissé.

![Le panneau DevOps Pipeline avec integration et uat seulement](../../_assets/annotated/vscode/devops-pipeline--one-column.png)

`integration` **(1)** et `uat`, chacune avec son org **(2)**, et les branches de feature que vos
collègues ont en cours. Le travail atteint les testeurs métier, et là il s'arrête. Il n'y a pas de
`preprod`, et `main`, la production, est une branche où rien ne déploie : toutes les livraisons
jusqu'ici ont atteint la production à la main, ce qui est exactement le genre de livraison dont
personne ne peut rien dire après coup.

Et les deux étages qui existent atteignent leurs orgs par un raccourci. La CI se connecte à
`helios-integration` et `helios-uat` avec `SFDX_AUTH_URL_INTEGRATION` et `SFDX_AUTH_URL_UAT`, deux
secrets contenant des refresh tokens OAuth de longue durée. Le Niveau 1 vous a dit que c'était une
exception pour des scratch orgs jetables. Trois choses ne vont pas avec eux sur un vrai projet, et
quelqu'un vous demandera pourquoi vous y passez une heure :

1. **Ils ne peuvent pas être renouvelés.** En changer un veut dire se réauthentifier, en tant
   qu'humain, dans un navigateur
2. **Ce sont des identifiants au porteur sans portée.** Quiconque lit le secret dispose de tout ce
   dont cet utilisateur dispose, depuis n'importe où, jusqu'à révocation
3. **Ils sont liés à une personne.** Quand cette personne part ou que son token est réinitialisé, le
   pipeline s'arrête, et personne ne sait pourquoi

L'alternative est un **flow JWT via une External Client App** : un certificat que vous détenez, un
utilisateur pré-autorisé, aucun mot de passe nulle part, et une révocation en supprimant une
application. sfdx-hardis le met en place pour vous, org par org, et écrit la configuration de branche
au passage.

C'est votre première semaine. Rien de tout cela n'est inhabituel : la plupart des projets démarrent
avec les étages dont ils ont besoin le premier jour, et finir le pipeline attend le jour où quelqu'un
a besoin de livrer correctement.

## Avant de commencer

- [ ] Niveaux 1 et 2 terminés
- [ ] `helios-prod` toujours connectée dans **Orgs Manager**. C'est l'org Developer Edition à
      laquelle vous vous êtes inscrit au Niveau 1, et le Dev Hub de vos scratch orgs. À partir de ce
      lab, c'est aussi la production
- [ ] Une org Developer Edition gratuite de plus, créée sur
      [developer.salesforce.com/signup](https://developer.salesforce.com/signup) exactement comme la
      première, et connectée dans **Orgs Manager** avec l'alias `helios-preprod`
- [ ] Les deux alimentées : Welcome page > **Training: Level 3** > **Set up one of my training
      orgs**, une fois pour `helios-preprod` et une fois pour `helios-prod`
- [ ] `helios-integration` et `helios-uat` connectées dans **Orgs Manager**, comme depuis le
      Niveau 1
- [ ] Sur `integration` dans VS Code, avec rien en attente dans le panneau **Source Control**

!!! note "La CI, pas votre poste de travail"
    Votre propre connexion à ces orgs existe déjà et ne change pas : Orgs Manager continue de
    fonctionner exactement comme avant. Ce que vous mettez en place ici, c'est la façon dont un
    **runner GitHub**, qui n'est pas vous et n'a pas de navigateur, atteint chaque org.

## Les étapes

### 1. Décider la forme

Quatre questions, et leurs réponses sont tout le pipeline :

| Question                                                                                | Réponse Helios                                                                             |
|-----------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| Quelles branches sont **majeures**, c'est-à-dire ont une org et un job de déploiement ? | `integration`, `uat`, `preprod`, `main`                                                    |
| Quelle branche peut merger dans quelle autre ?                                          | `integration` dans `uat`, `uat` dans `preprod`, `preprod` dans `main`. Rien n'en saute une |
| Quelle branche est la production ?                                                      | `main`                                                                                     |
| D'où part un correctif urgent ?                                                         | De `preprod`, pour qu'il n'emporte jamais ce qui attend encore dans `integration` et `uat` |

Si vous ne savez pas les énoncer en une phrase chacune, les configurer n'y changera rien.

`preprod` gagne sa place de deux façons. C'est la dernière répétition avant la production, une org
qui contient ce que la production contient et dans laquelle personne ne travaille : une livraison qui
s'y déploie proprement n'a presque plus de surprises devant elle. Et c'est de là que partent les
hotfixes, ce dont parle le [Lab 3.7](3-7-hotfix-and-retrofit.md).

L'ordre de ce lab découle d'une règle : **une branche doit exister avant qu'une org puisse lui être
attachée**. Les branches viennent donc d'abord, puis leur protection, puis leurs orgs.

### 2. Créer la branche preprod

`main` existe déjà : c'est la branche par défaut de tout fork. `preprod` non, et elle part de `main`,
parce qu'elle contient ce que la production contient.

Dans votre fork (votre copie personnelle du repository du cours sur GitHub, par exemple
`github.com/my-username/sfdx-hardis-training`), ouvrez la page **Branches** : le compteur de
branches à côté du sélecteur de branche, ou `github.com/my-username/sfdx-hardis-training/branches`.
Cliquez sur **New branch** en haut à droite. Tapez `preprod` comme nom **(1)**, laissez la source
sur votre fork et `main` **(2)**, et cliquez sur **Create new branch** **(3)**.

![La boîte New branch de GitHub, créant preprod à partir de main](../../_assets/annotated/web/github-new-branch.png)

Prévenez ensuite VS Code : dans le panneau **Source Control**, menu **...**, **Pull, Push** >
**Fetch**. Les étapes suivantes listent les branches de votre fork, et une branche que VS Code n'a
pas récupérée n'est pas dans la liste.

### 3. Protéger preprod et main

À partir de maintenant, **personne ne pousse sur une branche majeure** : ni un contributeur, ni vous.
Toute modification atteint `integration`, `uat`, `preprod` et `main` par une Pull Request dont les
contrôles sont verts, et GitHub l'impose au lieu de faire confiance à chacun pour s'en souvenir.
Depuis le [Lab 1.2](../level-1-contributor-basics/1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md), `integration` et `uat` fonctionnent ainsi : la mise en place de l'environnement
les a protégées. `preprod` et `main` sont à vous de protéger, et un release manager le fait le jour
où les branches rejoignent le pipeline, pas après le premier mauvais merge.

Dans votre fork (`github.com/my-username/sfdx-hardis-training`), cliquez sur **Settings** **(1)**,
puis **Branches** **(2)** dans le menu de gauche. Les deux règles **(4)** sont celles que la mise en
place de votre environnement a créées au [Lab 1.2](../level-1-contributor-basics/1-2-create-your-dev-hub-scratch-orgs-and-pipeline.md). Cliquez sur **Add rule** **(3)**.

![Les réglages Branches d'un fork, avec le bouton Add rule et les deux règles existantes](../../_assets/annotated/web/github-branch-rules.png)

Le formulaire est long, et cinq choses y comptent. L'image est la règle d'`integration`, ouverte
depuis la liste ci-dessus : elle montre donc les valeurs que vous êtes sur le point de poser.

![Une règle de protection de branche exigeant une Pull Request et deux contrôles de statut, sans dérogation](../../_assets/annotated/web/github-branch-rule.png)

1. **Branch name pattern** **(1)** : `preprod`
2. Cochez **Require a pull request before merging** **(2)**, et décochez **Require approvals** en
   dessous : vous travaillez seul ici, et GitHub ne vous laisse jamais approuver votre propre Pull
   Request. Sur un vrai projet, demandez une approbation
3. Cochez **Require status checks to pass before merging** **(3)**. Une zone de recherche apparaît en
   dessous. Tapez `Simulate` et choisissez **Simulate Deployment to Major Org**, puis tapez `Mega` et
   choisissez **Mega-Linter**. Les deux atterrissent dans **Status checks that are required** : ce
   sont les deux contrôles que lance chaque Pull Request de ce cours
4. Cochez **Do not allow bypassing the above settings** **(4)**. Sans cela, le propriétaire du repository,
   c'est-à-dire vous, a encore une case pour pousser ou merger quand même
5. Cliquez sur **Create** en bas. Sur une règle existante, le même bouton affiche **Save changes**
   **(5)**

Puis **Add rule** à nouveau, pour `main`, avec les mêmes réglages. De retour sur la liste : quatre
règles, `integration`, `uat`, `preprod` et `main`.

La zone de recherche ne propose que les contrôles qui ont tourné sur ce repository dans les sept
derniers jours. Les deux ont tourné sur vos Pull Requests du Niveau 2, ils y sont donc, sauf si vous
avez fait une longue pause : dans ce cas ouvrez d'abord n'importe quelle Pull Request vers
`integration`, et ses contrôles les remettent dans la liste.

<details markdown="1"><summary>Sous le capot : ce que la règle impose</summary>

Un contrôle requis est reconnu par **le nom de son job**, pas par le fichier de workflow.
`Simulate Deployment to Major Org` est le job de `.github/workflows/check-deploy.yml`, qui tourne sur
chaque Pull Request vers les quatre branches majeures. `Mega-Linter` est le job de
`.github/workflows/megalinter.yml`, qui tourne sur chaque push, donc sur le dernier commit de chaque
Pull Request ouverte depuis une branche de votre fork.

Un workflow qui ne tourne que quand certains fichiers changent, comme `link-check.yml` ici, ne doit
jamais être requis : une Pull Request qui ne touche pas ces fichiers l'attend pour toujours, et
GitHub l'affiche comme **Expected**, jamais comme en échec.

La même règle, posée par l'API GitHub, est ce que **Set up my training environment** a fait pour
`integration` et `uat` :

    gh api -X PUT repos/<your-handle>/sfdx-hardis-training/branches/preprod/protection \
      -F "required_pull_request_reviews[required_approving_review_count]=0" \
      -f "required_status_checks[contexts][]=Simulate Deployment to Major Org" \
      -f "required_status_checks[contexts][]=Mega-Linter" \
      -F "required_status_checks[strict]=false" -F enforce_admins=true -F restrictions=null

`strict=false` est un choix : `true` exigerait en plus que chaque Pull Request soit à jour par
rapport à sa cible avant d'être mergée, ce qui, sur une `integration` chargée, veut dire mettre à
jour chaque branche ouverte après chaque merge. GitLab, Azure DevOps et Bitbucket ont les mêmes
réglages sous d'autres noms : branches protégées, politiques de branche, contrôles de merge.

</details>

### 4. Configurer integration et son org : Add/Configure Org

Passons aux orgs. Une seule commande fait tout pour une branche : elle écrit la configuration de
branche, l'org dans laquelle elle déploie et la branche dans laquelle elle merge, crée l'identifiant
avec lequel la CI se connecte, et déploie l'External Client App dans l'org. Vous la lancez une fois
par branche majeure, en commençant par `integration`.

Dans le panneau **DevOps Pipeline**, cliquez sur l'engrenage **(1)** en haut à droite et choisissez
**Add/Configure Org** **(2)**.

![Le menu engrenage du panneau DevOps Pipeline, ouvert sur Add/Configure Org](../../_assets/annotated/vscode/pipeline-settings-menu--add-org.png)

La commande tourne dans un panneau et pose une question à la fois **(1)**, avec les réponses à
cliquer en dessous **(2)**. La voici à la deuxième question, avec `helios-integration` déjà choisie.

![La commande Add/Configure Org demandant quelle branche git configurer](../../_assets/annotated/vscode/configure-auth-branch--branch-question.png)

Elle pose une douzaine de questions, dans cet ordre :

1. **Please select or login into the org you want to configure the SF CLI Authentication** -
   `helios-integration`. La commande en fait votre org par défaut et, parce que cela a changé,
   VS Code relance la même commande. Choisissez `helios-integration` une deuxième fois dans le
   nouveau panneau et continuez à partir de là
2. **What is the name of the git branch you want to configure Automated CI/CD deployments from?** -
   `integration`. La liste est construite depuis les branches de votre fork, et les branches dont le
   nom contient un `/` sont écartées, c'est pourquoi aucune branche de feature n'est proposée
3. **What is the base URL or domain or the org you want to connect to, as integration related
   org ?** Prenez **🧪 Sandbox or Scratch org (test.salesforce.com)** : `helios-integration` est une
   scratch org, et une scratch org se connecte comme une sandbox. La réponse surlignée est celle du
   dessus, **📝 Custom login URL** : lisez donc cette liste plutôt que d'appuyer sur Entrée
4. **What are the target git branches that integration will be able to merge in?** - `uat`. C'est le
   chemin de merge de l'étape 1, écrit sous `mergeTargets`
5. **What is the Salesforce username that will be used for deployments by CI server ?** - le nom
   d'utilisateur de `helios-integration`, qu'elle vous propose déjà rempli
6. **How do you want to provide the SSL certificate?** - **Generate a self-signed certificate
   (default)**. L'autre réponse, signé par une autorité, ne génère rien et se contente d'afficher des
   instructions
7. **Do you want sfdx-hardis to configure the SF CLI External Client App or Connected App on your
   org ?** - oui
8. **Which JWT certificate storage mode do you want?** - **ClientId + decryption key as secret
   variables + encrypted certificate as file (default)**. L'autre mode met le certificat lui-même
   dans un troisième secret et supprime le fichier
9. **Please confirm when variables have been set.** Celle-ci est un arrêt, et l'étape 5 est ce
   qu'elle attend. Ne cliquez pas encore sur **Validate**
10. Puis, après votre confirmation : le **nom** de l'External Client App, un **e-mail de contact**,
    et le **profil à pré-autoriser** (`System Administrator`). La liste affiche les noms de profils
    dans la langue de l'utilisateur de l'org : une org réglée en français liste donc
    `Administrateur système` à la place

### 5. Stocker les deux secrets, puis laisser la commande finir

Juste au-dessus de la question 9, le panneau affiche les deux valeurs dont la CI a besoin **(2)**,
chacune avec un bouton de copie. Rien ne les réaffiche, ne fermez donc pas le panneau. Le panneau
garde chaque question à laquelle vous avez répondu **(1)**, et les fichiers qu'il a écrits sont dans
la barre de rapports en bas **(3)**.

![La commande Add/Configure Org affichant les deux secrets et attendant qu'ils soient stockés](../../_assets/annotated/vscode/configure-auth-variables--secrets.png)

Dans votre fork (`github.com/my-username/sfdx-hardis-training`), ouvrez **Settings > Secrets and
variables > Actions (1)**, puis cliquez sur **New repository secret (2)** :

![Là où un fork garde les valeurs que sa CI lit](../../_assets/annotated/web/github-secrets-actions.png)

La page liste les **noms** des secrets que le repository détient et jamais leurs valeurs **(3)**.
Rien, pas même GitHub, ne peut vous remontrer une valeur stockée. C'est toute la raison pour
laquelle le panneau vous demande de ne pas le fermer.

Chaque secret est un formulaire : le **Name (1)**, le **Secret (2)** collé depuis le panneau, puis
**Add secret (3)**. Faites-le deux fois :

![Le formulaire New secret, avec le nom et la valeur copiée depuis le panneau](../../_assets/annotated/web/github-secret-new.png)

| Nom                           | Valeur                                   |
|-------------------------------|------------------------------------------|
| `SFDX_CLIENT_ID_INTEGRATION`  | la consumer key affichée par la commande |
| `SFDX_CLIENT_KEY_INTEGRATION` | la passphrase affichée par la commande   |

Le suffixe est **le nom de la branche en majuscules**. C'est toute la convention, et c'est pourquoi
les noms ne sont pas arbitraires.

!!! note "L'avertissement orange sur votre YAML de pipeline"
    Sous les deux valeurs, le panneau avertit que sur GitHub un secret doit aussi être passé au job
    dans `.github/workflows/*.yml`. Il a raison, et c'est l'étape que les gens oublient : un secret
    que GitHub détient et que le workflow ne lit jamais est un secret dont le job ne dispose pas. Les
    workflows de ce cours passent déjà les huit, `SFDX_CLIENT_ID_*` et `SFDX_CLIENT_KEY_*`, pour les
    quatre branches. Ouvrez `.github/workflows/process-deploy.yml` et lisez son bloc `env:` une fois,
    parce que sur votre propre projet ce bloc, c'est à vous de l'écrire.

Cliquez maintenant sur **Validate** à la question 9, répondez aux trois dernières questions, et
laissez la commande créer l'application.

Ce qu'elle a écrit, et où :

| Quoi                                 | Où                                                                            | Ce que c'est                                                  |
|--------------------------------------|-------------------------------------------------------------------------------|---------------------------------------------------------------|
| La configuration de branche          | `config/branches/.sfdx-hardis.integration.yml`                                | `targetUsername`, `instanceUrl` et `mergeTargets`             |
| Une clé privée chiffrée              | `config/branches/.jwt/integration.key`                                        | L'identifiant lui-même, destiné à être commité                |
| Un certificat                        | `integration.crt` dans votre dossier personnel, supprimé après le déploiement | Ce qui est téléversé dans l'org                               |
| Une définition d'External Client App | déployée dans l'org par la commande                                           | Ce contre quoi Salesforce authentifie                         |
| Deux valeurs à stocker comme secrets | affichées dans le panneau de la commande                                      | `SFDX_CLIENT_ID_INTEGRATION` et `SFDX_CLIENT_KEY_INTEGRATION` |

La clé privée est **chiffrée**, avec une passphrase que la commande génère au hasard et que seul
votre secret détient. Le repository seul ne suffit pas à s'authentifier, et c'est ce qui rend
acceptable de commiter la clé.

### 6. Vérifier l'autorisation qu'elle a faite pour vous

L'étape contre laquelle tout le monde vous met en garde, pré-autoriser l'application, est celle que
la commande a déjà faite : l'External Client App qu'elle déploie porte
`Admin approved users are pre-authorized` et le profil que vous avez nommé à la dernière question.
Regardez-la une fois, pour savoir où elle est le jour où cela compte.

Dans `helios-integration` : **Setup > External Client App Manager**, ouvrez l'application, dont le
nom par défaut était `sfdxhardisintegration`, puis **Policies**. Permitted Users affiche
*Admin approved users are pre-authorized*, et le profil est listé.

Cela compte à cause du seul chemin où ce n'est **pas** fait pour vous : si le déploiement de
l'application échoue et que la commande retombe sur l'affichage d'instructions manuelles, ces
instructions s'arrêtent au téléversement du certificat. Suivez-les à la lettre et la première
connexion de CI échoue avec `user hasn't approved this consumer`, un message exact qui se lit comme
un bug.

### 7. La même chose pour uat, preprod et main

Même engrenage, **Add/Configure Org**, trois fois de plus, une par branche et son org :

| Branche   | Org              | Réponse pour l'URL de base                                                 | Merge dans     | Secrets                                             |
|-----------|------------------|----------------------------------------------------------------------------|----------------|-----------------------------------------------------|
| `uat`     | `helios-uat`     | **🧪 Sandbox or Scratch org (test.salesforce.com)**                        | `preprod`      | `SFDX_CLIENT_ID_UAT`, `SFDX_CLIENT_KEY_UAT`         |
| `preprod` | `helios-preprod` | **☢️ Other: Dev org, Production org or DevHub org (login.salesforce.com)** | `main`         | `SFDX_CLIENT_ID_PREPROD`, `SFDX_CLIENT_KEY_PREPROD` |
| `main`    | `helios-prod`    | **☢️ Other: Dev org, Production org or DevHub org (login.salesforce.com)** | ne cochez rien | `SFDX_CLIENT_ID_MAIN`, `SFDX_CLIENT_KEY_MAIN`       |

Vérifiez l'org deux fois pour `main` : pointer la production vers la mauvaise org est l'erreur la
plus coûteuse disponible dans ce lab. `preprod` et `main` sont des orgs Developer Edition, qui se
connectent comme le fait la production, et seules les scratch orgs et les sandboxes utilisent
`test.salesforce.com`.

Huit secrets, quatre External Client Apps, quatre clés. Fastidieux une fois, puis plus jamais.

### 8. Laisser les contributeurs démarrer un hotfix

Les contributeurs choisissent où va une User Story dans une liste, et `preprod` n'y est pas encore.

Ouvrez le panneau **DevOps Pipeline**, le menu engrenage, **Pipeline Settings**. Le titre de la page
indique **Global Pipeline Settings**, et le sélecteur de portée **(1)** indique **Global Settings**.

![L'écran Global Pipeline Settings, avec le sélecteur de portée, le bouton Edit et l'onglet User Stories](../../_assets/annotated/vscode/pipeline-config--target-branches.png)

Cliquez sur **Edit** **(2)**, puis sur l'onglet **User Stories** **(3)**.

Deux champs comptent, et ce sont **deux zones de texte distinctes, une valeur par ligne** :
**Available PR/MR target branches (1)** et **Labels for available PR/MR target branches (2)**. Rien
ne les apparie sinon leur ordre : la ligne 2 de l'une appartient donc à la ligne 2 de l'autre.

![Les deux listes de branches cibles de l'onglet User Stories, déverrouillées pour édition](../../_assets/annotated/vscode/pipeline-config-user-stories--target-branches.png)

Aujourd'hui chacune contient une seule ligne, celle qu'un contributeur choisit depuis le Niveau 1.
Ajoutez une deuxième ligne à chacune, à la même position :

| Ligne | Branche     | Libellé                                                               |
|-------|-------------|-----------------------------------------------------------------------|
| 1     | integration | `The shared integration org, where every contributor merges`          |
| 2     | preprod     | `Hotfixes on the production version, agreed with the release manager` |

`uat` et `main` ne sont pas dans cette liste, exprès. Personne ne construit une User Story contre
elles : le travail atteint `uat` par promotion depuis `integration`, et `main` par promotion depuis
`preprod`.

**Save (3)**.

!!! note "Vous cherchez la branche de production ?"
    `productionBranch` n'a pas de champ dans le panneau de réglages, et ce projet la porte déjà :
    `productionBranch: main`, dans le bloc Pipeline de `config/.sfdx-hardis.yml`. Qu'un panneau
    couvre l'essentiel d'une configuration et pas la totalité est normal, et c'est pourquoi les
    sections sous le capot de ce cours continuent de vous montrer le fichier.

### 9. Dire au panneau ce que le projet utilise désormais

`config/.sfdx-hardis.yml` porte `orgAuthenticationMode: secretsOnly`, mis là quand le cours vous a
tendu le raccourci de l'auth URL. Cela dit au panneau DevOps Pipeline de ne pas chercher de fichiers
de clé de certificat, et de ne pas vous avertir quand il n'y en a pas. Il y a des clés maintenant,
donc cette ligne est un mensonge, et un panneau à qui on ment cesse de pouvoir vous avertir.

Toujours dans **Pipeline Settings**, portée **Global Settings** **(1)**, ouvrez l'onglet
**Deployment** **(2)**.

![Le panneau Global Pipeline Settings, onglet Deployment](../../_assets/annotated/vscode/pipeline-config-deployment--deployment-tab.png)

**Org Authentication Mode** **(3)** affiche *CI/CD secrets variables only*. Cliquez sur **Edit**
**(4)**, changez-le en *Encrypted certificate key files*, et **Save**. Désormais le panneau vérifie
`config/branches/.jwt/<branche>.key` pour chaque branche majeure et le dit quand il en manque une.

### 10. Supprimer le raccourci, avant que quoi que ce soit ne prouve quoi que ce soit

Dans votre fork (`github.com/my-username/sfdx-hardis-training`) : **Settings > Secrets and variables
> Actions**, trouvez `SFDX_AUTH_URL_INTEGRATION` et `SFDX_AUTH_URL_UAT`, et supprimez les deux.

Faites-le maintenant, avant de publier. L'étape d'authentification de chaque job cherche d'abord
`SFDX_AUTH_URL_<BRANCHE>` et s'arrête là dès qu'elle en trouve une. Tant que les deux secrets
existent, un job vert ne prouve rien sur vos clés : il s'est connecté à l'ancienne. Une fois qu'ils
ont disparu, la seule entrée est celle du JWT, et le prochain job vert est donc la preuve.

### 11. Publier la configuration par une Pull Request

Tout ce que vous avez fait est constitué de fichiers sur votre disque, sur `integration` : les quatre
fichiers de branche, les quatre clés, les branches cibles et le mode d'authentification. Ils
atteignent `integration` comme toute modification, par une Pull Request aux contrôles verts. La
protection de l'étape 3 refuserait tout le reste.

Vous les publiez comme vous avez publié une User Story au Niveau 1, avec les deux mêmes boutons.

**Mettez-les sur une branche à part.** Vos modifications sont posées sur `integration`, qui n'accepte
rien directement. **Ctrl+Shift+P**, **Git: Create Branch...**, et nommez-la
`config/pipeline-up-to-production`. VS Code emporte les fichiers non commités avec vous, rien n'est
donc perdu et plus rien n'est sur `integration`.

**Commitez-les.** Dans le panneau **Source Control**, stagez les fichiers de configuration et
commitez-les sous `Configure the pipeline up to production`, exactement comme vous stagiez de la
métadonnée au [Lab 1.5](../level-1-contributor-basics/1-5-retrieve-commit-and-publish-your-changes.md).

**Publiez.** Dans le panneau **DevOps Pipeline**, cliquez sur la carte **Save / Publish** **(1)**,
celle par laquelle chaque story est passée depuis le [Lab 1.5](../level-1-contributor-basics/1-5-retrieve-commit-and-publish-your-changes.md). Elle demande la branche cible :
`integration`. Elle commite ce qui reste, lance le nettoyage, et pousse la branche.

![La carte Save / Publish du panneau DevOps Pipeline](../../_assets/annotated/vscode/pipeline-cards--save-publish.png)

**Ouvrez la Pull Request.** Quand elle se termine, la barre d'actions du bas commence par **Create
Pull Request** **(1)**. Cliquez : l'extension ouvre GitHub sur la page de Pull Request de cette
branche, déjà pointée sur `integration`.

![La fin de la commande Save / Publish, avec sa barre d'actions](../../_assets/annotated/vscode/work-save-completed.png)

La même barre porte le `package.xml` généré par la commande **(2)** et les deployment actions de
cette Pull Request **(3)**, comme au [Lab 1.6](../level-1-contributor-basics/1-6-pull-request-deployment-check-and-merge.md). Cette branche ne change aucune métadonnée, les deux
sont donc courts.

!!! tip "Le raccourci que ce cours garde pour plus tard"
    **Training: Level 3** > **Publish my pipeline configuration** fait tout ce qui précède en un
    clic : branche, commit, push, Pull Request. Les Labs 3.5 et 3.8 s'en servent, maintenant que vous
    avez vu ce qu'il recouvre. Un vrai projet n'a pas une telle entrée de menu, et c'est pourquoi ce
    lab le fait à la main.

Ouvrez la Pull Request dans votre fork. Son contrôle **Simulate Deployment to Major Org** se connecte
à `helios-integration` sans plus aucun secret d'auth URL à utiliser : ouvrez-le depuis **Checks**,
dépliez **Login & Process Deployment**, et cherchez `sf org login jwt`. Cette ligne et un contrôle
vert, c'est votre clé qui fonctionne.

Quand les deux contrôles sont verts, mergez avec **Merge pull request**, pas avec un squash : ce
n'est pas une feature, et la configuration doit voyager vers `uat`, `preprod` et `main` avec les
promotions, commit par commit ([Lab 1.6](../level-1-contributor-basics/1-6-pull-request-deployment-check-and-merge.md)). Puis **Pull** dans le panneau **Source Control** : votre
`integration` récupère la configuration, mergée.

`uat`, `preprod` et `main` prouvent leurs clés la première fois qu'une Pull Request y entre : la
promotion vers `uat` au [Lab 3.5](3-5-promote-to-uat-and-write-release-notes.md), puis `preprod` et `main` au [Lab 3.6](3-6-release-to-production-and-read-dora-metrics.md).

<details markdown="1"><summary>Sous le capot : ce que fait vraiment le flow JWT</summary>

La commande a lancé :

    sf hardis:project:configure:auth

et chaque job de CI lance maintenant, avant toute chose :

    sf org login jwt \
      --client-id $SFDX_CLIENT_ID_INTEGRATION \
      --jwt-key-file <clé déchiffrée> \
      --username <targetUsername de la config de branche> \
      --instance-url <instanceUrl de la config de branche> \
      --alias integration

La clé privée est déchiffrée au début du job avec `SFDX_CLIENT_KEY_INTEGRATION`, utilisée, et jamais
écrite quelque part de durable.

**Comment le hook d'authentification choisit.** Pour une branche `<B>`, il cherche d'abord
`SFDX_AUTH_URL_<B>`, dans cette orthographe puis en majuscules. S'il en trouve une, il s'en sert et
s'arrête, avant même que les variables JWT soient lues. Ce n'est que s'il n'y en a aucune qu'il
continue vers `SFDX_CLIENT_ID_<B>` plus la clé. Cet ordre est la raison pour laquelle l'étape 10
vient avant la publication.

La recherche JWT accepte aussi un `SFDX_CLIENT_ID` tout court sans suffixe, en dernier recours et
avec un avertissement dans le log : un secret unique sans suffixe resté d'une ancienne installation
répond pour toutes les branches.

`orgAuthenticationMode` n'est **pas** écrit par cette commande, et aucune commande CLI ne le lit. Il
dit seulement au panneau pipeline de VS Code quelle forme attendre : `secretsOnly` veut dire que les
identifiants vivent entièrement dans les secrets de CI, `encryptedCert`, la valeur par défaut, veut
dire que chaque branche majeure a une clé commitée.

</details>

<details markdown="1"><summary>Sous le capot : les fichiers que vous venez de publier</summary>

`config/.sfdx-hardis.yml` a gagné :

    availableTargetBranches:
      - integration
      - preprod
    availableTargetBranchesLabels:
      - "The shared integration org, where every contributor merges"
      - "Hotfixes on the production version, agreed with the release manager"
    orgAuthenticationMode: encryptedCert

et `config/branches/` contient maintenant quatre fichiers, chacun avec `targetUsername`,
`instanceUrl` et `mergeTargets`, plus un dossier `.jwt` avec quatre clés chiffrées.

**Une branche majeure n'est déclarée "majeure" nulle part.** Elle le devient en ayant un fichier de
configuration de branche avec une org dedans. C'est tout le mécanisme, et le savoir veut dire que
vous pouvez lire n'importe quel projet sfdx-hardis en deux minutes en listant `config/branches/`.
Chaque écran qui lit les branches majeures, le diagramme du pipeline et le sélecteur de portée de
Pipeline Settings compris, lit ce dossier.

`sf hardis:project:create` aurait généré le squelette d'un nouveau projet : les workflows de chaque
fournisseur git, `.mega-linter.yml`, `projectName`, `developmentBranch` et `autoCleanTypes`. Il
n'écrit aucun fichier `config/branches/` et ne demande aucune org à part le Dev Hub : les fichiers
de branche sont le travail d'Add/Configure Org, comme ci-dessus. La commande qui prend une org
existante sans aucun repository et produit le premier commit est `sf
hardis:org:retrieve:sources:dx`, le vrai point de départ de la plupart des projets.

</details>

### 12. Regarder le diagramme à nouveau

Ouvrez le panneau **DevOps Pipeline** et cliquez sur **Refresh**. Voici le pipeline que vous avez
construit :

![Le panneau DevOps Pipeline avec quatre branches majeures, chacune déployant dans son org](../../_assets/annotated/vscode/devops-pipeline-level3--four-stages.png)

1. **`integration`** **(1)**, là où les contributeurs mergent, avec la flèche de promotion qui en
   part
2. **`uat`** **(2)**, là où le métier valide
3. **`preprod`** **(3)**, la répétition de la production, et le point de départ des hotfixes
4. **`main`** **(4)**, la production
5. Les quatre orgs **(5)**, une par branche, dans l'ordre où le travail les traverse

Ce diagramme est désormais la vérité sur ce projet, et ce que vous montrez du doigt quand une partie
prenante demande "alors, ça en est où ?". Les boutons **+ PR** sur les flèches sont les Pull Requests
de promotion, et le [Lab 3.5](3-5-promote-to-uat-and-write-release-notes.md) est la première fois que vous en cliquez un.

## Ce que vous devez voir

- Quatre règles de protection de branche dans **Settings** > **Branches** de votre fork,
  `integration`, `uat`, `preprod` et `main`, chacune exigeant une Pull Request et les deux contrôles
- `config/branches/` sur `integration` contenant quatre fichiers et quatre fichiers `.jwt/*.key`
- Huit secrets dans votre fork, dont aucun n'est une auth URL
- Votre Pull Request de configuration mergée dans `integration`, avec `sf org login jwt` dans le log
  de son contrôle
- Le panneau DevOps Pipeline avec quatre colonnes et aucun avertissement de clé manquante

## En cas de problème

**preprod n'est pas dans la liste de branches d'Add/Configure Org.**
VS Code ne l'a pas récupérée. Panneau **Source Control**, menu **...**, **Pull, Push** > **Fetch**,
puis relancez la commande.

**La liste d'orgs propose une org `helios-` qui n'existe plus.**
Cela arrive quand une scratch org a expiré et que **Set up my training environment** en a construit
une nouvelle sous le même alias : la commande liste les orgs depuis un cache, et le cache contient
encore l'ancienne. La choisir fait s'arrêter la commande juste après "Selected Org", sans qu'aucune
question soit posée. La dernière réponse de la liste est la sortie :
**😱 I already authenticated my org but I don't see it !** vide ce cache. Relancez ensuite
**Add/Configure Org** et la liste est juste.

**La colonne preprod apparaît sans org.**
Le fichier de branche a été écrit pour un autre nom de branche. Cherchez une faute de frappe dans
`config/branches/` : le nom du fichier doit correspondre exactement à la branche.

**`user hasn't approved this consumer`.**
Étape 6 : l'External Client App existe mais l'utilisateur n'est pas pré-autorisé.

**`invalid_grant: audience is invalid`.**
L'URL d'instance ne correspond pas au type d'org : `https://test.salesforce.com` pour une scratch
org, `https://login.salesforce.com` pour une org Developer Edition. Vérifiez le fichier de branche du
job qui a échoué.

**Le job n'arrive pas à déchiffrer la clé.**
`SFDX_CLIENT_KEY_<BRANCHE>` est fausse ou a été copiée avec un saut de ligne à la fin. Recréez-la.

**`client identifier invalid`.**
L'External Client App derrière cette consumer key n'a jamais été créée : la commande s'est arrêtée
après avoir affiché les deux valeurs. Relancez **Add/Configure Org** pour cette branche, stockez les
deux nouvelles valeurs, et republiez.

**Tout passe alors que les secrets JWT manquent.**
Un secret d'auth URL est encore là et l'emporte toujours. Étape 10.

**Save / Publish n'a rien à publier, ou la branche n'a pas pu être créée.**
Vous êtes encore sur `integration` : créez d'abord la branche, avec **Git: Create Branch...**. Si au
contraire un fichier de configuration que vous avez modifié a aussi été modifié sur GitHub, tirez
dans le panneau **Source Control**, puis republiez.

**Le contrôle que vous voulez exiger n'est pas proposé.**
GitHub ne liste que les contrôles qui ont rendu compte sur ce repository dans les sept derniers
jours. Ouvrez une Pull Request vers `integration`, laissez ses contrôles tourner, et revenez à la
règle.

**Set up one of my training orgs échoue sur `helios-prod`.**
La cause habituelle est une connexion expirée : reconnectez-la dans **Orgs Manager** sous le même
alias, et relancez.

## Vérifiez votre travail

Welcome page > **Training: Level 3** > **Check my work**, puis choisissez le Lab 3.1.

## Pour aller plus loin

- [Guide d'installation](https://sfdx-hardis.cloudity.com/salesforce-devops-setup-home/)
- [Configurer l'authentification de la CI](https://sfdx-hardis.cloudity.com/salesforce-devops-setup-auth/)
- [Authentification GitHub Actions](https://sfdx-hardis.cloudity.com/salesforce-devops-setup-auth-github/)
- [Récupérer une org existante](https://sfdx-hardis.cloudity.com/salesforce-devops-setup-existing-org/)

[Suite : Lab 3.2 - Relire et merger la Pull Request d'un contributeur](3-2-review-a-contributor-pull-request.md){ .md-button .md-button--primary }

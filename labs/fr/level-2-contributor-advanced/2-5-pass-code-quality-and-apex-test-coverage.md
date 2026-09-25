---
id: lab-2-5
title: "Lab 2.5 - Passer la barrière de qualité de code et la couverture de tests Apex"
description: "Corrigez un avertissement PMD et la couverture de code Apex qui bloquent votre Pull Request, et lancez les mêmes contrôles depuis VS Code avant de pousser."
level: 2
lab: 5
lang: fr
source_rev: "73eac21691ef803b05712d5adfd945e732097fd5"
screenshots:
  - annotated/vscode/pipeline-cards--new-user-story
  - annotated/vscode/org-monitoring--apex-tests
depends_on:
  commands: [hardis:work:save, hardis:project:deploy:smart]
  flags: []
  config: [testLevel, apexTestsMinCoverageOrgWide, testCoverageNotBlocking]
  panels: [apexTestsSelect, pipeline]
  docs: [salesforce-devops-solve-megalinter-errors, salesforce-devops-work-on-user-story-development]
---

# Lab 2.5 - Passer la barrière de qualité de code et la couverture de tests Apex

**Niveau** : 2 Contributeur avancé

**Durée** : ~30 min

**Vous allez** : être bloqué deux fois par des robots, corriger les deux correctement plutôt que de
les contourner, et apprendre à lancer les contrôles avant de pousser.

## La situation

> **US-027 - Check several installations against panel availability at once**
>
> As a planner, I want to check a list of installations against panel availability in one go, so
> that I can fill a week of planning without opening every record.

Une modification Apex dans `InstallationScheduler`. Deux choses vont vous arrêter, et aucune des deux
ne concerne une métadonnée fausse :

1. **PMD**, l'analyseur de code Apex, lancé pour vous par MegaLinter, sur une requête à l'intérieur
   d'une boucle que vous êtes sur le point d'écrire en copiant un motif existant. Il **avertit**
2. **La couverture de code**, parce que la nouvelle branche de logique n'a pas de test. Elle
   **bloque**

La première est un choix de ce projet : il pourrait faire refuser l'analyseur, et il ne le fait pas.
La seconde est aussi un seuil de ce projet : 80 % de l'Apex de l'org exécuté par les tests, au-dessus
des 75 % qu'exige Salesforce lui-même. Savoir lesquelles de vos barrières avertissent et lesquelles
refusent est la moitié du travail sur une pipeline, ce lab vous en fait donc rencontrer une de chaque.

!!! note "Admins, ce lab est aussi pour vous"
    Il y a de l'Apex dedans, et vous n'en écrirez pas une ligne : chaque bloc se copie depuis cette
    page et se colle dans un fichier. Ce que vous pratiquez est ce qu'un admin rencontre sur tout
    vrai projet, une Pull Request bloquée par un analyseur de code ou par la couverture de tests, et
    comment lire ce que disent les robots avant de demander de l'aide à un développeur.

## Avant de commencer

- [ ] [Lab 2.4](2-4-ship-reference-data-and-a-batch-with-deployment-actions.md) terminé et mergé
- [ ] Prêt à lire quinze lignes d'Apex. Vous n'avez pas à en écrire : chaque bloc de ce lab est là
      pour être copié, et ce que le lab enseigne vraiment, c'est comment lire ce que les robots en
      disent

## Les étapes

### 1. Prendre la story

**New User Story** **(2)**, sous **Project Contribution Workflow** **(1)** du panneau DevOps
Pipeline. Branche `US-027-schedule-by-availability`, cible `integration`, org `helios-dev`.

![La carte New User Story du panneau DevOps Pipeline](../../_assets/annotated/vscode/pipeline-cards--new-user-story.png)

### 2. Ajouter la modification telle que les gens l'écrivent vraiment

Le planificateur veut vérifier plusieurs installations d'un coup. Ouvrez
`force-app/main/default/classes/InstallationScheduler.cls`, le fichier que la pipeline déploie déjà,
et collez-y la méthode ci-dessous, exactement comme l'a fait le développeur qui l'a écrite en
premier. C'est la façon évidente de faire, et c'est bien le problème :

```apex
    /**
     * The installations from the list that can be scheduled on the given day.
     *
     * @param installationIds the installations to check
     * @param wanted the day the planner wants
     * @return the ids that can take a crew that day
     */
    public static List<Id> schedulableOn(List<Id> installationIds, Date wanted) {
        List<Id> allowed = new List<Id>();
        for (Id installationId : installationIds) {
            for (Panel_Batch__c batch : [
                SELECT Arrival_Date__c
                FROM Panel_Batch__c
                WHERE Installation__c = :installationId
                ORDER BY Arrival_Date__c DESC
                LIMIT 1
            ]) {
                if (batch.Arrival_Date__c != null && wanted >= batch.Arrival_Date__c.addDays(PREPARATION_DAYS)) {
                    allowed.add(installationId);
                }
            }
        }
        return allowed;
    }
```

Celle-ci est un fichier, pas une modification d'org : il n'y a donc rien à récupérer. Commitez
`InstallationScheduler.cls` depuis le panneau **Source Control**, puis **Save / Publish**, poussez,
et ouvrez la Pull Request.

### 3. MegaLinter vous avertit

```
(Moderate)  pmd:OperationWithLimitsInLoop  force-app/main/default/classes/InstallationScheduler.cls
Avoid operations in loops that may hit governor limits
```

C'est dans le commentaire MegaLinter de votre Pull Request, sous **code-analyzer-apex**, au milieu de
quelques trouvailles sur du code qui était déjà là avant vous. Le contrôle de déploiement à côté est
vert : les tests exécutent toujours plus de 80 % de l'Apex de l'org, environ 81 %.

Une requête SOQL à l'intérieur d'une boucle `for`. Salesforce autorise 100 requêtes par transaction :
cette méthode marche donc parfaitement pour un planificateur qui vérifie cinq installations et lève
`System.LimitException: Too many SOQL queries: 101` la première fois que quelqu'un en vérifie cent
une. Elle passera tous les tests que vous écrirez et échouera un lundi chargé.

La correction est le seul motif Apex qui mérite d'être connu par cœur : **interroger une fois, en
dehors de la boucle, et indexer ce qu'on récupère**.

```apex
    public static List<Id> schedulableOn(List<Id> installationIds, Date wanted) {
        Map<Id, Date> latestArrival = new Map<Id, Date>();
        for (Panel_Batch__c batch : [
            SELECT Installation__c, Arrival_Date__c
            FROM Panel_Batch__c
            WHERE Installation__c IN :installationIds
            AND Arrival_Date__c != null
            ORDER BY Arrival_Date__c ASC
        ]) {
            latestArrival.put(batch.Installation__c, batch.Arrival_Date__c);
        }
        List<Id> allowed = new List<Id>();
        for (Id installationId : installationIds) {
            Date arrival = latestArrival.get(installationId);
            if (arrival != null && wanted >= arrival.addDays(PREPARATION_DAYS)) {
                allowed.add(installationId);
            }
        }
        return allowed;
    }
```

Une seule requête, quelle que soit la taille de la liste.

!!! note "Celle-ci avertit, elle ne bloque pas"
    L'analyseur Apex n'est pas bloquant sur ce projet : votre Pull Request reste mergeable avec cette
    trouvaille dessus. Rien ne vous empêche de livrer la boucle, sinon la lecture du commentaire.
    C'est un choix délibéré que fait un projet, et c'est pourquoi l'étape suivante est celle qui,
    elle, refuse vraiment.

### 4. Les tests vous bloquent

Poussez la correction. MegaLinter ne signale plus la boucle. Cette fois, c'est le contrôle de
déploiement qui **échoue**, et celui-là n'est pas un conseil :

```
[sfdx-hardis][apextest] Test run code coverage (org wide) 76.92% should be greater than 80%
```

Le commentaire sfdx-hardis le dit aussi, en rouge : **code coverage is insufficient**. Salesforce
seul l'aurait laissée passer, à 77 % pour son plancher de 75 % : le projet en demande davantage, et
le job de contrôle l'y tient.

La version avec la boucle était courte, et l'org la portait à 81 %. La correction est plus longue, et
chacune de ses nouvelles lignes est une ligne qu'aucun test n'exécute. Vous avez ajouté une méthode à
trois branches et aucun test. Ajoutez-les dans
`force-app/main/default/classes/InstallationSchedulerTest.cls` :

```apex
    @isTest
    static void schedulableOnRefusesBeforeThePanelsArrive() {
        Installation__c inst = [SELECT Id FROM Installation__c LIMIT 1];
        Test.startTest();
        List<Id> tooEarly = InstallationScheduler.schedulableOn(new List<Id>{ inst.Id }, Date.today());
        List<Id> lateEnough = InstallationScheduler.schedulableOn(new List<Id>{ inst.Id }, Date.today().addDays(60));
        Test.stopTest();
        System.assert(tooEarly.isEmpty(), 'The crew cannot be sent before the panels arrive');
        System.assertEquals(1, lateEnough.size(), 'A date after the buffer is allowed');
    }

    @isTest
    static void schedulableOnIgnoresInstallationsWithNoBatch() {
        Installation__c lonely = new Installation__c(Status__c = 'Planned', Crew_Size__c = 2, External_Id__c = 'TEST-INST-003');
        insert lonely;
        Test.startTest();
        List<Id> allowed = InstallationScheduler.schedulableOn(new List<Id>{ lonely.Id }, Date.today().addDays(30));
        Test.stopTest();
        System.assert(allowed.isEmpty(), 'With no panel batch, nothing can be scheduled');
    }
```

Remarquez ce que font les assertions : elles vérifient le **comportement demandé par la story**, avec
un message qui dit pourquoi. Un test qui se contente d'exécuter le code pour faire monter un
pourcentage est pire que pas de test, parce qu'il fait mentir le chiffre.

Le `Crew_Size__c = 2` sur l'enregistrement que crée le second test n'est pas de la décoration. Le
[Lab 2.3](2-3-fix-broken-records-with-an-apex-deployment-action.md) a rendu ce champ obligatoire : tout test qui insère une installation sans lui échoue
désormais, et un test en échec est un déploiement en échec. Chaque classe de test de l'org doit être
passée en revue pour cela, et c'est le vrai prix à payer pour rendre un champ obligatoire.

### 5. Lancer les contrôles avant de pousser, cette fois

Deux allers-retours par la CI pour trouver deux choses que vous auriez pu trouver sur votre machine.
Faites-le dans l'autre sens à partir de maintenant.

**Les tests Apex** tournent dans une org, et jusqu'ici votre modification n'existe que dans les
fichiers du projet : l'Apex de `helios-dev` est encore l'ancienne version. Envoyez-la là-bas d'abord.
Dans l'**Explorer**, clic droit sur `InstallationScheduler.cls`, puis **SFDX: Deploy This Source to
Org**, et faites de même pour `InstallationSchedulerTest.cls`. C'est l'extension Salesforce livrée
avec le pack d'extensions, et elle envoie ce seul fichier vers votre org par défaut.

Puis, sur la Welcome page, cliquez sur **Org Monitoring**. Dans la section **Apex Tests & Security**
du panneau qui s'ouvre, cliquez sur la carte **Apex Tests** **(1)** et choisissez `helios-dev`.

![L'Org Monitoring Workbench, avec la carte Apex Tests](../../_assets/annotated/vscode/org-monitoring--apex-tests.png)

Elle lance les tests Apex de l'org et vérifie le même seuil de couverture que la pipeline : vous avez
donc le succès, l'échec et le pourcentage sans rien pousser. Laissez-lui quelques minutes : une
scratch org met ses exécutions de tests en file d'attente, et la première de la journée peut prendre
dix minutes.

!!! note "La bannière du haut est normale"
    *Org Monitoring Not Present (CI/CD Repo)* veut dire que ce repository est une pipeline de livraison et
    non un repository de monitoring. Les cartes en dessous fonctionnent quand même sur l'org que vous
    choisissez. Le Lab 3.8 est là où le monitoring obtient son propre repository.

!!! note "L'onglet Apex Tests est une autre chose"
    Une Pull Request dans le panneau **DevOps Pipeline** peut afficher un onglet
    **Apex Tests (n) (beta)**. Il ne lance rien. Il choisit quelles classes de test le déploiement de
    cette Pull Request va lancer, et il n'apparaît que sur les projets qui posent
    `enableDeploymentApexTestClasses`. Helios ne le fait pas : il lance `RunLocalTests`, tous les
    tests de l'org, à chaque fois.

**Les linters** : c'est le seul contrôle que vous ne pouvez pas utilement lancer sur votre machine,
parce qu'il lui faut une image de conteneur que la CI possède déjà. Poussez, et lisez ce qu'ils
disent sur la Pull Request. Cela fait deux minutes d'attente plutôt que vingt de mise en place, et le
Niveau 3 montre la vue du release manager sur le même rapport.

<details markdown="1"><summary>Sous le capot : les deux commandes derrière ces cartes</summary>

La carte Apex Tests lance la même commande que la pipeline :

    sf hardis:org:test:apex

et les linters, sur les machines de GitHub, lancent MegaLinter avec la saveur Salesforce. Si vous
voulez un jour les avoir sur votre machine, c'est `npx mega-linter-runner --flavor salesforce`, et
il faut Docker.

<!-- command-links:start -->
Documentation de la commande : [hardis:org:test:apex](https://sfdx-hardis.cloudity.com/hardis/org/test/apex/)
<!-- command-links:end -->

</details>

### 6. Pousser et merger

Les deux au vert. Mergez, et vérifiez `helios-integration`.

<details markdown="1"><summary>Sous le capot : d'où viennent ces deux barrières</summary>

**La barrière de couverture** est dans `config/.sfdx-hardis.yml` :

    testLevel: RunLocalTests
    apexTestsMinCoverageOrgWide: 80
    testCoverageNotBlocking: false

`RunLocalTests` lance tous les tests de l'org sauf ceux des packages gérés. Le seuil est vérifié à
l'**échelle de l'org**, pas par classe, c'est pourquoi une classe mal couverte peut être portée par
le reste de l'org un certain temps puis bloquer soudain la Pull Request de quelqu'un d'autre. 75 %
est le minimum Salesforce, en dessous duquel aucun déploiement ne passe ; ce projet demande 80, et la
plupart des vrais projets posent 80 ou 85.

`testCoverageNotBlocking: true` transforme la barrière en avertissement. Elle existe pour les projets
qui reprennent une org historique, et c'est une mesure temporaire, pas un réglage.

**Les linters** sont MegaLinter, configuré dans `.mega-linter.yml`. La saveur Salesforce lance PMD
via Salesforce Code Analyzer sur l'Apex, plus un scanner de flows, plus les linters génériques. Il
tourne sur tout le repository pour une Pull Request vers une branche majeure, c'est pourquoi une
règle peut se déclencher sur un fichier que vous n'avez pas écrit.

Le linter, c'est votre équipe qui refuse, ou ici qui avertit. Le plancher de couverture, c'est
Salesforce qui refuse, et le réglage du projet choisit seulement s'il faut en demander davantage. Ni
l'un ni l'autre ne vérifie que le code fait la bonne chose, et c'est bien le sujet : Salesforce
déploie très volontiers un identifiant en dur couvert à 100 %.

</details>

## Ce que vous devez voir

- Le commentaire MegaLinter sans la boucle de `InstallationScheduler.cls` : les trouvailles sur le
  code qui était là avant vous sont toujours listées, et ne font toujours qu'avertir
- Le contrôle de déploiement vert, avec une couverture au-dessus de 80 % dans le commentaire
- `schedulableOn` dans `helios-integration`, avec une requête en dehors de la boucle

## En cas de problème

**MegaLinter échoue sur des fichiers que vous n'avez jamais touchés.**
Il analyse tout le repository pour une Pull Request vers une branche majeure. Si un problème
préexistant fait surface, corrigez-le : c'est vous qui l'avez trouvé. Si c'est vraiment hors sujet,
la porte de sortie est une exclusion documentée dans `.mega-linter.yml`, jamais une désactivation en
bloc.

**La couverture est toujours sous le seuil après l'ajout des tests.**
La couverture est à l'échelle de l'org. Regardez le tableau par classe dans le commentaire de la Pull
Request : une autre classe peut tirer la moyenne vers le bas.

**La carte Apex Tests dit qu'il n'y a pas d'org.**
Elle tourne sur l'org vers laquelle vous êtes pointé. Ouvrez **Orgs Manager** et vérifiez que
`helios-dev` est votre org courante, puis relancez la carte.

**Les tests Apex passent en local et échouent en CI.**
Presque toujours une histoire de données. Votre org de dev a des enregistrements que l'org
d'intégration n'a pas, ou l'inverse. Un test doit créer lui-même les enregistrements dont il a
besoin, plutôt que de faire confiance à ce qui se trouve dans l'org.

## Vérifiez votre travail

Welcome page > **Training: Level 2** > **Check my work**, puis choisissez le **Lab 2.5**.

## Pour aller plus loin

- [Résoudre les erreurs MegaLinter](https://sfdx-hardis.cloudity.com/salesforce-devops-solve-megalinter-errors/)
- [Règles de développement](https://sfdx-hardis.cloudity.com/salesforce-devops-work-on-user-story-development/)

[Suite : Lab 2.6 - Permission sets, profils, et pourquoi une autorisation disparaît](2-6-permission-sets-and-profiles.md){ .md-button .md-button--primary }

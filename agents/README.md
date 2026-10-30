# Agentforce agents

Each file here is a copy of the Agent Script of the latest version of an agent of the project, written by
sfdx-hardis (`hardis:org:retrieve:agent`, and the cleaning `autoAddAgentsDeploymentActions` of `hardis:work:save`).

Salesforce gives each agent version its own name (`aiAgentDefinitionVersions/<Agent>#<n>`,
`aiAuthoringBundles/<Agent>_<n>`), so a Pull Request shows a new version as new files only. This copy keeps
the same path from one version to the next: its diff is what changed in the agent.

These files are never deployed. Change the agent in Agentforce Builder, commit a version, and retrieve it.

See https://sfdx-hardis.cloudity.com/salesforce-ci-cd-agentforce-agents/#review-a-change-of-an-agent

# Microsoft integration plan

Status: planned, not connected. This repository does not contain Microsoft credentials or provision paid resources. A Microsoft Azure account and active subscription, with suitable resource and model permissions, are prerequisites for cloud deployment.

| Component | Intended use |
|---|---|
| Microsoft Foundry | Generate evidence-grounded explanations and match recaps in Fan and Analyst styles; evaluate factual consistency. |
| Azure Functions | Validate requests and expose the backend API; keep service credentials away from browsers. |
| Azure Blob Storage | Store versioned synthetic event streams, calculated fact packs and generated recaps. |
| Microsoft Agent Framework | Optional purposeful roles for evidence retrieval and explanation, with verification and failure recovery. |
| Azure AI Search | Optional retrieval over match evidence and supporting documents. |
| Azure Monitor / Application Insights | Measure latency, failures and the steps of the AI pipeline. |

Statistics remain reproducible calculations; the language model explains them. Synthetic pre-action estimates, authored alternatives and observed historical outcomes must remain distinct. Missing tracking must not be invented.

A single Azure subscription can host these resources; separate consumer accounts per service are not required. Hosting the frontend on Netlify is compatible with an Azure backend. The current frontend content security policy permits only same-origin requests: an actual integration must configure an appropriate API proxy or explicit connection policy and backend origin handling.

Before activation: confirm subscription, region/model availability, resource roles, costs, quotas and account terms. No promise of contest eligibility or award is made.

Official references:
- https://learn.microsoft.com/en-us/azure/foundry/tutorials/quickstart-create-foundry-resources
- https://learn.microsoft.com/en-us/azure/foundry/concepts/architecture
- https://learn.microsoft.com/en-us/agent-framework/get-started/
- https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md

# MatchLens Azure connector — deployed demo

The Foundry model deployment `matchlens-explainer` and agent `matchlens-football-intelligence` were created in the project owner's Azure account on 27 October 2026. The agent produced a structured response from the real synthetic Replay Lab fact pack; its fields, cited IDs and numeric claims passed the local validator. The web API is now deployed. Real historical and synthetic explanations have also been verified in the frontend.

## Backend

- Azure Functions v4 / Node.js 22 exposes `/api/health` and `/api/insight`.
- Both historical and synthetic requests are recalculated on the server using the existing engine; client-calculated facts are not trusted.
- Pre-action data excludes future event resolutions and authored outcomes.
- The model receives a compact fact pack and a strict response schema, with a maximum of 1,024 output tokens and no external tools.
- A managed identity accesses the configured model and dedicated private Blob Storage account; model keys are not put in the browser.
- Blob compare-and-swap reservations permit at most 250 shared inference attempts across instances and restarts; missing or failed usage control stops inference.
- Validated responses are cached; unsupported questions, exhausted allowance, model errors or failed checks return or preserve a clearly labelled local explanation.
- This is a **model-usage allowance**, not a guaranteed EUR billing cap: storage, API execution and monitoring also have usage charges; Azure budget alerts do not stop charges automatically.
- Numeric/evidence checks reduce specific errors but do not prove complete semantic correctness.

## Deployment review

The script checks and activates only the Storage, Web, Insights and OperationalInsights providers required by this deployment. It creates one dedicated resource group, a Standard LRS private StorageV2 account, and a small Flex Consumption function app with Application Insights created by Azure's standard workflow. It uses 512 MB instances, zero always-ready instances (the default), and the platform's minimum maximum-scale setting of 40. It assigns only the function's managed identity: model inference on the selected Foundry resource, and Blob Data Contributor on its own storage account. It does not change directory-wide roles or reset the persistent inference counter.

Requires Node.js 22, Python 3, npm and the official Azure CLI already connected to the intended account. The project owner has authenticated the deployment session. Cloud Shell was not used.

```sh
npm test
npm run build:azure
az account set --subscription YOUR_SUBSCRIPTION_ID
python3 scripts/deploy-azure-api.py \
  --subscription YOUR_SUBSCRIPTION_ID \
  --foundry-group YOUR_EXISTING_FOUNDRY_GROUP \
  --foundry-account YOUR_EXISTING_FOUNDRY_ACCOUNT \
  --confirm-budget-eur 10
```

Review resource costs and quotas before running. The flag records the explicit budget confirmation; it is not an Azure billing limit. The script expects the reviewed `GlobalStandard` deployment with at most 5,000 TPM and never chooses reserved GPU/PTU capacity. It does not deploy AI Search, VMs, databases or other unrelated services.

After any new deployment, verify health, one bounded synthetic request, evidence checks and role propagation. Cost reporting can lag and remains separate from the application allowance. The local server and configured Netlify build use a same-origin proxy. The product shows cloud availability only after a successful health check.

At allowance exhaustion the API returns HTTP 429 with code `demo_allowance_exhausted` and a deterministic local explanation. The frontend opens a dialog whose extension button prepares an email to contact@avatarz.com; visitors send it themselves. The notice is also accessible through About → Demo access & extension. The UI does not claim that the Azure account has run out of credit.

A conservative USD 5 planning ledger complements the 250-attempt limit. See [MICROSOFT.md](../MICROSOFT.md) for the reservation assumptions, legacy-ledger migration and distinction from actual billing. Cached responses are keyed by facts, model and narrative instructions; changing instructions invalidates the old cache entry.

## Sources

- [Azure Functions Flex Consumption](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-how-to)
- [Microsoft Foundry costs](https://learn.microsoft.com/en-us/azure/foundry/concepts/manage-costs)
- [Foundry setup](https://learn.microsoft.com/en-us/azure/foundry/tutorials/quickstart-create-foundry-resources)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

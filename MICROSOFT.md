# Microsoft integration — 27 October 2026

The demo uses Microsoft Foundry through a deployed Azure Functions API. A real historical explanation and a real synthetic Replay Lab explanation were displayed in MatchLens during verification. Statistics remain reproducible local/server calculations; the language model explains the supplied evidence.

| Component | Current use |
|---|---|
| Microsoft Foundry | `matchlens-explainer`: gpt-5-mini, Global Standard, 5,000 TPM. Grounded explanations in Fan and Analyst styles. |
| Foundry agent | `matchlens-football-intelligence`, version 2, separately configured and tested with synthetic evidence and strict JSON output. The application calls the model through its API; it does not invoke this saved agent. |
| Azure Functions | Node.js 22 / Flex Consumption API. Recalculates facts, validates scope and output, and falls back to local explanations. |
| Azure Blob Storage | Private shared inference ledger and validated-response cache. |
| Microsoft Entra managed identity | Scoped model inference and Blob access for the API; no model key in browser code. |
| Application Insights | Minimal latency, provider, failure-stage and token-count traces. No raw questions or model text are logged. |
| AI Search / Agent Framework | Future options; not connected. |

## Demo allowance

The project owner authorized up to EUR 10 for this sprint. The application permits **250 shared inference attempts**, persisted across instances and deployments. Validated cached responses consume no extra inference attempt. Failed model calls also consume a reserved attempt. Reaching the allowance pauses new generation and opens an extension dialog addressed to **contact@avatarz.com**; the visitor reviews and sends their own email. No payment is collected from visitors.

A second conservative USD 5 model-planning envelope reserves estimated maximum usage before inference. It uses deliberately cautious planning rates of USD 1/M input tokens and USD 4/M output tokens, a bounded fact pack and at most 1,024 output tokens. These are application planning assumptions, **not a quote or Azure invoice**. Old count-only ledgers are migrated conservatively without resetting usage. Storage failures stop inference. Storage, execution and monitoring have separate usage charges; this code is not an account-wide EUR billing cap. The subscription currently reports a FreeTrial offer with its spending limit on; exact available credit and billed cost have not been established.

## Accounts and hosting

One Microsoft account and one active Azure subscription cover the deployed Microsoft services; separate Microsoft 365, Fabric or Power BI subscriptions are not needed for this demo. The public source is at [avatarz-com/matchlens](https://github.com/avatarz-com/matchlens).

The frontend is configured for Azure Static Web Apps Free at https://mango-river-0b301f40f.4.azurestaticapps.net/. The public repository has a production deployment workflow. The site calls the existing Azure API using a narrowly allowed origin; no Standard-plan linked backend is required. The static-site management region is East US 2 because West Europe was not accepting new customers; the existing API and storage remain in North Europe, and Foundry remains in North Central US.

For another Azure deployment, build with `MATCHLENS_DEPLOY_TARGET=azure MATCHLENS_AZURE_API_BASE=https://YOUR_FUNCTION.azurewebsites.net/api npm run build` and allow that exact site origin in the Function platform CORS and application origin list. The build emits `staticwebapp.config.json` with explicit module MIME types, an API-specific CSP and a public endpoint module containing no credentials.

Netlify remains an optional hosting target. Build with `MATCHLENS_AZURE_API_BASE=https://YOUR_FUNCTION.azurewebsites.net/api npm run build` to generate a same-origin Netlify API proxy. The default build remains usable without a cloud account; AI controls appear only when a configured API responds as enabled. The Azure workflow verifies the same tests before publishing; no model key or Azure management credential is committed to the repository. A site-only deployment token is stored as an encrypted GitHub secret.

See [the connector guide](azure-api/README.md) for deployment and verification. Actual Microsoft usage does not itself guarantee competition eligibility or an award.

Official references:
- [Foundry setup](https://learn.microsoft.com/en-us/azure/foundry/tutorials/quickstart-create-foundry-resources)
- [Foundry costs](https://learn.microsoft.com/en-us/azure/foundry/concepts/manage-costs)
- [Functions Flex Consumption](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-how-to)
- [Competition rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md)

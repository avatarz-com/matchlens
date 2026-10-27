# MatchLens

**See the game. Understand the why.**

An independent AVATARZ football intelligence prototype with two perspectives on the same match facts: Fan and Analyst.

Public demo: [Open MatchLens](https://mango-river-0b301f40f.4.azurestaticapps.net/). The site is hosted on Azure Static Web Apps Free and deployed from the `main` branch after verification.

## Run locally

Requires Node.js 22 or later. No runtime package dependencies or API keys are needed.

```sh
npm test
npm start
```

Open http://127.0.0.1:4317/. The default route is the project home; `#overview` opens the match workspace and `#studio` opens the synthetic Replay Lab. The development server listens on localhost only.

## What works today

- A responsive presentation home with a clearly labelled 16:9 trailer placeholder.
- Fan / Analyst perspectives sharing the same underlying facts.
- 131 selected historical Premier League 2017/18 and World Cup 2018 matches, with 216,058 recorded events.
- Event exploration, shot maps, research xG / xPass estimates, contributions, local statistical questions, reports and a browser-local notebook.
- A separate synthetic Replay Lab with player viewpoints, layers and authored decision alternatives.
- 112 automated checks for the existing football engine, models and data behaviour.

Historical event positions are not continuous tracking. Replay scenarios are fictional and do not reconstruct the historical matches. Models are independent research estimates, with documented evaluation and limits in the Models & data view.

## AI and Microsoft status

**Microsoft AI explanations are connected in the configured demo.** A deployed Azure Functions API sends recalculated evidence to Microsoft Foundry using a managed identity. The shared allowance is 250 inference attempts; at exhaustion a dialog offers an extension request to contact@avatarz.com. Cached explanations remain accessible. The default static app also works without cloud access. Details and limitations: [MICROSOFT.md](MICROSOFT.md), [connector guide](azure-api/README.md). No live football feed is connected. The synthetic decision lab should form the basis of any synthetic-event hackathon demonstration.

## Build and share

```sh
npm run build
```

The verified public files are copied to `dist/`. Deploy that directory to a static host such as Netlify. The included `netlify.toml` builds the same directory from Git. No backend is deployed by this repository.

After intentionally editing a public asset, run `npm run prepare:preview`, then rerun tests and build; the public manifest records file sizes and SHA256 checksums. Internal notes, credentials, exports and browser sessions are not public assets.

## Optional model training

The checked-in models and processed data are sufficient to run the app. `scripts/train-demo-models.mjs` regenerates the synthetic demonstration model. `scripts/train-historical-models.py` downloads the pinned public source and trains the historical research models; it additionally requires Python, NumPy, SciPy, scikit-learn and curl. Training rewrites model/data files, so run it only when intentionally retraining, then refresh the public manifest and rerun checks.

## Data and brand attribution

Historical data is from Wyscout / Pappalardo and Massucco, distributed under CC BY 4.0; processing and independent research models are described in [SOURCES.md](SOURCES.md). Original Microsoft, Premier League and PUMA assets retain their respective rights; their presentation use is based on the project owner's stated authorization, described in [BRANDING.md](BRANDING.md). No official endorsement is claimed. No blanket open-source licence is granted over third-party marks, images or the AVATARZ code by the presence of this public repository.

## AVATARZ team

Simon Rames · Iulian Varzaru · Eliton Almeida · Mathues Souza

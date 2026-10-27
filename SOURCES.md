# MatchLens historical data and model attribution

Historical event data: Luca Pappalardo and Emanuele Massucco (2019), *Soccer match event dataset*, Figshare collection, https://doi.org/10.6084/m9.figshare.c.4415000 . Data provided by Wyscout. Events dataset: https://doi.org/10.6084/m9.figshare.7770599 .

License: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/ . Source license metadata was retrieved from https://api.figshare.com/v2/articles/7770599 and preserved in `data/source-license.json`.

Research paper: Pappalardo, L., Cintia, P., Rossi, A. et al., *A public data set of spatio-temporal match events in soccer competitions*, Scientific Data 6, 236 (2019), https://doi.org/10.1038/s41597-019-0247-7 .

Conversion to processed Wyscout format: Koen Vossen, https://github.com/koenvo/wyscout-soccer-match-event-dataset . Pinned source revision: `ebc4c54c10` (full revision and per-match raw-source hashes/URLs are in the dataset and model metadata).

MatchLens modifications: selected 131 historical Premier League 2017/18 and World Cup 2018 matches; reduced player metadata to names, team IDs and roles; normalized event fields and clocks; trained independent research xG and xPass logistic regressions with disjoint match-level splits and temperature calibration. MatchLens estimates are not Wyscout's proprietary xG, xPass, rankings or a commercial provider model.

Coordinates are actor-relative percentages: the acting team's own goal is x=0 and the attacked goal x=100. Distance and progression use an explicitly assumed 105×68 m pitch, not the physical dimensions of every historical stadium. Provider coordinate documentation: https://apidocs.wyscout.com/ and https://dataglossary.wyscout.com/pitch_coordinates/ .

The source records event positions, not continuous player or ball tracking. xPass uses origin and subtype only; outcome tags and the logged pass endpoint are excluded from prediction features. A missing intended receiver or absent opponent positions cannot support counterfactual pass analysis. The retained Replay Lab uses separate fictional scenes and a separate synthetic demonstration model.

The MatchLens question engine routes supported natural-language questions to calculations and retrieves source events. It is not a general-purpose generative language model. No paid model API, live service, Azure deployment or Foundry integration is active.

Original procedural stadium, sprites and interface: MatchLens / AVATARZ. The previous inline football illustration was replaced in V7 by the original PUMA product image credited below. Microsoft and Premier League marks identify the hackathon context under the project owner's previously confirmed local-demo authorization; see `BRANDING.md`. This does not extend those rights or imply endorsement by any provider.


## V7 presentation home — 27 October 2026

- Official ball: PUMA STELLAR Match Premier League Reactivity, style 085110_01. Source: https://uk.puma.com/uk/en/pd/stellar-match-premier-league-reactivity-ball-fifa-quality/085110
- Transparent PNG supplied by PUMA CDN: https://images.puma.com/image/upload/f_png,q_auto,w_1000,h_1000/global/085110/01/fnd/GBR/fmt/png/STELLAR-Match-Premier-League-Reactivity-Ball-%28FIFA%C2%AE-Quality%29
- Asset is the original product render with transparency; no generated recreation or logo alteration. SHA256: dd9f8bf84ee22d73713fe4a29e8e49e1d16dc08e864b0a298e1551f489d8718c
- Project owner Simon confirmed permission to use Premier League and Microsoft logos and the ball for this presentation on 27 October 2026. This records the stated presentation scope and does not establish any broader publication licence or endorsement.
- Existing logo files retained unchanged.
- Microsoft integration is proposed, not connected. Current statistical answers are local computations/retrieval. The Microsoft Foundry, Azure AI Search and Azure Storage section describes a future architecture.
- Official architecture reference, checked 27 October 2026: https://learn.microsoft.com/en-us/azure/foundry/concepts/architecture
- Search reference: https://learn.microsoft.com/azure/search/search-what-is-azure-search
- Credits as supplied: Simon Rames, Iulian Varzaru, Eliton Almeida, Mathues Souza.
- Trailer is a clearly labelled 16:9 placeholder; no video was supplied or fabricated. Replace the figure in view-home with a local video when available, preserving aspect ratio.

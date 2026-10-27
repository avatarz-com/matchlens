// Generated locally by scripts/train-demo-models.mjs; synthetic demo only.
export const DEMO_MODELS = {
  "version": "synthetic-demo-v1",
  "domain": "Fictional logistic data generator, not real football",
  "labels": "Bernoulli samples from explicitly human-chosen synthetic teacher coefficients",
  "teacherSpecification": {
    "xPass": {
      "names": [
        "intercept",
        "distanceM/40",
        "forwardProgressM/40",
        "corridorOpponents",
        "receiverClearanceM/15",
        "passerPressureCount/3"
      ],
      "teacher": [
        2.3,
        -1.2,
        -0.3,
        -1.8,
        0.65,
        -0.45
      ]
    },
    "xG": {
      "names": [
        "intercept",
        "shotDistanceM/25",
        "goalOpeningRadians/1.2",
        "shotCorridorOpponents",
        "receiverClearanceM/15"
      ],
      "teacher": [
        -0.7,
        -1.25,
        1.8,
        -0.5,
        0.35
      ]
    }
  },
  "limitations": [
    "Validated only on held-out samples from the same fictional generator.",
    "Not calibrated or validated on real football, Premier League or club data.",
    "No body-part, player-skill, goalkeeper-orientation or ball-flight model.",
    "Scenario branch outcomes are authored examples, never labels used to train or update these models."
  ],
  "models": {
    "xPass": {
      "id": "matchlens-synthetic-xPass-v1",
      "featureNames": [
        "intercept",
        "distanceM/40",
        "forwardProgressM/40",
        "corridorOpponents",
        "receiverClearanceM/15",
        "passerPressureCount/3"
      ],
      "weights": [
        1.652132469505682,
        -0.796482128555946,
        -0.4781995445394803,
        -1.7650131342313444,
        0.9842575917720632,
        -0.2630668686022509
      ],
      "temperature": 0.98,
      "training": {
        "n": 6000,
        "seed": 4101
      },
      "calibration": {
        "n": 1500,
        "seed": 4102,
        "method": "temperature chosen on calibration split only"
      },
      "validation": {
        "seed": 4103,
        "n": 2500,
        "brier": 0.12338178870760634,
        "logLoss": 0.38719023579666156,
        "baselineBrier": 0.22905145000000326,
        "expectedCalibrationError": 0.023801971224071343,
        "bins": [
          {
            "lower": 0,
            "upper": 0.1,
            "n": 878,
            "predicted": 0.03698674050947071,
            "observed": 0.03758542141230068
          },
          {
            "lower": 0.1,
            "upper": 0.2,
            "n": 328,
            "predicted": 0.1415596256650233,
            "observed": 0.16158536585365854
          },
          {
            "lower": 0.2,
            "upper": 0.3,
            "n": 157,
            "predicted": 0.24548015873758697,
            "observed": 0.17197452229299362
          },
          {
            "lower": 0.3,
            "upper": 0.4,
            "n": 160,
            "predicted": 0.3530846174934231,
            "observed": 0.46875
          },
          {
            "lower": 0.4,
            "upper": 0.5,
            "n": 176,
            "predicted": 0.44914586087705943,
            "observed": 0.4602272727272727
          },
          {
            "lower": 0.5,
            "upper": 0.6,
            "n": 123,
            "predicted": 0.5445660454307513,
            "observed": 0.5203252032520326
          },
          {
            "lower": 0.6,
            "upper": 0.7,
            "n": 134,
            "predicted": 0.6456611704436681,
            "observed": 0.6567164179104478
          },
          {
            "lower": 0.7,
            "upper": 0.8,
            "n": 167,
            "predicted": 0.753649298182429,
            "observed": 0.7784431137724551
          },
          {
            "lower": 0.8,
            "upper": 0.9,
            "n": 299,
            "predicted": 0.8481828215147149,
            "observed": 0.8695652173913043
          },
          {
            "lower": 0.9,
            "upper": 1,
            "n": 78,
            "predicted": 0.9177341215645535,
            "observed": 0.9871794871794872
          }
        ]
      }
    },
    "xG": {
      "id": "matchlens-synthetic-xG-v1",
      "featureNames": [
        "intercept",
        "shotDistanceM/25",
        "goalOpeningRadians/1.2",
        "shotCorridorOpponents",
        "receiverClearanceM/15"
      ],
      "weights": [
        -0.38009469984677147,
        -1.2891799179183803,
        1.6059441789978772,
        -0.5425343667543099,
        0.2619299690997637
      ],
      "temperature": 1.02,
      "training": {
        "n": 6000,
        "seed": 5201
      },
      "calibration": {
        "n": 1500,
        "seed": 5202,
        "method": "temperature chosen on calibration split only"
      },
      "validation": {
        "seed": 5203,
        "n": 2500,
        "brier": 0.16864783571836747,
        "logLoss": 0.50685005726422,
        "baselineBrier": 0.20213637777777213,
        "expectedCalibrationError": 0.01781211533087748,
        "bins": [
          {
            "lower": 0,
            "upper": 0.1,
            "n": 383,
            "predicted": 0.06681656288459371,
            "observed": 0.04699738903394256
          },
          {
            "lower": 0.1,
            "upper": 0.2,
            "n": 603,
            "predicted": 0.14831461272738536,
            "observed": 0.13764510779436154
          },
          {
            "lower": 0.2,
            "upper": 0.3,
            "n": 485,
            "predicted": 0.24906780397324466,
            "observed": 0.27422680412371137
          },
          {
            "lower": 0.3,
            "upper": 0.4,
            "n": 390,
            "predicted": 0.34820367901178634,
            "observed": 0.32564102564102565
          },
          {
            "lower": 0.4,
            "upper": 0.5,
            "n": 288,
            "predicted": 0.4468443633333853,
            "observed": 0.4513888888888889
          },
          {
            "lower": 0.5,
            "upper": 0.6,
            "n": 180,
            "predicted": 0.5467140935944321,
            "observed": 0.5388888888888889
          },
          {
            "lower": 0.6,
            "upper": 0.7,
            "n": 108,
            "predicted": 0.6430741256117323,
            "observed": 0.6018518518518519
          },
          {
            "lower": 0.7,
            "upper": 0.8,
            "n": 54,
            "predicted": 0.7450086645170323,
            "observed": 0.7777777777777778
          },
          {
            "lower": 0.8,
            "upper": 0.9,
            "n": 9,
            "predicted": 0.8260682787691387,
            "observed": 0.8888888888888888
          },
          {
            "lower": 0.9,
            "upper": 1,
            "n": 0,
            "predicted": null,
            "observed": null
          }
        ]
      }
    }
  }
};

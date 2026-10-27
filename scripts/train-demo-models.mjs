import { writeFile,mkdir } from 'node:fs/promises';
import {MODEL_SPEC,generateExamples,fitLogistic,calibrateTemperature,evaluateModel} from '../src/model-math.mjs';
const models={};
for(const kind of ['xPass','xG']){
  const seeds=kind==='xPass'?[4101,4102,4103]:[5201,5202,5203];
  const train=generateExamples(kind,6000,seeds[0]),calibration=generateExamples(kind,1500,seeds[1]),test=generateExamples(kind,2500,seeds[2]);
  const weights=fitLogistic(train),temperature=calibrateTemperature(weights,calibration),baseline=train.reduce((sum,r)=>sum+r.y,0)/train.length;
  const model={id:`matchlens-synthetic-${kind}-v1`,featureNames:MODEL_SPEC[kind].names,weights,temperature,training:{n:6000,seed:seeds[0]},calibration:{n:1500,seed:seeds[1],method:'temperature chosen on calibration split only'},validation:{seed:seeds[2],...evaluateModel({weights,temperature},test,baseline)}};
  if(model.validation.brier>=model.validation.baselineBrier)throw new Error(`${kind}: model fails synthetic constant-baseline gate`);
  models[kind]=model;
}
const pack={version:'synthetic-demo-v1',domain:'Fictional logistic data generator, not real football',labels:'Bernoulli samples from explicitly human-chosen synthetic teacher coefficients',teacherSpecification:MODEL_SPEC,limitations:['Validated only on held-out samples from the same fictional generator.','Not calibrated or validated on real football, Premier League or club data.','No body-part, player-skill, goalkeeper-orientation or ball-flight model.','Scenario branch outcomes are authored examples, never labels used to train or update these models.'],models};
await writeFile(new URL('../src/demo-model.mjs',import.meta.url),'// Generated locally by scripts/train-demo-models.mjs; synthetic demo only.\nexport const DEMO_MODELS = '+JSON.stringify(pack,null,2)+';\n');
await mkdir(new URL('../evidence/',import.meta.url),{recursive:true});
await writeFile(new URL('../evidence/v2-model-validation.json',import.meta.url),JSON.stringify(pack,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(models).map(([key,m])=>[key,{brier:m.validation.brier,constantBaseline:m.validation.baselineBrier,ece:m.validation.expectedCalibrationError,temperature:m.temperature}]))));

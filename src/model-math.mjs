export const MODEL_SPEC = Object.freeze({
  xPass:{names:['intercept','distanceM/40','forwardProgressM/40','corridorOpponents','receiverClearanceM/15','passerPressureCount/3'],teacher:[2.3,-1.2,-.3,-1.8,.65,-.45]},
  xG:{names:['intercept','shotDistanceM/25','goalOpeningRadians/1.2','shotCorridorOpponents','receiverClearanceM/15'],teacher:[-.7,-1.25,1.8,-.5,.35]}
});
export function seededRandom(seed){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
export const sigmoid=z=>1/(1+Math.exp(-Math.max(-35,Math.min(35,z))));
export const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
export function generateExamples(kind,count,seed){
  const rng=seededRandom(seed),spec=MODEL_SPEC[kind];if(!spec)throw new Error('Unknown model');
  return Array.from({length:count},()=>{
    let x;
    if(kind==='xPass'){
      const length=2+rng()*53,forward=Math.max(0,Math.cos(rng()*Math.PI)*length);
      x=[1,length/40,forward/40,Math.floor(rng()*4),(.5+rng()*19.5)/15,Math.floor(rng()*4)/3];
    }else x=[1,(3+rng()*42)/25,(.08+rng()*1.52)/1.2,Math.floor(rng()*4),(.5+rng()*19.5)/15];
    const p=sigmoid(dot(spec.teacher,x));return{x,y:Number(rng()<p)};
  });
}
export function fitLogistic(rows,epochs=550){
  const weights=Array(rows[0].x.length).fill(0),rate=.3,penalty=.0005;
  for(let epoch=0;epoch<epochs;epoch++){
    const gradient=Array(weights.length).fill(0);
    for(const {x,y} of rows){const error=sigmoid(dot(weights,x))-y;for(let j=0;j<weights.length;j++)gradient[j]+=error*x[j];}
    for(let j=0;j<weights.length;j++)weights[j]-=rate*(gradient[j]/rows.length+(j?penalty*weights[j]:0));
  }
  return weights;
}
export function predict(model,features){
  if(features.length!==model.weights.length||features.some(v=>!Number.isFinite(v)))throw new Error('Invalid model features');
  return sigmoid(dot(model.weights,features)/model.temperature);
}
export function evaluateModel(model,rows,baseline){
  let brier=0,logLoss=0,baselineBrier=0;
  const bins=Array.from({length:10},(_,i)=>({lower:i/10,upper:(i+1)/10,n:0,predicted:0,observed:0}));
  for(const {x,y} of rows){const p=predict(model,x);brier+=(p-y)**2;logLoss-=y*Math.log(p)+(1-y)*Math.log(1-p);baselineBrier+=(baseline-y)**2;const bin=bins[Math.min(9,Math.floor(p*10))];bin.n++;bin.predicted+=p;bin.observed+=y;}
  let ece=0;for(const bin of bins){if(bin.n){bin.predicted/=bin.n;bin.observed/=bin.n;ece+=bin.n/rows.length*Math.abs(bin.predicted-bin.observed);}else{bin.predicted=null;bin.observed=null;}}
  return{n:rows.length,brier:brier/rows.length,logLoss:logLoss/rows.length,baselineBrier:baselineBrier/rows.length,expectedCalibrationError:ece,bins};
}
export function calibrateTemperature(weights,rows){
  let best={temperature:1,loss:Infinity};
  for(let i=60;i<=160;i+=2){const temperature=i/100;let loss=0;for(const {x,y}of rows){const p=sigmoid(dot(weights,x)/temperature);loss-=y*Math.log(p)+(1-y)*Math.log(1-p);}if(loss<best.loss)best={temperature,loss};}
  return best.temperature;
}

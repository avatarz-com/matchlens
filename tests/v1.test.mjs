import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze,validateDataset } from '../src/engine.mjs';
import { createScene,visibleFrame,TIMING } from '../src/scene.mjs';
import { initialState,transition,comparison,describeChoice,cameraFor,project } from '../src/experience.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('V1 scenes validate, are reproducible and contain actual changing positions',()=>{
  for(const name of ['trap','switch','missing','delayed']){const scene=createScene(name);assert.equal(validateDataset(scene),true);assert.deepEqual(scene,createScene(name));assert.equal(scene.players.length,22);assert.ok(scene.frames.length>300);assert.notDeepEqual(visibleFrame(scene,0).positions.A2,visibleFrame(scene,6000).positions.A2);}
});
test('all choice branches are identical at the decision cutoff, including rendered frame',()=>{
  const scenes=['A2','A3','A4'].map(id=>createScene('trap',42,id));
  for(const t of [0,2400,5999,6000])for(const scene of scenes.slice(1)){assert.deepEqual(analyze(scene,t),analyze(scenes[0],t));assert.deepEqual(visibleFrame(scene,t),visibleFrame(scenes[0],t));}
});
test('choice branches produce scripted results only after resolution',()=>{
  for(const receiver of ['A2','A3','A4']){const scene=createScene('trap',42,receiver);assert.equal(analyze(scene,6000).passes.length,0);assert.equal(analyze(scene,8000).passes[0].outcome.value,null);assert.equal(analyze(scene,9000).passes[0].receiverId,receiver);assert.equal(analyze(scene,9000).passes[0].outcome.value,receiver==='A3'?'intercepted':'completed');}
});
test('moving ball and resolution endpoint agree at exact event times',()=>{
  for(const receiver of ['A2','A3','A4']){const scene=createScene('trap',42,receiver),start=scene.events.find(e=>e.type==='pass_start'),end=scene.events.find(e=>e.type==='pass_end');assert.deepEqual(visibleFrame(scene,TIMING.kickMs).ball,start.from);assert.deepEqual(visibleFrame(scene,TIMING.arrivalMs).ball,end.position);assert.equal(visibleFrame(scene,6000).ballHeightM,.18);}
});
test('comparison computes distance, progress, static corridor and receiving clearance',()=>{
  const rows=comparison(analyze(createScene(),6000)),a2=rows[0],a3=rows[1],a4=rows[2];
  close(a2.distance.value,Math.hypot(21,-16));assert.equal(a2.progression.value,21);assert.equal(a3.progression.value,27);assert.equal(a4.progression.value,-5);
  assert.equal(a2.lane.value,'clear-geometrically');assert.equal(a3.lane.value,'obstructed');close(a2.clearance.value,Math.hypot(6,-10));
  assert.equal(a2.clearance.kind,'deterministic');assert.equal(a2.clearance.asOfMs,6000);assert.ok(a2.clearance.sources.includes('scene-frame-6000'));
});
test('missing defender suppresses receiving-space and lane claims without inventing zeros',()=>{
  const rows=comparison(analyze(createScene('missing'),6000));for(const row of rows){assert.equal(row.clearance.value,null);assert.equal(row.lane.value,null);assert.ok(row.distance.value>0);assert.ok(row.clearance.missing.includes('position:B1'));}
  assert.ok(describeChoice(rows,'A2').text.includes('manque'));
});
test('late resolution remains hidden at its event timestamp',()=>{
  const scene=createScene('delayed');assert.equal(analyze(scene,9000).passes[0].outcome.value,null);assert.equal(analyze(scene,9000).passes[0].outcome.inputs.availableAtMs,null);assert.equal(analyze(scene,9900).passes[0].outcome.value,'intercepted');assert.equal(analyze(scene,9900).passes[0].outcome.inputs.availableAtMs,9900);assert.equal(analyze(scene,9901).holderId,'B1');
});
test('scene sampling never interpolates future frames and respects delayed availability',()=>{
  const scene=createScene();assert.equal(visibleFrame(scene,5999).tMs,5960);scene.frames.find(f=>f.tMs===6000).availableAtMs=9000;assert.equal(visibleFrame(scene,6000).tMs,5960);
  scene.frames=scene.frames.filter(f=>f.tMs<=4000||f.tMs>6000);assert.equal(visibleFrame(scene,6000),null);assert.throws(()=>visibleFrame(scene,-1));
});
test('play pauses exactly at decision even across a large wall-clock tick',()=>{
  let s=transition(initialState(),{type:'play'});for(let i=0;i<30;i++)s=transition(s,{type:'tick',deltaMs:250});assert.equal(s.timeMs,6000);assert.equal(s.phase,'decision');assert.equal(s.playing,false);
  assert.equal(transition(s,{type:'play'}).playing,false);s=transition(s,{type:'select',receiverId:'A2'});s=transition(s,{type:'play'});s=transition(s,{type:'tick',deltaMs:100});assert.equal(s.timeMs,6100);assert.equal(s.phase,'pass');
});
test('selection rejected outside decision and invalid receiver cannot enter state',()=>{
  assert.equal(transition(initialState(),{type:'select',receiverId:'A2'}).selected,null);const s=transition(initialState(),{type:'decision'});assert.equal(transition(s,{type:'select',receiverId:'B1'}).selected,null);
});
test('repeated choice changes remain local and reset clears selection and camera',()=>{
  let s=transition(initialState(),{type:'decision'});for(const id of ['A2','A3','A4','A2']){s=transition(s,{type:'select',receiverId:id});assert.equal(s.selected,id);}
  s=transition(s,{type:'camera',camera:'receiver'});assert.equal(s.camera,'receiver');s=transition(s,{type:'reset'});assert.deepEqual(s,initialState());
});
test('rewinding removes selection; forward seek pauses and never resumes accidentally',()=>{
  let s=transition(initialState(),{type:'decision'});s=transition(s,{type:'select',receiverId:'A4'});s=transition(s,{type:'camera',camera:'receiver'});s=transition(s,{type:'play'});s=transition(s,{type:'seek',timeMs:0});assert.equal(s.selected,null);assert.equal(s.playing,false);assert.equal(s.phase,'intro');assert.equal(s.camera,'broadcast');assert.equal(transition(s,{type:'seek',timeMs:13000}).timeMs,12500);
});
test('wall-clock discontinuity is bounded, negative or nonfinite deltas do not advance',()=>{
  let s=transition(initialState(),{type:'play'});s=transition(s,{type:'tick',deltaMs:100000});assert.equal(s.timeMs,250);for(const deltaMs of [-1,NaN,Infinity])assert.equal(transition(s,{type:'tick',deltaMs}).timeMs,250);
});
test('speed changes are bounded and end replay returns to a fresh start',()=>{
  let s=transition(initialState(),{type:'speed',speed:1.5});s=transition(s,{type:'play'});assert.equal(transition(s,{type:'tick',deltaMs:100}).timeMs,150);assert.equal(transition(s,{type:'speed',speed:900}).speed,1.5);
  s=transition(s,{type:'seek',timeMs:12500});assert.deepEqual(transition(s,{type:'play'}),{...initialState(),playing:true});
});
test('receiver camera requires a selection and anchors to a visible current position',()=>{
  assert.equal(transition(initialState(),{type:'camera',camera:'receiver'}).camera,'broadcast');const frame=visibleFrame(createScene(),6000),cam=cameraFor(frame,'receiver','A2');assert.equal(cam.receiverId,'A2');assert.equal(cam.position[2],1.65);assert.ok(Math.hypot(cam.position[0]-frame.positions.A2.x,cam.position[1]-frame.positions.A2.y)<.3);
});
test('camera projection maps target to centre and rejects points behind lens',()=>{
  const camera={position:[0,0,1],target:[0,10,1],fov:70};const p=project([0,10,1],camera,1000,600);close(p.x,500);close(p.y,300);assert.equal(project([0,-10,1],camera,1000,600),null);assert.ok(project([2,10,1],camera,1000,600).x>500);
});
test('POV fallback remains stable as ball reaches receiver',()=>{
  const scene=createScene('switch',42,'A2'),frame=visibleFrame(scene,9000),camera=cameraFor(frame,'receiver','A2');assert.ok(camera.target.every(Number.isFinite));assert.ok(project([43,34,1],camera,900,500));
});
test('narratives are fact-bound and analyst text declares its geometric limits',()=>{
  const rows=comparison(analyze(createScene(),6000));const a=describeChoice(rows,'A3','analyst');assert.ok(a.text.includes('aucune probabilité'));assert.ok(a.text.includes('+27,0'));assert.ok(a.sources.includes('scene-frame-6000'));assert.notEqual(a.text,describeChoice(rows,'A3','fan').text);
});
test('source cutoffs and time accounting hold through every scenario and branch',()=>{
  for(const scenario of ['trap','switch','missing','delayed'])for(const id of ['A2','A3','A4']){
    const scene=createScene(scenario,42,id),source=new Map([...scene.frames,...scene.events].map(r=>[r.id,r]));
    for(const t of [0,5999,6000,6500,8500,9000,9900,12500]){
      const s=analyze(scene,t),m=s.possession.A;close(Object.values(m.inputs.durationsMs).reduce((a,b)=>a+b,0)+m.inputs.neutralMs+m.inputs.unknownMs,t);
      const values=comparison(s).filter(v=>v.available);for(const o of values)for(const metric of [o.distance,o.progression,o.lane,o.clearance])for(const key of metric.sources){assert.ok(source.get(key).tMs<=t);assert.ok(source.get(key).availableAtMs<=t);}
    }
  }
});

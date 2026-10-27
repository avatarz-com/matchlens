import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, validateDataset, distance, segmentDistance, explain } from '../src/engine.mjs';
import { makeFixture } from '../src/fixtures.mjs';
const near = (a, b, tolerance=1e-9) => assert.ok(Math.abs(a-b) < tolerance, `${a} ≠ ${b}`);
const pass = s => s.passes.find(p=>p.id==='pass-1');

test('fixtures are deterministic, seeded and contain 22 fictional players', () => {
  assert.deepEqual(makeFixture('blocked',42),makeFixture('blocked',42));
  assert.notDeepEqual(makeFixture('blocked',42).frames,makeFixture('blocked',43).frames);
  for(const scenario of ['open','blocked','missing','delayed']) {const f=makeFixture(scenario);assert.equal(f.players.length,22);assert.equal(validateDataset(f),true);}
});
test('metric geometry uses metres; segment handles endpoints and zero-length', () => {
  assert.equal(distance({x:0,y:0},{x:3,y:4}),5);
  assert.deepEqual(segmentDistance({x:5,y:2},{x:0,y:0},{x:10,y:0}),{distanceM:2,fraction:.5});
  assert.deepEqual(segmentDistance({x:-2,y:0},{x:0,y:0},{x:10,y:0}),{distanceM:2,fraction:0});
  assert.deepEqual(segmentDistance({x:3,y:4},{x:0,y:0},{x:0,y:0}),{distanceM:5,fraction:0});
});
test('intended pass geometry and observed endpoint differ for an interception', () => {
  const s=analyze(makeFixture('blocked'),7500), p=pass(s);
  near(p.length.value,Math.hypot(26,10)); assert.equal(p.progression.value,26);
  near(p.angle.value,Math.atan2(10,26)*180/Math.PI);
  near(p.observedDisplacement.value,Math.hypot(13,5));
  assert.equal(p.outcome.value,'intercepted');assert.equal(s.completion.A.value,0);
});
test('attacking direction is team-relative, negative progress stays negative', () => {
  const f=makeFixture('open');f.teams[0].attackDirection=-1;
  const p=pass(analyze(f,6500));assert.equal(p.progression.value,-20);
  const normal=analyze(makeFixture(),6000).options.find(o=>o.receiverId==='A4');assert.equal(normal.progression.value,-8);
});
test('zero-length pass has zero distance and undefined direction with reason', () => {
  const f=makeFixture();const e=f.events.find(e=>e.type==='pass_start');e.target=structuredClone(e.from);
  const p=pass(analyze(f,6500));assert.equal(p.length.value,0);assert.equal(p.angle.value,null);assert.ok(p.angle.missing.includes('nonzero pass vector'));
});
test('observed completion excludes pending, not zero percent before evidence', () => {
  const f=makeFixture('open');assert.equal(analyze(f,6000).completion.A.value,null);
  const pending=analyze(f,6500);assert.equal(pending.completion.A.value,null);assert.equal(pending.completion.A.inputs.pending,1);assert.equal(pass(pending).outcome.value,null);
  assert.equal(analyze(f,7000).completion.A.value,100);
});
test('possession integrates time, excludes neutral and retains pass-flight team', () => {
  const f=makeFixture(), s=analyze(f,9000), m=s.possession.A;
  assert.equal(m.inputs.neutralMs,1000);assert.equal(m.inputs.unknownMs,0);
  assert.equal(m.inputs.durationsMs.A,6001);assert.equal(m.inputs.durationsMs.B,1999);assert.equal(m.inputs.denominatorMs,8000);near(m.value,6001/8000*100);
  assert.equal(analyze(f,6500).possession.A.value,100);assert.equal(analyze(f,0).possession.A.value,null);
});
test('unknown opening time is excluded and disclosed', () => {
  const f=makeFixture();f.events=f.events.filter(e=>e.id!=='control-start');
  const m=analyze(f,5000).possession.A;assert.equal(m.inputs.unknownMs,3000);assert.equal(m.inputs.neutralMs,1000);assert.equal(m.inputs.denominatorMs,1000);
});
test('pressure and pass options use explicit geometric heuristics', () => {
  const s=analyze(makeFixture('blocked'),6000);
  assert.equal(s.pressure.kind,'heuristic');assert.equal(s.pressure.value,1);near(s.pressure.inputs.nearestOpponentM,Math.sqrt(17));
  const obstructed=s.options.find(o=>o.receiverId==='A3');assert.equal(obstructed.lane.value,'obstructed');assert.ok(obstructed.lane.inputs.blockers.some(p=>p.playerId==='B1'));
  assert.equal(s.options.find(o=>o.receiverId==='A2').lane.value,'clear-geometrically');
  assert.equal(analyze(makeFixture('open'),6000).options.find(o=>o.receiverId==='A3').lane.value,'clear-geometrically');
});
test('pressure radius includes exact 5 m boundary', () => {
  const f=makeFixture();f.frames.find(r=>r.tMs===6000).positions.B2={x:40,y:39};assert.equal(analyze(f,6000).pressure.value,1);
});
test('corridor threshold includes 2 m and excludes projections outside the open segment',()=>{
  const f=makeFixture();const frame=f.frames.find(r=>r.tMs===6000);frame.positions.A2={x:60,y:34};frame.positions.B2={x:39,y:38};
  frame.positions.B1={x:50,y:36};assert.equal(analyze(f,6000).options.find(o=>o.receiverId==='A2').lane.value,'obstructed');
  frame.positions.B1={x:50,y:36.001};assert.equal(analyze(f,6000).options.find(o=>o.receiverId==='A2').lane.value,'clear-geometrically');
  frame.positions.B1={x:60,y:34};assert.equal(analyze(f,6000).options.find(o=>o.receiverId==='A2').lane.value,'clear-geometrically');
});
test('missing opponent disables full pressure and corridor claims, distances survive', () => {
  const s=analyze(makeFixture('missing'),6000), o=s.options.find(o=>o.receiverId==='A2');
  assert.equal(s.pressure.value,null);assert.ok(s.pressure.missing.includes('position:B1'));assert.equal(o.lane.value,null);assert.ok(o.distance.value>0);
});
test('missing receiver and pass coordinates propagate unavailability', () => {
  const f=makeFixture();delete f.frames.find(r=>r.tMs===6000).positions.A2;
  assert.equal(analyze(f,6000).options.find(o=>o.receiverId==='A2').distance.value,null);
  delete f.events.find(e=>e.type==='pass_start').from;
  const p=pass(analyze(f,6500));assert.equal(p.length.value,null);assert.ok(p.length.missing.includes('observed pass origin'));
});
test('stale frame is not silently interpolated from future or retained forever', () => {
  const f=makeFixture();f.frames=f.frames.filter(r=>r.tMs<=4000 || r.tMs>6000);
  const s=analyze(f,6000);assert.equal(s.frame,null);assert.equal(s.pressure.value,null);assert.equal(s.options[0].distance.value,null);
});
test('no future event, future frame or eventual result leaks into decision', () => {
  const a=makeFixture(), b=structuredClone(a);
  for(const f of b.frames) if(f.tMs>6000) for(const p of Object.values(f.positions)){p.x=0;p.y=0;}
  b.events.find(e=>e.id==='pass-1').target={x:100,y:1};b.events.find(e=>e.id==='resolution-1').outcome='completed';
  assert.deepEqual(analyze(a,6000),analyze(b,6000));assert.deepEqual(analyze(a,6000).passes,[]);
  assert.ok(!JSON.stringify(analyze(a,6000)).includes('resolution-1'));
});
test('event timestamp is insufficient: availability cutoff governs delayed observations', () => {
  const f=makeFixture('delayed');const s=analyze(f,7500);assert.equal(pass(s).outcome.value,null);assert.equal(s.completion.A.value,null);assert.equal(s.holderId,null);
  assert.equal(pass(analyze(f,8000)).outcome.value,'intercepted');assert.equal(analyze(f,8001).holderId,'B1');
});
test('future-available position frame cannot leak despite old sample timestamp', () => {
  const f=makeFixture();f.frames.find(r=>r.tMs===6000).availableAtMs=8000;
  assert.equal(analyze(f,6000).frame.tMs,5500);
});
test('all returned metrics have units, provenance, formula, inputs, missing and cutoff', () => {
  const s=analyze(makeFixture(),7500), all=[];
  function walk(obj){if(!obj||typeof obj!=='object')return;if('formula'in obj)all.push(obj);for(const value of Object.values(obj))walk(value);}walk(s);
  assert.ok(all.length>10);
  const sourceMap=new Map([...makeFixture().frames,...makeFixture().events].map(r=>[r.id,r]));
  for(const m of all){assert.ok(['observation','deterministic','heuristic'].includes(m.kind));assert.ok(m.unit);assert.ok(m.formula);assert.equal(m.asOfMs,7500);assert.ok(Array.isArray(m.missing));assert.ok(m.inputs);for(const id of m.sources){assert.ok(sourceMap.has(id));assert.ok(sourceMap.get(id).tMs<=7500);assert.ok(sourceMap.get(id).availableAtMs<=7500);}}
});
test('unsorted input rows yield deterministic chronology', () => {
  const a=makeFixture(),b=structuredClone(a);b.events.reverse();b.frames.reverse();assert.deepEqual(analyze(a,7500),analyze(b,7500));
});
test('validation rejects impossible units/positions, chronology, duplicate and ambiguous data', () => {
  const mutations=[f=>f.frames[0].positions.A1.x=106,f=>f.frames[0].positions.A1.y=NaN,f=>f.events[0].availableAtMs=-1,f=>f.events.push(structuredClone(f.events[0])),f=>f.events.find(e=>e.type==='pass_end').tMs=5000,f=>f.events.push({id:'conflict',type:'neutral',tMs:0,availableAtMs:0}),f=>f.teams[0].attackDirection=0,f=>f.players[0].teamId='unknown',f=>f.events.find(e=>e.type==='pass_start').receiverId='B1'];
  for(const mutate of mutations){const f=makeFixture();mutate(f);assert.throws(()=>analyze(f,6000));}
  for(const t of [-1,12001,NaN,Infinity])assert.throws(()=>analyze(makeFixture(),t));
});
test('reset/replay analysis is stateless; returned frames and metric inputs cannot alter source data', () => {
  const f=makeFixture(), expected=analyze(f,6000);analyze(f,12000);assert.deepEqual(analyze(f,6000),expected);
  const result=analyze(f,6000);result.frame.positions.A1.x=0;assert.deepEqual(analyze(f,6000),expected);
  const atPass=analyze(f,7500);atPass.passes[0].length.inputs.from.x=0;assert.equal(f.events.find(e=>e.id==='pass-1').from.x,40);
});
test('non-metric coordinate units and infinite pitch dimensions are rejected',()=>{
  for(const mutate of [f=>f.pitch.unit='feet',f=>f.pitch.lengthM=Infinity]){const f=makeFixture();mutate(f);assert.throws(()=>validateDataset(f));}
});
test('two narrative modes cite only facts and do not call models', () => {
  const s=analyze(makeFixture(),6000), n=explain(s), a=explain(s,'analyst');assert.notEqual(n.text,a.text);assert.equal(n.kind,'deterministic-template');assert.ok(n.sources.includes('f-6000'));assert.ok(a.text.includes('aucune probabilité'));
  assert.ok(explain(analyze(makeFixture('missing'),6000)).text.includes('insuffisantes'));
});
test('time accounting and source cutoffs hold throughout all four replays',()=>{
  for(const name of ['open','blocked','missing','delayed']){
    const f=makeFixture(name), lookup=new Map([...f.frames,...f.events].map(r=>[r.id,r]));
    for(let t=0;t<=12000;t+=250){
      const s=analyze(f,t), {durationsMs,neutralMs,unknownMs}=s.possession.A.inputs;
      near(Object.values(durationsMs).reduce((a,b)=>a+b,0)+neutralMs+unknownMs,t);
      if(s.possession.A.value!==null)near(s.possession.A.value+s.possession.B.value,100);
      function visit(obj){if(!obj||typeof obj!=='object')return;if('formula'in obj)for(const id of obj.sources){assert.ok(lookup.get(id).tMs<=t);assert.ok(lookup.get(id).availableAtMs<=t);}for(const v of Object.values(obj))visit(v);}visit(s);
    }
  }
});

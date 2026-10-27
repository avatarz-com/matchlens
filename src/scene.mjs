import { makeFixture } from './fixtures.mjs';

export const TIMING = Object.freeze({ decisionMs: 6000, kickMs: 6500, arrivalMs: 8500, durationMs: 12500, frameStepMs: 40 });
export const SCENARIOS = Object.freeze({ switch: 'La fenêtre sur l’aile', trap: 'Le piège dans l’axe', missing: 'Lecture incomplète', delayed: 'Observation retardée' });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mix = (a, b, t) => a + (b - a) * t;

// One deterministic scene generates BOTH the renderer's samples and the engine's events.
// Scene generation is offline fiction; downstream observations still obey their cutoff.
export function createScene(scenario = 'trap', seed = 42, branchReceiver = null) {
  if (!Object.hasOwn(SCENARIOS, scenario)) throw new Error('Unknown scene');
  if(branchReceiver!==null&&!['A2','A3','A4'].includes(branchReceiver))throw new Error('Invalid synthetic branch');
  const base = makeFixture('open', seed);
  const anchors = {
    A1: [43,34], A2: [64,18], A3: [70,40], A4: [38,51], A5:[28,19], A6:[29,37], A7:[21,55], A8:[17,28], A9:[24,45], A10:[9,34], A11:[35,9],
    B1: scenario === 'switch' ? [79,39] : [56.5,37], B2:[41,48], B3:[43,38], B4:[78,14], B5:[78,47], B6:[86,30], B7:[91,53], B8:[83,59], B9:[96,22], B10:[101,34], B11:[58,8]
  };
  function positionsAt(t) {
    const seconds = t / 1000, lead = Math.min(1, seconds / 6);
    return Object.fromEntries(base.players.map((player, i) => {
      const [x,y] = anchors[player.id];
      // At the decision every player reaches the named anchor exactly.
      const dx = t <= 6000 ? (1-lead) * (player.teamId==='A' ? -5 : 2.4) : Math.min(3, (seconds-6)*.55) * (player.teamId==='A'?1:-.45);
      const dy = Math.sin((seconds-6)*.7 + i*.8) * Math.min(1, Math.abs(seconds-6)*.3);
      return [player.id, {x:clamp(x+dx,1,104),y:clamp(y+dy,1,67)}];
    }));
  }
  const receiverId = branchReceiver ?? (scenario === 'switch' ? 'A2' : 'A3');
  const winnerId = scenario === 'switch' || receiverId!=='A3' ? receiverId : 'B1';
  const start = positionsAt(TIMING.kickMs).A1;
  const endpoint = positionsAt(TIMING.arrivalMs)[winnerId];
  const intended = positionsAt(TIMING.arrivalMs)[receiverId];
  const frames = [];
  for (let t=0;t<=TIMING.durationMs;t+=TIMING.frameStepMs) {
    const positions=positionsAt(t);
    let ball, ballHeightM=0.18;
    if(t<TIMING.kickMs) ball={...positions.A1};
    else if(t<TIMING.arrivalMs) {
      const k=(t-TIMING.kickMs)/(TIMING.arrivalMs-TIMING.kickMs);
      ball={x:mix(start.x,endpoint.x,k),y:mix(start.y,endpoint.y,k)};
      ballHeightM=.18+Math.sin(k*Math.PI)*.7;
    } else ball={...positions[winnerId]};
    if(scenario==='missing'&&t>=5600&&t<=6600) delete positions.B1;
    frames.push({id:`scene-frame-${t}`,tMs:t,availableAtMs:t,positions,ball,ballHeightM});
  }
  // Include exact event endpoints even when not on the regular frame grid.
  for(const t of [TIMING.kickMs,TIMING.arrivalMs,TIMING.durationMs]) {
    if(frames.some(f=>f.tMs===t)) continue;
    const positions=positionsAt(t);
    frames.push({id:`scene-frame-${t}`,tMs:t,availableAtMs:t,positions,ball:{...(t===TIMING.kickMs?start:positions[winnerId])},ballHeightM:.18});
  }
  frames.sort((a,b)=>a.tMs-b.tMs);
  const delay=scenario==='delayed'?1400:0;
  return {...base,id:`matchlens-v1-${scenario}-${seed}`,title:SCENARIOS[scenario],seed,durationMs:TIMING.durationMs,frames,
    events:[
      {id:'scene-control',type:'control',tMs:0,availableAtMs:0,teamId:'A',playerId:'A1'},
      {id:'scene-pass',type:'pass_start',tMs:TIMING.kickMs,availableAtMs:TIMING.kickMs,teamId:'A',playerId:'A1',receiverId,from:{...start},target:{...intended}},
      {id:'scene-resolution',type:'pass_end',tMs:TIMING.arrivalMs,availableAtMs:TIMING.arrivalMs+delay,passId:'scene-pass',outcome:winnerId.startsWith('A')?'completed':'intercepted',position:{...endpoint}},
      {id:'scene-reception',type:'control',tMs:TIMING.arrivalMs+1,availableAtMs:TIMING.arrivalMs+delay+1,teamId:winnerId.startsWith('A')?'A':'B',playerId:winnerId}
    ],
    decisions:[{id:'scene-decision',tMs:TIMING.decisionMs,actorId:'A1',label:'Trois options. Quelle lecture ?',video:{assetId:null,mediaTimeMs:TIMING.decisionMs,originalOnly:true}}],
    sync:{clock:'scene-relative-ms',videoOffsetMs:0,playbackRate:1,layers:['options','pressure','trajectories','labels'],pov:{status:'synthetic-render',target:'selected-receiver',authenticCamera:false}},
    limitations:['Original procedural simulation, not footage or optical tracking.','Scripted motion and outcome; not a calibrated professional-match distribution.','Choice selects a scripted synthetic branch after the decision; it is not a forecast.']};
}

export function visibleFrame(scene, tMs) {
  if(!Number.isFinite(tMs)||tMs<0||tMs>scene.durationMs) throw new Error('Invalid scene time');
  // Binary search of chronological samples; never interpolate through a future frame.
  let lo=0,hi=scene.frames.length-1;
  while(lo<=hi){const mid=(lo+hi)>>1;if(scene.frames[mid].tMs<=tMs)lo=mid+1;else hi=mid-1;}
  for(let i=hi;i>=0;i--){const frame=scene.frames[i];if(tMs-frame.tMs>1500)return null;if(frame.availableAtMs<=tMs)return frame;}
  return null;
}

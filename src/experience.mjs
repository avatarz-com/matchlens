import { distance } from './engine.mjs';
import { TIMING } from './scene.mjs';
export const RECEIVERS = Object.freeze(['A2','A3','A4']);

export function initialState() {
  return {timeMs:0,playing:false,phase:'intro',selected:null,camera:'broadcast',speed:1};
}
export function transition(state, action, durationMs=TIMING.durationMs) {
  const s={...state};
  switch(action.type){
    case 'play':
      if(s.timeMs>=durationMs)return {...initialState(),playing:true};
      if(s.timeMs===TIMING.decisionMs&&!s.selected)return s;
      s.playing=!s.playing;break;
    case 'tick': {
      if(!s.playing)return s;
      const dt=Number.isFinite(action.deltaMs)?Math.max(0,Math.min(250,action.deltaMs)):0;
      const next=Math.min(durationMs,s.timeMs+dt*s.speed);
      if(s.timeMs<TIMING.decisionMs&&next>=TIMING.decisionMs){s.timeMs=TIMING.decisionMs;s.playing=false;s.phase='decision';return s;}
      s.timeMs=next;if(next>=durationMs)s.playing=false;break;
    }
    case 'select':
      if(s.timeMs===TIMING.decisionMs&&RECEIVERS.includes(action.receiverId))s.selected=action.receiverId;
      return s;
    case 'decision': return {...initialState(),timeMs:TIMING.decisionMs,phase:'decision'};
    case 'reset': return initialState();
    case 'seek':
      if(!Number.isFinite(action.timeMs))return s;
      s.timeMs=Math.max(0,Math.min(durationMs,action.timeMs));s.playing=false;
      if(s.timeMs<=TIMING.decisionMs){s.selected=null;s.camera='broadcast';}
      break;
    case 'camera': if(action.camera==='broadcast'||(action.camera==='receiver'&&s.selected))s.camera=action.camera;return s;
    case 'speed': if([.5,1,1.5].includes(action.speed))s.speed=action.speed;return s;
    default:return s;
  }
  s.phase=s.timeMs<TIMING.decisionMs?'intro':s.timeMs===TIMING.decisionMs?'decision':s.timeMs<TIMING.arrivalMs?'pass':s.timeMs>=durationMs?'end':'aftermath';
  return s;
}

export function comparison(snapshot) {
  return RECEIVERS.map(receiverId=>{
    const option=snapshot.options.find(o=>o.receiverId===receiverId);
    if(!option)return {receiverId,available:false};
    const opponents=option.lane.inputs.opponentPositions;
    const target=option.distance.inputs.target;
    const missing=[...new Set(option.lane.missing)];
    const values=target&&opponents?Object.values(opponents).map(p=>distance(target,p)):[];
    const clearance={value:missing.length||!values.length?null:Math.min(...values),unit:'m',kind:'deterministic',formula:'min Euclidean distance(receiver, every observed opponent)',asOfMs:snapshot.asOfMs,sources:[...option.lane.sources],inputs:{target,opponentPositions:opponents},missing,status:missing.length||!values.length?'unavailable':'available',note:'Static receiving space, not time to pressure or pass success probability.'};
    return {...option,available:true,clearance};
  });
}

export function describeChoice(rows, selected, audience='fan') {
  const row=rows.find(o=>o.receiverId===selected&&o.available);
  if(!row)return {title:'Le jeu se lit avant la passe.',text:'Regardez le déplacement des joueurs, puis comparez trois solutions au même instant.',sources:[]};
  const sources=[...new Set([...row.distance.sources,...row.progression.sources,...row.lane.sources])];
  if(row.lane.value===null)return {title:'Une lecture à suspendre.',text:`La position d’un adversaire manque. La distance reste calculable, mais le corridor et l’espace à réception ne peuvent pas être établis.`,sources};
  const m=n=>n.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});
  const prog=row.progression.value;
  return {title:row.lane.value==='obstructed'?'Gagner du terrain a un prix.':prog<0?'Reculer peut ouvrir une autre lecture.':'Une fenêtre à explorer.',
    text:audience==='analyst'?`${row.receiverId} : ${m(row.distance.value)} m, progression ${prog>=0?'+':''}${m(prog)} m, espace à réception ${m(row.clearance.value)} m. ${row.lane.value==='obstructed'?'Adversaire dans le corridor de 2 m.':'Aucun adversaire dans le corridor de 2 m.'} Géométrie statique ; aucune probabilité calculée.`:`${row.receiverId} ${prog>=0?`gagne ${m(prog)} mètres vers le but`:`recule de ${m(Math.abs(prog))} mètres`}. ${row.lane.value==='obstructed'?'Un adversaire occupe le trajet : il faudra tenir compte de son mouvement.':'Le trajet est dégagé sur cet instant, mais les joueurs peuvent encore bouger.'}`,sources};
}

// Small projection math shared by the synthetic broadcast and receiver camera.
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>{const n=Math.hypot(...v);return n?v.map(x=>x/n):[0,1,0];};
export function cameraFor(frame, mode, receiverId='A2') {
  if(mode==='receiver'&&frame?.positions[receiverId]){
    const p=frame.positions[receiverId];
    const observed=frame.ball??{x:43,y:34};
    const ball=distance(p,observed)<3?(frame.positions.A1??{x:43,y:34}):observed;
    const direction=norm([ball.x-p.x,ball.y-p.y,0]);
    return {position:[p.x-direction[0]*.25,p.y-direction[1]*.25,1.65],target:[p.x+direction[0]*22,p.y+direction[1]*22,1],fov:78,receiverId};
  }
  return {position:[53,-35,55],target:[53,32,0],fov:48,receiverId:null};
}
export function project(point,camera,width,height) {
  const forward=norm(sub(camera.target,camera.position)),right=norm(cross(forward,[0,0,1])),up=cross(right,forward);
  const relative=sub(point,camera.position),depth=dot(relative,forward);
  if(depth<=.12)return null;
  const focal=height/(2*Math.tan(camera.fov*Math.PI/360));
  return {x:width/2+dot(relative,right)/depth*focal,y:height/2-dot(relative,up)/depth*focal,depth,scale:focal/depth};
}

// Clip world polygons to the camera near plane before perspective projection.
// This keeps pitch stripes and stadium stands grounded when a corner is behind the lens.
export function projectPolygon(vertices,camera,width,height,near=.15){
  const forward=norm(sub(camera.target,camera.position));
  const depth=v=>dot(sub(v,camera.position),forward);
  let clipped=[];
  for(let i=0;i<vertices.length;i++){
    const a=vertices[i],b=vertices[(i+1)%vertices.length],da=depth(a),db=depth(b),insideA=da>=near,insideB=db>=near;
    if(insideA)clipped.push(a);
    if(insideA!==insideB){const t=(near-da)/(db-da);clipped.push(a.map((n,j)=>n+(b[j]-n)*t));}
  }
  return clipped.map(v=>project(v,camera,width,height)).filter(Boolean);
}

import { TIMING } from './scene.mjs';
export function initialReview(moment){return{timeMs:TIMING.decisionMs,playing:false,selected:moment.receiver,kind:'recorded',camera:'broadcast',speed:1};}
export function reviewTransition(state,action,moment,durationMs=TIMING.durationMs){
  let s={...state};
  switch(action.type){
    case 'select':if(!['A2','A3','A4'].includes(action.id))return s;return{...s,timeMs:6000,playing:false,selected:action.id,kind:action.id===moment.receiver?'recorded':'hypothetical',camera:'broadcast'};
    case 'recorded':return{...initialReview(moment),timeMs:0,playing:true,speed:s.speed};
    case 'play':if(s.timeMs>=durationMs)s.timeMs=s.kind==='recorded'?0:6000;s.playing=!s.playing;break;
    case 'tick':if(s.playing){const dt=Number.isFinite(action.deltaMs)?Math.max(0,Math.min(250,action.deltaMs)):0;s.timeMs=Math.min(durationMs,s.timeMs+dt*s.speed);if(s.timeMs===durationMs)s.playing=false;}break;
    case 'decision':s.timeMs=6000;s.playing=false;s.camera='broadcast';break;
    case 'seek':if(Number.isFinite(action.timeMs)){s.timeMs=Math.max(0,Math.min(durationMs,action.timeMs));s.playing=false;}break;
    case 'reset':return initialReview(moment);
    case 'camera':if(['broadcast','close','receiver'].includes(action.mode))s.camera=action.mode;break;
    case 'speed':if([.5,1,1.5].includes(action.value))s.speed=action.value;break;
  }
  return s;
}

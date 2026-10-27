// Nickname-inspired colour themes only. No club badge, official kit or affiliation.
export const KIT_PRESETS=Object.freeze({
 spurs:{label:'Spurs',primary:'#f7f8fc',secondary:'#172747',shorts:'#172747',socks:'#f7f8fc'},
 gunners:{label:'Gunners',primary:'#dd3349',secondary:'#fff7ef',shorts:'#fff7ef',socks:'#dd3349'},
 devils:{label:'Devils',primary:'#d73137',secondary:'#151b2a',shorts:'#faf8f1',socks:'#151b2a'},
 citizens:{label:'Citizens',primary:'#82c7eb',secondary:'#ffffff',shorts:'#f8faff',socks:'#82c7eb'},
 hammers:{label:'Hammers',primary:'#7f2845',secondary:'#85c9ec',shorts:'#faf8f1',socks:'#7f2845'},
 electric:{label:'Electric',primary:'#7860eb',secondary:'#c5ff72',shorts:'#302662',socks:'#7860eb'},
 sunset:{label:'Sunset',primary:'#ff835b',secondary:'#ffebaf',shorts:'#342c5a',socks:'#ff835b'},
 ocean:{label:'Ocean',primary:'#2ab8c3',secondary:'#edffff',shorts:'#123d61',socks:'#2ab8c3'}
});
export function makeKit(preset='spurs',overrides={}){
 const base=KIT_PRESETS[preset]??KIT_PRESETS.spurs;
 const kit={...base};for(const key of ['primary','secondary','shorts','socks'])if(/^#[0-9a-f]{6}$/i.test(overrides[key]??''))kit[key]=overrides[key];
 const name=String(overrides.label??base.label).trim().replace(/[<>]/g,'').slice(0,16);kit.label=name||base.label;return kit;
}
export function kitContrast(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.4?'#1d2843':'#ffffff';}

export const NICKNAME_TEAMS=Object.freeze(['spurs','gunners','devils','citizens','hammers']);
export function matchupPairs(){return NICKNAME_TEAMS.flatMap(a=>NICKNAME_TEAMS.filter(b=>b!==a).map(b=>[a,b]));}

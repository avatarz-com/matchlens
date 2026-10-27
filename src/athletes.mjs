// Original procedural athlete rig. Visual reconstruction only, not body tracking.
// Reads one admissible frame: no next frame, future event or model output.
export function athletePose(frame,id,timeMs,{animate=false,kicking=false}={}){
 const origin=frame?.positions[id];if(!origin)return null;
 const n=Number(id.slice(1)),isA=id.startsWith('A'),ball=frame.ball;
 let dx=ball?ball.x-origin.x:0,dy=ball?ball.y-origin.y:0;
 if(Math.hypot(dx,dy)<1){dx=isA?1:-1;dy=.12;}
 const length=Math.hypot(dx,dy)||1,forward=[dx/length,dy/length],side=[-forward[1],forward[0]];
 const phase=timeMs*.009+n*1.9,stride=animate?Math.sin(phase):0,lift=animate?Math.max(0,Math.cos(phase))*.10:0;
 const kick=kicking?Math.sin(Math.min(1,Math.max(0,(timeMs%1000-500)/320))*Math.PI):0;
 const heightScale=.98+(n%4)*.018,bob=animate?Math.cos(phase*2)*.012:0;
 const at=(l,f,z)=>[origin.x+side[0]*l+forward[0]*f,origin.y+side[1]*l+forward[1]*f,z*heightScale+bob];
 const joints={
  hipL:at(-.12,0,.91),hipR:at(.12,0,.91),waist:at(0,.015,.99),neck:at(0,.045,1.52),head:at(0,.045,1.72),
  shoulderL:at(-.225,.03,1.43),shoulderR:at(.225,.03,1.43),
  elbowL:at(-.31,-stride*.16,1.19),elbowR:at(.31,stride*.16,1.19),
  wristL:at(-.29,-stride*.30,1.03+Math.abs(stride)*.08),wristR:at(.29,stride*.30,1.03+Math.abs(stride)*.08),
  kneeL:at(-.13,stride*.16,.49+lift),kneeR:at(.13,-stride*.16+kick*.20,.49),
  ankleL:at(-.14,stride*.30,.08+lift),ankleR:at(.14,-stride*.30+kick*.55,.08+kick*.24)
 };
 const skin=['#e3ac83','#b97b55','#8d553c','#f1c4a0','#69422f'][(n+(isA?0:2))%5];
 return{joints,forward,side,skin,isA,number:({A1:8,A2:11,A3:9,A4:6})[id]??n,shirt:isA?'#5545cc':'#ec664a',shirtDark:isA?'#33258a':'#a93627',shorts:isA?'#f3f0ff':'#24334b',socks:isA?'#eeecff':'#ed7055',boots:n%3===0?'#f3e568':n%3===1?'#152137':'#dfeafa',hair:['#211d23','#3a261d','#a17d45','#161b22'][n%4],heightScale};
}

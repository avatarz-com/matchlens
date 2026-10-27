import { cameraFor, project, projectPolygon } from './experience.mjs';
import { athletePose } from './athletes.mjs';
import { SpriteAtlas,animationFrame,spriteHeight } from './sprites.mjs';
import { makeKit } from './kits.mjs';

const blend=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t);
export class SceneRenderer {
  constructor(canvas){this.atlas=new SpriteAtlas();this.canvas=canvas;this.ctx=canvas.getContext('2d');this.camera=null;this.width=0;this.height=0;}
  resize(){
    const box=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    if(this.width===box.width&&this.height===box.height)return;
    this.width=box.width;this.height=box.height;this.canvas.width=Math.round(box.width*dpr);this.canvas.height=Math.round(box.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  draw(frame,{mode='broadcast',receiverId=null,layers,options=[],pressureAvailable=false,trajectoryOrigin=null,timeMs=0,reduced=false,playing=false,focus=null,visualStyle='sprites',kits={A:makeKit('spurs'),B:makeKit('gunners')}}={}){
    this.resize();const c=this.ctx,w=this.width,h=this.height;if(!w||!h)return false;
    const target=cameraFor(frame,mode,receiverId);
    if(mode==='close'&&frame){const a=frame.positions.A1??{x:75,y:34},b=frame.positions[receiverId]??a;const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};target.position=[center.x-9,center.y-19,9];target.target=[center.x+1,center.y+3,.7];target.fov=2*Math.atan(Math.tan(50*Math.PI/360)*Math.max(1,1.25/(w/h)))*180/Math.PI;}
    if(mode==='broadcast'){
      if(focus){target.position=[focus.x,-5,31];target.target=[focus.x,34,0];}
      const baseFov=focus?49:48;target.fov=2*Math.atan(Math.tan(baseFov*Math.PI/360)*Math.max(1,1.8/(w/h)))*180/Math.PI;
    }
    if(!this.camera||reduced)this.camera=target;
    else this.camera={position:blend(this.camera.position,target.position,.11),target:blend(this.camera.target,target.target,.11),fov:this.camera.fov+(target.fov-this.camera.fov)*.11,receiverId:target.receiverId};
    const moving=this.camera.position.some((v,i)=>Math.abs(v-target.position[i])>.025)||Math.abs(this.camera.fov-target.fov)>.04;
    const cam=this.camera;
    const p=(x,y,z=0)=>project([x,y,z],cam,w,h);
    c.clearRect(0,0,w,h);
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#89b9d6');sky.addColorStop(.53,'#d2e7ed');sky.addColorStop(1,'#eef4e2');c.fillStyle=sky;c.fillRect(0,0,w,h);
    // Project the ground horizon and stands in the SAME camera space as the players.
    // Screen-space backdrops would make distant pitch markings appear to float.
    const horizon=p(cam.position[0]+(cam.target[0]-cam.position[0])*10000,cam.position[1]+(cam.target[1]-cam.position[1])*10000,0);
    const groundTop=Math.max(0,Math.min(h,horizon?.y??0));
    const ground=c.createLinearGradient(0,groundTop,0,h);ground.addColorStop(0,'#27624e');ground.addColorStop(1,'#164b3d');c.fillStyle=ground;c.fillRect(0,groundTop,w,h-groundTop);
    const stands=[
      [[-8,76,0],[113,76,0],[113,94,14],[-8,94,14]],
      [[113,-8,0],[113,76,0],[131,76,14],[131,-8,14]],
      [[-8,-8,0],[-8,76,0],[-26,76,14],[-26,-8,14]],
      [[-8,-8,0],[113,-8,0],[113,-26,14],[-8,-26,14]]
    ].map(vertices=>({vertices,depth:p(...vertices[0])?.depth??-1})).sort((a,b)=>b.depth-a.depth);
    // Original arena: every tier, spectator and roof beam shares the pitch camera.
    const poly=(vertices,fill,stroke=null,width=1)=>{const q=projectPolygon(vertices,cam,w,h);if(q.length<3)return;c.beginPath();q.forEach((a,i)=>i?c.lineTo(a.x,a.y):c.moveTo(a.x,a.y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
    const lerp=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t);
    for(const {vertices:v} of stands){
      poly(v,'#263746');
      for(let row=0;row<18;row++){
        const t=(row+.5)/18,a=lerp(v[0],v[3],t),b=lerp(v[1],v[2],t);
        const a2=lerp(v[0],v[3],(row+1)/18),b2=lerp(v[1],v[2],(row+1)/18);
        poly([a,b,b2,a2],row%2?'#344b5d':'#2c4053');
        // Broad stair aisles interrupt blocks of supporters, rather than a flat dotted texture.
        for(let section=0;section<=8;section++){const t0=section/8;poly([lerp(a,b,t0),lerp(a,b,Math.min(1,t0+.012)),lerp(a2,b2,Math.min(1,t0+.012)),lerp(a2,b2,t0)],'#809198');}
        for(let i=0;i<136;i++){
          if(i%17<2)continue;
          const seat=p(...lerp(a,b,(i+.5+(row%2)*.2)/136));
          if(!seat||seat.x<-8||seat.x>w+8||seat.y<-8||seat.y>h+8)continue;
          const size=Math.max(.7,Math.min(4.2,seat.scale*.16));
          const colours=[kits.A.primary,kits.A.secondary,kits.B.primary,'#ccd9e2','#9bbcc4','#e9b08d','#8572b5'];
          c.fillStyle=colours[(i*13+row*7+Math.floor(i/17))%7];
          c.fillRect(seat.x-size*.6,seat.y-size*.25,size*1.2,size*1.25);
          c.fillStyle=['#e5bb99','#956b58','#c78b63'][(i+row)%3];c.beginPath();c.arc(seat.x,seat.y-size*.6,size*.4,0,Math.PI*2);c.fill();
        }
      }
      // Mid-tier concourse and continuous original LED ribbon.
      for(const t of [.46,.49]){const a=lerp(v[0],v[3],t),b=lerp(v[1],v[2],t);poly([a,b,[b[0],b[1],b[2]+.45],[a[0],a[1],a[2]+.45]],t===.46?'#151f34':'#b8a0ff');}
      const topA=v[3],topB=v[2],innerA=lerp(topA,v[0],.24),innerB=lerp(topB,v[1],.24);
      const roofA=[topA[0],topA[1],19.5],roofB=[topB[0],topB[1],19.5],lipA=[innerA[0],innerA[1],18.5],lipB=[innerB[0],innerB[1],18.5];
      poly([roofA,roofB,lipB,lipA],'#1b2a40','#586a80');
      poly([lipA,lipB,[lipB[0],lipB[1],17.8],[lipA[0],lipA[1],17.8]],'#ab94f0');
      for(let i=0;i<=16;i++){const a=p(...lerp(roofA,roofB,i/16)),b=p(...lerp(lipA,lipB,i/16));if(a&&b){c.strokeStyle='#879ca477';c.lineWidth=1;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}}
      // Pitch-side boards, with original MatchLens colours and lettering.
      for(let i=0;i<12;i++){
        const a=lerp(v[0],v[1],i/12),b=lerp(v[0],v[1],(i+.98)/12);
        poly([[a[0],a[1],.15],[b[0],b[1],.15],[b[0],b[1],1.3],[a[0],a[1],1.3]],['#b9a0ff','#dbf99a','#f6ad7f','#213b4d'][i%4]);
        const label=p((a[0]+b[0])/2,(a[1]+b[1])/2,.65);if(label&&label.x>0&&label.x<w&&label.y>0&&label.y<h){c.save();c.font=`800 ${Math.max(4,Math.min(12,label.scale*.35))}px system-ui`;c.textAlign='center';c.fillStyle=i%4===3?'#eefbcf':'#263047';c.fillText(i%2?'WHAT IF ↗':'MATCHLENS',label.x,label.y);c.restore();}
      }
    }
    // Four original floodlight masts, behind the playing surface.
    for(const [x,y]of [[-4,-4],[109,-4],[-4,72],[109,72]]){const foot=p(x,y,0),top=p(x,y,25);if(!foot||!top)continue;c.strokeStyle='#bacbd7';c.lineWidth=2;c.beginPath();c.moveTo(foot.x,foot.y);c.lineTo(top.x,top.y);c.stroke();const size=Math.max(3,Math.min(22,top.scale*1.3));c.fillStyle='#283c50';c.fillRect(top.x-size,top.y-size*.25,size*2,size*.5);for(let i=0;i<5;i++){c.fillStyle='#fff8cc';c.fillRect(top.x-size*.85+i*size*.36,top.y-size*.15,size*.22,size*.22);}}
    const corners=projectPolygon([[0,0,0],[105,0,0],[105,68,0],[0,68,0]],cam,w,h);
    if(corners.length>=3){c.beginPath();corners.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fillStyle='#32885c';c.shadowColor='#56787b35';c.shadowBlur=30;c.fill();c.shadowBlur=0;}
    else{ /* The perspective ground already covers all visible pitch space. */ }
    for(let i=0;i<10;i++){const stripe=projectPolygon([[i*10.5,0,0],[(i+1)*10.5,0,0],[(i+1)*10.5,68,0],[i*10.5,68,0]],cam,w,h);if(stripe.length<3)continue;c.beginPath();stripe.forEach((v,j)=>j?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fillStyle=i%2?'#d7ee9f20':'#092b2820';c.fill();}
    // Fine turf and a soft afternoon light pool, clipped to the same projected pitch.
    if(corners.length>=3){
      c.save();c.beginPath();corners.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.closePath();c.clip();
      const light=c.createRadialGradient(w*.58,h*.4,0,w*.58,h*.4,w*.7);light.addColorStop(0,'#e0f7b31b');light.addColorStop(1,'#073b391c');c.fillStyle=light;c.fillRect(0,0,w,h);
      for(let x=1;x<105;x+=2.2)for(let y=1;y<68;y+=2.1){const jitter=Math.sin(x*71+y*29),q=p(x+jitter*.6,y+jitter*.4,.015);if(!q||q.x<0||q.x>w||q.y<0||q.y>h)continue;c.strokeStyle=jitter>0?'#cce9a31a':'#0c493422';c.lineWidth=Math.max(.5,Math.min(1.2,q.scale*.015));c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x+Math.max(.5,Math.min(2,q.scale*.06)),q.y-.4);c.stroke();}
      c.restore();
    }
    const line=(a,b,color='#e9fff0b5',width=1.2,dashed=false)=>{
      c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dashed?[6,7]:[]);c.beginPath();let active=false;
      for(let i=0;i<=40;i++){const k=i/40,q=p(a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,(a[2]||0)+((b[2]||0)-(a[2]||0))*k);if(q&&Math.abs(q.x)<w*8&&Math.abs(q.y)<h*8){if(!active)c.moveTo(q.x,q.y);else c.lineTo(q.x,q.y);active=true;}else active=false;}
      c.stroke();c.setLineDash([]);
    };
    const ring=(x,y,r,color,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();let active=false;for(let i=0;i<=72;i++){const a=i/72*Math.PI*2,q=p(x+Math.cos(a)*r,y+Math.sin(a)*r,.03);if(q){if(active)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);active=true;}else active=false;}c.stroke();};
    for(const [a,b] of [[[0,0],[105,0]],[[105,0],[105,68]],[[105,68],[0,68]],[[0,68],[0,0]],[[52.5,0],[52.5,68]]])line(a,b);
    ring(52.5,34,9.15,'#e9fff0b5');
    for(const x of [0,105]){const edge=x===0?16.5:88.5;line([x,13.84],[edge,13.84]);line([edge,13.84],[edge,54.16]);line([edge,54.16],[x,54.16]);const box=x===0?5.5:99.5;line([x,24.84],[box,24.84]);line([box,24.84],[box,43.16]);line([box,43.16],[x,43.16]);
      line([x,30.34,0],[x,30.34,2.44],'#f1f8f9a0',1.5);line([x,37.66,0],[x,37.66,2.44],'#f1f8f9a0',1.5);line([x,30.34,2.44],[x,37.66,2.44],'#f1f8f9a0',1.5);const back=x===0?-2:107;line([back,30.34,0],[back,30.34,2.44],'#ffffff90',1);line([back,37.66,0],[back,37.66,2.44],'#ffffff90',1);line([back,30.34,2.44],[back,37.66,2.44],'#ffffff90',1);for(let gy=30.34;gy<=37.66;gy+=.61){line([x,gy,2.44],[back,gy,2.44],'#ffffff38',.6);line([back,gy,0],[back,gy,2.44],'#ffffff38',.6);}for(let gz=.4;gz<=2.44;gz+=.4)line([back,30.34,gz],[back,37.66,gz],'#ffffff38',.6);}
    for(const [x,y]of [[52.5,34],[11,34],[94,34]]){const q=p(x,y,.025);if(q){c.fillStyle='#edf8dfc0';c.beginPath();c.arc(q.x,q.y,Math.max(1,q.scale*.12),0,Math.PI*2);c.fill();}}
    for(const [x,y]of [[0,0],[105,0],[0,68],[105,68]]){line([x,y,0],[x,y,1.5],'#e8f2dc',1.3);poly([[x,y,1.5],[x+.6,y,1.3],[x,y,1.05]],'#edb267');}
    if(!frame){return moving;}
    if(layers.expected&&mode==='broadcast'&&timeMs>=6000&&timeMs<=6500){const chosen=options.find(o=>o.receiverId===receiverId&&o.xG?.value!==null);const t=chosen?.distance?.inputs.target;if(t){const triangle=[[t.x,t.y],[105,30.34],[105,37.66]].map(([x,y])=>p(x,y,.04));if(triangle.every(Boolean)){c.beginPath();triangle.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fillStyle='#8559e82b';c.fill();c.strokeStyle='#7040cd80';c.lineWidth=1;c.stroke();}}}
    if(layers.pressure&&pressureAvailable&&frame.positions.A1&&timeMs<=6500){const a=frame.positions.A1;ring(a.x,a.y,5,'#f4b27a90',1.5);}
    if(layers.options&&timeMs>=6000&&timeMs<=6500)for(const o of options.filter(o=>o.available)){
      const {origin,target}=o.distance.inputs;if(!origin||!target)continue;
      const selected=o.receiverId===receiverId, color=o.lane.value===null?'#8a94a4':o.lane.value==='obstructed'?'#f56e43':'#334ece';
      line([origin.x,origin.y,.1],[target.x,target.y,.1],color,selected?2.3:1.1,true);
      ring(target.x,target.y,selected?2:1.3,color,selected?2:1);
    }
    if(layers.trajectories&&trajectoryOrigin&&frame.ball&&timeMs>6500){
      line([trajectoryOrigin.x,trajectoryOrigin.y,.2],[frame.ball.x,frame.ball.y,frame.ballHeightM||.2],'#faffdfd9',2.5);
    }
    const people=Object.entries(frame.positions).map(([id,pos])=>({id,pos,point:p(pos.x,pos.y,0)})).filter(o=>o.point).sort((a,b)=>b.point.depth-a.point.depth);
    for(const {id,pos,point} of people){
      if(mode==='receiver'&&id===receiverId&&cam.position[2]<3)continue;
      if(point.x<-120||point.x>w+120||point.y<-160||point.y>h+160)continue;
      const kicking=id==='A1'&&timeMs>=6500&&timeMs<=6820;
      const rig=athletePose(frame,id,timeMs,{animate:playing&&!reduced,kicking});
      const kit=kits[id.startsWith('A')?'A':'B'];
      if(visualStyle==='sprites'){
        const head=p(pos.x,pos.y,1.8);if(!head)continue;
        const height=spriteHeight(mode,Math.abs(point.y-head.y)),width=height*2/3;
        c.fillStyle='#143a3260';c.beginPath();c.ellipse(point.x,point.y+1,height*.19,height*.055,-.12,0,Math.PI*2);c.fill();
        if(id===receiverId){ring(pos.x,pos.y,1.1,'#fdf7ba',2.5);ring(pos.x,pos.y,1.35,'#7955eaaa',1.2);}
        const back=rig.forward[0]*(cam.position[0]-pos.x)+rig.forward[1]*(cam.position[1]-pos.y)<0;
        const sprite=this.atlas.get({kit,skin:rig.skin,hair:rig.hair,number:rig.number,frame:animationFrame(timeMs,playing,reduced,Number(id.slice(1))*.4),back});
        c.imageSmoothingEnabled=true;c.drawImage(sprite,point.x-width/2,point.y-height*136/144,width,height);
        const main=['A2','A3','A4'].includes(id),bubble=mode==='broadcast'&&timeMs===6000&&!playing&&layers.expected&&options.find(o=>o.receiverId===id)?.xG?.value!=null;
        if(layers.labels&&(id===receiverId||['A1','A2','A3','A4','B1'].includes(id))&&!(main&&bubble)){
          const name=({A1:'NINO',A2:'LEO',A3:'SAMI',A4:'NOAH'})[id]??id;c.font='800 10px system-ui';c.textAlign='center';const textWidth=c.measureText(name).width;c.fillStyle=id===receiverId?'#6241bf':'#193e41e8';const top=point.y-height*136/144-17;c.beginPath();c.roundRect(point.x-textWidth/2-7,top,textWidth+14,16,5);c.fill();c.fillStyle='#fff';c.fillText(name,point.x,top+11);
        }
        continue;
      }
      Object.assign(rig,{shirt:kit.primary,shirtDark:kit.secondary,shorts:kit.shorts,socks:kit.socks});
      const j=Object.fromEntries(Object.entries(rig.joints).map(([name,v])=>[name,project(v,cam,w,h)]));
      if(!j.head||!j.waist||!j.neck)continue;
      const scale=j.waist.scale,isSelected=id===receiverId;
      const groundShadow=p(pos.x+.4,pos.y+.2,.01);
      if(groundShadow){const g=c.createRadialGradient(groundShadow.x,groundShadow.y,0,groundShadow.x,groundShadow.y,Math.max(4,scale*.65));g.addColorStop(0,'#092b3365');g.addColorStop(1,'#092b3300');c.fillStyle=g;c.beginPath();c.ellipse(groundShadow.x,groundShadow.y,Math.max(4,scale*.72),Math.max(2,scale*.24),-.25,0,Math.PI*2);c.fill();}
      if(isSelected)ring(pos.x,pos.y,.75,'#d3c7ff',2);
      const limb=(a,b,r,color,highlight=true)=>{if(!j[a]||!j[b])return;const x=j[a],y=j[b],width=Math.max(1,scale*r*2);c.lineCap='round';c.lineWidth=width;c.strokeStyle=color;c.beginPath();c.moveTo(x.x,x.y);c.lineTo(y.x,y.y);c.stroke();if(highlight&&width>3){c.lineWidth=width*.25;c.strokeStyle='#ffffff28';c.beginPath();c.moveTo(x.x-width*.12,x.y);c.lineTo(y.x-width*.12,y.y);c.stroke();}};
      const sphere=(q,r,color)=>{if(!q)return;const radius=Math.max(.8,q.scale*r),g=c.createRadialGradient(q.x-radius*.35,q.y-radius*.45,radius*.05,q.x,q.y,radius);g.addColorStop(0,color);g.addColorStop(.65,color);g.addColorStop(1,'#523b3d');c.fillStyle=g;c.beginPath();c.arc(q.x,q.y,radius,0,Math.PI*2);c.fill();};
      // Anatomical hierarchy: boots, socks, knees, shorts, torso, arms, neck, face.
      for(const side of ['L','R']){
        limb('hip'+side,'knee'+side,.085,rig.skin);
        limb('knee'+side,'ankle'+side,.065,rig.socks);
        const ankle=j['ankle'+side];if(ankle){c.save();c.translate(ankle.x,ankle.y);c.rotate(-.12);c.fillStyle=rig.boots;c.beginPath();c.ellipse(0,0,Math.max(1.6,scale*.12),Math.max(1,scale*.055),0,0,Math.PI*2);c.fill();c.restore();}
        limb('hip'+side,'knee'+side,.105,rig.shorts);
        // Sock cuff is separate from the thigh, exposing a short knee section.
        if(j['knee'+side]&&j['ankle'+side]){const a=j['knee'+side],b=j['ankle'+side];c.strokeStyle=rig.socks;c.lineWidth=Math.max(1.3,scale*.13);c.beginPath();c.moveTo(a.x+(b.x-a.x)*.22,a.y+(b.y-a.y)*.22);c.lineTo(b.x,b.y);c.stroke();}
      }
      const torso=[j.shoulderL,j.shoulderR,j.hipR,j.hipL];if(torso.every(Boolean)){const minX=Math.min(...torso.map(v=>v.x)),maxX=Math.max(...torso.map(v=>v.x)),g=c.createLinearGradient(minX,0,Math.max(minX+1,maxX),0);g.addColorStop(0,rig.shirtDark);g.addColorStop(.42,rig.shirt);g.addColorStop(.7,rig.shirt);g.addColorStop(1,rig.shirtDark);c.fillStyle=g;c.beginPath();torso.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fill();}
      for(const side of ['L','R']){limb('shoulder'+side,'elbow'+side,.07,rig.shirt);limb('elbow'+side,'wrist'+side,.048,rig.skin);sphere(j['wrist'+side],.05,rig.skin);}
      limb('neck','head',.065,rig.skin);sphere(j.head,.12,rig.skin);
      const head=j.head,hr=Math.max(.8,head.scale*.12);c.fillStyle=rig.hair;c.beginPath();c.arc(head.x,head.y-hr*.16,hr*.97,Math.PI,Math.PI*2);c.lineTo(head.x+hr*.8,head.y-hr*.25);c.quadraticCurveTo(head.x,head.y-hr*.65,head.x-hr*.8,head.y-hr*.2);c.fill();
      const chestY=(j.neck.y+j.waist.y)*.5,chestX=(j.neck.x+j.waist.x)*.5;
      if(scale>11){c.font=`800 ${Math.max(5,Math.min(22,scale*.19))}px system-ui`;c.textAlign='center';c.fillStyle='#ffffffed';c.fillText(String(rig.number),chestX,chestY+scale*.06);}
      if(layers.labels&&(isSelected||['A1','A2','A3','A4','B1'].includes(id))){const name=({A1:'NINO',A2:'LEO',A3:'SAMI',A4:'NOAH'})[id]??id;c.font=`700 ${mode==='broadcast'?10:11}px system-ui`;const textWidth=c.measureText(name).width;c.fillStyle=isSelected?'#5340bbee':'#142d3dd9';c.beginPath();c.roundRect(head.x-textWidth/2-6,head.y-hr-21,textWidth+12,15,4);c.fill();c.fillStyle='#fff';c.textAlign='center';c.fillText(name,head.x,head.y-hr-10);}
    }
    if(frame.ball){const b=p(frame.ball.x,frame.ball.y,frame.ballHeightM||.2),shadow=p(frame.ball.x,frame.ball.y);if(b){const r=Math.max(3,Math.min(16,b.scale*.17));if(shadow){c.fillStyle='#061f3855';c.beginPath();c.ellipse(shadow.x,shadow.y,r*1.15,r*.35,0,0,Math.PI*2);c.fill();}c.save();c.translate(b.x,b.y);c.rotate(timeMs/210);const leather=c.createRadialGradient(-r*.35,-r*.4,0,0,0,r);leather.addColorStop(0,'#ffffff');leather.addColorStop(.65,'#f2f2e9');leather.addColorStop(1,'#95aaa9');c.fillStyle=leather;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();c.strokeStyle='#26324b';c.lineWidth=Math.max(.5,r*.09);c.stroke();c.beginPath();for(let i=0;i<5;i++){const a=i/5*Math.PI*2-Math.PI/2,x=Math.cos(a)*r*.48,y=Math.sin(a)*r*.48;if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.closePath();c.fillStyle='#40315d';c.fill();c.stroke();for(let i=0;i<5;i++){const a=i/5*Math.PI*2-Math.PI/2;c.beginPath();c.moveTo(Math.cos(a)*r*.48,Math.sin(a)*r*.48);c.lineTo(Math.cos(a+.12)*r*.96,Math.sin(a+.12)*r*.96);c.stroke();}c.restore();}}
    const vignette=c.createRadialGradient(w*.5,h*.5,h*.2,w*.5,h*.5,w*.7);vignette.addColorStop(0,'#ffffff00');vignette.addColorStop(1,'#b8daf01a');c.fillStyle=vignette;c.fillRect(0,0,w,h);
    return moving;
  }
}

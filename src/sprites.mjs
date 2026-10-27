import {kitContrast} from './kits.mjs';
// Original hand-drawn canvas sprites, cached as a small atlas. No external artwork.
export const spriteHeight=(mode,physicalHeight)=>Math.max(mode==='broadcast'?35:40,Math.min(mode==='broadcast'?70:132,physicalHeight*(mode==='broadcast'?2.1:1.35)));
export function animationFrame(timeMs,playing,reduced,offset=0){return playing&&!reduced?Math.floor(Math.max(0,timeMs)/115+offset)%8:0;}
export class SpriteAtlas{
 constructor(){this.cache=new Map();}
 get({kit,skin,hair,number,frame=0,back=false}){
  const key=[kit.primary,kit.secondary,kit.shorts,kit.socks,skin,hair,number,frame,back].join('|');if(this.cache.has(key))return this.cache.get(key);
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=144;const c=canvas.getContext('2d');c.scale(2,2);
  const phase=frame===0?0:Math.sin(frame/8*Math.PI*2),leg=phase*4,arm=-phase*3,bob=frame===0?0:Math.abs(phase)*.8;
  c.translate(24,68-bob);c.lineJoin='round';c.lineCap='round';
  const stroke=(points,width,color,outline=true)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(outline){c.lineWidth=width+1.3;c.strokeStyle='#1f25483b';c.stroke();}c.lineWidth=width;c.strokeStyle=color;c.stroke();};
  const poly=(pts,fill)=>{c.fillStyle=fill;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
  // Legs / knee / ribbed socks / coloured boots.
  for(const side of [-1,1]){const shift=leg*side;stroke([[side*3,-24],[side*4+shift*.3,-13],[side*5+shift,-3]],5.5,skin);stroke([[side*4+shift*.3,-12],[side*5+shift,-3]],4.8,kit.socks);stroke([[side*4+shift*.3,-12],[side*4+shift*.35,-10]],5.2,kit.secondary,false);stroke([[side*5+shift,-2],[side*5+shift+4,-1]],4.3,side===-1?'#d8ec4e':'#252b49');c.fillStyle='#ffffff88';c.fillRect(side*5+shift+1,-3,3,.8);}
  // Shorts silhouette, contrasting seam.
  poly([[-8,-30],[8,-30],[8,-21],[2,-20],[0,-25],[-2,-20],[-8,-21]],kit.shorts);stroke([[0,-27],[0,-24]],.6,'#1c24483f',false);
  // Far arm, then bold illustrated shirt with original sleeve pattern.
  stroke([[8,-46],[11+arm,-35],[10+arm,-29]],5,skin);stroke([[8,-46],[10+arm*.6,-40]],6.2,kit.secondary);
  const jersey=c.createLinearGradient(-9,0,9,0);jersey.addColorStop(0,kit.primary);jersey.addColorStop(.6,kit.primary);jersey.addColorStop(1,shade(kit.primary,-24));
  poly([[-8,-48],[-3,-50],[3,-50],[8,-48],[9,-40],[7,-39],[7,-29],[-7,-29],[-7,-39],[-10,-40]],jersey);
  poly([[-8,-48],[-4,-49],[-4,-45],[-8,-39],[-10,-40]],kit.secondary);poly([[5,-49],[8,-48],[9,-40],[7,-39],[5,-44]],kit.secondary);
  stroke([[-7,-29],[7,-29]],1.5,kit.secondary,false);stroke([[-6,-43],[-5,-34]],.8,'#ffffff50',false);
  stroke([[-8,-44],[-11-arm,-35],[-9-arm,-29]],4.8,skin);stroke([[-8,-46],[-10-arm*.6,-40]],6,kit.secondary);
  // Shirt number and collar, no badge or sponsor.
  c.fillStyle=kitContrast(kit.primary);c.font=`900 ${back?10:8}px system-ui`;c.textAlign='center';c.fillText(String(number),0,-34);stroke([[-3,-49],[0,-47],[3,-49]],1.8,kit.secondary,false);
  // Neck, shaded face, hair, ear and restrained facial details.
  stroke([[0,-52],[0,-48]],4.7,skin);c.fillStyle=shade(skin,-23);c.beginPath();c.ellipse(0,-55,6.3,7.6,0,0,Math.PI*2);c.fill();
  c.fillStyle=skin;c.beginPath();c.ellipse(-.7,-55.6,5.6,7,0,0,Math.PI*2);c.fill();c.fillStyle=shade(skin,18);c.beginPath();c.ellipse(-2.4,-57,2.5,3.9,-.2,0,Math.PI*2);c.fill();
  c.fillStyle=hair;c.beginPath();c.moveTo(-6,-55);c.quadraticCurveTo(-8,-65,-1,-65);c.quadraticCurveTo(8,-66,6,-55);c.lineTo(4,-59);c.lineTo(-3,-60);c.closePath();c.fill();
  if(back){c.fillStyle=hair;c.beginPath();c.ellipse(0,-56,5.2,6,0,0,Math.PI*2);c.fill();}else{c.fillStyle='#242333';c.fillRect(-2,-55,1,1);c.fillRect(2,-55,1,1);stroke([[-1,-51],[1,-51]],.5,'#9b564e',false);}
  if(this.cache.size>900)this.cache.clear();this.cache.set(key,canvas);return canvas;
 }
}
function shade(hex,amount){const values=[1,3,5].map(i=>Math.max(0,Math.min(255,parseInt(hex.slice(i,i+2),16)+amount)));return '#'+values.map(n=>n.toString(16).padStart(2,'0')).join('');}

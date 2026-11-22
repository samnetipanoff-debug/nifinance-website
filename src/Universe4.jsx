import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const DIRECTIONS = [
  { id:'marketing', name:'Marketing', color:'#71dfff', metric:'Demand generation', value:'01' },
  { id:'sales', name:'Sales', color:'#b9a0ff', metric:'Commercial conversion', value:'02' },
  { id:'customers', name:'Customers', color:'#f3e66d', metric:'Client relationships', value:'03' },
  { id:'production', name:'Production', color:'#ff8c70', metric:'Service delivery', value:'04' },
  { id:'procurement', name:'Procurement', color:'#ffbf69', metric:'Resources & suppliers', value:'05' },
  { id:'logistics', name:'Logistics', color:'#70d6b2', metric:'Operations flow', value:'06' },
  { id:'finance', name:'Finance', color:'#e8f3df', metric:'Capital & performance', value:'07' },
  { id:'economics', name:'Economics', color:'#9dff8c', metric:'Business intelligence', value:'08' },
  { id:'people', name:'People', color:'#c2a4ff', metric:'Team & organisation', value:'09' },
  { id:'data', name:'Data & IT', color:'#71dfff', metric:'Technology infrastructure', value:'10' }
];
const EDGES = [[0,1],[1,2],[2,0],[1,3],[3,4],[4,5],[5,3],[5,2],[1,6],[6,7],[7,3],[7,1],[8,3],[8,6],[9,0],[9,1],[9,7],[0,6],[2,6],[4,6],[5,9],[8,1],[3,6],[7,9]];

const TRIAL_RECORDS = Array.from({length: 240}, (_, i) => {
  const d = DIRECTIONS[i % DIRECTIONS.length];
  const templates = ['Client receipt','Supplier payment','Campaign spend','CRM deal','Payroll operation','Cloud invoice','Support ticket','SEO delivery','Bank import','API event'];
  const amount = Math.round((250 + ((i * 7919) % 13700) + (i % 17) * 31.37) * 100) / 100;
  return {
    id: 'u4-record-' + i,
    directionId: d.id,
    direction: d.name,
    title: templates[i % templates.length] + ' ' + String(i + 1).padStart(3,'0'),
    type: ['transaction','operation','record','metric'][i % 4],
    status: ['completed','processing','pending','review'][i % 4],
    date: '2026-03-' + String(1 + (i % 27)).padStart(2,'0'),
    amount,
    currency: i % 5 === 0 ? 'USD' : 'EUR',
    counterparty: ['Northstar','Acme','Nova','Atlas','Delta','Orion','Vertex','Internal'][i % 8],
    reference: 'U4-' + String(10000 + i),
    description: 'Trial record linked to ' + d.name + '. It represents a concrete operation in the business graph.'
  };
});

function DataWindow({win,onClose,onFront,onMove,onResize}){
  const drag=useRef(null), resize=useRef(null);
  const move=e=>{if(!drag.current)return;onMove(win.id,drag.current.left+e.clientX-drag.current.x,drag.current.top+e.clientY-drag.current.y)};
  const rmove=e=>{if(!resize.current)return;onResize(win.id,resize.current.width+e.clientX-resize.current.x,resize.current.height+e.clientY-resize.current.y)};
  const end=()=>{drag.current=null;resize.current=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointermove',rmove);window.removeEventListener('pointerup',end)};
  const startDrag=e=>{e.preventDefault();onFront(win.id);drag.current={x:e.clientX,y:e.clientY,left:win.x,top:win.y};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end)};
  const startResize=e=>{e.preventDefault();e.stopPropagation();onFront(win.id);resize.current={x:e.clientX,y:e.clientY,width:win.width,height:win.height};window.addEventListener('pointermove',rmove);window.addEventListener('pointerup',end)};
  const r=win.record, d=DIRECTIONS.find(x=>x.id===r.directionId);
  return <section className="u4-window" style={{left:win.x,top:win.y,width:win.width,height:win.height,zIndex:win.z,'--c':d.color}}>
    <header className="u4-window-head" onPointerDown={startDrag}><i className="u4-window-dot"/><div className="u4-window-title"><b>{r.title}</b><small>{r.type.toUpperCase()} · {r.reference}</small></div><button className="u4-window-close" onPointerDown={e=>e.stopPropagation()} onClick={()=>onClose(win.id)}>×</button></header>
    <div className="u4-window-body"><div className="u4-window-kpi"><span>{r.direction.toUpperCase()} · {r.status.toUpperCase()}</span><strong>{r.amount.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})} {r.currency}</strong></div>
      <div className="u4-row"><b>Date</b><span>{r.date}</span></div><div className="u4-row"><b>Counterparty</b><span>{r.counterparty}</span></div><div className="u4-row"><b>Operation</b><span>{r.type}</span></div><div className="u4-row"><b>Reference</b><span>{r.reference}</span></div>
      <p className="u4-note">{r.description}</p><p className="u4-note">TRIAL DATA · every visible data point is a concrete operation, transaction, record, KPI or system event.</p>
    </div><div className="u4-resize" onPointerDown={startResize}/>
  </section>
}

const css = `
.u4{position:fixed;inset:0;background:#020403;color:#eaf4e8;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.u4 canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:0}
.u4:before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(ellipse at 50% 48%,transparent 20%,rgba(0,0,0,.12) 62%,#000 100%)}
.u4-head{position:absolute;z-index:3;top:25px;left:30px;pointer-events:none}
.u4-kicker{font:600 10px/1.4 ui-monospace,monospace;letter-spacing:.28em;color:#d9ebd2}
.u4-sub{margin-top:6px;font:9px ui-monospace,monospace;letter-spacing:.18em;color:#758a77}
.u4-live{position:absolute;z-index:3;right:30px;top:27px;color:#91a88c;font:9px ui-monospace,monospace;letter-spacing:.18em}
.u4-live i{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:8px;background:#c9ff78;box-shadow:0 0 12px #c9ff78}
.u4-labels{position:absolute;z-index:2;inset:0;pointer-events:none}
.u4-label{position:absolute;transform:translate(-50%,-50%);min-width:112px;padding:7px 10px;border:1px solid color-mix(in srgb,var(--c),transparent 62%);border-radius:3px;background:linear-gradient(130deg,rgba(4,12,9,.91),rgba(3,7,6,.64));box-shadow:0 4px 24px #0008,inset 0 0 16px color-mix(in srgb,var(--c),transparent 96%);color:#dfe9dc;text-align:left;white-space:nowrap;backdrop-filter:blur(9px);pointer-events:auto;cursor:pointer;transition:opacity .18s,border-color .18s,background .18s}
.u4-label:before{content:"";position:absolute;left:-4px;top:11px;width:5px;height:5px;background:var(--c);border-radius:50%;box-shadow:0 0 10px var(--c)}
.u4-label b{display:block;font:600 9px ui-monospace,monospace;letter-spacing:.08em;color:var(--c)}
.u4-label small{display:block;margin-top:4px;font:8px ui-monospace,monospace;color:#879987;letter-spacing:.02em}
.u4-label.active{border-color:var(--c);background:rgba(7,16,11,.97);box-shadow:0 0 25px color-mix(in srgb,var(--c),transparent 82%),inset 0 0 20px color-mix(in srgb,var(--c),transparent 92%)}
.u4-controls{position:absolute;z-index:4;right:26px;bottom:24px;display:flex;align-items:center;gap:5px;padding:6px;border:1px solid #a8c89b2b;border-radius:8px;background:#050a07d9;backdrop-filter:blur(14px)}
.u4-controls button{width:32px;height:30px;border:0;border-radius:4px;background:#ffffff08;color:#c5d7bf;font-size:17px;cursor:pointer}
.u4-controls button:hover{background:#c9ff781c;color:#c9ff78}
.u4-controls span{min-width:42px;text-align:center;color:#8ea18a;font:9px ui-monospace,monospace}
.u4-hint{position:absolute;z-index:3;left:30px;bottom:29px;color:#657666;font:8px ui-monospace,monospace;letter-spacing:.12em;pointer-events:none}
.u4-selection{position:absolute;z-index:4;left:50%;bottom:22px;transform:translateX(-50%);min-width:180px;text-align:center;pointer-events:none}
.u4-selection strong{display:block;color:var(--c,#c9ff78);font:600 10px ui-monospace,monospace;letter-spacing:.18em}
.u4-selection span{display:block;margin-top:5px;color:#788b79;font:8px ui-monospace,monospace;letter-spacing:.12em}
.u4-windows{position:absolute;inset:0;z-index:20;pointer-events:none}
.u4-window{position:absolute;min-width:260px;min-height:180px;width:360px;height:270px;border:1px solid #78947c55;border-radius:5px;background:rgba(4,10,7,.96);box-shadow:0 18px 60px #000b;backdrop-filter:blur(16px);pointer-events:auto;overflow:hidden}
.u4-window-head{height:40px;display:flex;align-items:center;gap:9px;padding:0 10px;border-bottom:1px solid #8aa08a22;cursor:grab;user-select:none}
.u4-window-dot{width:7px;height:7px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c)}
.u4-window-title{min-width:0;flex:1}.u4-window-title b{display:block;color:#dfe9df;font:600 9px ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.u4-window-title small{display:block;margin-top:3px;color:#68796a;font:7px ui-monospace,monospace}
.u4-window-close{width:24px;height:24px;border:0;background:transparent;color:#819081;font-size:16px;cursor:pointer}
.u4-window-body{height:calc(100% - 40px);overflow:auto;padding:12px}
.u4-window-kpi{display:flex;justify-content:space-between;gap:12px;padding-bottom:11px;margin-bottom:10px;border-bottom:1px solid #8aa08a20}.u4-window-kpi span{color:#667767;font:7px ui-monospace,monospace}.u4-window-kpi strong{color:var(--c);font:600 15px ui-monospace,monospace}
.u4-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #8aa08a12}.u4-row b{font:8px ui-monospace,monospace;color:#c3d0c2}.u4-row span{font:8px ui-monospace,monospace;color:#829083;text-align:right}
.u4-note{margin-top:11px;color:#647466;font:8px/1.55 ui-monospace,monospace}.u4-resize{position:absolute;right:1px;bottom:1px;width:16px;height:16px;cursor:nwse-resize}.u4-resize:after{content:"";position:absolute;right:2px;bottom:2px;width:7px;height:7px;border-right:1px solid #91a88a66;border-bottom:1px solid #91a88a66}
@media(max-width:700px){.u4-window{width:88vw;height:55vh}}

@media(max-width:700px){.u4-head{top:16px;left:16px}.u4-kicker{font-size:9px}.u4-sub{font-size:7px}.u4-live{top:18px;right:15px;font-size:7px}.u4-label{min-width:0;padding:6px 7px}.u4-label b{font-size:7px}.u4-label small{display:none}.u4-controls{right:12px;bottom:14px}.u4-hint{left:15px;bottom:23px;font-size:6px;max-width:115px;line-height:1.6}.u4-selection{bottom:19px}.u4-selection span{font-size:7px}}
`;

function makeCurve(a,b,index,radius){
  const mid=a.clone().add(b).multiplyScalar(.5);
  const lift=mid.clone().normalize().multiplyScalar(radius*(1.08+((index%4)*.035)));
  const bend=new THREE.Vector3(Math.sin(index*2.13),Math.cos(index*1.71),Math.sin(index*.91)).multiplyScalar(.22);
  return new THREE.CatmullRomCurve3([a,a.clone().lerp(lift,.38).add(bend),lift.clone().add(bend),b.clone().lerp(lift,.38).add(bend),b]);
}
function seeded(i){
  const x=Math.sin(i*12.9898)*43758.5453;
  return x-Math.floor(x);
}
function spherePoint(i,count,r){
  const y=1-(i/(count-1))*2, rr=Math.sqrt(Math.max(0,1-y*y)), theta=Math.PI*(3-Math.sqrt(5))*i;
  return new THREE.Vector3(Math.cos(theta)*rr, y, Math.sin(theta)*rr).multiplyScalar(r);
}

export default function Universe4(){
 const host=useRef(null),[selected,setSelected]=useState(null),[zoom,setZoom]=useState(100),[windows,setWindows]=useState([]),zTop=useRef(20),openRecordRef=useRef(null);
 
 const openRecord=record=>{
   setWindows(prev=>{
     zTop.current+=1;
     const existing=prev.find(w=>w.id===record.id);
     if(existing)return prev.map(w=>w.id===record.id?{...w,z:zTop.current}:w);
     const offset=(prev.length%5)*28,width=Math.min(380,Math.max(280,window.innerWidth*.28)),height=Math.min(310,Math.max(220,window.innerHeight*.34));
     return [...prev,{id:record.id,record,x:Math.min(35+offset,window.innerWidth-width-10),y:Math.min(80+offset,window.innerHeight-height-55),width,height,z:zTop.current}];
   });
   setSelected(record.directionId);
 };
 openRecordRef.current=openRecord;
 const closeWindow=id=>setWindows(prev=>prev.filter(w=>w.id!==id));
 const frontWindow=id=>setWindows(prev=>{zTop.current+=1;return prev.map(w=>w.id===id?{...w,z:zTop.current}:w)});
 const moveWindow=(id,x,y)=>setWindows(prev=>prev.map(w=>w.id===id?{...w,x:Math.max(4,Math.min(x,window.innerWidth-w.width-4)),y:Math.max(50,Math.min(y,window.innerHeight-w.height-45))}:w));
 const resizeWindow=(id,width,height)=>setWindows(prev=>prev.map(w=>w.id===id?{...w,width:Math.min(width,window.innerWidth-8),height:Math.min(height,window.innerHeight-65)}:w));

 useEffect(()=>{
  const el=host.current;if(!el)return;
  let renderer,scene,camera,raf,resizeObserver;
  const disposables=[];
  const labels=new Map();
  let dragging=false,lastX=0,lastY=0,velocityX=0,velocityY=0,targetZoom=1,currentZoom=1,downX=0,downY=0;
  const root=new THREE.Group(),surface=new THREE.Group(),graph=new THREE.Group(),orbits=new THREE.Group();
  const nodeObjects=[],edgeObjects=[],recordObjects=[],raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let selectedId=null;
  try{
   scene=new THREE.Scene();scene.background=new THREE.Color(0x020403);
   camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(0,0,10.7);
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
   el.prepend(renderer.domElement);scene.add(root);root.add(surface,graph,orbits);
   scene.add(new THREE.AmbientLight(0xc8d9c5,.55));
   const key=new THREE.PointLight(0xc9ff9b,7,22);key.position.set(1.8,2.5,5);scene.add(key);
   const rim=new THREE.PointLight(0x5b9fff,3,20);rim.position.set(-4,-2,-4);scene.add(rim);
   const coreLight=new THREE.PointLight(0xbaff87,2.5,8);coreLight.position.set(0,0,0);scene.add(coreLight);
   // The network is intentionally volumetric: no enclosing point-cloud shell. The nodes and their links define the form.

   // Bright central nucleus with layered translucent shells.
   const core=new THREE.Group();surface.add(core);
   const coreBall=new THREE.Mesh(new THREE.IcosahedronGeometry(.31,3),new THREE.MeshBasicMaterial({color:0xe1ffd1}));core.add(coreBall);
   [[.48,.055,.18],[.72,.025,.085],[1.05,.012,.035]].forEach(([r,t,o],i)=>{const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,2),new THREE.MeshBasicMaterial({color:i===0?0xc9ff78:0x9fd6a2,wireframe:true,transparent:true,opacity:o,depthWrite:false}));core.add(m);});
   // No decorative latitude or longitude rings: spatial depth comes from the graph itself.

   // Background stars: many tiny, low-contrast points with a gentle drift.
   const starN=1900,starPos=new Float32Array(starN*3);for(let i=0;i<starN;i++){const rr=12+Math.random()*22,a=Math.random()*Math.PI*2,z=(Math.random()-.5)*26;starPos.set([Math.cos(a)*rr,Math.sin(a)*rr,z],i*3)}
   const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));const starMat=new THREE.PointsMaterial({color:0xc8e7cf,size:.022,transparent:true,opacity:.68,depthWrite:false});scene.add(new THREE.Points(starGeo,starMat));disposables.push(starGeo,starMat);
   // Business nodes distributed around the spherical surface.
   const clusterLayout=[
    [-2.55,1.15,.35],[-.95,.35,1.95],[1.25,1.45,.65],[2.55,.25,-.55],
    [1.75,-1.35,1.05],[-.35,-1.95,.25],[-2.15,-1.15,-.85],[-.15,.65,-2.15],
    [1.05,-.45,-1.8],[-1.35,1.65,-1.25]
   ];
   const nodeVectors=DIRECTIONS.map((d,i)=>new THREE.Vector3(...clusterLayout[i]));
   DIRECTIONS.forEach((d,i)=>{
    const group=new THREE.Group();group.position.copy(nodeVectors[i]);graph.add(group);
    const color=new THREE.Color(d.color);
    const halo=new THREE.Mesh(new THREE.SphereGeometry(.19,20,20),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.13,depthWrite:false}));
    const body=new THREE.Mesh(new THREE.IcosahedronGeometry(.075,2),new THREE.MeshBasicMaterial({color}));
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.135,.006,5,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.78}));
    ring.rotation.set(.5+i*.27,.8-i*.16,.2);
    group.add(halo,body,ring);group.userData.directionId=d.id;
    nodeObjects.push({id:d.id,index:i,group,halo,body,ring,color});
    const label=document.createElement('button');label.type='button';label.className='u4-label';label.style.setProperty('--c',d.color);label.innerHTML='<b>'+d.name+'</b><small>'+d.metric+'</small>';label.addEventListener('click',()=>{selectedId=d.id;setSelected(d.id);});el.querySelector('.u4-labels').appendChild(label);labels.set(d.id,label);
   });

   // Every inner point is a real trial record. Zoom reveals the operating layer rather than an empty cloud.
   const recordPositions=new Map();
   TRIAL_RECORDS.forEach((record,index)=>{
     const di=DIRECTIONS.findIndex(d=>d.id===record.directionId);
     const center=nodeVectors[di];
     const base=center.clone().normalize();
     const tangent=new THREE.Vector3(-base.z*.82, seeded(index+31)-.5, base.x*.82).normalize();
     const tangent2=base.clone().cross(tangent).normalize();
     const theta=seeded(index+17)*Math.PI*2;
     const spread=.16+seeded(index+80)*.58;
     const depth=(seeded(index+91)-.5)*.72;
     const p=center.clone()
       .add(tangent.clone().multiplyScalar(Math.cos(theta)*spread))
       .add(tangent2.clone().multiplyScalar(Math.sin(theta)*spread))
       .add(base.clone().multiplyScalar(depth));
     recordPositions.set(record.id,p);
     const g=new THREE.Group();g.position.copy(p);g.userData={recordId:record.id,kind:'record'};graph.add(g);
     const color=new THREE.Color(DIRECTIONS[di].color);
     const body=new THREE.Mesh(new THREE.SphereGeometry(.052+(index%3)*.009,10,10),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92}));
     const halo=new THREE.Mesh(new THREE.SphereGeometry(.105,10,10),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.055,depthWrite:false}));
     g.add(halo,body);
     recordObjects.push({record,g,body,halo});
   });
   // Direction-to-record traces. They become denser as the user moves into the data layer.
   TRIAL_RECORDS.forEach((record,index)=>{
     if(index%3!==0)return;
     const di=DIRECTIONS.findIndex(d=>d.id===record.directionId);
     const curve=makeCurve(nodeVectors[di],recordPositions.get(record.id),index+80,3.2);
     const geo=new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
     const mat=new THREE.LineBasicMaterial({color:new THREE.Color(DIRECTIONS[di].color),transparent:true,opacity:.095,depthWrite:false});
     graph.add(new THREE.Line(geo,mat));disposables.push(geo,mat);
   });

   // Curved 3D relationships, with multiple light traces per business connection.
   EDGES.forEach(([ai,bi],i)=>{
    const a=nodeVectors[ai],b=nodeVectors[bi],curve=makeCurve(a,b,i,3.18),points=curve.getPoints(72);
    const geo=new THREE.BufferGeometry().setFromPoints(points);
    const lineMat=new THREE.LineBasicMaterial({color:0x91b49a,transparent:true,opacity:.22,depthWrite:false});
    const line=new THREE.Line(geo,lineMat);graph.add(line);
    const glowGeo=new THREE.TubeGeometry(curve,72,.018,5,false),glowMat=new THREE.MeshBasicMaterial({color:0x9dff8c,transparent:true,opacity:.018,depthWrite:false,blending:THREE.AdditiveBlending});graph.add(new THREE.Mesh(glowGeo,glowMat));
    const particles=[];
    for(let k=0;k<2;k++){const p=new THREE.Mesh(new THREE.SphereGeometry(.027,10,10),new THREE.MeshBasicMaterial({color:k===0?0xd9ffd0:0xa8d9ff,transparent:true,opacity:.95}));graph.add(p);particles.push(p)}
    edgeObjects.push({ai,bi,curve,lineMat,particles});disposables.push(geo,lineMat,glowGeo,glowMat);
   });
   // Relationships are carried by the explicit curved edges and record traces.

   const onDown=e=>{if(e.target.closest('.u4-label,.u4-controls,.u4-window'))return;dragging=true;lastX=e.clientX;lastY=e.clientY;downX=e.clientX;downY=e.clientY;el.setPointerCapture?.(e.pointerId)};
   const onMove=e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;root.rotation.y+=dx*.006;root.rotation.x=Math.max(-1.25,Math.min(1.25,root.rotation.x+dy*.006));velocityX=dx*.0008;velocityY=dy*.0008;lastX=e.clientX;lastY=e.clientY};
   const onUp=e=>{if(!dragging)return;const moved=Math.hypot(e.clientX-downX,e.clientY-downY);dragging=false;if(moved>6)return;const rect=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;root.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(recordObjects.map(x=>x.body),false)[0];if(hit){const item=recordObjects.find(x=>x.body===hit.object);if(item){selectedId=item.record.directionId;setSelected(item.record.directionId);openRecordRef.current?.(item.record)}}};
   const onWheel=e=>{e.preventDefault();targetZoom=THREE.MathUtils.clamp(targetZoom+(e.deltaY<0?.16:-.16),.48,3.1);setZoom(Math.round(targetZoom*100))};
   const onResize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};
   el.addEventListener('pointerdown',onDown);el.addEventListener('pointermove',onMove);el.addEventListener('pointerup',onUp);el.addEventListener('pointercancel',onUp);el.addEventListener('wheel',onWheel,{passive:false});window.addEventListener('resize',onResize);
   const zoomIn=()=>{targetZoom=Math.min(3.1,targetZoom+.2);setZoom(Math.round(targetZoom*100))},zoomOut=()=>{targetZoom=Math.max(.48,targetZoom-.2);setZoom(Math.round(targetZoom*100))};
   el.querySelector('[data-zoom-in]').addEventListener('click',zoomIn);el.querySelector('[data-zoom-out]').addEventListener('click',zoomOut);el.querySelector('[data-zoom-reset]').addEventListener('click',()=>{targetZoom=1;setZoom(100)});
   const clock=new THREE.Clock();
   const animate=()=>{raf=requestAnimationFrame(animate);const t=clock.getElapsedTime(),dt=Math.min(clock.getDelta(),.04);shellMat.uniforms.uTime.value=t;currentZoom+=(targetZoom-currentZoom)*(1-Math.exp(-dt*4.5));camera.position.z=10.7/currentZoom;
    if(!dragging){root.rotation.y+=velocityX;root.rotation.x+=velocityY;velocityX*=.94;velocityY*=.94;if(Math.abs(velocityX)<.00001)velocityX=0;if(Math.abs(velocityY)<.00001)velocityY=0;root.rotation.y+=dt*.012}
    orbits.rotation.y=t*.018;orbits.rotation.z=Math.sin(t*.12)*.025;core.rotation.y=t*.13;core.rotation.x=Math.sin(t*.4)*.08;
    nodeObjects.forEach((n,i)=>{const pulse=1+Math.sin(t*1.4+i*.8)*.045;n.group.scale.setScalar(pulse);n.ring.rotation.z=t*.16+i;});
    edgeObjects.forEach((edge,i)=>{edge.particles.forEach((p,k)=>p.position.copy(edge.curve.getPointAt((t*.045+k*.5+i*.07)%1)));});
    root.updateMatrixWorld(true);
    nodeObjects.forEach(n=>{const p=n.group.getWorldPosition(new THREE.Vector3()).project(camera);const label=labels.get(n.id);label.style.left=((p.x*.5+.5)*el.clientWidth)+'px';label.style.top=((-p.y*.5+.5)*el.clientHeight)+'px';label.style.opacity=p.z<.98&&p.z>-.98?String(Math.max(.16,1-Math.max(0,p.z)*.55)):'0';label.classList.toggle('active',selectedId===n.id)});
    renderer.render(scene,camera);
   };
   onResize();animate();
   return ()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',onResize);el.removeEventListener('pointerdown',onDown);el.removeEventListener('pointermove',onMove);el.removeEventListener('pointerup',onUp);el.removeEventListener('pointercancel',onUp);el.removeEventListener('wheel',onWheel);labels.forEach(x=>x.remove());el.querySelector('[data-zoom-in]')?.removeEventListener('click',zoomIn);el.querySelector('[data-zoom-out]')?.removeEventListener('click',zoomOut);renderer.dispose();disposables.forEach(x=>x.dispose?.());scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())});renderer.domElement.remove()};
  }catch(error){console.error('Universe 4 renderer failed',error);if(renderer){renderer.dispose();renderer.domElement.remove()}}
 },[]);
 const active=DIRECTIONS.find(x=>x.id===selected);
 return <main className="u4" ref={host}>
  <style>{css}</style><div className="u4-head"><div className="u4-kicker">BUSINESS UNIVERSE</div><div className="u4-sub">NIFINANCE · INTERACTIVE SYSTEM</div></div>
  <div className="u4-live"><i/>DATA MODEL · 240 RECORDS</div><div className="u4-labels"/>
  {active&&<div className="u4-selection" style={{'--c':active.color}}><strong>{active.name.toUpperCase()}</strong><span>{active.metric.toUpperCase()}</span></div>}
  <div className="u4-hint">DRAG TO ROTATE · SCROLL TO EXPLORE · CLICK DATA POINTS</div>
  <div className="u4-controls"><button type="button" data-zoom-out aria-label="Zoom out">−</button><span>{zoom}%</span><button type="button" data-zoom-in aria-label="Zoom in">+</button><button type="button" data-zoom-reset aria-label="Reset zoom">↺</button></div>
 <div className="u4-windows">{windows.map(w=><DataWindow key={w.id} win={w} onClose={closeWindow} onFront={frontWindow} onMove={moveWindow} onResize={resizeWindow}/>)}</div></main>;
}

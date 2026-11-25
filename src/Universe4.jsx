import React, { useEffect, useRef, useState } from 'react';
import AppNavigation from './AppNavigation.jsx';

const DIRECTIONS = [
 {id:'marketing',name:'Marketing',color:'#ff9f43',metric:'Demand generation',items:['Brand','Traffic','Content','Advertising','SEO','Analytics']},
 {id:'sales',name:'Sales',color:'#4dd4ac',metric:'Commercial conversion',items:['Leads','CRM','Sales funnel','Average check','Repeat sales','Sales team']},
 {id:'production',name:'Production',color:'#5aa9ff',metric:'Service delivery',items:['Raw materials','Capacity','Quality','Defects','Inventory']},
 {id:'finance',name:'Finance',color:'#f5d547',metric:'Capital & performance',items:['Revenue','Margin','Cash flow','Budget','Debt','Taxes']},
 {id:'people',name:'People',color:'#ff6b8a',metric:'Team & organisation',items:['Hiring','Training','Motivation','Turnover','Managers']},
 {id:'product',name:'Product',color:'#b58cff',metric:'Product & customer value',items:['Assortment','Price','Positioning','Service','Reviews']},
 {id:'operations',name:'Operations',color:'#7ee0ff',metric:'Operational flow',items:['Processes','Suppliers','Delivery','Automation','Regulations']},
 {id:'strategy',name:'Strategy',color:'#d0d0e0',metric:'Direction & investment',items:['Goals','Market','Competitors','Risks','Investments']}
];
const LINKS = [['Traffic','Leads'],['Leads','Sales funnel'],['Sales funnel','Revenue'],['Revenue','Margin'],['Raw materials','Margin'],['Defects','Margin'],['Quality','Reviews'],['Reviews','Brand'],['Brand','Traffic'],['Price','Average check'],['Average check','Revenue'],['Hiring','Capacity'],['Motivation','Sales team'],['Sales team','Sales funnel'],['Suppliers','Raw materials'],['Capacity','Inventory'],['Inventory','Delivery'],['Cash flow','Budget'],['Budget','Advertising'],['Automation','Processes'],['Processes','Quality'],['Training','Quality'],['Turnover','Hiring'],['Repeat sales','Revenue'],['Assortment','Capacity'],['Service','Repeat sales'],['Analytics','Budget'],['Content','SEO'],['SEO','Traffic'],['Advertising','Traffic'],['Positioning','Brand'],['Regulations','Processes'],['Taxes','Cash flow'],['Debt','Cash flow'],['Managers','Motivation'],['Market','Positioning'],['Goals','Budget'],['Investments','Capacity'],['Competitors','Price'],['Risks','Investments'],['CRM','Analytics'],['Revenue','Cash flow']];
const TRIAL_RECORDS = [];

function DataWindow({win,onClose,onFront,onMove,onResize}){
  const drag=useRef(null), resize=useRef(null);
  const move=e=>{if(!drag.current)return;onMove(win.id,drag.current.left+e.clientX-drag.current.x,drag.current.top+e.clientY-drag.current.y)};
  const rmove=e=>{if(!resize.current)return;onResize(win.id,resize.current.width+e.clientX-resize.current.x,resize.current.height+e.clientY-resize.current.y)};
  const end=()=>{drag.current=null;resize.current=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointermove',rmove);window.removeEventListener('pointerup',end)};
  const startDrag=e=>{e.preventDefault();onFront(win.id);drag.current={x:e.clientX,y:e.clientY,left:win.x,top:win.y};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end)};
  const startResize=e=>{e.preventDefault();e.stopPropagation();onFront(win.id);resize.current={x:e.clientX,y:e.clientY,width:win.width,height:win.height};window.addEventListener('pointermove',rmove);window.addEventListener('pointerup',end)};
  const r=win.record, d=DIRECTIONS.find(x=>x.id===r.directionId)||DIRECTIONS[0];
  const amount=r.amount===null||r.amount===undefined||r.amount===''?null:Number(r.amount);
  return <section className="u4-window" style={{left:win.x,top:win.y,width:win.width,height:win.height,zIndex:win.z,'--c':d.color}}>
    <header className="u4-window-head" onPointerDown={startDrag}><i className="u4-window-dot"/><div className="u4-window-title"><b>{r.title}</b><small>{r.type.toUpperCase()} · {r.reference}</small></div><button className="u4-window-close" onPointerDown={e=>e.stopPropagation()} onClick={()=>onClose(win.id)}>×</button></header>
    <div className="u4-window-body"><div className="u4-window-kpi"><span>{r.direction.toUpperCase()} · {r.status.toUpperCase()}</span><strong>{Number.isFinite(amount)?amount.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(r.currency||''):String(r.meta?.status||r.meta?.stage||r.status||'RECORD').toUpperCase()}</strong></div>
      <div className="u4-row"><b>Type</b><span>{r.type}</span></div><div className="u4-row"><b>Date</b><span>{r.date||'—'}</span></div><div className="u4-row"><b>Counterparty</b><span>{r.counterparty||'—'}</span></div><div className="u4-row"><b>Category</b><span>{r.meta?.category||'—'}</span></div><div className="u4-row"><b>Reference</b><span>{r.reference||'—'}</span></div><div className="u4-row"><b>Status</b><span>{r.status||r.meta?.status||r.meta?.stage||'—'}</span></div>
      <p className="u4-note">{r.description||JSON.stringify(r.meta||{})}</p><p className="u4-note">LIVE WORKSPACE DATA · details are loaded from the authenticated Neon workspace.</p>
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
.u4{background:radial-gradient(ellipse at 50% 45%,#10101a,#07070b 70%);color:#9a9aae;font:11px/1.4 ui-monospace,Menlo,Consolas,monospace}
.u4:before{display:none}
.u4 .u4-network-canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab}
.u4-head{z-index:3;top:14px;left:18px}.u4-kicker{color:#c9c9d6;letter-spacing:.08em}.u4-sub{display:none}
.u4-live{top:14px;right:18px;color:#6c6c80;letter-spacing:.04em}
.u4-live i{background:#6c6c80;box-shadow:none}
.u4-legend{position:absolute;z-index:4;left:14px;top:44px;width:190px;max-height:calc(100% - 100px);overflow:auto;background:rgba(14,14,22,.78);border:1px solid #23232f;border-radius:8px;padding:6px;backdrop-filter:blur(6px)}
.u4-legend button{width:100%;display:flex;align-items:center;gap:8px;padding:5px 7px;border:0;border-radius:5px;background:transparent;cursor:pointer;color:#8a8a9e;text-align:left;font:11px ui-monospace,Menlo,monospace}
.u4-legend button:hover,.u4-legend button.on{background:#25253a;color:#fff}
.u4-legend i{width:8px;height:8px;border-radius:50%;flex:none;background:var(--c);box-shadow:0 0 8px var(--c)}
.u4-legend b{margin-left:auto;font-weight:400;color:#555568}
.u4-hint{left:18px;bottom:12px;color:#555568;letter-spacing:0}
.u4-selection{display:none}
.u4-controls{display:none}
@media(max-width:700px){.u4-legend{width:150px;left:8px;top:42px;padding:4px}.u4-legend button{font-size:9px;padding:4px 5px}.u4-live{font-size:7px;right:10px;top:13px}.u4-head{top:12px;left:12px}.u4-kicker{font-size:8px}.u4-hint{left:10px;bottom:8px;font-size:6px}}

.u4-core-trigger{position:absolute;z-index:8;right:18px;top:42px;padding:7px 10px;border:1px solid #77778a55;border-radius:5px;background:rgba(14,14,22,.82);color:#d5d5e2;font:9px ui-monospace,monospace;letter-spacing:.08em;cursor:pointer;backdrop-filter:blur(8px)}
.u4-core-trigger:hover{background:#25253a;border-color:#aaaacb}
.u4-core-panel{position:absolute;z-index:16;right:18px;top:76px;width:min(420px,calc(100vw - 36px));max-height:calc(100% - 110px);overflow:auto;padding:14px;border:1px solid #343444;border-radius:8px;background:rgba(10,10,17,.96);box-shadow:0 18px 60px #000b;backdrop-filter:blur(14px);color:#bfc0d0}
.u4-core-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid #ffffff18}
.u4-core-head b{font:600 10px ui-monospace,monospace;letter-spacing:.12em;color:#f1f1fa}
.u4-core-head button{border:0;background:transparent;color:#aaa;font-size:18px;cursor:pointer}
.u4-core-sub{margin:8px 0 12px;color:#737388;font:8px ui-monospace,monospace}
.u4-core-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.u4-core-kpi{padding:9px;border:1px solid #ffffff12;border-radius:5px;background:#ffffff06}
.u4-core-kpi small{display:block;color:#77778d;font:8px ui-monospace,monospace}
.u4-core-kpi strong{display:block;margin-top:5px;color:#e5e5ef;font:600 13px ui-monospace,monospace;overflow-wrap:anywhere}
.u4-core-section{margin-top:14px}
.u4-core-section h4{margin:0 0 7px;color:#a8a8bd;font:600 8px ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}
.u4-core-item{padding:8px 0;border-top:1px solid #ffffff10}
.u4-core-item b{display:block;color:#e0e0eb;font:600 9px ui-monospace,monospace}
.u4-core-item p{margin:4px 0 0;color:#89899d;font:9px/1.5 ui-monospace,monospace}
.u4-core-loading,.u4-core-error{padding:16px 4px;color:#a3a3b8;font:9px ui-monospace,monospace}
.u4-core-error{color:#ff9b9b}
@media(max-width:700px){.u4-core-trigger{right:8px;top:36px;padding:6px 7px;font-size:7px}.u4-core-panel{right:5vw;top:68px;width:90vw;max-height:calc(100% - 85px);padding:10px}}

`;

export default function Universe4(){
 const host=useRef(null),[selected,setSelected]=useState(null),[zoom,setZoom]=useState(100),[windows,setWindows]=useState([]),zTop=useRef(20),openRecordRef=useRef(null);
 const [coreOpen,setCoreOpen]=useState(false),[coreData,setCoreData]=useState(null),[coreLoading,setCoreLoading]=useState(false),[coreError,setCoreError]=useState('');
 const loadCore=async()=>{
  setCoreLoading(true);setCoreError('');
  try{
   const credentials=JSON.parse(localStorage.getItem('nifinance-data-center-credentials-v1')||'null');
   if(!credentials?.workspaceId||!credentials?.token)throw new Error('Open Data Center first to connect a Neon workspace.');
   const response=await fetch('/api/universe-core',{method:'POST',headers:{'Content-Type':'application/json','X-Workspace-Id':credentials.workspaceId,'X-Workspace-Token':credentials.token},body:JSON.stringify({})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Core analysis is unavailable');
   setCoreData(result);
  }catch(error){setCoreError(error.message||'Could not load analysis');}
  finally{setCoreLoading(false);}
 };

 
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
  const canvas=document.createElement('canvas');canvas.className='u4-network-canvas';el.prepend(canvas);
  const ctx=canvas.getContext('2d');let W=0,H=0,dpr=1,F=1,raf=0,t0=0;
  let seed=7;const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const gauss=()=>(rnd()+rnd()+rnd()-1.5)*1.4;
  const nodes=[],edges=[],byName={},recordForNode=new Map();
  DIRECTIONS.forEach((d,i)=>{
   const k=(i+.5)/DIRECTIONS.length,phi=Math.acos(1-2*k),th=i*2.4;
   d.p={x:270*Math.sin(phi)*Math.cos(th),y:210*Math.cos(phi),z:270*Math.sin(phi)*Math.sin(th)};
   d.hub={dir:i,hub:1,name:d.name,r:6,...d.p,out:[],inn:[]};nodes.push(d.hub);
   d.items.forEach((name,j)=>{
    const nd={dir:i,name,r:3.6,x:d.p.x+gauss()*85,y:d.p.y+gauss()*85,z:d.p.z+gauss()*85,out:[],inn:[]};
    nodes.push(nd);byName[name]=nd;edges.push({a:d.hub,b:nd,t:0});
   });
   const its=nodes.filter(n=>n.dir===i&&!n.hub);
   for(let j=0;j<46;j++){const nd={dir:i,dust:1,r:1+rnd()*1.2,x:d.p.x+gauss()*95,y:d.p.y+gauss()*95,z:d.p.z+gauss()*95};nodes.push(nd);if(rnd()<.6)edges.push({a:its[(rnd()*its.length)|0],b:nd,t:1})}
  });
  const deps=[];LINKS.forEach(([a,b])=>{const A=byName[a],B=byName[b];if(!A||!B)return;const e={a:A,b:B,t:2,ph:rnd()};edges.push(e);deps.push(e);A.out.push(B);B.inn.push(A)});
  const named=nodes.filter(n=>!n.dust);
  const status=el.querySelector('.u4-live');
  let graphCancelled=false;
  const loadBusinessGraph=async()=>{
   try{
    const credentials=JSON.parse(localStorage.getItem('nifinance-data-center-credentials-v1')||'null');
    if(!credentials?.workspaceId||!credentials?.token){if(status)status.innerHTML='<i></i>OPEN DATA CENTER TO CONNECT NEON';return}
    const response=await fetch('/api/universe-graph',{headers:{'X-Workspace-Id':credentials.workspaceId,'X-Workspace-Token':credentials.token}});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Could not load business graph');
    if(graphCancelled)return;
    const apiNodeMap=new Map();
    const directionIndex=item=>{
     const meta=item.meta||{},text=[item.label,meta.category,meta.counterparty,meta.kind,(meta.roles||[]).join(' ')].join(' ').toLowerCase();
     if(item.type==='contact'||item.type==='deal')return 1;
     if(item.type==='counterparty')return /client|customer|lead/.test(text)?1:6;
     if(item.type==='category')return 3;
     if(item.type==='task'||item.type==='channel')return 6;
     if(item.type==='finding')return 7;
     if(/campaign|advert|seo|marketing|content/.test(text))return 0;
     if(/salary|payroll|employee|hiring/.test(text))return 4;
     if(/supplier|delivery|inventory|purchase/.test(text))return 6;
     if(/sales|client|customer|revenue|invoice/.test(text))return 1;
     return 3;
    };
    (data.nodes||[]).forEach(item=>{
     const dirIndex=directionIndex(item),center=DIRECTIONS[dirIndex].p,meta=item.meta||{};
     const node={dir:dirIndex,name:item.label||item.type,r:item.type==='transaction'?3.2:item.type==='finding'?4.2:3.7,
      x:center.x+gauss()*52,y:center.y+gauss()*52,z:center.z+gauss()*52,out:[],inn:[],apiId:item.id,apiType:item.type,meta};
     nodes.push(node);named.push(node);apiNodeMap.set(item.id,node);
     recordForNode.set(node,{id:item.id,directionId:DIRECTIONS[dirIndex].id,direction:DIRECTIONS[dirIndex].name,title:item.label||item.type,
      type:item.type,date:meta.date||null,amount:meta.amount??null,currency:meta.currency||'',counterparty:meta.counterparty||meta.company||'',
      reference:meta.reference||meta.transactionKey||item.id,status:meta.status||meta.stage||'',description:meta.description||meta.email||meta.findingType||'Workspace business object loaded from Neon.',meta});
    });
    (data.edges||[]).forEach(item=>{
     const a=apiNodeMap.get(item.from),b=apiNodeMap.get(item.to);if(!a||!b)return;
     edges.push({a,b,t:2,ph:rnd(),kind:item.kind,label:item.label});a.out.push(b);b.inn.push(a);
    });
    const transactionCount=Number(data.summary?.transactions||0),crmCount=Number(data.summary?.contacts||0)+Number(data.summary?.deals||0);
    if(status)status.innerHTML='<i></i>NEON LIVE · '+transactionCount+' TRANSACTIONS · '+crmCount+' CRM OBJECTS · '+(data.edges||[]).length+' DATA LINKS';
    if(!data.nodes?.length&&status)status.innerHTML='<i></i>NEON CONNECTED · NO BUSINESS RECORDS YET';
   }catch(error){if(!graphCancelled&&status)status.innerHTML='<i></i>NEON DATA UNAVAILABLE · '+String(error.message||'API ERROR').slice(0,70)}
  };
   if(status)status.innerHTML='<i></i>'+DIRECTIONS.length+' DIRECTIONS · '+named.filter(n=>!n.hub).length+' MODEL ELEMENTS · '+deps.length+' MODEL LINKS';
   loadBusinessGraph();
  const legend=document.createElement('div');legend.className='u4-legend';el.appendChild(legend);
  let yaw=.4,pitch=.25,D=720,Dt=720,T={x:0,y:0,z:0},Tt={x:0,y:0,z:0},drag=null,idle=0,sel=null,hov=null,focus=-1,mx=-1,my=-1;
  DIRECTIONS.forEach((d,i)=>{const item=document.createElement('button');item.type='button';item.innerHTML='<i style="--c:'+d.color+'"></i><span>'+d.name+'</span><b>'+d.items.length+'</b>';item.addEventListener('click',()=>{sel=null;if(focus===i){focus=-1;Tt={x:0,y:0,z:0};Dt=720}else{focus=i;Tt={...d.p};Dt=330}Array.from(legend.children).forEach((x,j)=>x.classList.toggle('on',j===focus))});legend.appendChild(item)});
  function resize(){const r=el.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);W=r.width;H=r.height;canvas.width=Math.max(1,Math.round(W*dpr));canvas.height=Math.max(1,Math.round(H*dpr));canvas.style.width='100%';canvas.style.height='100%';ctx.setTransform(dpr,0,0,dpr,0,0);F=Math.min(W*.9,H*1.25)}
  const ro=new ResizeObserver(resize);ro.observe(el);resize();
  function proj(p){const x=p.x-T.x,y=p.y-T.y,z=p.z-T.z,cx=Math.cos(yaw),sx=Math.sin(yaw),x1=x*cx+z*sx,z1=-x*sx+z*cx,cp=Math.cos(pitch),sp=Math.sin(pitch),y2=y*cp-z1*sp,z2=y*sp+z1*cp+D;if(z2<30)return null;const k=F/z2;return{x:W/2+x1*k,y:H/2+y2*k,k,z:z2,f:Math.max(.18,Math.min(1,1-(z2-D+260)/850))}}
  const rgba=(h,a)=>{const n=parseInt(h.slice(1),16);return'rgba('+(n>>16)+','+(n>>8&255)+','+(n&255)+','+Math.max(0,Math.min(1,a))+')'};
  function pill(txt,x,y,c,alpha,big){ctx.font=(big?'11':'10')+'px ui-monospace,Menlo,monospace';const w=ctx.measureText(txt).width+14,h=big?20:17;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x-w/2,y-h/2,w,h,h/2);else ctx.rect(x-w/2,y-h/2,w,h);ctx.fillStyle='rgba(10,10,16,'+(.8*alpha)+')';ctx.fill();ctx.strokeStyle=rgba(c,.7*alpha);ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=rgba('#ffffff',.92*alpha);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,x,y+.5)}
  function frame(ts){const dt=Math.min(.05,(ts-t0)/1000||.016);t0=ts;T.x+=(Tt.x-T.x)*.06;T.y+=(Tt.y-T.y)*.06;T.z+=(Tt.z-T.z)*.06;D+=(Dt-D)*.06;if(!drag){idle+=dt;if(idle>2)yaw+=dt*.07}ctx.clearRect(0,0,W,H);
   const P=new Map();nodes.forEach(n=>P.set(n,proj(n)));const rel=n=>!sel||n===sel||sel.out.includes(n)||sel.inn.includes(n);const live=n=>(focus<0||n.dir===focus)&&rel(n);
   edges.forEach(e=>{const a=P.get(e.a),b=P.get(e.b);if(!a||!b)return;const c=DIRECTIONS[e.a.dir].color,f=(a.f+b.f)/2,lit=live(e.a)&&live(e.b);let al=e.t===2?.28:e.t===0?.2:.08;if(sel&&e.t===2&&(e.a===sel||e.b===sel))al=.95;else if(!lit)al*=.25;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=rgba(e.t===2?'#ffffff':c,al*f);ctx.lineWidth=e.t===2?(al>.5?1.6:.8):.6;ctx.stroke();if(e.t===2&&(lit||al>.5)){const u=(ts/2600+e.ph)%1,px=a.x+(b.x-a.x)*u,py=a.y+(b.y-a.y)*u;ctx.beginPath();ctx.arc(px,py,al>.5?2.6:1.6,0,7);ctx.fillStyle=rgba(DIRECTIONS[e.b.dir].color,(al>.5?1:.7)*f);ctx.fill()}});
   const vis=nodes.filter(n=>P.get(n)).sort((u,v)=>P.get(v).z-P.get(u).z);vis.forEach(n=>{const p=P.get(n),c=DIRECTIONS[n.dir].color,al=(live(n)?1:.2)*p.f,r=Math.max(.6,n.r*p.k*1.1);if(!n.dust){const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*4);g.addColorStop(0,rgba(c,.35*al));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,r*4,0,7);ctx.fill()}ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fillStyle=n.dust?rgba('#cfd6ee',.5*al):rgba(c,al);ctx.fill()});
   hov=null;let best=14;named.forEach(n=>{const p=P.get(n);if(!p)return;const d=Math.hypot(p.x-mx,p.y-my);if(d<Math.max(best,n.r*p.k*2)&&live(n)){best=d;hov=n}});canvas.style.cursor=hov?'pointer':drag?'grabbing':'grab';
   named.forEach(n=>{const p=P.get(n);if(!p)return;const c=DIRECTIONS[n.dir].color,show=n.hub?(focus<0||focus===n.dir)&&!sel||n===sel:(D<420||n===hov||n===sel||(sel&&rel(n))||focus===n.dir);if(!show||!live(n)&&n!==sel)return;pill(n.name,p.x,p.y-(n.hub?16:12),c,Math.min(1,p.f+.2),n.hub)});
   if(sel){const p=P.get(sel);if(p){const c=DIRECTIONS[sel.dir].color,R=16+Math.sin(ts/400)*1.5,a0=ts/700;ctx.lineWidth=2.5;[[0,1.6,c],[2.4,3.3,'#ffffff'],[4,5,c]].forEach(([s0,s1,col])=>{ctx.beginPath();ctx.arc(p.x,p.y,R,a0+s0,a0+s1);ctx.strokeStyle=rgba(col,.9);ctx.stroke()});ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,R+7,0,7);ctx.strokeStyle=rgba(c,.25);ctx.stroke();const l1=sel.hub?'direction':DIRECTIONS[sel.dir].name,l2='influences: '+(sel.out.map(x=>x.name).join(', ')||'—'),l3='depends on: '+(sel.inn.map(x=>x.name).join(', ')||'—');ctx.font='10px ui-monospace,Menlo,monospace';const w=Math.min(300,Math.max(ctx.measureText(l2).width,ctx.measureText(l3).width,110)+22),bx=Math.min(W-w-12,p.x+26),by=Math.min(H-80,p.y+20);ctx.fillStyle='rgba(10,10,16,.88)';ctx.strokeStyle=rgba(c,.6);ctx.lineWidth=1;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(bx,by,w,62,7);else ctx.rect(bx,by,w,62);ctx.fill();ctx.stroke();ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='bold 11px ui-monospace,Menlo,monospace';ctx.fillText(sel.name,bx+10,by+14);ctx.font='10px ui-monospace,Menlo,monospace';ctx.fillStyle=rgba(c,1);ctx.fillText(l1,bx+10,by+28);ctx.fillStyle='#9a9aae';ctx.fillText(l2.slice(0,44),bx+10,by+42);ctx.fillText(l3.slice(0,44),bx+10,by+55)}}
   raf=requestAnimationFrame(frame)
  }
  const pos=e=>{const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
  const onDown=e=>{canvas.setPointerCapture(e.pointerId);[mx,my]=pos(e);drag={x:mx,y:my,moved:0};idle=0};
  const onMove=e=>{const[x,y]=pos(e);if(drag){const dx=x-mx,dy=y-my;drag.moved+=Math.abs(dx)+Math.abs(dy);yaw+=dx*.006;pitch=Math.max(-1.3,Math.min(1.3,pitch+dy*.006));idle=0}mx=x;my=y};
  const onUp=()=>{if(drag&&drag.moved<5){if(hov){sel=hov;focus=-1;Array.from(legend.children).forEach(c=>c.classList.remove('on'));Tt={x:hov.x,y:hov.y,z:hov.z};Dt=190;const record=recordForNode.get(hov);if(record)openRecordRef.current?.(record)}else if(sel){sel=null;Tt={x:0,y:0,z:0};Dt=720}}drag=null};
  const onLeave=()=>{mx=my=-1};
  const onWheel=e=>{e.preventDefault();Dt=Math.max(90,Math.min(1100,Dt*(1+e.deltaY*.0012)));idle=0};
  canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onUp);canvas.addEventListener('pointerleave',onLeave);canvas.addEventListener('wheel',onWheel,{passive:false});
  raf=requestAnimationFrame(frame);
  return ()=>{graphCancelled=true;cancelAnimationFrame(raf);ro.disconnect();canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onUp);canvas.removeEventListener('pointerleave',onLeave);canvas.removeEventListener('wheel',onWheel);legend.remove();canvas.remove()};
 },[]);
 const active=DIRECTIONS.find(x=>x.id===selected);
   <AppNavigation />
  return <main className="u4" ref={host}>
  <style>{css}</style><div className="u4-head"><div className="u4-kicker">BUSINESS MAP · EVERYTHING IS CONNECTED</div></div>
  <div className="u4-live"><i/>CONNECTING TO NEON</div>
  <button className="u4-core-trigger" type="button" onClick={()=>{const next=!coreOpen;setCoreOpen(next);if(next)loadCore();}}>CORE ANALYSIS ↗</button>
  {coreOpen&&<aside className="u4-core-panel">
   <div className="u4-core-head"><b>UNIVERSE CORE / BUSINESS ANALYSIS</b><button type="button" onClick={()=>setCoreOpen(false)}>×</button></div>
   {coreLoading&&<div className="u4-core-loading">CALCULATING FROM LIVE WORKSPACE DATA…</div>}
   {coreError&&<div className="u4-core-error">{coreError}</div>}
   {coreData?.snapshot&&(()=>{const x=coreData.snapshot,fin=x.finance||{},cash=fin.cash||{},accrual=fin.managementPnl||{},pipe=x.pipeline||{},tasks=x.tasks||{};const money=v=>v===null||v===undefined?'MULTI-CURRENCY':Number(v).toLocaleString('en-GB',{maximumFractionDigits:2});return <><div className="u4-core-sub">{coreData.mode==='ai-assisted'?'AI-ASSISTED ANALYSIS':'DETERMINISTIC ANALYSIS'} · {new Date(x.generatedAt).toLocaleString()}</div>
    <div className="u4-core-grid">
     <div className="u4-core-kpi"><small>CASH INFLOWS</small><strong>{money(cash.inflows)}</strong></div><div className="u4-core-kpi"><small>CASH OUTFLOWS</small><strong>{money(cash.outflows)}</strong></div>
     <div className="u4-core-kpi"><small>NET CASH MOVEMENT</small><strong>{money(cash.netCashMovement)}</strong></div><div className="u4-core-kpi"><small>ACCRUAL RESULT</small><strong>{accrual.status==='provisional'?money(accrual.netResultBeforeValidatedAdjustments):String(accrual.status||'UNAVAILABLE').toUpperCase()}</strong></div>
     <div className="u4-core-kpi"><small>ACTIVE PIPELINE</small><strong>{Number(pipe.activeDealCount||0)} DEALS</strong></div><div className="u4-core-kpi"><small>WEIGHTED PIPELINE</small><strong>{money(pipe.weightedPipelineAmount)}</strong></div>
     <div className="u4-core-kpi"><small>OPEN TASKS</small><strong>{Number(tasks.open||0)}</strong></div><div className="u4-core-kpi"><small>BLOCKED TASKS</small><strong>{Number(tasks.blocked||0)}</strong></div>
    </div>
    <div className="u4-core-section"><h4>Analytical observations</h4>{coreData.briefing?.headline&&<div className="u4-core-item"><b>{coreData.briefing.headline}</b></div>}{(coreData.briefing?.observations||[]).map((o,i)=><div className="u4-core-item" key={i}><b>{o.label} · {o.kind} · {o.confidence}</b><p>{o.evidence}</p></div>)}{!coreData.briefing&&<div className="u4-core-item"><p>AI explanation is not configured; deterministic metrics are available.</p></div>}</div>
    <div className="u4-core-section"><h4>Recommended next steps</h4>{(coreData.briefing?.recommended_next_steps||[]).map((o,i)=><div className="u4-core-item" key={i}><b>{o.priority.toUpperCase()} · {o.action}</b><p>{o.reason} · Approval required</p></div>)}</div>
    <div className="u4-core-section"><h4>Data quality / Alerts</h4>{(fin.alerts||[]).map((o,i)=><div className="u4-core-item" key={i}><b>{o.severity.toUpperCase()} · {o.title}</b><p>{o.explanation}</p></div>)}{(coreData.briefing?.data_gaps||[]).map((o,i)=><div className="u4-core-item" key={'gap'+i}><p>{o}</p></div>)}</div>
    <div className="u4-core-sub">CASH / ACCRUAL ARE KEPT SEPARATE · NO AUTOMATIC FX · HUMAN APPROVAL REQUIRED.</div>
   </>})()}
   <button className="u4-core-trigger" style={{position:'static',marginTop:12}} type="button" onClick={loadCore}>REFRESH ANALYSIS ↻</button>
  </aside>}
  <div className="u4-hint">DRAG TO ROTATE · WHEEL TO ZOOM · CLICK A NODE TO FOCUS / OPEN ITS DATA</div>
  <div className="u4-windows">{windows.map(w=><DataWindow key={w.id} win={w} onClose={closeWindow} onFront={frontWindow} onMove={moveWindow} onResize={resizeWindow}/>)}</div></main>;
}

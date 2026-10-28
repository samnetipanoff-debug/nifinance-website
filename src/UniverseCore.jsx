import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import './universe-core.css';

const metrics = [
 {id:'core',label:'BUSINESS CORE',value:'12.4M ₽',kind:'core',p:[0,0,0],desc:'Операционная прибыль · +12%'},
 {id:'finance',label:'FINANCE',value:'12.4M ₽',p:[-2.7,.25,-.5],desc:'Финансовые показатели и денежные потоки'},
 {id:'marketing',label:'MARKETING',value:'4.2M ₽',p:[-4.1,1.65,-1.5],desc:'Расходы +22% · конверсия требует проверки'},
 {id:'sales',label:'SALES',value:'18.6M ₽',p:[-1.6,2,-1.2],desc:'Выручка +16% · средний чек −12%'},
 {id:'production',label:'OPERATIONS',value:'9.3M ₽',p:[-3.8,-1.4,-1.3],desc:'Себестоимость +8%'},
 {id:'customers',label:'CUSTOMERS',value:'1,284',p:[-.7,-1.6,-1.8],desc:'Активные клиенты · удержание и средний чек'},
 {id:'suppliers',label:'SUPPLIERS',value:'5.4M ₽',p:[1.8,.9,-1.5],desc:'Обязательства +9%'},
 {id:'team',label:'TEAM',value:'6.1M ₽',p:[1.4,-1.5,-1.4],desc:'Фонд оплаты труда +5%'},
 {id:'cash',label:'CASH FLOW',value:'7.8M ₽',p:[3.3,.1,-2],desc:'Движение денежных средств'},
 {id:'risk',label:'RISK SIGNAL',value:'−28%',p:[3.7,1.7,-1.4],desc:'Снижение конверсии из лида в сделку'}
];
const actionNodes = [
 {id:'signal',label:'SIGNAL',value:'Conversion −28%',p:[-3,0,0],kind:'signal',desc:'Маркетинговые расходы растут быстрее числа квалифицированных сделок.'},
 {id:'investigate',label:'INVESTIGATE',value:'3 channels',p:[-.9,1.1,-.4],kind:'step',desc:'Сравнить кампании, CPL, качество лидов и этапы воронки.'},
 {id:'scenario',label:'SCENARIO',value:'−10% spend',p:[1.15,1,-.3],kind:'step',desc:'Смоделировать сокращение неэффективных расходов без изменения бюджета остальных каналов.'},
 {id:'approval',label:'APPROVAL',value:'Needs review',p:[2.8,0,0],kind:'approval',desc:'Перед изменением рекламного бюджета требуется подтверждение ответственного пользователя.'},
 {id:'impact',label:'EXPECTED IMPACT',value:'Estimate pending',p:[1.2,-1.25,-.4],kind:'outcome',desc:'Эффект нельзя достоверно оценить до проверки конверсии и стоимости привлечения.'}
];
const links = [['core','finance'],['finance','marketing'],['finance','sales'],['finance','production'],['sales','customers'],['core','suppliers'],['core','team'],['core','cash'],['marketing','risk'],['risk','sales'],['production','suppliers']];
const actionLinks = [['signal','investigate'],['investigate','scenario'],['scenario','approval'],['scenario','impact'],['signal','impact']];
const colorMap = {core:0x36f2cf,finance:0x41c8ff,marketing:0xb19aff,sales:0x50d5ff,production:0xffa66d,customers:0x73a8ff,suppliers:0xffd47b,team:0x9c9cff,cash:0x45edbb,risk:0xff668f,signal:0xff6e93,step:0x61d8ff,approval:0xffd47b,outcome:0x55e4bd};
export default function UniverseCore(){
 const mount=useRef(null), sceneRef=useRef(null), cameraRef=useRef(null), rendererRef=useRef(null), nodesRef=useRef({}), frameRef=useRef(0), targetRef=useRef(new THREE.Vector3(0,0,0));
 const [mode,setMode]=useState('analytics'), [selected,setSelected]=useState('core'), [period,setPeriod]=useState('MONTH'), [query,setQuery]=useState(''), [command,setCommand]=useState(''), [chat,setChat]=useState([{role:'core',text:'Ядро подключено к демонстрационной модели бизнеса. Выбери узел в пространстве или задай вопрос. Финансовые значения здесь демонстрационные.'}]), [actions,setActions]=useState([]), [showHelp,setShowHelp]=useState(false);
 const data=mode==='analytics'?metrics:actionNodes;
 const chosen=data.find(n=>n.id===selected)||data[0];
 const filtered=useMemo(()=>data.filter(n=>(n.label+' '+n.value+' '+n.desc).toLowerCase().includes(query.toLowerCase())),[data,query]);
 useEffect(()=>{
  const el=mount.current;if(!el)return;
  let renderer,scene,camera,frame,resizeObserver,raycaster,mouse,drag=false,previous={x:0,y:0},pointerDown=null;
  const nodeObjects={}, lineObjects=[];
  try{
   scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x030914,.035);
   camera=new THREE.PerspectiveCamera(48,el.clientWidth/Math.max(el.clientHeight,1),.1,100);camera.position.set(0,1.1,10);
   renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.setSize(el.clientWidth,el.clientHeight);renderer.setClearColor(0x030914,0);renderer.outputColorSpace=THREE.SRGBColorSpace;el.appendChild(renderer.domElement);
   scene.add(new THREE.AmbientLight(0x8bb9dc,1.3));const light=new THREE.PointLight(0x48e9ed,35,22);light.position.set(-3,4,5);scene.add(light);const light2=new THREE.PointLight(0x756cff,26,20);light2.position.set(4,-2,-4);scene.add(light2);
   const starsGeo=new THREE.BufferGeometry(), starPos=[];for(let i=0;i<900;i++){starPos.push((Math.random()-.5)*32,(Math.random()-.5)*20,(Math.random()-.5)*20-4)}starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0x6d9ab9,size:.018,transparent:true,opacity:.62}));scene.add(stars);
   const nebula=new THREE.Group();scene.add(nebula);
   for(let r=0;r<3;r++){const ring=new THREE.Mesh(new THREE.TorusGeometry(3.3+r*.65,.006,5,180),new THREE.MeshBasicMaterial({color:r===1?0x286a91:0x1a4565,transparent:true,opacity:.45-r*.08}));ring.rotation.set(.55+r*.38,.3+r*.45,.2);nebula.add(ring)}
   const makeSet=(nodes,edges)=>{
    Object.values(nodeObjects).forEach(o=>scene.remove(o.group));Object.keys(nodeObjects).forEach(k=>delete nodeObjects[k]);lineObjects.forEach(l=>scene.remove(l));lineObjects.length=0;
    nodes.forEach(n=>{const g=new THREE.Group();g.position.set(...n.p);g.userData.id=n.id;
      const c=colorMap[n.kind||n.id]||colorMap[n.id]||0x52d6ff;
      const radius=n.kind==='core'?.34:n.kind==='signal'?.25:n.kind==='approval'?.23:.17;
      const sphere=new THREE.Mesh(new THREE.IcosahedronGeometry(radius,2),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.65,metalness:.28,roughness:.26,wireframe:false}));g.add(sphere);
      const wire=new THREE.Mesh(new THREE.IcosahedronGeometry(radius*1.45,1),new THREE.MeshBasicMaterial({color:c,wireframe:true,transparent:true,opacity:.28}));g.add(wire);
      const halo=new THREE.Mesh(new THREE.TorusGeometry(radius*1.75,.009,5,64),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.85}));halo.rotation.x=Math.PI/2.4;g.add(halo);
      if(n.id==='core'){const orbit=new THREE.Mesh(new THREE.TorusGeometry(.62,.007,4,100),new THREE.MeshBasicMaterial({color:0x3ef4cf,transparent:true,opacity:.7}));orbit.rotation.x=.85;orbit.rotation.y=.35;g.add(orbit)}
      scene.add(g);nodeObjects[n.id]={group:g,sphere,wire,halo,record:n};
    });
    edges.forEach((edge,i)=>{const a=nodes.find(n=>n.id===edge[0]),b=nodes.find(n=>n.id===edge[1]);if(!a||!b)return;const points=[new THREE.Vector3(...a.p),new THREE.Vector3(...b.p)];const geo=new THREE.BufferGeometry().setFromPoints(points);const mat=new THREE.LineDashedMaterial({color:0x3d9cb9,dashSize:.1,gapSize:.08,transparent:true,opacity:.55});const line=new THREE.Line(geo,mat);line.computeLineDistances();scene.add(line);lineObjects.push(line);
      const mid=new THREE.Vector3().addVectors(points[0],points[1]).multiplyScalar(.5);const pulse=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),new THREE.MeshBasicMaterial({color:0x8cecff}));pulse.position.copy(mid);scene.add(pulse);lineObjects.push(pulse);
    });
    nodesRef.current=nodeObjects;
   };
   makeSet(metrics,links);sceneRef.current=scene;cameraRef.current=camera;rendererRef.current=renderer;raycaster=new THREE.Raycaster();mouse=new THREE.Vector2();
   const onResize=()=>{if(!el.clientWidth||!el.clientHeight)return;camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight)};
   resizeObserver=new ResizeObserver(onResize);resizeObserver.observe(el);
   const onDown=e=>{pointerDown={x:e.clientX,y:e.clientY};previous={x:e.clientX,y:e.clientY};drag=false;};
   const onMove=e=>{if(pointerDown){const dx=e.clientX-previous.x,dy=e.clientY-previous.y;if(Math.abs(e.clientX-pointerDown.x)+Math.abs(e.clientY-pointerDown.y)>4)drag=true;if(drag){camera.position.x-=dx*.008;camera.position.y+=dy*.008;targetRef.current.x-=dx*.008;targetRef.current.y+=dy*.008;}previous={x:e.clientX,y:e.clientY};}};
   const onUp=e=>{if(!pointerDown)return;if(!drag){const rect=renderer.domElement.getBoundingClientRect();mouse.x=((e.clientX-rect.left)/rect.width)*2-1;mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(mouse,camera);const hits=raycaster.intersectObjects(Object.values(nodeObjects).map(o=>o.group.children[0]),false);if(hits[0])el.dispatchEvent(new CustomEvent('universe-node',{detail:hits[0].object.parent.userData.id}))}pointerDown=null;drag=false};
   const onWheel=e=>{camera.position.z=THREE.MathUtils.clamp(camera.position.z+e.deltaY*.004,4.5,15)};
   renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);renderer.domElement.addEventListener('wheel',onWheel,{passive:true});
   const onSelect=e=>{const n=[...metrics,...actionNodes].find(x=>x.id===e.detail);if(!n)return;const obj=nodeObjects[n.id];if(obj){targetRef.current.set(...n.p);camera.position.x=n.p[0]*.22;camera.position.y=n.p[1]*.22+.5;camera.position.z=7.2}};
   el.addEventListener('universe-node',onSelect);
   let t=0;const animate=()=>{frame=requestAnimationFrame(animate);t+=.008;nebula.rotation.y+=.0006;stars.rotation.y+=.00004;
     Object.values(nodeObjects).forEach((o,i)=>{o.group.children[1].rotation.y=t*.22+i*.15;o.group.children[2].rotation.z=t*.16+i*.12;if(o.record.id==='core')o.group.rotation.y=t*.12;if(o.record.id===selected)o.sphere.material.emissiveIntensity=.95+Math.sin(t*2)*.22;else o.sphere.material.emissiveIntensity=.52});
     renderer.render(scene,camera);
   };animate();
   return()=>{cancelAnimationFrame(frame);resizeObserver?.disconnect();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('wheel',onWheel);window.removeEventListener('pointerup',onUp);el.removeEventListener('universe-node',onSelect);renderer.dispose();renderer.domElement.remove();scene.traverse(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}})};
  }catch(err){console.error('Universe Core WebGL init failed',err);return()=>{renderer?.dispose?.();if(renderer?.domElement?.parentNode===el)el.removeChild(renderer.domElement)}}
 },[mode,selected]);
 const focusNode=id=>{setSelected(id);const n=data.find(x=>x.id===id);if(n){targetRef.current.set(...n.p);const el=mount.current;el?.dispatchEvent(new CustomEvent('universe-node',{detail:id}))}};
 const switchMode=m=>{setMode(m);setSelected(m==='analytics'?'core':'signal')};
 const send=()=>{const q=command.trim();if(!q)return;setChat(c=>[...c,{role:'user',text:q},{role:'core',text:'Запрос принят. В текущем прототипе я могу показать пространственный сценарий и контекст узлов; для фактического анализа данных и запуска внешних действий нужно подключить LLM, API аналитики и слой разрешений.'}]);setCommand('')};
 const activateAction=id=>{setActions(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);const n=actionNodes.find(x=>x.id===id);if(n)setChat(c=>[...c,{role:'core',text:(actions.includes(id)?'Шаг снят с отметки: ':'Шаг отмечен для плана: ')+n.label+'. Это локальное действие прототипа, внешние системы не менялись.'}])};
 return <main className="universe-core">
  <header className="uc-top"><a href="/" className="uc-brand"><i>✦</i> UNIVERSE <span>CORE</span></a><div className="uc-status"><i/> SPATIAL INTELLIGENCE ENVIRONMENT <b>DEMO</b></div><div className="uc-top-right"><button onClick={()=>setShowHelp(v=>!v)}>Controls ⌘</button><a href="/business-hub">Workspace ↗</a></div></header>
  <section className="uc-stage">
   <div className="uc-space" ref={mount} aria-label="Интерактивное трёхмерное пространство. Перетаскивайте для вращения и используйте колесо мыши для приближения."/>
   <div className="uc-vignette"/>
   <div className="uc-stage-title"><span>{mode==='analytics'?'01 / ANALYTICS ENGINE':'02 / ACTION ENGINE'}</span><h1>{mode==='analytics'?'Explore the business.':'Move insight into action.'}</h1><p>{mode==='analytics'?'Исследуй показатели как единую систему взаимосвязей.':'Пройди от сигнала через проверку и сценарий к подтверждённому действию.'}</p></div>
   <div className="uc-floating-labels">{filtered.map(n=><button key={n.id} className={'uc-label '+(selected===n.id?'active':'')} onClick={()=>focusNode(n.id)}><span className="uc-label-dot" style={{'--node-color':'#'+(colorMap[n.kind||n.id]||colorMap[n.id]||0x52d6ff).toString(16).padStart(6,'0')}}/><span><b>{n.label}</b><small>{n.value}</small></span><i>↗</i></button>)}</div>
   <div className="uc-stage-footer"><span>DRAG TO ORBIT <i/> SCROLL TO ZOOM <i/> SELECT ANY NODE</span><span>COORDINATES · {chosen.label}</span></div>
   {showHelp&&<div className="uc-help"><b>Spatial controls</b><p>Перетаскивай фон, чтобы перемещать камеру. Колесо мыши — приблизить или отдалить сцену. Выбирай узел в списке, чтобы сфокусироваться на нём.</p><button onClick={()=>setShowHelp(false)}>Понятно</button></div>}
  </section>
  <section className="uc-console">
   <div className="uc-console-tabs"><button className={mode==='analytics'?'active':''} onClick={()=>switchMode('analytics')}><i>◉</i> Analytics Engine</button><button className={mode==='actions'?'active':''} onClick={()=>switchMode('actions')}><i>⌁</i> Action Engine</button><span>ONE ENVIRONMENT / TWO ENGINES</span></div>
   <div className="uc-console-grid">
    <div className="uc-insight"><div className="uc-kicker">SELECTED OBJECT / {chosen.id.toUpperCase()}</div><h2>{chosen.label}</h2><strong>{chosen.value}</strong><p>{chosen.desc}</p><div className="uc-object-actions"><button onClick={()=>setChat(c=>[...c,{role:'core',text:'Контекст '+chosen.label+': '+chosen.desc}])}>Ask Core ↗</button><button onClick={()=>{setQuery('');setSelected(data[0].id)}}>Reset focus</button></div></div>
    {mode==='analytics'?<div className="uc-causal"><div className="uc-kicker">CAUSALITY / SIGNALS</div><div className="uc-causal-row"><span className="uc-causal-mark risk">!</span><div><b>Marketing spend ↑</b><small>Расходы +22% при снижении конверсии</small></div><span className="uc-causal-arrow">→</span><div><b>Sales conversion ↓</b><small>Падение на 28% · проверить воронку</small></div></div><div className="uc-causal-note">Корреляция — сигнал для проверки, а не доказательство причины. Открой связанные узлы, чтобы исследовать цепочку.</div></div>:<div className="uc-action-flow"><div className="uc-kicker">ACTION PIPELINE / REVIEW REQUIRED</div><div className="uc-flowline">{actionNodes.map((n,i)=><button key={n.id} className={actions.includes(n.id)?'checked':''} onClick={()=>{focusNode(n.id);activateAction(n.id)}}><span>{String(i+1).padStart(2,'0')}</span><b>{n.label}</b><small>{n.value}</small></button>)}</div><p>Отметка шага не запускает действие во внешней системе. Реальный запуск появится после подключения интеграций и разрешений.</p></div>}
    <aside className="uc-core-chat"><div className="uc-chat-head"><span className="uc-core-icon">✦</span><div><b>UNIVERSE CORE</b><small>Context-aware intelligence · demo</small></div><i/></div><div className="uc-chat-log">{chat.slice(-3).map((m,i)=><div key={i} className={'uc-chat-msg '+m.role}><span>{m.role==='user'?'YOU':'✦'}</span><p>{m.text}</p></div>)}</div><form onSubmit={e=>{e.preventDefault();send()}} className="uc-chat-form"><input value={command} onChange={e=>setCommand(e.target.value)} placeholder="Спроси о взаимосвязях или действиях…"/><button type="submit">↗</button></form></aside>
   </div>
  </section>
  <footer className="uc-footer"><span>UNIVERSE CORE <i/> ANALYTICS ENGINE <i/> ACTION ENGINE</span><span>DEMONSTRATION DATA · NOT LIVE FINANCIAL REPORTING</span></footer>
 </main>
}

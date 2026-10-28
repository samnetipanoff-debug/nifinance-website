import React, { useMemo, useState } from 'react';
import './universe4.css';

const seedMetrics = [
  { id:'revenue', label:'Выручка', value:'24,8 млн ₽', change:'+18%', tone:'cyan', icon:'↗', detail:'Рост к предыдущему периоду', points:[7,8,7,10,9,12,11,13,14,15,14,18] },
  { id:'profit', label:'Прибыль', value:'12,4 млн ₽', change:'+12%', tone:'teal', icon:'◈', detail:'Операционная прибыль', points:[5,6,5,7,6,8,7,9,8,10,9,12] },
  { id:'margin', label:'Рентабельность', value:'16,3%', change:'+3 п.п.', tone:'violet', icon:'◎', detail:'Маржинальность бизнеса', points:[8,7,8,9,8,10,9,11,10,11,12,13] },
  { id:'customers', label:'Клиенты', value:'1 284', change:'+14%', tone:'blue', icon:'◉', detail:'Активная клиентская база', points:[4,5,5,6,6,7,8,7,9,10,10,12] }
];
const businessNodes = [
  {id:'profit',label:'Прибыль',value:'12,4 млн ₽',sub:'Операционный результат',tone:'teal',x:50,y:51,size:'core'},
  {id:'marketing',label:'Маркетинг',value:'4,2 млн ₽',sub:'Расходы +22%',tone:'violet',x:25,y:31},
  {id:'sales',label:'Продажи',value:'18,6 млн ₽',sub:'Выручка +16%',tone:'cyan',x:73,y:31},
  {id:'production',label:'Производство',value:'9,3 млн ₽',sub:'Себестоимость +8%',tone:'orange',x:23,y:69},
  {id:'suppliers',label:'Поставщики',value:'5,4 млн ₽',sub:'Обязательства +9%',tone:'yellow',x:76,y:56},
  {id:'customers',label:'Клиенты',value:'1 284',sub:'Средний чек −12%',tone:'blue',x:66,y:78},
  {id:'team',label:'Команда',value:'6,1 млн ₽',sub:'ФОТ +5%',tone:'violet',x:43,y:83}
];
const relations = [
  {id:1,from:'Маркетинг',to:'Продажи',title:'Конверсия снизилась',value:'−28%',tone:'red',desc:'Расходы растут, а доля лидов, переходящих в сделки, снижается.'},
  {id:2,from:'Расходы',to:'Прибыль',title:'Рост затрат',value:'+42%',tone:'red',desc:'Рост затрат опережает динамику выручки в выбранном периоде.'},
  {id:3,from:'Клиенты',to:'Выручка',title:'Средний чек',value:'−12%',tone:'yellow',desc:'Снижение среднего чека компенсирует часть роста клиентской базы.'},
  {id:4,from:'Производство',to:'Себестоимость',title:'Себестоимость услуг',value:'+6%',tone:'yellow',desc:'Изменился состав проектов и стоимость исполнения.'}
];
const tasks = [
  {id:1,title:'Проверить рекламные кампании',sub:'3 канала · маркетинг',status:'Рекомендовано',tone:'cyan'},
  {id:2,title:'Проанализировать воронку продаж',sub:'Конверсия по этапам',status:'Ожидает запуска',tone:'violet'},
  {id:3,title:'Сравнить с предыдущим периодом',sub:'Финансовая динамика',status:'Ожидает запуска',tone:'blue'},
  {id:4,title:'Сформировать отчёт',sub:'PDF / Excel',status:'Ожидает запуска',tone:'teal'}
];
const money = n => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
function Sparkline({points,tone='cyan'}) {
  const max=Math.max(...points), min=Math.min(...points);
  const path=points.map((v,i)=>`${i?'L':'M'} ${i*100/(points.length-1)} ${28-(v-min)/(max-min||1)*23}`).join(' ');
  return <svg className={'sparkline '+tone} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/><path d={path+' L 100 32 L 0 32 Z'} fill="currentColor" opacity=".08"/></svg>;
}
function TrendChart({period}) {
  const vals = period==='Квартал' ? [8,10,9,13,12,15,14,17,16,19,18,21] : period==='Год' ? [5,7,8,7,10,12,11,14,15,14,18,21] : [7,8,7,10,9,12,11,13,14,15,14,18];
  const line=vals.map((v,i)=>`${i?'L':'M'} ${i*480/(vals.length-1)} ${124-v*4.5}`).join(' ');
  const area=line+' L 480 124 L 0 124 Z';
  return <svg viewBox="0 0 480 150" className="trend-chart" preserveAspectRatio="none">
    {[28,58,88,118].map(y=><line key={y} x1="0" x2="480" y1={y} y2={y} className="chart-grid"/>)}
    <path d={area} className="chart-area"/><path d={line} className="chart-line"/>
    {vals.map((v,i)=><circle key={i} cx={i*480/(vals.length-1)} cy={124-v*4.5} r="2.6" className="chart-dot"/>)}
  </svg>;
}
export default function Universe4() {
  const [section,setSection]=useState('Обзор');
  const [period,setPeriod]=useState('Месяц');
  const [activeNode,setActiveNode]=useState('profit');
  const [activeTab,setActiveTab]=useState('Финансы');
  const [query,setQuery]=useState('');
  const [prompt,setPrompt]=useState('');
  const [messages,setMessages]=useState([{role:'assistant',text:'Я проанализировал демонстрационные данные. Основные сигналы: расходы на маркетинг растут быстрее выручки, а конверсия воронки снижается. Это гипотезы для проверки, не подтверждённые причинные выводы.'}]);
  const [running,setRunning]=useState(false);
  const [completed,setCompleted]=useState([]);
  const [showActions,setShowActions]=useState(true);
  const [showAllRelations,setShowAllRelations]=useState(false);
  const [analysisMode,setAnalysisMode]=useState('Связи');
  const [notice,setNotice]=useState('');
  const filteredNodes=useMemo(()=>businessNodes.filter(n=>(n.label+' '+n.value+' '+n.sub).toLowerCase().includes(query.toLowerCase())),[query]);
  const node=businessNodes.find(n=>n.id===activeNode)||businessNodes[0];
  const sendPrompt=()=>{
    const q=prompt.trim(); if(!q)return;
    setMessages(m=>[...m,{role:'user',text:q},{role:'assistant',text:`Для ответа «${q}» я бы начал с показателей ${node.label.toLowerCase()}, проверил динамику за выбранный период и открыл связанные данные. Сейчас это демонстрационный режим: ИИ-провайдер и реальные инструменты выполнения ещё не подключены.`}]);
    setPrompt('');
  };
  const runAnalysis=()=>{
    setRunning(true); setNotice('Анализ завершён: найдены 4 сигнала для проверки.');
    setMessages(m=>[...m,{role:'assistant',text:'Анализ завершён. Приоритет №1 — проверить связь между ростом маркетинговых расходов и снижением конверсии. Следом сравнить средний чек и структуру продаж. Перейдите к карточкам взаимосвязей, чтобы открыть контекст.'}]);
  };
  const runTask=(id)=>{
    setCompleted(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
    const task=tasks.find(t=>t.id===id);
    setNotice(completed.includes(id)?`«${task.title}» возвращено в план.`:`«${task.title}» добавлено в локальный список выполненных шагов. Реальное внешнее действие не запускалось.`);
  };
  return <main className="universe4">
    <header className="u4-topbar">
      <a className="u4-brand" href="/"><span className="u4-brand-mark">✦</span><span>UNIVERSE <b>3.0</b></span></a>
      <label className="u4-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по бизнесу, показателям, операциям..." /><kbd>⌘ K</kbd></label>
      <div className="u4-top-actions"><button className="u4-ai-pill" onClick={()=>document.querySelector('.u4-assistant-input')?.focus()}>✧ AI Assistant</button><button className="u4-company">◉ Nifinance Solutions⌄</button><button className="u4-avatar">NI</button></div>
    </header>
    <div className="u4-layout">
      <aside className="u4-sidebar">
        <div className="u4-nav-list">{[['◈','Обзор'],['♧','Финансы'],['♢','Маркетинг'],['▣','Продажи'],['⬡','Производство'],['♙','Клиенты'],['⌘','Поставщики'],['♧','Сотрудники'],['▤','Проекты']].map(([icon,label])=><button key={label} className={section===label?'active':''} onClick={()=>{setSection(label);setNotice('Раздел «'+label+'» выбран.');}}><span>{icon}</span>{label}</button>)}</div>
        <div className="u4-sidebar-bottom"><button onClick={()=>setNotice('Настройки доступа и интеграций будут подключены к профилю компании.')}>⚙ Настройки</button><div className="u4-tenant"><span className="u4-status-dot"/> <span><b>DEMO WORKSPACE</b><small>Демонстрационные данные</small></span></div></div>
      </aside>
      <section className="u4-main">
        <div className="u4-page-head"><div><div className="u4-breadcrumb">ВЕСЬ БИЗНЕС <span>›</span> {section.toUpperCase()} <span>›</span> АНАЛИТИКА</div><h1>{section==='Обзор'?'Центр управления бизнесом':section}</h1><p>Показатели, взаимосвязи и решения в едином пространстве.</p></div><div className="u4-period">{['Неделя','Месяц','Квартал','Год'].map(p=><button key={p} className={period===p?'active':''} onClick={()=>setPeriod(p)}>{p}</button>)}</div></div>
        <div className="u4-kpis">{seedMetrics.map(m=><button key={m.id} className={'u4-kpi '+m.tone+(activeNode===m.id?' selected':'')} onClick={()=>{setActiveNode(m.id);setActiveTab('Финансы')}}><div className="u4-kpi-head"><span>{m.label}</span><i>{m.icon}</i></div><strong>{m.value}</strong><div className="u4-kpi-foot"><span className="u4-positive">{m.change}</span><span>{m.detail}</span></div><Sparkline points={m.points} tone={m.tone}/></button>)}</div>
        <div className="u4-workspace">
          <section className="u4-panel u4-network-panel">
            <div className="u4-panel-head"><div><span className="u4-eyebrow">ANALYTICS ENGINE</span><h2>Карта бизнес-взаимосвязей</h2><p>Выберите узел, чтобы исследовать его влияние и связанные показатели.</p></div><button className="u4-icon-button" onClick={()=>setAnalysisMode(analysisMode==='Связи'?'Показатели':'Связи')}>☷</button></div>
            <div className="u4-map-tools">{['Связи','Показатели','Прогноз'].map(t=><button key={t} className={analysisMode===t?'active':''} onClick={()=>setAnalysisMode(t)}>{t}</button>)}<span className="u4-live-tag"><i/> DEMO DATA</span></div>
            <div className={'u4-network '+analysisMode.toLowerCase()}>
              <svg className="u4-network-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {businessNodes.filter(n=>n.id!=='profit').map((n,i)=><g key={n.id}><line x1="50" y1="51" x2={n.x} y2={n.y} className={'u4-link '+n.tone}/><circle cx={(50+n.x)/2} cy={(51+n.y)/2} r=".65" className="u4-link-dot"/></g>)}
                <line x1="25" y1="31" x2="73" y2="31" className="u4-link violet"/><line x1="23" y1="69" x2="76" y2="56" className="u4-link orange"/>
              </svg>
              {businessNodes.map(n=><button key={n.id} className={'u4-node '+n.tone+(n.size?' '+n.size:'')+(activeNode===n.id?' active':'')} style={{left:n.x+'%',top:n.y+'%'}} onClick={()=>{setActiveNode(n.id);setNotice('Выбран узел «'+n.label+'». Связанные данные доступны ниже.');}}><span className="u4-node-orb">{n.id==='profit'?'✧':n.id==='marketing'?'◖':n.id==='sales'?'▱':n.id==='production'?'▦':n.id==='suppliers'?'▰':n.id==='customers'?'●':'◉'}</span><b>{n.label}</b><strong>{n.value}</strong><small>{n.sub}</small></button>)}
              <div className="u4-map-center-caption">{analysisMode==='Прогноз'?'SCENARIO VIEW':analysisMode==='Показатели'?'METRIC VIEW':'RELATIONSHIP MAP'} <span>·</span> {period.toUpperCase()}</div>
            </div>
            <div className="u4-node-inspector"><div className={'u4-inspector-icon '+node.tone}>✧</div><div><span>ВЫБРАННЫЙ УЗЕЛ</span><b>{node.label} · {node.value}</b><p>{node.sub}. Откройте связанные показатели ниже, чтобы перейти от общей картины к деталям.</p></div><button onClick={()=>setSection(node.label==='Маркетинг'?'Маркетинг':node.label==='Продажи'?'Продажи':node.label==='Клиенты'?'Клиенты':'Финансы')}>Исследовать ↗</button></div>
          </section>
          <aside className="u4-panel u4-assistant">
            <div className="u4-panel-head"><div><span className="u4-eyebrow">UNIVERSE CORE</span><h2>AI Assistant <span className="u4-online"><i/> online demo</span></h2></div><button className="u4-icon-button" onClick={()=>setMessages([])}>↻</button></div>
            <div className="u4-chat-context"><span>КОНТЕКСТ</span><b>{section} / {node.label}</b><small>{period} · {activeTab}</small></div>
            <div className="u4-messages">{messages.map((m,i)=><div key={i} className={'u4-message '+m.role}><span className="u4-message-avatar">{m.role==='assistant'?'✧':'NI'}</span><div>{m.text}</div></div>)}</div>
            <div className="u4-suggested"><span>ПОПРОБУЙТЕ СПРОСИТЬ</span><div>{['Почему изменилась прибыль?','Найди основные отклонения','Что проверить в первую очередь?'].map(q=><button key={q} onClick={()=>setPrompt(q)}>{q} <span>↗</span></button>)}</div></div>
            <form className="u4-assistant-input" onSubmit={e=>{e.preventDefault();sendPrompt();}}><input value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Задайте вопрос или выберите действие..."/><button type="submit" aria-label="Отправить сообщение">➤</button></form>
            <p className="u4-demo-note">Демонстрация интерфейса · LLM и live-инструменты не подключены</p>
          </aside>
        </div>
        <section className="u4-lower-grid">
          <div className="u4-panel u4-trend-panel"><div className="u4-panel-head"><div><span className="u4-eyebrow">PERFORMANCE</span><h2>Динамика показателей</h2></div><button className="u4-plain-button" onClick={()=>setNotice('Выбран график динамики за период: '+period)}>Подробнее ↗</button></div><div className="u4-chart-legend"><span><i/> Прибыль</span><span><i/> План</span></div><div className="u4-chart-area"><div className="u4-y-labels"><span>20 млн</span><span>15 млн</span><span>10 млн</span><span>5 млн</span><span>0</span></div><TrendChart period={period}/></div><div className="u4-months">{['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'].map(m=><span key={m}>{m}</span>)}</div></div>
          <div className="u4-panel u4-cost-panel"><div className="u4-panel-head"><div><span className="u4-eyebrow">COST STRUCTURE</span><h2>Структура расходов</h2></div><button className="u4-icon-button" onClick={()=>setActiveTab(activeTab==='Финансы'?'Маркетинг':'Финансы')}>↔</button></div><div className="u4-cost-content"><div className="u4-donut"><div><b>9,8 млн ₽</b><small>Всего расходов</small></div></div><div className="u4-legend">{[['Маркетинг','42%','violet'],['Производство','18%','orange'],['Зарплаты','12%','yellow'],['Аренда','8%','blue'],['IT и ПО','6%','cyan'],['Прочее','14%','muted']].map(([l,v,c])=><div key={l}><i className={c}/><span>{l}</span><b>{v}</b></div>)}</div></div></div>
          <div className="u4-panel u4-relations-panel"><div className="u4-panel-head"><div><span className="u4-eyebrow">SIGNALS & DEPENDENCIES</span><h2>Основные взаимосвязи</h2></div><button className="u4-plain-button" onClick={()=>setShowAllRelations(v=>!v)}>{showAllRelations?'Свернуть':'Все связи ↗'}</button></div><div className="u4-relations-list">{(showAllRelations?relations:[...relations].slice(0,3)).map(r=><button className="u4-relation" key={r.id} onClick={()=>{setNotice(r.desc);setMessages(m=>[...m,{role:'assistant',text:r.desc}]);}}><span className={'u4-relation-icon '+r.tone}>↗</span><span className="u4-relation-copy"><b>{r.from} → {r.to}</b><small>{r.title}</small></span><strong className={r.tone}>{r.value}</strong><span className="u4-relation-arrow">↗</span></button>)}</div></div>
          <div className="u4-panel u4-actions-panel"><div className="u4-panel-head"><div><span className="u4-eyebrow">ACTION ENGINE</span><h2>Следующие шаги</h2></div><button className="u4-icon-button" onClick={()=>setShowActions(v=>!v)}>{showActions?'−':'+'}</button></div>{showActions&&<><p className="u4-action-intro">Рекомендации на основе текущих сигналов. Запуск действий требует интеграций и разрешений.</p><div className="u4-task-list">{tasks.map(t=><button key={t.id} className={'u4-task '+(completed.includes(t.id)?'done':'')} onClick={()=>runTask(t.id)}><span className={'u4-task-icon '+t.tone}>{completed.includes(t.id)?'✓':'↗'}</span><span><b>{t.title}</b><small>{t.sub}</small></span><i>{completed.includes(t.id)?'Отмечено':'＋'}</i></button>)}</div><button className="u4-run-analysis" onClick={runAnalysis} disabled={running}>{running?'✓ Анализ завершён':'✧ Запустить анализ'} <span>→</span></button></>}</div>
        </section>
        <footer className="u4-footer"><span>✦ UNIVERSE CORE <i/> ANALYTICS ENGINE <i/> ACTION ENGINE</span><span>Демо-показатели · не использовать как финансовую отчётность</span></footer>
        {notice&&<div className="u4-toast" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Закрыть уведомление">×</button></div>}
      </section>
    </div>
  </main>;
}

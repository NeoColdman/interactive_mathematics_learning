const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pretty = value => Number.isInteger(Number(value)) ? String(Number(value)) : String(Math.round(Number(value) * 100) / 100);
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const S = {boot:null, data:null, profileId:null, generation:0, route:'home', moduleId:null, round:null, index:0, resultOpen:false, mistakeId:null, mistakeFilter:'all', reviewFeedback:null, step:0, learnMode:'guided', labs:{}, drafts:{}, busy:false, profilesRefreshing:false, pendingLabel:'', saveStatus:'', syncStatus:'', requestIds:new Map()};
const iconPaths = {
 home:'<path d="M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3z"/>',
 book:'<path d="M3 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H3z"/><path d="M21 4h-5a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h4z"/>',
 mistake:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h4m2 3 2 2 4-4"/>',
 connect:'<rect x="3" y="4" width="13" height="11" rx="1.5"/><path d="M7 20h5m-2.5-5v5"/><rect x="16" y="10" width="5" height="11" rx="1"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
 arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>', play:'<path d="m8 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
 reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>', check:'<path d="m5 12 5 5L20 6"/>',
 leaf:'<path d="M19 4C9 2 3 7 5 14s13 8 14-10Z"/><path d="M5 20 15 9"/>',
 angle:'<path d="M3 20h18M3 20 14 3M8 20a5 5 0 0 0-2-4"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.book}</svg>`;
const moduleOf = id => S.boot?.modules.find(item => item.id === id);
const currentModule = () => moduleOf(S.moduleId);
const currentProfile = () => S.boot?.profiles.find(item => item.id === S.profileId);
const rounds = () => S.data?.rounds || [];
const mistakes = () => S.data?.mistakes || [];
const sortedRounds = () => [...rounds()].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
const moduleTheme = id => id === 'A-LIKE-COMBINE' ? 'blue' : id === 'G-BISECTOR-CALC' ? 'orange' : '';
const foundationIds=Array.from({length:11},(_,index)=>`C1-${String(index+1).padStart(2,'0')}`);
const expansionIds=['C1-01','C1-02','C1-03','C1-09','C1-10','C1-11'];
const expansionModule=id=>expansionIds.includes(id);
const arithmeticIds=Array.from({length:14},(_,index)=>`C2-${String(index+1).padStart(2,'0')}`);
const arithmeticModule=id=>arithmeticIds.includes(id);
const chapterOneOrder=[...foundationIds.slice(0,9),'N-NEG-COMP',...foundationIds.slice(9)];
const foundationModule=id=>foundationIds.includes(id);
const availableModules=()=>[...S.boot.modules].sort((a,b)=>Number(a.chapter)-Number(b.chapter)||(chapterOneOrder.indexOf(a.id)<0?99:chapterOneOrder.indexOf(a.id))-(chapterOneOrder.indexOf(b.id)<0?99:chapterOneOrder.indexOf(b.id)));
const signed=value=>pretty(Object.is(value,-0)?0:value).replace('-','−');
const labHeight=id=>id==='G-BISECTOR-CALC'?390:arithmeticModule(id)?300:['C1-07','C1-08'].includes(id)?340:['C1-01','C1-03'].includes(id)?210:300;
const signCards=[{label:'−3',value:-3},{label:'＋2',value:2},{label:'0',value:0},{label:'−0.5',value:-.5},{label:'25%',value:.25},{label:'−10%',value:-.1},{label:'0/5',value:0},{label:'2.0',value:2},{label:'−0',value:0},{label:'0%',value:0}];
const typeCards=[{label:'2.0',value:2},{label:'6/3',value:2},{label:'0/5',value:0},{label:'100%',value:1},{label:'−4',value:-4},{label:'−1/2',value:-.5},{label:'0.75',value:.75},{label:'−0.25',value:-.25},{label:'1/3',value:1/3},{label:'0.333…（3循环）',value:1/3,repeat:true}];
const quantityScenes={temperature:{name:'温度',unit:'℃',min:-10,max:20,baseline:0,actual:5,baselineLabel:'温度基准',actualLabel:'实际温度',increase:'实际温度较高记正',decrease:'实际温度较低记正'},altitude:{name:'海拔',unit:'m',min:-20,max:40,baseline:0,actual:12,baselineLabel:'海拔基准',actualLabel:'实际海拔',increase:'实际海拔较高记正',decrease:'实际海拔较低记正'},balance:{name:'收支',unit:'元',min:80,max:120,baseline:100,actual:108,baselineLabel:'原有余额',actualLabel:'现有余额',increase:'余额增加记正',decrease:'余额减少记正'},mass:{name:'标准质量',unit:'g',min:480,max:520,baseline:500,actual:503,baselineLabel:'标准质量',actualLabel:'实际质量',increase:'超过标准记正',decrease:'低于标准记正'}};
const sortGroups=[
 [{label:'|−2|',value:2},{label:'−3',value:-3},{label:'−(−1)',value:1},{label:'−1/2',value:-.5},{label:'0',value:0}],
 [{label:'2.0',value:2},{label:'−|−1.5|',value:-1.5},{label:'3/2',value:1.5},{label:'−(+4)',value:-4},{label:'0/3',value:0}]
];
const dateLabel = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date); };
const completionLabel = state => ({independent:'首次独立答对',retry:'订正完成',hint:'提示后完成',solution:'已看解析'}[state?.completion] || (state?.attemptCount ? '待订正' : '尚未作答'));
const statusTag = state => state?.independentCorrect ? '<span class="tag">首次独立答对</span>' : state?.completed ? `<span class="tag orange">${completionLabel(state)}</span>` : state?.attemptCount ? '<span class="tag orange">待订正</span>' : '';
function notice(message) {
 const node = $('#notice'); node.innerHTML = `${esc(message)}<button data-action="dismiss-notice" aria-label="关闭消息">关闭</button>`; node.hidden = false;
}
function clearNotice() { $('#notice').hidden = true; }
async function api(path, options = {}) {
 const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 18000);
 const reading=!options.method || options.method==='GET';
 try {
  const response = await fetch(path, {...options, headers:{'Content-Type':'application/json',...(options.headers || {})}, cache:'no-store', signal:controller.signal});
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('json') ? await response.json() : null;
  if (!response.ok) { const error=new Error(payload?.error || `家庭电脑暂时无法完成此操作（${response.status}）`); error.status=response.status; throw error; }
  if (!payload) throw new Error('家庭电脑返回了无法读取的内容，请重试。');
  return payload;
 } catch (error) {
  let failure=error;
  if (error.name === 'AbortError') failure=new Error(reading?'连接等待时间较长，记录尚未更新。请检查电脑仍在运行，再重试。':'连接等待时间较长，尚未确认本次保存。请检查电脑仍在运行，再重试。');
  else if (error instanceof TypeError) failure=new Error(reading?'未连接到家庭电脑，记录尚未更新。请检查网络与电脑上的程序。':'未连接到家庭电脑，尚未确认本次保存。请检查网络与电脑上的程序。');
  failure.reading=reading;throw failure;
 } finally { clearTimeout(timer); }
}
const post = (path, value = {}) => api(path, {method:'POST',body:JSON.stringify(value)});
const profilePath = () => `/api/profiles/${encodeURIComponent(S.profileId)}`;
function syncBusy() {
 document.body.dataset.busy = S.busy ? 'true' : 'false';
 $$('[data-mutates],[data-action=nav],#profile-select,#profile-form button[type=submit]').forEach(node => { node.disabled = S.busy || node.dataset.locked === 'true'; });
 const status = $('#save-state');
 if (status) { status.textContent = S.busy ? S.pendingLabel : S.saveStatus; status.classList.toggle('error', /失败|未保存|未读取|未确认/.test(S.saveStatus)); }
 const recordStatus=$('#record-status');
 if(recordStatus){recordStatus.textContent=S.busy?'正在连接…':S.syncStatus||'本地记录';recordStatus.title=S.busy?S.pendingLabel:S.saveStatus;recordStatus.style.color=/失败|未确认/.test(S.syncStatus)?'var(--red)':'';}
}
function $$(selector, root = document) { return [...root.querySelectorAll(selector)]; }
async function mutation(label, task, {reading=false}={}) {
 if (S.busy) return;
 S.busy = true; S.pendingLabel = label; clearNotice(); syncBusy();
 const context = {profileId:S.profileId,generation:S.generation};
 try { await task(context); }
 catch (error) { const failedRead=reading||error.reading;S.saveStatus = failedRead?'记录尚未更新，保留当前页面后重试':'本次操作未完成，保存状态未确认，请重试'; S.syncStatus=failedRead?'连接失败':'保存未确认'; notice(error.message); }
 finally { S.busy = false; S.pendingLabel = ''; syncBusy(); }
}
const activeContext = context => context.profileId === S.profileId && context.generation === S.generation;
function upsertRound(round) {
 S.round = round;S.syncStatus='记录已更新';
 for(const question of round.questions)if(question.state?.latestCorrect)delete S.drafts[`${S.profileId}/${question.id}`];
 const index = rounds().findIndex(item => item.id === round.id);
 if (index === -1) S.data.rounds.unshift(round); else S.data.rounds[index] = round;
}
async function refreshProfile(context) {
 let data;try{data=await api(`/api/profiles/${encodeURIComponent(context.profileId)}`);}catch(error){error.reading=true;throw error;}
 if (activeContext(context)) {S.data = {progress:{},rounds:[],mistakes:[],...data};S.syncStatus='记录已更新';}
 return data;
}
async function refreshRecords(context) {
 let values;try{values=await Promise.all([api(`/api/profiles/${encodeURIComponent(context.profileId)}`),api('/api/bootstrap')]);}catch(error){error.reading=true;throw error;}
 const [data,bootstrap]=values;
 if(!activeContext(context))return false;
 S.data={progress:{},rounds:[],mistakes:[],...data};S.boot=bootstrap;
 S.syncStatus='记录已更新';S.saveStatus='已从家庭电脑读取最新学习记录';
 return true;
}
async function navigate(route) {
 return mutation('正在更新学习记录…',async context=>{
  if(!await refreshRecords(context))return;
  S.route=route;S.mistakeId=null;S.reviewFeedback=null;paint(true);
 },{reading:true});
}
async function refreshProfileChoices() {
 if(!S.data||S.busy||S.profilesRefreshing)return;
 const context={profileId:S.profileId,generation:S.generation};S.profilesRefreshing=true;
 try{
  const bootstrap=await api('/api/bootstrap');if(!activeContext(context))return;
  S.boot=bootstrap;
  const select=$('#profile-select');
  if(select)select.innerHTML=bootstrap.profiles.map(profile=>`<option value="${esc(profile.id)}" ${profile.id===S.profileId?'selected':''}>${esc(profile.name)}</option>`).join('');
  S.syncStatus='档案列表已更新';syncBusy();
 }catch(error){if(activeContext(context)){S.syncStatus='连接失败';S.saveStatus='档案列表未读取，当前选项可能不是最新';syncBusy();notice(`档案列表暂未更新。${error.message}`);}}
 finally{S.profilesRefreshing=false;}
}
function hashFor() {
 if (S.route === 'learn') return `#learn/${encodeURIComponent(S.moduleId)}`;
 if (S.route === 'practice' && S.round) return `#practice/${encodeURIComponent(S.round.id)}`;
 if (S.route === 'mistakes' && S.mistakeId) return `#mistakes/${encodeURIComponent(S.mistakeId)}`;
 return `#${S.route}`;
}
function paint(focus = false) {
 if (!S.boot || !S.data) return;
 const navRoute = ['learn','practice'].includes(S.route) ? 'catalog' : S.route;
 $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="#home" data-action="nav" data-route="home"><span class="brand-mark" aria-hidden="true">∠</span><span class="brand-name">交互学数学<small>七年级 · 上册</small></span></a><nav class="nav" aria-label="主要导航">${[['home','home','学习首页'],['catalog','book','教材目录'],['mistakes','mistake','错题复习']].map(([route,name,label])=>`<button data-action="nav" data-route="${route}" class="${navRoute===route?'active':''}" ${navRoute===route?'aria-current="page"':''}>${icon(name)}<span class="nav-text">${label}</span>${route==='mistakes'&&mistakes().length?`<span class="count">${mistakes().length}</span>`:''}</button>`).join('')}</nav><div class="sidebar-note"><strong>数学，动手想一想。</strong>先探索一个小问题，<br>再用新题试试自己。<br><br>已上线 ${S.boot.modules.length} 个学习项目<br>其余内容按计划逐步加入。</div></aside><div class="app-column"><header class="topbar"><div class="topbar-label"><span class="status-dot" aria-hidden="true"></span><span>家庭学习<span class="hide-small"> · <span id="record-status" aria-live="polite">${esc(S.syncStatus || '本地记录')}</span></span></span></div><div class="topbar-actions"><button class="quiet icon-button" data-action="connection" aria-label="平板连接与访问地址" title="平板连接">${icon('connect')}</button><div class="profile-group"><label class="visually-hidden" for="profile-select">切换学习档案</label><select id="profile-select" class="profile-select">${S.boot.profiles.map(profile=>`<option value="${esc(profile.id)}" ${profile.id===S.profileId?'selected':''}>${esc(profile.name)}</option>`).join('')}</select><button class="quiet icon-button" data-action="new-profile" aria-label="添加家庭学习档案" title="添加档案">${icon('plus')}</button></div></div></header><main id="main-content" class="content" tabindex="-1">${renderPage()}</main></div></div>`;
 history.replaceState(null,'',hashFor()); syncBusy();
 if (S.route === 'learn') drawLab();
 if (focus) { window.scrollTo(0,0); $('#main-content')?.focus({preventScroll:true}); }
}
function renderPage() {
 if (S.route === 'catalog') return catalogPage();
 if (S.route === 'learn') return learningPage();
 if (S.route === 'practice') return practicePage();
 if (S.route === 'mistakes') return mistakesPage();
 return homePage();
}
function miniArt(id) {
 if(arithmeticModule(id)){const label={'C2-01':'a ＋ b','C2-02':'加上一个数 →','C2-03':'(a＋b)＋c','C2-04':'标准 × 数量 ＋ 偏差','C2-05':'a − b = a＋(−b)','C2-06':'带符号，一起走','C2-07':'距离 |b − a|','C2-08':'(−a) × (−b)','C2-09':'a × ? = 1','C2-10':'乘数整张一起移','C2-11':'先看 0 · 再数负号','C2-12':'a(b＋c) = ab＋ac','C2-13':'÷ b → × 1/b','C2-14':'整数之比 p/q'}[id];return `<svg viewBox="0 0 260 120" aria-hidden="true"><rect x="24" y="22" width="212" height="76" rx="8" fill="#e4ecdf"/><path d="M43 80h174m-8-5 8 5-8 5" stroke="#9eb493" fill="none" stroke-width="2"/><circle cx="94" cy="80" r="5" fill="#46705a"/><circle cx="170" cy="80" r="5" fill="#b2834d"/><text x="130" y="56" text-anchor="middle" fill="#3f644c" font-size="${['C2-04','C2-05','C2-11','C2-12'].includes(id)?17:23}" font-family="Georgia,serif">${label}</text></svg>`;}

 if(expansionModule(id)){
  const label={'C1-01':'−  0  ＋','C1-02':'基准 → 偏差','C1-03':'整数 / 分数','C1-09':'|a|  ?  |b|','C1-10':'a ＜ b ＜ c','C1-11':'−d ← 0 → d'}[id];
  return `<svg viewBox="0 0 260 120" aria-hidden="true"><rect x="30" y="21" width="200" height="77" rx="8" fill="#e4ecdf"/><path d="M48 80h164m-8-5 8 5-8 5" fill="none" stroke="#a0b394" stroke-width="2"/><circle cx="130" cy="80" r="4" fill="#54744e"/><text x="130" y="58" text-anchor="middle" fill="#3f644c" font-size="${id==='C1-03'?19:23}" font-family="Georgia,serif">${label}</text></svg>`;
 }
 if(foundationModule(id)){
  const decorations={
   'C1-04':'<circle cx="130" cy="76" r="5" fill="#285b45"/><text x="130" y="101" text-anchor="middle" fill="#637668" font-size="13">0</text><path d="M68 41h124m-6-4 6 4-6 4" stroke="#a1b395" fill="none"/><text x="130" y="28" text-anchor="middle" fill="#526b55" font-size="12">原点 · 正方向 · 单位长度</text>',
   'C1-05':'<circle cx="172" cy="76" r="7" fill="#397599"/><path d="M172 76V38" stroke="#9cb7c6" stroke-dasharray="3 3"/><text x="172" y="29" text-anchor="middle" fill="#397599" font-size="22">A</text><text x="130" y="101" text-anchor="middle" fill="#637668" font-size="13">0</text>',
   'C1-06':'<circle cx="70" cy="76" r="6" fill="#a97a48"/><circle cx="190" cy="76" r="6" fill="#285b45"/><path d="M70 58Q130 9 190 58m-8-3 8 3-1-8" fill="none" stroke="#9bad93" stroke-width="2"/><text x="70" y="103" text-anchor="middle" fill="#936d43" font-size="16">−a</text><text x="190" y="103" text-anchor="middle" fill="#285b45" font-size="16">a</text>',
   'C1-07':'<text x="130" y="48" text-anchor="middle" fill="#285b45" font-size="25" font-family="Georgia">−(−a)</text><circle cx="70" cy="76" r="6" fill="#a97a48"/><path d="M70 65Q130 96 190 65m-7-1 7 1-3 7" fill="none" stroke="#9bad93" stroke-width="2"/>',
   'C1-08':'<circle cx="70" cy="76" r="6" fill="#285b45"/><path d="M70 53h60M70 48v10m60-10v10" stroke="#bd915e" stroke-width="3"/><text x="102" y="36" text-anchor="middle" fill="#936d43" font-size="23" font-family="Georgia">|a|</text><text x="130" y="101" text-anchor="middle" fill="#637668" font-size="13">0</text>'
  };
  return `<svg viewBox="0 0 260 120" aria-hidden="true"><path d="M22 76h216m-7-5 7 5-7 5" fill="none" stroke="#71866b" stroke-width="2"/><path d="M40 70v12m30-12v12m30-12v12m30-12v12m30-12v12m30-12v12m30-12v12" stroke="#a9b59f"/>${decorations[id]}</svg>`;
 }
 if (id === 'N-NEG-COMP') return '<svg viewBox="0 0 260 120" aria-hidden="true"><path d="M24 76h214m-7-5 7 5-7 5" fill="none" stroke="#52735c" stroke-width="2"/><path d="M48 70v12m42-12v12m42-12v12m42-12v12m42-12v12" stroke="#91a18b"/><circle cx="90" cy="76" r="7" fill="#27614c"/><circle cx="174" cy="76" r="7" fill="#b67d4b"/><path d="M90 76V42m84 34V42" stroke="#a8b69c" stroke-dasharray="3 3"/><text x="90" y="32" text-anchor="middle" fill="#27503c" font-size="23" font-family="Georgia">−7</text><text x="174" y="32" text-anchor="middle" fill="#93643d" font-size="23" font-family="Georgia">−3</text><text x="216" y="102" text-anchor="middle" fill="#82907b" font-size="11">0</text></svg>';
 if (id === 'A-LIKE-COMBINE') return '<svg viewBox="0 0 260 120" aria-hidden="true"><rect x="29" y="30" width="65" height="56" rx="6" fill="#d8e8ef"/><rect x="105" y="30" width="65" height="56" rx="6" fill="#d8e8ef"/><rect x="181" y="30" width="50" height="56" rx="6" fill="#f1e7d9" stroke="#cda777" stroke-dasharray="4 3"/><text x="61" y="66" text-anchor="middle" fill="#3e6a85" font-size="26" font-family="Georgia" font-style="italic">x</text><text x="137" y="66" text-anchor="middle" fill="#3e6a85" font-size="26" font-family="Georgia" font-style="italic">x</text><text x="206" y="65" text-anchor="middle" fill="#a27448" font-size="23" font-family="Georgia">−x</text><path d="M41 98h177" stroke="#9db5c1" stroke-width="1.5"/></svg>';
 return '<svg viewBox="0 0 260 120" aria-hidden="true"><path d="M55 98 221 98 111 11Z" fill="#f3ddbc" opacity=".6"/><path d="M55 98h166M55 98l56-87" stroke="#9c6c42" stroke-width="2.2" fill="none"/><path d="m55 98 132-73" stroke="#376c57" stroke-width="2.3"/><path d="M103 98a48 48 0 0 0-9-28m-3 28a36 36 0 0 0-7-21" fill="none" stroke="#b78b5e" stroke-width="1.2"/><text x="54" y="115" text-anchor="middle" fill="#7b705d" font-size="11">O</text><text x="156" y="87" fill="#8e6a48" font-size="14" font-family="Georgia">α</text><text x="123" y="51" fill="#386752" font-size="14" font-family="Georgia">α</text></svg>';
}
function latestForModule(id) { return sortedRounds().find(round=>round.moduleId===id); }
function continuation() {
 const progress = Object.entries(S.data.progress || {}).filter(([id])=>moduleOf(id)).sort((a,b)=>new Date(b[1].updatedAt)-new Date(a[1].updatedAt))[0];
 if(progress) {
  if(progress[1].mode==='learn')return {type:'learn',moduleId:progress[0],description:'回到上次的学习位置'};
  const unfinished=sortedRounds().find(round=>round.moduleId===progress[0]&&!round.summary.finished);
  return unfinished?{type:'round',id:unfinished.id,moduleId:unfinished.moduleId,description:`本轮已完成 ${unfinished.summary.completed} / 5 题`}:null;
 }
 const unfinished=sortedRounds().find(round=>!round.summary.finished);
 return unfinished?{type:'round',id:unfinished.id,moduleId:unfinished.moduleId,description:`本轮已完成 ${unfinished.summary.completed} / 5 题`}:null;
}
function homePage() {
 const resume = continuation();
 return `<div class="page-intro"><div><p class="eyebrow">七年级数学 / 上册</p><h1>${esc(currentProfile()?.name || '同学')}，今天想弄懂什么？</h1><p>选一个小目标，动手探索，再用 5 道新题检验自己。</p></div><span class="tag">${S.boot.modules.length} 个小目标已上线</span></div>${resume?`<section class="continue-card" aria-label="继续上次学习"><div class="continue-icon">${icon('play')}</div><div class="text"><h2>继续学习 · ${esc(moduleOf(resume.moduleId)?.title)}</h2><p>${esc(resume.description)}</p></div><button class="primary" data-action="${resume.type==='round'?'open-round':'learn'}" data-id="${esc(resume.id || resume.moduleId)}" data-mutates>继续 ${icon('arrow')}</button></section>`:''}<div class="section-heading"><h2>从一个小问题开始</h2><p>探索 → 观察 → 练习</p></div><div class="module-grid">${availableModules().map(moduleCard).join('')}</div><div class="section-heading"><h2>最近的练习</h2><p>记录保存在运行项目的电脑上</p></div>${sortedRounds().length?`<section class="subtle-panel" aria-label="最近练习记录">${sortedRounds().slice(0,4).map(round=>`<div class="recent-row"><div class="info"><strong>${esc(moduleOf(round.moduleId)?.title || round.moduleId)}</strong><small>${dateLabel(round.createdAt)} · ${round.summary.finished?(round.summary.passed?'本轮达标':'本轮已完成'):`进行中 · 已完成 ${round.summary.completed}/5`}</small></div><div class="recent-score">${round.summary.independentCorrect}<small> / 5 首次独立</small></div><button class="compact" data-action="open-round" data-id="${esc(round.id)}" data-mutates>${round.summary.finished?'查看结果':'继续练习'}</button></div>`).join('')}</section>`:'<div class="empty-state">这里会留下你的练习记录。<br>先选一个小目标，试着做完第一组题。</div>'}`;
}
function moduleCard(module) {
 const latest = latestForModule(module.id);
 return `<article class="module-card"><div class="mini-art ${moduleTheme(module.id)}">${miniArt(module.id)}</div><div class="module-body"><div class="module-meta"><span>第${esc(module.chapter)}章 · ${esc(module.section || module.chapterTitle)}</span><span class="tag ${moduleTheme(module.id)}">已上线</span></div><h3>${esc(module.title)}</h3><p>${esc(module.goal)}</p><div class="module-actions"><button class="primary" data-action="learn" data-id="${esc(module.id)}" data-mutates>${S.data.progress?.[module.id]?'继续学习':'开始探索'}</button><button data-action="practice" data-id="${esc(module.id)}" data-mutates>${latest&&!latest.summary.finished?'继续练习':'直接练习'}</button></div></div></article>`;
}
function catalogPage() {
 return `<div class="page-intro"><div><p class="eyebrow">跟着教材，也可以自由选择</p><h1>教材目录</h1><p>整册分解为小目标。目前有 ${S.boot.modules.length} 个项目可以学习，其余内容仍在规划中。</p></div></div><div class="chapter-list">${S.boot.chapters.map(chapter=>{
 const available = availableModules().filter(module=>Number(module.chapter)===Number(chapter.number));
 const coreComplete=Number(chapter.count)>0&&available.length>=Number(chapter.count);
 return `<section class="chapter"><div class="chapter-head"><span class="chapter-number">${String(chapter.number).padStart(2,'0')}</span><h2>${esc(chapter.title)}</h2><span class="tag ${available.length?'':'gray'}">${coreComplete?`${available.length}/${Number(chapter.count)} 核心已上线`:available.length?`${available.length} 个项目已上线`:'规划中 · 未上线'}</span></div>${available.length?`<div class="chapter-content">${available.map(module=>`<div class="chapter-module"><div class="info"><h3>${esc(module.title)}</h3><p>${esc(module.goal)}</p></div><button data-action="learn" data-id="${esc(module.id)}" data-mutates>进入学习 ${icon('arrow')}</button></div>`).join('')}<p class="planning-note">${coreComplete?'本章核心项目已上线，活动与选学待扩展。':`本章其他知识点：规划中，暂不可学习${Number.isFinite(Number(chapter.count))?` · 章节计划 ${Number(chapter.count)} 个项目`:''}。`}</p></div>`:`<p class="planning-note">后续按计划加入，本章尚无可进入的学习项目${Number.isFinite(Number(chapter.count))?`（章节计划 ${Number(chapter.count)} 个项目）`:''}。</p>`}</section>`;
 }).join('')}</div>`;
}
function moduleHeader(module, active) {
 return `<div class="breadcrumb"><button data-action="nav" data-route="catalog">教材目录</button><span>/</span><span>第${esc(module.chapter)}章 ${esc(module.chapterTitle)}</span><span>/</span><span>课本 ${esc(module.pages)} 页</span></div><header class="module-header"><h1>${esc(module.title)}</h1><p class="goal">${esc(module.goal)}</p></header><nav class="mode-tabs" aria-label="知识点学习方式"><button class="${active==='learn'?'active':''}" data-action="learn" data-id="${esc(module.id)}" data-mutates ${active==='learn'?'aria-current="page"':''}><span class="step-no">01</span> 交互学习</button><button class="${active==='practice'?'active':''}" data-action="practice" data-id="${esc(module.id)}" data-mutates ${active==='practice'?'aria-current="page"':''}><span class="step-no">02</span> 练习检验</button></nav>`;
}
function defaultLab(id) {
 if(productModule(id))return productDefaults(id);
 if(id==='C2-01')return {a:-3,b:4,prediction:null,stage:0};
 if(id==='C2-02')return {start:-4,delta:2,prediction:null};
 if(id==='C2-03')return {group:0,order:[0,1,2,3],selected:0,split:2,verified:false};
 if(id==='C2-04')return {standard:500,deviations:[-2,3,-1,0],selected:0,revealed:false};
 if(id==='C2-05')return {a:0,b:-3,choice:null};
 if(id==='C2-06')return {group:0,order:[0,1,2,3],selected:0,converted:{},computed:false,feedback:null};
 if(id==='C2-07')return {a:-3,b:2,expression:null,records:[],checked:false};
 if(id==='C1-01')return {selected:0,placements:{},feedback:null};
 if(id==='C1-02')return {scene:'temperature',baseline:0,actual:5,positive:1};
 if(id==='C1-03')return {view:'integer',selected:0,placements:{integer:{},sign:{}},repeatKnown:false,feedback:null};
 if(id==='C1-09')return {a:-4,b:2,prediction:null};
 if(id==='C1-10')return {group:0,order:[0,1,2,3,4],selected:0,direction:'asc',checked:false};
 if(id==='C1-11')return {distance:3,condition:'any',selected:[],candidatesChecked:false,filterShown:false,feedback:null};
 if(id==='C1-04')return {origin:true,direction:true,even:true,unit:1,judgment:null};
 if(id==='C1-05')return {slot:0,unit:1,target:-2,targetIndex:0,checked:false};
 if(id==='C1-06')return {a:-3,flips:0};
 if(id==='C1-07')return {a:-3,signs:['-','+','-'],revealed:0};
 if(id==='C1-08')return {a:-3.5,copied:false};
 if (id==='N-NEG-COMP') return {a:-7,b:-3,prediction:null,revealed:false};
 if (id==='A-LIKE-COMBINE') return {a:3,b:-2,letters:'x',joined:false,dragged:null};
 return {angle:80,rotation:0};
}
function labState() { return S.labs[S.moduleId] ||= defaultLab(S.moduleId); }
function learningPage() {
 const module = currentModule(); if (!module) return '<p>这个知识点还未上线。</p>';
 const steps = module.learningSteps || []; S.step=clamp(S.step,0,Math.max(0,steps.length-1));
 const step = steps[S.step] || {title:'动手试一试',prompt:module.lead,instruction:'改变条件，观察变化。'};
 const lab = labState();
 return `${moduleHeader(module,'learn')}<div class="learning-layout"><div class="learning-main"><section class="lab-card" aria-label="交互学习画板"><div class="lab-toolbar"><div class="segmented" aria-label="探索方式"><button data-action="learn-mode" data-mode="guided" class="${S.learnMode==='guided'?'active':''}" aria-pressed="${S.learnMode==='guided'}">引导探索</button><button data-action="learn-mode" data-mode="free" class="${S.learnMode==='free'?'active':''}" aria-pressed="${S.learnMode==='free'}">自由操作</button></div><button class="quiet icon-button" data-action="reset-lab" aria-label="重置交互画板" title="重置">${icon('reset')}</button></div><div class="lab-step"><p class="eyebrow">${S.learnMode==='guided'?`探索 ${S.step+1} / ${Math.max(1,steps.length)}`:'自由探索 · 改变条件，发现关系'}</p><h2>${esc(S.learnMode==='guided'?step.title:module.lead || '如果改变这些条件，会怎样？')}</h2><p>${esc(S.learnMode==='guided'?(step.prompt || step.instruction):'拖动画板中的标记，或使用下方滑块。随时可以重置。')}</p>${S.learnMode==='guided'&&step.prompt&&step.instruction?`<p>${esc(step.instruction)}</p>`:''}</div><div id="lab-board" class="lab-board"><svg id="lab-svg" class="lab-svg ${foundationModule(S.moduleId)?'foundation-lab':arithmeticModule(S.moduleId)?'arithmetic-lab':''}" viewBox="0 0 760 ${labHeight(S.moduleId)}" role="img" aria-label="${esc(module.title)}可操作画板"></svg></div><div class="lab-controls">${labControls(lab)}</div><div id="lab-observation" class="lab-observation" aria-live="polite"></div></section><div class="lab-footer"><div class="step-dots" aria-label="引导学习进度">${steps.map((_,index)=>`<span class="${index===S.step?'current':''}"></span>`).join('')}</div><div>${S.learnMode==='guided'&&S.step>0?'<button class="quiet" data-action="learn-step" data-delta="-1" data-mutates>上一步</button>':''}${S.learnMode==='guided'&&S.step<steps.length-1?'<button data-action="learn-step" data-delta="1" data-mutates>接着探索 '+icon('arrow')+'</button>':`<button class="primary" data-action="practice" data-id="${esc(module.id)}" data-mutates>用 5 道题试一试 ${icon('arrow')}</button>`}</div></div><div id="save-state" class="save-state" aria-live="polite"></div></div><aside class="side-stack"><section class="info-card rule"><h2>记住这个关系</h2><p>${esc(module.rule)}</p></section><section class="info-card"><h2>一个例子</h2><p class="example-question math">${esc(module.example?.question)}</p><p class="example-answer math">${esc(module.example?.answer)}</p>${(module.example?.steps || []).map(text=>`<p>${esc(text)}</p>`).join('')}</section><section class="info-card prereq-card"><details class="prereq"><summary>先回顾一下</summary><ul>${(module.prerequisites || []).map(text=>`<li>${esc(text)}</li>`).join('')}</ul>${prerequisiteLinks(module)}</details></section></aside></div>`;
}
function rangeControl(label, key, value, min, max, step, theme='',unit='') {
 return `<div class="control-row ${theme}"><label for="control-${key}">${label}</label><input id="control-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-control="${key}" aria-label="${label}"><output id="output-${key}" for="control-${key}">${pretty(value)}${unit}</output></div>`;
}
function labControls(lab) {
 if(arithmeticModule(S.moduleId))return arithmeticControls(lab);
 if(expansionModule(S.moduleId))return expansionControls(lab);
 if(S.moduleId==='C1-04')return `<div class="axis-toggles">${[['origin','标出原点 0'],['direction','箭头标正方向'],['even','等格表示等量']].map(([key,label])=>`<label><input type="checkbox" data-axis-toggle="${key}" ${lab[key]?'checked':''}><span>${label}</span></label>`).join('')}</div>${unitControl(lab.unit)}<p class="control-note">本项目约定用箭头标正方向。每小格代表的数可以改变，相同数值长度对应的格数也会改变。</p>`;
 if(S.moduleId==='C1-05')return unitControl(lab.unit)+rangeControl('点 A 位置','slot',lab.slot,-5,5,.5)+`<div class="lab-local-actions"><button data-action="check-position">检验位置</button><button class="quiet" data-action="new-position-target">换个目标</button></div>`;
 if(S.moduleId==='C1-06')return rangeControl('原来的数','a',lab.a,-5,5,.5)+`<div class="lab-local-actions"><button data-action="opposite-flip">${lab.flips===0?'取一次相反数':lab.flips===1?'再取一次相反数':'重新观察'}</button><button class="quiet" data-action="zero-number">看看 0</button></div>`;
 if(S.moduleId==='C1-07')return rangeControl('初始的数','a',lab.a,-4,4,.5)+`<div class="control-row"><label for="control-layers">符号层数</label><select id="control-layers" data-control="layers">${[1,2,3,4].map(value=>`<option value="${value}" ${lab.signs.length===value?'selected':''}>${value} 层</option>`).join('')}</select><span class="small muted">由内向外</span></div><div class="sign-controls">${lab.signs.map((sign,index)=>`<label for="sign-${index}"><span>第 ${index+1} 层${index===0?'（最内层）':''}</span><select id="sign-${index}" data-sign-index="${index}"><option value="+" ${sign==='+'?'selected':''}>＋ 保持原数</option><option value="-" ${sign==='-'?'selected':''}>− 取相反数</option></select></label>`).join('')}</div><div class="lab-local-actions"><button data-action="simplify-layer">${lab.revealed<lab.signs.length?'由内向外化简一步':'从头再看'}</button><button class="quiet" data-action="zero-number">看看 0</button></div>`;
 if(S.moduleId==='C1-08')return rangeControl('有理数 a','a',lab.a,-5,5,.5)+`<div class="lab-local-actions"><button data-action="copy-distance">${lab.copied?'长度已移到下方':'把长度移到下方量尺'}</button><button class="quiet" data-action="zero-number">看看 0</button></div>`;
 if(S.moduleId==='N-NEG-COMP') return rangeControl('点 A','a',lab.a,-10,-.5,.5)+rangeControl('点 B','b',lab.b,-10,-.5,.5,'orange');
 if(S.moduleId==='A-LIKE-COMBINE') return rangeControl('系数 a','a',lab.a,-5,5,1,'blue')+rangeControl('系数 b','b',lab.b,-5,5,1,'orange')+`<div class="control-row"><label for="control-letters">字母部分</label><select id="control-letters" data-control="letters"><option value="x" ${lab.letters==='x'?'selected':''}>x</option><option value="x²" ${lab.letters==='x²'?'selected':''}>x²</option><option value="ab" ${lab.letters==='ab'?'selected':''}>ab</option></select><span class="small muted">不变</span></div>`;
 return rangeControl('整个角','angle',lab.angle,20,160,2,'orange','°')+rangeControl('旋转图形','rotation',lab.rotation,-45,45,1,'','°');
}
function unitControl(unit){return `<div class="control-row"><label for="control-unit">每小格</label><select id="control-unit" data-control="unit">${[.5,1,2].map(value=>`<option value="${value}" ${unit===value?'selected':''}>代表 ${value}</option>`).join('')}</select><output id="output-unit">${unit}</output></div>`;}
function signBin(value){return value===0?'zero':value>0?'positive':'negative';}
function classificationBins(view='sign'){return view==='integer'?[['integer','整数'],['fraction','分数（非整数）']]:[['negative','负数'],['zero','0'],['positive','正数']];}
function candidateValues(distance){return distance===0?[-1,0,1]:[-distance,0,distance];}
function distanceCandidates(distance){return distance===0?[0]:[-distance,distance];}
function filteredCandidates(lab){return distanceCandidates(lab.distance).filter(value=>lab.condition==='any'||(lab.condition==='positive'?value>0:value<0));}
function cardsForSort(lab){return sortGroups[lab.group];}
function sortIsCorrect(lab){const cards=cardsForSort(lab);return lab.order.every((card,index)=>index===0||(lab.direction==='asc'?cards[lab.order[index-1]].value<=cards[card].value:cards[lab.order[index-1]].value>=cards[card].value));}
function expansionControls(lab){
 const id=S.moduleId;
 if(id==='C1-01'||id==='C1-03'){
  const cards=id==='C1-01'?signCards:typeCards,view=id==='C1-01'?'sign':lab.view,placements=id==='C1-01'?lab.placements:lab.placements[view],selected=cards[lab.selected];
  const bins=classificationBins(view);
  return `${id==='C1-03'?`<div class="classification-view segmented" aria-label="切换分类依据"><button data-action="classification-view" data-value="integer" class="${view==='integer'?'active':''}">整数 / 分数</button><button data-action="classification-view" data-value="sign" class="${view==='sign'?'active':''}">正数 / 负数 / 0</button></div>`:''}<p class="control-note">先选择一张数卡，再选择分类箱。${id==='C1-03'?'看数值本身，不只看小数点、分数线或百分号。':'0 既不是正数，也不是负数。'}</p><div class="number-card-grid" aria-label="待分类数卡">${cards.map((card,index)=>`<button class="number-card ${card.repeat?'repeating-card':''} ${lab.selected===index?'selected':''} ${placements[index]||(card.repeat&&lab.repeatKnown)?'placed':''}" data-action="select-number-card" data-index="${index}" aria-pressed="${lab.selected===index}"><span class="math">${esc(card.label)}</span><small>${card.repeat&&lab.repeatKnown?'已识别为有理数':placements[index]?bins.find(bin=>bin[0]===placements[index])?.[1] || '已分类':'待判断'}</small></button>`).join('')}</div>${selected.repeat?`<p class="control-note">这张循环小数卡只判断是否为有理数，不要求化成分数。</p><div class="classification-bins"><button data-action="classify-number" data-value="rational">是有理数</button><button data-action="classify-number" data-value="not-rational">不是有理数</button></div>`:`<div class="classification-bins" aria-label="分类箱">${bins.map(([key,label])=>`<button data-action="classify-number" data-value="${key}"><strong>${label}</strong><small>${Object.values(placements).filter(value=>value===key).length} 张已放入</small></button>`).join('')}</div>`}`;
 }
 if(id==='C1-02'){
  const scene=quantityScenes[lab.scene];
  return `<div class="control-row"><label for="control-scene">情境</label><select id="control-scene" data-control="scene">${Object.entries(quantityScenes).map(([key,entry])=>`<option value="${key}" ${lab.scene===key?'selected':''}>${entry.name}</option>`).join('')}</select><span class="small muted">${scene.unit}</span></div>${rangeControl(scene.baselineLabel,'baseline',lab.baseline,scene.min,scene.max,.5,'orange',scene.unit)}${rangeControl(scene.actualLabel,'actual',lab.actual,scene.min,scene.max,.5,'blue',scene.unit)}<div class="control-row"><label for="control-positive">正的约定</label><select id="control-positive" data-control="positive"><option value="1" ${lab.positive===1?'selected':''}>${scene.increase}</option><option value="-1" ${lab.positive===-1?'selected':''}>${scene.decrease}</option></select><span class="small muted">可改变</span></div><div class="lab-local-actions"><button data-action="actual-at-baseline">让实际量等于基准</button></div>`;
 }
 if(id==='C1-09')return rangeControl('点 A','a',lab.a,-5,5,.5)+rangeControl('点 B','b',lab.b,-5,5,.5,'orange')+`<div class="lab-local-actions"><button data-action="distance-symmetric">试试相反数</button><button class="quiet" data-action="distance-zero">让 A 在 0</button></div>`;
 if(id==='C1-10'){
  const cards=cardsForSort(lab);
  return `<div class="classification-view segmented" aria-label="排序方向"><button data-action="sort-direction" data-value="asc" class="${lab.direction==='asc'?'active':''}">从小到大</button><button data-action="sort-direction" data-value="desc" class="${lab.direction==='desc'?'active':''}">从大到小</button></div><p class="control-note">先化简每张卡，再选择卡片，用左右按钮调整顺序；核对后才显示数轴位置。</p><div class="sort-card-row" aria-label="可调整的数卡顺序">${lab.order.map((card,index)=>`<button class="number-card ${lab.selected===card?'selected':''}" data-action="select-sort-card" data-index="${card}" aria-pressed="${lab.selected===card}"><small>${String.fromCharCode(65+card)}</small><span class="math">${esc(cards[card].label)}</span><small>第 ${index+1} 位</small></button>`).join('')}</div><div class="lab-local-actions"><button data-action="move-sort-card" data-delta="-1" ${lab.order.indexOf(lab.selected)===0?'disabled':''}>选中卡向左移</button><button data-action="move-sort-card" data-delta="1" ${lab.order.indexOf(lab.selected)===lab.order.length-1?'disabled':''}>向右移</button><button class="primary" data-action="check-sort">核对排序与数轴</button><button class="quiet" data-action="new-sort-group">换一组</button></div>`;
 }
 return `${rangeControl('已知距离','distance',lab.distance,0,5,.5)}<p id="candidate-instruction" class="control-note">第 1 步：选出所有满足 |a| = ${pretty(lab.distance)} 的候选数，可多选。</p><div id="candidate-options" class="candidate-options">${candidateButtons(lab)}</div><div class="lab-local-actions"><button data-action="check-candidates">检验全部候选</button></div><div class="control-row"><label for="control-condition">再加条件</label><select id="control-condition" data-control="condition"><option value="any" ${lab.condition==='any'?'selected':''}>不限定正负</option><option value="positive" ${lab.condition==='positive'?'selected':''}>a 是正数</option><option value="negative" ${lab.condition==='negative'?'selected':''}>a 是负数</option></select><span class="small muted">第 2 步</span></div><div class="lab-local-actions"><button data-action="filter-candidates" ${lab.candidatesChecked?'':'disabled'}>按条件筛选</button></div>`;
}
function redrawLocalControls(){
 const active=document.activeElement,action=active?.dataset?.action,index=active?.dataset?.index,value=active?.dataset?.value,delta=active?.dataset?.delta;
 const controls=$('.lab-controls');if(!controls)return;
 controls.innerHTML=labControls(labState());drawLab();
 if(action){const selector=`[data-action="${action}"]${index!==undefined?`[data-index="${index}"]`:''}${value!==undefined?`[data-value="${value}"]`:''}${delta!==undefined?`[data-delta="${delta}"]`:''}`;$(selector,controls)?.focus({preventScroll:true});}
}
function candidateButtons(lab){return candidateValues(lab.distance).map(value=>`<button data-action="toggle-candidate" data-value="${value}" class="${lab.selected.includes(value)?'selected':''}" aria-pressed="${lab.selected.includes(value)}"><span class="math">${signed(value)}</span></button>`).join('');}
function classifySelectedCard(lab,choice){
 const isTypes=S.moduleId==='C1-03',cards=isTypes?typeCards:signCards,card=cards[lab.selected],view=isTypes?lab.view:'sign';
 if(card.repeat){const correct=choice==='rational';if(correct)lab.repeatKnown=true;lab.feedback={correct,message:correct?'判断正确：这是循环小数，属于有理数。':'再想一想：有限小数和循环小数都属于有理数。'};return;}
 const expected=view==='integer'?(Number.isInteger(card.value)?'integer':'fraction'):signBin(card.value),correct=choice===expected;
 if(correct)(isTypes?lab.placements[view]:lab.placements)[lab.selected]=expected;
 const reason=card.value===0?`${card.label} 的数值是 0，${isTypes?'0 是整数，':''}既不是正数也不是负数。`:view==='integer'?Number.isInteger(card.value)?`${card.label} 的数值是整数 ${signed(card.value)}，不能只看它的写法。`:`${card.label} 不是整数，按本册分类归入分数（非整数）。`:`${card.label} 的数值${card.value>0?'大于':'小于'} 0，属于${card.value>0?'正':'负'}数。`;
 lab.feedback={correct,message:`${correct?'分类正确。':'再按数值核对。'}${reason}`};
}
function prerequisiteLinks(module){
 const prerequisites=(module.prerequisiteIds || []).map(id=>moduleOf(id)).filter(Boolean);
 return prerequisites.length?`<div class="prerequisite-links">${prerequisites.map(item=>`<button data-action="learn" data-id="${esc(item.id)}" data-mutates>补学：${esc(item.title)} ${icon('arrow')}</button>`).join('')}</div>`:'';
}
function axisX(position,min=-5,max=5){return 80+(Number(position)-min)/(max-min)*600;}
function lineSVG({min=-5,max=5,ticks=[],points=[],arrow=true,originVisible=true,y=150,uneven=false}){
 if(!Number.isFinite(Number(min))||!Number.isFinite(Number(max))||max<=min)return '<text x="380" y="130" text-anchor="middle">题图暂时无法显示，请重新载入。</text>';
 const x=position=>axisX(position,min,max)+(uneven&&Number(position)===2?25:0);
 return `<path d="M65 ${y}H701${arrow?`m-10-6 10 6-10 6`:''}" fill="none" stroke="#6b8261" stroke-width="2"/>${ticks.filter(tick=>Number.isFinite(Number(tick.position))).map(tick=>`<path d="M${x(tick.position)} ${y-7}v14" stroke="#9cab94" stroke-width="1.5"/>${tick.label!==undefined&&!(Number(tick.position)===0&&!originVisible)?`<text x="${x(tick.position)}" y="${y+34}" text-anchor="middle" font-size="17">${esc(tick.label)}</text>`:''}`).join('')}${originVisible&&min<=0&&max>=0?`<circle cx="${x(0)}" cy="${y}" r="3" fill="#718869"/>`:''}${points.filter(point=>Number.isFinite(Number(point.position))).map((point,index)=>`<path d="M${x(point.position)} ${y-16}V${y-49-(index%2)*25}" stroke="#c5d1bc" stroke-dasharray="3 4"/><circle cx="${x(point.position)}" cy="${y}" r="7" fill="${index%2?'#ac7c48':'#397599'}" stroke="#fff" stroke-width="2"/><text x="${x(point.position)}" y="${y-59-(index%2)*25}" text-anchor="middle" font-size="21">${esc(point.label)}</text>`).join('')}`;
}
function regularTicks(unit=1,min=-5,max=5){return Array.from({length:max-min+1},(_,index)=>({position:min+index,label:signed((min+index)*unit)}));}
function axisCheckSVG(variant,unit=1){
 return lineSVG({min:-3,max:3,ticks:regularTicks(unit,-3,3),arrow:variant!=='no-direction',originVisible:variant!=='no-origin',uneven:variant==='uneven-units'});
}
function reflectionSVG(from,to,y=150){
 if(from===to)return '';
 const a=axisX(from),b=axisX(to),direction=b>a?1:-1;
 return `<path d="M${a} ${y-27}Q380 ${y-145} ${b} ${y-27}m${-direction*10} -5 ${direction*10} 5 ${-direction*2} -11" fill="none" stroke="#b6986c" stroke-width="2"/>`;
}
function symbolExpression(value,signs){return signs.reduce((expression,sign)=>`${sign==='-'?'−':'＋'}(${expression})`,signed(value));}
function symbolValue(lab,count=lab.revealed){return lab.signs.slice(0,count).reduce((value,sign)=>sign==='-'?-value:value,lab.a)||0;}
function drawExpansionLab(svg,observation,lab){
 const id=S.moduleId;
 if(id==='C1-01'||id==='C1-03'){
  const cards=id==='C1-01'?signCards:typeCards,view=id==='C1-01'?'sign':lab.view,placements=id==='C1-01'?lab.placements:lab.placements[view],bins=classificationBins(view),selected=cards[lab.selected];
  svg.innerHTML=`<text x="380" y="37" text-anchor="middle" font-size="22">${id==='C1-01'?'根据数与 0 的关系分类':'同一个有理数，可以按不同标准分类'}</text>${bins.map(([key,label],index)=>{const width=bins.length===2?260:185,x=bins.length===2?100+index*300:70+index*220;return `<rect x="${x}" y="75" width="${width}" height="95" rx="9" fill="${key==='zero'?'#f4ebdb':'#e8efe3'}" stroke="#cbd7c2"/><text x="${x+width/2}" y="112" text-anchor="middle" font-size="22">${label}</text><text x="${x+width/2}" y="145" text-anchor="middle" font-size="17">${Object.values(placements).filter(value=>value===key).length} 张已归类</text>`;}).join('')}`;
  const repeatMessage=selected.repeat?'循环小数属于有理数；这里只识别它的范围，不要求化成分数。':`当前卡片是 ${selected.label}。${id==='C1-03'?'判断它实际表示的数，再按当前标准分类。':'0 不属于正数或负数，百分数也要看其实际数值与 0 的关系。'}`;
  observation.innerHTML=`<p><strong>${lab.feedback?esc(lab.feedback.message):'先选数卡，再选分类箱。'}</strong><br>${esc(repeatMessage)}</p>`;
 }else if(id==='C1-02'){
  const scene=quantityScenes[lab.scene],x=value=>axisX(value,scene.min,scene.max),difference=(lab.actual-lab.baseline)*lab.positive,representation=difference>0?`＋${pretty(difference)}`:signed(difference);
  svg.innerHTML=`<text x="380" y="35" text-anchor="middle" font-size="20">${scene.name}：实际量不变，基准或正的约定可以改变</text><path d="M65 155H701" stroke="#91a78a" stroke-width="2"/>${Array.from({length:5},(_,index)=>{const value=scene.min+(scene.max-scene.min)*index/4;return `<path d="M${x(value)} 148v14" stroke="#a6b69d"/><text x="${x(value)}" y="190" text-anchor="middle" font-size="17">${signed(value)}</text>`;}).join('')}<path d="M${x(lab.baseline)} 110v73" stroke="#b18b58" stroke-width="2" stroke-dasharray="4 4"/><text x="${x(lab.baseline)}" y="100" text-anchor="middle" font-size="18">基准 ${signed(lab.baseline)}${scene.unit}</text><text x="${x(lab.actual)}" y="65" text-anchor="middle" font-size="20">实际 ${signed(lab.actual)}${scene.unit}</text>${handle({key:'actual',x:x(lab.actual),y:155,label:scene.actualLabel,value:lab.actual,min:scene.min,max:scene.max,color:'#397599',text:`${scene.actualLabel}${lab.actual}${scene.unit}`})}<text x="380" y="226" text-anchor="middle" font-size="15">上方为实际量刻度；相对基准的 0 位于 ${signed(lab.baseline)}${scene.unit}</text><path d="M${lab.positive===1?320:440} 260H${lab.positive===1?440:320}m${lab.positive===1?-9:9}-5 ${lab.positive===1?9:-9} 5 ${lab.positive===1?-9:9} 5" stroke="#a17f4f" stroke-width="2" fill="none"/><text x="380" y="291" text-anchor="middle" font-size="15">${lab.positive===1?scene.increase:scene.decrease}</text>`;
  observation.innerHTML=`<p><strong>相对基准的量 / 偏差：${representation}${scene.unit}</strong><br>${scene.actualLabel}是 ${signed(lab.actual)}${scene.unit}，基准是 ${signed(lab.baseline)}${scene.unit}。${difference===0?'实际量等于基准，偏差为 0，不表示实际量本身一定是 0。':`根据“${lab.positive===1?scene.increase:scene.decrease}”的约定，偏差记为 ${representation}${scene.unit}；它与实际量是不同的描述。`}</p>`;
  for(const key of ['baseline','actual']){const output=$(`#output-${key}`);if(output)output.textContent=`${signed(lab[key])}${scene.unit}`;const control=$(`#control-${key}`);if(control)control.value=lab[key];}
 }else if(id==='C1-09'){
  const a=Math.abs(lab.a),b=Math.abs(lab.b),answer=a===b?'same':a<b?'a':'b';
  svg.innerHTML=`${lineSVG({ticks:regularTicks()})}<text x="${axisX(lab.a)}" y="62" text-anchor="middle" font-size="22">A = ${signed(lab.a)}</text><text x="${axisX(lab.b)}" y="98" text-anchor="middle" font-size="22">B = ${signed(lab.b)}</text>${handle({key:'a',x:axisX(lab.a),y:150,label:'点 A',value:lab.a,min:-5,max:5})}${handle({key:'b',x:axisX(lab.b),y:150,label:'点 B',value:lab.b,min:-5,max:5,color:'#b27d45'})}${[['a',lab.a,217,'#83a17b'],['b',lab.b,255,'#c79c68']].map(([key,value,y,color])=>`<path d="M${Math.min(axisX(value),380)} ${y}H${Math.max(axisX(value),380)}" stroke="${color}" stroke-width="6" fill="none"/><path d="M${axisX(value)} ${y-5}v10M380 ${y-5}v10" stroke="${color}" stroke-width="2"/><text x="715" y="${y-10}" text-anchor="end" font-size="16">${key.toUpperCase()} 到 0${lab.prediction!==null?'：'+pretty(Math.abs(value)):''}</text>`).join('')}`;
  observation.innerHTML=`<p><strong>${lab.prediction===null?'先判断：哪个点离 0 更近？':`${lab.prediction===answer?'判断正确。':'比较的是距离，再看长度。'}${answer==='same'?'两个点一样远。':`点 ${answer.toUpperCase()} 更近。`}`}</strong><br>${lab.prediction===null?'比较点到 0 的无方向长度，不直接比较两个有理数本身的大小。':`|${signed(lab.a)}| = ${pretty(a)}，|${signed(lab.b)}| = ${pretty(b)}。${answer==='same'?'绝对值相等，因此距离相等。':'绝对值较小的点离 0 更近。'}`}</p><div class="predict-row">${[['a','A 较近'],['b','B 较近'],['same','一样远']].map(([value,label])=>`<button data-action="compare-distance" data-value="${value}" class="${lab.prediction===value?'selected':''}">${label}</button>`).join('')}</div>`;
  for(const key of ['a','b']){const output=$(`#output-${key}`);if(output)output.textContent=signed(lab[key]);const control=$(`#control-${key}`);if(control)control.value=lab[key];}
 }else if(id==='C1-10'){
  const cards=cardsForSort(lab),correct=sortIsCorrect(lab);
  svg.innerHTML=lab.checked?`${lineSVG({ticks:regularTicks(),points:cards.map((card,index)=>({position:card.value,label:String.fromCharCode(65+index)}))})}<text x="380" y="257" text-anchor="middle" font-size="17">核对实际位置：数轴上越靠右，数越大</text>`:`<text x="380" y="48" text-anchor="middle" font-size="22">先按${lab.direction==='asc'?'从小到大':'从大到小'}排列下面的卡片</text><path d="M105 150H655" stroke="#cad8c1" stroke-dasharray="7 6"/>${lab.order.map((card,index)=>`<rect x="${100+index*120}" y="107" width="80" height="78" rx="8" fill="#edf2e7" stroke="#c9d6bf"/><text x="${140+index*120}" y="154" text-anchor="middle" font-size="28">${String.fromCharCode(65+card)}</text>`).join('')}<text x="380" y="242" text-anchor="middle" font-size="16">这是顺序草案；点击核对后才显示数轴位置</text>`;
  observation.innerHTML=`<p><strong>${lab.checked?(correct?'排序正确。':'还需要调整顺序。'):'选一张卡，用按钮把它移到合适的位置。'}</strong><br>${lab.checked?`当前数值顺序：${lab.order.map(card=>signed(cards[card].value)).join('，')}。${lab.direction==='asc'?'应从较小的数排到较大的数。':'应从较大的数排到较小的数，与数轴从右向左的方向一致。'}`:'带有括号或绝对值的卡先化简，再进行大小比较；数卡表达式不同，比较的仍是数值。'}</p>`;
 }else{
  const actualCandidates=distanceCandidates(lab.distance),filtered=filteredCandidates(lab),values=candidateValues(lab.distance);
  svg.innerHTML=`<text x="380" y="37" text-anchor="middle" font-size="25">已知 |a| = ${pretty(lab.distance)}</text>${lineSVG({ticks:regularTicks()})}${values.map((value,index)=>{const chosen=lab.filterShown?filtered.includes(value):lab.selected.includes(value);return `<circle cx="${axisX(value)}" cy="150" r="${chosen?9:6}" fill="${chosen?'#397f67':'#b9c5b0'}" stroke="#fff" stroke-width="2"/><text x="${axisX(value)}" y="${index===1?104:75}" text-anchor="middle" font-size="20">${signed(value)}</text>`;}).join('')}<text x="380" y="256" text-anchor="middle" font-size="18">${lab.filterShown?(filtered.length?'符合条件：'+filtered.map(signed).join('，'):'没有符合条件的值'):lab.candidatesChecked?'已找全距离相等的候选，再按条件筛选':'先选出所有到 0 距离为 '+pretty(lab.distance)+' 的候选'}</text>`;
  observation.innerHTML=`<p><strong>${lab.filterShown?(filtered.length?'已完成候选与条件的两次核对。':'没有符合条件的值。'):lab.feedback?esc(lab.feedback.message):'先找全部候选，再考虑附加的正负条件。'}</strong><br>${lab.filterShown?lab.distance===0?`距离为 0 时，唯一候选是 0。${lab.condition==='any'?'不限定正负时结果只有 0。':'0 既不是正数也不是负数，所以没有符合条件的值。'}`:`全部候选为 ${actualCandidates.map(signed).join(' 与 ')}。根据${lab.condition==='any'?'不限定正负':lab.condition==='positive'?'a 是正数':'a 是负数'}的条件，${filtered.length?'保留 '+filtered.map(signed).join('，'):'没有可保留的数'}。`:lab.distance===0?'注意 0 到原点的距离为 0，同一个点只算一个候选。':'左右两侧都要检查；先不因为正负条件而漏掉距离相等的候选。'}</p>`;
  const output=$('#output-distance');if(output)output.textContent=pretty(lab.distance);
  const choices=$('#candidate-options');if(choices)choices.innerHTML=candidateButtons(lab);
  const instruction=$('#candidate-instruction');if(instruction)instruction.textContent=`第 1 步：选出所有满足 |a| = ${pretty(lab.distance)} 的候选数，可多选。`;
  const filterButton=$('[data-action="filter-candidates"]');if(filterButton)filterButton.disabled=!lab.candidatesChecked;
 }
}
function drawFoundationLab(svg,observation,lab){
 const id=S.moduleId;
 if(id==='C1-04'){
  const ticks=regularTicks(lab.unit,-4,4).map(tick=>({...tick,label:lab.origin&&lab.direction?tick.label:Number(tick.position)===0&&lab.origin?'0':undefined}));
  svg.innerHTML=`<text x="380" y="45" text-anchor="middle" font-size="21">检查这条直线的数轴画法</text>${lineSVG({min:-4,max:4,ticks,arrow:lab.direction,originVisible:lab.origin,uneven:!lab.even})}<path d="M380 222h75m-75-6v12m75-12v12" fill="none" stroke="#b49a70" stroke-width="2"/><text x="417" y="254" text-anchor="middle" font-size="16">${lab.even?`每小格代表 ${lab.unit}`:'格与格不再等距'}</text>`;
  const valid=lab.origin&&lab.direction&&lab.even;
  const reasons=[!lab.origin?'缺少标为 0 的原点':'',!lab.direction?'缺少表示正方向的箭头':'',!lab.even?'相同数值增量对应的格长不一致':''].filter(Boolean);
  observation.innerHTML=`<p><strong>${lab.judgment===null?'按约定的规范画法，这是一条数轴吗？':`${lab.judgment===valid?'判断正确。':'再核对三个要素。'}${valid?'这条图符合本项目约定的数轴画法。':'这条图还不符合约定。'}`}</strong><br>${lab.judgment===null?'请检查原点、正方向，以及同样的格长是否代表同样的数值长度。':valid?`每小格代表 ${lab.unit}，数值 1 的单位长度对应 ${pretty(1/lab.unit)} 小格。`:esc(reasons.join('；'))+'。'}</p><div class="predict-row"><button data-action="axis-judge" data-value="yes" class="${lab.judgment===true?'selected':''}">是，符合约定</button><button data-action="axis-judge" data-value="no" class="${lab.judgment===false?'selected':''}">还不符合</button></div>`;
 }else if(id==='C1-05'){
  const value=lab.slot*lab.unit;
  svg.innerHTML=`<text x="380" y="42" text-anchor="middle" font-size="23">目标：把点 A 放在表示 ${signed(lab.target)} 的位置</text>${lineSVG({ticks:regularTicks(lab.unit)})}${lab.checked?`<text x="${axisX(lab.slot)}" y="93" text-anchor="middle" font-size="21">A = ${signed(value)}</text>`:`<text x="${axisX(lab.slot)}" y="93" text-anchor="middle" font-size="21">A</text>`}<path d="M${axisX(lab.slot)} 111v24" stroke="#b9cbb1" stroke-dasharray="3 3"/>${handle({key:'slot',x:axisX(lab.slot),y:150,label:'拖动点 A 定位目标数',value:lab.slot,min:-5,max:5,color:'#397599',text:lab.checked?`点 A 表示 ${value}`:'移动点 A，完成后检验位置'})}<text x="380" y="248" text-anchor="middle" font-size="16">每小格代表 ${lab.unit}，数值 1 对应 ${pretty(1/lab.unit)} 小格</text>`;
  observation.innerHTML=`<p><strong>${lab.checked?(value===lab.target?'位置正确。':`这个位置表示 ${signed(value)}，再调整一下。`):'先定位，再检验。'}</strong><br>${lab.checked?`从 0 出发，${value<0?'向左':value>0?'向右':'不需要移动'}${value===0?'':` ${pretty(Math.abs(lab.slot))} 小格`}，读数为 ${signed(value)}。`: `目标数是 ${signed(lab.target)}。改变每小格代表的数后，目标不变，但它所在的位置可能改变。`}</p>`;
 }else if(id==='C1-06'){
  const current=lab.flips%2?-lab.a:lab.a;
  svg.innerHTML=`${lineSVG({ticks:regularTicks()})}${lab.flips?reflectionSVG(lab.flips===1?lab.a:-lab.a,current):''}<text x="${axisX(lab.a)}" y="105" text-anchor="middle" font-size="19">A = ${signed(lab.a)}</text>${handle({key:'a',x:axisX(lab.a),y:150,label:'原数 A',value:lab.a,min:-5,max:5})}${lab.flips?`<circle cx="${axisX(current)}" cy="150" r="7" fill="#b47e49" stroke="#fff" stroke-width="2"/><text x="${axisX(current)}" y="75" text-anchor="middle" font-size="21">${lab.flips===1?'B':'C'} = ${signed(current)}</text>`:''}<path d="M${Math.min(axisX(lab.a),380)} 224H${Math.max(axisX(lab.a),380)}m0-5v10" stroke="#a8bea0" stroke-width="4" fill="none"/><text x="380" y="270" text-anchor="middle" font-size="16">原数到 0 的距离：${pretty(Math.abs(lab.a))}</text>`;
  observation.innerHTML=`<p><strong>${lab.flips===0?'取相反数，点会到哪里？':lab.a===0?'0 的相反数仍是 0。':lab.flips===1?`${signed(lab.a)} 的相反数是 ${signed(current)}。`:'连续取两次相反数，回到原来的数。'}</strong><br>${lab.a===0?'原点关于自身翻转，位置没有改变；0 的相反数只有 0。':lab.flips===0?'改变原来的数，再按按钮观察它关于 0 翻转。':lab.flips===2?`取一次相反数到达另一侧，再取一次回到原来位置；到 0 的距离始终为 ${pretty(Math.abs(lab.a))}。`:`原数与它的相反数分处 0 两侧，到 0 的距离都为 ${pretty(Math.abs(lab.a))}。`}</p>`;
 }else if(id==='C1-07'){
  const value=symbolValue(lab),remaining=lab.signs.slice(lab.revealed),expression=symbolExpression(value,remaining);
  svg.innerHTML=`<text x="380" y="39" text-anchor="middle" font-size="25">${esc(expression)}</text><text x="380" y="69" text-anchor="middle" font-size="14" fill="#71836b">已处理 ${lab.revealed} / ${lab.signs.length} 层外加符号</text>${lineSVG({ticks:regularTicks(),y:190})}${lab.revealed&&lab.signs[lab.revealed-1]==='-'?reflectionSVG(symbolValue(lab,lab.revealed-1),value,190):''}${handle({key:'a',x:axisX(lab.a),y:190,label:'改变初始有理数',value:lab.a,min:-4,max:4,color:'#a9b99f',text:`初始数 ${lab.a}`})}<circle cx="${axisX(value)}" cy="190" r="8" pointer-events="none" fill="#397599" stroke="#fff" stroke-width="2"/><text x="${axisX(value)}" y="256" text-anchor="middle" font-size="20">当前内层结果：${signed(value)}</text>`;
  observation.innerHTML=`<p><strong>${lab.revealed===0?'从最内层的外加符号开始，一次处理一层。':lab.revealed===lab.signs.length?`全部化简后，结果为 ${signed(value)}。`:`第 ${lab.revealed} 层：${lab.signs[lab.revealed-1]==='-'?'取一次相反数':'正号保持原数不变'}。`}</strong><br>${lab.revealed===0?'点表示初始的数；每处理一个负号，就关于 0 翻转一次。':`现在剩下的式子是 ${esc(expression)}。${lab.revealed===lab.signs.length?'所有外加符号都已处理，式子化为一个数。':value===0?'0 无论取多少次相反数仍为 0。':'还没处理的外层符号继续保留，不能提前忽略。'}`}</p>`;
 }else{
  const distance=Math.abs(lab.a),x=axisX(lab.a),end=200+distance*60;
  svg.innerHTML=`${lineSVG({ticks:regularTicks()})}<text x="${x}" y="80" text-anchor="middle" font-size="23">a = ${signed(lab.a)}</text>${handle({key:'a',x,y:150,label:'改变有理数 a',value:lab.a,min:-5,max:5})}<path d="M${Math.min(x,380)} 210H${Math.max(x,380)}" fill="none" stroke="#c49a65" stroke-width="7" stroke-linecap="round"/><path d="M${x} 200v20M380 200v20" stroke="#a98151" stroke-width="2"/><text x="380" y="242" text-anchor="middle" font-size="16">到 0 的长度，不带方向</text><path d="M200 292h300" stroke="#d2dcc9" stroke-width="2"/>${Array.from({length:6},(_,index)=>`<path d="M${200+index*60} 286v12" stroke="#b0bea7"/><text x="${200+index*60}" y="321" text-anchor="middle" font-size="14">${index}</text>`).join('')}${lab.copied?`<path d="M200 278H${end}" stroke="#c49a65" stroke-width="7" stroke-linecap="round"/><circle cx="${end}" cy="278" r="5" fill="#ae7a40"/><text x="${end+14}" y="271" font-size="17">${pretty(distance)}</text>`:''}`;
  observation.innerHTML=`<p><strong>${lab.copied?`|${signed(lab.a)}| = ${pretty(distance)}`:'绝对值读的是这段长度。'}</strong><br>${lab.copied?distance===0?'0 到原点的距离是 0，所以 |0| = 0。':`无论点在 0 的左边还是右边，距离都是非负数。这里到 0 的距离为 ${pretty(distance)}。`:'先观察点到 0 的线段，再把同样的长度放到下方量尺上读取。'}</p>`;
 }
 const outputA=$('#output-a');if(outputA)outputA.textContent=signed(lab.a);
 const rangeA=$('#control-a');if(rangeA)rangeA.value=lab.a;
 const outputSlot=$('#output-slot');if(outputSlot)outputSlot.textContent=lab.checked?signed(lab.slot*lab.unit):'待检验';
 const rangeSlot=$('#control-slot');if(rangeSlot)rangeSlot.value=lab.slot;
 const unitOutput=$('#output-unit');if(unitOutput)unitOutput.textContent=pretty(lab.unit);
 const flipButton=$('[data-action="opposite-flip"]');if(flipButton)flipButton.textContent=lab.flips===0?'取一次相反数':lab.flips===1?'再取一次相反数':'重新观察';
 const simplifyButton=$('[data-action="simplify-layer"]');if(simplifyButton)simplifyButton.textContent=lab.revealed<lab.signs.length?'由内向外化简一步':'从头再看';
 const copyButton=$('[data-action="copy-distance"]');if(copyButton)copyButton.textContent=lab.copied?'长度已移到下方':'把长度移到下方量尺';
}
function pointOn(cx,cy,r,angle) { const rad=angle*Math.PI/180; return {x:cx+r*Math.cos(rad),y:cy-r*Math.sin(rad)}; }
function arc(cx,cy,r,start,end) { const p=pointOn(cx,cy,r,start),q=pointOn(cx,cy,r,end); return `M ${p.x} ${p.y} A ${r} ${r} 0 ${end-start>180?1:0} 0 ${q.x} ${q.y}`; }
function sector(cx,cy,r,start,end) { return `M ${cx} ${cy} L ${pointOn(cx,cy,r,start).x} ${pointOn(cx,cy,r,start).y} ${arc(cx,cy,r,start,end).replace(/^M [\d.\-]+ [\d.\-]+ /,'')} Z`; }
function handle({key,x,y,label,value,min,max,color='#245646',text=''}) {
 return `<g data-drag="${key}" tabindex="0" role="slider" aria-label="${esc(label)}" aria-valuenow="${value}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuetext="${esc(text||String(value))}"><circle cx="${x}" cy="${y}" r="24" fill="transparent"/><circle class="handle-visible" cx="${x}" cy="${y}" r="9" fill="${color}" stroke="#fff" stroke-width="3"/></g>`;
}
function angleSVG(angle, rotation, practiceKnown = null) {
 const cx=360,cy=225,r=164,start=rotation,end=rotation+angle,middle=start+angle/2;
 const a=pointOn(cx,cy,r,start),b=pointOn(cx,cy,r,middle),c=pointOn(cx,cy,r,end);
 const labelA=pointOn(cx,cy,r+27,start),labelB=pointOn(cx,cy,r+27,middle),labelC=pointOn(cx,cy,r+27,end);
 const halfOne=pointOn(cx,cy,84,start+angle/4),halfTwo=pointOn(cx,cy,84,start+3*angle/4),whole=pointOn(cx,cy,125,middle);
 const isPractice=practiceKnown!==null;
 let values='';
 if(!isPractice) values=`<text x="${halfOne.x}" y="${halfOne.y+5}" text-anchor="middle" fill="#50755c" font-size="18">${pretty(angle/2)}°</text><text x="${halfTwo.x}" y="${halfTwo.y+5}" text-anchor="middle" fill="#986d43" font-size="18">${pretty(angle/2)}°</text>`;
 else if(practiceKnown==='whole') values=`<text x="${whole.x}" y="${whole.y-12}" text-anchor="middle" font-size="22">${pretty(angle)}°</text><path d="${arc(cx,cy,109,start,end)}" fill="none" stroke="#af865e" stroke-width="1.5" stroke-dasharray="4 3"/>`;
 else { const p=practiceKnown==='half'?halfOne:halfTwo; values=`<text x="${p.x}" y="${p.y+5}" text-anchor="middle" font-size="22">${pretty(angle/2)}°</text>`; }
 return `<path d="${sector(cx,cy,110,start,middle)}" fill="#e7eee3"/><path d="${sector(cx,cy,110,middle,end)}" fill="#f5e8d7"/><path d="M ${a.x} ${a.y} L ${cx} ${cy} L ${c.x} ${c.y}" fill="none" stroke="#526b59" stroke-width="2.7"/><path d="M ${cx} ${cy} L ${b.x} ${b.y}" fill="none" stroke="#b07a45" stroke-width="2.7"/><path d="${arc(cx,cy,43,start,middle)} ${arc(cx,cy,43,middle,end)}" fill="none" stroke="#66805c" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="3" fill="#345e47"/>${[['A',labelA],['B',labelB],['C',labelC]].map(([label,p])=>`<text x="${p.x}" y="${p.y+6}" text-anchor="middle" font-size="19">${label}</text>`).join('')}<text x="${cx-17}" y="${cy+25}" font-size="19">O</text>${values}${!isPractice?handle({key:'angle',x:c.x,y:c.y,label:'改变整个角的度数',value:angle,min:20,max:160,color:'#a87543',text:`整个角 ${angle} 度，两个子角各 ${angle/2} 度`})+handle({key:'rotation',x:a.x,y:a.y,label:'旋转整个图形',value:rotation,min:-45,max:45,text:`旋转 ${rotation} 度`}):''}`;
}
function termText(value,letters) { if(value===0)return '0'; if(value===1)return letters; if(value===-1)return `−${letters}`; return `${pretty(value).replace('-','−')}${letters}`; }
const arithmeticGroups=[[-3,1.5,3,-1.5],[-4,6,4,-1]];
const mixedGroups=[[{op:'+',value:-3},{op:'-',value:-2},{op:'+',value:4},{op:'-',value:1}],[{op:'+',value:1.5},{op:'-',value:3},{op:'-',value:-.5},{op:'+',value:-2}]];
const plusNumber=value=>`(${value>0?'＋':''}${signed(value)})`;
const sumText=values=>values.map(plusNumber).join(' ＋ ');
const sumValues=values=>values.reduce((sum,value)=>sum+value,0);
function sourceMixedText(lab){return mixedGroups[lab.group].map((term,index)=>`${index===0?'':term.op==='+'?' ＋ ':' − '}${plusNumber(term.value)}`).join('');}
function mixedExpected(term){return term.op==='-'?-term.value:term.value;}
function mixedComplete(lab){return mixedGroups[lab.group].every((_,index)=>Object.hasOwn(lab.converted,index));}
function massSummary(lab){const deviation=sumValues(lab.deviations);return {count:lab.deviations.length,deviation,actual:lab.standard*lab.deviations.length+deviation};}
function distanceExpression(lab){return lab.expression==='forward'?lab.b-lab.a:lab.expression==='reverse'?lab.a-lab.b:Math.abs(lab.b-lab.a);}
const productIds=Array.from({length:7},(_,index)=>`C2-${String(index+8).padStart(2,'0')}`);
const productModule=id=>productIds.includes(id);
function integerGcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a||1;}
function R(n,d=1){if(d===0)return null;const sign=d<0?-1:1,gcd=integerGcd(n,d);return {n:n/gcd*sign||0,d:Math.abs(d)/gcd};}
const rkey=value=>value?`${value.n}/${value.d}`:'none';
const rtext=value=>!value?'无意义':value.d===1?signed(value.n):`${signed(value.n)}/${value.d}`;
const rhtml=value=>!value?'无意义':value.d===1?esc(signed(value.n)):`${value.n<0?'−':''}<span class="frac"><span>${Math.abs(value.n)}</span><span>${value.d}</span></span>`;
const rparent=value=>`(${rtext(value)})`;
const radd=(a,b)=>R(a.n*b.d+b.n*a.d,a.d*b.d);
const rmul=(a,b)=>R(a.n*b.n,a.d*b.d);
const rneg=a=>R(-a.n,a.d);
const rinverse=a=>a.n===0?null:R(a.d,a.n);
const rproduct=values=>values.reduce(rmul,R(1));
const reciprocalNumbers=[R(-3),R(2),R(1,2),R(-2,3),R(3,4),R(1),R(-1),R(0)];
const productGroups=[[R(-2),R(5),R(-1,2),R(3,5)],[R(-3,4),R(2),R(-4,3),R(3)]];
const distributionGroups=[{a:R(6),b:R(-2),c:R(3)},{a:R(-3),b:R(2),c:R(-5)},{a:R(-6),b:R(1,2),c:R(-1,3)}];
const dividendNumbers=[R(-3),R(0),R(1,2),R(-5,4),R(6)];
const divisorNumbers=[R(-2,3),R(2),R(0),R(-1),R(1),R(3,4)];
const decimalRatios=['-1.25','0.6','2.0','0.0','0.125','-0.04'];
function uniqueRationals(values){return values.filter((value,index)=>values.findIndex(item=>rkey(item)===rkey(value))===index);}
function reciprocalOptions(a){return a.n===0?[null,R(0),R(1),R(-1)]:uniqueRationals([rinverse(a),rneg(a),a,R(0)]);}
function patternValues(lab){return [3,2,1,0,-1,-2,-3].map(multiplier=>({multiplier,value:lab.factor*multiplier}));}
function productSign(lab){if(lab.zeros.length)return 'zero';return lab.signs.filter(sign=>sign<0).length%2?'negative':'positive';}
function decimalRatio(index){const text=decimalRatios[index],digits=text.split('.')[1].length,scale=10**digits;return {text,scale,n:Math.round(Number(text)*scale),d:scale};}
function ratioSource(lab){if(lab.view!=='decimal')return {n:lab.n,d:lab.d};const source=decimalRatio(lab.decimalIndex),scale=lab.ratioReady&&lab.decimalScale?lab.decimalScale:source.scale;return {...source,n:Math.round(Number(source.text)*scale),d:scale};}
function normalRatioOptions(lab){
 const source=ratioSource(lab),normal=R(source.n,source.d);
 if(!normal)return [{key:'none',label:'无意义（分母不能为 0）',html:'无意义（分母不能为 0）'},{key:'zero',label:'0',html:'0'},{key:'one',label:'1',html:'1'}];
 return [{key:'normal',label:rtext(normal),html:rhtml(normal)},{key:'unreduced',label:`${normal.n*2}/${normal.d*2}`,html:rawRatioHtml(normal.n*2,normal.d*2)},{key:'negative-denominator',label:`${-normal.n}/${-normal.d}`,html:rawRatioHtml(-normal.n,-normal.d)},{key:'wrong-value',label:rtext(normal.n===0?R(1):rneg(normal)),html:rhtml(normal.n===0?R(1):rneg(normal))}];
}
function rawRatioHtml(n,d){return `<span class="frac"><span>${signed(n)}</span><span>${signed(d)}</span></span>`;}
function productDefaults(id){
 if(id==='C2-08')return {factor:-3,shown:3,guess:null,checked:false};
 if(id==='C2-09')return {numberIndex:0,choice:null,checked:false};
 if(id==='C2-10')return {group:0,order:[0,1,2,3],selected:0,split:2,verified:false};
 if(id==='C2-11')return {magnitudes:[2,3,1,4],signs:[-1,1,-1,1],zeros:[],stage:0,zeroGuess:null,prediction:null,feedback:null};
 if(id==='C2-12')return {group:0,mode:'expand',selected:0,expanded:[false,false],common:false,inside:false,computed:false,feedback:null};
 if(id==='C2-13')return {dividendIndex:0,divisorIndex:0,choice:null,checked:false};
 return {view:'fraction',n:-45,d:-12,decimalIndex:0,ratioReady:true,choice:null,checked:false,feedback:null};
}
function patternChoiceButtons(lab){const row=patternValues(lab)[lab.shown],step=Math.abs(lab.factor)||1;return [...new Set([row.value,-row.value,row.value+step,row.value-step])].map(value=>`<button data-action="pattern-guess" data-value="${value}" class="${lab.guess===value?'selected':''}" aria-pressed="${lab.guess===value}"><span class="math">${signed(value)}</span></button>`).join('');}
function normalRatioButtons(lab){return normalRatioOptions(lab).map(option=>`<button data-action="ratio-choose" data-value="${option.key}" class="${lab.choice===option.key?'selected':''}" aria-pressed="${lab.choice===option.key}" ${lab.ratioReady?'':'disabled'}><span class="${option.key==='none'?'ratio-explanation':'math'}">${option.html}</span></button>`).join('');}
function productControls(lab){
 const id=S.moduleId;
 if(id==='C2-08'){
  return rangeControl('固定乘数','factor',lab.factor,-4,4,1)+`<p class="control-note">另一乘数每次减 1。先为高亮的一格选数，再按同样的变化核对，不直接跳到整张答案表。</p><div id="pattern-options" class="lab-local-actions">${patternChoiceButtons(lab)}</div><div class="lab-local-actions"><button class="primary" data-action="pattern-check" ${lab.guess===null||lab.checked?'disabled':''}>核对这一格</button><button data-action="pattern-next" ${lab.checked?'':'disabled'}>${lab.shown===6?'从头补表':'补下一格'}</button><button class="quiet" data-action="pattern-zero">看看乘数为 0</button></div>`;
 }
 if(id==='C2-09'){
  const a=reciprocalNumbers[lab.numberIndex];
  return `<div class="control-row"><label for="control-numberIndex">给定的数</label><select id="control-numberIndex" data-control="numberIndex">${reciprocalNumbers.map((value,index)=>`<option value="${index}" ${index===lab.numberIndex?'selected':''}>${rtext(value)}</option>`).join('')}</select><span class="small muted">可改变</span></div><p class="control-note">选择一个数，使它与给定数相乘得 1；也可判断没有这样的数。注意倒数与相反数不同。</p><div class="rational-choice-row">${reciprocalOptions(a).map(value=>`<button data-action="reciprocal-choose" data-value="${rkey(value)}" class="${lab.choice===rkey(value)?'selected':''}" aria-pressed="${lab.choice===rkey(value)}">${value?`<span class="math">${rhtml(value)}</span>`:'没有倒数'}</button>`).join('')}</div><div class="lab-local-actions"><button class="primary" data-action="reciprocal-check" ${lab.choice===null?'disabled':''}>用乘积检验</button></div>`;
 }
 if(id==='C2-10'){
  const values=productGroups[lab.group];
  return `<p class="control-note">选中整张带符号的乘数卡，再左右移动。改变分组断点，观察哪些数配在一起更方便。</p><div class="signed-card-row">${lab.order.map((card,index)=>`<button class="number-card ${lab.selected===card?'selected':''}" data-action="select-factor" data-index="${card}" aria-pressed="${lab.selected===card}"><small>第 ${index+1} 位</small><span class="math">${rhtml(values[card])}</span></button>`).join('')}</div><div class="lab-local-actions"><button data-action="move-factor" data-delta="-1" ${lab.order.indexOf(lab.selected)===0?'disabled':''}>整张卡向左移</button><button data-action="move-factor" data-delta="1" ${lab.order.indexOf(lab.selected)===3?'disabled':''}>向右移</button></div><div class="control-row"><label for="control-productSplit">分组断点</label><select id="control-productSplit" data-control="productSplit">${[1,2,3].map(split=>`<option value="${split}" ${lab.split===split?'selected':''}>前 ${split} 个一组，其余一组</option>`).join('')}</select><span class="small muted">可改变</span></div><div class="lab-local-actions"><button class="primary" data-action="verify-products">分别求积，再核对</button><button class="quiet" data-action="new-product-group">换一组</button></div>`;
 }
 if(id==='C2-11')return `<p class="control-note">每个乘数可切换正负，也可设为 0。先检查是否含 0，再判断积的符号，不需要算出积的大小。</p><div class="sign-factor-grid">${lab.magnitudes.map((magnitude,index)=>`<div class="sign-factor"><strong class="math">${lab.zeros.includes(index)?'0':signed(magnitude*lab.signs[index])}</strong><button data-action="toggle-factor-sign" data-index="${index}" ${lab.zeros.includes(index)?'disabled':''}>切换正负</button><button data-action="toggle-factor-zero" data-index="${index}" class="${lab.zeros.includes(index)?'selected':''}" aria-pressed="${lab.zeros.includes(index)}">${lab.zeros.includes(index)?'还原非 0':'这一项设为 0'}</button></div>`).join('')}</div><p class="control-note">第 1 步：这组乘数中有 0 吗？</p><div class="lab-local-actions">${[['yes','含 0'],['no','不含 0']].map(([value,label])=>`<button data-action="zero-first" data-value="${value}" class="${lab.zeroGuess===value?'selected':''}">${label}</button>`).join('')}</div>${lab.stage?`<p class="control-note">第 2 步：${lab.zeros.length?'先用 0 对乘积的影响判断。':'再数负乘数的个数，按奇偶判断。'}</p><div class="lab-local-actions">${[['zero','积为 0'],['positive','积为正'],['negative','积为负']].map(([value,label])=>`<button data-action="product-sign-guess" data-value="${value}" class="${lab.prediction===value?'selected':''}">${label}</button>`).join('')}</div>`:''}`;
 if(id==='C2-12'){
  const {a,b,c}=distributionGroups[lab.group],values=[b,c];
  return `<div class="segmented classification-view"><button data-action="distribution-mode" data-value="expand" class="${lab.mode==='expand'?'active':''}">正向：展开</button><button data-action="distribution-mode" data-value="factor" class="${lab.mode==='factor'?'active':''}">逆向：提出共同乘数</button></div>${lab.mode==='expand'?`<p class="control-note">共同乘数 ${rtext(a)} 必须分别乘括号内的每一项。选中一个空格，再选应放入的整项。</p><div class="distribution-slots">${values.map((value,index)=>`<button data-action="distribution-slot" data-index="${index}" class="${lab.selected===index?'selected':''}" aria-pressed="${lab.selected===index}"><small>第 ${index+1} 项</small><span class="math">${lab.expanded[index]?`${rparent(a)} × ${rparent(value)}`:'□'}</span></button>`).join('')}</div><div class="lab-local-actions"><button data-action="distribution-fill" data-value="multiply"><span class="math">${rparent(a)} × ${rparent(values[lab.selected])}</span></button><button data-action="distribution-fill" data-value="keep"><span class="math">只留 ${rparent(values[lab.selected])}</span></button></div>`:`<p class="control-note">保留括号内原来的 ${rparent(b)}、${rparent(c)}，先提出两项共有的完整乘数卡，再核对括号内的两项。</p><div class="rational-choice-row">${uniqueRationals([a,b,c]).map(value=>`<button data-action="distribution-common" data-value="${rkey(value)}" class="${lab.common&&rkey(value)===rkey(a)?'selected':''}"><span class="math">提出 ${rhtml(value)}</span></button>`).join('')}</div>${lab.common?`<div class="lab-local-actions"><button data-action="distribution-inside" data-value="original"><span class="math">${rparent(b)} ＋ ${rparent(c)}</span></button><button data-action="distribution-inside" data-value="products"><span class="math">${rparent(rmul(a,b))} ＋ ${rparent(rmul(a,c))}</span></button></div>`:''}` }<div class="lab-local-actions"><button class="primary" data-action="distribution-compute" ${(lab.mode==='expand'?lab.expanded.every(Boolean):lab.common&&lab.inside)?'':'disabled'}>核对等价式并求值</button><button class="quiet" data-action="new-distribution-group">换一组</button></div>`;
 }
 if(id==='C2-13'){
  const divisor=divisorNumbers[lab.divisorIndex];
  return `<div class="control-row"><label for="control-dividendIndex">被除数</label><select id="control-dividendIndex" data-control="dividendIndex">${dividendNumbers.map((value,index)=>`<option value="${index}" ${index===lab.dividendIndex?'selected':''}>${rtext(value)}</option>`).join('')}</select><span class="small muted">可以为 0</span></div><div class="control-row"><label for="control-divisorIndex">除数</label><select id="control-divisorIndex" data-control="divisorIndex">${divisorNumbers.map((value,index)=>`<option value="${index}" ${index===lab.divisorIndex?'selected':''}>${rtext(value)}</option>`).join('')}</select><span class="small muted">先检查 0</span></div><p class="control-note">非 0 除数才有倒数。先选应乘的数；若除数为 0，应选择此式无意义。</p><div class="rational-choice-row">${reciprocalOptions(divisor).map(value=>`<button data-action="division-choose" data-value="${rkey(value)}" class="${lab.choice===rkey(value)?'selected':''}" aria-pressed="${lab.choice===rkey(value)}">${value?`<span class="math">乘 ${rhtml(value)}</span>`:'除数为 0，此式无意义'}</button>`).join('')}</div><div class="lab-local-actions"><button class="primary" data-action="division-check" ${lab.choice===null?'disabled':''}>核对转化与商</button></div>`;
 }
 const source=ratioSource(lab);
 return `<div class="segmented classification-view"><button data-action="ratio-view" data-value="fraction" class="${lab.view==='fraction'?'active':''}">带符号分数</button><button data-action="ratio-view" data-value="decimal" class="${lab.view==='decimal'?'active':''}">有限小数</button></div>${lab.view==='fraction'?rangeControl('原分子','n',lab.n,-48,48,1)+rangeControl('原分母','d',lab.d,-18,18,1,'orange')+`<div class="lab-local-actions"><button data-action="ratio-case" data-value="negative">两处负号</button><button class="quiet" data-action="ratio-case" data-value="zero-numerator">分子为 0</button><button class="quiet" data-action="ratio-case" data-value="zero-denominator">分母为 0</button></div>`:`<div class="control-row"><label for="control-decimalIndex">有限小数</label><select id="control-decimalIndex" data-control="decimalIndex">${decimalRatios.map((text,index)=>`<option value="${index}" ${index===lab.decimalIndex?'selected':''}>${text.replace('-','−')}</option>`).join('')}</select><span class="small muted">按小数位数</span></div><p class="control-note">把小数看成除以 1，再让分子、分母同时乘 10、100 或 1000，直到两者都是整数。</p><div class="lab-local-actions">${[10,100,1000].map(scale=>`<button data-action="decimal-scale" data-value="${scale}" class="${lab.ratioReady&&lab.decimalScale===scale?'selected':''}">乘 ${scale}</button>`).join('')}</div>`}<p class="control-note">本项目的规范形式：分母为正、分子分母互质；整数直接写整数，0 直接写 0。分母不能为 0。</p><div id="ratio-options" class="rational-choice-row">${normalRatioButtons(lab)}</div><div class="lab-local-actions"><button class="primary" data-action="ratio-check" ${lab.choice===null?'disabled':''}>检验值与规范形式</button></div>`;
}
function productEquationSVG(title,lines=[]){return `<text x="380" y="42" text-anchor="middle" font-size="22">${esc(title)}</text>${lines.map((line,index)=>`<rect x="45" y="${74+index*69}" width="670" height="55" rx="8" fill="${index%2?'#f6eee2':'#edf2e7'}"/><text x="380" y="${110+index*69}" text-anchor="middle" font-size="${line.length>46?19:25}">${esc(line)}</text>`).join('')}`;}
function drawProductLab(svg,observation,lab){
 const id=S.moduleId;
 if(id==='C2-08'){
  const rows=patternValues(lab),row=rows[lab.shown],correct=lab.guess===row.value;
  svg.innerHTML=`<text x="380" y="35" text-anchor="middle" font-size="22">固定乘数 ${signed(lab.factor)}，另一乘数每次减 1</text>${rows.map((item,index)=>{const x=37+index*99,shown=index<lab.shown||(index===lab.shown&&lab.checked);return `<rect x="${x}" y="69" width="91" height="133" rx="8" fill="${index===lab.shown?'#e2ecd9':'#f0f3ec'}" stroke="${index===lab.shown?'#87a477':'#d5dfce'}"/><text x="${x+45.5}" y="102" text-anchor="middle" font-size="20">× ${signed(item.multiplier)}</text><path d="M${x+14} 116h63" stroke="#cad5c1"/><text x="${x+45.5}" y="157" text-anchor="middle" font-size="27">${shown?signed(item.value):'?'}</text><text x="${x+45.5}" y="184" text-anchor="middle" font-size="13">${index<3?'已知':index===lab.shown?'正在补这一格':'按规律补全'}</text>`;}).join('')}<text x="380" y="254" text-anchor="middle" font-size="18">${lab.checked?`乘数减 1，积就加上 ${rparent(R(-lab.factor))}。本格积为 ${signed(row.value)}。`:'比较相邻已知积的变化，再预测下一格。'}</text>`;
  observation.innerHTML=`<p><strong>${lab.checked?`${correct?'预测正确。':'按相邻积的变化再核对。'}${rparent(R(lab.factor))} × ${rparent(R(row.multiplier))} = ${signed(row.value)}`:'先补高亮的这一格，再继续向负乘数探索。'}</strong><br>${lab.checked?lab.factor===0?'固定乘数为 0，每格积都为 0。':row.multiplier===0?'任何数与 0 相乘都得 0。下一格仍按相同变化继续。':`两数${lab.factor*row.multiplier>0?'同号，积为正':'异号，积为负'}；积的绝对值是 ${Math.abs(lab.factor)} × ${Math.abs(row.multiplier)} = ${Math.abs(row.value)}。表中的试例帮助观察规律，计算时使用乘法法则。`:'保持每次乘数减 1 时积的变化一致，避免只凭两个负号猜结果。'}</p>`;
 }else if(id==='C2-09'){
  const a=reciprocalNumbers[lab.numberIndex],chosen=reciprocalOptions(a).find(value=>rkey(value)===lab.choice),product=chosen?rmul(a,chosen):null,correct=lab.choice!==null&&lab.choice===rkey(rinverse(a));
  const lines=[`${rparent(a)} × ${lab.choice===null?'□':chosen?rparent(chosen):'某个数'} = ${lab.checked&&chosen?rtext(product):'?'}`];
  if(lab.checked)lines.push(a.n===0?'0 × 任意有理数 = 0，得不到 1':correct?`${rparent(a)} 与 ${rparent(chosen)} 的积为 1，互为倒数`:'乘积没有等于 1，继续寻找伙伴');
  svg.innerHTML=productEquationSVG('乘积为 1 的两个数互为倒数',lines);
  observation.innerHTML=`<p><strong>${!lab.checked?'先选择伙伴，再用乘积检验。':a.n===0?`${correct?'判断正确。':'再检查 0 的乘法。'}0 没有倒数。`:correct?'找到了，两个数互为倒数。':'这两个数还不互为倒数。'}</strong><br>${lab.checked&&a.n!==0?Math.abs(a.n)===a.d?'1 的倒数是 1，−1 的倒数是 −1。倒数不一定是另一个不同的数。':`倒数使乘积为 1；相反数使和为 0。${rtext(a)} 的相反数是 ${rtext(rneg(a))}，不要混淆。`:'0 乘任何有理数都得 0，无法找到乘积为 1 的伙伴；非 0 分数的倒数可由分子、分母交换位置得到。'}</p>`;
 }else if(id==='C2-10'){
  const original=productGroups[lab.group],values=lab.order.map(index=>original[index]),left=values.slice(0,lab.split),right=values.slice(lab.split),total=rproduct(values),expression=values=>values.map(rparent).join(' × ');
  svg.innerHTML=productEquationSVG('原来的积：'+expression(original),[`[ ${expression(left)} ] × [ ${expression(right)} ]`,lab.verified?`${rparent(rproduct(left))} × ${rparent(rproduct(right))} = ${rtext(total)}`:'调整顺序和断点，分别求两组的积']);
  observation.innerHTML=`<p><strong>${lab.verified?`左组积为 ${rtext(rproduct(left))}，右组积为 ${rtext(rproduct(right))}，总积仍为 ${rtext(total)}。`:'改变卡片顺序，再真实改变分组。'}</strong><br>${lab.verified?'交换乘数的位置、改变相乘的分组，积不变。先让能凑成 1 或整数的乘数相邻，可以简化计算。':'乘数连同正负号一起移动。每个原乘数使用一次，不漏项、不重复，不把乘数的负号留在原处。'}</p>`;
 }else if(id==='C2-11'){
  const values=lab.magnitudes.map((value,index)=>lab.zeros.includes(index)?0:value*lab.signs[index]),negativeCount=lab.signs.filter((sign,index)=>sign<0&&!lab.zeros.includes(index)).length,answer=productSign(lab),names={positive:'正数',negative:'负数',zero:'0'};
  svg.innerHTML=productEquationSVG('先看有没有 0，再数负乘数', [values.map(value=>rparent(R(value))).join(' × '),lab.prediction?`积为 ${names[answer]}${answer==='zero'?'':`：负乘数 ${negativeCount} 个，为${negativeCount%2?'奇数':'偶数'}个`}`:lab.stage?'已完成零检查，再判断积的符号':'第一步：在下面判断是否含 0']);
  observation.innerHTML=`<p><strong>${lab.feedback?esc(lab.feedback):lab.prediction?`${lab.prediction===answer?'判断正确。':'按先零后奇偶的顺序再检查。'}积为 ${names[answer]}。`:'先操作乘数，再作两步判断。'}</strong><br>${lab.prediction?answer==='zero'?'只要有一个乘数为 0，积就是 0；此时不再用负号个数决定正负。':`没有乘数为 0 时，负乘数为偶数个积为正，奇数个积为负。0 个负乘数也是偶数个。`:lab.stage?(lab.zeros.length?'已确认含 0，先使用 0 对乘积的影响。':'已确认没有 0，再数一数负乘数的个数。'):'把一项设为 0 后，先检查零的影响；恢复非 0 后再检查负乘数个数。'}</p>`;
 }else if(id==='C2-12'){
  const {a,b,c}=distributionGroups[lab.group],ab=rmul(a,b),ac=rmul(a,c),result=rmul(a,radd(b,c)),original=`${rparent(a)} × [ ${rparent(b)} ＋ ${rparent(c)} ]`,expanded=`${rparent(a)} × ${rparent(b)} ＋ ${rparent(a)} × ${rparent(c)}`;
  const middle=lab.mode==='expand'?`${lab.expanded[0]?`${rparent(a)} × ${rparent(b)}`:'□'} ＋ ${lab.expanded[1]?`${rparent(a)} × ${rparent(c)}`:'□'}`:`${lab.common?rparent(a):'□'} × [ ${lab.inside?`${rparent(b)} ＋ ${rparent(c)}`:'□ ＋ □'} ]`;
  svg.innerHTML=productEquationSVG(lab.mode==='expand'?'分配律：共同乘数要乘每一项':'逆向分配律：提出共同乘数',[lab.mode==='expand'?original:expanded,middle,...(lab.computed?[`${lab.mode==='expand'?`${rparent(ab)} ＋ ${rparent(ac)}`:original} = ${rtext(result)}`]:[])]);
  observation.innerHTML=`<p><strong>${lab.feedback?esc(lab.feedback):lab.computed?`两种路径的值相同，结果为 ${rtext(result)}。`:lab.mode==='expand'?'逐项补全展开式，不能漏乘任何一项。':'先提出共同乘数，再还原括号内各项。'}</strong><br>${lab.computed?'等价变形保留原式的值。遇到负数和分数，乘法的符号与大小也要逐项计算。':lab.mode==='expand'?`共同乘数 ${rtext(a)} 要分别乘 ${rtext(b)} 与 ${rtext(c)}，外面的加法关系保持。`:'提取共同乘数后，括号内保留除去这一共同乘数后留下的两项，不能再把共同乘数重复算进去。'}</p>`;
 }else if(id==='C2-13'){
  const a=dividendNumbers[lab.dividendIndex],b=divisorNumbers[lab.divisorIndex],inverse=rinverse(b),correct=lab.choice!==null&&lab.choice===rkey(inverse),result=inverse?rmul(a,inverse):null;
  svg.innerHTML=productEquationSVG('除数非 0 时，除法转为乘倒数',[`${rparent(a)} ÷ ${rparent(b)}${lab.checked&&correct&&inverse?` = ${rparent(a)} × ${rparent(inverse)}`:' = ?'}`,lab.checked&&correct?inverse?`商为 ${rtext(result)}；核对：${rparent(b)} × ${rparent(result)} = ${rtext(a)}`:'除数为 0，原除法式无意义':'先检查除数，再选择应乘的数']);
  observation.innerHTML=`<p><strong>${!lab.checked?'先选择转化方式，再核对。':!b.n?`${correct?'判断正确。':'除数必须非 0。'}这个除法式无意义。`:correct?`转化正确，商为 ${rtext(result)}。`:'应乘除数的倒数，再选一次。'}</strong><br>${!b.n?'除数为 0 时不能写成合法商；0 ÷ 0 也不例外。':lab.checked&&correct&&a.n===0?'0 作被除数、非 0 数作除数时，商为 0。这与除数为 0 的情况不同。':`被除数保持不变，把除号改为乘号，并把整个非 0 除数 ${rtext(b)} 换成它的倒数。`}</p>`;
 }else{
  const source=ratioSource(lab),normal=R(source.n,source.d),correct=lab.choice===(normal?'normal':'none'),raw=`(${signed(source.n)}) / (${signed(source.d)})`,title=lab.view==='decimal'?`有限小数 ${source.text.replace('-','−')}`:'分数的值与规范写法要分别检查';
  svg.innerHTML=productEquationSVG(title,[lab.view==='decimal'&&!lab.ratioReady?'先选择同时扩大分子、分母的倍数':`${raw}${lab.checked&&correct&&normal?' = '+rtext(normal):' → 规范形式？'}`,lab.checked?normal?correct?`分母为正、已约分：${rtext(normal)}`:'检查数值是否相等，以及写法是否规范':'分母是 0，不能表示一个有理数':'先选择，再核对分母符号与约分']);
  observation.innerHTML=`<p><strong>${lab.feedback?esc(lab.feedback):!lab.checked?'先选择一个候选规范形式，再检验。':correct?normal?`规范形式为 ${rtext(normal)}。`:'判断正确：分母为 0，此式无意义。':lab.choice==='unreduced'?'数值相等，但还没有约分为规范形式。':lab.choice==='negative-denominator'?'数值相等，但规范形式要求分母为正。':'再检查符号和值是否保持一致。'}</strong><br>${lab.checked&&correct&&normal?normal.n===0?'分子为 0、分母非 0 时，值为 0，规范写法直接写 0。':normal.d===1?'化为整数后，规范写法直接写这个整数。':`分子、分母同除以最大公因数，并把分母的负号移到分子，使分母为正。结果是 ${rtext(normal)}。`:'分数的负号可以放在分子或整个分数前；分子分母同乘非 0 数，分数值不变。分母 0 的情况要先排除。'}</p>`;
 }
 for(const key of ['factor','n','d']){if(lab[key]===undefined)continue;const output=$(`#output-${key}`);if(output)output.textContent=signed(lab[key]);const range=$(`#control-${key}`);if(range)range.value=lab[key];}
}
function resetProductResult(lab){
 const id=S.moduleId;
 if(id==='C2-08'){lab.shown=3;lab.guess=null;lab.checked=false;}
 if(id==='C2-09'||id==='C2-13'){lab.choice=null;lab.checked=false;}
 if(id==='C2-11'){lab.stage=0;lab.zeroGuess=null;lab.prediction=null;lab.feedback=null;}
 if(id==='C2-14'){lab.choice=null;lab.checked=false;lab.feedback=null;}
}
function resetDistribution(lab){lab.selected=0;lab.expanded=[false,false];lab.common=false;lab.inside=false;lab.computed=false;lab.feedback=null;}
function handleProductAction(action,button){
 const lab=labState(),value=button.dataset.value,index=Number(button.dataset.index);
 if(action==='pattern-guess'){lab.guess=Number(value);lab.checked=false;redrawLocalControls();}
 else if(action==='pattern-check'){if(lab.guess!==null){lab.checked=true;redrawLocalControls();}}
 else if(action==='pattern-next'){if(lab.checked){lab.shown=lab.shown===6?3:lab.shown+1;lab.guess=null;lab.checked=false;redrawLocalControls();}}
 else if(action==='pattern-zero'){lab.factor=0;resetProductResult(lab);redrawLocalControls();}
 else if(action==='reciprocal-choose'||action==='division-choose'){lab.choice=value;lab.checked=false;redrawLocalControls();}
 else if(action==='reciprocal-check'||action==='division-check'){if(lab.choice!==null){lab.checked=true;drawLab();}}
 else if(action==='select-factor'){lab.selected=index;redrawLocalControls();}
 else if(action==='move-factor'){moveWholeCard(lab,Number(button.dataset.delta));lab.verified=false;redrawLocalControls();}
 else if(action==='verify-products'){lab.verified=true;drawLab();}
 else if(action==='new-product-group'){lab.group=(lab.group+1)%productGroups.length;lab.order=[0,1,2,3];lab.selected=0;lab.verified=false;redrawLocalControls();}
 else if(action==='toggle-factor-sign'){if(!lab.zeros.includes(index))lab.signs[index]*=-1;resetProductResult(lab);redrawLocalControls();}
 else if(action==='toggle-factor-zero'){lab.zeros=lab.zeros.includes(index)?lab.zeros.filter(item=>item!==index):[...lab.zeros,index];resetProductResult(lab);redrawLocalControls();}
 else if(action==='zero-first'){lab.zeroGuess=value;const correct=(value==='yes')===(lab.zeros.length>0);lab.stage=correct?1:0;lab.prediction=null;lab.feedback=correct?null:'先逐项检查：乘数中有没有 0？零的影响应先判断。';redrawLocalControls();}
 else if(action==='product-sign-guess'){if(lab.stage){lab.prediction=value;lab.feedback=null;redrawLocalControls();}}
 else if(action==='distribution-mode'){lab.mode=value;resetDistribution(lab);redrawLocalControls();}
 else if(action==='distribution-slot'){lab.selected=index;lab.feedback=null;redrawLocalControls();}
 else if(action==='distribution-fill'){lab.computed=false;if(value==='multiply'){lab.expanded[lab.selected]=true;lab.feedback=`第 ${lab.selected+1} 项已乘上共同乘数。`;}else lab.feedback='这一项也要乘共同乘数，不能只留下括号内原来的数。';redrawLocalControls();}
 else if(action==='distribution-common'){const {a}=distributionGroups[lab.group];lab.computed=false;if(value===rkey(a)){lab.common=true;lab.feedback='共同乘数选对了，再选择括号内留下的两项。';}else lab.feedback='按原式的乘数卡检查，两项中完整相同的共同乘数是哪一张？';redrawLocalControls();}
 else if(action==='distribution-inside'){lab.computed=false;if(value==='original'){lab.inside=true;lab.feedback='括号内两项正确，核对等价式并求值。';}else lab.feedback='共同乘数已经提出，括号内不要再乘一次共同乘数。';redrawLocalControls();}
 else if(action==='distribution-compute'){if(lab.mode==='expand'?lab.expanded.every(Boolean):lab.common&&lab.inside){lab.computed=true;lab.feedback=null;drawLab();}}
 else if(action==='new-distribution-group'){lab.group=(lab.group+1)%distributionGroups.length;resetDistribution(lab);redrawLocalControls();}
 else if(action==='ratio-view'){lab.view=value;lab.ratioReady=value==='fraction';lab.decimalScale=null;resetProductResult(lab);redrawLocalControls();}
 else if(action==='ratio-case'){lab.n=value==='zero-numerator'?0:-45;lab.d=value==='negative'?-12:value==='zero-numerator'?8:0;resetProductResult(lab);redrawLocalControls();}
 else if(action==='decimal-scale'){const source=decimalRatio(lab.decimalIndex),scale=Number(value),numerator=Number(source.text)*scale;resetProductResult(lab);if(Math.abs(numerator-Math.round(numerator))<1e-8){lab.decimalScale=scale;lab.ratioReady=true;lab.feedback=`把 ${source.text.replace('-','−')} 看成除以 1，分子、分母同时乘 ${scale}，得到整数之比 ${Math.round(numerator)}/${scale}。`;}else{lab.ratioReady=false;lab.feedback='这个倍数还不能把分子变成整数，再看小数位数。';}redrawLocalControls();}
 else if(action==='ratio-choose'){if(lab.ratioReady){lab.choice=value;lab.checked=false;lab.feedback=null;redrawLocalControls();}}
 else if(action==='ratio-check'){if(lab.choice!==null){lab.checked=true;lab.feedback=null;drawLab();}}
 else return false;
 return true;
}

function arithmeticControls(lab){
 if(productModule(S.moduleId))return productControls(lab);
 const id=S.moduleId;
 if(id==='C2-01')return rangeControl('第一个加数','a',lab.a,-5,5,.5)+rangeControl('第二个加数','b',lab.b,-5,5,.5,'orange')+`<p class="control-note">先预测和的符号，再分两步移动。改变任一加数，会清除本次预测与移动过程。</p><div id="addition-predictions" class="lab-local-actions">${additionPredictionButtons(lab)}</div><div class="lab-local-actions"><button data-action="addition-move" ${lab.prediction===null?'disabled':''}>${lab.stage===0?'第 1 步：从 0 移动第一个加数':lab.stage===1?'第 2 步：接着移动第二个加数':'从头观察移动'}</button><button class="quiet" data-action="addition-case" data-value="cancel">试试互相抵消</button><button class="quiet" data-action="addition-case" data-value="zero">试试加 0</button></div>`;
 if(id==='C2-02')return rangeControl('固定的起点','start',lab.start,-5,5,.5)+rangeControl('加上的数','delta',lab.delta,-5,5,.5,'orange')+`<p class="control-note">先固定起点，再改变加上的数。判断和相对原来的数怎样变化。</p><div id="change-predictions" class="lab-local-actions">${changePredictionButtons(lab)}</div><div class="lab-local-actions"><button data-action="change-zero">试试加 0</button></div>`;
 if(id==='C2-03'){
  const values=arithmeticGroups[lab.group];
  return `<p class="control-note">每张卡连同正负号一起移动。选择卡片，用左右按钮重排，再移动分组断点。</p><div class="signed-card-row">${lab.order.map((card,index)=>`<button class="number-card ${lab.selected===card?'selected':''}" data-action="select-addend" data-index="${card}" aria-pressed="${lab.selected===card}"><small>第 ${index+1} 位</small><span class="math">${plusNumber(values[card])}</span></button>`).join('')}</div><div class="lab-local-actions"><button data-action="move-addend" data-delta="-1" ${lab.order.indexOf(lab.selected)===0?'disabled':''}>整张卡向左移</button><button data-action="move-addend" data-delta="1" ${lab.order.indexOf(lab.selected)===3?'disabled':''}>向右移</button></div><div class="control-row"><label for="control-split">分组断点</label><select id="control-split" data-control="split">${[1,2,3].map(value=>`<option value="${value}" ${lab.split===value?'selected':''}>前 ${value} 项一组，其余一组</option>`).join('')}</select><span class="small muted">可改变</span></div><div class="lab-local-actions"><button class="primary" data-action="verify-grouping">分别计算，再比较总和</button><button class="quiet" data-action="new-addend-group">换一组</button></div>`;
 }
 if(id==='C2-04')return rangeControl('统一标准质量','standard',lab.standard,450,550,1,'',' g')+`<div class="control-row"><label for="control-massCount">物品数量</label><select id="control-massCount" data-control="massCount">${[3,4,5,6].map(count=>`<option value="${count}" ${lab.deviations.length===count?'selected':''}>${count} 件</option>`).join('')}</select><span class="small muted">同一标准</span></div><div class="mass-records" aria-label="选择要调整的质量记录">${massRecordButtons(lab)}</div>${rangeControl('选中物品的偏差','deviation',lab.deviations[lab.selected],-5,5,.5,'orange',' g')}<p class="control-note">超过标准记正，低于标准记负。实际质量 = 标准质量 + 偏差。</p><div class="lab-local-actions"><button class="primary" data-action="mass-total">求总实际质量</button><button class="quiet" data-action="mass-balance">让偏差和为 0</button></div>`;
 if(id==='C2-05')return rangeControl('被减数','a',lab.a,-5,5,.5)+rangeControl('减数','b',lab.b,-5,5,.5,'orange')+`<p class="control-note">把“减去减数”改为“加上减数的相反数”。先选出应加的数。</p><div id="subtraction-options" class="lab-local-actions">${subtractionButtons(lab)}</div><div class="lab-local-actions"><button data-action="subtraction-case" data-value="negative">试试 −3 − (−5)</button><button class="quiet" data-action="subtraction-case" data-value="zero">被减数为 0</button></div>`;
 if(id==='C2-06'){
  const terms=mixedGroups[lab.group],term=terms[lab.selected];
  return `<p class="control-note">原式中的减号先转为“加相反数”；转换后的每张卡保留自己的符号。</p><div class="signed-card-row mixed-card-row">${lab.order.map(card=>`<button class="number-card ${lab.selected===card?'selected':''} ${Object.hasOwn(lab.converted,card)?'placed':''}" data-action="select-mixed-card" data-index="${card}" aria-pressed="${lab.selected===card}"><small>原式第 ${card+1} 项</small><span class="math">${Object.hasOwn(lab.converted,card)?plusNumber(lab.converted[card]):`${card===0?'':terms[card].op==='+'?'＋':'−'} ${plusNumber(terms[card].value)}`}</span><small>${Object.hasOwn(lab.converted,card)?'已变为带符号加数':'待转换'}</small></button>`).join('')}</div><p class="control-note">选中的是原式第 ${lab.selected+1} 项${lab.selected===0?'（第一项连同自身符号保留）':`（${term.op==='+'?'加上':'减去'} ${plusNumber(term.value)}）`}。转成和以后，这张卡是：</p><div class="lab-local-actions">${[...new Set([term.value,-term.value])].map(value=>`<button data-action="convert-mixed-card" data-value="${value}"><span class="math">${plusNumber(value)}</span></button>`).join('')}</div><div class="lab-local-actions"><button data-action="move-mixed-card" data-delta="-1" ${!mixedComplete(lab)||lab.order.indexOf(lab.selected)===0?'disabled':''}>整张卡向左移</button><button data-action="move-mixed-card" data-delta="1" ${!mixedComplete(lab)||lab.order.indexOf(lab.selected)===3?'disabled':''}>向右移</button><button class="primary" data-action="compute-mixed" ${mixedComplete(lab)?'':'disabled'}>核对带符号的和并求值</button><button class="quiet" data-action="new-mixed-group">换一组</button></div>`;
 }
 return rangeControl('点 A 的数 a','a',lab.a,-5,5,.5)+rangeControl('点 B 的数 b','b',lab.b,-5,5,.5,'orange')+`<p class="control-note">先选一个候选表达式，再用不同点位检验。有限试例通过，不能代替对所有情况的说明。</p><div id="distance-expressions" class="lab-local-actions">${distanceExpressionButtons(lab)}</div><div class="lab-local-actions"><button class="primary" data-action="verify-distance" ${lab.expression?'':'disabled'}>检验这个试例</button><button class="quiet" data-action="distance-case" data-value="cross">跨过原点</button><button class="quiet" data-action="distance-case" data-value="reverse">交换端点</button><button class="quiet" data-action="distance-case" data-value="same">两点重合</button></div>`;
}
function additionPredictionButtons(lab){return [['positive','和为正'],['negative','和为负'],['zero','和为 0']].map(([value,label])=>`<button data-action="addition-predict" data-value="${value}" class="${lab.prediction===value?'selected':''}" aria-pressed="${lab.prediction===value}">${label}</button>`).join('');}
function changePredictionButtons(lab){return [['greater','和变大'],['smaller','和变小'],['equal','和不变']].map(([value,label])=>`<button data-action="change-predict" data-value="${value}" class="${lab.prediction===value?'selected':''}" aria-pressed="${lab.prediction===value}">${label}</button>`).join('');}
function massRecordButtons(lab){return lab.deviations.map((deviation,index)=>`<button class="${lab.selected===index?'selected':''}" data-action="select-mass" data-index="${index}" aria-pressed="${lab.selected===index}"><strong>第 ${index+1} 件</strong><span>实际 ${pretty(lab.standard+deviation)} g</span><small>偏差 ${deviation>0?'＋':''}${signed(deviation)} g</small></button>`).join('');}
function subtractionButtons(lab){return [...new Set([lab.b,-lab.b])].map(value=>`<button data-action="subtraction-choose" data-value="${value}" class="${lab.choice===value?'selected':''}" aria-pressed="${lab.choice===value}"><span class="math">加上 ${plusNumber(value)}</span></button>`).join('');}
function distanceExpressionButtons(lab){return [['forward','b − a'],['reverse','a − b'],['absolute','|b − a|']].map(([value,label])=>`<button data-action="distance-expression" data-value="${value}" class="${lab.expression===value?'selected':''}" aria-pressed="${lab.expression===value}"><span class="math">${label}</span></button>`).join('');}
function arithmeticLine(points=[]){
 const unique=[];for(const point of points){const duplicate=unique.find(item=>item.position===point.position);if(duplicate)duplicate.label=`原位置与结果 ${signed(point.position)}`;else unique.push({...point});}
 return lineSVG({min:-10,max:10,ticks:Array.from({length:11},(_,index)=>({position:index*2-10,label:signed(index*2-10)})),y:172})+unique.map((point,index)=>{const x=axisX(point.position,-10,10),labelY=index===0?145:82;return `<path d="M${x} 158V${labelY+9}" stroke="#c5d1bc" stroke-dasharray="3 4"/><circle cx="${x}" cy="172" r="7" fill="${index?'#ac7c48':'#397599'}" stroke="#fff" stroke-width="2"/><text x="${x}" y="${labelY}" text-anchor="middle" font-size="20">${esc(point.label)}</text>`;}).join('');
}
function movementSVG(from,to,y,label,color='#416f59'){
 const start=axisX(from,-10,10),end=axisX(to,-10,10),direction=Math.sign(end-start);
 return `<path d="M${start} 169V${y+8}${from===to?'':`M${end} 169V${y+8}`}" stroke="${color}" stroke-width="1" stroke-dasharray="3 4" opacity=".5"/>${direction?`<path d="M${start} ${y}H${end}m${-direction*9} -6 ${direction*9} 6 ${-direction*9} 6" fill="none" stroke="${color}" stroke-width="3"/>`:`<circle cx="${start}" cy="${y}" r="5" fill="${color}"/>`}<text x="${(start+end)/2}" y="${y-13}" text-anchor="middle" font-size="18" fill="${color}">${esc(label)}</text>`;
}
function resetArithmeticResult(lab){
 if(productModule(S.moduleId)){
  resetProductResult(lab);
  if(S.moduleId==='C2-08'){const options=$('#pattern-options');if(options)options.innerHTML=patternChoiceButtons(lab);for(const action of ['pattern-check','pattern-next']){const button=$(`[data-action="${action}"]`);if(button)button.disabled=true;}}
  if(S.moduleId==='C2-14'){const options=$('#ratio-options');if(options)options.innerHTML=normalRatioButtons(lab);const check=$('[data-action="ratio-check"]');if(check)check.disabled=true;}
  return;
 }
 if(S.moduleId==='C2-01'){lab.prediction=null;lab.stage=0;const predictions=$('#addition-predictions');if(predictions)predictions.innerHTML=additionPredictionButtons(lab);const move=$('[data-action="addition-move"]');if(move){move.disabled=true;move.textContent='第 1 步：从 0 移动第一个加数';}}
 if(S.moduleId==='C2-02'){lab.prediction=null;const predictions=$('#change-predictions');if(predictions)predictions.innerHTML=changePredictionButtons(lab);}
 if(S.moduleId==='C2-04'){lab.revealed=false;const records=$('.mass-records');if(records)records.innerHTML=massRecordButtons(lab);}
 if(S.moduleId==='C2-05'){lab.choice=null;const options=$('#subtraction-options');if(options)options.innerHTML=subtractionButtons(lab);}
 if(S.moduleId==='C2-07')lab.checked=false;
}
function drawArithmeticLab(svg,observation,lab){
 if(productModule(S.moduleId)){drawProductLab(svg,observation,lab);return;}
 const id=S.moduleId;
 if(id==='C2-01'){
  const total=lab.a+lab.b,expected=signBin(total),prediction=lab.prediction==='positive'?'positive':lab.prediction==='negative'?'negative':'zero';
  svg.innerHTML=`<text x="380" y="35" text-anchor="middle" font-size="27">${plusNumber(lab.a)} ＋ ${plusNumber(lab.b)}${lab.stage===2?` = ${signed(total)}`:' = ?'}</text>${arithmeticLine(lab.stage===2?[{position:total,label:`和 ${signed(total)}`}]:lab.stage===1?[{position:lab.a,label:`先到 ${signed(lab.a)}`}]:[])}${lab.stage>=1?movementSVG(0,lab.a,110,`第 1 步：${lab.a===0?'留在 0':`${lab.a>0?'向右':'向左'} ${pretty(Math.abs(lab.a))}`}`):''}${lab.stage===2?movementSVG(lab.a,total,244,`第 2 步：${lab.b===0?'原地不动':`${lab.b>0?'向右':'向左'} ${pretty(Math.abs(lab.b))}`}`,'#a57543'):''}`;
  observation.innerHTML=`<p><strong>${lab.stage===2?`${prediction===expected?'预测正确。':'再对照移动后的终点。'}和为 ${signed(total)}。`:lab.prediction===null?'先预测和的符号，再开始移动。':lab.stage===0?'已选好预测，从 0 出发。':'已到第一个加数，再接着移动。'}</strong><br>${lab.stage===2?lab.b===0?'加上 0，终点与第一个加数的位置相同。':total===0?'两个加数互为相反数，移动后恰好回到 0。':`加正数向右，加负数向左；终点表示和。${lab.a*lab.b<0?'方向相反时，看哪段移动更长。':'同向移动时，路程相加。'}`:'第二步要从第一步的终点接着走，不是重新从 0 出发。'}</p>`;
 }else if(id==='C2-02'){
  const total=lab.start+lab.delta,expected=lab.delta>0?'greater':lab.delta<0?'smaller':'equal';
  svg.innerHTML=`<text x="380" y="38" text-anchor="middle" font-size="25">原来的数 ${signed(lab.start)}　加上 ${plusNumber(lab.delta)}</text>${arithmeticLine([{position:lab.start,label:`原来的数 ${signed(lab.start)}`},...(lab.prediction?[{position:total,label:`和 ${signed(total)}`}]:[])])}${lab.prediction?movementSVG(lab.start,total,247,lab.delta===0?'不移动':`${lab.delta>0?'向右':'向左'} ${pretty(Math.abs(lab.delta))}`,'#a57543'):''}`;
  observation.innerHTML=`<p><strong>${lab.prediction?`${lab.prediction===expected?'判断正确。':'再看终点与起点的相对位置。'}${signed(lab.start)} ＋ ${plusNumber(lab.delta)} = ${signed(total)}`:'固定起点，先判断加上这个数后，和怎样变化。'}</strong><br>${lab.prediction?lab.delta>0?'加上正数，和比原来的数大。这与和本身是正数还是负数无关。':lab.delta<0?'加上负数，和比原来的数小。这与起点位于 0 的哪一侧无关。':'加上 0，和等于原来的数。':'“和变大”要比较和与原来的数，不能只看和的正负。'}</p>`;
 }else if(id==='C2-03'){
  const source=arithmeticGroups[lab.group],values=lab.order.map(index=>source[index]),left=values.slice(0,lab.split),right=values.slice(lab.split),leftSum=sumValues(left),rightSum=sumValues(right),total=sumValues(source);
  svg.innerHTML=`<text x="380" y="35" text-anchor="middle" font-size="16" fill="#72806b">原来的和：${sumText(source)}</text><rect x="45" y="63" width="670" height="86" rx="9" fill="#eef1e9"/><text x="380" y="112" text-anchor="middle" font-size="25">[ ${sumText(left)} ] ＋ [ ${sumText(right)} ]</text>${lab.verified?`<text x="380" y="192" text-anchor="middle" font-size="26">${plusNumber(leftSum)} ＋ ${plusNumber(rightSum)} = ${signed(total)}</text><text x="380" y="234" text-anchor="middle" font-size="16" fill="#50705a">重排前后的总和相同</text>`:'<text x="380" y="199" text-anchor="middle" font-size="18" fill="#72806b">动手重排、改变分组，再计算两组的和。</text>'}`;
  observation.innerHTML=`<p><strong>${lab.verified?`前一组的和为 ${signed(leftSum)}，后一组的和为 ${signed(rightSum)}，总和仍为 ${signed(total)}。`:'选择整张带符号卡片，找一找能凑成 0 或整数的组合。'}</strong><br>${lab.verified?'交换加数的位置、改变相加的分组，总和不变。合适的顺序与分组能让计算更方便。':'现在的断点把前 '+lab.split+' 项分为一组，其余项分为另一组。所有加数及其符号都要保留。'}</p>`;
 }else if(id==='C2-04'){
  const summary=massSummary(lab);
  svg.innerHTML=`<text x="380" y="34" text-anchor="middle" font-size="22">每件统一标准 ${pretty(lab.standard)} g，共 ${summary.count} 件</text>${lab.deviations.map((deviation,index)=>{const width=620/summary.count,x=70+index*width;return `<rect x="${x+5}" y="65" width="${width-10}" height="103" rx="7" fill="${index===lab.selected?'#e2ecdc':'#eef1e9'}" stroke="${index===lab.selected?'#799567':'#d6dece'}"/><text x="${x+width/2}" y="92" text-anchor="middle" font-size="15">第 ${index+1} 件</text><text x="${x+width/2}" y="122" text-anchor="middle" font-size="20">${pretty(lab.standard+deviation)} g</text><text x="${x+width/2}" y="150" text-anchor="middle" font-size="15" fill="#936a42">偏差 ${deviation>0?'＋':''}${signed(deviation)}</text>`;}).join('')}<text x="380" y="216" text-anchor="middle" font-size="24">${lab.revealed?`${lab.standard} × ${summary.count} ＋ ${plusNumber(summary.deviation)} = ${pretty(summary.actual)} g`:'总实际质量 = 标准质量 × 件数 + 偏差和'}</text>`;
  observation.innerHTML=`<p><strong>${lab.revealed?`偏差和为 ${signed(summary.deviation)} g；总实际质量为 ${pretty(summary.actual)} g。`:'逐件看实际质量与偏差，再求总实际质量。'}</strong><br>${lab.revealed?summary.deviation===0?`偏差和为 0 只表示超出与不足互相抵消。${summary.count} 件的总实际质量仍是 ${pretty(summary.actual)} g。`:`总实际质量比 ${summary.count} 件标准质量的总和${summary.deviation>0?'多':'少'} ${pretty(Math.abs(summary.deviation))} g。`:'统一标准只写一次，再乘件数。偏差和表示总共超过或低于标准多少，不能当成总实际质量。'}</p>`;
 }else if(id==='C2-05'){
  const correct=lab.choice!==null&&lab.choice===-lab.b,result=lab.a-lab.b;
  svg.innerHTML=`<text x="380" y="36" text-anchor="middle" font-size="27">${plusNumber(lab.a)} − ${plusNumber(lab.b)}${correct?` = ${plusNumber(lab.a)} ＋ ${plusNumber(-lab.b)}`:' = ?'}</text>${arithmeticLine([{position:lab.a,label:`被减数 ${signed(lab.a)}`},...(correct?[{position:result,label:`差 ${signed(result)}`}]:[])])}${correct?movementSVG(lab.a,result,246,-lab.b===0?'加上 0，原地不动':`加上 ${plusNumber(-lab.b)}：${-lab.b>0?'向右':'向左'} ${pretty(Math.abs(lab.b))}`,'#a57543'):''}`;
  observation.innerHTML=`<p><strong>${lab.choice===null?'先选择减数的相反数。':correct?`转换正确：${plusNumber(lab.a)} − ${plusNumber(lab.b)} = ${signed(result)}`:'这张卡还不是减数的相反数，再核对一次。'}</strong><br>${correct?lab.b===0?'0 的相反数仍为 0。减去 0，结果等于被减数。':`减数是 ${signed(lab.b)}，它的相反数是 ${signed(-lab.b)}。先把减法变成加法，再按加法移动。`:'被减数不变，减号变加号，减数变成它的相反数。'}</p>`;
 }else if(id==='C2-06'){
  const terms=mixedGroups[lab.group],complete=mixedComplete(lab),converted=lab.order.map(index=>Object.hasOwn(lab.converted,index)?plusNumber(lab.converted[index]):'□'),values=lab.order.map(index=>lab.converted[index]),total=complete?sumValues(values):null;
  svg.innerHTML=`<text x="380" y="35" text-anchor="middle" font-size="17" fill="#72806b">原式（运算顺序未改动）</text><text x="380" y="76" text-anchor="middle" font-size="25">${sourceMixedText(lab)}</text><path d="M380 94v25m-6-6 6 6 6-6" stroke="#b1bfaa" fill="none"/><rect x="36" y="137" width="688" height="58" rx="8" fill="#eef1e9"/><text x="380" y="175" text-anchor="middle" font-size="25">${converted.join(' ＋ ')}${lab.computed?` = ${signed(total)}`:''}</text><text x="380" y="235" text-anchor="middle" font-size="16" fill="#62735a">${complete?'每张卡已成为加数，可以连同符号一起重排。':'先逐张转换，保留正负号。□ 表示尚未转换。'}</text>`;
  observation.innerHTML=`<p><strong>${lab.feedback?esc(lab.feedback):lab.computed?`原式与带符号的和都等于 ${signed(total)}。`:'先把加减混合运算统一成加法，再计算。'}</strong><br>${lab.computed?`省略加号和括号后可写为 ${esc(compactSum(values))} = ${signed(total)}。每个数前面的符号仍与它一起保留。`:complete?'转换已完成。可以重排整张卡，再核对并求值。':'加上一个数保留这个数；减去一个数改为加上它的相反数。未转换完之前先不求值。'}</p>`;
 }else{
  const actual=Math.abs(lab.b-lab.a),candidate=lab.expression?distanceExpression(lab):null,start=axisX(lab.a,-10,10),end=axisX(lab.b,-10,10);
  svg.innerHTML=`<text x="380" y="35" text-anchor="middle" font-size="24">A：${signed(lab.a)}　　B：${signed(lab.b)}</text>${arithmeticLine()}<path d="M${start} 224H${end}M${start} 217v14M${end} 217v14" stroke="#c2945f" stroke-width="6" stroke-linecap="round"/><text x="${(start+end)/2}" y="266" text-anchor="middle" font-size="21" fill="#966b40">${lab.checked?`实际距离 ${pretty(actual)}`:'两点之间的长度'}</text>${handle({key:'a',x:start,y:172,label:'改变点 A 表示的数',value:lab.a,min:-5,max:5})}${handle({key:'b',x:end,y:172,label:'改变点 B 表示的数',value:lab.b,min:-5,max:5,color:'#b37f4b'})}`;
  observation.innerHTML=`<p><strong>${!lab.expression?'先选择一个候选表达式。':!lab.checked?'已选候选表达式，检验当前点位。':candidate===actual?`这个试例通过：候选值 ${signed(candidate)}，实际距离 ${pretty(actual)}。`:`这个试例不通过：候选值 ${signed(candidate)}，实际距离 ${pretty(actual)}。`}</strong><br>${lab.checked?actual===0?'两点重合，距离是 0。':candidate<0?'候选值为负数，不能表示距离。交换端点后，两个数的差可能改变符号，距离保持不变。':'距离是非负的长度。继续试交换端点或两点重合，检查表达式是否仍适用。':'拖动两个点，或用滑块改变点位。距离不带方向。'}${lab.records.length?' 已记录的试例只能说明这些情况；|b − a| 用绝对值去掉差的方向，表示两点间的非负长度。':''}</p>${lab.records.length?`<div class="trial-table-wrap"><table class="trial-table"><caption>所选表达式的试例记录</caption><thead><tr><th scope="col">a，b</th><th scope="col">候选值</th><th scope="col">实际距离</th><th scope="col">核对</th></tr></thead><tbody>${lab.records.map(record=>`<tr><td>${signed(record.a)}，${signed(record.b)}</td><td>${signed(record.value)}</td><td>${pretty(record.actual)}</td><td>${record.value===record.actual?'通过':'不通过'}</td></tr>`).join('')}</tbody></table></div>`:''}`;
 }
 for(const key of ['a','b','start','delta','standard','deviation']){const value=key==='deviation'?lab.deviations?.[lab.selected]:lab[key];if(value===undefined)continue;const output=$(`#output-${key}`);if(output)output.textContent=`${signed(value)}${['standard','deviation'].includes(key)?' g':''}`;const range=$(`#control-${key}`);if(range)range.value=value;}
}
function moveWholeCard(lab,delta){const position=lab.order.indexOf(lab.selected),next=position+delta;if(next>=0&&next<lab.order.length)[lab.order[position],lab.order[next]]=[lab.order[next],lab.order[position]];}
function handleArithmeticAction(action,button){
 if(productModule(S.moduleId))return handleProductAction(action,button);
 const lab=labState(),value=button.dataset.value;
 if(action==='addition-predict'){lab.prediction=value;lab.stage=0;redrawLocalControls();}
 else if(action==='addition-move'){if(lab.prediction!==null){lab.stage=lab.stage===2?0:lab.stage+1;redrawLocalControls();}}
 else if(action==='addition-case'){lab.b=value==='cancel'?-lab.a:0;resetArithmeticResult(lab);drawLab();}
 else if(action==='change-predict'){lab.prediction=value;redrawLocalControls();}
 else if(action==='change-zero'){lab.delta=0;resetArithmeticResult(lab);drawLab();}
 else if(action==='select-addend'){lab.selected=Number(button.dataset.index);redrawLocalControls();}
 else if(action==='move-addend'){moveWholeCard(lab,Number(button.dataset.delta));lab.verified=false;redrawLocalControls();}
 else if(action==='verify-grouping'){lab.verified=true;drawLab();}
 else if(action==='new-addend-group'){lab.group=(lab.group+1)%arithmeticGroups.length;lab.order=[0,1,2,3];lab.selected=0;lab.verified=false;redrawLocalControls();}
 else if(action==='select-mass'){lab.selected=Number(button.dataset.index);redrawLocalControls();}
 else if(action==='mass-total'){lab.revealed=true;drawLab();}
 else if(action==='mass-balance'){lab.deviations=lab.deviations.map((_,index)=>index===0?-2:index===1?2:0);lab.revealed=false;redrawLocalControls();}
 else if(action==='subtraction-choose'){lab.choice=Number(value);redrawLocalControls();}
 else if(action==='subtraction-case'){lab.a=value==='negative'?-3:0;lab.b=-5;lab.choice=null;redrawLocalControls();}
 else if(action==='select-mixed-card'){lab.selected=Number(button.dataset.index);lab.feedback=null;redrawLocalControls();}
 else if(action==='convert-mixed-card'){
  const selected=Number(value),term=mixedGroups[lab.group][lab.selected],expected=mixedExpected(term);
  if(selected===expected){lab.converted[lab.selected]=selected;lab.computed=false;lab.feedback=`第 ${lab.selected+1} 张转换正确：带符号的加数为 ${plusNumber(selected)}。`;}
  else lab.feedback=term.op==='-'?'这里是减去一个数，应当加上它的相反数。再试一次。':'这里保留原来这个带符号的数，再试一次。';
  redrawLocalControls();
 }
 else if(action==='move-mixed-card'){if(mixedComplete(lab)){moveWholeCard(lab,Number(button.dataset.delta));lab.computed=false;lab.feedback=null;redrawLocalControls();}}
 else if(action==='compute-mixed'){if(mixedComplete(lab)){lab.computed=true;lab.feedback=null;drawLab();}}
 else if(action==='new-mixed-group'){lab.group=(lab.group+1)%mixedGroups.length;lab.order=[0,1,2,3];lab.selected=0;lab.converted={};lab.computed=false;lab.feedback=null;redrawLocalControls();}
 else if(action==='distance-expression'){if(lab.expression!==value)lab.records=[];lab.expression=value;lab.checked=false;redrawLocalControls();}
 else if(action==='verify-distance'){
  if(lab.expression){lab.checked=true;const record={a:lab.a,b:lab.b,value:distanceExpression(lab),actual:Math.abs(lab.b-lab.a)};lab.records=[...lab.records.filter(item=>item.a!==lab.a||item.b!==lab.b),record].slice(-5);drawLab();}
 }
 else if(action==='distance-case'){
  if(value==='cross'){lab.a=-3;lab.b=2;}else if(value==='reverse'){[lab.a,lab.b]=[lab.b,lab.a];}else lab.b=lab.a;
  lab.checked=false;drawLab();
 }
 else return false;
 return true;
}

function compactSum(values){return values.map((value,index)=>`${index===0?'':value<0?' − ':' ＋ '}${index===0?signed(value):pretty(Math.abs(value))}`).join('');}

function drawLab() {
 const svg=$('#lab-svg'),observation=$('#lab-observation'); if(!svg||!observation)return;
 const focused=document.activeElement?.dataset?.drag; const lab=labState();
 if(arithmeticModule(S.moduleId)){
  drawArithmeticLab(svg,observation,lab);
  if(focused)svg.querySelector(`[data-drag="${focused}"]`)?.focus({preventScroll:true});
  return;
 }
 if(expansionModule(S.moduleId)){
  drawExpansionLab(svg,observation,lab);
  if(focused)svg.querySelector(`[data-drag="${focused}"]`)?.focus({preventScroll:true});
  return;
 }
 if(foundationModule(S.moduleId)){
  drawFoundationLab(svg,observation,lab);
  if(focused)svg.querySelector(`[data-drag="${focused}"]`)?.focus({preventScroll:true});
  return;
 }
 if(S.moduleId==='N-NEG-COMP') {
  const x=value=>80+(value+10)*58;
  svg.innerHTML=`<rect x="80" y="150" width="580" height="1" fill="#9cae96"/><path d="M80 150h617m-10-6 10 6-10 6" fill="none" stroke="#6a8060" stroke-width="2"/>${Array.from({length:11},(_,index)=>`<path d="M${80+index*58} 143v14" stroke="#a8b69e"/><text x="${80+index*58}" y="184" text-anchor="middle" font-size="14" fill="#72806b">${index-10}</text>`).join('')}<path d="M${x(lab.a)} 150V77M${x(lab.b)} 150V77" stroke="#c1cbb9" stroke-width="1.5" stroke-dasharray="4 4"/><path d="M${x(lab.a)} 220H660M${x(lab.b)} 249H660" stroke="#d7dfcf" stroke-width="6" stroke-linecap="round"/><path d="M${x(lab.a)} 220h${660-x(lab.a)}" stroke="#75a086" stroke-width="3" stroke-linecap="round"/><path d="M${x(lab.b)} 249h${660-x(lab.b)}" stroke="#cca87d" stroke-width="3" stroke-linecap="round"/><text x="${x(lab.a)}" y="59" text-anchor="middle" font-size="23" fill="#245646">A = ${pretty(lab.a).replace('-','−')}</text><text x="${x(lab.b)}" y="91" text-anchor="middle" font-size="23" fill="#9c6c42">B = ${pretty(lab.b).replace('-','−')}</text><text x="710" y="225" text-anchor="end" font-size="13">距 0：${pretty(-lab.a)}</text><text x="710" y="254" text-anchor="end" font-size="13">距 0：${pretty(-lab.b)}</text>${handle({key:'a',x:x(lab.a),y:150,label:'数轴上的点 A',value:lab.a,min:-10,max:-.5,text:`A 表示 ${lab.a}`})}${handle({key:'b',x:x(lab.b),y:150,label:'数轴上的点 B',value:lab.b,min:-10,max:-.5,color:'#b37f4b',text:`B 表示 ${lab.b}`})}`;
  const compare=lab.a>lab.b?'>':lab.a<lab.b?'<':'=';
  observation.innerHTML=`<p>${lab.revealed?`<strong>${lab.prediction===compare?'预测正确。':'再看一看两点的位置。'} A ${esc(compare)} B</strong><br>${compare==='='?'两点重合，表示的数相等。':`点 ${lab.a>lab.b?'A':'B'} 在右边，表示的数更大。两个负数，距 0 越远的数反而越小。`}`:'<strong>先预测：A 与 B 谁更大？</strong><br>拖动两个点，或用滑块操作；再选择你的判断。'}</p><div class="predict-row">${['>','<','='].map(value=>`<button data-action="predict" data-value="${esc(value)}" class="${lab.prediction===value&&lab.revealed?'selected':''}">A ${esc(value)} B</button>`).join('')}</div>`;
 } else if(S.moduleId==='A-LIKE-COMBINE') {
  const p1=lab.dragged?.key==='term-a'?lab.dragged:{x:211,y:91},p2=lab.dragged?.key==='term-b'?lab.dragged:{x:549,y:91};
  svg.innerHTML=`<text x="380" y="32" text-anchor="middle" font-size="13" fill="#72806b">已经给定同类项，字母部分相同：${esc(lab.letters)}</text><g data-drag="term-a" tabindex="0" role="button" aria-label="将第一项拖入合并区，或按回车合并"><rect x="${p1.x-82}" y="${p1.y-32}" width="164" height="64" rx="8" fill="#e4eff4" stroke="#b2cbd7"/><text x="${p1.x}" y="${p1.y+10}" text-anchor="middle" font-size="31" fill="#3b6f8d">${termText(lab.a,lab.letters)}</text></g><text x="380" y="103" text-anchor="middle" font-size="26" fill="#98a68e">+</text><g data-drag="term-b" tabindex="0" role="button" aria-label="将第二项拖入合并区，或按回车合并"><rect x="${p2.x-82}" y="${p2.y-32}" width="164" height="64" rx="8" fill="#f7ead9" stroke="#d9c09a"/><text x="${p2.x}" y="${p2.y+10}" text-anchor="middle" font-size="31" fill="#a77544">${termText(lab.b,lab.letters)}</text></g><path d="m211 141 0 29 95 29m243-58v29l-95 29" fill="none" stroke="#ced9c5" stroke-width="2"/><rect x="256" y="188" width="248" height="78" rx="9" fill="${lab.joined?'#e6eee1':'#f6f8f1'}" stroke="#afc2a0" stroke-width="1.5" ${lab.joined?'':'stroke-dasharray="6 5"'}/><text x="380" y="${lab.joined?237:232}" text-anchor="middle" font-size="${lab.joined?33:17}" fill="#38604a">${lab.joined?termText(lab.a+lab.b,lab.letters):'把两项拖到这里合并'}</text>`;
  observation.innerHTML=`<p>${lab.joined?`<strong>${pretty(lab.a).replace('-','−')} + (${pretty(lab.b).replace('-','−')}) = ${pretty(lab.a+lab.b).replace('-','−')}</strong><br>${lab.a+lab.b===0?'系数相加为 0，合并结果就是 0。':`系数相加，字母部分 ${esc(lab.letters)} 保持不变。`}`:'<strong>合并时，什么变了，什么没变？</strong><br>先猜结果，再把卡片拖入合并区；也可以点击按钮。'}</p><div class="predict-row"><button data-action="combine" class="${lab.joined?'selected':''}">${lab.joined?'重新看合并结果':'合并这两项'}</button></div>`;
 } else {
  svg.innerHTML=angleSVG(lab.angle,lab.rotation);
  observation.innerHTML=`<p><strong>∠AOB = ∠BOC = ${pretty(lab.angle/2)}°</strong><br>OB 始终是角平分线。整个角 ∠AOC = ${pretty(lab.angle)}°，是每个子角的 2 倍；改变朝向，关系也不变。</p>`;
 }
 for(const key of ['a','b','angle','rotation']) { const node=$(`#output-${key}`); if(node)node.textContent=`${pretty(lab[key])}${['angle','rotation'].includes(key)?'°':''}`; const range=$(`#control-${key}`); if(range)range.value=lab[key]; }
 if(focused) svg.querySelector(`[data-drag="${focused}"]`)?.focus({preventScroll:true});
}
function practiceDiagram(diagram){
 if(!diagram)return '';
 if(diagram.type==='angle')return `<div class="practice-diagram"><svg viewBox="150 0 440 450" role="img" aria-label="OB 平分角 AOC，已知角度标在图中">${angleSVG(clamp(Number(diagram.angle)||80,10,175),Number(diagram.rotation)||0,diagram.known || 'whole')}</svg></div>`;
 if(diagram.type==='numberline')return `<div class="practice-diagram numberline-diagram"><svg viewBox="0 0 760 250" role="img" aria-label="题目给定的数轴示意图，按图中标注与点名作答">${lineSVG(diagram)}</svg></div>`;
 if(diagram.type==='axis-check')return `<div class="practice-diagram numberline-diagram"><svg viewBox="0 0 760 250" role="img" aria-label="题目给定的直线与刻度示意图，请检查规范画法">${axisCheckSVG(diagram.variant,Number(diagram.unit)||1)}</svg></div>`;
 return '';
}
function arithmeticMathHtml(html){return String(html).replace(/\([^()]*\)/g,term=>`<span class="arithmetic-term">${term}</span>`);}
function choiceOptionHtml(question,option){
 const html=option.html || esc(option.label);
 if(arithmeticModule(question.moduleId))return arithmeticMathHtml(html);
 if(question.moduleId!=='C1-10')return html;
 return html.split(/([＜＞])/).map(part=>part==='＜'||part==='＞'?`<span class="order-relation">${part}</span><wbr>`:`<span class="order-term">${part}</span>`).join('');
}
function questionStepMarkup(question,last){
 if(!question.step)return '';
 if(['C2-10','C2-12'].includes(question.moduleId))return `<fieldset class="step-card-fieldset"><legend>${esc(question.step.label)}</legend><div class="choice-options arithmetic-options step-choice-options">${question.step.options.map(option=>`<label class="choice-option"><input type="radio" name="step" value="${esc(option.value)}" ${String(last?.step)===String(option.value)?'checked':''}><span class="math">${arithmeticMathHtml(esc(option.label))}</span></label>`).join('')}</div></fieldset>`;
 return `<fieldset><legend><label for="answer-step">${esc(question.step.label)}</label></legend><select class="step-select" id="answer-step" name="step"><option value="">请选择关键一步</option>${question.step.options.map(option=>`<option value="${esc(option.value)}" ${String(last?.step)===String(option.value)?'selected':''}>${esc(option.label)}</option>`).join('')}</select></fieldset>`;
}
function questionMarkup(question, state, review=false) {
 const input=question.input || {type:'number'};
 const last=S.drafts[`${S.profileId}/${review?S.mistakeId:question.id}`] || (review?null:state?.lastAnswer);
 const diagram=practiceDiagram(question.diagram);
 const options=input.options || [];
 const answerInput=input.type==='choice'?`<fieldset><legend>${esc(input.label || '选择你的答案')}</legend><div class="choice-options ${question.moduleId==='C1-10'?'order-options':arithmeticModule(question.moduleId)?'arithmetic-options':''}">${options.map(option=>`<label class="choice-option"><input type="radio" name="value" value="${esc(option.value)}" ${String(last?.value)===String(option.value)?'checked':''}><span class="math ${question.moduleId==='C1-10'?'order-chain':''}">${choiceOptionHtml(question,option)}</span></label>`).join('')}</div></fieldset>`:`<div><label class="input-label" for="answer-value">${esc(input.label || '填写你的答案')}</label><div class="answer-entry"><input id="answer-value" name="value" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(input.placeholder || '整数、小数或分数') }" value="${esc(last?.value || '')}" aria-describedby="entry-note">${input.suffixHtml?`<span class="math">${input.suffixHtml}</span>`:''}${input.unit?`<span>${esc(input.unit)}</span>`:''}</div><p class="entry-note" id="entry-note">${input.type==='number'?'分数可以写成 1/2；负号可用 - 或 −。':'按题目要求填写。'}</p></div>`;
 const step=questionStepMarkup(question,last);
 return `<p class="question-prompt">${esc(question.prompt)}</p>${question.mathHtml?`<div class="question-math math ${arithmeticModule(question.moduleId)?'arithmetic-math':''}">${arithmeticModule(question.moduleId)?arithmeticMathHtml(question.mathHtml):question.mathHtml}</div>`:''}${diagram}<form id="${review?'review-form':'answer-form'}" class="answer-form" novalidate><fieldset ${!review&&state?.latestCorrect?'disabled':''}>${step}${answerInput}</fieldset><div class="form-actions"><button class="primary" type="submit" data-mutates ${!review&&state?.latestCorrect?'disabled data-locked="true"':''}>${review?'提交复习答案':state?.latestCorrect?'已正确提交':state?.completed?'自己提交一次':'提交答案'}</button>${!review&&state?.completed?`<button type="button" data-action="next-question">${S.round.summary.finished?'查看本轮结果':S.index<S.round.questions.length-1?'下一题 '+icon('arrow'):'继续下一题'}</button>`:''}</div></form>`;
}
function practicePage() {
 const module=currentModule(),round=S.round;
 if(!module||!round)return '<div class="empty-state">没有找到这轮练习。请从知识点重新进入。</div>';
 if(S.resultOpen&&round.summary.finished)return `${moduleHeader(module,'practice')}${resultPage(round)}`;
 S.index=clamp(S.index,0,round.questions.length-1);
 const question=round.questions[S.index],state=question.state || {};
 return `${moduleHeader(module,'practice')}<div class="practice-layout"><section class="question-card"><div class="question-top"><span class="question-counter">第 ${S.index+1} / ${round.questions.length} 题</span><span class="tag ${question.difficulty==='variation'?'orange':'gray'}">${question.difficulty==='variation'?'换个方式想':'基础练习'}</span></div>${questionMarkup(question,state)}${state.feedback?`<div class="feedback ${state.latestCorrect?'':state.attemptCount?'wrong':'invalid'}" role="status"><strong>${state.latestCorrect?'这次答对了':state.attemptCount?'还差一点，再想一想':'先检查填写格式'}</strong>${esc(state.feedback)}${state.latestCorrect?`<br>${esc(completionLabel(state))}${state.independentCorrect?'，计入本轮首次独立正确数。':'；本轮首次成绩保留。'}`:''}</div>`:''}${state.completed&&!state.latestCorrect?`<div class="feedback wrong"><strong>${esc(completionLabel(state))}</strong>这题已记为完成；还可以自己提交一次答案，记录订正结果。</div>`:''}<div class="question-help"><button data-action="hint" data-mutates>${icon('leaf')} 给我一点提示</button><button data-action="solution" data-mutates>查看分步解析</button></div><p class="help-disclaimer">首次提交前使用提示或解析，这题将不计入首次独立答对。</p>${state.hint?`<section class="help-panel" aria-label="本题提示"><h3>想一想</h3><p>${esc(state.hint)}</p></section>`:''}${state.solution?solutionPanel(state.solution,state.answerDisplay):''}</section><aside class="practice-side"><section class="info-card"><h2>本轮 5 道题</h2><div class="question-nav" aria-label="切换练习题">${round.questions.map((item,index)=>`<button data-action="question-index" data-index="${index}" class="${index===S.index?'current':''} ${item.state?.independentCorrect?'done':item.state?.completed?'helped':''}" aria-label="第 ${index+1} 题，${completionLabel(item.state)}" ${index===S.index?'aria-current="step"':''}>${index+1}</button>`).join('')}</div><p>首次独立答对</p><div class="practice-stat">${round.summary.independentCorrect}<small>/ 5</small></div><p>5 题完成后，至少 4 题首次独立答对，即为“本轮达标”。</p>${round.summary.finished?'<button data-action="show-result">查看本轮结果</button>':''}</section><section class="info-card"><h2>慢一点也没关系</h2><p>答错后可以提示、重试和看解析。订正会单独记录，原来的首次成绩不会被覆盖。</p></section><div id="save-state" class="save-state" aria-live="polite"></div></aside></div><div class="mobile-question-nav"><div class="question-nav" aria-label="练习题导航">${round.questions.map((item,index)=>`<button data-action="question-index" data-index="${index}" class="${index===S.index?'current':''} ${item.state?.independentCorrect?'done':item.state?.completed?'helped':''}" aria-label="第 ${index+1} 题，${completionLabel(item.state)}">${index+1}</button>`).join('')}${round.summary.finished?'<button class="compact" data-action="show-result" style="width:auto">查看结果</button>':''}</div></div>`;
}
function solutionPanel(solution, answerDisplay, disclosure=false) {
 const body=`<h3>分步解析</h3><ol>${(solution || []).map(text=>`<li>${esc(text)}</li>`).join('')}</ol>${answerDisplay?`<p class="math" style="margin-top:10px">参考答案：${esc(answerDisplay)}</p>`:''}`;
 return `<section class="help-panel">${disclosure?`<details><summary>查看原题解析</summary>${body}</details>`:body}</section>`;
}
function resultPage(round) {
 return `<section class="result-panel"><div class="result-icon">${icon(round.summary.passed?'check':'leaf')}</div><p class="eyebrow">这一轮，留下一个清楚的记录</p><h2>${round.summary.passed?'本轮达标，继续保持。':'这一轮完成了，再看看哪里需要练习。'}</h2><p class="muted">首次独立答对</p><div class="result-score">${round.summary.independentCorrect}<span> / 5</span></div><p class="result-note">首次提交正确，且提交前没有使用提示或解析，才计入这个数字。<br>这反映本轮表现，不代表已经长期掌握。</p><div class="result-list">${round.questions.map((question,index)=>`<div class="result-item"><span>第 ${index+1} 题 · ${question.difficulty==='variation'?'变式':'基础'}</span>${statusTag(question.state)}<button data-action="question-index" data-index="${index}">查看这题</button></div>`).join('')}</div><div class="result-actions"><button class="primary" data-action="new-round" data-id="${esc(round.moduleId)}" data-mutates>再来一组新题 ${icon('arrow')}</button><button data-action="nav" data-route="mistakes">订正 / 复习错题</button><button data-action="learn" data-id="${esc(round.moduleId)}" data-mutates>返回交互学习</button></div><p class="result-note" style="margin:17px 0 0">错题原题重做只记录复习结果；新的一组题会建立新轮次，保留这轮成绩。</p></section>`;
}
function mistakesPage() {
 const mistake=S.mistakeId?mistakes().find(item=>item.id===S.mistakeId):null;
 if(mistake)return mistakeDetail(mistake);
 let list=[...mistakes()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 if(S.mistakeFilter==='uncorrected')list=list.filter(item=>!item.corrected);
 else if(S.mistakeFilter!=='all')list=list.filter(item=>item.moduleId===S.mistakeFilter);
 return `<div class="page-intro"><div><p class="eyebrow">把卡住的地方，再想明白一次</p><h1>错题复习</h1><p>原题与首次答案一直保留。订正和原题重做单独记录，不覆盖原轮成绩。</p></div><span class="tag">共 ${mistakes().length} 道错题</span></div><div class="mistake-toolbar"><label class="small muted" for="mistake-filter">查看</label><select id="mistake-filter"><option value="all" ${S.mistakeFilter==='all'?'selected':''}>全部错题</option><option value="uncorrected" ${S.mistakeFilter==='uncorrected'?'selected':''}>尚未订正</option>${S.boot.modules.map(module=>`<option value="${esc(module.id)}" ${S.mistakeFilter===module.id?'selected':''}>${esc(module.title)}</option>`).join('')}</select><span class="small muted">订正后也会保留</span></div>${list.length?`<div class="mistake-list">${list.map(item=>`<article class="mistake-card"><div class="info"><div class="meta"><span>${esc(moduleOf(item.moduleId)?.title || item.moduleId)}</span><span>${dateLabel(item.createdAt)}</span><span class="tag ${item.corrected?'':'orange'}">${item.corrected?'已订正':'待订正'}</span></div><p>${esc(item.question.prompt)}</p>${item.question.mathHtml?`<div class="math">${item.question.mathHtml}</div>`:''}</div><button data-action="open-mistake" data-id="${esc(item.id)}">${item.corrected?'再练这题':'去订正'} ${icon('arrow')}</button></article>`).join('')}</div>`:'<div class="empty-state">'+(mistakes().length?'这个分类暂时没有错题。':'目前还没有错题。<br>以后做错的题会保留在这里，随时可以回来复习。')+'</div>'}`;
}
function mistakeDetail(mistake) {
 const rawOriginal=mistake.firstAnswer?.value ?? mistake.firstAnswer;
 const original=mistake.question.input?.type==='choice'?(mistake.question.input.options.find(option=>String(option.value)===String(rawOriginal))?.label || rawOriginal):rawOriginal;
 const originalStep=mistake.question.step?.options.find(option=>String(option.value)===String(mistake.firstAnswer?.step))?.label || mistake.firstAnswer?.step;
 const feedback=S.reviewFeedback?.id===mistake.id?S.reviewFeedback:null;
 return `<div class="breadcrumb"><button data-action="nav" data-route="mistakes">错题复习</button><span>/</span><span>${esc(moduleOf(mistake.moduleId)?.title)}</span></div><div class="page-intro"><div><p class="eyebrow">原题重做 · 复习结果单独记录</p><h1>再想一想这道题</h1><p>不论是否订正，这道错题都会保留。</p></div><span class="tag ${mistake.corrected?'':'orange'}">${mistake.corrected?'已有正确订正':'待订正'}</span></div><div class="practice-layout"><section class="question-card">${questionMarkup(mistake.question,null,true)}${feedback?`<div class="feedback ${feedback.correct?'':'wrong'}" role="status"><strong>${feedback.correct?'这次复习答对了':'再试一次'}</strong>${esc(feedback.message)}<br>只更新复习记录，原轮成绩不变。</div>`:''}<div class="original-answer">首次答案：${esc(typeof original==='object'?JSON.stringify(original):original)}${originalStep?` · 关键步骤：${esc(originalStep)}`:''}<br>原题重做记录：${mistake.reviewAttempts?.length || 0} 次${mistake.corrected?' · 已有正确订正':''}</div>${mistake.hint?`<div class="help-panel"><h3>原题提示</h3><p>${esc(mistake.hint)}</p></div>`:''}${solutionPanel(mistake.solution,mistake.answerDisplay,true)}</section><aside class="practice-side"><section class="info-card"><h2>回到知识点</h2><p>如果规则还不清楚，可以先回画板操作，再来做这道题。</p><button data-action="learn" data-id="${esc(mistake.moduleId)}" data-mutates>返回交互学习</button></section><div id="save-state" class="save-state" aria-live="polite"></div></aside></div>`;
}
async function saveProgress(mode, step, context) {
 const moduleId=S.moduleId;
 const response=await post(`/api/profiles/${encodeURIComponent(context.profileId)}/progress`,{moduleId,mode,step});
 if(!activeContext(context))return;
 if(response.progress?.[moduleId])S.data.progress=response.progress;
 else S.data.progress[moduleId]=response.progress?.mode?response.progress:{mode,step,updatedAt:new Date().toISOString()};
 S.saveStatus='学习位置已保存到家庭电脑';S.syncStatus='记录已更新'; syncBusy();
}
async function openLearn(id, context) {
 if(!await refreshRecords(context))return;
 const module=moduleOf(id); if(!module)return;
 S.moduleId=id; S.route='learn'; S.round=null; S.mistakeId=null; S.learnMode='guided';
 S.step=clamp(Number(S.data.progress?.[id]?.step)||0,0,Math.max(0,(module.learningSteps?.length || 1)-1));
 S.saveStatus='已读取最新学习位置'; paint(true);
 await saveProgress('learn',S.step,context);
}
async function startPractice(id, context, force=false) {
 if(!moduleOf(id))return;
 const data=await refreshProfile(context); if(!activeContext(context))return;
 let round=force?null:[...(data.rounds || [])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).find(item=>item.moduleId===id&&!item.summary.finished);
 if(!round)round=await post(`/api/profiles/${encodeURIComponent(context.profileId)}/rounds`,{moduleId:id});
 if(!activeContext(context))return;
 S.moduleId=id; S.route='practice'; upsertRound(round); S.index=Math.max(0,round.questions.findIndex(question=>!question.state?.completed)); S.resultOpen=false; S.mistakeId=null; S.saveStatus='练习已保存到家庭电脑'; paint(true);
 await saveProgress('practice',S.index,context);
}
async function openRound(id, context) {
 const round=await api(`/api/profiles/${encodeURIComponent(context.profileId)}/rounds/${encodeURIComponent(id)}`);
 if(!activeContext(context))return;
 S.moduleId=round.moduleId; S.route='practice'; upsertRound(round); S.index=Math.max(0,round.questions.findIndex(question=>!question.state?.completed)); S.resultOpen=round.summary.finished; S.saveStatus='已从家庭电脑读取这轮练习的最新记录'; S.syncStatus='记录已更新'; paint(true);
}
function requestIdFor(key) { if(!S.requestIds.has(key))S.requestIds.set(key,uid()); return S.requestIds.get(key); }
async function submitAnswer(form, review=false) {
 const values=new FormData(form),answer={value:String(values.get('value') ?? '').trim()};
 if(values.has('step'))answer.step=String(values.get('step') ?? '');
 if(!answer.value || (values.has('step')&&!answer.step)) { notice('先填写答案，并完成题目要求的关键一步。尚未提交，不影响首次作答。'); (!answer.value?$('[name=value]',form):$('[name=step]',form))?.focus(); return; }
 await mutation(review?'正在保存复习结果…':'正在提交并保存答案…',async context=>{
  if(review) {
   const mistake=mistakes().find(item=>item.id===S.mistakeId); if(!mistake)return;
   const key=`${context.profileId}/mistake/${mistake.id}/${JSON.stringify(answer)}`;
   const result=await post(`/api/profiles/${encodeURIComponent(context.profileId)}/mistakes/${encodeURIComponent(mistake.id)}/review`,{answer,requestId:requestIdFor(key)});
   if(!activeContext(context))return;
   if(result.mistake) { const index=mistakes().findIndex(item=>item.id===mistake.id); S.data.mistakes[index]=result.mistake; }
   S.reviewFeedback={id:mistake.id,correct:result.correct,message:result.message};
   if(result.valid&&result.correct)delete S.drafts[`${S.profileId}/${mistake.id}`];
   if(result.valid)S.requestIds.delete(key);
   S.saveStatus='复习结果已保存';S.syncStatus='记录已更新'; paint();
  } else {
   const roundId=S.round.id,question=S.round.questions[S.index];
   const base=`/api/profiles/${encodeURIComponent(context.profileId)}/rounds/${encodeURIComponent(roundId)}/questions/${encodeURIComponent(question.id)}`;
   const key=`${context.profileId}/${roundId}/${question.id}/${JSON.stringify(answer)}`;
   let result;
   try{result=await post(`${base}/submit`,{answer,requestId:requestIdFor(key)});}
   catch(error){
    if(error.status!==409)throw error;
    const latest=await api(`/api/profiles/${encodeURIComponent(context.profileId)}/rounds/${encodeURIComponent(roundId)}`);
    if(!activeContext(context))return;
    upsertRound(latest);S.syncStatus='记录已更新';S.saveStatus='已读取最新练习记录，本次未重复计分';paint();
    notice('这题的记录已在其他页面或设备更新，已同步最新结果。本次没有重复计分，首次成绩以电脑保存的记录为准。');
    return;
   }
   if(!activeContext(context))return;
   if(result.round)upsertRound(result.round);
   if(result.valid&&result.correct)delete S.drafts[`${S.profileId}/${question.id}`];
   if(result.valid)S.requestIds.delete(key);
   if(!result.valid)notice(result.message || '请检查答案格式，这次未计作首次作答。');
   if(result.valid&&!result.correct) {
    try { const hint=await post(`${base}/hint`); if(activeContext(context)&&hint.round)upsertRound(hint.round); }
    catch(error) { notice(`答案已保存，但提示暂未取到。${error.message}`); }
   }
   try { await refreshProfile(context); }
   catch(error) { notice(`本次作答已经保存，但记录列表暂未刷新。${error.message}`); }
   if(!activeContext(context))return;
   const saved=rounds().find(item=>item.id===roundId); if(saved)S.round=saved;
   S.saveStatus=result.valid?'本次作答已保存到家庭电脑':'答案格式需调整，尚未计分'; paint();
  }
 });
}
async function requestHelp(type, context) {
 const roundId=S.round.id,question=S.round.questions[S.index];
 const result=await post(`/api/profiles/${encodeURIComponent(context.profileId)}/rounds/${encodeURIComponent(roundId)}/questions/${encodeURIComponent(question.id)}/${type}`);
 if(!activeContext(context))return;
 upsertRound(result.round);
 S.saveStatus=type==='hint'?'提示使用已记录':'解析查看已记录'; paint();
}
function showDialog(markup) {
 $('#modal-root').innerHTML=`<dialog id="app-dialog">${markup}</dialog>`;
 const dialog=$('#app-dialog'); if(dialog.showModal)dialog.showModal(); else dialog.setAttribute('open','');
 dialog.addEventListener('click',event=>{ if(event.target===dialog) { const rect=dialog.getBoundingClientRect(); if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDialog(); } });
}
function closeDialog() { const dialog=$('#app-dialog'); if(dialog?.close)dialog.close(); $('#modal-root').innerHTML=''; }
function connectionDialog() {
 const connection=S.boot.connection || {},urls=connection.lanUrls || [],local=connection.localUrl || location.origin;
 showDialog(`<div class="dialog-heading"><h2>用 iPad 接着学</h2><button class="quiet icon-button" data-action="close-dialog" aria-label="关闭连接窗口">${icon('close')}</button></div><p class="dialog-copy">电脑上的程序保持运行，让 iPad 和电脑连接到可互相访问的家庭网络，再扫描下面的二维码。</p>${urls.length?`<label class="small muted" for="lan-url">选择电脑在家庭网络中的地址</label><select id="lan-url" class="step-select">${urls.map(url=>`<option value="${esc(url)}">${esc(url)}</option>`).join('')}</select><div class="qr-panel"><img id="connection-qr" src="/api/qr.svg?url=${encodeURIComponent(urls[0])}" width="155" height="155" alt="所选家庭网络地址的访问二维码"><p>iPad 相机扫码后，<br>使用 Safari 打开。<br><span class="small muted">同一学习档案，<br>使用电脑上的同一份记录。</span></p></div><p class="small muted" style="margin-bottom:5px">也可以在 iPad 浏览器输入</p><div class="connection-url" id="connection-link">${esc(urls[0])}</div><p class="small muted" style="margin-top:12px">若无法连接，尝试列表中的另一个地址，并确认电脑允许家庭网络访问。VPN 或其他网卡地址可能无法从 iPad 访问。</p>`:'<div class="empty-state">暂未发现家庭网络地址。请先让电脑连接家庭网络，再重新打开此窗口。</div>'}<details class="prereq"><summary>这台电脑的访问地址</summary><div class="connection-url">${esc(local)}</div><p class="small muted" style="margin-top:10px">本机地址仅供运行程序的电脑自己访问。</p></details>`);
}
function newProfileDialog() {
 showDialog(`<div class="dialog-heading"><h2>添加学习档案</h2><button class="quiet icon-button" data-action="close-dialog" aria-label="关闭添加档案窗口">${icon('close')}</button></div><p class="dialog-copy">每个档案独立保存学习位置、练习和错题。不需要注册。</p><form id="profile-form" class="profile-form"><label for="profile-name">怎么称呼这位同学？</label><input id="profile-name" name="name" maxlength="24" autocomplete="off" placeholder="例如：小宇" required><div class="form-actions"><button class="primary" type="submit">创建档案</button><button type="button" data-action="close-dialog">取消</button></div></form>`);
 $('#profile-name')?.focus();
}
async function switchProfile(id, restore=false) {
 if(S.busy)return;
 const generation=++S.generation,oldId=S.profileId;
 S.profileId=id; S.busy=true; S.pendingLabel='正在读取学习档案…'; syncBusy(); clearNotice();
 try {
  const [data,bootstrap]=await Promise.all([api(`/api/profiles/${encodeURIComponent(id)}`),api('/api/bootstrap')]);
  if(generation!==S.generation)return;
  S.boot=bootstrap;S.data={progress:{},rounds:[],mistakes:[],...data}; S.route='home'; S.moduleId=null; S.round=null; S.index=0; S.mistakeId=null; S.reviewFeedback=null; S.saveStatus='已从家庭电脑读取最新学习记录';S.syncStatus='记录已更新';
  try{localStorage.setItem('math-profile',id);}catch{}
  if(restore)await restoreHash();
  paint(true);
 }catch(error) { S.profileId=oldId;S.syncStatus='连接失败';S.saveStatus='最新档案未读取'; notice(error.message); if(S.data)paint(); else fatalScreen(error.message); }
 finally { if(generation===S.generation){S.busy=false;S.pendingLabel='';syncBusy();} }
}
async function restoreHash() {
 const parts=location.hash.slice(1).split('/').map(part=>{try{return decodeURIComponent(part);}catch{return '';}});
 if(parts[0]==='learn'&&moduleOf(parts[1])) {S.route='learn';S.moduleId=parts[1];S.step=Number(S.data.progress?.[parts[1]]?.step)||0;}
 else if(parts[0]==='practice'&&rounds().some(round=>round.id===parts[1])) {const round=rounds().find(item=>item.id===parts[1]);S.route='practice';S.moduleId=round.moduleId;S.round=round;S.index=Math.max(0,round.questions.findIndex(question=>!question.state?.completed));S.resultOpen=round.summary.finished;}
 else if(parts[0]==='mistakes') {S.route='mistakes';S.mistakeId=mistakes().some(item=>item.id===parts[1])?parts[1]:null;}
 else if(parts[0]==='catalog')S.route='catalog';
}
function fatalScreen(message) {
 $('#app').innerHTML=`<main class="initial-state"><div class="error-screen"><div class="brand-mark" aria-hidden="true" style="margin:0 auto 24px">∠</div><h1>暂时没有连接到学习电脑</h1><p>${esc(message)}</p><button class="primary" data-action="reload">重新连接</button></div></main>`;
}
async function boot() {
 try {
  S.boot=await api('/api/bootstrap');
  if(!Array.isArray(S.boot.modules)||!Array.isArray(S.boot.profiles))throw new Error('学习内容尚未准备好，请稍后重试。');
  if(!S.boot.profiles.length) {
   $('#app').innerHTML='<main class="initial-state"><div class="brand-mark" aria-hidden="true">∠</div><h1>交互学数学</h1><p>先为自己建立一个学习档案。</p><button class="primary" data-action="new-profile">创建学习档案</button></main>';
   newProfileDialog();return;
  }
  let preferred;try{preferred=localStorage.getItem('math-profile');}catch{}
  await switchProfile(S.boot.profiles.some(profile=>profile.id===preferred)?preferred:S.boot.profiles[0].id,true);
 }catch(error){fatalScreen(error.message);}
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]'); if(!button||button.disabled)return;
 const action=button.dataset.action;
 if(button.tagName==='A')event.preventDefault();
 if(action==='dismiss-notice'){clearNotice();return;}
 if(action==='reload'){location.reload();return;}
 if(action==='close-dialog'){closeDialog();return;}
 if(action==='connection'){connectionDialog();return;}
 if(action==='new-profile'){newProfileDialog();return;}
 if(action==='nav')return navigate(button.dataset.route);
 if(action==='learn')return mutation('正在同步学习位置…',context=>openLearn(button.dataset.id,context));
 if(action==='practice') {
  if(S.route==='practice'&&S.moduleId===button.dataset.id&&S.round)return mutation('正在读取最新练习记录…',context=>openRound(S.round.id,context),{reading:true});
  return mutation('正在读取练习…',context=>startPractice(button.dataset.id,context));
 }
 if(action==='new-round')return mutation('正在准备新的一组题…',context=>startPractice(button.dataset.id,context,true));
 if(action==='open-round')return mutation('正在读取这轮练习…',context=>openRound(button.dataset.id,context),{reading:true});
 if(action==='learn-mode'){S.learnMode=button.dataset.mode;paint();return;}
 if(action==='learn-step')return mutation('正在保存学习位置…',async context=>{S.step=clamp(S.step+Number(button.dataset.delta),0,(currentModule().learningSteps?.length || 1)-1);paint();await saveProgress('learn',S.step,context);});
 if(action==='reset-lab'){S.labs[S.moduleId]=defaultLab(S.moduleId);paint();return;}
 if(action==='predict'){const lab=labState();lab.prediction=button.dataset.value;lab.revealed=true;drawLab();return;}
 if(action==='combine'){labState().joined=true;drawLab();return;}
 if(action==='axis-judge'){labState().judgment=button.dataset.value==='yes';drawLab();return;}
 if(action==='check-position'){labState().checked=true;drawLab();return;}
 if(action==='new-position-target'){const lab=labState(),targets=[-2,-1,0,1,2];lab.targetIndex=(lab.targetIndex+1)%targets.length;lab.target=targets[lab.targetIndex];lab.slot=0;lab.checked=false;drawLab();return;}
 if(action==='opposite-flip'){const lab=labState();lab.flips=(lab.flips+1)%3;drawLab();return;}
 if(action==='simplify-layer'){const lab=labState();lab.revealed=lab.revealed<lab.signs.length?lab.revealed+1:0;drawLab();return;}
 if(action==='copy-distance'){labState().copied=true;drawLab();return;}
 if(action==='zero-number'){const lab=labState();lab.a=0;resetFoundationResult(lab);drawLab();return;}
 if(action==='select-number-card'){const lab=labState();lab.selected=Number(button.dataset.index);lab.feedback=null;redrawLocalControls();return;}
 if(action==='classify-number'){classifySelectedCard(labState(),button.dataset.value);redrawLocalControls();return;}
 if(action==='classification-view'){const lab=labState();lab.view=button.dataset.value;lab.feedback=null;redrawLocalControls();return;}
 if(action==='actual-at-baseline'){const lab=labState();lab.actual=lab.baseline;drawLab();return;}
 if(action==='compare-distance'){labState().prediction=button.dataset.value;drawLab();return;}
 if(action==='distance-symmetric'){const lab=labState();lab.b=-lab.a;lab.prediction=null;drawLab();return;}
 if(action==='distance-zero'){const lab=labState();lab.a=0;lab.prediction=null;drawLab();return;}
 if(action==='select-sort-card'){labState().selected=Number(button.dataset.index);redrawLocalControls();return;}
 if(action==='sort-direction'){const lab=labState();lab.direction=button.dataset.value;lab.checked=false;redrawLocalControls();return;}
 if(action==='move-sort-card'){const lab=labState(),index=lab.order.indexOf(lab.selected),next=index+Number(button.dataset.delta);if(next>=0&&next<lab.order.length){[lab.order[index],lab.order[next]]=[lab.order[next],lab.order[index]];lab.checked=false;}redrawLocalControls();return;}
 if(action==='check-sort'){labState().checked=true;drawLab();return;}
 if(action==='new-sort-group'){const lab=labState();lab.group=(lab.group+1)%sortGroups.length;lab.order=[0,1,2,3,4];lab.selected=0;lab.checked=false;redrawLocalControls();return;}
 if(action==='toggle-candidate'){const lab=labState(),value=Number(button.dataset.value);lab.selected=lab.selected.includes(value)?lab.selected.filter(item=>item!==value):[...lab.selected,value];lab.candidatesChecked=false;lab.filterShown=false;lab.feedback=null;redrawLocalControls();return;}
 if(action==='check-candidates'){const lab=labState(),expected=distanceCandidates(lab.distance);lab.candidatesChecked=lab.selected.length===expected.length&&expected.every(value=>lab.selected.includes(value));lab.filterShown=false;lab.feedback={message:lab.candidatesChecked?'候选已找全，再用附加条件筛选。':'还需检查：所选数到 0 的距离都正确吗？有没有漏掉另一侧？'};redrawLocalControls();return;}
 if(action==='filter-candidates'){const lab=labState();if(lab.candidatesChecked){lab.filterShown=true;drawLab();}return;}
 if(arithmeticModule(S.moduleId)&&handleArithmeticAction(action,button))return;
 if(action==='hint'||action==='solution')return mutation(action==='hint'?'正在读取提示并保存…':'正在读取解析并保存…',context=>requestHelp(action,context));
 if(action==='question-index'){S.index=Number(button.dataset.index);S.resultOpen=false;paint();return;}
 if(action==='next-question'){
  if(S.round.summary.finished){S.resultOpen=true;paint(true);return;}
  const next=S.round.questions.findIndex((question,index)=>index>S.index&&!question.state?.completed);
  S.index=next!==-1?next:Math.max(0,S.round.questions.findIndex(question=>!question.state?.completed));S.resultOpen=false;paint(true);return;
 }
 if(action==='show-result'){S.resultOpen=true;paint(true);return;}
 if(action==='open-mistake')return mutation('正在读取最新错题记录…',async context=>{if(!await refreshRecords(context))return;S.route='mistakes';S.mistakeId=button.dataset.id;S.reviewFeedback=null;paint(true);},{reading:true});
});
document.addEventListener('submit',async event=>{
 if(!['answer-form','review-form','profile-form'].includes(event.target.id))return;
 event.preventDefault();
 if(event.target.id==='answer-form')return submitAnswer(event.target,false);
 if(event.target.id==='review-form')return submitAnswer(event.target,true);
 const form=event.target,name=String(new FormData(form).get('name') || '').trim();
 if(!name){notice('先填写一个称呼。');$('#profile-name')?.focus();return;}
 await mutation('正在创建学习档案…',async()=>{
  const profile=await post('/api/profiles',{name});
  const data=await api(`/api/profiles/${encodeURIComponent(profile.id)}`);
  if(!S.boot.profiles.some(item=>item.id===profile.id))S.boot.profiles.push(profile);
  S.generation++;S.profileId=profile.id;S.data={progress:{},rounds:[],mistakes:[],...data};S.route='home';S.round=null;S.moduleId=null;S.mistakeId=null;S.saveStatus='学习档案已保存';S.syncStatus='记录已更新';
  try{localStorage.setItem('math-profile',profile.id);}catch{}
  closeDialog();paint(true);
 });
});
document.addEventListener('change',event=>{
 if(event.target.id==='profile-select') {if(S.busy){event.target.value=S.profileId;return;}switchProfile(event.target.value);}
 if(event.target.id==='mistake-filter'){S.mistakeFilter=event.target.value;paint();}
 if(event.target.id==='lan-url'){
  const url=event.target.value;$('#connection-qr').src=`/api/qr.svg?url=${encodeURIComponent(url)}`;$('#connection-link').textContent=url;
 }
 if(event.target.dataset.control==='letters'){const lab=labState();lab.letters=event.target.value;lab.joined=false;drawLab();}
 if(event.target.dataset.axisToggle){const lab=labState();lab[event.target.dataset.axisToggle]=event.target.checked;lab.judgment=null;drawLab();}
 if(event.target.dataset.signIndex!==undefined){const lab=labState();lab.signs[Number(event.target.dataset.signIndex)]=event.target.value;lab.revealed=0;drawLab();}
 if(event.target.dataset.control==='unit'){const lab=labState();lab.unit=Number(event.target.value);lab.checked=false;lab.judgment=null;drawLab();}
 if(event.target.dataset.control==='layers'){
  const lab=labState(),length=Number(event.target.value);lab.signs=Array.from({length},(_,index)=>lab.signs[index] || '-');lab.revealed=0;
  $('.lab-controls').innerHTML=labControls(lab);drawLab();$('#control-layers')?.focus();
 }
 if(event.target.dataset.control==='scene'){const lab=labState(),scene=quantityScenes[event.target.value];lab.scene=event.target.value;lab.actual=scene.actual;lab.baseline=scene.baseline;lab.positive=1;redrawLocalControls();$('#control-scene')?.focus();}
 if(event.target.dataset.control==='positive'){labState().positive=Number(event.target.value);drawLab();}
 const productKey=event.target.dataset.control;
 if(productModule(S.moduleId)&&['numberIndex','productSplit','dividendIndex','divisorIndex','decimalIndex'].includes(productKey)){
  const lab=labState();if(productKey==='productSplit'){lab.split=Number(event.target.value);lab.verified=false;}else{lab[productKey]=Number(event.target.value);resetProductResult(lab);if(productKey==='decimalIndex'){lab.ratioReady=false;lab.decimalScale=null;}}
  redrawLocalControls();$(`#control-${productKey}`)?.focus({preventScroll:true});
 }
 if(event.target.dataset.control==='split'){const lab=labState();lab.split=Number(event.target.value);lab.verified=false;drawLab();}
 if(event.target.dataset.control==='massCount'){const lab=labState(),count=Number(event.target.value);lab.deviations=Array.from({length:count},(_,index)=>lab.deviations[index]||0);lab.selected=Math.min(lab.selected,count-1);lab.revealed=false;redrawLocalControls();$('#control-massCount')?.focus();}
 if(event.target.dataset.control==='condition'){const lab=labState();lab.condition=event.target.value;lab.filterShown=false;drawLab();}
});
document.addEventListener('focusin',event=>{if(event.target.id==='profile-select')refreshProfileChoices();});
document.addEventListener('input',event=>{
 const form=event.target.closest('#answer-form,#review-form');
 if(form){const data=new FormData(form),key=form.id==='review-form'?S.mistakeId:S.round?.questions[S.index]?.id;if(key){const answer={value:String(data.get('value') || '')};if(data.has('step'))answer.step=String(data.get('step') || '');S.drafts[`${S.profileId}/${key}`]=answer;}}
 const key=event.target.dataset.control;if(!key||['letters','unit','layers','scene','positive','condition','split','massCount','numberIndex','productSplit','dividendIndex','divisorIndex','decimalIndex'].includes(key))return;
 const lab=labState();if(S.moduleId==='C2-04'&&key==='deviation')lab.deviations[lab.selected]=Number(event.target.value);else lab[key]=Number(event.target.value);
 if(arithmeticModule(S.moduleId))resetArithmeticResult(lab);
 if(foundationModule(S.moduleId))resetFoundationResult(lab);
 if(S.moduleId==='N-NEG-COMP'){lab.prediction=null;lab.revealed=false;}
 if(S.moduleId==='A-LIKE-COMBINE')lab.joined=false;
 drawLab();
});
let drag=null;
function resetFoundationResult(lab){
 if(S.moduleId==='C1-05')lab.checked=false;
 if(S.moduleId==='C1-06')lab.flips=0;
 if(S.moduleId==='C1-07')lab.revealed=0;
 if(S.moduleId==='C1-08')lab.copied=false;
 if(S.moduleId==='C1-09')lab.prediction=null;
 if(S.moduleId==='C1-11'){lab.selected=[];lab.candidatesChecked=false;lab.filterShown=false;lab.feedback=null;}
}
function svgPoint(event) {
 const svg=$('#lab-svg');if(!svg)return null;
 const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
 const matrix=svg.getScreenCTM();if(!matrix)return null;
 return point.matrixTransform(matrix.inverse());
}
function updateDrag(event) {
 const point=svgPoint(event);if(!point||!drag)return;
 const lab=labState();
 if(S.moduleId==='C2-07'){lab[drag.key]=clamp(Math.round(((point.x-80)/600*20-10)*2)/2,-5,5);lab.checked=false;
 }else if(S.moduleId==='C1-02'){
  const scene=quantityScenes[lab.scene];lab.actual=clamp(Math.round((scene.min+(point.x-80)/600*(scene.max-scene.min))*2)/2,scene.min,scene.max);
 }else if(S.moduleId==='C1-09'){
  lab[drag.key]=clamp(Math.round(((point.x-80)/600*10-5)*2)/2,-5,5);lab.prediction=null;
 }else if(foundationModule(S.moduleId)){
  const slot=clamp(Math.round(((point.x-80)/600*10-5)*2)/2,S.moduleId==='C1-07'?-4:-5,S.moduleId==='C1-07'?4:5);
  lab[S.moduleId==='C1-05'?'slot':'a']=slot;resetFoundationResult(lab);
 }else if(S.moduleId==='N-NEG-COMP'){
  lab[drag.key]=clamp(Math.round(((point.x-80)/58-10)*2)/2,-10,-.5);lab.revealed=false;lab.prediction=null;
 }else if(S.moduleId==='A-LIKE-COMBINE'){
  lab.dragged={key:drag.key,x:clamp(point.x,95,665),y:clamp(point.y,65,250)};drag.last=point;
 }else{
  let degrees=Math.atan2(225-point.y,point.x-360)*180/Math.PI;
  if(drag.key==='rotation')lab.rotation=clamp(Math.round(degrees),-45,45);
  else {let relative=(degrees-lab.rotation+360)%360;if(relative>270)relative=0;lab.angle=clamp(Math.round(relative/2)*2,20,160);}
 }
 drawLab();
}
document.addEventListener('pointerdown',event=>{
 const target=event.target.closest('[data-drag]');if(!target||S.route!=='learn')return;
 if(event.pointerType==='mouse'&&event.button!==0)return;
 const board=$('#lab-board');drag={key:target.dataset.drag,pointerId:event.pointerId,board,last:null};
 board.setPointerCapture?.(event.pointerId);event.preventDefault();
 if(!drag.key.startsWith('term-'))updateDrag(event);
});
document.addEventListener('pointermove',event=>{if(drag&&drag.pointerId===event.pointerId){event.preventDefault();updateDrag(event);}});
function finishDrag(event,cancelled=false){
 if(!drag||drag.pointerId!==event.pointerId)return;
 const current=drag;drag=null;
 if(S.moduleId==='A-LIKE-COMBINE'){
  const lab=labState();if(!cancelled&&current.last&&current.last.y>=155&&current.last.x>=220&&current.last.x<=540)lab.joined=true;lab.dragged=null;drawLab();
 }
 try{current.board.releasePointerCapture?.(event.pointerId);}catch{}
}
document.addEventListener('pointerup',event=>finishDrag(event));
document.addEventListener('pointercancel',event=>finishDrag(event,true));
document.addEventListener('keydown',event=>{
 const handleNode=event.target.closest('[data-drag]');if(!handleNode||S.route!=='learn')return;
 const key=handleNode.dataset.drag,lab=labState();
 if(key.startsWith('term-')&&['Enter',' '].includes(event.key)){event.preventDefault();lab.joined=true;drawLab();return;}
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)||key.startsWith('term-'))return;
 event.preventDefault();
 const foundation=foundationModule(S.moduleId);
 const scene=S.moduleId==='C1-02'?quantityScenes[lab.scene]:null;
 const increment=key==='angle'?2:key==='rotation'?1:.5,min=scene?scene.min:S.moduleId==='C2-07'?-5:foundation?(S.moduleId==='C1-07'?-4:-5):key==='angle'?20:key==='rotation'?-45:-10,max=scene?scene.max:S.moduleId==='C2-07'?5:foundation?(S.moduleId==='C1-07'?4:5):key==='angle'?160:key==='rotation'?45:-.5;
 const delta=['ArrowRight','ArrowUp'].includes(event.key)?increment:-increment;
 lab[key]=event.key==='Home'?min:event.key==='End'?max:clamp(lab[key]+delta,min,max);
 if(foundation)resetFoundationResult(lab);
 if(arithmeticModule(S.moduleId))resetArithmeticResult(lab);
 if(S.moduleId==='N-NEG-COMP'){lab.revealed=false;lab.prediction=null;}
 drawLab();
});
window.addEventListener('hashchange',()=>{
 if(!S.data||S.busy)return;
 mutation('正在更新学习记录…',async context=>{if(!await refreshRecords(context))return;await restoreHash();paint(true);},{reading:true});
});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState!=='visible'||!S.data||S.busy||drag)return;
 if(!['home','catalog','mistakes'].includes(S.route)||(S.route==='mistakes'&&S.mistakeId))return;
 mutation('正在更新学习记录…',async context=>{if(await refreshRecords(context))paint();},{reading:true});
});
boot();

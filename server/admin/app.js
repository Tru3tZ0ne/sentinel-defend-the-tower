'use strict';
const $ = id => document.getElementById(id);
const copy = {
  en: {restricted:'RESTRICTED ACCESS',signIn:'Score administration',intro:'Manage the shared game leaderboard.',username:'Username',password:'Password',login:'Sign in',shared:'SHARED LEADERBOARD',title:'Score management',logout:'Sign out',search:'Player name',searchButton:'Search',refresh:'Refresh',exportCSV:'Export CSV',exportJSON:'Export JSON',exportHint:'Exports include all matching records, across every page. CSV opens in Excel.',player:'Player',score:'Score',health:'Health',business:'Business',date:'Time (local)',action:'Action',empty:'No scores found.',previous:'Previous',next:'Next',deleteSelected:'Delete selected',clear:'Clear all scores',deleteHint:'Deletion immediately updates the game leaderboard. Deleted records are retained in a protected server audit for recovery.',footer:'Sentinel · Authorized administrators only',remove:'Delete',total:'{n} matching / {a} total scores',selected:'{n} selected',page:'Page {p} / {n}',as:'Signed in as {u}',loading:'Loading…',saved:'Deleted {n} record(s).',deleteConfirm:'Delete {n} selected record(s)? This updates the shared leaderboard immediately.',clearConfirm:'This clears ALL scores, including records outside the current search. Type DELETE ALL to confirm.',expired:'Your session expired. Please sign in again.',network:'Could not reach the server. Please retry.',choose:'Select records to delete first.',allPage:'Select this page',exported:'Export downloaded.',busy:'Working…'},
  zh: {restricted:'管理员专用',signIn:'成绩管理后台',intro:'管理游戏的服务端共享排行榜。',username:'账号',password:'密码',login:'登录',shared:'共享排行榜',title:'成绩管理',logout:'退出登录',search:'玩家名称',searchButton:'搜索',refresh:'刷新',exportCSV:'导出 CSV',exportJSON:'导出 JSON',exportHint:'导出当前搜索匹配的全部记录，包含所有分页。CSV 可用 Excel 打开。',player:'玩家',score:'总分',health:'血量',business:'业务',date:'时间（本地时区）',action:'操作',empty:'没有找到成绩。',previous:'上一页',next:'下一页',deleteSelected:'删除选中',clear:'清空全部成绩',deleteHint:'删除会立即更新游戏排行榜。服务器保留受保护的删除审计记录，便于恢复。',footer:'Sentinel · 仅限授权管理员使用',remove:'删除',total:'匹配 {n} 条 / 共 {a} 条成绩',selected:'已选 {n} 条',page:'第 {p} / {n} 页',as:'当前账号：{u}',loading:'正在加载…',saved:'已删除 {n} 条记录。',deleteConfirm:'确定删除选中的 {n} 条成绩？共享排行榜将立即更新。',clearConfirm:'将清空全部成绩，包含当前搜索以外的记录。请输入 DELETE ALL 确认。',expired:'登录已过期，请重新登录。',network:'无法连接服务器，请重试。',choose:'请先选择需要删除的成绩。',allPage:'选择当前页',exported:'导出文件已下载。',busy:'正在处理…'}
};
let lang = localStorage.getItem('sentinel.admin.lang') === 'zh' ? 'zh' : 'en';
let csrf = '', username = '', page = 1, query = '', total = 0, allTotal = 0, rows = [], selection = new Set(), busy = false;
let requestSequence = 0;
const t = (key, vars = {}) => Object.entries(vars).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',v),copy[lang][key] || key);
function message(text='', error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function translate(){document.documentElement.lang=lang==='zh'?'zh-CN':'en';document.querySelectorAll('[data-i18n]').forEach(n=>n.textContent=t(n.dataset.i18n));$('language').textContent=lang==='en'?'中文':'EN';$('search').placeholder=t('search');$('selectAll').ariaLabel=t('allPage');if(username)render();}
function signedOut(){requestSequence++;csrf='';username='';selection.clear();$('dashboard').hidden=true;$('loginPanel').hidden=false;$('password').value='';}
function signedIn(data){csrf=data.csrf;username=data.username;$('loginPanel').hidden=true;$('dashboard').hidden=false;$('password').value='';}
async function api(path,body){
  const options={credentials:'same-origin',cache:'no-store',headers:{}};
  if(body!==undefined){options.method='POST';options.headers={'Content-Type':'application/json','X-CSRF-Token':csrf};options.body=JSON.stringify(body);}
  let r;try{r=await fetch('/api/admin/'+path,options);}catch{throw new Error(t('network'));}
  if(r.status===401&&path!=='login'){signedOut();throw new Error(t('expired'));}
  if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||('HTTP '+r.status));}
  return r;
}
function controls(){const loading=busy;$('deleteSelected').disabled=loading||selection.size===0;$('clear').disabled=loading||allTotal===0;$('previous').disabled=loading||page<=1;$('next').disabled=loading||page*50>=total;for(const id of ['refresh','exportCSV','exportJSON'])$(id).disabled=loading;}
function render(){
  $('identity').textContent=t('as',{u:username});$('count').textContent=t('total',{n:total,a:allTotal});$('selected').textContent=t('selected',{n:selection.size});$('page').textContent=t('page',{p:page,n:Math.max(1,Math.ceil(total/50))});$('empty').hidden=rows.length>0;
  const frag=document.createDocumentFragment();
  for(const row of rows){
    const tr=document.createElement('tr');const cell=(text,cls)=>{const n=document.createElement('td');n.textContent=text;if(cls)n.className=cls;tr.append(n);return n;};
    const check=document.createElement('input');check.type='checkbox';check.checked=selection.has(row.id);check.ariaLabel=row.name;check.disabled=busy;check.addEventListener('change',()=>{if(check.checked)selection.add(row.id);else selection.delete(row.id);render();});cell('').append(check);
    cell(row.name,'player').title=row.id;cell(row.score,'score');for(const k of ['health','business','ai','agent'])cell(row.details?.scores?.[k]??'—');cell(new Date(row.at).toLocaleString(lang==='zh'?'zh-CN':'en-GB',{hour12:false}));
    const del=document.createElement('button');del.className='rowDelete';del.textContent=t('remove');del.disabled=busy;del.addEventListener('click',()=>remove([row.id]));cell('').append(del);frag.append(tr);
  }
  $('rows').replaceChildren(frag);$('selectAll').checked=rows.length>0&&rows.every(r=>selection.has(r.id));$('selectAll').indeterminate=rows.some(r=>selection.has(r.id))&&!$('selectAll').checked;$('selectAll').disabled=busy||rows.length===0;controls();
}
async function load(){
  const seq=++requestSequence;busy=true;controls();
  try{const r=await api('scores?'+new URLSearchParams({q:query,page}));const d=await r.json();if(seq!==requestSequence)return;rows=d.scores;total=d.total;allTotal=d.allTotal;selection.clear();if(page>1&&rows.length===0){page=Math.max(1,Math.ceil(total/50));return await load();}}
  catch(e){if(seq===requestSequence)message(e.message,true);}finally{if(seq===requestSequence){busy=false;if(username)render();}}
}
async function remove(ids,all=false){
  if(busy)return;if(!all&&!ids.length)return message(t('choose'),true);
  if(all){if(prompt(t('clearConfirm'))!=='DELETE ALL')return;}else if(!confirm(t('deleteConfirm',{n:ids.length})))return;
  busy=true;render();message(t('busy'));
  try{const r=await api('delete',all?{all:true,confirmation:'DELETE ALL'}:{ids});const d=await r.json();await load();message(t('saved',{n:d.deleted}));}
  catch(e){message(e.message,true);}finally{busy=false;if(username)render();}
}
async function download(format){if(busy)return;busy=true;controls();try{const r=await api('export?'+new URLSearchParams({format,q:query}));const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||'sentinel-scores.'+format;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);message(t('exported'));}catch(e){message(e.message,true);}finally{busy=false;controls();}}
$('language').onclick=()=>{lang=lang==='en'?'zh':'en';localStorage.setItem('sentinel.admin.lang',lang);translate();};
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginButton').disabled=true;message(t('loading'));try{const r=await api('login',{username:$('username').value.trim(),password:$('password').value});signedIn(await r.json());page=1;query='';$('search').value='';message();await load();}catch(e){message(e.message,true);}finally{$('loginButton').disabled=false;}};
$('logout').onclick=async()=>{try{await api('logout',{});signedOut();message();}catch(e){message(e.message,true);}};
$('searchForm').onsubmit=e=>{e.preventDefault();if(busy)return;query=$('search').value.trim();page=1;load();};
$('refresh').onclick=()=>load();$('previous').onclick=()=>{page--;load();};$('next').onclick=()=>{page++;load();};
$('selectAll').onchange=()=>{for(const r of rows){if($('selectAll').checked)selection.add(r.id);else selection.delete(r.id);}render();};
$('deleteSelected').onclick=()=>remove([...selection]);$('clear').onclick=()=>remove([],true);$('exportCSV').onclick=()=>download('csv');$('exportJSON').onclick=()=>download('json');
translate();message(t('loading'));api('session').then(r=>r.json()).then(d=>{signedIn(d);message();return load();}).catch(e=>{signedOut();message(e.message===t('expired')?'':e.message,e.message!==t('expired'));});

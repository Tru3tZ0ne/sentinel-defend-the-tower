// Run against a disposable database, or remove ONLY the emitted verification IDs
// through an administrator after the deployment persistence checks have finished.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url=process.env.STAND_TEST_URL;
if (!url) throw new Error('Set STAND_TEST_URL to the deployed HTTPS origin');
const browser=await chromium.launch({headless:true,args:['--ignore-gpu-blocklist']});
const submitted=[],errors=[];
const name='Verify'+randomUUID().slice(0,8);
let passed=false;
await mkdir('tools/shots/intranet',{recursive:true});
try {
  const first=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await first.addInitScript(() => {
    localStorage.setItem('sentinel.lang','en');
    localStorage.setItem('sentinel.stand.enterprise.scores.v1',JSON.stringify([{id:'fake-local',name:'LocalFake',score:999999}]));
  });
  const page=await first.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>{if(req.url().endsWith('/api/stand/submit'))submitted.push(req.postDataJSON());});
  await page.goto(url+'/stand.html');
  await page.locator('[data-act="play"]').waitFor();
  assert.equal(await page.locator('.ar-lb .mode').innerText(),'SERVER');
  assert.doesNotMatch(await page.locator('.ar-lb').innerText(),/LocalFake/);
  await page.locator('#nameIn').fill(name);
  await page.locator('[data-act="play"]').click();
  // Endpoint fixture exercises the actual engine callback, not a direct API-only submission.
  const finish=()=>page.evaluate(()=>{
    const g=window.__stand.game;g.start();g.chooseUpgrade('EDR');
    const s=g.state;s.elapsed=119.95;s.bossCount=3;s.bossesKilled=3;
    s.base=8234;s.businessWork=7200;s.aiWork=2100;s.agentWork=1080;
    s.spawnAcc=-1e6;s.enemies=[];s.pendingLevels=0;s.choices=[];
  });
  await finish();
  await page.getByRole('status').filter({hasText:'Saved to server'}).waitFor();
  assert.equal(await page.locator('.lb-row.me').count(),1);
  await page.screenshot({path:'tools/shots/intranet/server-result-en-FIXTURE.png',fullPage:true});
  const id=submitted.at(-1).id;
  const fresh=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
  const other=await fresh.newPage();
  other.on('pageerror',e=>errors.push(e.message));
  await other.goto(url+'/stand.html');
  await other.locator('.lb-name').filter({hasText:name}).waitFor();
  assert.equal(await other.evaluate(()=>localStorage.getItem('sentinel.stand.enterprise.scores.v1')),null);
  await other.locator('[data-act="lang"]').click();
  await other.getByText('服务器',{exact:true}).waitFor();
  assert.equal(await other.locator('.ar-lb .mode').innerText(),'服务器');
  assert.ok(await other.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await other.screenshot({path:'tools/shots/intranet/server-menu-mobile-zh.png',fullPage:true});
  await other.route('**/api/stand/top?*',route=>route.abort());
  await other.reload();
  await other.getByText('服务器暂不可用',{exact:true}).waitFor();
  await other.close();await fresh.close();
  await page.route('**/api/stand/submit',route=>route.abort());
  await page.locator('[data-act="again"]').click();await finish();
  await page.locator('[data-act="retrySave"]').waitFor();
  assert.match(await page.getByRole('status').innerText(),/not saved/);
  assert.equal(await page.locator('.hot').count(),0);
  const retryId=submitted.at(-1).id;
  await page.unroute('**/api/stand/submit');
  await page.locator('[data-act="retrySave"]').click();
  await page.getByRole('status').filter({hasText:'Saved to server'}).waitFor();
  assert.equal(submitted.at(-1).id,retryId);
  const duplicate=await page.evaluate(async payload=>(await fetch('/api/stand/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})).json(),submitted.at(-1));
  assert.equal(duplicate.saved,true);
  const ranking=await page.evaluate(async()=>(await fetch('/api/stand/top')).json());
  assert.equal(ranking.scores.filter(r=>r.id===retryId).length,1);
  assert.deepEqual(errors,[]);
  const evidence={name,ids:[id,retryId],submissions:submitted.length,sharedAcrossContexts:true,explicitFailure:true,idempotentRetry:true};
  await writeFile('tools/shots/intranet/verification.json',JSON.stringify(evidence,null,2));
  passed=true;
  console.log(JSON.stringify(evidence));
} finally {
  if (!passed) await writeFile('tools/shots/intranet/verification.json',JSON.stringify({name,passed:false,ids:[...new Set(submitted.map(row=>row.id))]},null,2));
  await browser.close();
}

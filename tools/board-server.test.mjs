import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBoard } from '../src/arcade/board.js';

test('server authority, explicit failure, and stable retry; legacy local mode remains available', async () => {
  const old = {window:global.window,localStorage:global.localStorage,fetch:global.fetch};
  const stored = new Map([['scores',JSON.stringify([{id:'fake-local',name:'Fake',score:999999}])]]);
  global.window = {API:'/api/stand'};
  global.localStorage = { getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v) };
  let fail=false, sent=[];
  global.fetch = async (url,options) => {
    if (fail) throw new Error('network disconnected');
    if (options.method === 'POST') { sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({saved:true,rank:72,scores:[]})}; }
    return {ok:true,json:async()=>({scores:[{id:'real',name:'Real',score:7000}]})};
  };
  try {
    const board=makeBoard({lsKey:'scores',apiVar:'API',requireRemote:true});
    assert.deepEqual((await board.fetchBoard()).rows.map(r=>r.id),['real']);
    const score={id:'stable-attempt-001',name:'Pilot',score:6000,details:{outcome:'victory'}};
    let result=await board.submitScore(score);
    assert.equal(result.rank,72);assert.equal(result.saved,true);
    fail=true;
    result=await board.submitScore(score);
    assert.equal(result.saved,false);assert.equal(result.rank,null);assert.deepEqual(result.rows,[]);
    assert.equal((await board.fetchBoard()).mode,'offline');
    fail=false;await board.submitScore(score);
    assert.equal(sent[0].id,sent[1].id);
    assert.equal(JSON.parse(stored.get('scores'))[0].id,'fake-local');
    const local=makeBoard({lsKey:'scores',apiVar:'UNCONFIGURED'});
    assert.equal((await local.fetchBoard()).mode,'local');
    assert.equal((await local.fetchBoard()).rows[0].id,'fake-local');
  } finally {Object.assign(global,old);}
});

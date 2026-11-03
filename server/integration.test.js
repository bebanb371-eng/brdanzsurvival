import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';

describe('backend accounts and multiplayer room',()=>{
 let child,base,tempDir,clients=[];
 beforeAll(async()=>{
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  tempDir=await mkdtemp(path.join(os.tmpdir(),'brdanz-test-'));base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),NODE_ENV:'test',BRDANZ_DB_PATH:path.join(tempDir,'accounts.json'),SESSION_SECRET:randomBytes(32).toString('hex')},stdio:'ignore'});
  const until=Date.now()+10000;while(Date.now()<until){try{if((await fetch(`${base}/api/health`)).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error('backend failed to start');
 },15000);
 afterAll(async()=>{for(const ws of clients)if(ws.readyState<WebSocket.CLOSING)ws.close();child?.kill();if(child)await once(child,'exit').catch(()=>{});if(tempDir)await rm(tempDir,{recursive:true,force:true})});
 const message=(ws,predicate,timeout=5000)=>new Promise((resolve,reject)=>{const seen=[];const timer=setTimeout(()=>{ws.off('message',onMessage);reject(new Error(`websocket message timeout; seen=${seen.join(',')}`))},timeout);function onMessage(raw){const data=JSON.parse(raw.toString());seen.push(data.type);if(predicate(data)){clearTimeout(timer);ws.off('message',onMessage);resolve(data)}}ws.on('message',onMessage)});
 const account=async()=>{const username=`qa${randomBytes(5).toString('hex')}`,res=await fetch(`${base}/api/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'SurvivalTest!2026'})});expect(res.status).toBe(201);const cookie=res.headers.get('set-cookie').split(';')[0];expect((await fetch(`${base}/api/me`,{headers:{cookie}})).status).toBe(200);return{username,cookie}};
 const socket=async(cookie)=>{const ws=new WebSocket(`ws://127.0.0.1:${new URL(base).port}/ws`,{headers:{Cookie:cookie}});clients.push(ws);const welcome=message(ws,m=>m.type==='welcome');await once(ws,'open');await welcome;return ws};
 it('registers, preserves a session, joins a shared room, and relays state/chat',async()=>{
  const a=await account(),b=await account(),one=await socket(a.cookie),two=await socket(b.cookie);
  const made=message(one,m=>m.type==='room_joined');one.send(JSON.stringify({type:'create_room',max:4}));const room=await made;expect(room.room.code).toHaveLength(6);
  const joined=message(two,m=>m.type==='room_joined');two.send(JSON.stringify({type:'join_room',code:room.room.code}));expect((await joined).room.players).toHaveLength(2);
  const state=message(two,m=>m.type==='state'&&m.state.username===a.username);one.send(JSON.stringify({type:'state',position:{x:2,z:3},yaw:1,moving:true}));expect((await state).state).toMatchObject({x:2,z:3,moving:true});
  const chat=message(two,m=>m.type==='chat');one.send(JSON.stringify({type:'chat',text:'Tes room'}));expect((await chat).text).toBe('Tes room');
 },20000);
 it('matchmakes logged-in players into a public island and relays combat',async()=>{
  const a=await account(),b=await account(),one=await socket(a.cookie),two=await socket(b.cookie);
  const oneRoom=message(one,m=>m.type==='room_joined'&&m.room.public),twoRoom=message(two,m=>m.type==='room_joined'&&m.room.public);
  one.send(JSON.stringify({type:'join_global'}));two.send(JSON.stringify({type:'join_global'}));
  const roomA=await oneRoom,roomB=await twoRoom;expect(roomA.room.code).toBe(roomB.room.code);expect(roomB.room.max).toBe(8);
  const synced=message(one,m=>m.type==='state'&&m.state.username===b.username);two.send(JSON.stringify({type:'state',position:{x:8,z:0},yaw:0,moving:false}));await synced;
  const attacked=message(two,m=>m.type==='player_attacked');one.send(JSON.stringify({type:'state',position:{x:0,z:0},yaw:0,moving:false}));one.send(JSON.stringify({type:'attack_player',target:b.username,weapon:'rifle'}));
  expect(await attacked).toMatchObject({username:a.username,damage:29,hp:71});
 },20000);
});

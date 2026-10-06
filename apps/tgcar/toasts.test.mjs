import test from 'node:test';
import assert from 'node:assert/strict';
import {addToast} from './toasts.mjs';
test('duplicate toast replaces existing notice and queue stays bounded',()=>{
 let items=[];
 for(let i=0;i<5;i++) items=addToast(items,{id:String(i),title:'Notice '+i});
 assert.equal(items.length,3);
 items=addToast(items,{id:'4',title:'Updated',kind:'success'});
 assert.equal(items.length,3);
 assert.equal(items.at(-1).title,'Updated');
});
test('errors persist, success and info have readable timeouts',()=>{
 assert.equal(addToast([],{id:'a',kind:'error',title:'Error'})[0].duration,null);
 assert.equal(addToast([],{id:'b',kind:'success',title:'Saved'})[0].duration,6000);
 assert.equal(addToast([],{id:'c',title:'Info'})[0].duration,8000);
});

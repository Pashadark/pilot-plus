import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('theme initializes before paint and tolerates blocked storage',()=>{
 const source=read('./public/theme-init.js');
 for(const [stored,system,expected,blocked] of [['dark',false,'dark'],['light',true,'light'],[null,true,'dark'],['invalid',false,'light'],[null,false,'light',true]]){
  const document={documentElement:{dataset:{}}};
  vm.runInNewContext(source,{document,localStorage:{getItem(){if(blocked)throw Error();return stored;}},matchMedia:()=>({matches:system})});
  assert.equal(document.documentElement.dataset.theme,expected);
 }
});
test('dialogs use native modal focus management and cancel handling',()=>{
 const source=read('./app/dialog.jsx');
 assert.match(source,/showModal\(\)/);assert.match(source,/onCancel=/);assert.match(source,/<dialog/);assert.match(source,/previousFocus/);
});
test('cookie banner remains necessary-only with site policy links',()=>{
 const source=read('./app/storage-notice.jsx');
 assert.match(source,/consentRecord\(\)/);assert.match(source,/href="\/cookies"/);assert.match(source,/href="\/privacy"/);assert.match(source,/>Ок<\/button>/);
 assert.doesNotMatch(source,/Продолжая пользование/);
});

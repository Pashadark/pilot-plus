import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('public storage notice does not falsely describe active leads as unsent',()=>{
 const text=readFileSync(new URL('./app/storage-notice.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(text,/В текущем предпросмотре они не отправляются/);
});

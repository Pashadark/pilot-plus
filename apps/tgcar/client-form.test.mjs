import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('phone is visibly required and uses mobile telephone keyboard',()=>{
 const source=readFileSync(new URL('./app/client-form.jsx',import.meta.url),'utf8');
 assert.match(source,/Телефон \*/);
 const phone=source.match(/<input\s+name="phone"[\s\S]*?\/>/)?.[0]||'';
 assert.match(phone,/\brequired\b/);assert.match(phone,/inputMode="tel"/);
});

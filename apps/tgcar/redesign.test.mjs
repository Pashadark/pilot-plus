import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
test('approved redesign keeps live categories and renames journal to Blog',()=>{
const source=readFileSync(new URL('./app/site.jsx',import.meta.url),'utf8');
assert.ok(source.includes('<h2>Блог</h2>'));assert.ok(source.includes('groups.map'));
assert.ok(source.includes('hero-redesign.png'));assert.ok(source.includes('useFleet('));
assert.ok(existsSync(new URL('./public/images/hero-redesign.png',import.meta.url)));
assert.ok(readFileSync(new URL('./app/layout.jsx',import.meta.url),'utf8').includes("import './redesign.css'"));
});

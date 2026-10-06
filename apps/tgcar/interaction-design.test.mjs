import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('catalog status uses the same centered badge as details without legacy height',()=>{
 const source=read('./app/site.jsx');
 assert.doesNotMatch(source,/<p className=\{car.available/);
 assert.match(source,/availability-badge photo-availability/);
 assert.ok(source.indexOf('availability-badge photo-availability') < source.indexOf('className="car-body"'));
 assert.doesNotMatch(read('./app/readability.css'),/\.availability\s*\{[^}]*min-height:42px/);
 assert.match(read('./app/reference-theme.css'),/\.availability-badge\s*\{[^}]*align-items:center/);
});
test('availability switch remains a keyboard-accessible controlled input',()=>{
 const source=read('./app/site.jsx');
 assert.match(source,/role="switch"/);
 assert.match(source,/checked=\{onlyFree\}/);
 assert.match(source,/className="switch-track" aria-hidden="true"/);
});
test('mobile navigation exposes expansion and supports Escape',()=>{
 const source=read('./app/site-header.jsx');
 assert.match(source,/aria-expanded=\{menuOpen\}/);
 assert.match(source,/aria-controls="site-navigation"/);
 assert.match(source,/Escape/);
 assert.match(read('./app/reference-theme.css'),/prefers-reduced-motion:reduce/);
});

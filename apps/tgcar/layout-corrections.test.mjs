import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./app/site.jsx',import.meta.url),'utf8');
test('catalog copy and supporting information follow the requested order',()=>{
 assert.ok(!source.includes('Реальный автопарк'));
 assert.ok(source.indexOf('className="fleet-sync"')>source.indexOf('className="filter"'));
 assert.ok(source.indexOf('className="office-tag"')>source.indexOf('<h3>{car.name}</h3>'));
});
test('breadcrumb children override global nav link padding',()=>{
 const css=readFileSync(new URL('./app/blog/blog.css',import.meta.url),'utf8');
 assert.match(css,/\.blog-breadcrumbs>\*\{[^}]*padding:0/);
 assert.match(css,/\.blog-breadcrumbs\{[^}]*align-items:center/);
});

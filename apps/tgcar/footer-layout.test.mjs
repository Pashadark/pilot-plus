import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('contacts and map precede footer; information actions share link styling',()=>{
 const source=readFileSync(new URL('./app/site.jsx',import.meta.url),'utf8');
 assert.ok(source.indexOf('id="contacts"')<source.indexOf('<footer>'));
 assert.ok(source.indexOf('map-widget/v1/')<source.indexOf('<footer>'));
 assert.match(source,/className="footer-information"/);
 const css=readFileSync(new URL('./app/footer-polish.css',import.meta.url),'utf8');
 assert.ok(css.includes('.footer-information :is(a,button.text-button)'));
});

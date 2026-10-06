import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('hero uses city image and brand selector keeps readable labels',()=>{
 const source=readFileSync(new URL('./app/site.jsx',import.meta.url),'utf8');
 assert.match(source,/src="\/images\/hero-redesign.png"/);
 assert.match(source,/<BrandMark brand=\{c\}/);
 assert.match(source,/<span>\{c\}<\/span>/);
});
test('car details show badges without internal system copy',()=>{
 const source=readFileSync(new URL('./app/site.jsx',import.meta.url),'utf8');
 for(const copy of ['Фотография из СУПА ПРО','Характеристики и тариф взяты','Заявка бесплатна','Предварительный расчёт по суточному тарифу','Выберите даты: возврат']) assert.ok(!source.includes(copy));
 assert.match(source,/availability-badge/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {filterCars} from './catalog-filter.mjs';
const cars=[{group:'Toyota',name:'Camry',fuel:'Бензин',drive:'Передний',available:true},{group:'Kia',name:'K5',fuel:'Бензин',available:false},{group:'BMW',name:'520d',fuel:'Дизель',drive:'4WD',available:true}];
test('filters combine without treating unknown drive as front wheel drive',()=>{
 assert.equal(filterCars(cars,{fuel:'Бензин',drive:'Передний'}).length,1);
 assert.equal(filterCars(cars,{make:'Toyota',model:'K5'}).length,0);
 assert.equal(filterCars(cars,{onlyFree:true}).length,2);
 assert.equal(filterCars(cars,{}).length,3);
});

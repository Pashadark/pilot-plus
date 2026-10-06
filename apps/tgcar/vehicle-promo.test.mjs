import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {promoPhotos,illustrativePhotos,vehiclePhotoSources} from './vehicle-promo.mjs';
test('each edited first photo maps to one exact vehicle and exists',()=>{
 assert.equal(Object.keys(promoPhotos).length,13);
 for(const [id,path] of Object.entries(promoPhotos)) {
  assert.ok(path.includes(id));
  assert.ok(existsSync(new URL('./public'+path,import.meta.url)));
  assert.deepEqual(vehiclePhotoSources({id,image:'/original'}),[path,'/original']);
 }
});
test('unknown cars keep real photo, missing photos are never substituted',()=>{
 assert.deepEqual(vehiclePhotoSources({id:'unknown',image:'/real'}),['/real']);
 assert.deepEqual(vehiclePhotoSources({id:'unknown',image:null}),[]);
});
test('approved model illustrations fill four missing images but never replace new real photos',()=>{
 assert.equal(Object.keys(illustrativePhotos).length,4);
 for(const [id,path] of Object.entries(illustrativePhotos)){
  assert.ok(existsSync(new URL('./public'+path,import.meta.url)));
  assert.deepEqual(vehiclePhotoSources({id,image:null}),[path]);
  assert.deepEqual(vehiclePhotoSources({id,image:'/new-real'}),['/new-real']);
 }
});

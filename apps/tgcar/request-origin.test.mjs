import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedOrigin} from './server/request-origin.mjs';
test('production accepts only the configured HTTPS origin behind a loopback proxy',()=>{
 const request=origin=>new Request('http://127.0.0.1:3105/api/leads',{headers:{origin}});
 const env={NODE_ENV:'production',TGCAR_PUBLIC_ORIGIN:'https://tgcar.ru'};
 assert.equal(allowedOrigin(request('https://tgcar.ru'),env),true);
 assert.equal(allowedOrigin(request('https://evil.example'),env),false);
 assert.equal(allowedOrigin(request('null'),env),false);
 assert.equal(allowedOrigin(request('http://127.0.0.1:3105'),{NODE_ENV:'production'}),false);
});
test('development permits same-origin local forms',()=>{
 assert.equal(allowedOrigin(new Request('http://localhost:3105/api/leads',{headers:{origin:'http://localhost:3105'}}),{}),true);
});

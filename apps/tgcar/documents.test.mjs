import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument,encryptDocument,decryptDocument,scanDocument} from './server/documents.mjs';
import {randomBytes} from 'node:crypto';
test('document magic and limits, never trust extension',()=>{
 assert.equal(validateDocument(Buffer.from('%PDF-1.7\nfixture')).mime,'application/pdf');
 assert.throws(()=>validateDocument(Buffer.from('<html>bad</html>')),/JPG/);
 assert.throws(()=>validateDocument(Buffer.alloc(5*1024*1024+1)),/5 МБ/);
});
test('encrypted documents are authenticated and plaintext not stored',()=>{
 const key=randomBytes(32),bytes=Buffer.from('%PDF-1.7\nsensitive fixture');
 const cipher=encryptDocument(bytes,key);assert.equal(cipher.includes(Buffer.from('sensitive')),false);assert.deepEqual(decryptDocument(cipher,key),bytes);
 cipher[20]^=1;assert.throws(()=>decryptDocument(cipher,key));
});
test('scanner without configuration fails closed into quarantine',async()=>{
 assert.equal(await scanDocument(Buffer.from('fixture'),{}),'QUARANTINED');
});

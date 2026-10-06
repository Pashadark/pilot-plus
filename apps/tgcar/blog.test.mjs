import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
test('blog has complete unique original articles and real cover assets', async()=>{
 const {posts,getPost,filterPosts}=await import('./app/blog/posts.mjs');
 assert.equal(posts.length,3);
 assert.equal(new Set(posts.map(p=>p.slug)).size,posts.length);
 for(const post of posts){assert.match(post.slug,/^[a-z0-9-]+$/);assert.ok(post.sections.length>=4);assert.ok(post.sections.every(s=>s.title&&s.text.length>100));assert.ok(existsSync(new URL('./public'+post.image,import.meta.url)));assert.equal(getPost(post.slug),post);assert.match(post.date,/^\d{4}-\d{2}-\d{2}$/);}
 assert.equal(getPost('missing'),undefined);
 assert.deepEqual(filterPosts('Все статьи'),posts);
 assert.equal(filterPosts('unknown').length,0);
 assert.ok(filterPosts(posts[0].category).every(p=>p.category===posts[0].category));
});

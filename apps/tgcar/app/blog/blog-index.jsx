'use client';
import {useState} from 'react';
import {posts,filterPosts} from './posts.mjs';
import PostCard from './post-card';
export default function BlogIndex(){const [category,setCategory]=useState('Все статьи');return <><div className="blog-filters" aria-label="Категории публикаций">{['Все статьи',...new Set(posts.map(p=>p.category))].map(c=><button key={c} type="button" aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="blog-grid">{filterPosts(category).map(p=><PostCard key={p.slug} post={p}/>)}</div></>}

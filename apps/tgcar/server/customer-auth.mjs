import {createCustomerStore} from './customer-store.mjs';
let store;
export const cookieName='tgcar-customer-session';
export function customers(){if(!process.env.TGCAR_CUSTOMER_DB||!process.env.TGCAR_CUSTOMER_KEY)throw new Error('Вход временно недоступен');return store ||=createCustomerStore(process.env.TGCAR_CUSTOMER_DB,process.env.TGCAR_CUSTOMER_KEY);}
export function customerToken(request){return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
export function sessionCookie(token){return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?604800:0}${process.env.NODE_ENV==='production'?'; Secure':''}`;}

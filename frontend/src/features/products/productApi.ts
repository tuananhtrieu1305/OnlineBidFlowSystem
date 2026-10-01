import client, { serverConfig } from '../../api/axiosClient';
import { csrfHeaders } from '../auth/api/sessionApi';
export type Product = { id: string; name: string; description: string|null; quantity: number; estimatedPrice: string|null; imageUrl: string|null; editable: boolean; editBlockedReason: string|null; version: string };
export type ProductPage = { items: Product[]; page: number; size: number; totalElements: string; totalPages: number };
export async function listProducts(q: string, page: number, signal?: AbortSignal) { return (await client.get<ProductPage>('/api/admin/products', { params: { q, page, size: 20 }, signal })).data; }
export async function getProduct(id: string) { return (await client.get<Product>('/api/admin/products/'+id)).data; }
export async function saveProduct(id: string|undefined, data: object, image: File|null, version?: string) {
 const form = new FormData();
 form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
 if(image) form.append('image', image);
 return (await client.request<Product>({ url: '/api/admin/products'+(id?'/'+id:''), method: id?'PUT':'POST', data: form,
  headers: { ...await csrfHeaders(), 'Content-Type': undefined, ...(version?{'If-Match':version}:{}) }, timeout: 20000 })).data;
}
export function imageSource(value: string|null) {
 if(!value) return undefined;
 try { const url=new URL(value, serverConfig.apiUrl);return url.origin===new URL(serverConfig.apiUrl).origin&&url.pathname.startsWith('/api/product-images/')?url.href:undefined; } catch { return undefined; }
}

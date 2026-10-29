import {describe,expect,it} from 'vitest';
import {imageSource} from '../src/features/products/productApi';

describe('product image source',()=>{
 it('accepts the uploaded-image endpoint and seeded Unsplash photos',()=>{
  expect(imageSource('/api/product-images/example.jpg')).toBe('http://localhost:8080/api/product-images/example.jpg');
  const seed='https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80';
  expect(imageSource(seed)).toBe(seed);
 });
 it.each([null,'https://other.example/photo-1','http://images.unsplash.com/photo-1','https://images.unsplash.com.evil.example/photo-1','https://images.unsplash.com/other','https://user:pass@images.unsplash.com/photo-1'])('rejects untrusted image source %s',(value)=>{
  expect(imageSource(value)).toBeUndefined();
 });
});

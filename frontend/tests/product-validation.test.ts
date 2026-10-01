import { describe, it, expect } from 'vitest';
import { validateProduct } from '../src/features/products/validation';
describe('product fields',()=>{
 it('accepts unicode and exact BIGINT without coercion',()=>expect(validateProduct({name:' Máy ảnh 📷 ',description:'',quantity:'1',estimatedPrice:'9223372036854775807'})).toEqual({}));
 it('validates every boundary',()=>{
  expect(Object.keys(validateProduct({name:'',description:'a'.repeat(5001),quantity:'0',estimatedPrice:'9223372036854775808'}))).toHaveLength(4);
  expect(validateProduct({name:'a'.repeat(256),description:'',quantity:'1.5',estimatedPrice:'01'})).toHaveProperty('name');
  expect(validateProduct({name:'Máy',description:'',quantity:'2147483648',estimatedPrice:''})).toHaveProperty('quantity');
  expect(validateProduct({name:'Máy',description:'',quantity:'2147483647',estimatedPrice:''})).toEqual({});
 });
});

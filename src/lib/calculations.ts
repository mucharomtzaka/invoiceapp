import type { Item } from './types';
export const rupiah = (n: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Math.round(n||0));
export const formatNumber = (n:number) => new Intl.NumberFormat('id-ID').format(Math.round(n||0));
export function calculate(items: Pick<Item,'quantity'|'unitPrice'>[], discountType:string, discountValue:number, taxType:string, taxValue:number) {
 const itemTotals=items.map(i=>Math.round(Math.max(0,Number(i.quantity)||0)*Math.max(0,Number(i.unitPrice)||0)));
 const subtotal = itemTotals.reduce((s,n)=>s+n,0);
 const discountAmount = Math.min(subtotal,Math.max(0,Math.round(discountType==='percent'?subtotal*Math.max(0,discountValue)/100:discountType==='amount'?discountValue:0)));
 const dpp = Math.max(0,subtotal-discountAmount);
 const taxAmount = Math.max(0,Math.round(taxType==='percent'?dpp*Math.max(0,taxValue)/100:taxType==='amount'?taxValue:0));
 return {subtotal,discountAmount,dpp,taxAmount,total:Math.max(0,dpp+taxAmount),itemTotals};
}
export function terbilang(value:number) {
 const words=['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
 const spell=(n:number):string=>{if(n<12)return words[n];if(n<20)return spell(n-10)+' belas';if(n<100)return spell(Math.floor(n/10))+' puluh '+spell(n%10);if(n<200)return 'seratus '+spell(n-100);if(n<1000)return spell(Math.floor(n/100))+' ratus '+spell(n%100);if(n<2000)return 'seribu '+spell(n-1000);if(n<1e6)return spell(Math.floor(n/1000))+' ribu '+spell(n%1000);if(n<1e9)return spell(Math.floor(n/1e6))+' juta '+spell(n%1e6);return spell(Math.floor(n/1e9))+' miliar '+spell(n%1e9)};
 return (value===0?'nol':spell(Math.floor(Math.abs(value)))).replace(/\s+/g,' ').trim()+' rupiah';
}
export function newNumber(prefix='KW') {const d=new Date();return `${prefix}-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`}

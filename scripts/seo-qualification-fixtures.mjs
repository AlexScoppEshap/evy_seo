// Synthetic XML and raster data for local tests only. No MapTiler credentials,
// geographic dataset, WordPress content or external provider calls.
import { deflateSync } from 'node:zlib'
export const fixtureWordPressIndex = '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://myevy.app/page-sitemap.xml</loc><lastmod>2026-11-04T00:00:00Z</lastmod></sitemap></sitemapindex>'
export const fixtureWordPressLeaf = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://myevy.app/about/</loc></url></urlset>'
export const fixtureGeocoding = {features:[{place_type:['address'],properties:{country_code:'ch'},geometry:{type:'Point',coordinates:[6.147,46.201]}}]}
function chunk(type,bytes){
  const name=Buffer.from(type),input=Buffer.concat([name,bytes]);let crc=0xffffffff
  for(const byte of input){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  const header=Buffer.alloc(4),trailer=Buffer.alloc(4);header.writeUInt32BE(bytes.length);trailer.writeUInt32BE((crc^0xffffffff)>>>0)
  return Buffer.concat([header,input,trailer])
}
const header=Buffer.alloc(13);header.writeUInt32BE(256);header.writeUInt32BE(256,4);header[8]=8;header[9]=2
const pixels=Buffer.alloc(256*(1+256*3))
for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const offset=y*(1+256*3)+1+x*3,road=Math.abs(x-64)<6||Math.abs(x-192)<6||Math.abs(y-128)<7
  pixels[offset]=road?255:236;pixels[offset+1]=road?255:238;pixels[offset+2]=road?255:240
}
export const fixtureMapPng=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))])

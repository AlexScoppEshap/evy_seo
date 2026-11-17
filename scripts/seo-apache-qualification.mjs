// Real, unprivileged loopback Apache; WordPress/Yoast files are fixtures.
// Tests do not edit /etc/apache2, production .htaccess or hosting settings.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createServer as createSecureServer } from 'node:https'
import { once } from 'node:events'
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises'
import { tmpdir, userInfo } from 'node:os'
import { join } from 'node:path'
import { fixtureWordPressIndex, fixtureWordPressLeaf } from './seo-qualification-fixtures.mjs'

export async function runApacheChecks({appOrigin,check}){
  assert.equal(new URL(appOrigin).hostname,'127.0.0.1')
  const binary=process.env.HTTPD_BINARY??'/usr/sbin/httpd'
  const version=spawnSync(binary,['-v'],{encoding:'utf8'})
  if(version.status!==0)throw Error('Apache unavailable: explicit qualification required; no silent skip')
  const root=await mkdtemp(join(tmpdir(),'evy-seo-apache-')),docroot=join(root,'www')
  await mkdir(docroot)
  const certConfig=join(root,'certificate.conf'),certPath=join(root,'certificate.pem'),keyPath=join(root,'key.pem')
  await writeFile(certConfig,'[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=127.0.0.1\n[ext]\nsubjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\n')
  const certificate=spawnSync('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-config',certConfig,'-keyout',keyPath,'-out',certPath],{encoding:'utf8'})
  assert.equal(certificate.status,0,'Temporary local TLS certificate generation failed')
  const tlsUpstream=createSecureServer({key:await readFile(keyPath),cert:await readFile(certPath)},async(request,response)=>{
    try{
      const upstream=await fetch(appOrigin+request.url,{method:request.method,redirect:'manual',headers:request.headers})
      for(const [name,value]of upstream.headers)if(!['connection','transfer-encoding','content-length','content-encoding'].includes(name))response.setHeader(name,value)
      response.statusCode=upstream.status;response.end(request.method==='HEAD'?undefined:Buffer.from(await upstream.arrayBuffer()))
    }catch{response.writeHead(502);response.end('Local TLS bridge unavailable')}
  })
  tlsUpstream.listen(0,'127.0.0.1');await once(tlsUpstream,'listening')
  const tlsOrigin=`https://127.0.0.1:${tlsUpstream.address().port}`
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening')
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const modules=['mpm_prefork','unixd','authz_core','rewrite','proxy','proxy_http','ssl']
  const config=`ServerRoot "${root}"
PidFile "${root}/httpd.pid"
DefaultRuntimeDir "${root}"
Mutex file:${root} default
Listen 127.0.0.1:${port}
ServerName 127.0.0.1
KeepAlive Off
${modules.map(name=>`LoadModule ${name}_module /usr/libexec/apache2/mod_${name}.so`).join('\n')}
User ${userInfo().username}
Group staff
ErrorLog "${root}/error.log"
LogLevel warn
ProxyRequests Off
ProxyTimeout 15
SSLProxyEngine On
SSLProxyVerify require
SSLProxyCheckPeerName On
SSLProxyCACertificateFile "${certPath}"
DocumentRoot "${docroot}"
<Directory "${docroot}">
  Require all granted
  AllowOverride FileInfo
  Options -Indexes
</Directory>
<FilesMatch "\\.xml$">
  ForceType application/xml
</FilesMatch>
`
  const current=`RewriteEngine On
RewriteRule ^_next/(.*)$ ${tlsOrigin}/_next/$1 [P,L]
RewriteRule ^events-sitemap\\.xml$ ${tlsOrigin}/events-sitemap.xml [P,L]
RewriteRule ^events/(.*)$ ${tlsOrigin}/events/$1 [P,L]
`
  const proposed=current.replace('RewriteEngine On\n',`RewriteEngine On\nRewriteRule ^sitemap\\.xml$ ${tlsOrigin}/sitemap.xml [P,L]\n`)
  await writeFile(join(root,'httpd.conf'),config)
  await writeFile(join(docroot,'.htaccess'),current)
  await writeFile(join(docroot,'sitemap.xml'),'<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://myevy.app/sitemap_index.xml</loc></sitemap><sitemap><loc>https://myevy.app/events-sitemap.xml</loc></sitemap></sitemapindex>')
  await writeFile(join(docroot,'sitemap_index.xml'),fixtureWordPressIndex)
  await writeFile(join(docroot,'page-sitemap.xml'),fixtureWordPressLeaf)
  const syntax=spawnSync(binary,['-f',join(root,'httpd.conf'),'-t'],{encoding:'utf8'})
  assert.equal(syntax.status,0,syntax.stderr)
  const apache=spawn(binary,['-X','-f',join(root,'httpd.conf')],{stdio:'ignore'})
  const origin=`http://127.0.0.1:${port}`,documents=[]
  const locs=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1].replaceAll('&amp;','&'))
  try{
    let ready=false
    for(let attempt=0;attempt<100;attempt++){
      try{await fetch(origin+'/sitemap.xml');ready=true;break}catch{await new Promise(resolve=>setTimeout(resolve,50))}
      if(apache.exitCode!==null)break
    }
    if(!ready)throw Error('Local Apache failed: '+await readFile(join(root,'error.log'),'utf8').catch(()=>''))
    // Prove the existing static root is unchanged until the explicit new rule.
    async function currentRoot(){return (await fetch(origin+'/sitemap.xml')).text()}
    const awaitedRoot=await currentRoot()
    check(()=>assert.ok(locs(awaitedRoot).includes('https://myevy.app/sitemap_index.xml')))
    await writeFile(join(docroot,'.htaccess'),proposed)
    const response=await fetch(origin+'/sitemap.xml')
    check(()=>assert.equal(response.status,200));check(()=>assert.equal(response.headers.get('cache-control'),'no-store'))
    const xml=await response.text(),leaves=locs(xml)
    check(()=>assert.equal(leaves.length,257));check(()=>assert.equal(new Set(leaves).size,257))
    check(()=>assert.ok(leaves.includes('https://myevy.app/page-sitemap.xml')))
    check(()=>assert.equal(leaves.includes('https://myevy.app/events-sitemap.xml'),false))
    check(()=>assert.equal(leaves.includes('https://myevy.app/sitemap_index.xml'),false))
    documents.push({kind:'sitemapindex',xml})
    let children=0
    for(const leaf of leaves){
      const url=new URL(leaf);check(()=>assert.equal(url.origin,'https://myevy.app'))
      const child=await fetch(origin+url.pathname+url.search),body=await child.text()
      check(()=>assert.equal(child.status,200));check(()=>assert.match(body,/<urlset\b/));check(()=>assert.match(child.headers.get('content-type'),/xml/))
      if(url.pathname==='/events-sitemap.xml'){children++;check(()=>assert.equal(child.headers.get('cache-control'),'no-store'))}
      documents.push({kind:'urlset',xml:body})
    }
    for(const [query,expected] of [['partition=00',200],['partition=10',200],['partition=ff',200],['partition=%30%30',200],['partition=invalid',400],['partition=00&partition=ff',400],['partition=00&extra=1',400]]){
      const child=await fetch(origin+'/events-sitemap.xml?'+query,{redirect:'manual'})
      check(()=>assert.equal(child.status,expected));check(()=>assert.equal(child.headers.get('location'),null))
    }
    const zero=await(await fetch(origin+'/events-sitemap.xml?partition=00')).text(),ten=await(await fetch(origin+'/events-sitemap.xml?partition=10')).text()
    check(()=>assert.notEqual(zero,ten))
    for(const method of ['GET','HEAD']){
      const rootResponse=await fetch(origin+'/sitemap.xml',{method});check(()=>assert.equal(rootResponse.status,200));check(()=>assert.equal(rootResponse.headers.get('cache-control'),'no-store'))
    }
    const map=await fetch(origin+'/events/scheduled/map/preview'),mapData=await map.json(),tile=await fetch(origin+mapData.tiles[0])
    check(()=>assert.equal(map.status,200));check(()=>assert.equal(tile.status,200));check(()=>assert.match(tile.headers.get('cache-control'),/no-store/))
    const invalid=await fetch(origin+'/events/private/map/preview');check(()=>assert.equal(invalid.status,404))
    const prefetched=await fetch(origin+'/events/private',{headers:{RSC:'1','Next-Router-Prefetch':'1'}});check(()=>assert.equal(prefetched.status,404));check(()=>assert.match(prefetched.headers.get('cache-control'),/no-store/))
    const parse=spawnSync('python3',['-c',`import json,sys,xml.etree.ElementTree as ET
for document in json.load(sys.stdin):
 root=ET.fromstring(document['xml']);assert root.tag=='{http://www.sitemaps.org/schemas/sitemap/0.9}'+document['kind']
print('XML validated')`],{input:JSON.stringify(documents),encoding:'utf8'})
    check(()=>assert.equal(parse.status,0,parse.stderr))
    // Deliberately strip queries locally: the child becomes an index and the
    // qualifier detects it. This is not a proposed production flag.
    await writeFile(join(docroot,'.htaccess'),proposed.replace('events-sitemap.xml [P,L]','events-sitemap.xml [P,L,QSD]'))
    const droppedQueryBody=await(await fetch(origin+'/events-sitemap.xml?partition=10')).text()
    check(()=>assert.match(droppedQueryBody,/<sitemapindex\b/))
    await writeFile(join(docroot,'.htaccess'),current)
    const restoredRoot=await currentRoot()
    check(()=>assert.ok(locs(restoredRoot).includes('https://myevy.app/sitemap_index.xml')))
    return {engine:version.stdout.trim().split('\n')[0],scope:'real Apache on loopback; HTTPS upstream with verified temporary local CA; WordPress/Yoast fixtures; not Infomaniak proof',children,xmlDocuments:documents.length,queryForwarding:'PASS',rootMerge:'PASS',upstreamTLSVerification:'PASS',rollback:'PASS',queryDropDetection:'PASS',artifacts:root}
  }finally{
    apache.kill('SIGTERM')
    tlsUpstream.closeAllConnections();await new Promise(resolve=>tlsUpstream.close(resolve))
  }
}

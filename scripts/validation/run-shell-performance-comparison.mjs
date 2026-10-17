// Trusted local app and GENERATED PCM only. Same pinned, scripts-disabled toolkit
// as existing proof. Disabled-sandbox Linux Chromium is not native/security proof.
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { auditTools } from './run-offline-render-probe.mjs'
const tools = process.argv[2], audit = await auditTools(tools)
assert.equal(audit.packages, 43)
const output = path.resolve('docs/engineering/evidence/shell-integration-20261017/performance')
await fs.mkdir(output, { recursive: true })
const runtime = await fs.mkdtemp('/tmp/onverse-browser-runtime-'); await fs.chmod(runtime, 0o700)
const originalEnv = { ...process.env }, sha = bytes => createHash('sha256').update(bytes).digest('hex')
const report = { kind: 'baseline-versus-shared-shell-cpu-raster-investigation', tools: audit, checks: [], errors: [], blocked: [], downloads: [], screenshots: [],
  limitations: ['Generated PCM only, no user audio or provider.', 'Disabled-sandbox headless Linux CPU raster, not Mac/Electron/security qualification.', 'Native source graph checked on isolated Vite4174; integrated UI checked on production4173 and file origin.', 'Not listening, metering certification, full DAW or owner cinematic acceptance.', 'Project downloads are not verified filesystem save receipts or autosave.'] }
let browser, page, failure
import { gzipSync } from 'node:zlib'
try {
  for (const key of Object.keys(process.env)) delete process.env[key]
  for (const dir of ['home','cache','profile','fonts','downloads']) await fs.mkdir(path.join(runtime, dir), { mode: 0o700 })
  Object.assign(process.env, { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', TZ: 'UTC', TMPDIR: runtime, HOME: path.join(runtime, 'home'), XDG_CACHE_HOME: path.join(runtime, 'cache'), FONTCONFIG_PATH: path.join(runtime, 'fonts') })
  assert.equal(tmpdir(), runtime)
  const cm = await import(pathToFileURL(path.join(tools, 'node_modules/@sparticuz/chromium/build/index.js')))
  await cm.inflate(path.join(tools, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br')); cm.setupLambdaEnvironment(path.join(runtime, 'al2023/lib'))
  const executablePath = await cm.default.executablePath(); assert.ok(executablePath.startsWith(runtime + '/'))
  const pm = await import(pathToFileURL(path.join(tools, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')))
  const gpu = new Set(['--ignore-gpu-blocklist','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  browser = await pm.default.launch({ executablePath, headless: true, pipe: true, userDataDir: path.join(runtime, 'profile'), env: { ...process.env }, args: [...cm.default.args.filter(a => !gpu.has(a)), '--disable-gpu', '--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-sync','--no-first-run','--no-default-browser-check','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] })
  report.browser = await browser.version(); page = await browser.newPage()
  page.on('pageerror', error => report.errors.push(error.message)); page.on('dialog', dialog => dialog.accept())
  await page.setRequestInterception(true)
  const fileUrl = new URL('../../dist/index.html', import.meta.url).href
  page.on('request', request => {
    const u = request.url()
    if (u.startsWith('http://127.0.0.1:4173/') || u.startsWith('http://127.0.0.1:4174/') || u.startsWith('http://127.0.0.1:4175/') || u === fileUrl || u.startsWith('data:') || u.startsWith('blob:')) void request.continue()
    else { report.blocked.push(u); void request.abort() }
  })
  report.budget = { sampleMs:5000,maxP95FrameMs:50,minAverageFps:30 }; report.samples=[]
  for (const [width,height] of [[1120,700],[1480,920]]) for (const [revision,port] of [['a172fcf',4175],['shared-shell',4173]]) {
    await page.setViewport({width,height}); await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle0'}); await page.click('[data-destination="workbench"]'); await page.click('[data-action="demo"]')
    await page.waitForFunction(()=>!document.querySelector('[data-action="fix"]').disabled,{timeout:60000})
    await page.click('[data-action="fix"]'); await page.waitForFunction(()=>!document.querySelector('[data-action="save-fixed"]').disabled,{timeout:60000})
    await page.mouse.move(0,0)
    for (const pass of ['first','warm']) {
      const before=await page.metrics(); await page.tracing.start({categories:['devtools.timeline','v8','disabled-by-default-devtools.timeline.frame']})
      const timing=await page.evaluate(sampleMs=>new Promise(resolve=>{
        const longtasks=[], observer=new PerformanceObserver(list=>longtasks.push(...list.getEntries().map(e=>({startTime:e.startTime,duration:e.duration}))))
        observer.observe({type:'longtask'}); const frames=[]; let start,prior
        const tick=now=>{start??=now;if(prior!==undefined)frames.push(now-prior);prior=now;if(now-start<sampleMs)return requestAnimationFrame(tick);observer.disconnect();const sorted=[...frames].sort((a,b)=>a-b);resolve({count:frames.length,elapsedMs:now-start,averageFps:frames.length*1000/(now-start),p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1),over50Ms:frames.filter(t=>t>50).length,longtasks})};requestAnimationFrame(tick)
      }),report.budget.sampleMs)
      const trace=await page.tracing.stop(), after=await page.metrics(), file=`${revision}-${width}-${pass}.trace.json.gz`; await fs.writeFile(path.join(output,file),gzipSync(trace,{mtime:0}))
      const totals={};for(const event of JSON.parse(Buffer.from(trace).toString()).traceEvents){if(event.ph==='X' && event.dur && ['Layout','UpdateLayoutTree','PrePaint','Paint','RasterTask','RunTask','MajorGC','MinorGC'].includes(event.name)){const value=totals[event.name]??={count:0,totalMs:0,maxMs:0};value.count++;value.totalMs+=event.dur/1000;value.maxMs=Math.max(value.maxMs,event.dur/1000)}}
      const result={revision,width,height,pass,...timing,trace:file,traceTotals:totals,metrics:Object.fromEntries(['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration','JSHeapUsedSize'].map(k=>[k,after[k]-before[k]]))};report.samples.push(result)
      result.budgetPassed = timing.p95Ms<=report.budget.maxP95FrameMs && timing.averageFps>=report.budget.minAverageFps
    }
  }
  assert.deepEqual(report.errors,[]); assert.deepEqual(report.blocked,[]); report.budgetViolations=report.samples.filter(s=>!s.budgetPassed).map(s=>({revision:s.revision,width:s.width,pass:s.pass,p95Ms:s.p95Ms,averageFps:s.averageFps})); assert.equal(report.budgetViolations.length,0,JSON.stringify(report.budgetViolations));report.status='PASS'
} catch (error) { failure=error;report.status='FAIL';report.failure={message:error.message,stack:error.stack} }
finally { if(browser)await browser.close();for(const key of Object.keys(process.env))delete process.env[key];Object.assign(process.env,originalEnv); report.buildSha256=sha(await fs.readFile(new URL('../../dist/index.html',import.meta.url)));await fs.writeFile(path.join(output,'comparison.json'),JSON.stringify(report,null,2)+'\n') }
console.log(JSON.stringify({status:report.status,samples:report.samples,output,failure:report.failure},null,2));if(failure)throw failure

import { LEGACY_PROFILE, RANGE_PROFILE, getRenderProfile, selectionFrames } from '../../domain/linkedSessions/renderProfiles.js';
// Bounded Linux/Node core repository, not browser/IPC or a general DAW database.
// One lease-owning writer serializes the entire source+destination aggregate.
// Kernel ownership precedes validated epoch handoff; no PID-based lease reclaim.
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createSnapshot, createSelection, dependencyKey } from '../../domain/linkedSessions/linkedSessionContract.js';
import { validateDestinationProcessing as processing } from '../../audio/linkedSessions/renderLinkedDestination.js';
import { acquireLinuxWriterLock, LOCK_PROFILE, lockMarker } from './linuxWriterLock.js';
import { decodePCM } from '../../audio/linkedSessions/pcm.js';

const uuid = x => typeof x === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(x);
const hash = x => createHash('sha256').update(x).digest('hex');
const hex = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const json = x => Buffer.from(JSON.stringify(x) + '\n');
const error = code => Object.assign(Error(code), { code });
const requireValue = (test, code = 'INVALID_STORE_DATA') => { if (!test) throw error(code); };
function record(x, keys) { requireValue(x && Object.getPrototypeOf(x) === Object.prototype && Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k))); }
function freeze(x) { if (x && typeof x === 'object') { for (const v of Object.values(x)) freeze(v); Object.freeze(x); } return x; }
const integer = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;
function source(value, profile = LEGACY_PROFILE) {
  record(value, ['snapshot','selection']);
  const snapshot = createSnapshot(value.snapshot,profile), selection = createSelection(value.selection,profile);
  dependencyKey(snapshot, selection,profile);
  return { snapshot, selection };
}
function destination(x, profile) {
  record(x, ['targetId','linkRevisionId','linkedVersionId','sampleRate','layout','processing','unrelatedAssetId']);
  requireValue(id(x.targetId) && id(x.linkRevisionId) && (x.linkedVersionId === null || uuid(x.linkedVersionId)) &&
    x.sampleRate === 48000 && JSON.stringify(x.layout) === '["L","R"]' && id(x.unrelatedAssetId)); processing(x.processing,profile);
}
function provenance(p, profile = LEGACY_PROFILE) {
  record(p, ['profile','sourceSessionId','sourceRevisionId','dependencyKey','targetId','planId','operationId','sha256']);
  requireValue(p.profile === profile && [p.sourceSessionId,p.sourceRevisionId,p.targetId,p.planId,p.operationId].every(id) &&
    hex(p.sha256) && typeof p.dependencyKey === 'string' && p.dependencyKey.length <= 32768);
  const dep = JSON.parse(p.dependencyKey);
  requireValue(Array.isArray(dep.members) && dep.members.length <= 8);
  const snapshot = { schemaVersion: 1, sessionId: p.sourceSessionId, revisionId: p.sourceRevisionId,
    sampleRate: dep.sampleRate, layout: dep.layout, tracks: dep.members.map(t => ({ ...t, label: t.trackId })) };
  requireValue(dependencyKey(snapshot, dep.selection,profile) === p.dependencyKey);
}
const stateProfile = x => x.schemaVersion===3 ? (requireValue(x.renderProfile===RANGE_PROFILE),x.renderProfile) : LEGACY_PROFILE;
const versionFrames = v => selectionFrames(JSON.parse(v.provenance.dependencyKey).selection,v.provenance.profile);
function validateState(x) {
  const profile=stateProfile(x),limits=getRenderProfile(profile);
  record(x, ['schemaVersion','generationId','parentId','source','destination','assets','versions','past','future',...(x.schemaVersion===3?['renderProfile']:[])]);
  requireValue([1,2,3].includes(x.schemaVersion) && uuid(x.generationId) && (x.parentId === null || uuid(x.parentId)) && x.parentId !== x.generationId);
  x.source = source(x.source,profile); destination(x.destination,profile);
  requireValue(Array.isArray(x.assets) && x.assets.length >= 1 && x.assets.length <= 32);
  const assets = new Map();
  for (const a of x.assets) {
    record(a, ['assetId','sha256','frames']); requireValue(id(a.assetId) && hex(a.sha256) && integer(a.frames, 1, limits.maxFrames) && !assets.has(a.assetId)); assets.set(a.assetId, a);
  }
  for (const t of x.source.snapshot.tracks) {
    const a = assets.get(t.assetId); requireValue(a && a.sha256 === t.sha256 && a.frames === t.frames);
  }
  requireValue(assets.has(x.destination.unrelatedAssetId));
  requireValue(Array.isArray(x.versions) && x.versions.length <= 64);
  const versions = new Set();
  for (const v of x.versions) {
    record(v, ['versionId','sha256','provenance']); requireValue(uuid(v.versionId) && !versions.has(v.versionId) && hex(v.sha256));
    provenance(v.provenance,profile); requireValue(v.provenance.sha256 === v.sha256 && v.provenance.targetId === x.destination.targetId); versions.add(v.versionId);
  }
  requireValue(x.assets.reduce((n,a)=>n+a.frames*8,0)<=limits.maxAssetBytes && x.versions.reduce((n,v)=>n+versionFrames(v)*8,0)<=limits.maxVersionBytes,'MEDIA_BUDGET');
  const known = v => v === null || versions.has(v);
  requireValue(known(x.destination.linkedVersionId));
  for (const list of [x.past,x.future]) requireValue(Array.isArray(list) && list.length <= 64 && Array.from(list).every(known));
  return x;
}
function checkDescriptor(d) {
  requireValue(process.platform === 'linux', 'LINUX_PROFILE_ONLY');
  record(d, ['root','owner']); requireValue(uuid(d.owner) && typeof d.root === 'string' && path.isAbsolute(d.root) &&
    path.normalize(d.root) === d.root && /^mov-linked-generation-[A-Za-z0-9]+$/.test(path.basename(d.root)), 'INVALID_ROOT');
}
async function readFile(d, name, max) {
  const h = await fs.open(path.join(d.root, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const s = await h.stat(); requireValue(s.isFile() && s.uid === process.getuid() && s.nlink === 1 && !(s.mode & 0o077) && s.size <= max, 'UNSAFE_STORE_FILE');
    const bytes = Buffer.alloc(max + 1); let n = 0;
    while (n < bytes.length) { const r = await h.read(bytes, n, bytes.length - n, n); if (!r.bytesRead) break; n += r.bytesRead; }
    requireValue(n === s.size && n <= max, 'CHANGED_STORE_FILE'); return bytes.subarray(0, n);
  } finally { await h.close(); }
}
async function checkRoot(d) {
  checkDescriptor(d);
  const s = await fs.lstat(d.root);
  requireValue(s.isDirectory() && !s.isSymbolicLink() && s.uid === process.getuid() && !(s.mode & 0o077) && await fs.realpath(d.root) === d.root, 'UNSAFE_STORE_ROOT');
  requireValue((await readFile(d, '.owner', 36)).toString() === d.owner, 'WRONG_STORE_OWNER');
}
async function exclusive(d, name, bytes, afterPartial) {
  const h = await fs.open(path.join(d.root, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    let n = 0, notified = false; const split = Math.ceil(bytes.length / 2);
    while (n < bytes.length) {
      const length = afterPartial && n < split ? split - n : bytes.length - n;
      const r = await h.write(bytes, n, length, null); requireValue(r.bytesWritten > 0, 'WRITE_STALLED'); n += r.bytesWritten;
      if (afterPartial && !notified && n >= split) { notified = true; await afterPartial(); }
    }
    await h.sync();
  }
  finally { await h.close(); }
}
async function syncDirectory(d) {
  const h = await fs.open(d.root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await h.sync(); } finally { await h.close(); }
}
async function blob(d, sha256, frames, profile = LEGACY_PROFILE) {
  const limits=getRenderProfile(profile);
  requireValue(hex(sha256) && integer(frames, 1, limits.maxFrames));
  const bytes = await readFile(d, `media-${sha256}.f32`, frames * 8);
  decodePCM(bytes, frames,profile); requireValue(hash(bytes) === sha256, 'MEDIA_CHECKSUM'); return bytes;
}
async function readState(d) {
  await checkRoot(d);
  const p = JSON.parse(await readFile(d, 'CURRENT.json', 1024));
  record(p, ['generationId','generationSha256','journalSha256']);
  requireValue(uuid(p.generationId) && hex(p.generationSha256) && hex(p.journalSha256));
  const g = await readFile(d, `generation-${p.generationId}.json`, 512 * 1024);
  const j = await readFile(d, `journal-${p.generationId}.json`, 1024);
  requireValue(hash(g) === p.generationSha256 && hash(j) === p.journalSha256, 'METADATA_CHECKSUM');
  const state = validateState(JSON.parse(g)), journal = JSON.parse(j);
  record(journal, ['schemaVersion','generationId','parentId','generationSha256']);
  requireValue(state.generationId === p.generationId && journal.schemaVersion === 1 && journal.generationId === state.generationId &&
    journal.parentId === state.parentId && journal.generationSha256 === p.generationSha256, 'JOURNAL_MISMATCH');
  const checked = new Set();
  for (const a of [...state.assets, ...state.versions.map(v => ({ ...v, frames: versionFrames(v) }))]) {
    const key = `${a.sha256}:${a.frames}`; if (!checked.has(key)) { await blob(d, a.sha256, a.frames,stateProfile(state)); checked.add(key); }
  }
  return freeze(state);
}

export async function createGenerationStore({ parent, source: initialSource, destination: initialDestination, assets, onBoundary = async () => {}, renderProfile = LEGACY_PROFILE }) {
  const limits=getRenderProfile(renderProfile);
  requireValue(process.platform === 'linux' && typeof parent === 'string' && path.isAbsolute(parent), 'LINUX_ABSOLUTE_PARENT_REQUIRED');
  requireValue(Array.isArray(assets) && assets.length >= 1 && assets.length <= 32);
  requireValue(assets.every(a=>integer(a?.frames,1,limits.maxFrames)) && assets.reduce((n,a)=>n+a.frames*8,0)<=limits.maxAssetBytes,'MEDIA_BUDGET');
  const media = assets.map(a => {
    record(a, ['assetId','frames','bytes']); requireValue(id(a.assetId) && a.bytes instanceof Uint8Array);
    requireValue(integer(a.frames,1,limits.maxFrames) && a.bytes.byteLength===a.frames*8);
    const bytes = Buffer.from(a.bytes); decodePCM(bytes, a.frames,renderProfile); return { assetId: a.assetId, frames: a.frames, bytes, sha256: hash(bytes) };
  });
  record(initialDestination, ['targetId','processing','unrelatedAssetId']);
  const state = validateState({ schemaVersion: renderProfile===LEGACY_PROFILE?2:3,...(renderProfile===LEGACY_PROFILE?{}:{renderProfile}), generationId: randomUUID(), parentId: null, source: structuredClone(initialSource),
    destination: { ...structuredClone(initialDestination), linkRevisionId: randomUUID(), linkedVersionId: null, sampleRate: 48000, layout: ['L','R'] },
    assets: media.map(({ assetId,frames,sha256 }) => ({ assetId,frames,sha256 })), versions: [], past: [], future: [] });
  const root = await fs.mkdtemp(path.join(await fs.realpath(parent), 'mov-linked-generation-')); await fs.chmod(root, 0o700);
  const descriptor = Object.freeze({ root, owner: randomUUID() });
  await exclusive(descriptor, '.owner', Buffer.from(descriptor.owner));
  await exclusive(descriptor, '.writer-lock', lockMarker(descriptor.owner)); await syncDirectory(descriptor);
  return openHandle(descriptor, { writable: true, onBoundary, initialize: { state,media } });
}
export async function openGenerationStore(descriptor, { writable = false, onBoundary = async () => {} } = {}) {
  return openHandle(Object.freeze({ ...descriptor }), { writable, onBoundary });
}
async function openHandle(d, { writable, onBoundary, initialize }) {
  await checkRoot(d); requireValue(typeof writable === 'boolean' && typeof onBoundary === 'function');
  const renderProfile=initialize ? stateProfile(initialize.state) : stateProfile(await readState(d)),limits=getRenderProfile(renderProfile);
  let stagingBytes=0,stagingCount=0;
  const lease = randomUUID(), prepared = new WeakMap(), activePreparations = new Map(), orphanPlans = new WeakMap();
  let tail = Promise.resolve(), closing = false, poisoned = false, closePromise, osLock, lineageDepth=0;
  const boundary = (at, operation) => onBoundary(at, operation);
  function writerEpoch(x) {
    record(x,['profile','storeOwner','epochId','pid']);
    requireValue(x.profile===LOCK_PROFILE&&x.storeOwner===d.owner&&uuid(x.epochId)&&integer(x.pid,1,2147483647),'INVALID_WRITER_EPOCH');
    return x;
  }
  async function assertWriter() {
    requireValue(writable, 'READ_ONLY_STORE'); requireValue(!poisoned, 'RECOVERY_REQUIRED'); await checkRoot(d);
    await osLock.assertHeld();
    requireValue(writerEpoch(JSON.parse(await readFile(d,'.writer',512))).epochId===lease,'WRITER_LEASE_LOST');
  }
  function enqueue(fn) {
    if (closing) return Promise.reject(error('STORE_CLOSED'));
    const result = tail.then(async () => { await assertWriter(); return fn(); }); tail = result.catch(() => {}); return result;
  }
  async function putBlob(bytes, frames, operation) {
    decodePCM(bytes, frames,renderProfile); const sha256 = hash(bytes);
    try { await exclusive(d, `media-${sha256}.f32`, bytes, () => boundary('media-partial', operation)); }
    catch (e) { if (e.code !== 'EEXIST') throw e; requireValue((await blob(d, sha256, frames,renderProfile)).equals(bytes), 'IMMUTABLE_MEDIA_CONFLICT'); }
    await boundary('media-synced', operation); await syncDirectory(d); await boundary('media-published', operation); return sha256;
  }
  async function publish(state, operation) {
    // Called with the serialized writer. No source or target mutation can enter
    // this queue between the guard and atomic pointer publication.
    requireValue(lineageDepth<256,'GENERATION_CAPACITY');
    requireValue(stateProfile(state)===renderProfile,'PROFILE_MISMATCH');
    validateState(state); // Invalid imported metadata cannot poison a pristine writer.
    const g = json(state); requireValue(g.length <= 512 * 1024, 'GENERATION_TOO_LARGE');
    try {
      await exclusive(d, `generation-${state.generationId}.json`, g); await boundary('generation-synced', operation);
      await syncDirectory(d); await boundary('generation-published', operation);
      const j = json({ schemaVersion: 1, generationId: state.generationId, parentId: state.parentId, generationSha256: hash(g) });
      await exclusive(d, `journal-${state.generationId}.json`, j); await boundary('journal-synced', operation);
      await syncDirectory(d); await boundary('journal-published', operation);
      const tmp = `pointer-${state.generationId}.tmp`;
      await exclusive(d, tmp, json({ generationId: state.generationId, generationSha256: hash(g), journalSha256: hash(j) })); await boundary('pointer-synced', operation);
      await assertWriter();
      await fs.rename(path.join(d.root, tmp), path.join(d.root, 'CURRENT.json')); await boundary('pointer-renamed', operation);
      await syncDirectory(d); await boundary('directory-synced', operation); lineageDepth++;
    } catch (e) { poisoned = true; throw e; }
  }
  const nextState = old => ({ ...structuredClone(old), generationId: randomUUID(), parentId: old.generationId });
  async function lineage() {
    const head=await readState(d),states=[head],seen=new Set([head.generationId]);let parent=head.parentId;
    while(parent!==null) {
      requireValue(!seen.has(parent)&&seen.size<256,'INVALID_OR_OVERSIZED_LINEAGE');seen.add(parent);
      const g=await readFile(d,`generation-${parent}.json`,512*1024),j=JSON.parse(await readFile(d,`journal-${parent}.json`,1024));
      const state=validateState(JSON.parse(g));record(j,['schemaVersion','generationId','parentId','generationSha256']);
      requireValue(state.schemaVersion===head.schemaVersion&&stateProfile(state)===renderProfile&&state.generationId===parent&&j.schemaVersion===1&&j.generationId===parent&&j.parentId===state.parentId&&j.generationSha256===hash(g),'LINEAGE_MISMATCH');
      states.push(state);parent=state.parentId;
    }
    requireValue([2,3].includes(head.schemaVersion)&&stateProfile(head)===renderProfile,'LEGACY_READ_ONLY');
    for(const state of states)for(const a of [...state.assets,...state.versions.map(v=>({...v,frames:versionFrames(v)}))])await blob(d,a.sha256,a.frames,renderProfile);
    return states;
  }
  try {
    if(writable) {
      osLock=await acquireLinuxWriterLock(d);
      await boundary('lock-acquired',initialize?'initialize-lock':'recovery');
      if(!initialize) {
        lineageDepth=(await lineage()).length;writerEpoch(JSON.parse(await readFile(d,'.writer',512)));
        await boundary('recovery-validated','recovery');
      }
      const name=`writer-epoch-${lease}.tmp`;
      await exclusive(d,name,json({profile:LOCK_PROFILE,storeOwner:d.owner,epochId:lease,pid:process.pid}));
      await boundary('epoch-synced',initialize?'initialize-lock':'recovery');
      await osLock.assertHeld();await fs.rename(path.join(d.root,name),path.join(d.root,'.writer'));
      await boundary('epoch-renamed',initialize?'initialize-lock':'recovery');await syncDirectory(d);
      await boundary('epoch-directory-synced',initialize?'initialize-lock':'recovery');
    }
    if (initialize) {
      for (const a of initialize.media) await putBlob(a.bytes, a.frames, 'initialize');
      await publish(initialize.state, 'initialize');
    }
    await readState(d);
  } catch (e) {
    try { if(osLock)await osLock.close(); }
    catch(cleanupError){throw new AggregateError([e,cleanupError],'Open and lock cleanup failed');}
    throw e;
  }
  function prepKey() {return JSON.stringify([...activePreparations].map(([t,h])=>[t.preparationId,h]).sort((a,b)=>a[0].localeCompare(b[0])));}
  async function reachability() {
    const states=await lineage(),names=new Set(['.owner','.writer','.writer-lock','CURRENT.json']);
    for(const state of states) {
      names.add(`generation-${state.generationId}.json`);names.add(`journal-${state.generationId}.json`);
      for(const a of [...state.assets,...state.versions])names.add(`media-${a.sha256}.f32`);
    }
    for(const sha256 of activePreparations.values())names.add(`media-${sha256}.f32`);
    return {head:states[0].generationId,names};
  }
  function orphanLimit(name) {
    if(/^media-[a-f0-9]{64}\.f32$/.test(name))return limits.maxFrames*8;
    const match=/^(generation|journal|pointer|writer-epoch)-([a-f0-9-]+)\.(json|tmp)$/.exec(name);
    if(!match||!uuid(match[2]))return null;
    if(match[1]==='generation'&&match[3]==='json')return 512*1024;
    if(match[1]==='journal'&&match[3]==='json')return 1024;
    if(['pointer','writer-epoch'].includes(match[1])&&match[3]==='tmp')return 1024;
    return null;
  }
  async function orphanSnapshot(name,max) {
    const before=await fs.lstat(path.join(d.root,name));
    const bytes=await readFile(d,name,max),after=await fs.lstat(path.join(d.root,name));
    requireValue(before.dev===after.dev&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'ORPHAN_CHANGED');
    return {name,size:bytes.length,sha256:hash(bytes),dev:before.dev,ino:before.ino};
  }
  return Object.freeze({ descriptor: d, renderProfile,
    readState: () => readState(d),
    async readSource(groupId) { const s = await readState(d); return s.source.selection.groupId === groupId ? s.source : null; },
    async readTarget(targetId) { const s = await readState(d); return s.destination.targetId === targetId ? s.destination : null; },
    async loadAsset(assetId) { const s = await readState(d), a = s.assets.find(a => a.assetId === assetId); requireValue(a, 'ASSET_NOT_FOUND'); return blob(d, a.sha256, a.frames,renderProfile); },
    async readLinked() {
      const s = await readState(d), v = s.versions.find(v => v.versionId === s.destination.linkedVersionId); requireValue(v, 'NO_LINKED_VERSION');
      return { state: s, version: v, bytes: await blob(d, v.sha256, versionFrames(v),renderProfile) };
    },
    inspectOrphans() {return enqueue(async()=>{
      const reachable=await reachability(),files=[],unknown=[],unsafe=[],archives=[];
      const names=await fs.readdir(d.root);requireValue(names.length<=2048,'ORPHAN_SCAN_LIMIT');
      for(const name of names.sort()) {
        if(reachable.names.has(name))continue;
        if(name.startsWith('quarantine-')&&uuid(name.slice(11))) {archives.push(name);continue;}
        const max=orphanLimit(name);if(max===null){unknown.push(name);continue;}
        try{files.push(await orphanSnapshot(name,max));}
        catch(e){if(['ELOOP','UNSAFE_STORE_FILE','EISDIR'].includes(e.code))unsafe.push(name);else throw e;}
      }
      const view=freeze({planId:randomUUID(),baseGenerationId:reachable.head,files:files.map(({name,size,sha256})=>({name,size,sha256})),unknown,unsafe,archives});
      orphanPlans.set(view,{head:reachable.head,preparations:prepKey(),files});return view;
    });},
    quarantineOrphans(view) {return enqueue(async()=>{
      const plan=orphanPlans.get(view);requireValue(plan,'INVALID_ORPHAN_PLAN');
      const now=await reachability();requireValue(now.head===plan.head&&prepKey()===plan.preparations,'ORPHAN_PLAN_STALE');
      for(const file of plan.files) {
        requireValue(!now.names.has(file.name),'ORPHAN_BECAME_REACHABLE');
        requireValue(JSON.stringify(await orphanSnapshot(file.name,orphanLimit(file.name)))===JSON.stringify(file),'ORPHAN_CHANGED');
      }
      orphanPlans.delete(view);
      if(!plan.files.length)return Object.freeze({status:'nothing-to-quarantine',count:0});
      const archive=`quarantine-${randomUUID()}`,q={...d,root:path.join(d.root,archive)};
      try {
        await fs.mkdir(q.root,{mode:0o700});
        await exclusive(q,'manifest.json',json({schemaVersion:1,baseGenerationId:plan.head,files:plan.files}));
        await syncDirectory(q);await syncDirectory(d);await boundary('quarantine-manifest-synced','quarantine');
        for(const file of plan.files) {
          const current=await reachability();requireValue(current.head===plan.head&&prepKey()===plan.preparations&&!current.names.has(file.name),'ORPHAN_PLAN_STALE');
          requireValue(JSON.stringify(await orphanSnapshot(file.name,orphanLimit(file.name)))===JSON.stringify(file),'ORPHAN_CHANGED');
          await osLock.assertHeld();await fs.rename(path.join(d.root,file.name),path.join(q.root,file.name));
          await syncDirectory(q);await syncDirectory(d);await boundary('orphan-moved','quarantine');
        }
        await boundary('quarantine-synced','quarantine');
        return Object.freeze({status:'quarantined',count:plan.files.length,archive});
      }catch(e){poisoned=true;throw e;}
    });},
    prepare(media) {
      let copy,reserved=false;
      try {
        requireValue(!closing,'STORE_CLOSED');requireValue(writable,'READ_ONLY_STORE');requireValue(!poisoned,'RECOVERY_REQUIRED');
        record(media,['bytes','frames','sampleRate','layout','sha256','provenance']);
        requireValue(media.bytes instanceof Uint8Array && integer(media.frames,1,limits.maxFrames) && media.bytes.byteLength===media.frames*8 &&
          (limits.fixedFrames===null || media.frames===limits.fixedFrames) && media.sampleRate===48000 && JSON.stringify(media.layout)==='["L","R"]');
        provenance(media.provenance,renderProfile);requireValue(versionFrames({provenance:media.provenance})===media.frames,'MEDIA_GEOMETRY');
        requireValue(stagingCount<limits.maxCandidates && stagingBytes+media.bytes.byteLength<=limits.maxStagedBytes,'STAGING_CAPACITY');
        stagingCount++;stagingBytes+=media.bytes.byteLength;reserved=true;
        copy={...structuredClone({...media,bytes:null}),bytes:Buffer.from(media.bytes)};
        decodePCM(copy.bytes,copy.frames,renderProfile);requireValue(hash(copy.bytes)===copy.sha256 && copy.provenance.sha256===copy.sha256,'MEDIA_CHECKSUM');
      }catch(e){if(reserved){stagingCount--;stagingBytes-=media.bytes.byteLength;}return Promise.reject(e);}
      return enqueue(async()=>{
        await putBlob(copy.bytes,copy.frames,'prepare');const token=Object.freeze({preparationId:randomUUID()});
        prepared.set(token,copy);activePreparations.set(token,copy.sha256);return token;
      }).catch(e=>{stagingCount--;stagingBytes-=copy.bytes.byteLength;throw e;});
    },
    commit(command) {
      // Preserve opaque token identity; defensively copy all metadata now.
      const token = command?.prepared; let c;
      try { record(command, ['prepared','targetId','expected','expectedSource','provenance']); c = structuredClone({ ...command, prepared: null }); }
      catch (e) { return Promise.reject(e); }
      return enqueue(async () => {
        const media = prepared.get(token); requireValue(media, 'UNKNOWN_PREPARATION'); provenance(c.provenance,renderProfile);
        requireValue(JSON.stringify(c.provenance) === JSON.stringify(media.provenance), 'PROVENANCE_MISMATCH');
        record(c.expectedSource, ['sessionId','groupId','dependencyKey']);
        record(c.expected, ['targetId','linkRevisionId','linkedVersionId','sampleRate','layout']);
        const s = await readState(d), dest = s.destination;
        requireValue(c.targetId === dest.targetId && c.provenance.targetId === dest.targetId && c.expected.targetId === dest.targetId &&
          c.expected.linkRevisionId === dest.linkRevisionId && c.expected.linkedVersionId === dest.linkedVersionId && c.expected.sampleRate === 48000 &&
          JSON.stringify(c.expected.layout) === '["L","R"]', 'TARGET_CONFLICT');
        const key = dependencyKey(s.source.snapshot, s.source.selection,renderProfile);
        requireValue(c.expectedSource.sessionId === s.source.snapshot.sessionId && c.expectedSource.groupId === s.source.selection.groupId &&
          c.expectedSource.dependencyKey === key && c.provenance.dependencyKey === key && c.provenance.sourceSessionId === c.expectedSource.sessionId, 'SOURCE_CONFLICT');
        await blob(d, media.sha256, media.frames,renderProfile); // Reverify durable bytes, not the old in-memory input.
        const n = nextState(s), versionId = randomUUID();
        n.versions.push({ versionId, sha256: media.sha256, provenance: c.provenance });
        n.past.push(dest.linkedVersionId); n.future = []; n.destination.linkedVersionId = versionId; n.destination.linkRevisionId = randomUUID();
        await publish(n, 'commit'); stagingBytes-=media.bytes.byteLength;stagingCount--;prepared.delete(token); activePreparations.delete(token);
        return Object.freeze({ targetId: dest.targetId, versionId, generationId: n.generationId });
      });
    },
    discard(token) { return enqueue(async () => { requireValue(prepared.has(token), 'UNKNOWN_PREPARATION');stagingBytes-=prepared.get(token).bytes.byteLength;stagingCount--; prepared.delete(token); activePreparations.delete(token); /* Blob may be shared: retain, never delete by guess. */ }); },
    updateSource(value) {
      let selected; try { selected = source(structuredClone(value),renderProfile); } catch (e) { return Promise.reject(e); }
      return enqueue(async () => { const s = await readState(d), n = nextState(s); n.source = selected; await publish(n, 'source'); return n.generationId; });
    },
    editDestination(patch) {
      let copy; try { requireValue(patch && Object.getPrototypeOf(patch) === Object.prototype && Object.keys(patch).length > 0 && Object.keys(patch).every(k => ['processing','unrelatedAssetId'].includes(k))); copy = structuredClone(patch); }
      catch (e) { return Promise.reject(e); }
      return enqueue(async () => { const s = await readState(d), n = nextState(s); Object.assign(n.destination, copy); await publish(n, 'destination'); return n.generationId; });
    },
    moveHistory(direction, expectedLinkRevisionId) {
      return enqueue(async () => {
        requireValue(direction === 'undo' || direction === 'redo'); const s = await readState(d), n = nextState(s);
        requireValue(s.destination.linkRevisionId === expectedLinkRevisionId, 'TARGET_CONFLICT');
        const from = direction === 'undo' ? n.past : n.future, to = direction === 'undo' ? n.future : n.past;
        requireValue(from.length > 0, 'HISTORY_UNAVAILABLE'); to.push(n.destination.linkedVersionId); n.destination.linkedVersionId = from.pop(); n.destination.linkRevisionId = randomUUID();
        await publish(n, direction); return n.destination.linkedVersionId;
      });
    },
    close() {
      if (!closePromise) {
        closing = true;
        closePromise = (async () => {
          await tail;
          activePreparations.clear();stagingCount=0;stagingBytes=0;if(osLock)await osLock.close(); // Retain epoch metadata and permanent lock inode.
        })();
      }
      return closePromise;
    }
  });
}

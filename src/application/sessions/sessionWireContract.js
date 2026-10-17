import { LEGACY_PROFILE, getRenderProfile } from '../../domain/linkedSessions/renderProfiles.js';
// Strict Node/transport-neutral boundary. Validation does not authenticate senders.
// Actual Electron main-frame/document authorization must precede these validators.
export const SESSION_WIRE_VERSION = 1;
export const SESSION_METHODS = Object.freeze([
  'getSession', 'reviewLinkedUpdate', 'approveLinkedUpdate', 'executeApproved',
  'getLinkedReview', 'cancelLinkedReview', 'discardReview', 'getOperation', 'cancelOperation', 'moveLinkedHistory', 'getPersistenceState'
]);
export const isSessionId = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(x);
export const sessionError = code => Object.assign(Error(code), { code });
function requireValue(value, code = 'INVALID_REQUEST') { if (!value) throw sessionError(code); }
function plain(value) { return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype; }
export function sessionRecord(value, keys) {
  requireValue(plain(value) && Reflect.ownKeys(value).length === keys.length);
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    requireValue(d && Object.hasOwn(d, 'value') && d.enumerable);
  }
}
function validateTree(value, seen = new Set(), depth = 0, budget = { nodes: 0 }) {
  requireValue(++budget.nodes <= 256 && depth <= 6);
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { requireValue(Number.isFinite(value)); return; }
  if (typeof value === 'string') { requireValue(value.length <= 4096); return; }
  requireValue(typeof value === 'object' && !seen.has(value)); seen.add(value);
  if (Array.isArray(value)) {
    requireValue(Object.getPrototypeOf(value) === Array.prototype && value.length <= 64 && Reflect.ownKeys(value).length === value.length + 1);
    for (let i = 0; i < value.length; i++) {
      const d = Object.getOwnPropertyDescriptor(value, String(i));
      requireValue(d && Object.hasOwn(d, 'value') && d.enumerable); validateTree(d.value, seen, depth + 1, budget);
    }
  } else {
    requireValue(plain(value));
    for (const key of Reflect.ownKeys(value)) {
      requireValue(typeof key === 'string' && key.length <= 80);
      const d = Object.getOwnPropertyDescriptor(value, key);
      requireValue(Object.hasOwn(d, 'value') && d.enumerable); validateTree(d.value, seen, depth + 1, budget);
    }
  }
}
const fields = Object.freeze({
  getSession: ['sessionId'], reviewLinkedUpdate: ['groupId', 'targetId'],
  getLinkedReview: ['reviewId'], cancelLinkedReview: ['reviewId'],
  approveLinkedUpdate: ['planId', 'reviewRevision'], executeApproved: ['planId'], discardReview: ['planId'],
  getOperation: ['operationId'], cancelOperation: ['operationId'],
  moveLinkedHistory: ['targetId', 'direction', 'expectedLinkRevisionId'], getPersistenceState: []
});
export function readSessionRequest(input) {
  // Reject accessors before clone/JSON serialization can execute them.
  validateTree(input);
  sessionRecord(input, ['schemaVersion', 'hostEpoch', 'requestId', 'projectId', 'method', 'params']);
  requireValue(input.schemaVersion === SESSION_WIRE_VERSION, 'UNSUPPORTED_VERSION');
  for (const key of ['hostEpoch', 'requestId', 'projectId']) requireValue(isSessionId(input[key]));
  requireValue(SESSION_METHODS.includes(input.method), 'UNSUPPORTED_METHOD');
  sessionRecord(input.params, fields[input.method]);
  for (const [key, value] of Object.entries(input.params)) {
    if (key === 'direction') requireValue(value === 'undo' || value === 'redo');
    else requireValue(isSessionId(value));
  }
  requireValue(new TextEncoder().encode(JSON.stringify(input)).length <= 16384);
  return freezeSessionValue({schemaVersion:1, hostEpoch:input.hostEpoch, requestId:input.requestId,
    projectId:input.projectId, method:input.method, params:Object.fromEntries(fields[input.method].map(key => [key,input.params[key]]))});
}
// Separate bounded byte-read contract: never insert PCM arrays in JSON commands.
export function readSessionPreviewRequest(input, renderProfile=LEGACY_PROFILE) {
  const limits=getRenderProfile(renderProfile),chunked=limits.fixedFrames===null;
  validateTree(input);
  const keys=['schemaVersion','hostEpoch','projectId','planId','previewId',...(chunked?['offsetBytes','lengthBytes']:[])];
  sessionRecord(input,keys);
  requireValue(input.schemaVersion===SESSION_WIRE_VERSION,'UNSUPPORTED_VERSION');
  for(const key of ['hostEpoch','projectId','planId','previewId'])requireValue(isSessionId(input[key]));
  if(chunked)requireValue(Number.isSafeInteger(input.offsetBytes)&&input.offsetBytes>=0&&input.offsetBytes%8===0&&
    Number.isSafeInteger(input.lengthBytes)&&input.lengthBytes>=8&&input.lengthBytes%8===0&&input.lengthBytes<=limits.maxPreviewChunkBytes,'INVALID_PREVIEW_RANGE');
  return freezeSessionValue(Object.fromEntries(keys.map(key=>[key,input[key]])));
}
export function freezeSessionValue(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeSessionValue(item);
    Object.freeze(value);
  }
  return value;
}
const publicCodes = new Set([
  'INVALID_REQUEST', 'UNSUPPORTED_VERSION', 'UNSUPPORTED_METHOD', 'FOREIGN_PROJECT', 'HOST_EPOCH_CHANGED',
  'DISCONNECTED', 'HOST_CLOSED', 'ROLE_FORBIDDEN', 'SCOPE_FORBIDDEN', 'REQUEST_CONFLICT', 'REQUEST_CAPACITY',
  'HOST_CAPACITY', 'INVALID_HOST_ID', 'SESSION_NOT_FOUND', 'INVALID_PLAN', 'INVALID_APPROVAL', 'PLAN_EXPIRED',
  'UNSUPPORTED_RENDER_PROFILE', 'PROFILE_MISMATCH', 'STAGING_CAPACITY', 'MEDIA_BUDGET', 'INVALID_PREVIEW_RANGE', 'INVALID_PREVIEW', 'REVIEW_NOT_READY', 'UNSUPPORTED_REVIEW_MODE', 'ALREADY_STARTED', 'OUTCOME_UNKNOWN', 'SOURCE_UNAVAILABLE', 'SELECTION_CHANGED', 'STALE_SOURCE',
  'TARGET_CHANGED', 'TARGET_CONFLICT', 'SOURCE_CONFLICT', 'INCOMPATIBLE_TARGET', 'INVALID_TARGET_ID',
  'INVALID_RENDER', 'INVALID_RENDER_HASH', 'RECOVERY_REQUIRED', 'PROMOTION_UNCERTAIN', 'MEDIA_CHECKSUM',
  'MISSING_SELECTED_TRACK', 'HISTORY_UNAVAILABLE', 'CANCELLED', 'READ_ONLY_STORE', 'STORE_CLOSED',
  'GENERATION_CAPACITY', 'WRITER_BUSY', 'UPDATE_FAILED'
]);
export function publicSessionError(error) {
  let code = 'INTERNAL_ERROR';
  try { const d = Object.getOwnPropertyDescriptor(error, 'code'); if (d && publicCodes.has(d.value)) code = d.value; } catch {}
  return Object.freeze({ code }); // Never renderer-visible stack, cause, message or filesystem path.
}

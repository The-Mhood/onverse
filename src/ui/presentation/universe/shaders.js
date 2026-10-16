// Procedural GLSL for the shared universe stage (COORD-010 resolution 6213314954).
// Provenance: written for this repository by agent-b. No textures, models or fetched data.
// Presentation only: no audio input, no physics, no state.

export const NOISE_GLSL = `
float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  float n000=hash(i), n100=hash(i+vec3(1,0,0)), n010=hash(i+vec3(0,1,0)), n110=hash(i+vec3(1,1,0));
  float n001=hash(i+vec3(0,0,1)), n101=hash(i+vec3(1,0,1)), n011=hash(i+vec3(0,1,1)), n111=hash(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y), mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.02+11.7; a*=0.5; } return s; }
`

// Sky: domain-warped nebula, a spiral galaxy, a warm horizon light and sparse stars. Tone-mapped.
export const BACKDROP_FS = `${NOISE_GLSL}
uniform vec2 uRes; uniform float uTime, uDrift, uTanHalf, uDim;
uniform mat3 uRot; uniform vec3 uDeep, uA, uB, uC, uH, uGC;
varying vec2 vUv;
void main(){
  vec2 p = vUv*2.0 - 1.0; p.x *= uRes.x/uRes.y;
  vec3 dir = normalize(uRot * vec3(p*uTanHalf, -1.0));
  float t = uTime*uDrift;
  vec3 q = dir*2.1 + vec3(0.0, t*0.010, t*0.006);
  float w1 = fbm(q + fbm(q*1.7 + 3.1)*1.5);
  float w2 = fbm(dir*3.4 + vec3(4.1, 1.7, 2.3) + w1*1.3);
  vec3 neb = mix(uA, uB, smoothstep(0.30, 0.75, w1));
  neb = mix(neb, uC, smoothstep(0.42, 0.88, w2)*0.95);
  float dens = smoothstep(0.32, 0.80, w1)*0.9 + 0.12;
  vec3 col = uDeep + neb * dens * 1.15;
  vec3 cG = normalize(uGC);
  float rr = acos(clamp(dot(dir, cG), -1.0, 1.0));
  vec3 b1 = normalize(cross(cG, vec3(0.0, 1.0, 0.0)));
  vec3 b2 = cross(cG, b1);
  float ang = atan(dot(dir, b2), dot(dir, b1));
  float arms = 0.5 + 0.5*cos(2.0*ang - 2.6*log(rr + 0.05));
  float disk = exp(-rr*4.2);
  float gal = disk * (0.15 + 0.85*pow(arms, 2.0)) * (0.55 + 0.45*noise(dir*14.0 + 2.0));
  col += mix(uA, uC, 0.35) * gal * 0.8;
  col += vec3(1.0, 0.93, 0.86) * exp(-rr*rr*160.0) * 0.45;
  col += uH * exp(-pow((dir.y + 0.20)*3.6, 2.0)) * 0.42;
  vec3 g = dir*170.0; vec3 id = floor(g); vec3 f = fract(g) - 0.5;
  float s = step(0.990, hash(id)) * exp(-dot(f,f)*95.0) * (0.35 + 0.65*hash(id+3.1));
  col += vec3(0.85, 0.9, 1.0) * s * 1.1;
  col *= uDim * (1.0 - 0.30*dot(p*0.5, p*0.5));
  col = 1.0 - exp(-col*1.15);
  gl_FragColor = vec4(col, 1.0);
}`

export const PLANET_VS = `
varying vec3 vN; varying vec3 vW; varying vec3 vL;
void main(){ vL = position; vN = normalize(mat3(modelMatrix)*normal);
  vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`

export const PLANET_FS = `${NOISE_GLSL}
uniform vec3 uSun, uSunCol, uC1, uC2, uC3, uAtmos, uAtmos2;
uniform float uSeed, uBands, uCraters, uRim, uRimPow;
varying vec3 vN; varying vec3 vW; varying vec3 vL;
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  vec3 L = normalize(uSun);
  vec3 P = normalize(vL);
  float bandN = fbm(vec3(P.y*uBands, uSeed, P.x*0.6 + P.z*0.6));
  float sw = fbm(P*2.6 + uSeed);
  vec3 base = mix(uC1, uC2, smoothstep(0.3, 0.7, bandN + 0.22*sw));
  base = mix(base, uC3, smoothstep(0.66, 0.95, sw)*uCraters);
  float lam = max(dot(n, L), 0.0);
  vec3 col = base * (lam*1.05 + 0.025) * uSunCol;
  float nv = max(dot(n, v), 0.0);
  float rim = pow(1.0 - nv, uRimPow);
  float litSide = smoothstep(-0.35, 0.6, dot(n, L));
  col += mix(uAtmos2, uAtmos, litSide) * rim * uRim;
  col = col / (1.0 + col*0.22);
  gl_FragColor = vec4(col, 1.0);
}`

export const RING_VS = `varying vec2 vXY; void main(){ vXY = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`
export const RING_FS = `${NOISE_GLSL}
uniform vec3 uRA, uRB; uniform float uSeed; varying vec2 vXY;
void main(){
  float r = length(vXY);
  float t = clamp((r - 1.5)/1.1, 0.0, 1.0);
  float g = noise(vec3(r*34.0, uSeed, 0.0));
  float f = noise(vec3(r*150.0, uSeed, 2.0));
  float a = smoothstep(0.25, 0.75, g*0.65 + f*0.45) * smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.82, 1.0, t));
  gl_FragColor = vec4(mix(uRA, uRB, g) * (0.55 + 0.45*f), a*0.85);
}`

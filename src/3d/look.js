// The art direction in one place (redesign 2026-11-09): golden hour against indigo shade.
//  - the sun's compass direction (it rakes across the street instead of sitting at the end of it)
//  - fog that is gold toward the sun and blue-violet away from it, thinner with height (a patch of three's fog
//    chunks, so every lit material in the game gets it without a uniform of its own)
//  - the sky dome shader (a painted gradient carried by the cloud photo, an HDR sun for the glow pass)
//  - the masks that light windows and open shops at dusk
import * as THREE from '../../vendor/three.module.min.js';

export const SUN_AZ = THREE.MathUtils.degToRad(33);          // right of straight down the road (-Z)
const SX = Math.sin(SUN_AZ).toFixed(4), SZ = (-Math.cos(SUN_AZ)).toFixed(4);

// world direction -> the tint the haze takes there (shared by the fog chunk and the sky's horizon)
const HAZE = `
vec3 hazeTint(vec3 d) {
  float s = max(dot(normalize(vec3(d.x, d.y * 0.6, d.z)), normalize(vec3(${SX}, 0.1, ${SZ}))), 0.0);
  float s2 = s * s;
  return mix(vec3(0.50, 0.60, 0.98), vec3(1.30, 1.00, 0.66), s2) + vec3(1.5, 0.85, 0.3) * (s2 * s2 * s2 * s2 * s2 * 0.55);
}`;

let fogDone = false;
export function installFog() {
  if (fogDone) return; fogDone = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogW;\n#endif';
  // the view matrix is a rotation and a move, so its transposed 3x3 turns the view-space position into the
  // world-space vector from the camera to the vertex
  C.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogW = transpose(mat3(viewMatrix)) * mvPosition.xyz;\n#endif';
  C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogW;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
  ${HAZE}
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  float fogLen = max(length(vFogW), 1e-3);
  vec3 fogDir = vFogW / fogLen;
  fogFactor *= 1.0 - 0.5 * clamp((cameraPosition.y + vFogW.y - 2.0) / 38.0, 0.0, 1.0);
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor * hazeTint(fogDir), fogFactor );
#endif`;
}

// ------------------------------------------------------------------ sky dome
export function skyMaterial(map) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map }, uTint: { value: new THREE.Color(1, 1, 1) }, uFog: { value: new THREE.Color(1, 0.6, 0.4) },
      uSun: { value: new THREE.Vector3(0, 0.2, -1) }, uSunCol: { value: new THREE.Color(1, 0.7, 0.4) }, uSunK: { value: 1 }, uWarm: { value: 0 },
    },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; varying vec2 vUv; void main(){ vUv = uv; vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D map; uniform vec3 uTint, uFog, uSun, uSunCol; uniform float uSunK, uWarm; varying vec3 vDir; varying vec2 vUv;
      ${HAZE}
      void main(){
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 tex = texture2D(map, vUv).rgb;
        float lum = dot(tex, vec3(0.3, 0.55, 0.15));
        // painted gradient: gold at the horizon, rose above it, deep indigo overhead; later in the day it burns redder
        vec3 hor = mix(vec3(1.35, 0.80, 0.36), vec3(1.45, 0.55, 0.22), uWarm);
        vec3 mid = mix(vec3(0.86, 0.42, 0.40), vec3(0.80, 0.30, 0.34), uWarm);
        vec3 zen = mix(vec3(0.10, 0.17, 0.46), vec3(0.07, 0.09, 0.32), uWarm);
        vec3 g = mix(hor, mid, smoothstep(0.0, 0.2, h)); g = mix(g, zen, smoothstep(0.1, 0.62, h));
        float s = max(dot(d, uSun), 0.0);
        float side = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
        g *= mix(vec3(0.50, 0.54, 0.70), vec3(1.0), side * 0.75 + 0.25);          // the sky away from the sun is cooler and deeper
        // the photo gives the clouds their shapes; their lit bellies pick up the sun colour
        vec3 col = g * (0.45 + 1.25 * lum) + uSunCol * lum * lum * (0.25 + 0.9 * side) * smoothstep(0.5, 0.0, h);
        // the sun: wide warm bloom, a hot core well above 1.0 for the glow pass
        float s4 = s * s * s * s; float s32 = s4 * s4 * s4 * s4 * s4 * s4 * s4 * s4;
        col += uSunCol * uSunK * (s4 * s4 * 0.55 + s32 * 2.2 + smoothstep(0.99955, 0.99985, s) * 26.0);
        // the horizon melts into the same haze the town fades into
        col = mix(col, uFog * hazeTint(d), smoothstep(0.2, -0.02, d.y) * 0.92);
        gl_FragColor = vec4(col * uTint, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  m.color = m.uniforms.uTint.value;      // mission3 dims the dome through .color
  return m;
}

// ------------------------------------------------------------------ lit windows and shops
// Masks in the atlases' own layout at 1/8 size. R: a window that may be lit (the shader picks which, per window),
// G: an open shop bay (always lit, the interior shows through).
function maskTex(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  const T = 128;
  const R = (tx, ty, th) => ({
    win: (x0, y0, x1, y1, a = 1) => { x.fillStyle = `rgb(${Math.round(255 * a)},0,0)`; x.fillRect(tx + x0 * T, ty + y0 * th, (x1 - x0) * T, (y1 - y0) * th); },
    slats: (x0, y0, x1, y1, a = 0.34) => { x.fillStyle = `rgb(${Math.round(255 * a)},0,0)`; for (let y = ty + y0 * th + 1; y < ty + y1 * th; y += 3) x.fillRect(tx + x0 * T + 1, y, (x1 - x0) * T - 2, 1.4); },
    bay: (x0, y0, x1, y1) => { const g = x.createLinearGradient(0, ty + y0 * th, 0, ty + y1 * th); g.addColorStop(0, 'rgb(0,255,0)'); g.addColorStop(1, 'rgb(0,120,0)'); x.fillStyle = g; x.fillRect(tx + x0 * T, ty + y0 * th, (x1 - x0) * T, (y1 - y0) * th); },
  });
  draw(R);
  const t = new THREE.CanvasTexture(c); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
  return t;
}
export function glowMasks() {
  const facades = maskTex((R) => {
    const a = R(0, 0, 128);       // f_brick_a: glass windows in the left column
    a.win(0.2, 0.18, 0.39, 0.34); a.win(0.2, 0.6, 0.39, 0.75);
    const b = R(128, 0, 128);     // f_brick_b: balcony doors
    for (const [x0, x1] of [[0.22, 0.32], [0.65, 0.75]]) { b.win(x0, 0.12, x1, 0.35, 0.9); b.win(x0, 0.64, x1, 0.87, 0.9); }
    const c = R(0, 128, 128);     // f_brick_c: grilles, light through the slats
    for (const [x0, x1] of [[0.22, 0.38], [0.66, 0.82]]) { c.slats(x0, 0.13, x1, 0.32); c.slats(x0, 0.61, x1, 0.78); }
    const o = R(128, 128, 128);   // f_ochre: shutters
    for (const [x0, x1] of [[0.19, 0.33], [0.69, 0.83]]) { o.slats(x0, 0.1, x1, 0.33); o.slats(x0, 0.59, x1, 0.82); }
  });
  const town = maskTex((R) => {
    const p = R(0, 0, 128);       // f_pale: barred windows
    for (const [x0, x1] of [[0.17, 0.37], [0.64, 0.85]]) { p.win(x0, 0.11, x1, 0.29, 0.85); p.win(x0, 0.61, x1, 0.8, 0.85); }
    const s = R(0, 128, 64);      // shop: three open bays
    s.bay(0.05, 0.3, 0.325, 0.8); s.bay(0.39, 0.3, 0.64, 0.8); s.bay(0.705, 0.3, 0.95, 0.8);
  });
  return { facades, town };
}

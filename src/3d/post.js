// The look pass (redesign 2026-11-09). The scene is drawn into a half-float target without tone mapping; a
// quarter-resolution chain makes the glow (bright pass, two more halvings, back up) and the sun shafts (one radial
// smear of the bright pass away from the sun's place on screen); one full-screen pass then puts it together:
// exposure, filmic curve, split-tone grade (indigo shade, gold light), vignette, a little grain, and the game-feel
// channels (speed streaks, impact flash, hurt tint). Everything but the last pass runs on 1/16 of the pixels or
// fewer. `?post=0` or a device without float colour buffers falls back to the plain renderer path.
import * as THREE from '../../vendor/three.module.min.js';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const pass = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false });

const FS_BRIGHT = `
uniform sampler2D tSrc; uniform vec2 uPx; uniform float uThresh; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv + uPx * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uPx * vec2(1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + uPx * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uPx * vec2(1.0, 1.0)).rgb;
  c *= 0.25; c = min(c, vec3(24.0));
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThresh, 0.0); k = k * k / (k + 0.6);        // soft knee: nothing pops on at the threshold
  gl_FragColor = vec4(c * (k / max(l, 1e-4)), 1.0);
}`;
const FS_DOWN = `
uniform sampler2D tSrc; uniform vec2 uPx; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv + uPx * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uPx * vec2(1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + uPx * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uPx * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c * 0.25, 1.0);
}`;
const FS_UP = `
uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 uPx; uniform float uK; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv + uPx * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uPx * vec2(1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + uPx * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uPx * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c * 0.25 * uK + texture2D(tAdd, vUv).rgb, 1.0);
}`;
// sun shafts: 10 steps from the pixel toward the sun through the bright pass, added to the glow
const FS_RAYS = `
uniform sampler2D tSrc; uniform sampler2D tGlow; uniform vec2 uSun; uniform float uRays; uniform float uAspect; varying vec2 vUv;
void main(){
  vec3 g = texture2D(tGlow, vUv).rgb;
  vec2 d = uSun - vUv; float dist = length(d * vec2(uAspect, 1.0));
  vec2 st = d * (0.72 / 10.0);
  vec3 acc = vec3(0.0); float w = 1.0; vec2 p = vUv;
  for (int i = 0; i < 10; i++) { p += st; acc += texture2D(tSrc, p).rgb * w; w *= 0.88; }
  float fall = 1.0 - smoothstep(0.15, 1.25, dist);
  gl_FragColor = vec4(g + acc * (uRays * 0.16 * fall), 1.0);
}`;
const FS_FINAL = `
uniform sampler2D tScene; uniform sampler2D tGlow; uniform vec2 uPx;
uniform float uExposure, uGlowK, uTime, uSpeed, uFlash, uHurt, uVig, uSat, uNight, uFade;
uniform vec3 uShade, uLight; uniform vec2 uCentre;
varying vec2 vUv;
vec3 film(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  vec3 c = texture2D(tScene, uv).rgb;
  vec2 dc = uv - uCentre; float r2 = dot(dc, dc);
  if (uSpeed > 0.002) {
    // speed: the edges smear toward the centre and the colours part a little; the middle stays sharp
    float a = uSpeed * smoothstep(0.03, 0.34, r2);
    vec2 s = dc * a * 0.085;
    vec3 c1 = texture2D(tScene, uv - s).rgb, c2 = texture2D(tScene, uv - s * 2.0).rgb, c3 = texture2D(tScene, uv - s * 3.0).rgb;
    c = (c + c1 + c2 + c3) * 0.25;
    c.r = mix(c.r, c3.r, 0.6 * a); c.b = mix(c.b, texture2D(tScene, uv + s).b, 0.6 * a);
  }
  c += texture2D(tGlow, uv).rgb * uGlowK;
  c *= uExposure;
  c = film(c);
  // split tone: the shade leans indigo, the light leans gold; then a touch of contrast and saturation
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c *= mix(uShade, uLight, smoothstep(0.04, 0.72, l));
  c = mix(vec3(l), c, uSat);
  c = c * c * (3.0 - 2.0 * c) * 0.38 + c * 0.62;
  // vignette (warm-dark, stronger at speed), impact flash, hurt tint
  float v = smoothstep(0.16, 0.86, r2 * 1.55);
  c *= 1.0 - v * (uVig + 0.22 * uSpeed);
  c = mix(c, vec3(1.0, 0.97, 0.9), uFlash);
  c = mix(c, vec3(0.75, 0.06, 0.03), uHurt * (0.25 + 0.75 * v));
  c *= 1.0 - uFade;
  c = pow(c, vec3(1.0 / 2.2));
  c += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * (0.028 + 0.02 * uNight);
  gl_FragColor = vec4(c, 1.0);
}`;

export class Post {
  static supported(renderer) {
    const gl = renderer.getContext();
    return !!(renderer.capabilities.isWebGL2 !== false && (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')));
  }
  constructor(renderer, o = {}) {
    this.r = renderer;
    this.samples = o.samples ?? 4;
    const rt = (opt = {}) => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, ...opt });
    this.scene = rt({ depthBuffer: true, samples: this.samples });
    this.q = [rt(), rt(), rt()];          // 1/4 bright, 1/8, 1/16
    this.u = [rt(), rt()];                // 1/8 up, 1/4 up (+ shafts)
    this.mBright = pass(FS_BRIGHT, { tSrc: { value: null }, uPx: { value: new THREE.Vector2() }, uThresh: { value: 1.0 } });
    this.mDown = pass(FS_DOWN, { tSrc: { value: null }, uPx: { value: new THREE.Vector2() } });
    this.mUp = pass(FS_UP, { tSrc: { value: null }, tAdd: { value: null }, uPx: { value: new THREE.Vector2() }, uK: { value: 1 } });
    this.mRays = pass(FS_RAYS, { tSrc: { value: null }, tGlow: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.6) }, uRays: { value: 0 }, uAspect: { value: 2 } });
    this.mFinal = pass(FS_FINAL, {
      tScene: { value: null }, tGlow: { value: null }, uPx: { value: new THREE.Vector2() },
      uExposure: { value: 1 }, uGlowK: { value: 0.5 }, uTime: { value: 0 }, uSpeed: { value: 0 }, uFlash: { value: 0 }, uHurt: { value: 0 }, uVig: { value: 0.42 }, uSat: { value: 1.12 }, uNight: { value: 0 }, uFade: { value: 0 },
      uShade: { value: new THREE.Vector3(0.9, 0.96, 1.12) }, uLight: { value: new THREE.Vector3(1.06, 1.0, 0.9) }, uCentre: { value: new THREE.Vector2(0.5, 0.5) },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mFinal); this.quad.frustumCulled = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.look = { exposure: 1.18, glow: 0.5, rays: 1, thresh: 1.12 };
    this.speed = 0; this.flash = 0; this.hurt = 0; this.fade = 0; this.t = 0;
    this._v = new THREE.Vector3(); this._size = new THREE.Vector2();
    this.resize();
  }
  resize() {
    const s = this.r.getDrawingBufferSize(this._size), w = Math.max(8, s.x), h = Math.max(8, s.y);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.scene.setSize(w, h);
    let qw = Math.max(2, Math.round(w / 4)), qh = Math.max(2, Math.round(h / 4));
    this.q[0].setSize(qw, qh); this.u[1].setSize(qw, qh);
    this.q[1].setSize(Math.max(2, qw >> 1), Math.max(2, qh >> 1)); this.u[0].setSize(Math.max(2, qw >> 1), Math.max(2, qh >> 1));
    this.q[2].setSize(Math.max(2, qw >> 2), Math.max(2, qh >> 2));
  }
  blit(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.quad, this.cam); }
  // sunDir: unit vector toward the sun (world). dt drives the decay of the flash and hurt channels.
  render(scene, camera, sunDir, dt = 0.016) {
    const r = this.r;
    this.resize();
    this.t += dt;
    r.setRenderTarget(this.scene); r.render(scene, camera);
    const auto = r.autoClear; r.autoClear = false;
    const st = this.scene.texture, q = this.q, u = this.u, L = this.look;
    // bright pass to 1/4, then 1/8 and 1/16
    this.mBright.uniforms.tSrc.value = st; this.mBright.uniforms.uPx.value.set(1 / this.w, 1 / this.h); this.mBright.uniforms.uThresh.value = L.thresh;
    this.blit(this.mBright, q[0]);
    this.mDown.uniforms.tSrc.value = q[0].texture; this.mDown.uniforms.uPx.value.set(0.5 / q[0].width, 0.5 / q[0].height); this.blit(this.mDown, q[1]);
    this.mDown.uniforms.tSrc.value = q[1].texture; this.mDown.uniforms.uPx.value.set(0.5 / q[1].width, 0.5 / q[1].height); this.blit(this.mDown, q[2]);
    // back up: 1/16 -> 1/8 (+1/8), then the shafts ride on the 1/4 step
    const U = this.mUp.uniforms;
    U.tSrc.value = q[2].texture; U.tAdd.value = q[1].texture; U.uPx.value.set(0.5 / q[2].width, 0.5 / q[2].height); U.uK.value = 1.15; this.blit(this.mUp, u[0]);
    U.tSrc.value = u[0].texture; U.tAdd.value = q[0].texture; U.uPx.value.set(0.5 / u[0].width, 0.5 / u[0].height); U.uK.value = 1.0;
    // where the sun is on screen (it may be off screen or behind: the shafts fade out)
    const v = this._v.copy(sunDir).multiplyScalar(1000).add(camera.position).project(camera);
    const behind = this._v.copy(sunDir).dot(camera.getWorldDirection(this._v2 || (this._v2 = new THREE.Vector3()))) <= 0.05;
    const sx = v.x * 0.5 + 0.5, sy = v.y * 0.5 + 0.5;
    const off = Math.max(0, Math.abs(sx - 0.5) - 0.5, Math.abs(sy - 0.5) - 0.5);
    const rays = behind ? 0 : L.rays * Math.max(0, 1 - off * 1.6);
    let glow = u[1];
    this.blit(this.mUp, u[1]);
    if (rays > 0.01) {
      const R = this.mRays.uniforms; R.tSrc.value = u[1].texture; R.tGlow.value = u[1].texture; R.uSun.value.set(sx, sy); R.uRays.value = rays; R.uAspect.value = this.w / this.h;
      // u[1] is the source, so the shafts land in q[0] (its bright pass is already folded into u[1])
      this.blit(this.mRays, q[0]); glow = q[0];
    }
    const F = this.mFinal.uniforms;
    F.tScene.value = st; F.tGlow.value = glow.texture; F.uPx.value.set(1 / this.w, 1 / this.h);
    F.uExposure.value = L.exposure; F.uGlowK.value = L.glow; F.uTime.value = this.t;
    F.uSpeed.value = this.speed; F.uFlash.value = this.flash; F.uHurt.value = this.hurt; F.uFade.value = this.fade;
    this.blit(this.mFinal, null);
    r.autoClear = auto;
    this.flash = Math.max(0, this.flash - dt * 7); this.hurt = Math.max(0, this.hurt - dt * 2.2);
  }
  dispose() {
    for (const t of [this.scene, ...this.q, ...this.u]) t.dispose();
    for (const m of [this.mBright, this.mDown, this.mUp, this.mRays, this.mFinal]) m.dispose();
    this.quad.geometry.dispose();
  }
}

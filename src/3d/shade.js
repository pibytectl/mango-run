// Character shading helpers. The camera mostly looks west into the sunset, so the hero and the townspeople
// were dark silhouettes (round 2): a character-only fill and a thin silhouette rim light them without
// brightening the town. Works on Lambert and Standard materials.
import * as THREE from '../../vendor/three.module.min.js';

export function patchRimFill(sh, o = {}) {
  const rim = new THREE.Color(o.rim ?? 0xffb27a).multiplyScalar(o.rimK ?? 0.22);
  sh.uniforms.uRim = { value: new THREE.Vector3(rim.r, rim.g, rim.b) };
  sh.uniforms.uFill = { value: o.fill ?? 0.08 };
  // Round 3 (Mzee: "a translucent glowing orange shell"): round 2 added 20-24% of the albedo as flat emission
  // plus a wide fresnel (pow 2.6, up to 0.6) over the whole body, so every grazing facet of the low-poly mesh
  // lit orange. Now: the fill is a soft light from the camera's side (strongest where the surface faces the
  // camera, fading to nothing at the edges, so the form keeps its shading) and the rim is a thin band on the
  // true silhouette only (1 - n.v above ~0.7), weak and less saturated.
  sh.fragmentShader = 'uniform vec3 uRim; uniform float uFill;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    {
      float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      float edge = smoothstep(0.7, 0.95, 1.0 - ndv);
      totalEmissiveRadiance += diffuseColor.rgb * uFill * ndv * ndv + uRim * edge;
    }`);
}

// apply to every mesh material of a model (materials are cloned once per model so others are untouched)
export function rimFillModel(model, o, key = 'rim') {
  model.traverse((m) => {
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const out = mats.map((src) => {
      if (src.userData.rimDone) return src;
      const mat = src.clone(); mat.userData.rimDone = true;
      const prev = src.onBeforeCompile;
      mat.onBeforeCompile = (sh, r) => { if (prev) prev.call(mat, sh, r); patchRimFill(sh, o); };
      mat.customProgramCacheKey = () => key + (src.customProgramCacheKey ? src.customProgramCacheKey() : '');
      return mat;
    });
    m.material = Array.isArray(m.material) ? out : out[0];
  });
}

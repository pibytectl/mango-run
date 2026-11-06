// Character shading helpers (round 2). The camera mostly looks west into the sunset, so the hero and the
// townspeople were dark silhouettes: a character-only fill (a share of the albedo added as emission) and a
// warm rim (fresnel) light them without brightening the town. Works on Lambert and Standard materials.
import * as THREE from '../../vendor/three.module.min.js';

export function patchRimFill(sh, o = {}) {
  const rim = new THREE.Color(o.rim ?? 0xffa060).multiplyScalar(o.rimK ?? 0.5);
  sh.uniforms.uRim = { value: new THREE.Vector3(rim.r, rim.g, rim.b) };
  sh.uniforms.uFill = { value: o.fill ?? 0.2 };
  sh.fragmentShader = 'uniform vec3 uRim; uniform float uFill;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    {
      float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      totalEmissiveRadiance += diffuseColor.rgb * uFill + uRim * pow(1.0 - ndv, 2.6);
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

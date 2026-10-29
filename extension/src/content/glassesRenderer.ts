/**
 * Draws the product cut-out as a curved, perspective-projected mesh with WebGL2.
 * A textured grid (instead of one flat quad) lets the frame front wrap around
 * the face and foreshorten correctly when the head turns or tilts. Mipmapped,
 * premultiplied sampling avoids the jagged, over-sharp "sticker" look that
 * comes from drawing a large studio photo straight onto a soft webcam frame.
 */

export const GRID_COLS = 36;
export const GRID_ROWS = 10;

const VERT = `#version 300 es
in vec3 aPos;
in vec2 aUv;
uniform vec2 uSize;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos.x / uSize.x * 2.0 - 1.0, 1.0 - aPos.y / uSize.y * 2.0, aPos.z, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uGain;
uniform vec3 uTint;
uniform float uBias;
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUv, uBias);
  c.rgb *= uGain * uTint;  // premultiplied: scaling rgb keeps edges clean
  outColor = c;
}`;

// Solid geometry (temple arms, head occluder): position + per-vertex shade.
const SOLID_VERT = `#version 300 es
in vec3 aPos;
in float aShade;
uniform vec2 uSize;
out float vShade;
void main() {
  vShade = aShade;
  gl_Position = vec4(aPos.x / uSize.x * 2.0 - 1.0, 1.0 - aPos.y / uSize.y * 2.0, aPos.z, 1.0);
}`;

const SOLID_FRAG = `#version 300 es
precision highp float;
in float vShade;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  outColor = vec4(uColor * vShade, 1.0);
}`;

// Generated 3D frame: posed on the GPU with the same projection as the mesh
// front (face axes + mild perspective), lit, and coloured from the product
// photo on the front with the frame colour elsewhere.
const MODEL_VERT = `#version 300 es
in vec3 aPos;
in vec3 aNormal;
in vec2 aUv;
in float aPhoto;
uniform vec2 uSize;
uniform vec3 uO, uX, uY, uZ;
uniform float uScale, uForward, uFocal, uDepthScale;
uniform vec2 uOffset;
out vec3 vN;
out vec2 vUv;
out float vPhoto;
void main() {
  vec3 l = aPos * uScale - vec3(0.0, 0.0, uForward);
  vec3 rel = uX * l.x + uY * l.y + uZ * l.z;
  float persp = uFocal / max(uFocal * 0.2, uFocal + rel.z);
  vec2 p = uO.xy + rel.xy * persp + uOffset;
  vN = normalize(uX * aNormal.x + uY * aNormal.y + uZ * aNormal.z);
  vUv = aUv;
  vPhoto = aPhoto;
  gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, clamp(rel.z / uDepthScale, -1.0, 1.0), 1.0);
}`;

const MODEL_FRAG = `#version 300 es
precision highp float;
in vec3 vN;
in vec2 vUv;
in float vPhoto;
uniform sampler2D uTex;
uniform vec3 uFrame;
uniform float uGain;
uniform vec3 uTint;
uniform int uPass; // 0 = opaque parts (writes depth), 1 = translucent lenses
out vec4 outColor;
void main() {
  vec4 t = texture(uTex, vUv, 0.4);
  float inside = step(0.0, vUv.x) * step(vUv.x, 1.0) * step(0.0, vUv.y) * step(vUv.y, 1.0);
  float w = vPhoto * inside;
  // Gaps in the cut-out (no frame pixel there) fall back to the frame colour.
  vec3 photo = t.a > 0.02 ? t.rgb / t.a : uFrame;
  vec3 base = mix(uFrame, photo, w * step(0.02, t.a));
  float alpha = mix(1.0, t.a, w);
  // Screen space: x right, y down, z into the screen; light from upper left front.
  vec3 n = normalize(vN);
  if (n.z > 0.0) n = -n;
  vec3 L = normalize(vec3(-0.4, -0.6, -0.7));
  float diff = max(dot(n, L), 0.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, -1.0));
  float spec = pow(max(dot(n, H), 0.0), 40.0) * 0.35;
  // Photo regions already carry studio lighting: shade them only lightly.
  float lit = mix(0.45 + 0.75 * diff, 0.85 + 0.25 * diff, w);
  vec3 col = (base * lit + spec * (1.0 - 0.6 * w)) * uGain * uTint;
  bool translucent = alpha < 0.97;
  if ((uPass == 0 && translucent) || (uPass == 1 && !translucent)) discard;
  outColor = vec4(col * alpha, alpha);
}`;

export interface ModelPose {
  O: [number, number, number]; X: [number, number, number]; Y: [number, number, number]; Z: [number, number, number];
  scale: number; forward: number; focal: number; depthScale: number; offset: [number, number];
}

export interface Shade { gain: number; tint: [number, number, number] }

/** Extra 3D parts drawn around the textured frame front. */
export interface SceneExtras {
  /** Head stand-in (x, y, depth per vertex, triangles). Writes depth only. */
  occluder: Float32Array;
  /** Temple arms (x, y, depth, shade per vertex, triangles). */
  temples: Float32Array;
  templeColor: [number, number, number];
}

export class GlassesRenderer {
  readonly canvas = document.createElement('canvas');
  private gl: WebGL2RenderingContext | null;
  private prog: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private posBuf: WebGLBuffer | null = null;
  private tex: WebGLTexture | null = null;
  private uSize: WebGLUniformLocation | null = null;
  private uGain: WebGLUniformLocation | null = null;
  private uTint: WebGLUniformLocation | null = null;
  private uBias: WebGLUniformLocation | null = null;
  private indexCount = 0;
  private hasTexture = false;
  private solidProg: WebGLProgram | null = null;
  private solidVao: WebGLVertexArrayObject | null = null;
  private solidBuf: WebGLBuffer | null = null;
  private uSolidSize: WebGLUniformLocation | null = null;
  private uSolidColor: WebGLUniformLocation | null = null;
  private modelProg: WebGLProgram | null = null;
  private modelVao: WebGLVertexArrayObject | null = null;
  private modelCount = 0;
  private mu: Record<string, WebGLUniformLocation | null> = {};

  constructor() {
    this.gl = this.canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: true, depth: true, preserveDrawingBuffer: false,
    });
    if (this.gl) {
      try { this.init(this.gl); } catch (err) {
        console.warn('[Lumen renderer] WebGL init failed, using 2D fallback:', err);
        this.gl = null;
      }
    }
  }

  get ok() { return !!this.gl && !!this.prog; }

  private init(gl: WebGL2RenderingContext) {
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const link = (vs: string, fs: string) => {
      const pr = gl.createProgram()!;
      gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || 'link');
      return pr;
    };

    const solid = link(SOLID_VERT, SOLID_FRAG);
    this.solidProg = solid;
    this.solidVao = gl.createVertexArray();
    gl.bindVertexArray(this.solidVao);
    this.solidBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.solidBuf);
    const sPos = gl.getAttribLocation(solid, 'aPos');
    const sShade = gl.getAttribLocation(solid, 'aShade');
    gl.enableVertexAttribArray(sPos);
    gl.vertexAttribPointer(sPos, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(sShade);
    gl.vertexAttribPointer(sShade, 1, gl.FLOAT, false, 16, 12);
    this.uSolidSize = gl.getUniformLocation(solid, 'uSize');
    this.uSolidColor = gl.getUniformLocation(solid, 'uColor');

    const model = link(MODEL_VERT, MODEL_FRAG);
    this.modelProg = model;
    for (const u of ['uSize', 'uO', 'uX', 'uY', 'uZ', 'uScale', 'uForward', 'uFocal', 'uDepthScale', 'uOffset', 'uTex', 'uFrame', 'uGain', 'uTint', 'uPass']) {
      this.mu[u] = gl.getUniformLocation(model, u);
    }

    const prog = link(VERT, FRAG);
    this.prog = prog;
    gl.useProgram(prog);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    // Static UVs for the grid.
    const uv = new Float32Array((GRID_COLS + 1) * (GRID_ROWS + 1) * 2);
    let k = 0;
    for (let r = 0; r <= GRID_ROWS; r++) {
      for (let c = 0; c <= GRID_COLS; c++) {
        uv[k++] = c / GRID_COLS;
        uv[k++] = r / GRID_ROWS;
      }
    }
    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    const aUv = gl.getAttribLocation(prog, 'aUv');
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

    this.posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uv.length / 2 * 3 * 4, gl.DYNAMIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

    const idx: number[] = [];
    const W = GRID_COLS + 1;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const i = r * W + c;
        idx.push(i, i + 1, i + W, i + 1, i + W + 1, i + W);
      }
    }
    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    this.indexCount = idx.length;

    this.uSize = gl.getUniformLocation(prog, 'uSize');
    this.uGain = gl.getUniformLocation(prog, 'uGain');
    this.uTint = gl.getUniformLocation(prog, 'uTint');
    this.uBias = gl.getUniformLocation(prog, 'uBias');
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);

    this.tex = gl.createTexture();
  }

  /** Upload a prepared 3D frame (static buffers; posed per frame by uniforms). */
  setModel(m: { positions: Float32Array; normals: Float32Array; uvs: Float32Array; photoWeight: Float32Array; indices: Uint32Array } | null) {
    const gl = this.gl;
    if (!gl || !this.modelProg) return;
    if (!m) { this.modelCount = 0; return; }
    if (!this.modelVao) this.modelVao = gl.createVertexArray();
    gl.bindVertexArray(this.modelVao);
    const attr = (name: string, data: Float32Array, size: number) => {
      const loc = gl.getAttribLocation(this.modelProg!, name);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attr('aPos', m.positions, 3);
    attr('aNormal', m.normals, 3);
    attr('aUv', m.uvs, 2);
    attr('aPhoto', m.photoWeight, 1);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.modelCount = m.indices.length;
  }

  get hasModel() { return this.modelCount > 0; }

  setTexture(src: HTMLCanvasElement) {
    const gl = this.gl;
    if (!gl || !this.tex) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) {
      const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
      gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
    }
    this.hasTexture = true;
  }

  /**
   * @param positions (GRID_COLS+1)*(GRID_ROWS+1) vertices as x,y (canvas px), depth (-1..1)
   * @param blur mip LOD bias; ~0.5 softens studio-sharp product photos to webcam softness
   */
  render(width: number, height: number, positions: Float32Array, shade: Shade, blur: number, extras?: SceneExtras, pose?: ModelPose): boolean {
    const gl = this.gl;
    if (!gl || !this.prog || !this.hasTexture) return false;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    if (extras && this.solidProg) {
      gl.useProgram(this.solidProg);
      gl.bindVertexArray(this.solidVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.solidBuf);
      gl.uniform2f(this.uSolidSize, width, height);
      // 1. Head stand-in: depth only, so arms behind the head are hidden.
      const occ = new Float32Array(extras.occluder.length / 3 * 4);
      for (let i = 0, j = 0; i < extras.occluder.length; i += 3, j += 4) {
        occ[j] = extras.occluder[i]; occ[j + 1] = extras.occluder[i + 1]; occ[j + 2] = extras.occluder[i + 2]; occ[j + 3] = 1;
      }
      gl.bufferData(gl.ARRAY_BUFFER, occ, gl.STREAM_DRAW);
      gl.colorMask(false, false, false, false);
      gl.drawArrays(gl.TRIANGLES, 0, occ.length / 4);
      gl.colorMask(true, true, true, true);
      // 2. Temple arms, before the front so they show through tinted lenses
      //    (a generated 3D model brings its own arms).
      if (!(this.modelCount && pose)) {
        gl.bufferData(gl.ARRAY_BUFFER, extras.temples, gl.STREAM_DRAW);
        const c = extras.templeColor;
        gl.uniform3f(this.uSolidColor, c[0] * shade.gain * shade.tint[0], c[1] * shade.gain * shade.tint[1], c[2] * shade.gain * shade.tint[2]);
        gl.drawArrays(gl.TRIANGLES, 0, extras.temples.length / 4);
      }
    }

    if (this.modelCount && pose && this.modelProg) {
      const u = this.mu;
      gl.useProgram(this.modelProg);
      gl.bindVertexArray(this.modelVao);
      gl.uniform2f(u.uSize, width, height);
      gl.uniform3fv(u.uO, pose.O); gl.uniform3fv(u.uX, pose.X); gl.uniform3fv(u.uY, pose.Y); gl.uniform3fv(u.uZ, pose.Z);
      gl.uniform1f(u.uScale, pose.scale); gl.uniform1f(u.uForward, pose.forward);
      gl.uniform1f(u.uFocal, pose.focal); gl.uniform1f(u.uDepthScale, pose.depthScale);
      gl.uniform2f(u.uOffset, pose.offset[0], pose.offset[1]);
      const c = extras?.templeColor ?? [0.08, 0.08, 0.09];
      gl.uniform3f(u.uFrame, c[0], c[1], c[2]);
      gl.uniform1f(u.uGain, shade.gain);
      gl.uniform3f(u.uTint, shade.tint[0], shade.tint[1], shade.tint[2]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(u.uTex, 0);
      gl.uniform1i(u.uPass, 0);
      gl.drawElements(gl.TRIANGLES, this.modelCount, gl.UNSIGNED_INT, 0);
      gl.depthMask(false);
      gl.uniform1i(u.uPass, 1);
      gl.drawElements(gl.TRIANGLES, this.modelCount, gl.UNSIGNED_INT, 0);
      gl.depthMask(true);
      gl.bindVertexArray(null);
      return true;
    }

    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    gl.uniform2f(this.uSize, width, height);
    gl.uniform1f(this.uGain, shade.gain);
    gl.uniform3f(this.uTint, shade.tint[0], shade.tint[1], shade.tint[2]);
    gl.uniform1f(this.uBias, blur);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    return true;
  }
}

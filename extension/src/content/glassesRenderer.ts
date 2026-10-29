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

export interface Shade { gain: number; tint: [number, number, number] }

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
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
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
  render(width: number, height: number, positions: Float32Array, shade: Shade, blur: number): boolean {
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

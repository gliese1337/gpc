//import { B64 } from './wasm.base64';
declare const B64: string;

const compiled = new WebAssembly.Module(Buffer.from(B64, 'base64'));
const exports = new WebAssembly.Instance(compiled, {}).exports;

//const memory: { buffer: ArrayBuffer } = exports.memory;

type ptr = number;
/*
const alloc_contours: (n: number) => ptr = exports.alloc_contours;
const read_contour_sizes: (arr: ptr) => ptr = exports.read_contour_sizes;
const init_polygon: (contours: ptr, holes: ptr) => ptr = exports.init_polygon;
const init_polygon_with_holes: (contours: ptr, holes: ptr) => ptr = exports.init_polygon_with_holes;
const get_contours: (poly: ptr) => ptr = exports.get_contours;
const get_holes: (poly: ptr) => ptr = exports.get_holes;
*/
const poly_add: (a: ptr, b: ptr) => ptr = exports.poly_add;
const poly_int: (a: ptr, b: ptr) => ptr = exports.poly_int;
const poly_xor: (a: ptr, b: ptr) => ptr = exports.poly_xor;
const poly_dif: (a: ptr, b: ptr) => ptr = exports.poly_dif;

const stage: (poly: ptr) => void = exports.stage;
const reset: () => void = exports.reset;

const poly_add_many: () => ptr = exports.poly_add_many;
const poly_int_many: () => ptr = exports.poly_int_many;
const poly_xor_many: () => ptr = exports.poly_xor_many;
const poly_dif_many: () => ptr = exports.poly_dif_many;

//const release: (p: ptr) => void = exports.release;

export class Polygon {
  private constructor(public pointer: ptr) { }

  private static n_ary(op: () => ptr, ...p: Polygon[]): Polygon | null {
    for (const { pointer } of p) {
      stage(pointer);
    }
  
    const ptr = op();
    reset();
    return ptr ? new Polygon(ptr) : null;
  }

  public static intersection(...p: Polygon[]): Polygon | null {
    if (p.length === 2) return new Polygon(poly_int(p[0].pointer, p[1].pointer));
    return Polygon.n_ary(poly_int_many, ...p);
  }
  
  public intersection(...p: Polygon[]): Polygon | null {
    return Polygon.intersection(this, ...p);
  }

  public static union(...p: Polygon[]): Polygon | null {
    if (p.length === 2) return new Polygon(poly_add(p[0].pointer, p[1].pointer));
    return Polygon.n_ary(poly_add_many, ...p);
  }

  public union(...p: Polygon[]): Polygon | null {
    return Polygon.union(this, ...p);
  }

  public static xor(...p: Polygon[]): Polygon | null {
    if (p.length === 2) return new Polygon(poly_xor(p[0].pointer, p[1].pointer));
    return Polygon.n_ary(poly_xor_many, ...p);
  }

  public xor(...p: Polygon[]): Polygon | null {
    return Polygon.xor(this, ...p);
  }

  public static difference(...p: Polygon[]): Polygon | null {
    if (p.length === 2) return new Polygon(poly_dif(p[0].pointer, p[1].pointer));
    return Polygon.n_ary(poly_dif_many, ...p);
  }

  public difference(...p: Polygon[]): Polygon | null {
    return Polygon.difference(this, ...p);
  }

  /*
  public static fromPoints(points: ExternalVertex[]): Polygon {
    return new SimplePolygon(points.map((p) => Array.isArray(p) ? { x: p[0]||0, y: p[1]||0 } : p));
  }

  public static fromVertices({ bounds, holes }: { bounds: ExternalVertex[][], holes: ExternalVertex[][] }): Polygon {
    return Polygon.n_ary(OperationType.ADD, ...bounds.map(Polygon.fromPoints))
        .difference(...holes.map(Polygon.fromPoints));
  }*/
}
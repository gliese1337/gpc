import "allocator/tlsf";
import "collector/itcm";
import { clip } from './gpc';
import { Polygon } from './polygon';
import { ADD, INT, XOR, DIF } from './constants';

@global
let shared_polies: Set<Polygon> = new Set();

@global
let shared_contour_sizes: Set<u32[]> = new Set();

@global
let shared_contours: Set<f64[][]> = new Set();

@global
let shared_bools: Set<bool[]> = new Set();

@global
let staged_polies: Polygon[] = [];

export function alloc_contours(n: u32): u32[] {
    let arr = new Array<u32>(n);
    shared_contour_sizes.add(arr);

    return arr;
}

export function read_contour_sizes(arr: u32[]): bool[] {
    shared_contour_sizes.delete(arr);
    let contours = changetype<f64[][]>(arr);
    shared_contours.add(contours);
    
    let n = arr.length;
    for (let i = 0; i < n; i++) {
        contours[i] = new Array<f64>(2 * arr[i]);
    }

    let holes = new Array<bool>(n);
    shared_bools.add(holes);
    return holes;
}

export function init_polygon(contours: f64[][], holes: bool[]): Polygon {
    shared_contours.delete(contours);
    shared_bools.delete(holes);

    let p = new Polygon(contours, holes);
    shared_polies.add(p);
    return p;
}

function union(n: u32, contours: f64[][], holes: bool[], sign: bool): Polygon | null {
    let i: u32 = 0; // find first non-hole contour
    while (holes[i] !== sign && i < n) i++;
    if (i === n) return null;
    let c1 = new Array<f64[]>(1);
    let c2 = new Array<f64[]>(1);
    let h1 = new Array<bool>(1);
    let h2 = new Array<bool>(1);
    
    c1[0] = contours[i];
    let p1 = new Polygon(c1, h1);
    let p2 = new Polygon(c2, h2);
    for (i++; i < n; i++) {
        if (holes[i] !== sign) continue;
        c2[0] = contours[i];
        p1 = clip(ADD, p1, p2);
    }

    return p1;
}

export function init_polygon_with_holes(contours: f64[][], holes: bool[]): Polygon {
    let n: u32 = contours.length;
    if (n !== holes.length) throw new Error("Mismatched arrays");
    if (n < 2) return new Polygon(contours, holes);

    let boundary = union(n, contours, holes, false);
    let hole = union(n, contours, holes, true);
    
    if (hole === null) return boundary as Polygon;
    if (boundary === null) return hole as Polygon;

    let diff = clip(DIF, boundary as Polygon, hole as Polygon);
    gc.collect();

    shared_polies.add(diff);
    return diff;
}

export function get_contours(p: Polygon): f64[][] {
    return p.contours;
}

export function get_holes(p: Polygon): bool[] {
    return p.contributing;
}

export function poly_add(a: Polygon, b: Polygon): Polygon {
    return clip(ADD, a, b);
}

export function poly_int(a: Polygon, b: Polygon): Polygon {
    return clip(INT, a, b);
}

export function poly_xor(a: Polygon, b: Polygon): Polygon {
    return clip(XOR, a, b);
}

export function poly_dif(a: Polygon, b: Polygon): Polygon {
    return clip(DIF, a, b);
}

export function stage(p: Polygon): void {
    staged_polies.push(p);
}

export function reset(): void {
    staged_polies.length = 0;
}

function poly_many(op: u32): Polygon | null {
    let n = staged_polies.length;
    if (n === 0) return null;
    
    let p = staged_polies[0];
    for (let i = 1; i < n; i++) p = clip(op, p, staged_polies[i]);

    shared_polies.add(p);
    gc.collect();
    return p;
}

export function poly_add_many(): Polygon | null {
    return poly_many(ADD);
}

export function poly_int_many(): Polygon | null {
    return poly_many(INT);
}

export function poly_xor_many(): Polygon | null {
    return poly_many(XOR);
}

export function poly_dif_many(): Polygon | null {
    let n = staged_polies.length;
    if (n === 0) return null;
    
    let p = staged_polies[0];
    if (n === 1) return p;

    let sum = staged_polies[1];
    for (let i = 2; i < n; i++) sum = clip(ADD, sum, staged_polies[i]);

    p = clip(DIF, p, sum);
    shared_polies.add(p);
    gc.collect();
    return p;
}

export function release(p: Polygon): void {
    shared_polies.delete(p);
    gc.collect();
}
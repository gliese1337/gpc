import "allocator/tlsf";
import "collector/itcm";
import { clip } from './gpc';
import { Polygon } from './polygon';
import { ADD, INT, XOR, DIF } from './constants';

/** GLOBAL SETS **/
/**
 * These data structures are used to retain gc
 * references to memory that is being utilized
 * by JS, so that it is not freed in between
 * external calls to WASM functions.
 */

@global
let shared_polies: Set<Polygon> = new Set();

@global
let shared_contours: Set<f64[][]> = new Set();

@global
let shared_bools: Set<bool[]> = new Set();

@global
let staged_polies: Polygon[] = [];

/**
 * Allocate space for the array of contours.
 * This will initially be used to collect contour
 * sizes, but the same storage can be re-purposed
 * to store pointers to contours instead.
 */
export function alloc_contours(n: u32): u32[] {
    let arr = new Array<u32>(n);
    shared_contours.add(changetype<f64[][]>(arr));

    return arr;
}

/**
 * Read contour sizes written into memory by the JS
 * wrapper, and replace them with pointers to the
 * newly-allocated contour arrays. Additionally,
 * allocate storage for the hole / contributing
 * flags, and return a pointer in case the client
 * wants to write hole flags for validation.
 */
export function read_contour_sizes(arr: u32[]): bool[] {
    let contours = changetype<f64[][]>(arr);
    
    let n = arr.length;
    for (let i = 0; i < n; i++) {
        contours[i] = new Array<f64>(2 * arr[i]);
    }

    let holes = new Array<bool>(n);
    shared_bools.add(holes);
    return holes;
}

/**
 * Allocate a new Polygon wrapper with the previously-
 * reserved contour and contributing flag arrays via
 * pointers recovered from the JS wrapper.
 */
export function init_polygon(contours: f64[][], holes: bool[]): Polygon {
    shared_contours.delete(contours);
    shared_bools.delete(holes);

    let p = new Polygon(contours, holes);
    shared_polies.add(p);
    return p;
}

/**
 * init_polygon_with_holes(contours: f64[][], holes: bool[]): Polygon
 * 
 * Initialize a new complex polygon, treating the initial contours
 * passed in by the client as independent simple polygons to be
 * unioned and differenced together, as directed by the hole flags.
 */

/**
 * Global single-element contour and hole / contribution
 * arrays that can be re-used in multiple initialization
 * operations help reduce allocation pressure.
 */

@global
let c1 = new Array<f64[]>(1);
@global
let h1 = new Array<bool>(1);

@global
let c2 = new Array<f64[]>(1);
@global
let h2 = new Array<bool>(1);
@global
let p2 = new Polygon(c2, h2);

/** Union all contours of the same sign, so we can then perform a single DIF operation. */
function union(n: u32, contours: f64[][], holes: bool[], sign: bool): Polygon | null {
    let i: u32 = 0; // find first non-hole contour
    while (holes[i] !== sign && i < n) i++;
    if (i === n) return null;
    
    let p1 = new Polygon(c1, h1);

    c1[0] = contours[i];
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

/** UTILITY FUNCTIONS **/
export function is_empty(p: Polygon): bool {
    return p.isEmpty;
}

export function get_contours(p: Polygon): f64[][] {
    return p.contours as f64[][];
}

export function get_holes(p: Polygon): bool[] {
    return p.contributing as bool[];
}

/** BINARY OPERATIONS **/

@inline
function gc_clip(op: u32, subject: Polygon, clipper: Polygon): Polygon {
    let p = clip(op, subject, clipper);
    gc.collect();
    return p;
}

export function poly_add(a: Polygon, b: Polygon): Polygon {
    return gc_clip(ADD, a, b);
}

export function poly_int(a: Polygon, b: Polygon): Polygon {
    return gc_clip(INT, a, b);
}

export function poly_xor(a: Polygon, b: Polygon): Polygon {
    return gc_clip(XOR, a, b);
}

export function poly_dif(a: Polygon, b: Polygon): Polygon {
    return gc_clip(DIF, a, b);
}


/** N-ARY OPERATIONS **/

export function stage(p: Polygon): void {
    staged_polies.push(p);
}

export function reset(): void {
    staged_polies.length = 0;
}

/**
 * We trust that the JS wrapper will never call
 * these functions unless staged_polies.length
 * is at least 3, so we can skip validation.
 */

function poly_many(op: u32): Polygon | null {
    let n = staged_polies.length;
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
    let p = staged_polies[0];
    let sum = staged_polies[1];
    for (let i = 2; i < n; i++) sum = clip(ADD, sum, staged_polies[i]);

    p = clip(DIF, p, sum);
    shared_polies.add(p);
    gc.collect();

    return p;
}

// TODO: Perhaps we can manually free just the polygon data
// Alternately, look into sharing contours such that we cannot,
// in fact, blindly free polygon data....
export function release(p: Polygon): void {
    shared_polies.delete(p);
    gc.collect();
}
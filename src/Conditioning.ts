import { polygonArea, Vertex } from "./util";

function findBottomLeft(points: Vertex[]) {
    const n = points.length;
    let { x: px, y: py } = points[0];
    let min = 0;
    for (let i = 1; i < n; i++) {
        const { x, y } = points[i];
        if ((y < py) || ((py == y) && (x < px))) {
            py = y;
            px = x;
            min = i;
        }
    }
    return min;
}

function rotate(idx: number, points: Vertex[]) {
    const r = points.slice(idx);
    for (let i = 0; i < idx; i++) {
        r.push(points[i]);
    }
    return r;
}

export function rotateBottomLeft(points: Vertex[]) {
    const idx = findBottomLeft(points);
    if (idx === 0) { return points; }
    return rotate(idx, points);
}

export function forceWinding(dir: 1 | -1, points: Vertex[]) {
    const a = dir * polygonArea(points);
    if (a >= 0) { return dir * a; }
    const n = points.length;
    for (let i = 1, j = n - 1; i < j; i++, j--) {
        const t = points[i];
        points[i] = points[j];
        points[j] = t;
    }
    return dir * Math.abs(a);
}

const TWO_PI = 2 * Math.PI;

export function isConvex(points: Vertex[]): boolean {
    const n = points.length;
    if (n < 3) { return true; }
    let { x: ox, y: oy } = points[n-2];
    let { x: nx, y: ny } = points[n-1];
    let odir = 0;
    let ndir = Math.atan2(ny - oy, nx - ox);
    let angle_sum = 0;
    let orientation = 0;
    for (let i = 0; i < n; i++) {
        const p = points[i];
        ox = nx;
        oy = ny;
        odir = ndir;
        nx = p.x;
        ny = p.y;
        ndir = Math.atan2(ny - oy, nx - ox);
        let angle = ndir - odir;
        // shift to the half-open interval (-Pi, Pi]
        if (angle <= -Math.PI) { angle += TWO_PI; }  
        else if (angle > Math.PI) { angle -= TWO_PI; }
        if (orientation === 0) {
            orientation = angle;
        } else if (orientation * angle < 0) {
            return false;
        }
        angle_sum += angle;
    }
    // Check that the total number of full turns is plus-or-minus 1
    return Math.abs(Math.round(angle_sum / TWO_PI)) === 1;
}
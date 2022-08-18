import { Vertex, EPSILON } from "./util";

// tests if a point is Left|On|Right of an infinite line.
//    Input:  three points P0, P1, and P2
//    Return: >0 for P2 left of the line through P0 and P1
//            =0 for P2  on the line
//            <0 for P2  right of the line
function testLine(P0: Vertex, P1: Vertex, P2: Vertex) {
    const res = (P1.x - P0.x) * (P2.y - P0.y) - (P2.x -  P0.x) * (P1.y - P0.y);
    if (Math.abs(res) < EPSILON) { return 0; }
    return Math.sign(res);
}

export enum Position {
    INSIDE = 1,
    OUTSIDE = -1,
    BOUNDARY = 0,
}

// Dan Sunday's winding number algorithm
export function wn_poly(P: Vertex, V: Vertex[]): Position {
    let wn = 0; // the  winding number counter
    const n = V.length - 1;

    // loop through all edges of the polygon
    for (let i = 0; i < n; i++) {   // edge from V[i] to  V[i+1]
        if (V[i].y <= P.y) {        // start y <= P.y
            if (V[i+1].y  > P.y) {  // an upward crossing
                const t = testLine( V[i], V[i+1], P);
                if (t === 0) { return Position.BOUNDARY; }
                if (t > 0) {  // P left of  edge
                    ++wn;     // have a valid up intersect
                }
            }
        }
        else {                        // start y > P.y (no test needed)
            if (V[i+1].y  <= P.y) {   // a downward crossing
                const t = testLine( V[i], V[i+1], P);
                if (t === 0) { return Position.BOUNDARY; }
                if (t < 0) { // P right of  edge
                    --wn;    // have a valid down intersect
                }
            }
        }
    }

    return wn === 0 ? Position.OUTSIDE : Position.INSIDE;
}
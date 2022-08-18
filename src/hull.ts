import { Vertex } from "./util";

// Graham Scan Convex Hull Algorithm
// This is destructive
export function convexHull(points: Vertex[]) {
    const n = points.length;
    if (n <= 3) return points;
    
    // Assume the first point is bottom-left-most
    const { x: px, y: py } = points[0];

    // Sort by angle
    points.sort((a, b) => {
        const c = (a.y - py)*(b.x - px) - (a.x - px)*(b.y - py);
        return c === 0 ? a.x - b.x : c;
    });

    // Keep points in the result if they "turn left"
    let len = 1;
    for (let i = 1; i < n; i++) {
        let b = points[len-1];
        let c = points[i];
        //if (b.x === c.x && b.y === c.y) { continue; }
        if (len >= 2) {
            let a = points[len-2];
            while ((b.x-a.x) * (c.y-a.y) <= (b.y-a.y) * (c.x-a.x)) {
                len--;
                if (len < 2) { break; }
                b = a;
                a = points[len-2];
            }
        }
        points[len++] = c;
    }
    points.length = len;
    return points;
}

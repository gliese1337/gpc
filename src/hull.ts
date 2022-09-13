import { Vertex } from "./util";

function ccw(a: Vertex, b: Vertex, c: Vertex) {
    return (b.y - a.y)*(c.x - a.x) - (b.x - a.x)*(c.y - a.y);
}

// Graham scan. Assumes a simple polygon.
export function polygonHull(points: Vertex[]) {
    const n = points.length;

    // There can never be fewer than 4 vertices.
    // Assume the first point is bottom-left-most
    const p0 = points[0];

    let top = 1;
    for (let i = 2; i < n; i++) {
        // Duplicate points are pre-filtered
        // if (points[top].x === points[i].x && points[top].y === points[i].y) { continue; }
        points[++top] = points[i];
        while (top >= 2 && ccw(points[top-2], points[top-1], points[top]) >= 0) {
            points[top - 1] = points[top]; // delete internal point
            top--;
        }
    }

    // Fix up the join between the tail and start
    while (ccw(points[top-1], points[top], p0) >= 0) { top--; }

    points.length = top + 1; 
    return points;
}

export function convexHull(points: Vertex[]) {
    // Assume the first point is bottom-left-most and sort by angle
    const p0 = points[0];
    points.sort((a, b) => ccw(p0, a, b) || a.x - b.x );
    return polygonHull(points);
}

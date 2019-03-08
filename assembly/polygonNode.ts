import { Vertex } from './vertex';
import { Polygon } from './polygon';

class VertexNode extends Vertex {
    constructor(x: f64, y: f64, public next: VertexNode | null = null) {
        super(x, y);
    }
}

export class PolygonNode {
    public active: bool = true;               /* Active flag / vertex count        */
    public hole: bool = false;                /* Hole / external contour flag      */
    public left: VertexNode;                  /* Pointer to left vertex list       */
    public right: VertexNode;                 /* Pointer to right vertex list      */
    public next: PolygonNode | null;          /* Pointer to next polygon contour   */
    public proxy: PolygonNode;                /* Pointer to actual structure used  */
    public vertexCount: u32 = 0;

    constructor(next: PolygonNode | null, x: f64, y: f64) {
        let vn = new VertexNode(x, y);
        this.left = vn;
        this.right = vn;

        this.next = next;
        this.proxy = this;
    }

    public addRight(x: f64, y: f64): void {
        let nv = new VertexNode(x, y);

        /* Add vertex nv to the right end of the polygon's vertex list */
        this.proxy.right.next = nv;
        this.proxy.right = nv;
    }

    public addLeft(x: f64, y: f64): void {
        /* Add vertex nv to the left end of the polygon's vertex list */
        this.proxy.left = new VertexNode(x, y, this.proxy.left);
    }
}

export class TopPolygonNode {
    public top: PolygonNode | null = null;

    public addLocalMin(x: f64, y: f64): PolygonNode {
        let n = new PolygonNode(this.top, x, y);
        this.top = n;

        return n;
    }

    public mergeLeft(p: PolygonNode, q: PolygonNode): void {
        /* Label contour as a hole */
        q.proxy.hole = true;

        if (p.proxy !== q.proxy) {
            /* Assign p's vertex list to the left end of q's list */
            p.proxy.right.next = q.proxy.left;
            q.proxy.left = p.proxy.left;

            /* Redirect any p.proxy references to q.proxy */
            let target = p.proxy;
            for (let node = this.top; node !== null; node = node.next) {
                if (node.proxy === target) {
                    node.active = false;
                    node.proxy = q.proxy;
                }
            }
        }
    }

    public mergeRight(p: PolygonNode, q: PolygonNode): void {
        /* Label contour as external */
        q.proxy.hole = false;

        if (p.proxy !== q.proxy) {
            /* Assign p's vertex list to the right end of q's list */
            q.proxy.right.next = p.proxy.left;
            q.proxy.right = p.proxy.right;

            /* Redirect any p->proxy references to q->proxy */
            let target = p.proxy;
            for (let node = this.top; node !== null; node = node.next) {
                if (node.proxy === target) {
                    node.active = false;
                    node.proxy = q.proxy;
                }
            }
        }
    }

    private getContours(): PolygonNode[] {
        let np = 0;
        for (let polygon = this.top; polygon !== null; polygon = polygon.next) {
            if (!polygon.active) {
                continue;
            }

            /* Count the vertices in the current contour */
            let nv = 0;
            for (let vtx: VertexNode | null = polygon.proxy.left; vtx !== null; vtx = vtx.next) {
                nv++;
            }

            polygon.vertexCount = nv;
            if (nv > 2) np++;

            polygon.active = false;
        }

        let contours: PolygonNode[] = new Array(np);
        for (let polygon = this.top; polygon !== null; polygon = polygon.next) {
            if (!polygon.active || polygon.vertexCount < 3) {
                continue;
            }

            contours[--np] = polygon as PolygonNode;
        }

        return contours;
    }

    public getResult(): Polygon {
        let contours = this.getContours();
        let clen = contours.length;
        if (clen === 0) {
            return new Polygon([], []);
        }

        let polies: f64[][] = new Array(clen);
        let isHole: bool[] = new Array(clen);

        for (let i = 0; i < clen; i++) {
            let polyNode = contours[i];
            let vertices: f64[] = new Array(2*polyNode.vertexCount);
            let j = 0;
            for (let vtx: VertexNode | null = polyNode.proxy.left; vtx !== null; vtx = vtx.next) {
                vertices[j++] = vtx.x;
                vertices[j++] = vtx.y;
            }

            polies[i] = vertices;
            isHole[i] = polyNode.proxy.hole; 
        }

        return new Polygon(polies, isHole);
    }
}
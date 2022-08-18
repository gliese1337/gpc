import { rotateBottomLeft } from "./Conditioning";
import { CompoundType, SimpleType, Vertex, VertexNode, vert_eql } from "./util";

export class PolygonNode {
    public active: boolean = true;               /* Active flag / vertex count        */
    public hole: boolean = false;                /* Hole / external contour flag      */
    public left: VertexNode;                     /* Pointer to left vertex list       */
    public right: VertexNode;                    /* Pointer to right vertex list      */
    public next: PolygonNode | null;             /* Pointer to next polygon contour   */
    public proxy: PolygonNode;                   /* Pointer to actual structure used  */

    constructor(next: PolygonNode | null, x: number, y: number) {
        const vn = new VertexNode(x, y);
        this.left = vn;
        this.right = vn;

        this.next = next;
        this.proxy = this;
    }

    public addRight(x: number, y: number): void {
        const nv = new VertexNode(x, y);

        /* Add vertex nv to the right end of the polygon's vertex list */
        this.proxy.right.next = nv;
        this.proxy.right = nv;
    }

    public addLeft(x: number, y: number): void {
        /* Add vertex nv to the left end of the polygon's vertex list */
        this.proxy.left = new VertexNode(x, y, this.proxy.left);
    }
}

export class TopPolygonNode<T,U> {
    public top: PolygonNode | null = null;

    constructor(private Simple: SimpleType<T>, private Compound: CompoundType<T,U>) { }

    public addLocalMin(x: number, y: number): PolygonNode {
        const n = new PolygonNode(this.top, x, y);
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
            const target = p.proxy;
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
            const target = p.proxy;
            for (let node = this.top; node !== null; node = node.next) {
                if (node.proxy === target) {
                    node.active = false;
                    node.proxy = q.proxy;
                }
            }
        }
    }

    private getContours(): PolygonNode[] {
        const contours: PolygonNode[] = [];

        outer: for (let polygon = this.top; polygon !== null; polygon = polygon.next) {
            if (!polygon.active) {
                continue;
            }

            /* Count the vertices in the current contour */
            let nv = 0;
            for (let vtx: VertexNode | null = polygon.proxy.left; vtx !== null; vtx = vtx.next) {
                if ((++nv) > 2) {
                    contours.push(polygon);
                    continue outer;
                }
            }

            polygon.active = false;
        }

        return contours;
    }

    public getResult(): T | U {
        const contours = this.getContours();
        if (contours.length === 0) {
            return new this.Simple([], false);
        }

        const innerPolies = contours.flatMap((polyNode) => {
            const polys: T[] = [];
            const isHole = polyNode.proxy.hole;
            let vertices: Vertex[] = [];
            for (let vtx: VertexNode | null = polyNode.proxy.left; vtx !== null; vtx = vtx.next) {
                //if (vtx.next && vert_eql(vtx, vtx.next)) { continue; }
                for (let i = vertices.length - 1; i >= 0; i--) {
                    if (vert_eql(vertices[i], vtx)) {
                        polys.push(new this.Simple(rotateBottomLeft(vertices.slice(i)), isHole));
                        vertices.length = i;
                    }
                }
                vertices.push({ x: vtx.x, y: vtx.y });
            }

            polys.push(new this.Simple(rotateBottomLeft(vertices), isHole));
            return polys; 
        });

        return (innerPolies.length === 1) ? innerPolies[0] : new this.Compound(innerPolies);
    }
}
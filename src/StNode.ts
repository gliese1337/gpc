import { AetTree } from "./AetTree";
import { EdgeNode } from "./EdgeNode";
import { BundleState, CLIP, EPSILON, SUBJ, Vertex } from "./util";

export class StNode {
    public edge: EdgeNode;       /* Pointer to AET edge               */
    public xb: number;           /* Scanbeam bottom x coordinate      */
    public xt: number;           /* Scanbeam top x coordinate         */
    public dx: number;           /* Change in x for a unit y increase */
    public prev: StNode | null;  /* Previous edge in sorted list      */

    constructor(edge: EdgeNode, prev: StNode | null) {
        this.edge = edge;
        this.xb = edge.xb;
        this.xt = edge.xt;
        this.dx = edge.dx;
        this.prev = prev;
    }
}

class ItNode {

    public ie: [EdgeNode, EdgeNode]; /* Intersecting edge (bundle) pair   */
    public point: Vertex;            /* Point of intersection             */
    public next: ItNode | null;      /* The next intersection table node  */

    constructor(edge0: EdgeNode, edge1: EdgeNode, x: number, y: number, next: ItNode | null) {
        this.ie = [edge0, edge1];
        this.point = { x, y };
        this.next = next;
    }
}

export class ItNodeTable {
    public top: ItNode | null = null;

    public buildIntersectionTable(aet: AetTree, dy: number): void {
        let st: StNode | null = null;

        /* Process each AET edge */
        for (let edge = aet.top; edge !== null; edge = edge.next) {
            if ((edge.bstate.above === BundleState.BUNDLE_HEAD) ||
                (edge.bundle.above[CLIP] !== 0) ||
                (edge.bundle.above[SUBJ] !== 0)) {
                st = addSTEdge(st, this, edge, dy);
            }
        }
    }
}

function addIntersection(
    itNode: ItNode | null,
    edge0: EdgeNode,
    edge1: EdgeNode,
    x: number,
    y: number,
): ItNode {
    if (itNode === null || itNode.point.y > y) {
        /* Append a new node to the tail (itNode === null) or mid-list */
        return new ItNode(edge0, edge1, x, y, itNode);
    }
    
    /* Head further down the list */
    itNode.next = addIntersection(itNode.next, edge0, edge1, x, y);

    return itNode;
}

export function addSTEdge(st: StNode | null, it: ItNodeTable, edge: EdgeNode, dy: number): StNode {
    if (st === null) {
        /* Append edge onto the tail end of the ST */
        return new StNode(edge, null);
    }

    const den = (st.xt - st.xb) - (edge.xt - edge.xb);

    /* If new edge and ST edge don't cross */
    if ((edge.xt >= st.xt) || (edge.dx === st.dx) || (Math.abs(den) <= EPSILON)) {
        /* No intersection - insert edge here (before the ST edge) */
        return new StNode(edge, st);
    }

    /* Compute intersection between new edge and ST edge */
    const r = (edge.xb - st.xb) / den;
    const x = st.xb + r * (st.xt - st.xb);
    const y = r * dy;

    /* Insert the edge pointers and the intersection point in the IT */
    it.top = addIntersection(it.top, st.edge, edge, x, y);

    /* Head further into the ST */
    st.prev = addSTEdge(st.prev, it, edge, dy);

    return st;
}
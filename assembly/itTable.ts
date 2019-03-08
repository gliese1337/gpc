import { EdgeNode, BUNDLE_HEAD } from './edgeNode';
import { Vertex } from './vertex';
import { AetTree } from './aet';
import { getVertexType } from './vertexType';
import { SUBJ, CLIP, DIF, INT, XOR, ADD, EPSILON } from './constants';

class ItNode {

    public ie: EdgeNode[]; /* Intersecting edge (bundle) pair   */
    public point: Vertex;            /* Point of intersection             */
    public next: ItNode | null;      /* The next intersection table node  */

    constructor(edge0: EdgeNode, edge1: EdgeNode, x: f64, y: f64, next: ItNode | null) {
        this.ie = [edge0, edge1];
        this.point = new Vertex(x, y);
        this.next = next;
    }
}

function addIntersection(
    itNode: ItNode | null,
    edge0: EdgeNode,
    edge1: EdgeNode,
    x: f64,
    y: f64,
): ItNode {
    if (itNode === null || itNode.point.y > y) {
        /* Append a new node to the tail (itNode === null) or mid-list */
        return new ItNode(edge0, edge1, x, y, itNode);
    }
    
    /* Head further down the list */
    itNode.next = addIntersection(itNode.next, edge0, edge1, x, y);

    return itNode as ItNode;
}

function addSTEdge(st: StNode | null, it: ItNodeTable, edge: EdgeNode, dy: f64): StNode {
    if (st === null) {
        /* Append edge onto the tail end of the ST */
        return new StNode(edge, null);
    }

    let den = (st.xt - st.xb) - (edge.xt - edge.xb);

    /* If new edge and ST edge don't cross */
    if ((edge.xt >= st.xt) || (edge.dx === st.dx) || (Math.abs(den) <= EPSILON)) {
        /* No intersection - insert edge here (before the ST edge) */
        return new StNode(edge, st);
    }

    /* Compute intersection between new edge and ST edge */
    let r = (edge.xb - st.xb) / den;
    let x = st.xb + r * (st.xt - st.xb);
    let y = r * dy;

    /* Insert the edge pointers and the intersection point in the IT */
    it.top = addIntersection(it.top, st.edge, edge, x, y);

    /* Head further into the ST */
    st.prev = addSTEdge(st.prev, it, edge, dy);

    return st as StNode;
}

class StNode {
    public edge: EdgeNode;      /* Pointer to AET edge               */
    public xb: f64;             /* Scanbeam bottom x coordinate      */
    public xt: f64;             /* Scanbeam top x coordinate         */
    public dx: f64;             /* Change in x for a unit y increase */
    public prev: StNode | null; /* Previous edge in sorted list      */

    constructor(edge: EdgeNode, prev: StNode | null) {
        this.edge = edge;
        this.xb = edge.xb;
        this.xt = edge.xt;
        this.dx = edge.dx;
        this.prev = prev;
    }
}

export class ItNodeTable {
    public top: ItNode | null = null;

    constructor(aet: AetTree, dy: f64) {
        let st: StNode | null = null;

        /* Process each AET edge */
        for (let edge = aet.top; edge !== null; edge = edge.next) {
            if ((edge.bstate.above === BUNDLE_HEAD) ||
                (edge.bundle.above[CLIP] !== 0) ||
                (edge.bundle.above[SUBJ] !== 0)) {
                st = addSTEdge(st, this, edge as EdgeNode, dy);
            }
        }
    }

    public analyzeIntersection(op: u32, e0: EdgeNode, e1: EdgeNode): u32 {
        let inClip = (((e0.bundle.above[CLIP] !== 0) && (e0.bside.clip === 0)) ||
            ((e1.bundle.above[CLIP] !== 0) && (e1.bside.clip !== 0)) ||
            ((e0.bundle.above[CLIP] === 0) && (e1.bundle.above[CLIP] === 0) &&
            ((e0.bside.clip & e1.bside.clip) === 1))) ? 1 : 0;

        let inSubj = (((e0.bundle.above[SUBJ] !== 0) && (e0.bside.subj === 0)) ||
            ((e1.bundle.above[SUBJ] !== 0) && (e1.bside.subj !== 0)) ||
            ((e0.bundle.above[SUBJ] === 0) && (e1.bundle.above[SUBJ] === 0) &&
            ((e0.bside.subj & e1.bside.subj) === 1))) ? 1 : 0;

        let tr = 0;
        let tl = 0;
        let br = 0;
        let bl = 0;

        /* Determine quadrant occupancies */
        if ((op === DIF) || (op === INT)) {
            tr = inClip & inSubj;
            tl = (inClip ^ e1.bundle.above[CLIP]) & (inSubj ^ e1.bundle.above[SUBJ]);
            br = (inClip ^ e0.bundle.above[CLIP]) & (inSubj ^ e0.bundle.above[SUBJ]);
            bl = (inClip ^ e1.bundle.above[CLIP] ^ e0.bundle.above[CLIP]) & (inSubj ^ e1.bundle.above[SUBJ] ^ e0.bundle.above[SUBJ]);
        } else if (op === XOR) {
            tr = inClip ^ inSubj;
            tl = (inClip ^ e1.bundle.above[CLIP]) ^ (inSubj ^ e1.bundle.above[SUBJ]);
            br = (inClip ^ e0.bundle.above[CLIP]) ^ (inSubj ^ e0.bundle.above[SUBJ]);
            bl = (inClip ^ e1.bundle.above[CLIP] ^ e0.bundle.above[CLIP])
                ^ (inSubj ^ e1.bundle.above[SUBJ] ^ e0.bundle.above[SUBJ]);
        } else if (op === ADD) {
            tr = inClip | inSubj;
            tl = (inClip ^ e1.bundle.above[CLIP]) | (inSubj ^ e1.bundle.above[SUBJ]);
            br = (inClip ^ e0.bundle.above[CLIP]) | (inSubj ^ e0.bundle.above[SUBJ]);
            bl = (inClip ^ e1.bundle.above[CLIP] ^ e0.bundle.above[CLIP]) | (inSubj ^ e1.bundle.above[SUBJ] ^ e0.bundle.above[SUBJ]);
        }

        return getVertexType(tr, tl, br, bl);
    }
}

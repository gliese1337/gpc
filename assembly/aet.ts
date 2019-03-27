import { EdgeNode, UNBUNDLED, BUNDLE_HEAD, BUNDLE_TAIL } from './edgeNode';
import { SUBJ, CLIP, EPSILON } from './constants';

function EQ(a: f64, b: f64): bool {
    return Math.abs(a - b) <= EPSILON;
}

export class AetTree {
    public top: EdgeNode | null = null;

    public createBundles(yb: f64): EdgeNode {
        let e0 = this.top;

        //if (e0 === null) throw new Error("Encountered Unexpected Null Edge");

        /* Set up bundle fields of first edge */
        e0.bundle.above[e0.type] = (e0.top.y !== yb) ? 1 : 0;
        e0.bundle.above[1 - e0.type] = 0;
        e0.bstate_above = UNBUNDLED;

        for (let nextEdge = e0.next; nextEdge !== null; nextEdge = nextEdge.next) {
            let nextType = nextEdge.type;
            let nextTypeOpposite = 1 - nextType;

            /* Set up bundle fields of next edge */
            nextEdge.bundle.above[nextType] = (nextEdge.top.y !== yb) ? 1 : 0;
            nextEdge.bundle.above[nextTypeOpposite] = 0;
            nextEdge.bstate_above = UNBUNDLED;

            /* Bundle edges above the scanbeam boundary if they coincide */
            if (nextEdge.bundle.above[nextType] === 1) {
                if (EQ(e0.xb, nextEdge.xb) && EQ(e0.dx, nextEdge.dx) && (e0.top.y !== yb)) {
                    nextEdge.bundle.above[nextType] ^= e0.bundle.above[nextType];
                    nextEdge.bundle.above[nextTypeOpposite] = e0.bundle.above[nextTypeOpposite];
                    nextEdge.bstate_above = BUNDLE_HEAD;
                    e0.bundle.above[CLIP] = 0;
                    e0.bundle.above[SUBJ] = 0;
                    e0.bstate_above = BUNDLE_TAIL;
                }

                e0 = nextEdge;
            }
        }

        return e0 as EdgeNode;
    }

    public prune(yt: f64, yb: f64): void {
        /* Delete terminating edges from the AET, otherwise compute xt */
        for (let edge: EdgeNode | null = this.top; edge !== null; edge = edge.next) {
            if (edge.top.y === yb) {
                let prev = edge.prev;
                let next = edge.next;

                if (prev === null) {
                    this.top = next;
                } else {
                    prev.next = next;
                }

                if (next !== null) {
                    next.prev = prev;
                }

                /* Copy bundle head state to the adjacent tail edge if required */
                if ((edge.bstate_below === BUNDLE_HEAD) && (prev !== null)) {
                    if (prev.bstate_below === BUNDLE_TAIL) {
                        prev.outp_below = edge.outp_below;
                        prev.bstate_below = UNBUNDLED;
                        if (prev.prev !== null) {
                            if (prev.prev.bstate_below === BUNDLE_TAIL) {
                                prev.bstate_below = BUNDLE_HEAD;
                            }
                        }
                    }
                }
            } else {
                edge.xt = edge.top.y === yt ?
                    edge.top.x : (edge.bot.x + edge.dx * (yt - edge.bot.y));
            }
        }        
    }

    public addEdge(edge: EdgeNode): void {
        if (this.top === null) {
            /* Append edge onto the tail end of the AET */
            this.top = edge;
            edge.prev = null;
            edge.next = null;
    
            return;
        }
    
        let prevEdge: EdgeNode | null = null;
        let currentEdge = this.top;
        while (true) {
            /* Do primary sort on the xb field, and secondary sort on the dx field. */
            if (edge.xb < currentEdge.xb || (edge.xb === currentEdge.xb && edge.dx < currentEdge.dx)) {
                /* Insert edge here (before the AET edge) */
                edge.prev = prevEdge;
                edge.next = currentEdge;
                currentEdge.prev = edge;
                if (prevEdge === null) {
                    this.top = edge;
                } else {
                    prevEdge.next = edge;
                }
    
                return;
            }
    
            /* Head further into the AET */
            prevEdge = currentEdge;
            if (currentEdge.next === null) {
                currentEdge.next = edge;
                edge.prev = currentEdge;
                edge.next = null;
    
                return;
            } else {
                currentEdge = currentEdge.next;
            }
        }
    }
    
    public swapBundles(e0: EdgeNode, e1: EdgeNode): void {
        /* Swap bundle sides in response to edge crossing */
        if (e0.bundle.above[CLIP] !== 0) {
            e1.bside_clip = 1 - e1.bside_clip;
        }
        if (e1.bundle.above[CLIP] !== 0) {
            e0.bside_clip = 1 - e0.bside_clip;
        }
        if (e0.bundle.above[SUBJ] !== 0) {
            e1.bside_subj = 1 - e1.bside_subj;
        }
        if (e1.bundle.above[SUBJ] !== 0) {
            e0.bside_subj = 1 - e0.bside_subj;
        }

        /* Swap e0 and e1 bundles in the AET */
        let prev = e0.prev;
        let next = e1.next;
        if (next !== null) {
            next.prev = e0;
        }

        if (e0.bstate_above === BUNDLE_HEAD) {
            while (prev !== null && prev.bstate_above === BUNDLE_TAIL) {
                prev = prev.prev;
            }
        }

        //if (this.top === null) throw new Error("Encountered Unexpected Null Edge");

        if (prev === null) {
            this.top.prev = e1;
            e1.next = this.top;
            this.top = e0.next;
        } else {
            //if (prev.next === null) throw new Error("Encountered Unexpected Null Edge");
            prev.next.prev = e1;
            e1.next = prev.next;
            prev.next = e0.next;
        }

        
        //if (e0.next === null) throw new Error("Encountered Unexpected Null Edge");
        e0.next.prev = prev;
        e1.next.prev = e1;
        e0.next = next;
    }

    public prepare(yt: f64): void {
        /* Prepare for next scanbeam */
        for (let edge = this.top; edge !== null; edge = edge.next) {
            let next = edge.next;
            let succ = edge.succ;
            if ((edge.top.y === yt) && (succ !== null)) {
                /* Replace AET edge by its successor */
                succ.outp_below = edge.outp_above;
                succ.bstate_below = edge.bstate_above;
                succ.bundle.below[CLIP] = edge.bundle.above[CLIP];
                succ.bundle.below[SUBJ] = edge.bundle.above[SUBJ];

                let prev = edge.prev;
                if (prev !== null) {
                    prev.next = succ;
                } else {
                    this.top = succ;
                }

                if (next !== null) {
                    next.prev = succ;
                }

                succ.prev = prev;
                succ.next = next;

            } else {
                /* Update this edge */
                edge.outp_below = edge.outp_above;
                edge.bstate_below = edge.bstate_above;
                edge.bundle.below[CLIP] = edge.bundle.above[CLIP];
                edge.bundle.below[SUBJ] = edge.bundle.above[SUBJ];
                edge.xb = edge.xt;
            }

            edge.outp_above = null;
        }
    }
}
class Vertex {
    constructor(public x: number, public y: number) { }

    public equals(obj: Vertex): boolean {
        if (this === obj) { return true; }
        if (obj === null || obj === void 0) { return false; }

        return this.x === obj.x && this.y === obj.y;
    }
}

const EPSILON = 2.2204460492503131e-16;
const LEFT = 0;
const RIGHT = 1;
const CLIP = 0;
const SUBJ = 1;

const isContributing: unique symbol = Symbol();
const setContributing: unique symbol = Symbol();

enum OperationType {
    DIF, INT, XOR, ADD,
}

function clip(op: OperationType, subject: Polygon, clipper: Polygon): Polygon {
    const sEmpty = subject.isEmpty;
    const cEmpty = clipper.isEmpty;

    /* Test for trivial cases */
    if (cEmpty) {
        return op === OperationType.INT ? clipper : subject;
    }

    if (sEmpty) {
        switch(op) {
            case OperationType.INT: case OperationType.DIF: return subject;
            case OperationType.ADD: case OperationType.XOR: return clipper;
        }
    }

    /* Identify potentialy contributing contours */
    if ((op === OperationType.INT || op === OperationType.DIF) && !(sEmpty || cEmpty)) {
        miniMaxTest(subject, clipper, op);
    }

    /* Build LMT */
    const lmtTable = new LmtTable();
    const sbte = new ScanBeamTreeEntries();

    if (!sEmpty) {
        buildLmt(lmtTable, sbte, subject, SUBJ, op);
    }

    if (!cEmpty) {
        buildLmt(lmtTable, sbte, clipper, CLIP, op);
    }

    /* Return a NULL result if no contours contribute */
    if (lmtTable.top === null) {
        return new SimplePolygon([]);
    }

    const parity: { clip: 0 | 1, subj: 0 | 1 } = {
        /* Invert clip polygon for difference operation */
        clip: op === OperationType.DIF ? RIGHT : LEFT,
        subj: LEFT,
    };

    /* Build scanbeam table from scanbeam tree */
    const sbt = sbte.buildSBT();

    /* Used to create resulting Polygon */
    const outPoly = new TopPolygonNode();

    const aet = new AetTree();

    let scanbeam = 0;
    let localMin: LmtNode | null = lmtTable.top;

    /* Process each scanbeam */
    while (scanbeam < sbt.length) {
        /* Set yb and yt to the bottom and top of the scanbeam */
        const yb = sbt[scanbeam++];
        let yt = 0;
        let dy = 0;
        if (scanbeam < sbt.length) {
            yt = sbt[scanbeam];
            dy = yt - yb;
        }

        /* === SCANBEAM BOUNDARY PROCESSING ================================ */

        /* If LMT node corresponding to yb exists */
        if (localMin !== null) {
            if (localMin.y === yb) {
                /* Add edges starting at this local minimum to the AET */
                for (let edge = localMin.firstBound; edge !== null; edge = edge.nextBound) {
                    aet.addEdge(edge);
                }

                localMin = localMin.next;
            }
        }

        if (aet.top === null) throw new Error("Encountered Unexpected Null Edge");

        /* Create bundles within AET */
        let e0 = aet.top;
        let e1 = aet.top;

        /* Set up bundle fields of first edge */
        aet.top.bundle.above[aet.top.type] = (aet.top.top.y !== yb) ? 1 : 0;
        aet.top.bundle.above[1 - aet.top.type] = 0;
        aet.top.bstate.above = BundleState.UNBUNDLED;

        for (let nextEdge = aet.top.next; nextEdge !== null; nextEdge = nextEdge.next) {
            const nextType = nextEdge.type;
            const nextTypeOpposite = 1 - nextType;

            /* Set up bundle fields of next edge */
            nextEdge.bundle.above[nextType] = (nextEdge.top.y !== yb) ? 1 : 0;
            nextEdge.bundle.above[nextTypeOpposite] = 0;
            nextEdge.bstate.above = BundleState.UNBUNDLED;

            /* Bundle edges above the scanbeam boundary if they coincide */
            if (nextEdge.bundle.above[nextType] === 1) {
                if (EQ(e0.xb, nextEdge.xb) && EQ(e0.dx, nextEdge.dx) && (e0.top.y !== yb)) {
                    nextEdge.bundle.above[nextType] ^= e0.bundle.above[nextType];
                    nextEdge.bundle.above[nextTypeOpposite] = e0.bundle.above[nextTypeOpposite];
                    nextEdge.bstate.above = BundleState.BUNDLE_HEAD;
                    e0.bundle.above[CLIP] = 0;
                    e0.bundle.above[SUBJ] = 0;
                    e0.bstate.above = BundleState.BUNDLE_TAIL;
                }

                e0 = nextEdge;
            }
        }

        const horiz = { clip: HState.NH, subj: HState.NH };
        const exists = { clip: 0, subj: 0 };

        /* Set dummy previous x value */
        let px = -Number.MAX_VALUE;
        let cf: PolygonNode | null = null;

        /* Process each edge at this scanbeam boundary */
        for (let edge: EdgeNode | null = aet.top; edge !== null; edge = edge.next) {
            exists.clip = edge.bundle.above[CLIP] + (edge.bundle.below[CLIP] << 1);
            exists.subj = edge.bundle.above[SUBJ] + (edge.bundle.below[SUBJ] << 1);

            if ((exists.clip | exists.subj) === 0) {
                continue;
            }

            /* Set bundle side */
            edge.bside.clip = parity.clip;
            edge.bside.subj = parity.subj;

            let contributing = false;
            let br = 0;
            let bl = 0;
            let tr = 0;
            let tl = 0;

            /* Determine contributing status and quadrant occupancies */
            if ((op === OperationType.DIF) || (op === OperationType.INT)) {
                contributing = ((exists.clip !== 0) && ((parity.subj !== 0) || (horiz.subj !== 0))) ||
                    ((exists.subj !== 0) && ((parity.clip !== 0) || (horiz.clip !== 0))) ||
                    ((exists.clip !== 0) && (exists.subj !== 0) && (parity.clip === parity.subj));

                br = parity.clip & parity.subj;
                bl = (parity.clip ^ edge.bundle.above[CLIP]) & (parity.subj ^ edge.bundle.above[SUBJ]);
                tr = (parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0)) & (parity.subj ^ (horiz.subj !== HState.NH ? 1 : 0));
                tl = (parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0) ^ edge.bundle.below[CLIP]) &
                    (parity.subj ^ (horiz.subj !== HState.NH ? 1 : 0) ^ edge.bundle.below[SUBJ]);
            } else if (op === OperationType.XOR) {
                contributing = (exists.clip !== 0) || (exists.subj !== 0);

                br = parity.clip ^ parity.subj;
                bl = (parity.clip ^ edge.bundle.above[CLIP]) ^ (parity.subj ^ edge.bundle.above[SUBJ]);
                tr = parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0) ^ parity.subj ^ (horiz.subj !== HState.NH ? 1 : 0);
                tl = parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0) ^ edge.bundle.below[CLIP]
                    ^ parity.subj ^ (horiz.subj !== HState.NH ? 1 : 0) ^ edge.bundle.below[SUBJ];
            } else if (op === OperationType.ADD) {
                contributing = ((exists.clip !== 0) && (!(parity.subj !== 0) || (horiz.subj !== 0))) ||
                    ((exists.subj !== 0) && (!(parity.clip !== 0) || (horiz.clip !== 0))) ||
                    ((exists.clip !== 0) && (exists.subj !== 0) && (parity.clip === parity.subj));

                br = parity.clip | parity.subj;
                bl = (parity.clip ^ edge.bundle.above[CLIP]) | (parity.subj ^ edge.bundle.above[SUBJ]);
                tr = (parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0)) | (parity.subj ^ ((horiz.subj !== HState.NH) ? 1 : 0));
                tl = (parity.clip ^ (horiz.clip !== HState.NH ? 1 : 0) ^ edge.bundle.below[CLIP]) |
                    (parity.subj ^ (horiz.subj !== HState.NH ? 1 : 0) ^ edge.bundle.below[SUBJ]);
            }

            /* Update parity */
            parity.clip ^= edge.bundle.above[CLIP];
            parity.subj ^= edge.bundle.above[SUBJ];

            /* Update horizontal state */
            if (exists.clip !== 0) {
                horiz.clip = HState.nextState[horiz.clip][((exists.clip - 1) << 1) + parity.clip];
            }
            if (exists.subj !== 0) {
                horiz.subj = HState.nextState[horiz.subj][((exists.subj - 1) << 1) + parity.subj];
            }

            if (!contributing) {
                continue;
            }

            const { xb } = edge;

            switch (getVertexType(tr, tl, br, bl)) {
                case VertexType.EMN:
                case VertexType.IMN:
                    cf = outPoly.addLocalMin(xb, yb);
                    px = xb;
                    edge.outp.above = cf;
                    break;
                case VertexType.ERI:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addRight(xb, yb);
                        px = xb;
                    }
                    edge.outp.above = cf;
                    cf = null;
                    break;
                case VertexType.ELI:
                    cf = edge.outp.below;
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    cf.addLeft(xb, yb);
                    px = xb;
                    break;
                case VertexType.EMX:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addLeft(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeRight(cf, edge.outp.below);
                    cf = null;
                    break;
                case VertexType.ILI:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addLeft(xb, yb);
                        px = xb;
                    }
                    edge.outp.above = cf;
                    cf = null;
                    break;
                case VertexType.IRI:
                    cf = edge.outp.below;
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    cf.addRight(xb, yb);
                    px = xb;
                    edge.outp.below = null;
                    break;
                case VertexType.IMX:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addRight(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeLeft(cf, edge.outp.below);
                    cf = null;
                    edge.outp.below = null;
                    break;
                case VertexType.IMM:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addRight(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeLeft(cf, edge.outp.below);
                    edge.outp.below = null;
                    cf = outPoly.addLocalMin(xb, yb);
                    edge.outp.above = cf;
                    break;
                case VertexType.EMM:
                    if (cf === null) throw new Error("Unexpected Null Polygon");
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (xb !== px) {
                        cf.addLeft(xb, yb);
                        px = xb;
                    }
                    outPoly.mergeRight(cf, edge.outp.below);
                    edge.outp.below = null;
                    cf = outPoly.addLocalMin(xb, yb);
                    edge.outp.above = cf;
                    break;
                case VertexType.LED:
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (edge.bot.y === yb) {
                        edge.outp.below.addLeft(xb, yb);
                    }
                    edge.outp.above = edge.outp.below;
                    px = xb;
                    break;
                case VertexType.RED:
                    if (edge.outp.below === null) throw new Error("Unexpected Null Polygon");
                    if (edge.bot.y === yb) {
                        edge.outp.below.addRight(xb, yb);
                    }
                    edge.outp.above = edge.outp.below;
                    px = xb;
                    break;
                default:
            }
        }

        /* Delete terminating edges from the AET, otherwise compute xt */
        for (let edge: EdgeNode | null = aet.top; edge !== null; edge = edge.next) {
            if (edge.top.y === yb) {
                const { prev, next } = edge;

                if (prev === null) {
                    aet.top = next;
                } else {
                    prev.next = next;
                }

                if (next !== null) {
                    next.prev = prev;
                }

                /* Copy bundle head state to the adjacent tail edge if required */
                if ((edge.bstate.below === BundleState.BUNDLE_HEAD) && (prev !== null)) {
                    if (prev.bstate.below === BundleState.BUNDLE_TAIL) {
                        prev.outp.below = edge.outp.below;
                        prev.bstate.below = BundleState.UNBUNDLED;
                        if (prev.prev !== null) {
                            if (prev.prev.bstate.below === BundleState.BUNDLE_TAIL) {
                                prev.bstate.below = BundleState.BUNDLE_HEAD;
                            }
                        }
                    }
                }
            } else {
                edge.xt = edge.top.y === yt ?
                    edge.top.x : (edge.bot.x + edge.dx * (yt - edge.bot.y));
            }
        }

        if (scanbeam >= sbte.sbtEntries) {
            continue;
        }

        /* === SCANBEAM INTERIOR PROCESSING ============================== */

        /* Build intersection table for the current scanbeam */
        const itTable = new ItNodeTable();
        itTable.buildIntersectionTable(aet, dy);

        /* Process each node in the intersection table */
        for (let intersect = itTable.top; intersect !== null; intersect = intersect.next) {

            [e0, e1] = intersect.ie;

            /* Only generate output for contributing intersections */
            if (((e0.bundle.above[CLIP] !== 0) || (e0.bundle.above[SUBJ] !== 0)) &&
                ((e1.bundle.above[CLIP] !== 0) || (e1.bundle.above[SUBJ] !== 0))) {
                const p = e0.outp.above;
                const q = e1.outp.above;
                const ix = intersect.point.x;
                const iy = intersect.point.y + yb;

                const inClip = (((e0.bundle.above[CLIP] !== 0) && (e0.bside.clip === 0)) ||
                    ((e1.bundle.above[CLIP] !== 0) && (e1.bside.clip !== 0)) ||
                    ((e0.bundle.above[CLIP] === 0) && (e1.bundle.above[CLIP] === 0) &&
                    ((e0.bside.clip & e1.bside.clip) === 1))) ? 1 : 0;

                const inSubj = (((e0.bundle.above[SUBJ] !== 0) && (e0.bside.subj === 0)) ||
                    ((e1.bundle.above[SUBJ] !== 0) && (e1.bside.subj !== 0)) ||
                    ((e0.bundle.above[SUBJ] === 0) && (e1.bundle.above[SUBJ] === 0) &&
                    ((e0.bside.subj & e1.bside.subj) === 1))) ? 1 : 0;

                let tr = 0;
                let tl = 0;
                let br = 0;
                let bl = 0;

                /* Determine quadrant occupancies */
                if ((op === OperationType.DIF) || (op === OperationType.INT)) {
                    tr = inClip & inSubj;
                    tl = (inClip ^ e1.bundle.above[CLIP]) & (inSubj ^ e1.bundle.above[SUBJ]);
                    br = (inClip ^ e0.bundle.above[CLIP]) & (inSubj ^ e0.bundle.above[SUBJ]);
                    bl = (inClip ^ e1.bundle.above[CLIP] ^ e0.bundle.above[CLIP]) & (inSubj ^ e1.bundle.above[SUBJ] ^ e0.bundle.above[SUBJ]);
                } else if (op === OperationType.XOR) {
                    tr = inClip ^ inSubj;
                    tl = (inClip ^ e1.bundle.above[CLIP]) ^ (inSubj ^ e1.bundle.above[SUBJ]);
                    br = (inClip ^ e0.bundle.above[CLIP]) ^ (inSubj ^ e0.bundle.above[SUBJ]);
                    bl = (inClip ^ e1.bundle.above[CLIP] ^ e0.bundle.above[CLIP])
                        ^ (inSubj ^ e1.bundle.above[SUBJ] ^ e0.bundle.above[SUBJ]);
                } else if (op === OperationType.ADD) {
                    tr = inClip | inSubj;
                    tl = (inClip ^ e1.bundle.above[CLIP]) | (inSubj ^ e1.bundle.above[SUBJ]);
                    br = (inClip ^ e0.bundle.above[CLIP]) | (inSubj ^ e0.bundle.above[SUBJ]);
                    bl = (inClip ^ e1.bundle.above[CLIP] ^ e0.bundle.above[CLIP]) | (inSubj ^ e1.bundle.above[SUBJ] ^ e0.bundle.above[SUBJ]);
                }

                switch (getVertexType(tr, tl, br, bl)) {
                    case VertexType.EMN:
                        e0.outp.above = outPoly.addLocalMin(ix, iy);
                        e1.outp.above = e0.outp.above;
                        break;
                    case VertexType.ERI:
                        if (p !== null) {
                            p.addRight(ix, iy);
                            e1.outp.above = p;
                            e0.outp.above = null;
                        }
                        break;
                    case VertexType.ELI:
                        if (q !== null) {
                            q.addLeft(ix, iy);
                            e0.outp.above = q;
                            e1.outp.above = null;
                        }
                        break;
                    case VertexType.EMX:
                        if ((p !== null) && (q !== null)) {
                            p.addLeft(ix, iy);
                            outPoly.mergeRight(p, q);
                            e0.outp.above = null;
                            e1.outp.above = null;
                        }
                        break;
                    case VertexType.IMN:
                        e0.outp.above = outPoly.addLocalMin(ix, iy);
                        e1.outp.above = e0.outp.above;
                        break;
                    case VertexType.ILI:
                        if (p !== null) {
                            p.addLeft(ix, iy);
                            e1.outp.above = p;
                            e0.outp.above = null;
                        }
                        break;
                    case VertexType.IRI:
                        if (q !== null) {
                            q.addRight(ix, iy);
                            e0.outp.above = q;
                            e1.outp.above = null;
                        }
                        break;
                    case VertexType.IMX:
                        if ((p !== null) && (q !== null)) {
                            p.addRight(ix, iy);
                            outPoly.mergeLeft(p, q);
                            e0.outp.above = null;
                            e1.outp.above = null;
                        }
                        break;
                    case VertexType.IMM:
                        if ((p !== null) && (q !== null)) {
                            p.addRight(ix, iy);
                            outPoly.mergeLeft(p, q);
                            e0.outp.above = outPoly.addLocalMin(ix, iy);
                            e1.outp.above = e0.outp.above;
                        }
                        break;
                    case VertexType.EMM:
                        if ((p !== null) && (q !== null)) {
                            p.addLeft(ix, iy);
                            outPoly.mergeRight(p, q);
                            e0.outp.above = outPoly.addLocalMin(ix, iy);
                            e1.outp.above = e0.outp.above;
                        }
                        break;
                    default:
                }
            }

            /* Swap bundle sides in response to edge crossing */
            if (e0.bundle.above[CLIP] !== 0) {
                e1.bside.clip = 1 - e1.bside.clip as 0 | 1;
            }
            if (e1.bundle.above[CLIP] !== 0) {
                e0.bside.clip = 1 - e0.bside.clip as 0 | 1;
            }
            if (e0.bundle.above[SUBJ] !== 0) {
                e1.bside.subj = 1 - e1.bside.subj as 0 | 1;
            }
            if (e1.bundle.above[SUBJ] !== 0) {
                e0.bside.subj = 1 - e0.bside.subj as 0 | 1;
            }

            /* Swap e0 and e1 bundles in the AET */
            let { prev } = e0;
            const { next } = e1;
            if (next !== null) {
                next.prev = e0;
            }

            if (e0.bstate.above === BundleState.BUNDLE_HEAD) {
                while (prev !== null && prev.bstate.above === BundleState.BUNDLE_TAIL) {
                    prev = prev.prev;
                }
            }

            if (aet.top === null) throw new Error("Encountered Unexpected Null Edge");

            if (prev === null) {
                aet.top.prev = e1;
                e1.next = aet.top;
                aet.top = e0.next;
            } else {
                if (prev.next === null) throw new Error("Encountered Unexpected Null Edge");
                prev.next.prev = e1;
                e1.next = prev.next;
                prev.next = e0.next;
            }

            
            if (e0.next === null) throw new Error("Encountered Unexpected Null Edge");
            e0.next.prev = prev;
            e1.next.prev = e1;
            e0.next = next;
        }

        /* Prepare for next scanbeam */
        for (let edge = aet.top; edge !== null; edge = edge.next) {
            const { next, succ } = edge;
            if ((edge.top.y === yt) && (succ !== null)) {
                /* Replace AET edge by its successor */
                succ.outp.below = edge.outp.above;
                succ.bstate.below = edge.bstate.above;
                succ.bundle.below[CLIP] = edge.bundle.above[CLIP];
                succ.bundle.below[SUBJ] = edge.bundle.above[SUBJ];

                const { prev } = edge;
                if (prev !== null) {
                    prev.next = succ;
                } else {
                    aet.top = succ;
                }

                if (next !== null) {
                    next.prev = succ;
                }

                succ.prev = prev;
                succ.next = next;

            } else {
                /* Update this edge */
                edge.outp.below = edge.outp.above;
                edge.bstate.below = edge.bstate.above;
                edge.bundle.below[CLIP] = edge.bundle.above[CLIP];
                edge.bundle.below[SUBJ] = edge.bundle.above[SUBJ];
                edge.xb = edge.xt;
            }

            edge.outp.above = null;
        }
    }

    return outPoly.getResult();
}

function EQ(a: number, b: number): boolean {
    return (Math.abs(a - b) <= EPSILON);
}

function PREV_INDEX(i: number, n: number): number {
    return ((i - 1 + n) % n);
}

function NEXT_INDEX(i: number, n: number): number {
    return ((i + 1) % n);
}

function OPTIMAL(p: Polygon, i: number): boolean {
    const { y: yi } = p.get(i);
    const numPoints = p.getNumPoints();

    return (p.get(PREV_INDEX(i, numPoints)).y !== yi) ||
        (p.get(NEXT_INDEX(i, numPoints)).y !== yi);
}

function miniMaxTest(subject: Polygon, clipper: Polygon, op: OperationType): void {
    const sBBoxes = subject.getInnerPolies().map((ip) => ip.bounds);
    const cBBoxes = clipper.getInnerPolies().map((ip) => ip.bounds);

    /* Check all subject contour bounding boxes against clip boxes */
    const oTable = cBBoxes.map((c) =>
        sBBoxes.map((s) =>
            !((s.maxx < c.minx) || (s.minx > c.maxx)) &&
            !((s.maxy < c.miny) || (s.miny > c.maxy)),
        ),
    );

    /* For each clip contour, search for any subject contour overlaps */
    const clipNumPoly = cBBoxes.length;
    for (let c = 0; c < clipNumPoly; c++) {
        const overlap = oTable[c].every((s) => s);
        if (!overlap) {
            clipper[setContributing](c, false); // Flag non contributing status
        }
    }

    if (op === OperationType.INT) {
        /* For each subject contour, search for any clip contour overlaps */
        const subjNumPoly = sBBoxes.length;
        for (let s = 0; s < subjNumPoly; s++) {
            const overlap = oTable.every((c) => c[s]);
            if (!overlap) {
                subject[setContributing](s, false); // Flag non contributing status
            }
        }
    }
}

function boundList(lmtTable: LmtTable, y: number): LmtNode {
    if (lmtTable.top === null) {
        lmtTable.top = new LmtNode(y);

        return lmtTable.top;
    }

    let prev: LmtNode | null = null;
    let node = lmtTable.top;
    while (true) {
        if (y > node.y) {
            /* Head further up the LMT */
            if (node.next === null) {
                node.next = new LmtNode(y);

                return node.next;
            } else {
                [prev, node] = [node, node.next];
            }
        } else {
            if (y < node.y) {
                /* Insert a new LMT node before the current node */
                node = new LmtNode(y, node);
                if (prev === null) {
                    lmtTable.top = node;
                } else {
                    prev.next = node;
                }
            }
            /* Use this existing LMT node */
            return node;
        }
    }
}

function insertBound(lmtNode: LmtNode, e: EdgeNode): void {
    if (lmtNode.firstBound === null) {
        /* Link node e to the tail of the list */
        lmtNode.firstBound = e;

        return;
    }

    let prevBound: EdgeNode | null = null;
    let currentBound = lmtNode.firstBound;
    while (true) {
        /* Do primary sort on the x field and secondary sort on the dx field. */
        if (e.bot.x < currentBound.bot.x || (e.bot.x === currentBound.bot.x && e.dx < currentBound.dx)) {
            /* Insert a new node mid-list */
            if (prevBound === null) {
                lmtNode.firstBound = e;
            } else {
                prevBound.nextBound = e;
            }

            e.nextBound = currentBound;

            return;
        }

        /* Head further down the list */
        if (currentBound.nextBound === null) {
            currentBound.nextBound = e;

            return;
        } else {
            prevBound = currentBound;
            currentBound = currentBound.nextBound;
        }

    }
}

function contourPass(edgeTable: EdgeTable, lmtTable: LmtTable, vertexCount: number, eIndex: number, type: 0 | 1, op: OperationType, fwd: boolean): number {
    const next = fwd ? NEXT_INDEX : PREV_INDEX;
    for (let min = 0; min < vertexCount; min++) {
        /* If a forward local minimum... */
        if (fwd ? edgeTable.FWD_MIN(min) : edgeTable.REV_MIN(min)) {
            /* Search for the next local maximum... */
            let edgeCount = 1;
            let max = next(min, vertexCount);
            while (fwd ? edgeTable.NOT_FMAX(max) : edgeTable.NOT_RMAX(max)) {
                edgeCount++;
                max = next(max, vertexCount);
            }

            /* Build the next edge list */
            let v = min;
            const e = edgeTable.getNode(eIndex);
            e.bstate.below = BundleState.UNBUNDLED;
            e.bundle.below[CLIP] = 0;
            e.bundle.below[SUBJ] = 0;

            for (let i = 0; i < edgeCount; i++) {
                const ei = edgeTable.getNode(eIndex + i);
                let ev = edgeTable.getNode(v);

                ei.xb = ev.vertex.x;
                ei.bot.x = ev.vertex.x;
                ei.bot.y = ev.vertex.y;

                v = next(v, vertexCount);
                ev = edgeTable.getNode(v);

                ei.top.x = ev.vertex.x;
                ei.top.y = ev.vertex.y;
                ei.dx = (ev.vertex.x - ei.bot.x) / (ei.top.y - ei.bot.y);
                ei.type = type;
                ei.outp.above = null;
                ei.outp.below = null;
                ei.next = null;
                ei.prev = null;
                ei.succ = ((edgeCount > 1) && (i < (edgeCount - 1))) ? edgeTable.getNode(eIndex + i + 1) : null;
                ei.pred = ((edgeCount > 1) && (i > 0)) ? edgeTable.getNode(eIndex + i - 1) : null;
                ei.nextBound = null;
                ei.bside.clip = (op === OperationType.DIF) ? RIGHT : LEFT;
                ei.bside.subj = LEFT;
            }

            insertBound(boundList(lmtTable, edgeTable.getNode(min).vertex.y), e);

            eIndex += edgeCount;
        }
    }

    return eIndex;
}

function buildLmt(
    lmtTable: LmtTable,
    sbte: ScanBeamTreeEntries,
    p: Polygon,
    type: 0 | 1, // poly type SUBJ/CLIP
    op: OperationType,
): void {
    /* Create the entire input polygon edge table in one go */
    for (const ip of p.getInnerPolies()) {
        if (!ip[isContributing](0)) {
            /* Ignore the non-contributing contour */
            ip[setContributing](0, true);
        } else {

            /* Perform contour optimisation */
            let vertexCount = 0;
            const edgeTable = new EdgeTable();
            const pointLen = ip.getNumPoints();
            for (let i = 0; i < pointLen; i++) {
                if (OPTIMAL(ip, i)) {
                    const { x, y } = ip.get(i);
                    edgeTable.addNode(x, y);

                    /* Record vertex in the scanbeam table */
                    sbte.addToSBTree(y);

                    vertexCount++;
                }
            }

            /* Do the contour forward pass */
            const eIndex = contourPass(edgeTable, lmtTable, vertexCount, 0, type, op, true);

            /* Do the contour reverse pass */
            contourPass(edgeTable, lmtTable, vertexCount, eIndex, type, op, false);
        }
    }
}

function addSTEdge(st: StNode | null, it: ItNodeTable, edge: EdgeNode, dy: number): StNode {
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

enum BundleState {
    UNBUNDLED,
    BUNDLE_HEAD,
    BUNDLE_TAIL,
}

class EdgeNode {
    public vertex: Vertex;                                     /* Piggy-backed contour vertex data  */
    public bot: Vertex = new Vertex(NaN, NaN);                 /* Edge lower (x, y) coordinate      */
    public top: Vertex = new Vertex(NaN, NaN);                 /* Edge upper (x, y) coordinate      */
    public xb: number = NaN;                                   /* Scanbeam bottom x coordinate      */
    public xt: number = NaN;                                   /* Scanbeam top x coordinate         */
    public dx: number = NaN;                                   /* Change in x for a unit y increase */
    public type: 0 | 1 = 0;                                    /* Clip / subject edge flag          */
    public bside: { clip: 0 | 1, subj: 0 | 1 };                /* Bundle left / right indicators    */
    public bundle: { above: number[], below: number[] };       /* Bundle edge flags                 */
    public bstate: { above: BundleState | null, below: BundleState | null }; /* Edge bundle state                 */
    public outp: { above: PolygonNode | null, below: PolygonNode | null };   /* Output polygon / tristrip pointer */
    public prev: EdgeNode | null = null;        /* Previous edge in the AET          */
    public next: EdgeNode | null = null;        /* Next edge in the AET              */
    public pred: EdgeNode | null = null;        /* Edge connected at the lower end   */
    public succ: EdgeNode | null = null;        /* Edge connected at the upper end   */
    public nextBound: EdgeNode | null = null;   /* Pointer to next bound in LMT      */

    constructor(x: number, y: number) {
        this.vertex = new Vertex(x, y);
        this.bside = { clip: 0, subj: 0 };
        this.bundle = { above: [0, 0], below: [0, 0] };
        this.bstate = { above: null, below: null };
        this.outp = { above: null, below: null };
    }
}

class AetTree {
    public top: EdgeNode | null = null;

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
}

class EdgeTable {
    private nodeList: EdgeNode[] = [];

    public addNode(x: number, y: number): void {
        this.nodeList.push(new EdgeNode(x, y));
    }

    public getNode(index: number): EdgeNode {
        return this.nodeList[index];
    }

    public FWD_MIN(i: number): boolean {
        const nodeList = this.nodeList;

        const prev = nodeList[PREV_INDEX(i, nodeList.length)];
        const next = nodeList[NEXT_INDEX(i, nodeList.length)];
        const ith = nodeList[i];

        return ((prev.vertex.y >= ith.vertex.y) &&
            (next.vertex.y > ith.vertex.y));
    }

    public NOT_FMAX(i: number): boolean {
        const nodeList = this.nodeList;

        const next = nodeList[NEXT_INDEX(i, nodeList.length)];
        const ith = nodeList[i];

        return next.vertex.y > ith.vertex.y;
    }

    public REV_MIN(i: number): boolean {
        const nodeList = this.nodeList;

        const prev = nodeList[PREV_INDEX(i, nodeList.length)];
        const next = nodeList[NEXT_INDEX(i, nodeList.length)];
        const ith = nodeList[i];

        return ((prev.vertex.y > ith.vertex.y) && (next.vertex.y >= ith.vertex.y));
    }

    public NOT_RMAX(i: number): boolean {
        const nodeList = this.nodeList;

        const prev = nodeList[PREV_INDEX(i, nodeList.length)];
        const ith = nodeList[i];

        return prev.vertex.y > ith.vertex.y;
    }
}

namespace HState {
    export const NH = 0; /* No horizontal edge                */
    export const BH = 1; /* Bottom horizontal edge            */
    export const TH = 2; /* Top horizontal edge               */

    /* Horizontal edge state transitions within scanbeam boundary */
    export const nextState =
        [
      /*        ABOVE     BELOW     CROSS */
      /*        L   R     L   R     L   R */
      /* NH */[BH, TH, TH, BH, NH, NH],
      /* BH */[NH, NH, NH, NH, TH, TH],
      /* TH */[NH, NH, NH, NH, BH, BH],
        ];
}

class ItNode {

    public ie: [EdgeNode, EdgeNode]; /* Intersecting edge (bundle) pair   */
    public point: Vertex;            /* Point of intersection             */
    public next: ItNode | null;      /* The next intersection table node  */

    constructor(edge0: EdgeNode, edge1: EdgeNode, x: number, y: number, next: ItNode | null) {
        this.ie = [edge0, edge1];
        this.point = new Vertex(x, y);
        this.next = next;
    }
}

class ItNodeTable {
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

class LmtNode {
    public firstBound: EdgeNode | null = null;  /* Pointer to bound list             */
    constructor(
        public y: number,                /* Y coordinate at local minimum     */
        public next: LmtNode | null = null,     /* Pointer to next local minimum     */
    ) { }
}

class LmtTable {
    public top: LmtNode | null = null;
}

class VertexNode extends Vertex {
    constructor(x: number, y: number, public next: VertexNode | null = null) {
        super(x, y);
    }
}

enum VertexType {
    NUL = 0,  /* Empty non-intersection            */
    EMX = 1,  /* External maximum                  */
    ELI = 2,  /* External left intermediate        */
    TED = 3,  /* Top edge                          */
    ERI = 4,  /* External right intermediate       */
    RED = 5,  /* Right edge                        */
    IMM = 6,  /* Internal maximum and minimum      */
    IMN = 7,  /* Internal minimum                  */
    EMN = 8,  /* External minimum                  */
    EMM = 9,  /* External maximum and minimum      */
    LED = 10, /* Left edge                         */
    ILI = 11, /* Internal left intermediate        */
    BED = 12, /* Bottom edge                       */
    IRI = 13, /* Internal right intermediate       */
    IMX = 14, /* Internal maximum                  */
    FUL = 15, /* Full non-intersection             */
}

function getVertexType(tr: number, tl: number, br: number, bl: number): VertexType {
    return tr + (tl << 1) + (br << 2) + (bl << 3);
}

class PolygonNode {
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

class Rectangle {
    constructor(public minx: number, public miny: number, public maxx: number, public maxy: number) { }
}

class ScanBeamTree {
    public less: ScanBeamTree | null = null; /* Pointer to nodes with lower y     */
    public more: ScanBeamTree | null = null; /* Pointer to nodes with higher y    */
    constructor(public y: number) { } /* Scanbeam node y value             */
}

class ScanBeamTreeEntries {
    public sbtEntries: number = 0;
    public sbTree: ScanBeamTree | null = null;

    public addToSBTree(y: number): void {
        if (this.sbTree === null) {
            /* Add a new tree node here */
            this.sbTree = new ScanBeamTree(y);
            this.sbtEntries++;
    
            return;
        }
    
        let treeNode = this.sbTree;
        while (treeNode.y !== y) {
            const dir = treeNode.y > y ? "less" : "more";
            const child = treeNode[dir];
            if (child === null) {
                treeNode[dir] = new ScanBeamTree(y);
                this.sbtEntries++;
    
                return;
    
            } else {
                treeNode = child;
            }
        }
    }

    public buildSBT(): number[] {
        if (this.sbTree === null) return [];

        const sbt: number[] = [];

        (function inner(entries: number, table: number[], sbtNode: ScanBeamTree): number {
            if (sbtNode.less !== null) {
                entries = inner(entries, table, sbtNode.less);
            }

            table[entries] = sbtNode.y;
            entries++;

            if (sbtNode.more !== null) {
                entries = inner(entries, table, sbtNode.more);
            }

            return entries;
        })(0, sbt, this.sbTree);

        return sbt;
    }

}

class StNode {
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

class TopPolygonNode {
    public top: PolygonNode | null = null;

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

    public getResult(): Polygon {
        const contours = this.getContours();
        if (contours.length === 0) {
            return new SimplePolygon([]);
        }

        const innerPolies = contours.map((polyNode) => {
            const vertices: Vertex[] = [];
            for (let vtx: VertexNode | null = polyNode.proxy.left; vtx !== null; vtx = vtx.next) {
                vertices.push(vtx);
            }

            const simple = new SimplePolygon(vertices);

            return polyNode.proxy.hole ? new MultiPolygon([simple], true) : simple; 
        });

        return (innerPolies.length === 1) ? innerPolies[0] : new MultiPolygon(innerPolies);
    }
}

type ExternalVertex = { x: number, y: number } | [number, number];

export abstract class Polygon {
    public abstract get isEmpty(): boolean;
    public abstract get isHole(): boolean;
    public abstract get bounds(): Rectangle;

    // Return true if the given inner polygon is contributing to the set operation.
    // This method should NOT be used outside the Clip algorithm.
    public abstract [isContributing](index: number): boolean;
    public abstract [setContributing](index: number, value: boolean): void;

    public abstract getInnerPolies(): Polygon[];

    // Return the number points of the first inner polygon.
    public abstract getNumPoints(): number;

    // Return the vertex at the given index in the first inner polygon.
    public abstract get(index: number): Vertex;

    public abstract equals(obj: Polygon): boolean;

    public abstract toVertices(): { bounds: Vertex[][], holes: Vertex[][] };

    private static n_ary(op: OperationType, ...polys: Polygon[]): Polygon {
        return polys.reduce((acc, p) => clip(op, acc, p));
    }

    public static intersection(...p: Polygon[]): Polygon {
        return Polygon.n_ary(OperationType.INT, ...p);
    }

    public intersection(...p: Polygon[]): Polygon {
        return Polygon.intersection(this, ...p);
    }

    public static union(...p: Polygon[]): Polygon {
        return Polygon.n_ary(OperationType.ADD, ...p);
    }

    public union(...p: Polygon[]): Polygon {
        return Polygon.union(this, ...p);
    }

    public static xor(...p: Polygon[]): Polygon {
        return Polygon.n_ary(OperationType.XOR, ...p);
    }

    public xor(...p: Polygon[]): Polygon {
        return Polygon.xor(this, ...p);
    }

    public static difference(first: Polygon, ...p: Polygon[]): Polygon {
        switch (p.length) {
            case 0: return first;
            case 1: return clip(OperationType.DIF, first, p[0]);
            default: {
                const clipper = p.reduce((acc, n) => clip(OperationType.ADD, acc, n));
                return clip(OperationType.DIF, first, clipper);
            }
        }        
    }

    public difference(...p: Polygon[]): Polygon {
        return Polygon.difference(this, ...p);        
    }

    public static fromPoints(points: ExternalVertex[]): Polygon {
        return new SimplePolygon(points.map((p) => Array.isArray(p) ? { x: p[0]||0, y: p[1]||0 } : p));
    }

    public static fromVertices({ bounds, holes }: { bounds: ExternalVertex[][], holes: ExternalVertex[][] }): Polygon {
        return Polygon.n_ary(OperationType.ADD, ...bounds.map(Polygon.fromPoints))
            .difference(...holes.map(Polygon.fromPoints));
    }
}

// MultiPolygon provides support for complex (with multiple disjoint cycles) and simple polygons and holes.
class MultiPolygon extends Polygon {
    constructor(private polyList: Polygon[], private _isHole: boolean = false) {
        super();
        if (_isHole && polyList.length > 1) {
            throw new Error("Complex polygons cannot be holes.");
        }
    }

    public equals(that: Polygon): boolean {
        return (that instanceof MultiPolygon) &&
            this._isHole === that._isHole &&
            this.polyList.every((p, i) => p.equals(that.polyList[i]));
    }

    public get isHole(): boolean {
        return this._isHole;
    }

    public get isEmpty(): boolean {
        return this.polyList.length === 0;
    }

    private _bounds: Rectangle | null = null;
    public get bounds(): Rectangle {
        if (this._bounds === null) {
            const { polyList } = this;
            if (polyList.length === 0) {
                this._bounds = new Rectangle(NaN, NaN, NaN, NaN);
            } else if (polyList.length === 1) {
                this._bounds = this.polyList[0].bounds;
            } else {
                let xmin = Number.MAX_VALUE;
                let ymin = Number.MAX_VALUE;
                let xmax = -Number.MAX_VALUE;
                let ymax = -Number.MAX_VALUE;

                for (const p of this.polyList) {
                    const { maxx, maxy, minx, miny } = p.bounds;
                    if (minx < xmin) { xmin = minx; }
                    if (maxx > xmax) { xmax = maxx; }
                    if (miny < ymin) { ymin = miny; }
                    if (maxy > ymax) { ymax = maxy; }
                }

                this._bounds = new Rectangle(xmin, ymin, xmax, ymax);
            }
        }

        return this._bounds;
    }

    public getInnerPolies(): Polygon[] {
        return this.polyList;
    }

    public getNumPoints(): number {
        return this.polyList[0].getNumPoints();
    }

    public get(index: number): Vertex {
        return this.polyList[0].get(index);
    }

    public [isContributing](polyIndex: number): boolean {
        return this.polyList[polyIndex][isContributing](0);
    }

    public [setContributing](polyIndex: number, contributes: boolean): void {
        this.polyList[polyIndex][setContributing](0, contributes);
    }

    public toVertices(): { bounds: Vertex[][], holes: Vertex[][] } {
        if (this._isHole) {
            const { bounds } = this.polyList[0].toVertices();

            return { bounds: [], holes: bounds };
        } else {
            const bounds: Vertex[][] = [];
            const holes: Vertex[][] = [];

            for (const poly of this.polyList) {
                const { bounds: nb, holes: nh } = poly.toVertices();
                bounds.push(...nb);
                holes.push(...nh);
            }

            return { bounds, holes };
        }
    }
}

function cyclicEqual<T extends { equals(x: T): boolean }>(u: T[], v: T[]): boolean {
    const n = u.length;
    if (n === v.length) {
        let i = 0;
        do {
            let k = 1;
            while (k <= n && u[(i + k) % n].equals(v[k % n])) {
                k++;
            }

            if (k > n) {
                return true;
            }

            i += k;
        } while (i < n);
    }

    return false;
}

// A simple polygon, with only one inner polygon--itself. Cannot be used to represent a hole.
class SimplePolygon extends Polygon {

    private pointList: Vertex[];

    /** Flag used by the Clip algorithm */
    private contributes: boolean = true;

    constructor(points: { x: number, y: number }[]) {
        super();
        this.pointList = points.map(({ x, y }) => new Vertex(x, y));
    }

    public equals(that: Polygon): boolean {
        if (!(that instanceof SimplePolygon)) {
            return false;
        }

        if (cyclicEqual(this.pointList, that.pointList)) {
            return true;
        }

        const reversed: Vertex[] = [];
        for (let i = this.pointList.length - 1; i >= 0; i--) {
            reversed.push(this.pointList[i]);
        }

        return cyclicEqual(reversed, that.pointList);
    }

    // Always returns false since SimplePolygons cannot be holes.
    public get isHole(): boolean {
        return false;
    }

    public get isEmpty(): boolean {
        return this.pointList.length === 0;
    }

    private _bounds: Rectangle | null = null;
    public get bounds(): Rectangle {
        if (this._bounds === null) {
            let xmin = Number.MAX_VALUE;
            let ymin = Number.MAX_VALUE;
            let xmax = -Number.MAX_VALUE;
            let ymax = -Number.MAX_VALUE;

            for (const { x, y } of this.pointList) {
                if (x < xmin) { xmin = x; }
                if (x > xmax) { xmax = x; }
                if (y < ymin) { ymin = y; }
                if (y > ymax) { ymax = y; }
            }

            this._bounds = new Rectangle(xmin, ymin, xmax, ymax);
        }

        return this._bounds;
    }

    public getInnerPolies(): Polygon[] {
        return [this];
    }

    public getNumPoints(): number {
        return this.pointList.length;
    }

    public get(index: number): Vertex {
        return this.pointList[index];
    }

    public [isContributing](polyIndex: number): boolean {
        if (polyIndex !== 0) {
            throw new Error("PolySimple only has one poly");
        }

        return this.contributes;
    }

    public [setContributing](polyIndex: number, contributes: boolean): void {
        if (polyIndex !== 0) {
            throw new Error("PolySimple only has one poly");
        }

        this.contributes = contributes;
    }

    public toVertices(): { bounds: Vertex[][], holes: Vertex[][] } {
        return { bounds: [this.pointList], holes: [] };
    }
}
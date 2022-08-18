import { EdgeNode } from "./EdgeNode";
import { EdgeTable } from "./EdgeTable";
import { LmtNode, LmtTable } from "./LmtTable";
import { OperationType, NEXT_INDEX, PREV_INDEX, BundleState, CLIP, SUBJ, RIGHT, LEFT } from "./util";

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

export function contourPass(edgeTable: EdgeTable, lmtTable: LmtTable, vertexCount: number, eIndex: number, type: 0 | 1, op: OperationType, fwd: boolean): number {
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
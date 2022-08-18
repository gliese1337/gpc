import { contourPass } from "./CountorPass";
import { EdgeNode } from "./EdgeNode";
import { EdgeTable } from "./EdgeTable";
import { IPolygon, OPTIMAL } from "./IPolygon";
import { ScanBeamTreeEntries } from "./SBTree";
import { OperationType, isContributing, setContributing } from "./util";

export class LmtNode {
    public firstBound: EdgeNode | null = null;  /* Pointer to bound list             */
    constructor(
        public y: number,                /* Y coordinate at local minimum     */
        public next: LmtNode | null = null,     /* Pointer to next local minimum     */
    ) { }
}

export class LmtTable {
    public top: LmtNode | null = null;
}

export function buildLmt(
    lmtTable: LmtTable,
    sbte: ScanBeamTreeEntries,
    p: IPolygon,
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

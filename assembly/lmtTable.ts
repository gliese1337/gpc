import { EdgeNode } from './edgeNode';

class LmtNode {
    public firstBound: EdgeNode | null = null;  /* Pointer to bound list             */
    constructor(
        public y: f64,                          /* Y coordinate at local minimum     */
        public next: LmtNode | null = null,     /* Pointer to next local minimum     */
    ) { }
}

export class LmtTable {
    public top: LmtNode | null = null;

    private boundList(y: f64): LmtNode {
        if (this.top === null) {
            this.top = new LmtNode(y);
    
            return this.top as LmtNode;
        }
    
        let prev: LmtNode | null = null;
        let node = this.top;
        while (true) {
            if (y > node.y) {
                /* Head further up the LMT */
                if (node.next === null) {
                    node.next = new LmtNode(y);
    
                    return node.next as LmtNode;
                }
            
                prev = node;
                node = node.next;
            } else {
                if (y < node.y) {
                    /* Insert a new LMT node before the current node */
                    node = new LmtNode(y, node);
                    if (prev === null) {
                        this.top = node;
                    } else {
                        prev.next = node;
                    }
                }
                /* Use this existing LMT node */
                break;
            }
        }

        return node as LmtNode;
    }

    public insertBound(y: f64, e: EdgeNode): void {
        let lmtNode = this.boundList(y);
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
}
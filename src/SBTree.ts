class ScanBeamTree {
    public less: ScanBeamTree | null = null; /* Pointer to nodes with lower y     */
    public more: ScanBeamTree | null = null; /* Pointer to nodes with higher y    */
    constructor(public y: number) { } /* Scanbeam node y value             */
}

export class ScanBeamTreeEntries {
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
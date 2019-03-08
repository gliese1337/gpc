class ScanBeamTree {
    public children: (ScanBeamTree | null)[] = [ null, null ];
    constructor(public y: f64) { } /* Scanbeam node y value */
}

export class ScanBeamTreeEntries {
    public sbtEntries: u32 = 0;
    public sbTree: ScanBeamTree | null = null;

    public addToSBTree(y: f64): void {
        if (this.sbTree === null) {
            /* Add a new tree node here */
            this.sbTree = new ScanBeamTree(y);
            this.sbtEntries++;
    
            return;
        }
    
        let treeNode = this.sbTree;
        while (treeNode.y !== y) {
            let dir = treeNode.y > y ? 0 : 1;
            let child = treeNode.children[dir];
            if (child === null) {
                treeNode.children[dir] = new ScanBeamTree(y);
                this.sbtEntries++;
    
                return;
            }
            
            treeNode = child;
        }
    }

    private static buildSBT(entryIndex: u32, table: f64[], sbtNode: ScanBeamTree): u32 {
        if (sbtNode.children[0] !== null) {
            entryIndex = ScanBeamTreeEntries.buildSBT(entryIndex, table, sbtNode.children[0] as ScanBeamTree);
        }

        table[entryIndex] = sbtNode.y;
        entryIndex++;

        if (sbtNode.children[1] !== null) {
            entryIndex = ScanBeamTreeEntries.buildSBT(entryIndex, table, sbtNode.children[1] as ScanBeamTree);
        }

        return entryIndex;
    }

    public buildSBT(): f64[] {
        if (this.sbTree === null) return [];

        let sbt: f64[] = new Array(this.sbtEntries);

        ScanBeamTreeEntries.buildSBT(0, sbt, this.sbTree as ScanBeamTree);

        return sbt;
    }
}
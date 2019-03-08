export const NUL = 0;  /* Empty non-intersection            */
export const EMX = 1;  /* External maximum                  */
export const ELI = 2;  /* External left intermediate        */
export const TED = 3;  /* Top edge                          */
export const ERI = 4;  /* External right intermediate       */
export const RED = 5;  /* Right edge                        */
export const IMM = 6;  /* Internal maximum and minimum      */
export const IMN = 7;  /* Internal minimum                  */
export const EMN = 8;  /* External minimum                  */
export const EMM = 9;  /* External maximum and minimum      */
export const LED = 10; /* Left edge                         */
export const ILI = 11; /* Internal left intermediate        */
export const BED = 12; /* Bottom edge                       */
export const IRI = 13; /* Internal right intermediate       */
export const IMX = 14; /* Internal maximum                  */
export const FUL = 15; /* Full non-intersection             */

export function getVertexType(tr: u32, tl: u32, br: u32, bl: u32): u32 {
    return tr + (tl << 1) + (br << 2) + (bl << 3);
}
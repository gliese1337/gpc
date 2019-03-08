export function PREV_INDEX(i: u32, n: u32): u32 {
    return (i - 1 + n) % n;
}

export function NEXT_INDEX(i: u32, n: u32): u32 {
    return (i + 1) % n;
}
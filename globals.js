// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------
// exposed globals (no other files add to global namespace)

var Console =
{
    logArea: 0,
    inputArea: 0
};

var Emulator =
{
    screen: 0,
    charMap: 0,
    screenDC: 0,
    charMapDC: 0,

    //          0     1     2     3     4     5     6     7     8     9   10   11    12
    regNames: ['A', 'B', 'C', 'X', 'Y', 'Z', 'I', 'J', 'SP', 'PC', 'O', 'if', 'bp'],
    regs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0xFFFF],
    opNames: ['', 'SET', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'SHL', 'SHR', 'AND', 'BOR', 'XOR', 'IFE', 'IFN', 'IFG', 'IFB'],
    opCycles: [0, 1, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 2, 2, 2, 2],
    mem: new Array(0x10000),
    cycles: 0,
    paused: 0,

    MemoryHooks: [],
    onReset: function() { }
};

var Assembler =
{
    Program: ''
};
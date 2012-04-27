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
    //          0    1    2    3    4    5    6    7     8     9   10     11    12    13
    regNames: ['A', 'B', 'C', 'X', 'Y', 'Z', 'I', 'J', 'SP', 'PC', 'EX', 'if', 'bp', 'IA' ],
    regs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0xFFFF, 0],
    opNames: ['!00', 'SET', 'ADD', 'SUB', 'MUL', 'MLI', 'DIV', 'DVI', 'MOD', 'MDI', 'AND', 'BOR', 'XOR', 'SHR', 'ASR', 'SHL', 'IFB', 'IFC', 'IFE', 'IFN', 'IFG', 'IFA', 'IFL', 'IFU', '!18', '!19', 'ADX', 'SUX', '!1c', '!1d', 'STI', 'STD'],
    extOpNames: ['?00', 'JSR', '?02', '?03', '?04', '?05', '?06', 'HCF', 'INT', 'IAG', 'IAS', 'IAP', 'IAQ', '?0d', '?0e', '?0f', 'HWN', 'HWQ', 'HWI', '?13', '?14', '?15', '?16', '?17', '?18', '?19', '?1a', '?1b', '?1c', '?1d', '?1e', '?1f'],
    opCycles: [0, 1, 2, 2, 2, 2, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 3, 3, 0, 0, 2, 2],
    extOpCycles: [0, 3, 0, 0, 0, 0, 0, 9, 4, 1, 1, 3, 2, 0, 0, 0, 2, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    mem: new Array(0x10000),
    cycles: 0,
    walltime: 0,
    timedcycles: 0, // walltime not accumulated over step/trace, only run, since the former dominated by overhead
    paused: 0,
    
    Devices: [],
    InterruptQueue: [],
    InterruptQueueEnable: 0,
    EventQueue: [],
    MemoryHooks: []
};

var Assembler =
{
    Program: ''
};

var Peripherals = 
[
];

// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------

(function()
{

    // -----------------------
    // Emulator implementation
    // -----------------------

    // -----------------------
    Emulator.WriteMem = function(_addr, _value)
    {
        Emulator.mem[_addr] = _value;

        if (Emulator.MemoryHooks[_addr])
        {
            Emulator.MemoryHooks[_addr](_addr, _value);
        }
    }

    // -----------------------
    function GetVal(_code)
    {
        if (_code >= 0x20)
        {
            return (_code - 0x20);
        }
        switch (_code & 0xf8)
        {
            case 0:
                return Emulator.regs[_code];
            case 8:
                Emulator.cycles++;
                return Emulator.mem[Emulator.regs[_code - 8]];
            case 16:
                Emulator.cycles++;
                var result = Emulator.mem[Emulator.mem[Emulator.regs[9]] + Emulator.regs[_code - 0x10]];
                Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
                return result;
        }
        switch (_code)
        {
            case 0x18:
                var result = Emulator.mem[Emulator.regs[8]];
                Emulator.regs[8] = (Emulator.regs[8] + 1) & 0xFFFF;
                return result;
            case 0x19: return Emulator.mem[(Emulator.regs[8])];
            case 0x1A:
                Emulator.regs[8] = (Emulator.regs[8] + 0xFFFF) & 0xFFFF;
                return Emulator.mem[Emulator.regs[8]];
            case 0x1B: return Emulator.regs[8];
            case 0x1C: return Emulator.regs[9];
            case 0x1D: return Emulator.regs[10];

            case 0x1E:
                Emulator.cycles++;
                var result = Emulator.mem[Emulator.mem[Emulator.regs[9]]];
                Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
                return result;

            case 0x1F:
                Emulator.cycles++;
                var result = Emulator.mem[Emulator.regs[9]];
                Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
                return result;
        }
    }

    // -----------------------
    function SetVal(_code, _val, _apc, _asp)
    {
        // note a has already been fetched with GetVal
        if (_code < 0x20)
        {
            switch (_code & 0xf8)
            {
                case 0:
                    Emulator.regs[_code] = _val;
                    return;
                case 8:
                    Emulator.WriteMem(Emulator.regs[_code - 0x08], _val);
                    return;
                case 16:
                    Emulator.WriteMem(Emulator.mem[_apc] + Emulator.regs[_code - 0x10], _val);
                    return;
            }
            switch (_code)
            {
                case 0x18: Emulator.WriteMem(_asp, _val); return;
                case 0x19: Emulator.WriteMem(_asp, _val); return;
                case 0x1A: Emulator.WriteMem((_asp + 0xFFFF) & 0xFFFF, _val); return;
                case 0x1B: Emulator.regs[8] = _val; return;
                case 0x1C: Emulator.regs[9] = _val; return;
                case 0x1D: Emulator.regs[10] = _val; return;
                case 0x1E: Emulator.WriteMem(Emulator.mem[_apc], _val); return;
            }
        }
    }

    // -----------------------
    Emulator.Step = function()
    {
        if (Emulator.regs[9] == Emulator.regs[12])
        {
            Console.Log('*** breakpoint hit, emulation paused.');
            Emulator.paused = true;
            return;
        }

        var op = Emulator.mem[Emulator.regs[9]];
        Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
        var opcode = op & 0xF;
        var a = (op >>> 4) & 0x3F;
        var b = (op >>> 10) & 0x3F;
        var apc = Emulator.regs[9];
        var asp = Emulator.regs[8];

        if (Emulator.regs[11])
        {
            if (opcode == 0)
            {
                var aval = GetVal(b);
                switch (a)
                {
                    case 0x1: // JSR a
                        Emulator.cycles += 2;
                        Emulator.regs[8] = (Emulator.regs[8] + 0xFFFF) & 0xFFFF;
                        Emulator.WriteMem(Emulator.regs[8], Emulator.regs[9]);
                        Emulator.regs[9] = aval;
                        break;

                    case 0x3F: // (nonstandard) BRK
                        Console.Log('*** BRK encountered at ' + (Emulator.regs[9] - 1) + '; emulation paused.');
                        Emulator.paused = true;
                        break;

                    default:
                        Console.Log('*** reserved instruction encountered at ' + (Emulator.regs[9] - 1) + '; emulation paused.');
                        Emulator.paused = true;
                        return;
                }
            }
            else
            {
                Emulator.cycles += Emulator.opCycles[opcode];
                var aval = GetVal(a);
                var bval = GetVal(b);
                var tmp;
                switch (opcode)
                {
                    case 0x1: // SET
                        SetVal(a, bval, apc, asp);
                        break;
                    case 0x2: // ADD
                        tmp = aval + bval;
                        Emulator.regs[10] = (tmp >>> 16) & 0xFFFF;
                        SetVal(a, tmp & 0xFFFF, apc, asp);
                        break;
                    case 0x3: // SUB
                        tmp = (aval - bval) >>> 0;
                        Emulator.regs[10] = (tmp < 0) ? 0xFFFF : 0;
                        SetVal(a, (tmp >>> 0) & 0xFFFF, apc, asp);
                        break;
                    case 0x4: // MUL
                        tmp = aval * bval;
                        Emulator.regs[10] = (tmp >>> 16) & 0xFFFF;
                        SetVal(a, tmp & 0xFFFF, apc, asp);
                        break;
                    case 0x5: // DIV
                        Emulator.regs[10] = bval ? ((Math.floor((aval << 16) / bval) & 0xFFFF) >>> 0) : 0;
                        SetVal(a, bval ? Math.floor(aval / bval) : 0, apc, asp);
                        break;
                    case 0x6: // MOD
                        SetVal(a, bval ? (aval % bval) : 0, apc, asp);
                        break;
                    case 0x7: // SHL
                        tmp = (aval << bval) >>> 0;
                        Emulator.regs[10] = (tmp >>> 16) & 0xFFFF;
                        SetVal(a, tmp & 0xFFFF, apc, asp);
                        break;
                    case 0x8: // SHR
                        tmp = (aval << 16) >>> bval;
                        Emulator.regs[10] = tmp & 0xFFFF;
                        SetVal(a, (tmp >>> 16) & 0xFFFF, apc, asp);
                        break;
                    case 0x9: // AND
                        SetVal(a, (aval & bval) >>> 0, apc, asp);
                        break;
                    case 0xA: // BOR
                        SetVal(a, (aval | bval) >>> 0, apc, asp);
                        break;
                    case 0xB: // XOR
                        SetVal(a, (aval ^ bval) >>> 0, apc, asp);
                        break;
                    case 0xC: // IFE
                        Emulator.regs[11] = (aval == bval);
                        break;
                    case 0xD: // IFN
                        Emulator.regs[11] = (aval != bval);
                        break;
                    case 0xE: // IFG
                        Emulator.regs[11] = (aval > bval);
                        break;
                    case 0xF: // IFB
                        Emulator.regs[11] = (aval & bval);
                        break;
                }
            }
        }
        else
        {
            // skipped by IF* prefix
            Emulator.regs[11] = true;
            if ((opcode > 0) && (a >= 0x10) && ((a < 0x18) || (a == 0x1e) || (a == 0x1f)))
            {
                Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
            }
            if ((b >= 0x10) && ((b < 0x18) || (b == 0x1e) || (b == 0x1f)))
            {
                Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
            }
        }
    }

    // -----------------------
    function GetOperandDesc(_code)
    {
        if (_code < 0x08) { return [Emulator.regNames[_code], 0]; }
        if (_code < 0x10) { return ['[' + Emulator.regNames[_code - 0x8] + ']', 0]; }
        if (_code < 0x18) { return ['[[PC++]+' + Emulator.regNames[_code - 0x10] + ']', 1]; }
        if (_code >= 0x20) { return [Console.H16(_code - 0x20), 0]; }
        switch (_code)
        {
            case 0x18: return ['[SP++]', 0];
            case 0x19: return ['[SP]', 0];
            case 0x1a: return ['[--SP]', 0];
            case 0x1b: return ['SP', 0];
            case 0x1c: return ['PC', 0];
            case 0x1d: return ['O', 0];
            case 0x1e: return ['[[PC++]]', 1];
            case 0x1f: return ['[PC++]', 1];
        }
    }

    // -----------------------
    Emulator.Disassemble = function(_addr)
    {
        var op = Emulator.mem[_addr];
        var opcode = op & 0xF;
        var a = GetOperandDesc((op >>> 4) & 0x3F);
        var b = GetOperandDesc((op >>> 10) & 0x3F);

        var result = Console.H16(_addr) + ': ' + Emulator.opNames[opcode];
        var size = a[1];

        if (opcode == 0)
        {
            switch ((op >>> 4) & 0x3F)
            {
                case 1: result += 'JSR ' + b[0]; break;
                default: result += '?' + Console.H8((op >>> 4) & 0x3F) + ' ' + b[0]; break;
            }
        }
        else
        {
            size += b[1];
            result += ' ' + a[0] + ', ' + b[0];
            if (size > 0)
            {
                result += ' ; ';
                for (var i = 0; i < size; i++)
                {
                    result += '$' + Console.H16(Emulator.mem[_addr + i + 1]) + ' ';
                }
            }
        }
        
        if( Assembler.Lines 
            && Assembler.MemMap 
            && Assembler.MemMap[_addr] 
            && Assembler.Lines[ Assembler.MemMap[_addr]-1 ]
        )
        {
          while( result.length < 56 )
          {
            result = result + ' ';
          }
          result += '; ' + Assembler.MemMap[_addr] + ': ';
          result += Assembler.Lines[ Assembler.MemMap[ _addr ]-1 ].replace(/\t/g, ' ').substr( 0, 130 - result.length );
        }

        return [result, size + 1];
    }

    // -----------------------
    Emulator.Status = function()
    {
        var stat = '';
        for (var i = 0; i < Emulator.regNames.length; i++)
        {
            stat += Emulator.regNames[i] + ':' + Console.H16(Emulator.regs[i]) + '  ';
        }
        stat += Emulator.cycles + 'cyc ';
        if (Emulator.timedcycles && Emulator.walltime)
        {
            var khz = Math.floor(Emulator.cycles / Emulator.walltime);
            stat += khz + 'khz'
        }
        stat += '\n' + Emulator.Disassemble(Emulator.regs[9])[0];
        if (!Emulator.regs[11])
        {
            stat += ' ; ( will skip ) ';
        }

        Console.Log(stat);
    }

    // -----------------------
    Emulator.Reset = function()
    {
        Emulator.regs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xFFFF];
        Emulator.mem = new Array(0x10000);
        Emulator.cycles = 0;
        Emulator.operandCycles = [];
        try
        {
            Emulator.regs = new Uint16Array(13);
            Emulator.mem = new Uint16Array(0x10000);
            Emulator.opCycles = new Uint16Array(Emulator.opCycles);
            Emulator.operandCycles = new Uint16Array(0x40);
            Emulator.regs[12] = 0xFFFF;
        }
        catch (e)
        {
            for (var i = 0; i < 0x10000; i++)
            {
                Emulator.mem[i] = 0;
            }
            for (var i = 0; i < 0x40; i++)
            {
                Emulator.operandCycles[i] = 0;
            }
        }

        Emulator.regs[11] = 1;

        for (var i = 0x10; i <= 0x17; i++)
        {
            Emulator.operandCycles[i] = 1;
        }
        Emulator.operandCycles[0x1e] = 1;
        Emulator.operandCycles[0x1f] = 1;

        Emulator.MemoryHooks = [];
        Emulator.onReset();

        Console.Log('Ready.');
    }

    // -----------------------
    Emulator.Dump = function(_arg)
    {
        var addr = _arg.shift();
        var count = _arg.shift();
        addr = (addr == undefined) ? 0 : parseInt(addr) & 0xFFF0;
        count = (count == undefined) ? 1 : parseInt(count);
        var result = '';
        for (var i = 0; i < count; i++)
        {
            result += Console.H16(addr) + ':  ';
            for (var j = 0; j < 16; j++)
            {
                result += Console.H16(Emulator.mem[addr++]) + ' ';
            }
            result += '\n';
        }
        result = result.substring(0, result.length - 1);
        Console.Log(result);
    }


    // -----------------------
    Emulator.Trace = function()
    {
        var start = (new Date()).getTime();

        while (!Emulator.paused)
        {
            if (((new Date()).getTime() - start) > 5)
            {
                setTimeout("Emulator.Trace()", 0);
                return;
            }

            var oldpc = Emulator.regs[9];
            Emulator.Step();
            Emulator.Status();
            if ((oldpc == Emulator.regs[9]) && !Emulator.paused)
            {
                Console.Log("PC unchanged last step; pausing emulation");
                Emulator.paused = 1;
            }
        }
    }

    // -----------------------
    Emulator.Run = function()
    {
        var start = (new Date()).getTime();
        var time = start;
        var startcyc = Emulator.cycles;

        while (!Emulator.paused)
        {
            time = ((new Date()).getTime() - start);
            if (time > 10)
            {
                Emulator.walltime += time;
                Emulator.timedcycles += Emulator.cycles - startcyc;
                setTimeout("Emulator.Run()", 0);
                return;
            }

            var cycles = Emulator.cycles;
            while ((!Emulator.paused) && ((Emulator.cycles - cycles) < 1000))
            {
                Emulator.Step();
            }
        }

        time = ((new Date()).getTime() - start);
        Emulator.walltime += time;
        Emulator.timedcycles += Emulator.cycles - startcyc;
    }

})();            // (function(){

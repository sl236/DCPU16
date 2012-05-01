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
    function GetVal(_code, _in_A)
    {
        if (_code >= 0x20)
        {
            return (_code==0x20) ? 0xFFFF : (_code - 0x21);
        }
        switch (_code & 0xf8)
        {
            case 0:
                return Emulator.regs[_code];
            case 8:
                return Emulator.mem[Emulator.regs[_code - 8]];
            case 16:
                Emulator.cycles++;
                var result = Emulator.mem[((Emulator.mem[Emulator.regs[9]] + Emulator.regs[_code - 0x10])>>>0)&0xFFFF];
                Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
                return result;
        }
        switch (_code)
        {
            case 0x18:
                if (_in_A)
                {
                    var result = Emulator.mem[Emulator.regs[8]];
                    Emulator.regs[8] = (Emulator.regs[8] + 1) & 0xFFFF;
                    return result;
                }
                else
                {
                    Emulator.regs[8] = (Emulator.regs[8] + 0xFFFF) & 0xFFFF;
                    return Emulator.mem[Emulator.regs[8]];
                }
            case 0x19: return Emulator.mem[(Emulator.regs[8])];
            case 0x1A:
                Emulator.cycles++;
                var offset = Emulator.mem[Emulator.regs[9]];
                Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
                return Emulator.mem[(Emulator.regs[8] + offset) & 0xFFFF];
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
                    Emulator.WriteMem((Emulator.mem[_apc] + Emulator.regs[_code - 0x10]) & 0xFFFF, _val);
                    return;
            }
            switch (_code)
            {
                case 0x18: Emulator.WriteMem((_asp + 0xFFFF) & 0xFFFF, _val); return;
                case 0x19: Emulator.WriteMem(_asp, _val); return;
                case 0x1A: Emulator.WriteMem((Emulator.mem[_apc] + _asp) & 0xFFFF, _val); return;
                case 0x1B: Emulator.regs[8] = _val; return;
                case 0x1C: Emulator.regs[9] = _val; return;
                case 0x1D: Emulator.regs[10] = _val; return;
                case 0x1E: Emulator.WriteMem(Emulator.mem[_apc], _val); return;
            }
        }
    }

    function AsSigned(_x)
    {
        return (_x < 0x7FFF) ? _x : -(((~(_x) + 1) >>> 0) & 0xFFFF);
    }
    
    function LogJSR( _type )
    {
        if(Emulator.JSRHistory)
        {
            if(Emulator.JSRHistory.length>Emulator.JSRHistoryMax)
            {
                Emulator.JSRHistory.shift();
            }
            Emulator.JSRHistory.push([Emulator.regs[9],Emulator.regs[8],_type]);
        }    
    }

    // -----------------------
    Emulator.Step = function()
    {
        if (Emulator.regs[11] && Emulator.InterruptQueue.length)
        {
            if (Emulator.InterruptQueue.length >= 256)
            {
                Console.Log("Interrupt queue full, emulator stopped.")
                Emulator.paused = true;
                return;
            }

            if (Emulator.regs[13] && !Emulator.InterruptQueueEnable)
            {
                LogJSR("HWI");
            
                var interrupt = Emulator.InterruptQueue.shift();
                Emulator.InterruptQueueEnable=1;
                Emulator.regs[8] = (Emulator.regs[8] + 0xFFFF) & 0xFFFF;
                Emulator.mem[Emulator.regs[8]] = Emulator.regs[9];
                Emulator.regs[8] = (Emulator.regs[8] + 0xFFFF) & 0xFFFF;
                Emulator.mem[Emulator.regs[8]] = Emulator.regs[0];
                Emulator.regs[0] = ((interrupt.Message) >>> 0) & 0xFFFF;
                Emulator.regs[9] = Emulator.regs[13];
                Emulator.cycles += 2;
            }
            else
            {
                if (!Emulator.InterruptQueueEnable)
                {
                    Emulator.InterruptQueue.shift();
                }
            }
        }

        if (Emulator.regs[9] == Emulator.regs[12])
        {
            Console.Log('*** breakpoint hit, emulation paused.');
            Emulator.paused = true;
            return;
        }

        var op = Emulator.mem[Emulator.regs[9]];
        Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
        var opcode = op & 0x1F;
        var a = (op >>> 10) & 0x3F;
        var b = (op >>> 5) & 0x1F;
        var apc = Emulator.regs[9];
        var asp = Emulator.regs[8];

        if (Emulator.regs[11])
        {
            if (opcode == 0)
            {
                Emulator.cycles += Emulator.extOpCycles[b];
                var aval = GetVal(a, 1);
                switch (b)
                {
                    case 0x1: // JSR a
                        LogJSR("JSR");                        
                        Emulator.regs[8]=(Emulator.regs[8]+0xFFFF)&0xFFFF;
                        Emulator.WriteMem(Emulator.regs[8], Emulator.regs[9]);
                        Emulator.regs[9] = aval;
                        break;

                    case 0x7: // HCF a
                        Console.Log("Halt and catch fire instruction received. Emulation paused.");
                        Emulator.paused = true;
                        return;

                    case 0x8: // INT a
                        Emulator.InterruptQueue.push({ Message: aval });
                        break;

                    case 0x9: // IAG a
                        SetVal(a, Emulator.regs[13], apc, asp);
                        break;

                    case 0xA: // IAS a
                        Emulator.regs[13] = aval;
                        break;

                    case 0xB: // RFI a
                        if (Emulator.regs[13] != 0)
                        {
                            Emulator.InterruptQueueEnable = 0;
                            Emulator.regs[0] = Emulator.mem[Emulator.regs[8]];
                            Emulator.regs[8] = (Emulator.regs[8] + 1) & 0xFFFF;
                            Emulator.regs[9] = Emulator.mem[Emulator.regs[8]];
                            Emulator.regs[8] = (Emulator.regs[8]+1)&0xFFFF;
                        }
                        break;

                    case 0xC: // IAQ a
                        Emulator.InterruptQueueEnable = aval;
                        break;

                    case 0x10: // HWN a
                        SetVal(a, Emulator.Devices.length, apc, asp);
                        break;

                    case 0x11: // HWQ a
                        Emulator.regs[0] = Emulator.Devices[aval].hwType & 0xFFFF;
                        Emulator.regs[1] = (Emulator.Devices[aval].hwType >> 16) & 0xFFFF;
                        Emulator.regs[2] = Emulator.Devices[aval].hwRev & 0xFFFF;
                        Emulator.regs[3] = Emulator.Devices[aval].hwManufacturer & 0xFFFF;
                        Emulator.regs[4] = (Emulator.Devices[aval].hwManufacturer >> 16) & 0xFFFF;
                        break;

                    case 0x12: // HWI a
                        if (Emulator.Devices[aval] && Emulator.Devices[aval].hwI)
                        {
                            Emulator.cycles += Emulator.Devices[aval].hwI();
                        }
                        break;

                    default:
                        Console.Log('*** reserved extended instruction encountered at ' + (Emulator.regs[9] - 1) + '; emulation paused.');
                        Emulator.paused = true;
                        return;
                }
            }
            else
            {
                Emulator.cycles += Emulator.opCycles[opcode];
                var aval = GetVal(a, 1);
                apc = Emulator.regs[9];
                var bval = GetVal(b, 0);
                var tmp;
                switch (opcode)
                {
                    case 0x1: // SET
                        SetVal(b, aval, apc, asp);
                        break;
                    case 0x2: // ADD
                        tmp = bval + aval;
                        Emulator.regs[10] = (tmp >>> 16) & 0xFFFF;
                        SetVal(b, tmp & 0xFFFF, apc, asp);
                        break;
                    case 0x3: // SUB
                        tmp = (bval - aval) >>> 0;
                        Emulator.regs[10] = (tmp < 0) ? 0xFFFF : 0;
                        SetVal(b, (tmp >>> 0) & 0xFFFF, apc, asp);
                        break;
                    case 0x4: // MUL
                        tmp = bval * aval;
                        Emulator.regs[10] = (tmp >>> 16) & 0xFFFF;
                        SetVal(b, tmp & 0xFFFF, apc, asp);
                        break;
                    case 0x5: // MLI
                        tmp = AsSigned(bval) * AsSigned(aval);
                        Emulator.regs[10] = ((tmp >> 16) >>> 0) & 0xFFFF;
                        SetVal(b, (tmp >>> 0) & 0xFFFF, apc, asp);
                        break;
                    case 0x6: // DIV
                        Emulator.regs[10] = aval ? ((Math.floor((bval << 16) / aval) >>> 0) & 0xFFFF) : 0;
                        SetVal(b, aval ? Math.floor(bval / aval) : 0, apc, asp);
                        break;
                    case 0x7: // DVI
                        Emulator.regs[10] = aval ? ((Math.floor((AsSigned(bval) << 16) / AsSigned(aval)) >>> 0) & 0xFFFF) : 0;
                        SetVal(b, bval ? (Math.floor(AsSigned(bval) / AsSigned(aval)) >>> 0) & 0xFFFF : 0, apc, asp);
                        break;
                    case 0x8: // MOD
                        SetVal(b, bval ? (bval % aval) : 0, apc, asp);
                        break;
                    case 0x9: // MDI
                        SetVal(b, bval ? (AsSigned(bval) % AsSigned(aval)) : 0, apc, asp);
                        break;
                    case 0xA: // AND
                        SetVal(b, (bval & aval) >>> 0, apc, asp);
                        break;
                    case 0xB: // BOR
                        SetVal(b, (bval | aval) >>> 0, apc, asp);
                        break;
                    case 0xC: // XOR
                        SetVal(b, (bval ^ aval) >>> 0, apc, asp);
                        break;
                    case 0xD: // SHR
                        tmp = (bval << 16) >>> aval;
                        Emulator.regs[10] = tmp & 0xFFFF;
                        SetVal(b, (tmp >>> 16) & 0xFFFF, apc, asp);
                        break;
                    case 0xE: // ASR
                        tmp = (bval << 16) >> aval;
                        Emulator.regs[10] = tmp & 0xFFFF;
                        SetVal(b, (tmp >>> 16) & 0xFFFF, apc, asp);
                        break;
                    case 0xF: // SHL
                        tmp = (bval << aval) >>> 0;
                        Emulator.regs[10] = (tmp >>> 16) & 0xFFFF;
                        SetVal(b, tmp & 0xFFFF, apc, asp);
                        break;

                    case 0x10: // IFB
                        Emulator.regs[11] = (aval & bval) != 0;
                        break;
                    case 0x11: // IFC
                        Emulator.regs[11] = (aval & bval) == 0;
                        break;
                    case 0x12: // IFE
                        Emulator.regs[11] = (aval == bval);
                        break;
                    case 0x13: // IFN
                        Emulator.regs[11] = (aval != bval);
                        break;
                    case 0x14: // IFG
                        Emulator.regs[11] = (bval > aval);
                        break;
                    case 0x15: // IFA
                        Emulator.regs[11] = (AsSigned(bval) > AsSigned(aval));
                        break;
                    case 0x16: // IFL
                        Emulator.regs[11] = (bval < aval);
                        break;
                    case 0x17: // IFU
                        Emulator.regs[11] = (AsSigned(bval) < AsSigned(aval));
                        break;
                    case 0x1A: // ADX
                        tmp = bval + aval + Emulator.regs[10];
                        Emulator.regs[10] = (tmp >>> 16) & 0xFFFF;
                        SetVal(b, tmp & 0xFFFF, apc, asp);
                        break;
                    case 0x1B: // SUX
                        tmp = (bval - aval + Emulator.regs[10]) >>> 0;
                        Emulator.regs[10] = (tmp < 0) ? 0xFFFF : 0;
                        SetVal(b, (tmp >>> 0) & 0xFFFF, apc, asp);
                        break;

                    case 0x1E: // STI
                        SetVal(b, aval, apc, asp);
                        Emulator.regs[6] = (Emulator.regs[6] + 1) & 0xFFFF;
                        Emulator.regs[7] = (Emulator.regs[7] + 1) & 0xFFFF;
                        break;
                    case 0x1F: // STD
                        SetVal(b, aval, apc, asp);
                        Emulator.regs[6] = (Emulator.regs[6] + 0xFFFF) & 0xFFFF;
                        Emulator.regs[7] = (Emulator.regs[7] + 0xFFFF) & 0xFFFF;
                        break;

                    default:
                        Console.Log('*** reserved basic instruction encountered at ' + (Emulator.regs[9] - 1) + '; emulation paused.');
                        Emulator.paused = true;
                        break;
                }
            }
        }
        else
        {
            // skipped by IF* prefix
            Emulator.regs[11] = (opcode < 0x10) || (opcode > 0x17);
            if ((opcode > 0) && (b >= 0x10) && ((b < 0x18) || (b == 0x1a) || (b == 0x1e) || (b == 0x1f)))
            {
                Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
            }
            if ((a >= 0x10) && ((a < 0x18) || (a == 0x1a) || (a == 0x1e) || (a == 0x1f)))
            {
                Emulator.regs[9] = (Emulator.regs[9] + 1) & 0xFFFF;
            }
        }
    }

    // -----------------------
    function GetOperandDesc(_code, _isa)
    {
        if (_code < 0x08) { return [Emulator.regNames[_code], 0]; }
        if (_code < 0x10) { return ['[' + Emulator.regNames[_code - 0x8] + ']', 0]; }
        if (_code < 0x18) { return ['[[PC++]+' + Emulator.regNames[_code - 0x10] + ']', 1]; }
        if (_code >= 0x20) { return [Console.H16(((_code - 0x21) >>> 0) & 0xFFFF), 0]; }
        switch (_code)
        {
            case 0x18: return [_isa ? '[SP++]' : '[--SP]', 0];
            case 0x19: return ['[SP]', 0];
            case 0x1a: return ['[SP+[PC++]]', 1];
            case 0x1b: return ['SP', 0];
            case 0x1c: return ['PC', 0];
            case 0x1d: return ['EX', 0];
            case 0x1e: return ['[[PC++]]', 1];
            case 0x1f: return ['[PC++]', 1];
        }
    }

    // -----------------------
    Emulator.Disassemble = function(_addr)
    {
        var op = Emulator.mem[_addr];
        var opcode = op & 0x1F;
        var a = GetOperandDesc((op >>> 10) & 0x3F, 1);
        var b = GetOperandDesc((op >>> 5) & 0x1F, 0);

        var result = Console.H16(_addr) + ': ';
        var size = a[1];

        if (opcode == 0)
        {
            result += Emulator.extOpNames[(op >>> 5) & 0x1F] + ' ' + a[0];
        }
        else
        {
            size += b[1];
            result += Emulator.opNames[opcode] + ' ' + b[0] + ', ' + a[0];
            if (size > 0)
            {
                result += ' ; ';
                for (var i = 0; i < size; i++)
                {
                    result += '$' + Console.H16(Emulator.mem[_addr + i + 1]) + ' ';
                }
            }
        }

        if (Assembler.Lines
            && Assembler.MemMap
            && Assembler.MemMap[_addr]
            && Assembler.Lines[Assembler.MemMap[_addr] - 1]
        )
        {
            while (result.length < 56)
            {
                result = result + ' ';
            }
            result += '; ' + Assembler.MemMap[_addr] + ': ';
            result += Assembler.Lines[Assembler.MemMap[_addr] - 1].replace(/\t/g, ' ').substr(0, 130 - result.length);
        }

        return [result, size + 1];
    }

    // -----------------------   
    Emulator.GetStatusString = function()
    {
        var stat = '';
        for (var i = 0; i < Emulator.regNames.length; i++)
        {
            stat += Emulator.regNames[i] + ':' + Console.H16(Emulator.regs[i]) + ' ';
        }
        stat += Emulator.InterruptQueueEnable ? "Q" : "I";
        stat += Console.H8(Emulator.InterruptQueue.length) + " ";
        stat += Emulator.cycles + 'cyc ';
        stat += '\n' + Emulator.Disassemble(Emulator.regs[9])[0];
        if (!Emulator.regs[11])
        {
            stat += ' ; ( will skip ) ';
        }

        return stat;
    }
    
    Emulator.Status = function()
    {
        Console.Log(Emulator.GetStatusString());
    }

    // -----------------------
    Emulator.Reset = function()
    {
        Emulator.regs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0xFFFF, 0];
        Emulator.mem = new Array(0x10000);
        Emulator.cycles = 0;
        try
        {
            Emulator.regs = new Uint16Array(14);
            Emulator.mem = new Uint16Array(0x10000);
            Emulator.opCycles = new Uint16Array(Emulator.opCycles);
            Emulator.extOpCycles = new Uint16Array(Emulator.extOpCycles);
        }
        catch (e)
        {
            for (var i = 0; i < 0x10000; i++)
            {
                Emulator.mem[i] = 0;
            }
        }

        Emulator.regs[11] = 1;
        Emulator.regs[12] = 0xFFFF;
        Emulator.BackTrace = Emulator.BackTrace ? [] : null;
        Emulator.JSRHistory = Emulator.JSRHistory ? [] : null;

        Emulator.MemoryHooks = [];
        Emulator.InterruptQueue = [];
        Emulator.InterruptQueueEnable = 0;
        for( var i = 0; i < Emulator.Devices.length; i++ )
        {
            Emulator.Devices[i].hwReset();        
        }

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
                setTimeout(Emulator.Trace, 0);
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
        var pausedOnEntry = Emulator.paused;
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
                setTimeout(Emulator.Run, 0);
                return;
            }

            var cycles = Emulator.cycles;
            while ((!Emulator.paused) && ((Emulator.cycles - cycles) < 1000))
            {
                Emulator.Step();
                if( Emulator.BackTrace )
                {
                    if(Emulator.BackTrace.length > Emulator.BackTraceMax)
                    {
                        Emulator.BackTrace.shift();
                    }
                    Emulator.BackTrace.push(Emulator.GetStatusString());                
                }
            }
        }
        
        if( !pausedOnEntry && Emulator.paused )
        {
            if( Emulator.BackTrace && Emulator.BackTrace.length )
            {
                Console.Log("Execution history: ");
                Console.Log(Emulator.BackTrace.join("\n"));            
            }
            if( Emulator.JSRHistory && Emulator.JSRHistory.length )
            {
                Console.Log("JSR history: ");
                for(var i=0;i<Emulator.JSRHistory.length;i++)
                {
                    Console.Log( Emulator.JSRHistory[i][2] + "/" + Console.H16(Emulator.JSRHistory[i][1]) + " " + Emulator.Disassemble( Emulator.JSRHistory[i][0] ) );
                }            
            }
        }

        time = ((new Date()).getTime() - start);
        Emulator.walltime += time;
        Emulator.timedcycles += Emulator.cycles - startcyc;
    }

})();                                         // (function(){

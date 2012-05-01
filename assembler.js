// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------

(function()
{

    // ---------
    // Assembler
    // ---------

    function BeginNewBlock(_origin)
    {
        if (Assembler.BlockAccumulator.block.length)
        {
            Assembler.BlockAccumulator.blocks.push({ origin: Assembler.BlockAccumulator.origin, block: Assembler.BlockAccumulator.block });
        }
        Assembler.BlockAccumulator.block = [];
        Assembler.BlockAccumulator.origin = _origin;
    }

    function SetLabelOrigin(_origin)
    {
        Assembler.LabelResolver.pc = _origin;
    }

    function CountAssembledWords(_words)
    {
        Assembler.MemMap[Assembler.LabelResolver.pc] = Assembler.CurrLineNumber;
        Assembler.LabelResolver.pc += _words;
    }

    function DefinedLabel(_label)
    {
        return (Assembler.LabelResolver.labels['$' + _label.toLowerCase()] != undefined);
    }

    function EmitLabel(_label)
    {
        Assembler.LabelResolver.labels['$' + _label.toLowerCase()] = Assembler.LabelResolver.pc;
    }

    function SetNumericLabel(_id)
    {
        if (Assembler.LabelResolver.numericForward[_id])
        {
            EmitLabel(Assembler.LabelResolver.numericForward[_id]);
            Assembler.LabelResolver.numericForward[_id] = null;
        }
        var backward = '$' + Assembler.CurrLine() + '$' + _id;
        Assembler.LabelResolver.numericBackward[_id] = backward;
        EmitLabel(backward);
    }

    function EmitWord(_word)
    {
        Assembler.BlockAccumulator.block.push((_word >>> 0) & 0xFFFF);
    }

    var OpMap =
{
    set: 0x01,
    add: 0x02,
    sub: 0x03,
    mul: 0x04,
    mli: 0x05,
    div: 0x06,
    dvi: 0x07,
    mod: 0x08,
    mdi: 0x09,
    and: 0x0A,
    bor: 0x0B,
    xor: 0x0C,
    shr: 0x0D,
    asr: 0x0E,
    shl: 0x0F,
    ifb: 0x10,
    ifc: 0x11,
    ife: 0x12,
    ifn: 0x13,
    ifg: 0x14,
    ifa: 0x15,
    ifl: 0x16,
    ifu: 0x17,
    
    adx: 0x1a,
    sux: 0x1b,

    sti: 0x1e,
    std: 0x1f,

    jsr: 0x01,
    
    hcf: 0x07,
    int: 0x08,
    iag: 0x09,
    ias: 0x0a,
    rfi: 0x0b,
    iaq: 0x0c,
    
    hwn: 0x10,
    hwq: 0x11,
    hwi: 0x12,
}

    function BeginOp()
    {
        Assembler.BlockAccumulator.opstart = Assembler.BlockAccumulator.block.length;
        EmitWord(0);
    }

    function EmitBasicOp(_name, _bcode, _acode)
    {
        Assembler.BlockAccumulator.block[Assembler.BlockAccumulator.opstart] = (OpMap[_name.toLowerCase()] | (_acode << 10) | (_bcode << 5)) >>> 0;
    }

    function EmitExtendedOp(_name, _acode)
    {
        Assembler.BlockAccumulator.block[Assembler.BlockAccumulator.opstart] = ((OpMap[_name.toLowerCase()] << 5) | (_acode << 10)) >>> 0;
    }

    Assembler.Grammar =
    {
        START: ["labelledline | justlabels | line | emptyline"],
        emptyline: ["/\\s*/ $"],
        labelledline: ["justlabels line", function(_m) { return _m[1]; } ],
        justlabels: ["/\\s*/ labels /\\s*/"],
        line: ["/\\s*/ statement /\\s*/ $", function(_m) { return _m[1]; } ],
        statement: ["basicop | extendedop | directive"],

        basicop: ["basicopname /(,\\s*)?/ boperand /\\s*,?\\s*/ aoperand", function(_m)
        {
            CountAssembledWords(1);
            return (function(n, b, a)
            {
                return function() 
                { 
                    BeginOp(); 
                    var aval = a();
                    var bval = b();
                    EmitBasicOp(n, bval, aval); 
               }
            })(_m[0], _m[2], _m[4]);
        }
        ],
        extendedop: ["extendedopname aoperand", function(_m)
        {
            CountAssembledWords(1);
            return (function(n, a)
            {
                return function() { BeginOp(); EmitExtendedOp(n, a()); }
            })(_m[0], _m[1]);
        }
        ],
        directive: ["dat | origin | ret | brk | shell | def | autobranch"],

        basicopname: ["/\\b(set|add|sub|mul|mli|div|dvi|mod|mdi|and|bor|xor|shr|asr|shl|if[bcengalu]|adx|sux|sti|std)\\b/ /\\s*/",
            function(_m) { return _m[0]; } ],
        extendedopname: ["/\\b(?:jsr|hcf|int|iag|ias|rfi|iaq|hwn|hwq|hwi)\\b/ /(\\s*,\\s*)?/ /\\s*/", function(_m) { return _m[0]; } ],

        def: ["/[.]?\\bdef\\b\\s*/ identifier /(,\\s*)?/ expression", function(_m)
        {
            return Assembler.LabelResolver.labels['$' + _m[1].toLowerCase()] = eval(_m[3][0]);
        }
      ],

        dat: ["/[.]?\\b(dat|dc)\\b\\s*/ data", function(_m) { return _m[1]; } ],
        data: ["datatuple | dataunit"],
        datatuple: ["dataunit /\\s*,\\s*/ data", function(_m) { return (function(fn0, fn1) { return function() { fn0(); fn1(); } })(_m[0], _m[2]); } ],
        dataunit: ["dataliteral | quotedstring"],

        autobranch: ["/;b\\b\\s*/ expression", function(_m)
        {
            CountAssembledWords(1);
            var pc = Assembler.LabelResolver.pc;
            return (function(_pc, _expr)
            {
                return function()
                {
                    var tgt = (eval(_expr) >>> 0) & 0xFFFF;
                    BeginOp();
                    if (tgt < 0x1f)
                    {
                        EmitBasicOp('set', 0x1c, tgt + 0x21);
                    }
                    else if( tgt == 0xFFFF )
                    {                    
                        EmitBasicOp('set', 0x1c, 0x20);
                    }
                    else if ((_pc >= tgt) && ((_pc - tgt) < 0x1f))
                    {
                        EmitBasicOp('sub', 0x1c, (_pc - tgt) + 0x21);
                    }
                    else if ((tgt > _pc) && ((tgt - _pc) < 0x1f))
                    {
                        EmitBasicOp('add', 0x1c, (tgt - _pc) + 0x21);
                    }
                    else
                    {
                        Assembler.ErrorState = 1;
                        Console.Log("*** unable to generate single-word branch in line " + Assembler.CurrLine());
                    }
                }
            })(pc, _m[1][0]);
        } ],

        ret: ["/[.]?\\bret\\b/", function() { CountAssembledWords(1); return function() { BeginOp(); EmitBasicOp('set',0x1c,0x18); } } ],
        brk: ["/[.]?\\bbrk\\b/", function() { CountAssembledWords(1); return function() { EmitWord(0x7E0); } } ],
        shell: ["/[.]\\bshell\\b/ /\\s*/ /.+/", function(_m) { Console.Shell(_m[2]); } ],

        dataliteral: ["expression",
                function(_m) { CountAssembledWords(1); return (function(expr) { return function() { EmitWord(eval(expr)); } })(_m[0][0]); }
            ],

        quotedstring: ["singlequotedstring | doublequotedstring"],
        singlequotedstring: ["/'/ quotedstringdata /'\\s*/", function(_m) { return _m[1]; } ],
        doublequotedstring: ['/"/ quotedstringdata /"\\s*/', function(_m) { return _m[1]; } ],
        quotedstringdata: ["quotedstringtuple | quotedstringunit"],
        quotedstringtuple: ["quotedstringunit quotedstringdata", function(_m) { return (function(fn0, fn1) { return function() { fn0(); fn1(); } })(_m[0], _m[1]); } ],
        quotedstringunit: ["stringchar | escape",
          function(_m)
          {
              CountAssembledWords(1);
              return (function(_code) { return function() { EmitWord(_code); } })(_m[0]);
          }
        ],
        stringchar: ["/[^\"'\\\\]/", function(_m) { return _m[0].charCodeAt(0); } ],
        escape: ["'\\' escapecode", function(_m) { return _m[1]; } ],
        escapecode: ["numericescape | onecharescape"],
        onecharescape: ["/./",
        function(_m)
        {
            var code = _m[0].charCodeAt(0);
            switch (_m[0]) // http://msdn.microsoft.com/en-us/library/h21280bw%28v=vs.80%29.aspx
            {
                case 'a':
                    code = 7;
                    break;
                case 'b':
                    code = 8;
                    break;
                case 'f':
                    code = 12;
                    break;
                case 'n':
                    code = 10;
                    break;
                case 'r':
                    code = 13;
                    break;
                case 't':
                    code = 9;
                    break;
                case 'v':
                    code = 11;
                    break;
            }
            return code;
        }
      ],

        numericescape: ["/(([0][0-7][0-7][0-7])|([x][0-9a-fA-F][0-9a-fA-F]([0-9a-fA-F][0-9a-fA-F])?))/",
            function(_m) { return eval('0' + _m[0]); }
          ],

        origin: ["/[.]?\\b(org|origin)\\b/ /\\s*/ expression", function(_m)
        {
            return (function(expr)
            {
                SetLabelOrigin(eval(expr));
                return function()
                {
                    BeginNewBlock(eval(expr));
                }
            })(_m[2][0]);
        }
            ],


        aoperand: ["regindoffset | regindirect | pcinc"
                  + " | peek | pop | spindirect | reg_ex | reg_pc | reg_sp | reg_gpr | literalindirect | literal"],
        boperand: ["regindoffset | regindirect | pcinc"
                  + " | push | peek | spindirect | reg_ex | reg_pc | reg_sp | reg_gpr | literalindirect | literal_nextword"],

        labels: ["maybelabels | label"],
        maybelabels: ["label /\\s*/ labels"],
        label: ["prefixlabel | postfixlabel | numericlabel"],
        prefixlabel: ["':' identifier /\\s*/", function(_m) { EmitLabel(_m[1]); return 0; } ],
        postfixlabel: ["identifier ':' /\\s*/", function(_m) { EmitLabel(_m[0]); return 0; } ],
        numericlabel: ["/[0-9]+/ ':' /\\s*/", function(_m) { SetNumericLabel(_m[0]); return 0; } ],

        reg_gpr: ["/;[abcxyzijABCXYZIJ]/ /\\s*/", function(_m)
        {
            return (function(id)
            {
                return function()
                {
                    return id;
                }
            })('abcxyzij'.indexOf(_m[0].charAt(1).toLowerCase()));
        }
      ],

        reg_sp: ["/;sp\\s*/", function(_m) { return function() { return 0x1b; } } ],
        reg_pc: ["/;pc\\s*/", function(_m) { return function() { return 0x1c; } } ],
        reg_ex: ["/;ex\\s*/", function(_m) { return function() { return 0x1d; } } ],
        push: ["/(push\\b|\\[\\s*--\\s*;sp\\s*\\])\\s*/", function(_m) { return function() { return 0x18; } } ],
        pop: ["/(pop\\b|\\[\\s*;sp\\s*[+][+]\\s*\\])\\s*/", function(_m) { return function() { return 0x18; } } ],
        peek: ["/(peek\\b|\\[;sp\\])\\s*/", function(_m) { return function() { return 0x19; } } ],

        literal: ["expression", function(_m)
        {
            var expr = _m[0][0];
            if (_m[0][1] == 0)
            {
                var lit = ((eval(expr))>>>0) & 0xFFFF;
                if ((lit >= 0) && (lit <= 0x1e))
                {
                    return (function(l) { return function() { return l + 0x21; } })(lit);
                }
                if (lit == 0xFFFF)
                {
                    return (function(l) { return function() { return 0x20; } })(lit);
                }
            }
            CountAssembledWords(1);
            return (function(e)
            {
                return function()
                {
                    EmitWord(eval(e));
                    return 0x1f;
                }
            })(expr);
        }
          ],

        literal_nextword: ["expression", function(_m)
        {
            var expr = _m[0][0];
            CountAssembledWords(1);
            return (function(e)
            {
                return function()
                {
                    EmitWord(eval(e));
                    return 0x1f;
                }
            })(expr);
        }
          ],

        literalindirect: ["/\\[\\s*/ expression /\\s*\\]\\s*/",
          function(_m)
          {
              var expr = _m[1][0];
              CountAssembledWords(1);
              return (function(e)
              {
                  return function()
                  {
                      EmitWord(eval(e));
                      return 0x1e;
                  }
              })(expr);
          }
        ],

        spindirect: ["/\\[\\s*(;sp|pick)\\s*/ expression /\\s*\\]/",
          function(_m) { 
                  CountAssembledWords(1);
                  return (function(e)
                  {
                      return function()
                      {
                          EmitWord(eval(e));
                          return 0x1a;
                      }
                  })(_m[1][0]);                  
              } ],
          
          
        regindirect: ["/\\[\\s*/ /;[abcxyzijABCXYZIJ]/ /\\s*\\]\\s*/",
          function(_m) { return (function(id) { return function() { return id + 0x8; } })('abcxyzij'.indexOf(_m[1].charAt(1).toLowerCase())); } ],

        regindoffset: ["regindoffsetleft | regindoffsetright"],
        regindoffsetleft: ["/\\[\\s*/ expression /\\s*/ /[+-]/ /\\s*/ /;[abcxyzij]/ /\\s*\\]/",
          function(_m)
          {
              var expr = _m[3] + '(' + _m[1][0] + ')';
              var id = 'abcxyzij'.indexOf(_m[5].charAt(1).toLowerCase());
              CountAssembledWords(1);
              return (function(i, e)
              {
                  return function()
                  {
                      EmitWord(eval(e));
                      return i + 0x10;
                  }
              })(id, expr);
          }
        ],
        regindoffsetright: ["/\\[\\s*/ /;[abcxyzijABCXYZIJ]/ /\\s*/ /[+-]/ /\\s*/ expression /\\s*\\]/",
          function(_m)
          {
              var expr = _m[3] + '(' + _m[5][0] + ')';
              var id = 'abcxyzij'.indexOf(_m[1].charAt(1).toLowerCase());
              CountAssembledWords(1);
              return (function(i, e)
              {
                  return function()
                  {
                      EmitWord(eval(e));
                      return i + 0x10;
                  }
              })(id, expr);
          }
        ],

        expression: ["bool", function(_m) { return ['(((' + _m[0][0] + ')>>>0)&0xffff)', _m[0][1]]; } ],
        bool: ["boolop | shift"],
        shift: ["shiftop | sum"],
        sum: ["addop | mul"],
        mul: ["mulop | unaryop"],
        unaryop: ["invert | negate | val"],
        val: ["brackets | resolved_identifier | resolved_numericlabel | quoted_char_literal | number"],
        brackets: ["/\\(\\s*/ expression /\\s*\\)\\s*/", function(_m) { return ['(' + _m[1][0] + ')', _m[1][1]]; } ],
        resolved_identifier: ["identifier", function(_m)
        {
            if (DefinedLabel(_m[0]))
            {
                return [Assembler.ResolveLabel(_m[0]), 0];
            }
            return ["Assembler.ResolveLabel('" + _m[0] + "')", 1];
        }
      ],
        resolved_numericlabel: ["/[0-9]+/ /[bf]\\b/ /\\s*/", function(_m)
        {
            var lbl = '$' + Assembler.CurrLine() + '$' + _m[0];
            if (_m[1].toLowerCase() == 'b')
            {
                lbl = Assembler.LabelResolver.numericBackward[_m[0]];
                if (!lbl || !DefinedLabel(lbl))
                {
                    Console.Log(Assembler.CurrLine() + ': ' + ' undefined backward label ' + _m[0]);
                    Assembler.ErrorState = 1;
                }
                return [Assembler.ResolveLabel(lbl), 0];
            }

            if (Assembler.LabelResolver.numericForward[_m[0]])
            {
                lbl = Assembler.LabelResolver.numericForward[_m[0]];
            }
            else
            {
                Assembler.LabelResolver.numericForward[_m[0]] = lbl;
            }

            return ["Assembler.ResolveLabel('" + lbl + "')", 1];
        }
      ],
        quoted_char_literal: ["/'/ quoted_char_code /'/", function(_m) { return [_m[1], 0]; } ],
        quoted_char_code: ["stringchar | escape"],
        identifier: ["/[a-zA-Z_][a-zA-Z_0-9]+/ /\\s*/", function(_m) { return _m[0]; } ],
        number: ["/((0x[0-9a-fA-F]+)|(([0-9]+([.][0-9]+)?)|([.][0-9]+)))/ /\\s*/", function(_m) { return ["(" + _m[0] + ")", 0]; } ],
        boolop: ["shift /\\s*/ booloperator /\\s*/ bool", function(_m) { return ["(" + _m[0][0] + _m[2] + _m[4][0] + ")", _m[0][1] | _m[4][1]]; } ],
        shiftop: ["sum /\\s*/ shiftoperator /\\s*/ shift", function(_m) { return ["(" + _m[0][0] + _m[2] + _m[4][0] + ")", _m[0][1] | _m[4][1]]; } ],
        addop: ["mul /\\s*/ /[-+]/ /\\s*/ sum", function(_m) { return ["(" + _m[0][0] + _m[2] + _m[4][0] + ")", _m[0][1] | _m[4][1]]; } ],
        mulop: ["val /\\s*/ /[*\\/%]/ /\\s*/ mul", function(_m) { return ["(" + _m[0][0] + _m[2] + _m[4][0] + ")", _m[0][1] | _m[4][1]]; } ],
        invert: ["'~' expression", function(_m) { return ["((~(" + _m[1][0] + "))>>>0)", _m[1][1]]; } ],
        negate: ["'-' expression", function(_m) { return ["(-(" + _m[1][0] + "))", _m[1][1]]; } ],
        shiftoperator: ["'<<' | '>>'"],
        booloperator: ["'&' | '^' | '|'"]
    };

    Assembler.BlockAccumulator =
    {
        blocks: [],
        origin: 0,
        block: []
    };

    Assembler.LabelResolver =
    {
        labels: [],
        pc: 0
    };

    // -----------------------
    Assembler.ResolveLabel = function(_label)
    {
        if (Assembler.LabelResolver.labels['$' + _label.toLowerCase()] == undefined)
        {
            Assembler.ErrorState = 1;
            Console.Log("Unable to resolve '" + _label + "' in line " + Assembler.CurrLine());
            return 0;
        }
        return Assembler.LabelResolver.labels['$' + _label.toLowerCase()];
    }

    // -----------------------
    Assembler.Parser = new Parser(Assembler.Grammar);

    // -----------------------
    Assembler.Patch = function()
    {
        Console.Log("Writing assembled blocks to memory");

        for (var i = 0; i < Assembler.BlockAccumulator.blocks.length; i++)
        {
            var origin = Assembler.BlockAccumulator.blocks[i].origin;
            var block = Assembler.BlockAccumulator.blocks[i].block;
            for (var j = 0; j < block.length; j++)
            {
                Emulator.WriteMem((j + origin) & 0xFFFF, block[j]);
            }
            var line = (origin & 0xFFF0);
            while (line < (origin + block.length))
            {
                Emulator.Dump([line]);
                line += 0x10;
            }
        }
    }

    // -----------------------
    Assembler.IncludeRegexp = new RegExp('^\\s*[.]?include\\s*["]([^"]+)["]', 'im');
    Assembler.Assemble = function(_text)
    {
        Assembler.BlockAccumulator.blocks = [];

        // process includes
        Assembler.Program = _text;
        var m = Assembler.IncludeRegexp.exec(_text);
        if (m && m[1])
        {
            Console.ReadFile(m[1], function(_data)
            {
                Assembler.Program = Assembler.Program.replace(Assembler.IncludeRegexp, _data + "\n");
                setTimeout("Assembler.Assemble(Assembler.Program)", 0)
            }
            );
            return false;
        }

        // can actually start assembling now
        BeginNewBlock(0);
        Assembler.LabelResolver.pc = 0;
        Assembler.ErrorState = 0;
        Assembler.LabelResolver.numericForward = [];
        Assembler.LabelResolver.numericBackward = [];

        Assembler.Macros = [];
        Assembler.MacroStarts = [];

        var lines = _text.split(/\n/);
        Assembler.Lines = _text.split(/\n/);
        Assembler.MemMap = [];

        // so, I decided to use regular expressions to solve the problem of macro parsing...
        macroregexp = new RegExp('^[^;]*[.]?\\bmacro\\s+([A-Za-z0-9_]+)\\b(?:\\s*[(]?((?:(?:_[A-Za-z0-9_]+)\\s*,?\\s*)+)[)]?)?', 'i');

        // preprocessing
        var cmacro = [];
        for (var i = 0; i < lines.length; i++)
        {
            var line = lines[i].replace(/[\r\n]+/g, '').replace(/;.*$/g, ''); // strip comments, strip newline at end            

            // we need to escape names so they can be differentiated from labels, but not in quoted strings
            // split the line into quoted and nonquoted sections
            var tokens = [];
            var currtoken = '';

            for (var j = 0; j < line.length; j++)
            {
                switch (line[j])
                {
                    case '"':
                    case "'":
                        if (tokens.length & 1)
                        {
                            tokens.push(currtoken + line[j]);
                            currtoken = '';
                        }
                        else
                        {
                            tokens.push(currtoken);
                            currtoken = line[j];
                        }
                        break;
                    default:
                        currtoken += line[j];
                        break;
                }
            }
            tokens.push(currtoken);
            for (var j = 0; j < tokens.length; j += 2)
            {
                tokens[j] = tokens[j].replace(/\b([abcxyzij]|pc|sp|ex)\b(?!['])/ig, ';$&');
            }
            line = tokens.join('');

            var match = (macroregexp).exec(line);
            if (match)
            {
                var conv = [match[1]];
                var params = [];
                if (match.length > 1)
                {
                    var spl = match[2].split(','); // ...about here I'm realising I now have two problems.
                    for (var j = 0; j < spl.length; j++)
                    {
                        params.push(((/^\s*\b(_[A-Za-z0-9_]+)\b\s*/).exec(spl[j]))[1]);
                    }
                }
                for (var j = 0; j < params.length; j++)
                {
                    conv.push(new RegExp('\\b' + params[j] + '\\b', 'g'));
                }
                cmacro.unshift(conv);
                Assembler.Macros[cmacro[0][0]] = cmacro;
                Assembler.MacroStarts[cmacro[0][0]] = i + 1;
                line = '';
            }
            else if ((/^[^;]*[.]?\bendm\b/i).test(line))
            {
                cmacro = [];
                line = '';
            }
            else if (cmacro.length)
            {
                Assembler.Macros[cmacro[0][0]].push(line);
                line = '';
            }
            lines[i] = line;
        }

        var macrore = '';
        for (var mdesc in Assembler.Macros)
        {
            macrore += '(?:\\b(' + mdesc + ')\\b\\s*';
            var mparam = Assembler.Macros[mdesc][0];
            if (mparam.length > 1)
            {
                // please just make it stop
                macrore += '[(]?(';
                for (var j = 1; j < mparam.length; j++)
                {
                    macrore += '\\s*[^,()]+\\s*,'; // just kill me now
                }
                macrore = macrore.substring(0, macrore.length - 1) + ')[)]?';
            }
            macrore += ')|';
        }
        macrore = macrore.substring(0, macrore.length - 1);
        macrore = new RegExp(macrore, 'i');

        // assemble
        var result = [];
        for (var i = 0; i < lines.length; i++)
        {
            Assembler.CurrLine = (function(_i) { return function() { return _i + 1; }; })(i);
            Assembler.CurrLineNumber = i + 1;
            var toparse = [lines[i]];
            var macro = macrore.exec(toparse[0]);
            if (macro)
            {
                macro.shift();
                while (macro.length && (macro[0] == undefined))
                {
                    macro.shift(); // for the love of all that is good, WHY DID YOU SPEC THAT? Why?
                }
            }
            if (macro && Assembler.Macros[macro[0]])
            {
                var parambodies = [];
                if (macro.length > 0)
                {
                    parambodies = macro[1].split(',');
                }

                toparse.pop();
                var source = Assembler.Macros[macro[0]];
                var sourcedesc = source[0];
                for (var j = 1; j < source.length; j++)
                {
                    var sourceline = source[j];
                    for (var k = 1; k < sourcedesc.length; k++)
                    {
                        if (k > parambodies.length)
                        {
                            Console.Log(Assembler.CurrLine() + ": Not enough parameters supplied for macro invocation.");
                            Assembler.ErrorState = 1;
                            parambodies[k - 1] = '';
                        }
                        sourceline = sourceline.replace(sourcedesc[k], parambodies[k - 1]);
                    }
                    toparse.push(sourceline);
                }
            }
            else
            {
                macro = null;
            }

            for (var j = 0; j < toparse.length; j++)
            {
                var r = [];
                var err = '';
                line = toparse[j];

                Assembler.CurrLine = (function(_str) { return function() { return _str; } })
                (
                    macro ?
                        ((i + 1) + ' (macro "' + macro[0] + '" expansion, line ' + (Assembler.MacroStarts[macro[0]] + j) + ')')
                       : (i + 1)

                );

                try
                {
                    // you know what? Let's just use a good old-fashioned parser like I should have done
                    r = Assembler.Parser.Parse(line);
                }
                catch (e)
                {
                    Assembler.ErrorState = 1;
                    err = '; javascript exception: ' + e.toString();
                }

                if (!r[0])
                {
                    Assembler.ErrorState = 1;
                    Console.Log(Assembler.CurrLine() + ": failed to parse " + line);
                }

                try
                {
                    if (typeof (r[1] == 'function'))
                    {
                        var assemblefn = r[1]();
                        if (typeof (assemblefn) == 'function')
                        {
                            result.push([Assembler.CurrLine, assemblefn, Assembler.CurrLineNumber]);
                        }
                    }
                }
                catch (e)
                {
                    if (!Assembler.ErrorState)
                    {
                        Assembler.ErrorState = 1;
                        Console.Log("Assembling line " + Assembler.CurrLine() + ": assembler javascript error " + e.toString());
                    }
                }
            }
        }

        for (var i = 0; i < result.length; i++)
        {
            Assembler.CurrLine = result[i][0];
            Assembler.CurrLineNumber = result[i][2];
            result[i][1]();
        }
        BeginNewBlock(0);

        if (!Assembler.ErrorState)
        {
            Assembler.Status();
        }

        Assembler.CurrLineNumber = undefined;
        Assembler.CurrLine = undefined;
        return Assembler.ErrorState;
    }

    // -----------------------
    Assembler.Status = function()
    {
        if (Assembler.BlockAccumulator.blocks.length == 0)
        {
            Console.Log("No data retained in assembler blocks.");
        }
        else
        {
            var size = 0;

            for (var i = 0; i < Assembler.BlockAccumulator.blocks.length; i++)
            {
                size += Assembler.BlockAccumulator.blocks[i].block.length;
            }

            Console.Log("Assembler holds " + Assembler.BlockAccumulator.blocks.length + " block"
        + ((Assembler.BlockAccumulator.blocks.length > 1) ? "s, totalling " : " ") + size + " words.");
        }
    }

})();          // (function(){

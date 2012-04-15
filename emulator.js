// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------

// exposed globals

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

  //          0     1     2     3     4     5     6     7     8     9   10   11
  regNames: ['A',  'B',  'C',  'X',  'Y',  'Z',  'I',  'J', 'SP', 'PC', 'O', 'if' ],
  regs:     [ 0,    0,    0,    0,    0,    0,    0,    0,    0,    0,   0,   1 ],
  opNames:  [ '', 'SET', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'SHL', 'SHR', 'AND', 'BOR', 'XOR', 'IFE', 'IFN', 'IFG', 'IFB'],
  opCycles: [  0,    1,     2,     2,     2,     3,     3,     2,     2,     1,     1,     1,     2,     2,     2,     2],  
  mem: new Array(0x10000),
  cycles: 0,
  paused: 0,
  STDIN: []
};

var Assembler =
{
  Program: ''
};

// hidden innards (nothing below here is added to global namespace)
(function(){

// -----------------------
// Emulator implementation
// -----------------------

// -----------------------
Emulator.WriteMem = function(_addr, _value)
{
  Emulator.mem[_addr] = _value;
}

// -----------------------
function GetVal( _code )
{
  // cases laid out such that processing cost proportions are comparable to hardware
  if( _code >= 0x20 )
  {
    return (_code - 0x20);
  }
  if( _code < 0x08 )
  {
    return Emulator.regs[_code];
  }
  switch( _code )
  {
    case 0x18: 
      Emulator.regs[8] = (Emulator.regs[8]+1)&0xFFFF;
      return Emulator.mem[Emulator.mem[Emulator.regs[8]]];
    case 0x19: return Emulator.mem[Emulator.mem[(Emulator.regs[8])]];
    case 0x1A: 
      Emulator.regs[8] = (Emulator.regs[8]+0xFFFF)&0xFFFF;
      return Emulator.mem[Emulator.mem[Emulator.regs[8]]];
    case 0x1B: return Emulator.regs[8];
    case 0x1C: return Emulator.regs[9];
    case 0x1D: return Emulator.regs[10];

    case 0x1E:
        Emulator.cycles++;
        var result = Emulator.mem[Emulator.mem[Emulator.regs[9]]];
        Emulator.regs[9]=(Emulator.regs[9]+1)&0xFFFF;
      return result;

    case 0x1F:
        Emulator.cycles++;
        var result = Emulator.mem[Emulator.regs[9]];
        Emulator.regs[9]=(Emulator.regs[9]+1)&0xFFFF;
      return result;
        
    default:
        if( _code < 0x10 )
        {
          Emulator.cycles++;
          return Emulator.mem[Emulator.regs[_code-0x08]];
        }
      break;
  }
  Emulator.cycles++;
  var result = Emulator.mem[Emulator.mem[Emulator.regs[9]] + Emulator.regs[_code-0x10]];
  Emulator.regs[9]=(Emulator.regs[9]+1)&0xFFFF;
  return result;
}

// -----------------------
function SetVal( _code, _val )
{
  // note a has already been fetched with GetVal
  if( _code < 0x20 )
  {
    if( _code < 0x08 )
    {
      Emulator.regs[_code] = _val;
    }
    else
    {
      switch( _code )
      {
        case 0x18: Emulator.mem[(Emulator.regs[8]+0xFFFF)&0xFFFF] = _val; return;
        case 0x19: Emulator.mem[Emulator.regs[8]] = _val; return;
        case 0x1A: Emulator.mem[Emulator.regs[8]] = _val; return;
        case 0x1B: Emulator.regs[8] = _val; return;
        case 0x1C: Emulator.regs[9] = _val; return;
        case 0x1D: Emulator.regs[10] = _val; return;
        case 0x1E: Emulator.mem[Emulator.mem[(Emulator.regs[9]+0xFFFF)&0xFFFF]] = _val; return;
        case 0x1F: Emulator.mem[(Emulator.regs[9]+0xFFFF)&0xFFFF] = _val; return;
      }
    }
    if( _code < 0x10 )
    {
      Emulator.mem[Emulator.regs[_code-0x08]] = _val; return;            
    }
    Emulator.mem[Emulator.mem[(Emulator.regs[9]+0xFFFF)&0xFFFF] + Emulator.regs[_code-0x10]] = _val;
  }
}

// -----------------------
Emulator.Step = function()
{
  var op = Emulator.mem[Emulator.regs[9]];
  Emulator.regs[9] = (Emulator.regs[9]+1)&0xFFFF;
  var opcode = op & 0xF;
  var a = (op>>>4)&0x3F;
  var b = (op>>>10)&0x3F;

  if( Emulator.regs[11] )
  {
    var result;

    if( opcode == 0 )
    {
      switch( b )
      {
        case 0x1: // JSR a
            Emulator.cycles+=2;
            Emulator.mem[--Emulator.regs[8]] = Emulator.regs[9];
            Emulator.regs[9] = GetVal(a);
          break;

        default:
            Console.Log( '*** reserved instruction encountered at ' + (Emulator.regs[9]-1) + '; emulation paused.' );
            Emulator.paused = true;
          return;
      }
    }
    else
    {
      Emulator.cycles+=Emulator.opCycles[opcode];
      var tmp;
      switch( opcode )
      {
        case 0x1: // SET
              result = GetVal(b);
            break;
        case 0x2: // ADD
              tmp = GetVal(a) + GetVal(b);
              result = tmp & 0xFFFF;
              Emulator.regs[10] = (tmp>>>16) & 0xFFFF;
            break;
        case 0x3: // SUB
              tmp = (GetVal(a) - GetVal(b))>>>0;
              result = (tmp>>>0) & 0xFFFF;
              Emulator.regs[10] = (tmp<0) ? 0xFFFF : 0;
            break;
        case 0x4: // MUL
              tmp = GetVal(a) * GetVal(b);
              result = tmp & 0xFFFF;
              Emulator.regs[10] = (tmp>>>16) & 0xFFFF;
            break;
        case 0x5: // DIV
              Emulator.regs[10] = GetVal(a);
              tmp = GetVal(b);
              result = tmp ? Math.floor(Emulator.regs[10]/tmp) : 0;
              Emulator.regs[10] = tmp ? ((Math.floor((Emulator.regs[10]<<16)/tmp)&0xFFFF)>>>0) : 0;
            break;
        case 0x6: // MOD
              result = GetVal(a);
              tmp = GetVal(b);
              result = tmp ? (result%tmp) : 0;
            break;
        case 0x7: // SHL
              tmp = (GetVal(a) << GetVal(b))>>>0;
              result = (tmp>>>0) & 0xFFFF;
              Emulator.regs[10] = (tmp>>>16) & 0xFFFF;
            break;
        case 0x8: // SHR
              tmp = (GetVal(a) << 16) >>> GetVal(b);
              result = (tmp>>>16) & 0xFFFF;
              Emulator.regs[10] = tmp & 0xFFFF;
            break;
        case 0x9: // AND
              result = (GetVal(a) & GetVal(b))>>>0;
            break;
        case 0xA: // BOR
              result = (GetVal(a) | GetVal(b))>>>0;
            break;
        case 0xB: // XOR
              result = (GetVal(a) ^ GetVal(b))>>>0;
            break;
        case 0xC: // IFE
              Emulator.regs[11] = (GetVal(a) == GetVal(b));
            break;
        case 0xD: // IFN
              Emulator.regs[11] = (GetVal(a) != GetVal(b));
            break;
        case 0xE: // IFG
              Emulator.regs[11] = (GetVal(a) > GetVal(b));
            break;
        case 0xF: // IFB
              Emulator.regs[11] = (GetVal(a) & GetVal(b));
            break;
      }
    }
    
    if( result != undefined )
    {
      SetVal( a, result );
    }    
   }
   else
   {
      // skipped by IF* prefix
      Emulator.regs[11] = true;
      if( (a >= 0x10) && ((a < 0x18)||(a==0x1e)||(a==0x1f)) )
      {
        Emulator.regs[9] = (Emulator.regs[9]+1)&0xFFFF;
      }
      if( (opcode > 0) && (b >= 0x10) && ((b < 0x18)||(b==0x1e)||(b==0x1f)) )
      {
        Emulator.regs[9] = (Emulator.regs[9]+1)&0xFFFF;
      }
   }
}

// -----------------------
function H8(_i)
{
    var h = _i.toString(16);
    while( h.length < 2 )
    {
        h = '0' + h;
    }
    return h;
}

// -----------------------
function H16(_i)
{
    var h = _i.toString(16);
    while( h.length < 4 )
    {
        h = '0' + h;
    }
    return h;
}

// -----------------------
function GetOperandDesc(_code)
{
  if( _code < 0x08 ) { return [ Emulator.regNames[_code], 0 ]; }
  if( _code < 0x10 ) { return [ '['+Emulator.regNames[_code-0x8]+']', 0 ]; }
  if( _code < 0x18 ) { return [ '[[PC++]+'+Emulator.regNames[_code-0x10]+']', 1 ]; }
  if( _code >= 0x20 ) { return [ H16(_code - 0x20), 0 ]; }
  switch( _code )
  {
    case 0x18: return [ '[SP++]', 0 ];
    case 0x19: return [ '[SP]', 0 ];
    case 0x1a: return [ '[--SP]', 0 ];
    case 0x1b: return [ 'SP', 0 ];
    case 0x1c: return [ 'PC', 0 ];
    case 0x1d: return [ 'O', 0 ];
    case 0x1e: return [ '[[PC++]]', 1 ];
    case 0x1f: return [ '[PC++]', 1 ];
  }
}

// -----------------------
Emulator.Disassemble = function(_addr)
{
  var op = Emulator.mem[_addr];
  var opcode = op & 0xF;
  var a = GetOperandDesc((op>>>4)&0x3F);
  var b = GetOperandDesc((op>>>10)&0x3F);
  
  var result = H16(_addr) + ': ' + Emulator.opNames[opcode];
  var size = a[1];

  if( opcode == 0 )
  {
    switch( opcode )
    {
      case 1: result += 'JSR ' + a[0]; break;
      default: result += '?'+H8(opcode)+' ' + a[0]; break;
    }
  }
  else
  {
    size += b[1];
    result += ' ' + a[0] + ', ' + b[0];
    if( size > 0 )
    {
      result += ' ;  ';
      for( var i = 0; i < size; i++ )
      {
        result += H16(_addr+i+1) + ': ' + H16(Emulator.mem[_addr+i+1]) + '  ';
      }
    }
  }
  
  return [ result, size + 1 ];
}

// -----------------------
Emulator.Status = function()
{
  var stat = '';
  for( var i = 0; i < Emulator.regNames.length; i++ )
  {
    stat += Emulator.regNames[i] + ':' + H16(Emulator.regs[i]) + '  ';
  }
  stat += '\n' + Emulator.Disassemble(Emulator.regs[9])[0];
  
  Console.Log(stat); 
}

// -----------------------
Emulator.Reset = function()
{
  Emulator.regs = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
  Emulator.mem = new Array(0x10000);
  Emulator.cycles = 0;
  Emulator.operandCycles = [];
  try
  {
    Emulator.regs = new Uint16Array(12);
    Emulator.mem = new Uint16Array(0x10000);
    Emulator.opCycles = new Uint16Array(Emulator.opCycles);
    Emulator.operandCycles = new Uint16Array(0x40);
  }
  catch(e)
  {
    for( var i = 0; i < 0x10000; i++ )
    {
      Emulator.mem[i] = 0;
    }
    for( var i = 0; i < 0x40; i++ )
    {
      Emulator.operandCycles[i] = 0;
    }
  }
  Emulator.regs[11] = 1;
  
  for( var i = 0x10; i <= 0x17; i++ )
  {
    Emulator.operandCycles[i] = 1;
  }
  Emulator.operandCycles[0x1e] = 1;
  Emulator.operandCycles[0x1f] = 1;
  
  Emulator.STDIN = [];  
  Console.Log('Ready.');
}

// -----------------------
Emulator.Dump = function(_arg)
{
  var addr = _arg.shift();
  var count = _arg.shift();
  addr = (addr==undefined) ? 0 : eval('0x'+addr) & 0xFFF0;
  count = (count == undefined) ? 1 : eval('0x'+count);
  var result = '';
  for( var i = 0; i < count; i++ )
  {
    result += H16(addr) + ':  ';
    for( var j = 0; j < 16; j++ )
    {
      result += H16(Emulator.mem[addr++]) + ' ';
    }
    result += '\n';
  }
  result = result.substring(0, result.length-1);
  Console.Log(result);
}



// ---------
// Assembler
// ---------

function BeginNewBlock(_origin)
{
  if( Assembler.BlockAccumulator.block.length )
  {
    Assembler.BlockAccumulator.blocks.push( { origin: Assembler.BlockAccumulator.origin, block: Assembler.BlockAccumulator.block } );
  }
  Assembler.BlockAccumulator.block = [ ];
  Assembler.BlockAccumulator.origin = _origin;
}

function SetLabelOrigin(_origin)
{
  Assembler.LabelResolver.pc = _origin;
}

function CountAssembledWords(_words)
{
  Assembler.LabelResolver.pc += _words;
}

function EmitLabel(_label)
{
  Assembler.LabelResolver.labels[_label] = Assembler.LabelResolver.pc;
}

function EmitWord(_word)
{
  Assembler.BlockAccumulator.block.push((_word>>>0)&0xFFFF);
}

var OpMap = 
{
  set: 1,
  add: 2,
  sub: 3,
  mul: 4,
  div: 5,
  mod: 6,
  shl: 7,
  shr: 8,
  and: 9,
  bor: 10,
  xor: 11,
  ife: 12,
  ifn: 13,
  ifg: 14,
  ifb: 15,

  jsr: 1
}

function BeginOp()
{
  Assembler.BlockAccumulator.opstart = Assembler.BlockAccumulator.block.length;
  EmitWord(0);  
}

function EmitBasicOp( _name, _acode, _bcode )
{
  Assembler.BlockAccumulator.block[Assembler.BlockAccumulator.opstart] = (OpMap[_name]|(_acode<<4)|(_bcode<<10))>>>0;
}

function EmitExtendedOp( _name, _acode )
{
  Assembler.BlockAccumulator.block[Assembler.BlockAccumulator.opstart] = (OpMap[_name]<<4|(_acode<<10))>>>0;
}

Assembler.Grammar =
    {
      START: ["labelledline | line | emptyline"],
      emptyline: ["/\\s*/ $"],
      labelledline: ["/\\s*/ labels /\\s*/ line",   function(_m) { return _m[3]; }],
      line: ["/\\s*/ statement /\\s*/ $",           function(_m) { return _m[1]; }],
      statement: ["basicop | extendedop | directive"],

      basicop: ["basicopname operand /\\s*,\\s*/ operand", function(_m) 
          {
            CountAssembledWords(1); 
            return (function(n, a, b){
               return function() { BeginOp(); EmitBasicOp( n, a(), b() ); }
              })( _m[0], _m[1], _m[3] );
          }
        ],
      extendedop: ["extendedopname operand", function(_m) 
          { 
            CountAssembledWords(1);
            return (function(n, a){
              return function() { BeginOp(); EmitExtendedOp( n, a() ); }
            })( _m[0], _m[1] );
          }
        ],
      directive: ["dat | origin"],
      
      basicopname: ["/set|add|sub|mul|div|mod|shl|shr|and|bor|xor|ife|ifn|ifg|ifb/ /\\s*/", 
            function(_m) { return _m[0]; }],
      extendedopname: ["/jsr/ /\\s*/", function(_m) { return _m[0]; }],
      
      dat: ["'dat' /\\s*/ data",       function(_m) { return _m[2]; } ],
      data: ["datatuple | dataunit" ],
      datatuple: ["dataunit /\\s*,\\s*/ data", function(_m){ return (function(fn0,fn1){return function(){fn0();fn1();}})(_m[0],_m[2]); } ],
      dataunit: ["literal",
                function(_m){ CountAssembledWords(1); return (function(fn){return function() { EmitWord(fn()); }})(_m); }
            ],
      
      origin: [ "/[.]?(org|origin)/ /\\s*/ expression", function(_m)
                { 
                  return (function(expr){
                    SetLabelOrigin(eval(expr));
                    return function() 
                    { 
                      BeginNewBlock(eval(expr)); 
                    }
                  })(_m[2][0]);
                }
            ],
      
      
      operand: ["regindoffset | regindirect | spdec | spinc | pcinc" 
                  + " | push | peek | pop | reg_o | reg_pc | reg_sp | reg_gpr | literalindirect | literal" ],
            
      labels: ["maybelabels | label" ],
      maybelabels: ["label /\\s*/ labels" ],
      label: ["prefixlabel | postfixlabel" ],
      prefixlabel: ["':' /[a-zA-Z_][a-zA-Z_0-9]+/ /\\s*/",  function(_m) { EmitLabel(_m[1]); return 0; } ],
      postfixlabel: ["/[a-zA-Z_][a-zA-Z_0-9]+/ ':' /\\s*/",  function(_m) { EmitLabel(_m[0]); return 0; } ],
      
      reg_gpr: ["/;[abcxyzij]/ /\\s*/",function(_m) 
        { 
          return (function(id)
          {
              return function()
              {
                return id;
              }
          })('abcxyzij'.indexOf(_m[0].charAt(1)));
        }
      ],
      
      reg_sp: ["/;sp\\s*/",           function(_m) { return function() { return 0x1b; } } ],
      reg_pc: ["/;pc\\s*/",           function(_m) { return function() { return 0x1c; } }],
      reg_o: ["/;o\\s*/",             function(_m) { return function() { return 0x1d; } }],
      spinc: ["/\\[\\s*;sp\\s*[+][+]\\s*\\]\\s*/", function(_m) { return function() { return 0x18; } }],
      spdec: ["/\\[\\s*--\\s*;sp\\s*\\]\\s*/", function(_m) { return function() { return 0x1a; } }],
      push: ["/push\\s*/",            function(_m) { return function() { return 0x18; } }],
      pop: ["/pop\\s*/",              function(_m) { return function() { return 0x1a; } }],
      peek: ["/peek\\s*/",            function(_m) { return function() { return 0x1b; } } ],

      literal: ["expression",     function(_m) 
            { 
                var expr = _m[0][0];
                if( _m[0][1] == 0 )
                {
                  var lit = eval(expr);
                  if( (lit >= 0) && (lit <= 0x1f) )
                  {
                    return (function(l){return function() { return l + 0x20; }})(lit);
                  }
                }
                CountAssembledWords(1);
                return (function(e){ return function() 
                { 
                  EmitWord(eval(e));
                  return 0x1f;
                }})(expr);
            } 
          ],
      
      literalindirect: ["/\\[\\s*/ expression /\\s*\\]\\s*/", 
          function(_m) { 
            var expr = _m[1][0];
            CountAssembledWords(1);
            return (function(e){return function() 
            { 
              EmitWord(eval(e));
              return 0x1e;
            }})(expr);
          }
        ],
        
      regindirect: ["/\\[\\s*/ /;[abcxyzij]/ /\\s*\\]\\s*/", 
          function(_m) { return (function(id){return function(){return id+0x8;}})('abcxyzij'.indexOf(_m[0].charAt(1))); } ],
          
      regindoffset: ["/\\[\\s*/ expression /\\s*\\+\\s*/ /;[abcxyzij]/ /\\s*\\]/",
          function(_m) { 
            var expr = _m[1][0];
            var id = 'abcxyzij'.indexOf(_m[3].charAt(1));
            CountAssembledWords(1);
            return (function(i, e){
            return function() 
            { 
              EmitWord(eval(e));
              return i + 0x10;
            }})(id, expr);
          }
        ],      
      
      expression:     ["sum"],
      sum:            ["addop | mul"],
      mul:            ["mulop | val"],
      val:            ["brackets | identifier | number"],
      brackets:       ["/\\(\\s*/ expression /\\s*\\)\\s*/", function(_m){ return ['(' + _m[1][0] + ')', _m[1][1] ]; } ],
      identifier:     ["/[a-zA-Z_][a-zA-Z_0-9]+/ /\\s*/",function(_m){ return ["Assembler.ResolveLabel('" + _m[0] + "')", 1]; }],
      number:         ["/((0x[0-9a-fA-F]+)|(([0-9]+([.][0-9]+)?)|([.][0-9]+)))/ /\\s*/",function(_m){ return ["("+_m[0]+")", 0]; } ],
      addop:          ["mul /\\s*/ /[-+]/ /\\s*/ sum",   function(_m){ return ["("+_m[0][0]+_m[2]+_m[4][0]+")", _m[0][1]|_m[4][1] ]; } ],
      mulop:          ["val /\\s*/ /[*\\/%]/ /\\s*/ mul",function(_m){ return ["("+_m[0][0]+_m[2]+_m[4][0]+")", _m[0][1]|_m[4][1] ]; } ],
    };
        
Assembler.BlockAccumulator = 
    {
      blocks: [ ],
      origin: 0,
      block: [ ]      
    };
    
Assembler.LabelResolver = 
    {
      labels: [ ],
      pc: 0
    };

// -----------------------
Assembler.ResolveLabel = function( _label )
{
  if( Assembler.LabelResolver.labels[_label] == undefined )
  {
    Assembler.ErrorState = 1;
    Console.Log( "*** warning: unable to resolve '" + _label + "' in line " + Assembler.CurrLine );
    return 0;
  }
  return Assembler.LabelResolver.labels[_label];
}

// -----------------------
Assembler.Parser = new Parser(Assembler.Grammar);

// -----------------------
Assembler.Reset = function()
{
  Assembler.BlockAccumulator = { blocks: [ ], origin: 0, block: [ ] };
  Assembler.LabelResolver = { labels: [ ], pc: 0 };
  Assembler.CurrLine = 1;
}

// -----------------------
Assembler.Patch = function()
{
  Console.Log("Writing assembled blocks to memory");
  
  for( var i = 0; i < Assembler.BlockAccumulator.blocks.length; i++ )
  {
    var origin = Assembler.BlockAccumulator.blocks[i].origin;
    var block = Assembler.BlockAccumulator.blocks[i].block;
    for( var j = 0; j < block.length; j++ )
    {
      Emulator.mem[j+origin] = block[j];
    }
    var line = (origin & 0xFFF0);
    while( line < (origin + block.length) )
    {
        Emulator.Dump([line]);
        line += 0x10;        
    }
  }
}

// -----------------------
Assembler.Assemble = function(_text)
{
  Assembler.Program = _text;
  BeginNewBlock(0);
  Assembler.BlockAccumulator.blocks = [ ];
  Assembler.LabelResolver.pc = 0;
  Assembler.ErrorState = 0;
  var lines = _text.split(/\n/);
  var result = [ ];
  for( var i = 0; i < lines.length; i++ )
  {
    Assembler.CurrLine = i+1;
    var line = lines[i].toLowerCase().replace(/;.+$/g, '' ).replace(/[\r\n]/g, ''); // lower case, strip comments, strip newline at end
    line = line.replace(/\b([abcxyzij]|pc|sp|o)\b/g, ';$&'); // escape register names so they can be differentiated from labels
    var r = [];
    var err = '';
    try
    {
      r = Assembler.Parser.Parse(line);
    }
    catch (e)
    {
      err = '; javascript exception: ' + e.toString();
    }
    
    if( !r[0] )
    {
      Assembler.ErrorState = 1;
      Console.Log( Assembler.CurrLine + ": failed to parse " + lines[i] + err );
    }
    
    if( typeof(r[1]=='function') )
    {
      var assemblefn = r[1]();
      if( typeof(assemblefn) =='function' )
      {
        result.push( [ i+1, assemblefn ] );
      }
    }
  }
  
  for( var i = 0; i < result.length; i++ )
  {
    Assembler.CurrLine = result[i][0];
    result[i][1]();
  }
  BeginNewBlock(0);
  
  if( !Assembler.ErrorState )
  {
    Assembler.Status();
  }
  
  Assembler.CurrLine = undefined;
  return Assembler.ErrorState;
}

// -----------------------
Assembler.Status = function()
{
  if( Assembler.BlockAccumulator.blocks.length == 0 )
  {
    Console.Log( "No data retained in assembler blocks." );
  }
  else
  {  
   var size = 0;
   
   for( var i = 0; i < Assembler.BlockAccumulator.blocks.length; i++ )
   {
      size += Assembler.BlockAccumulator.blocks[i].block.length;
   }
   
   Console.Log( "Assembler holds " + Assembler.BlockAccumulator.blocks.length + " block" 
        + ((Assembler.BlockAccumulator.blocks.length>1)?"s, totalling ":" ") + size + " words." );
  }
}

// -------------
// Debug console
// -------------

var DebugCommands = 
{
  clear:
  {
    help: 'clear\nClears the debug log area.',
    fn: function()
    {
      Console.logArea.value = '';
    }
  },

  reset:
  {
    help: 'reset\nResets the VM to power-on state.',
    fn: function()
    {
      Console.logArea.value = '';
      Emulator.Reset();
      Assembler.Patch();
    }
  },
  
  step:
  {
    help: 'step\nSingle-steps the emulation.',
    fn: function()
    {
      Emulator.Step();
      Emulator.Status();
    }
  },

  trace:
  {
    help: 'trace\nRepeatedly single-steps the emulation.',
    fn: function()
    {
      Emulator.paused = 0;
      while( !Emulator.paused )
      {
        var oldpc = Emulator.regs[9];
        Emulator.Step();
        Emulator.Status();
        if( oldpc == Emulator.regs[9] )
        {
          Console.Log("PC unchanged last step; pausing emulation");
          Emulator.paused = 1;
        }
      }
    }
  },


  asm:
  {
    help: 'asm\nSwitch to assembly entry mode.',
    fn: function()
    {
      Console.BeginEdit( Assembler.Assemble );      
      Console.inputArea.value = Assembler.Program;
    }
  },

  status:
  {
    help: 'status\nDisplay current status.',
    fn: function()
    {
      Emulator.Status();
      Assembler.Status();
    }
  },

  dump:
  {
    help: 'dump addr [count]\nDump memory in 16-word units starting from unit containing addr.',
    fn: Emulator.Dump
  },

  patch:
  {
    help: 'patch [addr data [data [data ...]]]\nCopy arbitrary data to memory; no-argument form copies retained assembler data to memory',
    fn: function(_args)
    {
      if( !_args.length )
      {
        Assembler.Patch();
        Emulator.Status();
        return;
      }
      
      var addr = eval('0x'+_args.shift());
      var line = (_addr & 0xfff0);
      var data;
      while( (data = _args.shift()) != undefined )
      {
        Emulator.mem[addr++] = eval('0x' + data);
      }
      while( line < _addr )
      {
        Emulator.Dump([line]);
        line += 0x10;        
      }
    }
  },
  
  help:
  {
    help: 'help [command]\nDisplays information about a command or the set of available commands.',
    fn: function(_args)
    {
      if( _args && _args.length && DebugCommands[_args[0]] )
      {
          Console.Log(DebugCommands[_args[0]].help ? DebugCommands[_args[0]].help : _args[0]+': no help available');
      }
      else
      {
          var s = ['Known commands: '];
          for( var i in DebugCommands )
          {
            s.push(i);
          }
          Console.Log(s);
      }      
    }
  }
}

function DebugCommand( _cmds )
{
  if( _cmds && _cmds.length )
  {
    var cmd = _cmds.shift();
    if( DebugCommands[cmd] )
    {
      DebugCommands[cmd].fn(_cmds);
    }
    else
    {
      Console.Log( 'Unknown command: ' + cmd );
      if( DebugCommands.help ) { DebugCommands.help.fn(); }
    }
  }
}

Console.DebugCommand = function()
{
  var cmd = Console.inputArea.value.split(' ');
  Console.inputArea.value = '';
  DebugCommand( cmd );
  return false;
}

Console.BeginEdit = function( _callback )
{
    Console.EditCB = _callback;
    $('.editor').show();
    Console.inputArea.value = '';
    Console.inputArea.rows = 20;
}

Console.EditOK = function()
{
  if( !Console.EditCB( Console.inputArea.value ) )
  {
    $('.editor').hide();
    Console.inputArea.value = '';
    Console.inputArea.rows = 1;
    Console.EditCB = undefined;
  }
}

Console.EditCancel = function()
{
  $('.editor').hide();
  Console.inputArea.value = '';
  Console.inputArea.rows = 1;  
  Console.EditCB = undefined;
}

Console.Log = function(_text)
{
  if( typeof(_text) === 'string' )
  {
    Console.logArea.value += _text + "\n";
  }
  else
  {
    var s = '';
    for( var i = 0; i < _text.length; i++ )
    {
      if( (s.length + _text[i].length) > 130 )
      {
        Console.logArea.value += s + '\n';
        s = '';
      }
      s += _text[i] + ' ';
    }
    Console.logArea.value += s + '\n';
  }
}

function TerminalControl(_elt) 
{
    this.layer = null;
    this.textbox = _elt;
    this.TextHistory = [];
    this.currHistory = 0;
    this.currText = '';
    var oThis = this;
    _elt.onkeydown = function (e) 
    {
        return oThis.handleKeyDown(e?e:window.event);
    }
}

TerminalControl.prototype.handleKeyDown = function (e) 
{
  if( !Console.EditCB )
  {
    switch(e.keyCode) 
    {
        case 38:
                        if( this.currHistory > 0 )
                        {
                                if( this.currHistory == this.TextHistory.length )
                                {
                                        this.currText = this.textbox.value;
                                }
                                this.currHistory--;     
                                this.textbox.value = this.TextHistory[this.currHistory];
                        }
            return false;
        case 40:
                        if( this.currHistory < this.TextHistory.length )
                        {
                                this.currHistory++;     
                                if( this.currHistory < this.TextHistory.length )
                                {
                                        this.textbox.value = this.TextHistory[this.currHistory];
                                }
                                else
                                {
                                        this.textbox.value = this.currText;
                                }
                        }
            return false;
         case 13:
                        {
                                this.TextHistory.push(this.textbox.value);
                                this.currHistory = this.TextHistory.length;
                                setTimeout("Console.DebugCommand()",0);
                        }
            return false;
     }
   }
   return true;
}


Console.Boot = function()
{
  $('.editor').hide();
  Console.logArea = document.getElementById('log');
  Console.inputArea = document.getElementById('intext');
  Emulator.screen = document.getElementById('screen');
  Emulator.charMap = document.getElementById('charmap');
  
  Emulator.screenDC = Emulator.screen.getContext('2d');
  Emulator.charMapDC = Emulator.charMap.getContext('2d');
  Emulator.screenDC.fillStyle = '#000000';
  Emulator.screenDC.fillRect( 0, 0, 512, 384 );
  
  Emulator.Reset();
    
  new TerminalControl(document.getElementById('intext'));
}

})(); // end of hidden innards

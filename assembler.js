// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------

(function(){


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
      START: ["labelledline | justlabels | line | emptyline"],
      emptyline: ["/\\s*/ $"],
      labelledline: ["justlabels line",   function(_m) { return _m[1]; }],
      justlabels: [ "/\\s*/ labels /\\s*/" ],
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
      dataunit: ["dataliteral | quotedstring"],
      
      dataliteral: ["expression",
                function(_m){ CountAssembledWords(1); return (function(expr){return function() { EmitWord(eval(expr)); }})(_m[0][0]); }
            ],
            
      quotedstring: ["singlequotedstring | doublequotedstring"],
      singlequotedstring: ["/'/ quotedstringdata /'\\s*/", function(_m) { return _m[1]; } ],
      doublequotedstring: ['/"/ quotedstringdata /"\\s*/', function(_m) { return _m[1]; } ],
      quotedstringdata: ["quotedstringtuple | quotedstringunit"],
      quotedstringtuple: ["quotedstringunit quotedstringdata", function(_m){ return (function(fn0,fn1){return function(){fn0();fn1();}})(_m[0],_m[1]); } ],
      quotedstringunit: ["stringchar | escape"],
      stringchar: ["/[^\"'\\\\]/", function(_m){ CountAssembledWords(1); return (function(_code){return function() { EmitWord(_code); }})(_m[0].charCodeAt(0)); } ],
      escape: ["'\\\\' escapecode", function(_m) { return _m[1]; } ],
      escapecode: ["numericescape | onecharescape" ],
      onecharescape: ["/./", 
        function(_m)
        { 
            CountAssembledWords(1);
            var code = _m[0].charCodeAt(0);
            switch( _m[0] ) // http://msdn.microsoft.com/en-us/library/h21280bw%28v=vs.80%29.aspx
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
            return (function(_code)
            {
                return function() { EmitWord(_code); }}
            )(_m[0].charCodeAt(0)); 
        } 
      ],
     
      numericescape: ["/(([0][0-7][0-7][0-7])|([x][0-9a-f][0-9a-f]([0-9a-f][0-9a-f])?))/", 
        function(_m){ CountAssembledWords(1); return (function(_code){return function() { EmitWord(_code); }})(eval('0' + _m[0])); } 
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
      push: ["/(push|\\[;sp[+][+]\\])\\s*/",            function(_m) { return function() { return 0x1a; } }],
      pop: ["/(pop|\\[--;sp\\])\\s*/",              function(_m) { return function() { return 0x18; } }],
      peek: ["/(peek|\\[;sp\\])\\s*/",            function(_m) { return function() { return 0x1b; } } ],

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
          function(_m) { return (function(id){return function(){return id+0x8;}})('abcxyzij'.indexOf(_m[1].charAt(1))); } ],
      
      regindoffset: ["regindoffsetleft | regindoffsetright"],
      regindoffsetleft: ["/\\[\\s*/ expression /\\s*\\+\\s*/ /;[abcxyzij]/ /\\s*\\]/",
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
      regindoffsetright: ["/\\[\\s*/ /;[abcxyzij]/ /\\s*\\+\\s*/ expression /\\s*\\]/",
          function(_m) { 
            var expr = _m[3][0];
            var id = 'abcxyzij'.indexOf(_m[1].charAt(1));
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
      Emulator.WriteMem((j+origin) & 0xFFFF, block[j] );
    }
    var line = (origin & 0xFFF0);
    while( line < (origin + block.length) )
    {
        Emulator.Dump([line.toString(16)]);
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

})(); // (function(){
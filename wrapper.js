// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------
// Rhino command line wrapper for assembler
// Generates memory images suitable for Notch's emulator


var Wrapper =
{
  Arguments: arguments,
  timeout: null,
  options: { }
};

var window =
{
    isRhino: true
};

function setTimeout( _fn, _time )
{
    (function(_expr, _old) { Wrapper.timeout = function() { return (_old ? _old() : false) || eval(_expr); } })(_fn, Wrapper.timeout);
}

load('globals.js');
load('util.js');
load('parser.js');
load('assembler.js');

(function()
{

    window.Console = Console;

    for (var i = 0; i < 0x10000; i++)
    {
        Emulator.mem[i] = 0;
    }

    function writeFile(_filename, _data) 
    {
    	runCommand('dd', 'status=noxfer', 'of=' + _filename, { 'input': _data, 'err': '' } );
    }

    Console.Log = function(_text)
    {
        if( !Wrapper.options['q'] )
        {
            java.lang.System.err.println(_text);        
        }
    }

    Console.ReadFile = function(_file, _callback)
    {
        var file = Wrapper.Path + _file;
        if (runCommand("test", "-e", file) == 0)
        {
            _callback(readFile(file));
        }
        else
        {
            Console.Log("Could not find " + file);
            _callback('');
        }
    }

    Emulator.WriteMem = function(_addr, _value)
    {
        Emulator.mem[_addr] = _value;
    }

    if (Wrapper.Arguments.length)
    {
        var file = null;
        for( var i = 0; i < Wrapper.Arguments.length; i++ )
        {
            var x = Wrapper.Arguments[i];
            if( x[0] == '-' )
            {
                if( x.length >= 2 )
                {
                    Wrapper.options[x[1]]=(x.length>2)? x.substring(2) : true;
                }
            }
            else
            {
                file = x;
            }
        }
        if( !file )
        {
            Console.Log("No input file specified!");
            return;
        }
        Wrapper.Path = './';
        var m = file.match(/^(.+[\\\/])([^\\\/]+)$/);
        if (m && m[1] && m[2])
        {
            Wrapper.Path = m[1];
            file = m[2];
        }

        Console.Log("Assembling " + Wrapper.Path + file);
        var source = readFile(Wrapper.Path + file);
        var haveErrors = Assembler.Assemble(source);

        while (!haveErrors && Wrapper.timeout)
        {
            var fn = Wrapper.timeout;
            Wrapper.timeout = null;
            haveErrors = fn();
        }

        if (!haveErrors)
        {
            if( Wrapper.options['O'] )
            {
                if( Wrapper.options['O'] == 'b64' )
                {
                    print( Emulator.GetB64MemoryDump() );
                }
                else if( Wrapper.options['O'] == 'dat' )
                {
                	var blocks = [];
                	var block = [];
                	var start = 0;
                	for( var i = 0; i < 0x10000; i++ )
                	{
                		if( Emulator.mem[i] != 0 )
                		{
                			if( (start + block.length) != i )
                			{
                				if( (i - (start + block.length)) < 5 )
                				{
                					while( (start + block.length) != i )
                					{
                						block.push(0);
                					}
                				}
                				else
                				{
                					blocks.push([start, block]);
                					start = i;
                					block = [];
                				}
                			}
                			block.push( Emulator.mem[i] );
                		}
                	}
                	
                	function getn(_n)
                	{
                		var h = '0x' + _n.toString(16);
                		var d = _n.toString(10);
                		return h.length < d.length ? h : d;
                	}
                	
                	if( block.length > 0 )
                	{
                		blocks.push( [start, block] );
                	}
                	for( var i = 0; i < blocks.length; i++ )
                	{
                		print ('org ' + getn(blocks[i][0]) );
                		print ('dat ' + blocks[i][1].map(getn).join(','));                		
                	}
                }
                else if( Wrapper.options['O'] == 'xxd' )
                {
                    var first;
                    for( first=0;(first<0xffff)&&!Emulator.mem[first]; ++first )
                        ;
                    var last;
                	for ( last = 0xffff; last && !Emulator.mem[last]; --last )
                		;
                	first = (first & ~3)>>>0;
                    for (var i = first; i <= last; i+=0x8)
                    {
                        var s = Console.H16(i*2) + ':';
                        for( var j = 0; (j < 0x8) && ((i+j)<=last); j++ )
                        {
                            s += ' ' + Console.H16(Emulator.mem[i+j]);
                        }
                        print( s );
                    }
                }
            }
            else if (runCommand("test", "-f", "dcpu.jar") == 0)
            {
                Console.Log("\ndcpu.jar found in current directory, trying to call computer.DCPU.testCPU");
                var str = new java.lang.StringBuilder();
                for (var i = 0; i < 0x10000; i++)
                {
                    str.append(String.fromCharCode(Emulator.mem[i]));
                }

                Packages.computer.DCPU.testCpu(str.toString().toCharArray());
            }
            
            if( Wrapper.options['D'] )
            {
				var used_lines = [ ];
				var used_line_lists = [ ];
				if( Assembler.Lines && Assembler.MemMap )
				{
					var comma = '';
					for( var i = 0; i < Assembler.MemMap.length; ++i )
					{
						if( Assembler.MemMap[i] && Assembler.Lines[Assembler.MemMap[i][0]-1] )
						{
							if( !used_line_lists[Assembler.MemMap[i][0]-1] )
							{
								used_line_lists[Assembler.MemMap[i][0]-1] = [ ];
								used_lines.push(Assembler.MemMap[i][0] - 1);
							}
							var s = Assembler.MemMap[i][1]();
							s = "'" + s.replace(/'/g, "\\'").replace(/"/g, '\\"') + "'";
							used_line_lists[Assembler.MemMap[i][0] - 1].push([i, s]);
						}
					}
				
					var dsym = "[\n";					
					var comma = '';
					for (var i = 0; i < used_lines.length; ++i)
					{
						dsym += comma;
						dsym += " [\n";
						dsym += "  '" + Assembler.Lines[used_lines[i]].replace(/'/g, "\\'").replace(/"/g, '\\"') + "',\n";
						dsym += "   [ ";
						var commaj = '';
						for( var j = 0; j < used_line_lists[used_lines[i]].length; ++j )
						{
							dsym += commaj + used_line_lists[used_lines[i]][j][0];
							commaj = ", ";
						}
						dsym += " ]\n ]";
						comma = ",\n";
					}
					dsym += ((used_lines.length < 1) ? "" : "\n");
				}
				dsym += " ]\n";
				writeFile( Wrapper.options['D'], dsym );
			}
            
            if(Wrapper.options['v'])
            {
                Console.Log("labels: ");
                for(var i in Assembler.LabelResolver.labels)
                {
                    var lbl=i.substr(1);
                    if(lbl.indexOf('$')<0)
                    {
                        Console.Log(lbl+": "+Console.H16(Assembler.LabelResolver.labels[i]));
                    }
                }
            }
        }
        else
        {
            java.lang.System.exit(1);
        }
    }
    else
    {
        Console.Log("Usage: ./assemble [options] file.dasm16\nAvailable options:\n-Otype controls the output type. type may be b64, dat, xxd\n");
    }

})();

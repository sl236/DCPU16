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
                    var first;
                    for(first=0;(first<0xffff)&&!Emulator.mem[first];++first)
                        ;
                    var last;
                    for(last=0xffff;last&&!Emulator.mem[last];--last)
                        ;
                    first=(first& ~7)>>>0;
                    print('.ORG ' + '0x' + Console.H16(first));
                    for(var i=first;i<=last;i+=0x8)
                    {
                        var s = '';
                        for( var j = 0; (j < 0x8) && ((i+j)<=last); j++ )
                        {
                            s += ', 0x' + Console.H16(Emulator.mem[i+j]);
                        }
                        print( 'DAT ' + s.substring(1) );
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
    }
    else
    {
        Console.Log("Usage: ./assemble [options] file.dasm16\nAvailable options:\n-Otype controls the output type. type may be b64, dat, xxd\n");
    }

})();

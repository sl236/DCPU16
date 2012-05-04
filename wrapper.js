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
        java.lang.System.err.println(_text);
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

    var font =
    [
      0x000f, 0x0808, 0x080f, 0x0808, 0x08f8, 0x0808, 0x00ff, 0x0808, 0x0808, 0x0808, 0x08ff, 0x0808, 0x00ff, 0x1414, 0xff00, 0xff08,
      0x1f10, 0x1714, 0xfc04, 0xf414, 0x1710, 0x1714, 0xf404, 0xf414, 0xff00, 0xf714, 0x1414, 0x1414, 0xf700, 0xf714, 0x1417, 0x1414,
      0x0f08, 0x0f08, 0x14f4, 0x1414, 0xf808, 0xf808, 0x0f08, 0x0f08, 0x001f, 0x1414, 0x00fc, 0x1414, 0xf808, 0xf808, 0xff08, 0xff08,
      0x14ff, 0x1414, 0x080f, 0x0000, 0x00f8, 0x0808, 0xffff, 0xffff, 0xf0f0, 0xf0f0, 0xffff, 0x0000, 0x0000, 0xffff, 0x0f0f, 0x0f0f,
      0x0000, 0x0000, 0x005f, 0x0000, 0x0300, 0x0300, 0x3e14, 0x3e00, 0x266b, 0x3200, 0x611c, 0x4300, 0x3629, 0x7650, 0x0002, 0x0100,
      0x1c22, 0x4100, 0x4122, 0x1c00, 0x2a1c, 0x2a00, 0x083e, 0x0800, 0x4020, 0x0000, 0x0808, 0x0800, 0x0040, 0x0000, 0x601c, 0x0300,
      0x3e41, 0x3e00, 0x427f, 0x4000, 0x6259, 0x4600, 0x2249, 0x3600, 0x0f08, 0x7f00, 0x2745, 0x3900, 0x3e49, 0x3200, 0x6119, 0x0700,
      0x3649, 0x3600, 0x2649, 0x3e00, 0x0024, 0x0000, 0x4024, 0x0000, 0x0814, 0x2241, 0x1414, 0x1400, 0x4122, 0x1408, 0x0259, 0x0600,
      0x3e59, 0x5e00, 0x7e09, 0x7e00, 0x7f49, 0x3600, 0x3e41, 0x2200, 0x7f41, 0x3e00, 0x7f49, 0x4100, 0x7f09, 0x0100, 0x3e49, 0x3a00,
      0x7f08, 0x7f00, 0x417f, 0x4100, 0x2040, 0x3f00, 0x7f0c, 0x7300, 0x7f40, 0x4000, 0x7f06, 0x7f00, 0x7f01, 0x7e00, 0x3e41, 0x3e00,
      0x7f09, 0x0600, 0x3e41, 0xbe00, 0x7f09, 0x7600, 0x2649, 0x3200, 0x017f, 0x0100, 0x7f40, 0x7f00, 0x1f60, 0x1f00, 0x7f30, 0x7f00,
      0x7708, 0x7700, 0x0778, 0x0700, 0x7149, 0x4700, 0x007f, 0x4100, 0x031c, 0x6000, 0x0041, 0x7f00, 0x0201, 0x0200, 0x8080, 0x8000,
      0x0001, 0x0200, 0x2454, 0x7800, 0x7f44, 0x3800, 0x3844, 0x2800, 0x3844, 0x7f00, 0x3854, 0x5800, 0x087e, 0x0900, 0x4854, 0x3c00,
      0x7f04, 0x7800, 0x447d, 0x4000, 0x2040, 0x3d00, 0x7f10, 0x6c00, 0x417f, 0x4000, 0x7c18, 0x7c00, 0x7c04, 0x7800, 0x3844, 0x3800,
      0x7c14, 0x0800, 0x0814, 0x7c00, 0x7c04, 0x0800, 0x4854, 0x2400, 0x043e, 0x4400, 0x3c40, 0x7c00, 0x1c60, 0x1c00, 0x7c30, 0x7c00,
      0x6c10, 0x6c00, 0x4c50, 0x3c00, 0x6454, 0x4c00, 0x0836, 0x4100, 0x0077, 0x0000, 0x4136, 0x0800, 0x0201, 0x0201, 0x704c, 0x7000
    ];

    for (var i = 0; i < font.length; i++)
    {
        Emulator.WriteMem(0x8180 + i, font[i]);
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
                    for (var i = 0; i < 0x10000; i+=0x8)
                    {
                        var s = '';
                        for( var j = 0; j < 0x8; j++ )
                        {
                            s += ', 0x' + Console.H16(Emulator.mem[i+j]);
                        }
                        print( 'DAT ' + s.substring(1) );
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
        }
    }
    else
    {
        Console.Log("Usage: ./assemble [options] file.dasm16\nAvailable options:\n-Otype controls the output type. type may be b64, dat\n");
    }

})();

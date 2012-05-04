// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------
// Utility functions shared between emulator and the Rhino command wrapper


Emulator.B64Codec="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

Emulator.LoadB64Image=function(_b64)
{
    Emulator.Reset();
    var Codec=Emulator.B64Codec;
    var buffer=0;
    var bits=0;
    var pos=0;
    _b64=_b64.replace((/[^A-Za-z0-9\/\+]/g),'');

    for(var i=0;i<65536;i++)
    {
        while(bits<16)
        {
            buffer=(buffer<<6)|Codec.indexOf(_b64[pos++]);
            bits+=6;
        }
        Emulator.mem[i]=(buffer>>>(bits-16))&0xFFFF;
        bits-=16;
    }
}

Emulator.GetB64MemoryDump=function()
{
    var Codec=Emulator.B64Codec;
    var buffer=0;
    var bits=0;
    var pos=0;
    var result=[];

    for(var i=0;i<65536;i++)
    {
        buffer=(buffer<<16)|Emulator.mem[i];
        bits+=16;
        while(bits>=6)
        {
            result.push(Codec[(buffer>>>(bits-6))&0x3F]);
            bits-=6;
        }
        if( ( i % 80 ) == 79 )
        {
            result.push("\n");
        }
    }
    while((bits%6) != 0)
    {
        buffer<<=8;
        bits+=8;    
    }
    while(bits>0)
    {
        result.push(Codec[(buffer>>>(bits-6))&0x3F]);
        bits-=6;
    }

    result.push('=');

    return result.join('');
}        

// -----------------------
Console.H8=function(_i)
{
    var h=_i.toString(16);
    while(h.length<2)
    {
        h='0'+h;
    }
    return h;
}

Console.H16=function(_i)
{
    var h=_i.toString(16);
    while(h.length<4)
    {
        h='0'+h;
    }
    return h;
}
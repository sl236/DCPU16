// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------
// Utility functions shared between emulator and the Rhino command wrapper


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

Emulator.B64Codec="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

Emulator.DecodeB64Image=function(_b64)
{
    _b64=_b64.replace((/[^A-Za-z0-9\/\+]/g),'');
    var len = Math.floor(((_b64.length * 6)+7) / 8);
    var result = new Array(len);
    try
    {
       result = new Uint16Array(len);
    }
    catch(e)
    {
    
    }

    var Codec=Emulator.B64Codec;
    var buffer=0;
    var bits=0;
    var pos=0;

    for(var i=0;i<len;i++)
    {
        while(bits<16)
        {
            buffer=(buffer<<6)|Codec.indexOf(_b64[pos++]);
            bits+=6;
        }
        result[i]=(buffer>>>(bits-16))&0xFFFF;
        bits-=16;
    } 
    
    return result;   
}

Emulator.LoadB64Image=function(_b64)
{
    Emulator.Reset();
    var m = Emulator.DecodeB64Image(_b64);
    for(var i=0;i<65536;i++)
    {
        Emulator.mem[i]=m[i];
    }
}

Emulator.EncodeB64Image=function(_uint16array)
{
    var Codec=Emulator.B64Codec;
    var buffer=0;
    var bits=0;
    var pos=0;
    var result=[];

    for(var i=0;i<_uint16array.length;i++)
    {
        buffer=(buffer<<16)|_uint16array[i];
        bits+=16;
        while(bits>=6)
        {
            result.push(Codec[(buffer>>>(bits-6))&0x3F]);
            bits-=6;
        }
        if((i%80)==79)
        {
            result.push("\n");
        }
    }
    while((bits%6)!=0)
    {
        buffer<<=8;
        bits+=8;
    }
    while(bits>0)
    {
        result.push(Codec[(buffer>>>(bits-6))&0x3F]);
        bits-=6;
    }

    for( var i = 0; i < (_uint16array.length % 3); i++ )
    {
        result.push('=');    
    }

    return result.join('');
}

Emulator.GetB64MemoryDump=function()
{
    return Emulator.EncodeB64Image(Emulator.mem);
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
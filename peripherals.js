// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------
// Peripheral device functionality

// -------------
// Video and character memory
// -------------

Peripherals.push(function()
{
    // screen width is 32 tiles
    // screen height is 12 tiles
    // tile width is 4 emulated pixels
    // tile height is 8 emulated pixels
    // border size is 16 emulated pixels

    // magnification factor is 4
    // therefore canvas size is (32*4*4 + 16*2*4, 12*8*4 + 16*2*4)

    // ------

    $('#emulation').html('<canvas class="crisp" id="screen" width="640" height="512" />');
    var screen = document.getElementById('screen');
    var screenDC = screen.getContext('2d');
    var defaultImage = null;

    var defaultFont =
            [
				0xb79e, 0x388e, 0x722c, 0x75f4, 0x19bb, 0x7f8f, 0x85f9, 0xb158, 0x242e, 0x2400, 0x082a, 0x0800, 0x0008, 0x0000, 0x0808, 0x0808, 
				0x00ff, 0x0000, 0x00f8, 0x0808, 0x08f8, 0x0000, 0x080f, 0x0000, 0x000f, 0x0808, 0x00ff, 0x0808, 0x08f8, 0x0808, 0x08ff, 0x0000, 
				0x080f, 0x0808, 0x08ff, 0x0808, 0x6633, 0x99cc, 0x9933, 0x66cc, 0xfef8, 0xe080, 0x7f1f, 0x0701, 0x0107, 0x1f7f, 0x80e0, 0xf8fe, 
				0x5500, 0xaa00, 0x55aa, 0x55aa, 0xffaa, 0xff55, 0x0f0f, 0x0f0f, 0xf0f0, 0xf0f0, 0x0000, 0xffff, 0xffff, 0x0000, 0xffff, 0xffff, 
				0x0000, 0x0000, 0x005f, 0x0000, 0x0300, 0x0300, 0x3e14, 0x3e00, 0x266b, 0x3200, 0x611c, 0x4300, 0x3629, 0x7650, 0x0002, 0x0100, 
				0x1c22, 0x4100, 0x4122, 0x1c00, 0x1408, 0x1400, 0x081c, 0x0800, 0x4020, 0x0000, 0x0808, 0x0800, 0x0040, 0x0000, 0x601c, 0x0300, 
				0x3e49, 0x3e00, 0x427f, 0x4000, 0x6259, 0x4600, 0x2249, 0x3600, 0x0f08, 0x7f00, 0x2745, 0x3900, 0x3e49, 0x3200, 0x6119, 0x0700, 
				0x3649, 0x3600, 0x2649, 0x3e00, 0x0024, 0x0000, 0x4024, 0x0000, 0x0814, 0x2241, 0x1414, 0x1400, 0x4122, 0x1408, 0x0259, 0x0600, 
				0x3e59, 0x5e00, 0x7e09, 0x7e00, 0x7f49, 0x3600, 0x3e41, 0x2200, 0x7f41, 0x3e00, 0x7f49, 0x4100, 0x7f09, 0x0100, 0x3e41, 0x7a00, 
				0x7f08, 0x7f00, 0x417f, 0x4100, 0x2040, 0x3f00, 0x7f08, 0x7700, 0x7f40, 0x4000, 0x7f06, 0x7f00, 0x7f01, 0x7e00, 0x3e41, 0x3e00, 
				0x7f09, 0x0600, 0x3e41, 0xbe00, 0x7f09, 0x7600, 0x2649, 0x3200, 0x017f, 0x0100, 0x3f40, 0x3f00, 0x1f60, 0x1f00, 0x7f30, 0x7f00, 
				0x7708, 0x7700, 0x0778, 0x0700, 0x7149, 0x4700, 0x007f, 0x4100, 0x031c, 0x6000, 0x0041, 0x7f00, 0x0201, 0x0200, 0x8080, 0x8000, 
				0x0001, 0x0200, 0x2454, 0x7800, 0x7f44, 0x3800, 0x3844, 0x2800, 0x3844, 0x7f00, 0x3854, 0x5800, 0x087e, 0x0900, 0x4854, 0x3c00, 
				0x7f04, 0x7800, 0x447d, 0x4000, 0x2040, 0x3d00, 0x7f10, 0x6c00, 0x417f, 0x4000, 0x7c18, 0x7c00, 0x7c04, 0x7800, 0x3844, 0x3800, 
				0x7c14, 0x0800, 0x0814, 0x7c00, 0x7c04, 0x0800, 0x4854, 0x2400, 0x043e, 0x4400, 0x3c40, 0x7c00, 0x1c60, 0x1c00, 0x7c30, 0x7c00, 
				0x6c10, 0x6c00, 0x4c50, 0x3c00, 0x6454, 0x4c00, 0x0836, 0x4100, 0x0077, 0x0000, 0x4136, 0x0800, 0x0201, 0x0201, 0x0205, 0x0200
            ];

    var defaultPalette = [];
    var defaultPaletteStyle = [];

    var palette = [];
    var paletteStyle = [];

    var glyphCache = [];
    var tmpData = [];
    var vramBase = 0;
    var fontBase = 0;
    var paletteBase = 0;
    var blinkOn = 0;
    var blinkMin = 0;
    var blinkMax = 0x179;

    for (var i = 0; i < 256; i++)
    {
        glyphCache[i] = [];
        for (var j = 0; j < 16; j++)
        {
            var vch = document.createElement('canvas');
            vch.setAttribute('width', 2);
            vch.setAttribute('height', 8);
            vch.setAttribute('class', 'crisp');
            var vchDC = vch.getContext('2d');
            glyphCache[i][j] = { ch: vch, chDC: vchDC, ok: 0, td: null };
        }
    }

    for (var i = 0; i < 16; i++)
    {
        var r = (i & 4) ? 0xAA : 0;
        var g = (i & 2) ? 0xAA : 0;
        var b = (i & 1) ? 0xAA : 0;
        if (i & 8)
        {
            r += 0x55;
            g += 0x55;
            b += 0x55;
        }
        else if (i == 6)
        {
            b += 0x55;
        }
        palette[i] = [r, g, b];
        paletteStyle[i] = 'rgb(' + r + ',' + g + ',' + b + ')';
        defaultPalette[i] = (((r >> 4) & 0xF) << 0x8) | (((g >> 4) & 0xF) << 0x4) | ((b >> 4) & 0xF);
    }

    screenDC.scale(4, 4);
    screenDC.translate(16, 16);
    screenDC.mozImageSmoothingEnabled = false;
    screenDC.save();
    screenDC.fillStyle = 'rgb(0,0,0)';
    screenDC.fillRect(-16, -16, 128 + 16 * 2, 96 + 16 * 2);
    screenDC.restore();
    var screenDClastFS = 'rgb(0,0,0)';
    var borderColour = 0;

    function getGlyph(_idx, _fgColour)
    {
        var glyph = glyphCache[_idx][_fgColour];
        if (!glyph.ok)
        {
            var code = (fontBase == 0) ? defaultFont[_idx] : Emulator.mem[fontBase + _idx];

            var td = glyph.td;
            if (!td)
            {
                td = glyph.td = glyph.chDC.createImageData(2, 8);
            }
            
            var fg=palette[_fgColour];
            if(glyph.fg != fg)
            {
                for(var j=0;j<td.data.length;j+=4)
                {
                    td.data[j+0]=fg[0];
                    td.data[j+1]=fg[1];
                    td.data[j+2]=fg[2];
                }
                glyph.fg = fg;
            }
            
            if( glyph.code != code )
            {
                for(var i=0;i<8;i++)
                {
                    td.data[(i*2+0)*4+3]=(code&(1<<(i+8)))?255:0;
                    td.data[(i*2+1)*4+3]=(code&(1<<(i)))?255:0;
                }
                glyph.code = code;
            }

            glyph.chDC.putImageData(td, 0, 0);
            glyph.ok = 1;
        }
        return glyph.ch;
    }

    function updateScreen(_addr, _value, _mask)
    {
        if ((vramBase <= _addr) && ((vramBase + 0x180) > _addr))
        {
            var x = ((_addr - vramBase) & 31) << 2;
            var y = ((_addr - vramBase) >>> 5) << 3;
            var bg = (_value >>> 0x8) & 0xF;

            if (screenDClastFS != paletteStyle[bg])
            {
                screenDC.fillStyle = paletteStyle[bg];
                screenDClastFS = paletteStyle[bg];
            }
            
           var glyphIdx = (_value&0x7F) << 1;
           var draw = (!(_value&0x80))||blinkOn;
           if( !_mask )
           {
               screenDC.fillRect(x,y,4,8);
               if( draw )
               {
                   screenDC.drawImage(getGlyph(glyphIdx,((_value>>>0xC)&0xF)),x,y);
                   screenDC.drawImage(getGlyph(glyphIdx+1,((_value>>>0xC)&0xF)),x+2,y);
               }
           }
           else
           {           
               if( _mask & 1 )
               {
                    screenDC.fillRect(x, y, 2, 8);
                    if( draw )
                    {
                        screenDC.drawImage(getGlyph(glyphIdx,((_value>>>0xC)&0xF)),x,y);                                                       
                    }
               }
               if( _mask & 2 )
               {
                   screenDC.fillRect( x+2, y, 2, 8 );
                   if( draw )
                   {
                       screenDC.drawImage(getGlyph(glyphIdx+1,((_value>>>0xC)&0xF)),x+2,y);
                   }
               }
           }
       }
    }

    function updateCharMap(_addr, _value)
    {
        if ((fontBase <= _addr) && ((fontBase + 0x100) > _addr))
        {
            var ch = ((_addr - fontBase)>>>0) & 0xFF;

            for (var i = 0; i < 16; i++)
            {
                glyphCache[ch][i].ok = 0;
            }
            
            var mask = 1<<(ch & 1);
            ch >>>= 1;

            if (vramBase != 0)
            {
                for (var i = vramBase; i < (vramBase + 0x180); i++)
                {
                    if ((Emulator.mem[i] & 0x7F) == ch)
                    {
                        updateScreen(i, Emulator.mem[i], mask);
                    }
                }
            }
        }
    }

    function updatePalette(_addr, _value)
    {
        if ((paletteBase <= _addr) && ((paletteBase + 16) > _addr))
        {
            var entry = _addr - paletteBase;
            var r = ((_value >>> 8) & 0xF) * 0x11;
            var g = ((_value >>> 4) & 0xF) * 0x11;
            var b = ((_value >>> 0) & 0xF) * 0x11;
            palette[entry] = [r, g, b];
            paletteStyle[entry] = 'rgb(' + r + ',' + g + ',' + b + ')';

            for (var i = 0; i < 256; i++)
            {
                glyphCache[i][entry].ok = 0;
            }

            if (vramBase != 0)
            {
                for (var i = vramBase; i < (vramBase + 0x180); i++)
                {
                    if ((((Emulator.mem[i] >> 0x8) & 0xF) == entry)
                    || (((Emulator.mem[i] >> 0xC) & 0xF) == entry)
                  )
                    {
                        updateScreen(i, Emulator.mem[i]);
                    }
                }
            }

            if (borderColour == entry)
            {
                updateBorder(entry);
            }
        }
    }

    function updateBorder(_value)
    {
        borderColour = _value & 0xF;
        if (screenDClastFS != paletteStyle[borderColour])
        {
            screenDC.fillStyle = paletteStyle[borderColour];
            screenDClastFS = paletteStyle[borderColour];
        }
        screenDC.fillRect(-16, -16, 128 + 16 * 2, 16);
        screenDC.fillRect(-16, 0, 16, 96);
        screenDC.fillRect(128, 0, 16, 96);
        screenDC.fillRect(-16, 96, 128 + 16 * 2, 16);
    }

    function onInterrupt()
    {
        switch (Emulator.regs[0])
        {
            case 0:
                if (vramBase != 0)
                {
                    for (var i = vramBase; i < (vramBase + 0x180); i++)
                    {
                        Emulator.MemoryHooks[i] = null;
                    }
                }
                
                vramBase = Emulator.regs[1];
                blinkMin=vramBase+0x179;
                blinkMax=vramBase;
                
                if (vramBase != 0)
                {
                    for (var i = vramBase; i < (vramBase + 0x180); i++)
                    {
                        Emulator.MemoryHooks[i] = function(_addr, _val)
                        { 
                            if( _val & 0x80 )
                            {
                                blinkMin = (blinkMin<_addr) ? blinkMin : _addr;
                                blinkMax = (blinkMax>_addr) ? blinkMax : _addr;
                            }
                            updateScreen(_addr, _val); 
                        };
                        updateScreen(i, Emulator.mem[i]);
                    }
                }
                else
                {
			        if( defaultImage )
			        {
			        	screenDC.drawImage( defaultImage, -16, -16 );
			        }
                }
                return 0;

            case 1:
                if (fontBase != 0)
                {
                    for (var i = fontBase; i < (fontBase + 0x100); i++)
                    {
                        Emulator.MemoryHooks[i] = null;
                    }
                }
                fontBase = Emulator.regs[1];
                if (fontBase != 0)
                {
                    for (var i = fontBase; i < (fontBase + 0x100); i++)
                    {
                        Emulator.MemoryHooks[i] = updateCharMap;
                        updateCharMap(i, Emulator.mem[i]);
                    }
                }
                else
                {
                    for (var i = 0; i < 0x100; i++)
                    {
                        updateCharMap(i, defaultFont[i]);
                    }
                }
                return 0;

            case 2:
                if (paletteBase != 0)
                {
                    for (var i = paletteBase; i < (paletteBase + 0x10); i++)
                    {
                        Emulator.MemoryHooks[i] = null;
                    }
                }
                paletteBase = Emulator.regs[1];
                if (paletteBase != 0)
                {
                    for (var i = paletteBase; i < (paletteBase + 0x10); i++)
                    {
                        Emulator.MemoryHooks[i] = updatePalette;
                        updatePalette(i, Emulator.mem[i]);
                    }
                }
                else
                {
                    for (var i = 0; i < 0x10; i++)
                    {
                        updatePalette(i, defaultPalette[i]);
                    }
                }
                return 0;

            case 3:
                updateBorder(Emulator.regs[1] & 0xF);
                return 0;

            case 4:
                for (var i = 0; i < 0x100; i++)
                {
                    Emulator.WriteMem(Emulator.regs[1] + i, defaultFont[i]);
                }
                return 0x100;

            case 5:
                for (var i = 0; i < 0x10; i++)
                {
                    Emulator.WriteMem(Emulator.regs[1] + i, defaultPalette[i]);
                }
                return 0x10;
        }
        Console.Log("Monitor received unknown HWI message " + Emulator.regs[0]);
        return 0;
    }
    
    function onReset()
    {
        if(vramBase!=0)
        {
            for(var i=vramBase;i<(vramBase+0x180);i++)
            {
                Emulator.MemoryHooks[i]=null;
            }
        }
        vramBase=0;
        if( defaultImage )
        {
        	screenDC.drawImage( defaultImage, -16, -16 );
        }
        if(fontBase!=0)
        {
            for(var i=fontBase;i<(fontBase+0x100);i++)
            {
                Emulator.MemoryHooks[i]=null;
            }
        }
        fontBase=0;
        for(var i=0;i<0x100;i++)
        {
            updateCharMap(i,0);
        }
        if(paletteBase!=0)
        {
            for(var i=paletteBase;i<(paletteBase+0x10);i++)
            {
                Emulator.MemoryHooks[i]=null;
            }
        }
        paletteBase=0;
        for(var i=0;i<0x10;i++)
        {
            updatePalette(i,defaultPalette[i]);
        }
        updateBorder( 0 );            
    }
    
    function onToggleBlink()
    {
        blinkOn = !blinkOn;
        if( vramBase )
        {
            while( !(Emulator.mem[blinkMin] & 0x80) && (blinkMin <= blinkMax) )
            {
                blinkMin++;
            }

            while(!(Emulator.mem[blinkMax]&0x80)&&(blinkMin<=blinkMax))
            {
                --blinkMax;
            }
            
            for(var i=blinkMin; i<=blinkMax; i++)
            {
                if( Emulator.mem[i] & 0x80 )
                {
                    updateScreen( i, Emulator.mem[i] );
                }
            }
        }
        
        setTimeout( onToggleBlink, blinkOn ? 650 : 350 );
    }
    
    var deviceDesc = // http://dcpu.com/highnerd/lem1802.txt
    {
        hwType: 0x7349f615,
        hwRev: 0x1802,
        hwManufacturer: 0x1c6c8b36,
        hwI: onInterrupt,
        hwReset: onReset
    };

    (function(){
    	var imageHolder = new Image();
    	imageHolder.onload = function()
    	{
    		defaultImage = imageHolder;
    		if(!vramBase)
    		{
    			screenDC.drawImage( defaultImage, -16, -16 );
    		}
    	}
    	imageHolder.src="LEM1802.png";
    })();

    Emulator.Devices.push(deviceDesc);
    setTimeout( onToggleBlink, 500 );
});



// -------------
// Clock
// -------------    

Peripherals.push(function()
{
    var lastTime = (new Date()).getTime();
    var tickRate = 0;
    var tickCount = 0;
    var interruptTickCount = 0;
    var message = 0;

    function clockTick()
    {
        ++interruptTickCount;

        if (interruptTickCount >= tickRate)
        {
	        ++tickCount;
            interruptTickCount = 0;
            if (message && tickRate && !Emulator.paused)
            {
                Emulator.InterruptQueue.push({ Message: message });
            }
        }

        var currTime = ((new Date()).getTime());
        var delta = 32 - (currTime - lastTime);
        lastTime = currTime;
        setTimeout(clockTick, (delta < 0) ? 0 : delta );
    }

    var deviceDesc = // http://dcpu.com/highnerd/lem1802.txt
    {
        hwType: 0x12d0b402,
        hwRev: 0x1,
        hwManufacturer: 0x00005345,
        hwI: function()
        {
            switch (Emulator.regs[0])
            {
                case 0:
                    tickRate = Emulator.regs[1];
                    interruptTickCount = tickCount = 0;
                    break;
                case 1:
                    Emulator.regs[2] = tickCount;
                    break;
                case 2:
                    message = Emulator.regs[1];
                    break;
            }
            return 0;
        },
        
        hwReset: function()
        {
            tickRate = 0;
            tickCount = 0;
            interruptTickCount = 0;
            message = 0;            
        }
    };

    Emulator.Devices.push(deviceDesc);
    clockTick();
});


// -------------
// Keyboard
// -------------    

Peripherals.push(function()
{
    var scanCodeMap =
    {
        8:  0x10,
        13: 0x11,
        45: 0x12,
        46: 0x13,
        38: 0x80,
        40: 0x81,
        37: 0x82,
        39: 0x83,
        16: 0x90,
        17: 0x91
    };

    var keyQueue=[];
    var keyStatus=[];
    var message = 0;


    var screen = document.getElementById('screen');
    if (screen)
    {
        function handleKeyboard(e, _etype)
        {
            var code = e.charCode;
            if( !code )
            {
                code = scanCodeMap[e.keyCode];
                if( !code )
                {
                	if( ( e.keyCode >= 0x20 ) || (e.keyCode < 0x7F ) )
                	{
	                	keyStatus[e.keyCode] = (_etype == 1);
                	}
                    return false;
                }
            }
            else
            {
                if( ( code < 0x20 ) || (code > 0x7F ) )
                {
                    return false;
                }
            }
            
            //Console.Log(e.charCode+'; '+e.keyCode+'; '+ code + '; ' + _etype);
             
            if( _etype == 0 )
            {
                keyQueue.push(code);
            }
            else
            {
                keyStatus[code] = (_etype == 1);
            }
            
            if( message )
            {
                Emulator.InterruptQueue.push({ Message: message });
            }
            
            return false;
        }
        
        screen.onclick = function()
        {
            Console.SetKeyboardFocus(handleKeyboard);
        }
        
        var deviceDesc = // http://dcpu.com/highnerd/rc_1/keyboard.txt
        {
            hwType: 0x30cf7406,
            hwRev: 0x1,
            hwManufacturer: 0x00005345,
            hwI: function()
            {
                switch (Emulator.regs[0])
                {
                    case 0:
                        keyQueue = [];
                        break;
                    case 1:
                        Emulator.regs[2] = keyQueue.length ? keyQueue.shift() : 0;
                        break;
                    case 2:
                        Emulator.regs[2] = keyStatus[Emulator.regs[1]] ? 1 : 0;
                        break;
                    case 3:
                        message = Emulator.regs[1];
                        break;
                }
                return 0;
            },
            
            hwReset: function()
            {
                keyQueue=[];
                keyStatus=[];
                message=0;            
            }
        };
        
        Emulator.Devices.push(deviceDesc);
    }
        
});


// -------------
// HMD2043 floppy drive 
// -------------

Peripherals.push(function( _debugCommands )
{
    var media = null;
    var message = 0xFFFF;
    var pendingOp = null;
    var sector_size = 512;
    var flags = 0;
    var lastInterrupt = 0;
    var lastInterruptError = 0;
    
    var curr_sector = 0;
    var sectors_per_track = 18;
    var tracks = 80;
    var full_stroke_ms = 200;
    var sector_access_ms = 11;
    var cycles_per_ms = 100;
    
    function executePendingOp()
    {
        var op = pendingOp;
        pendingOp = null;
        if( op ) 
        { 
            op(); 
        }
    }
    
    function readSectors( _B, _C, _X )
    {
        var result = 0;
        if( _C )
        {        
            if( media )
            {
                var source = _B * sector_size;
                var size = _C * sector_size;
                if( (source + size) > media.length )
                {
                    result = 2; // ERROR_INVALID_SECTOR
                }
                else
                {
                    for( var i = 0; i < size; i++ )
                    {
                        Emulator.WriteMem( ((_X+i)>>>0)&0xFFFF, media[source+i] );
                    }
                    curr_sector = _B + _C - 1;
                }
            }
            else
            {
                result = 1; // ERROR_NO_MEDIA
            }
        }
        return result;
    }

    function writeSectors(_B,_C,_X)
    {
        var result=0;
        if( _C )
        {
            if(media)
            {
                var source=_B*sector_size;
                var size=_C*sector_size;
                if((source+size)>media.length)
                {
                    result=2; // ERROR_INVALID_SECTOR
                }
                else
                {
                    for(var i=0;i<size;i++)
                    {
                        media[source+i] = Emulator.mem[(_X+i)&0xFFFF];
                    }
                    curr_sector = _B + _C - 1;
                }
            }
            else
            {
                result=1; // ERROR_NO_MEDIA
            }
        }
        return result;
    }
    
    function calculateAccessTime( _B, _C, _X )
    {
        return Math.floor( Math.abs(_B - curr_sector) / (sectors_per_track) ) * full_stroke_ms / (tracks - 1) + (_C*sector_access_ms);        
    }

    function insertFloppy( _b64Image )
    {
        media = Emulator.DecodeB64Image( _b64Image );
        if(flags&(1<<1)) // media status interrupts?
        {
            lastInterrupt=1;        // MEDIA_STATUS
            Emulator.InterruptQueue.push({ Message: message });                 
        }
		Console.Log("Floppy inserted, " + ((((media.length) & ~(sector_size-1))>>>0)&0xFFFF) + " " + sector_size + "-word sectors.");
    }
    
    function ejectFloppy()
    {
        media=null;
        if(flags&(1<<1)) // media status interrupts?
        {
            lastInterrupt=1;        // MEDIA_STATUS
            Emulator.InterruptQueue.push({ Message: message });
        }
        Console.Log("Floppy ejected.");
    }
    
    var deviceDesc = // https://gist.github.com/2495578
    {
        hwType: 0x74fa4cae,
        hwRev: 0x07c2,
        hwManufacturer: 0x21544948,
        hwI: function()
        {
            switch (Emulator.regs[0])
            {
                case 0: // QUERY_MEDIA_PRESENT
                        Emulator.regs[0] = 0;
                        Emulator.regs[1] = media ? 1 : 0;
                    break;
                    
                case 1: // QUERY_MEDIA_PARAMETERS
                        if(media)
                        {
                            Emulator.regs[0] = 0;
                            Emulator.regs[1] = sector_size;
                            Emulator.regs[2] = (((media.length) & ~(sector_size-1))>>>0)&0xFFFF;
                        }
                        else
                        {
                            Emulator.regs[0] = 1; // ERROR_NO_MEDIA
                        }
                    break;
                        
                case 2: // QUERY_DEVICE_FLAGS
                        Emulator.regs[0] = 0;
                        Emulator.regs[1] = flags;
                    break;

                case 3: // UPDATE_DEVICE_FLAGS
                        Emulator.regs[0]=0;
                        flags = Emulator.regs[1];
                    break;
                    
                case 4: // QUERY_INTERRUPT_TYPE
                        Emulator.regs[0]=lastInterruptError;
                        Emulator.regs[1]=lastInterrupt;                    
                    break;
                    
                case 5: // SET_INTERRUPT_MESSAGE
                        Emulator.regs[0]=0;
                        message = Emulator.regs[1];
                    break;
                    
                case 0x10: // READ_SECTORS
                        if(!pendingOp)
                        {
                            if(flags&(1<<0)) // Non-blocking?
                            {
                                Emulator.regs[0]=0;
                                pendingOp=(function(_B,_C,_X)
                                {
                                    return function()
                                    {
                                        lastInterruptError=readSectors(_B,_C,_X);
                                        lastInterrupt=2; // READ_COMPLETE
                                        Emulator.InterruptQueue.push({ Message: message });
                                    }
                                })(Emulator.regs[1],Emulator.regs[2],Emulator.regs[3]);
                                setTimeout(executePendingOp,
                                        Math.floor(calculateAccessTime(Emulator.regs[1],Emulator.regs[2],Emulator.regs[3]))
                                    );
                            }
                            else
                            {
			                    if(media)
			                    {
	                                Emulator.regs[0]=readSectors(Emulator.regs[1],Emulator.regs[2],Emulator.regs[3]);
    	                            return Math.floor(calculateAccessTime(Emulator.regs[1],Emulator.regs[2],Emulator.regs[3])*cycles_per_ms);
			                    }
			                    else
			                    {
			                        Emulator.regs[0]=1; // ERROR_NO_MEDIA
			                    }
                            }
                        }
                        else
                        {
                            Emulator.regs[0]=3; // ERROR_PENDING
                        }
                    break;
                    
                case 0x11: // WRITE_SECTORS
                        if(!pendingOp)
                        {
                            if(flags&(1<<0)) // Non-blocking?
                            {
                                Emulator.regs[0]=0;
                                pendingOp=(function(_B,_C,_X)
                                {
                                    return function()
                                    {
                                        lastInterruptError=writeSectors(_B,_C,_X);
                                        lastInterrupt=2; // READ_COMPLETE
                                        Emulator.InterruptQueue.push({ Message: message });
                                    }
                                })(Emulator.regs[1],Emulator.regs[2],Emulator.regs[3]);
                                setTimeout(executePendingOp,
                                        Math.floor(calculateAccessTime(Emulator.regs[1],Emulator.regs[2],Emulator.regs[3]))
                                    );
                            }
                            else
                            {
        			            if(media)
                   				{
	                                Emulator.regs[0]=writeSectors(Emulator.regs[1],Emulator.regs[2],Emulator.regs[3]);
    	                            return Math.floor(calculateAccessTime(Emulator.regs[1],Emulator.regs[2],Emulator.regs[3])*cycles_per_ms);
			                    }
			                    else
			                    {
			                        Emulator.regs[0]=1; // ERROR_NO_MEDIA
			                    }
                            }
                        }
                        else
                        {
                            Emulator.regs[0]=3; // ERROR_PENDING
                        }
                    break;
                
                case 0xFFFF: // QUERY_MEDIA_QUALITY
                        if( media )
                        {
                            Emulator.regs[0] = 0;
                            Emulator.regs[1] = 0x7FFF;
                        }
                        else
                        {
                            Emulator.regs[0] = 1; // ERROR_NO_MEDIA
                        }                        
                    break;
            }
            
            return 0;      
        },
        
        hwReset: function()
        {
		    media = null;
		    message = 0xFFFF;
		    pendingOp = null;
		    sector_size = 512;
		    flags = 0;
		    lastInterrupt = 0;
		    lastInterruptError = 0;
		    
		    curr_sector = 0;
		    sectors_per_track = 18;
		    tracks = 80;
		    full_stroke_ms = 200;
		    sector_access_ms = 11;
		    cycles_per_ms = 100;
        }
    };

    _debugCommands.floppy=
    {
        help: 'floppy [image.b64]\nLoads a base 64 encoded floppy image into emulated drive. With no arguments, produces a base64 image of current floppy contents.',
        fn: function( _args )
        {
            if(_args.length)
            {                
                Console.ReadFile
                (
                    _args.join(' '),
                    function(data) 
                    {
                        if(media)
                        {
                            ejectFloppy();
                        }
                        
                        insertFloppy(data);
                        
                    }
                );
            }
            else
            {
                if( media )
                {
                    window.open("data:application/octet-stream,"+Emulator.EncodeB64Image(media),"image.dmp.b64");                
                }
            }
        }
    };
    
    _debugCommands.eject = 
    {
      help: 'eject\nEjects any floppy image from emulated drive.',
      fn: function()
      {
          ejectFloppy();
      }    
    };
    
    Emulator.Devices.push(deviceDesc);
});
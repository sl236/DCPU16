// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------
// Peripheral device functionality

(function()
{

    // -------------
    // Video and character memory
    // -------------

    // Hook self into emulator bootstrap
    Emulator.onReset = (function(_oldFn)
    {
        return function()
        {
            _oldFn();   // call back original function *first*. Listing dependencies before dependants is more natural, this makes that work.
            
            var deviceDesc = // http://dcpu.com/highnerd/lem1802.txt
            {
              hwType: 0x7349f615,
              hwRev: 0x1802,
              hwManufacturer: 0x1c6c8b36,
              hwI: null
            }
            Emulator.Devices.push( deviceDesc );

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
            
            var defaultFont =
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

            var defaultPalette = [];
            var defaultPaletteStyle = [];
                        
            var palette = [];
            var paletteStyle = [];
            
            var glyphCache = [];
            var tmpData = [];
            var vramBase = 0;
            var fontBase = 0;
            var paletteBase = 0;

            for (var i = 0; i < 128; i++)
            {
                glyphCache[i] = [];
                for (var j = 0; j < 16; j++)
                {
                    var vch = document.createElement('canvas');
                    vch.setAttribute('width', 4);
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
                else if (i==6)
                {
                    b += 0x55;
                }
                palette[i] = [r, g, b];
                paletteStyle[i] = 'rgb(' + r + ',' + g + ',' + b + ')';
                defaultPalette[i] = (((r>>4)&0xF) << 0x8) | (((g>>4)&0xF) << 0x4) | ((b>>4)&0xF);
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
                    var code0;
                    var code1;
                    
                    if( fontBase != 0 )
                    {
                      var char_addr = fontBase + ((_idx & 0x7F) << 1);
                      code0 = Emulator.mem[char_addr];
                      code1 = Emulator.mem[char_addr + 1];
                    }
                    else
                    {
                      code0 = defaultFont[((_idx & 0x7F) << 1)];
                      code1 = defaultFont[((_idx & 0x7F) << 1)+1];
                    }
                    
                    var td = glyph.td;
                    if (!td)
                    {
                        var fg = palette[_fgColour];
                        td = glyph.td = glyph.chDC.createImageData(4, 8);
                        for (var j = 0; j < td.data.length; j += 4)
                        {
                            td.data[j + 0] = fg[0];
                            td.data[j + 1] = fg[1];
                            td.data[j + 2] = fg[2];
                        }
                    }

                    for (var i = 0; i < 8; i++)
                    {
                        td.data[(i * 4 + 0) * 4 + 3] = (code0 & (1 << (i + 8))) ? 255 : 0;
                        td.data[(i * 4 + 1) * 4 + 3] = (code0 & (1 << (i))) ? 255 : 0;
                        td.data[(i * 4 + 2) * 4 + 3] = (code1 & (1 << (i + 8))) ? 255 : 0;
                        td.data[(i * 4 + 3) * 4 + 3] = (code1 & (1 << (i))) ? 255 : 0;
                    }

                    glyph.chDC.putImageData(td, 0, 0);
                    glyph.ok = 1;
                }
                return glyph.ch;
            }

            function updateScreen(_addr, _value)
            {
              if( (vramBase <= _addr) && ((vramBase + 0x180) > _addr) )
              {
                var x = ((_addr - vramBase) & 31) << 2;
                var y = ((_addr - vramBase) >>> 5) << 3;
                var bg = (_value >>> 0x8) & 0xF;

                if (screenDClastFS != paletteStyle[bg])
                {
                    screenDC.fillStyle = paletteStyle[bg];
                }
                screenDC.fillRect(x, y, 4, 8);
                screenDC.drawImage(getGlyph(_value & 0x7F, ((_value >>> 0xC) & 0xF)), x, y);
              }
            }

            function updateCharMap(_addr, _value)
            {
              if( (fontBase <= _addr) && ((fontBase + 0x100) > _addr) )
              {
                var ch = ((_addr - fontBase) >> 1) & 0x7F;

                for (var i = 0; i < 16; i++)
                {
                    glyphCache[ch][i].ok = 0;
                }

                if( vramBase != 0 )
                {                
                  for (var i = vramBase; i < (vramBase + 0x180); i++)
                  {
                      if ((Emulator.mem[i] & 0x7F) == ch)
                      {
                          updateScreen(i, Emulator.mem[i]);
                      }
                  }
                }
              }
            }
            
            function updatePalette( _addr, _value )
            {
              if( ( paletteBase <= _addr ) && ( (_paletteBase + 16) > _addr ) )
              {
                var entry = _addr - paletteBase;
                var r = ((_value >>> 8 ) & 0xF) * 0x11;
                var g = ((_value >>> 4 ) & 0xF) * 0x11;
                var b = ((_value >>> 0 ) & 0xF) * 0x11;
                palette[entry] = [r, g, b];
                paletteStyle[entry] = 'rgb(' + r + ',' + g + ',' + b + ')';
                
                for (var i = 0; i < 128; i++ )
                {
                  glyphCache[i][entry].ok = 0;
                }
                
                if( vramBase != 0 )
                {          
                  for (var i = vramBase; i < (vramBase + 0x180); i++)
                  {
                      if(   (((Emulator.mem[i] >> 0x8) & 0xF) == entry )
                        ||  (((Emulator.mem[i] >> 0xC) & 0xF) == entry )
                      )
                      {
                          updateScreen(i, Emulator.mem[i]);
                      }
                  }
                }
                
                if( borderColour == entry )
                {
                  updateBorder( entry );
                }                
              }              
            }

            function updateBorder(_value)
            {
                borderColour = _value & 0xF;
                if (screenDClastFS != paletteStyle[borderColour])
                {
                  screenDC.fillStyle = paletteStyle[borderColour];
                }
                screenDC.fillRect(-16, -16, 128 + 16 * 2, 16);
                screenDC.fillRect(-16, 0, 16, 96);
                screenDC.fillRect(128, 0, 16, 96);
                screenDC.fillRect(-16, 96, 128 + 16 * 2, 16);
            }
            
            deviceDesc.hwI = function()
            {
              switch( Emulator.regs[0] )
              {
                case 0:
                  if( vramBase != 0 )
                  {
                    for (var i = vramBase; i < (vramBase + 0x180); i++)
                    {
                      Emulator.MemoryHooks[i] = null;
                    }
                  }
                  vramBase = Emulator.regs[1];
                  if( vramBase != 0 )
                  {
                    for (var i = vramBase; i < (vramBase + 0x180); i++)
                    {
                        Emulator.MemoryHooks[i] = updateScreen;
                        updateScreen( i, Emulator.Memory[i] );
                    }
                  }
                  return 0;
                  
                case 1:
                  if( fontBase != 0 )
                  {
                    for (var i = fontBase; i < (fontBase + 0x100); i++)
                    {
                      Emulator.MemoryHooks[i] = null;
                    }
                  }
                  fontBase = Emulator.regs[1];
                  if( fontBase != 0 )
                  {
                    for (var i = fontBase; i < (fontBase + 0x100); i++)
                    {
                        Emulator.MemoryHooks[i] = updateCharMap;
                        updateCharMap( i, Emulator.Memory[i] );
                    }
                  }
                  else
                  {
                    for (var i = 0; i < 0x100; i++ )
                    {
                      updateCharMap( i, defaultFont[i] );
                    }
                  }
                  return 0;

                case 2:
                  if( paletteBase != 0 )
                  {
                    for (var i = paletteBase; i < (paletteBase + 0x10); i++)
                    {
                      Emulator.MemoryHooks[i] = null;
                    }
                  }
                  paletteBase = Emulator.regs[1];
                  if( paletteBase != 0 )
                  {
                    for (var i = paletteBase; i < (paletteBase + 0x10); i++)
                    {
                        Emulator.MemoryHooks[i] = updatePalette;
                        updatePalette( i, Emulator.Memory[i] );
                    }
                  }
                  else
                  {
                    for( var i = 0; i < 0x10; i++ )
                    {
                      updatePalette( i, defaultPalette[i] );
                    }
                  }
                  return 0;
                  
                case 3:
                  updateBorder( Emulator.regs[1] & 0xF );
                  return 0;                
              }
              Console.Log("Monitor received unknown HWI message " + Emulator.regs[0]);
              return 0;
            }
        }
    })(Emulator.onReset);



    // -------------
    // Keyboard
    // -------------    
    function KeyLog(_charcode, _code, _up, _stored )
    {
      var str = Console.H16( _charcode ) + " ('" + String.fromCharCode(_charcode) + "')";
      switch(_up)
      {
          case 0:
            str += " typed; ";
          break;
          case 1:
            str += " pressed; ";
          break;
          case 2:
            str += " released; ";
          break;
      }
      str += (_code ? Console.H16(_code) : "nothing");
      str += _stored ? " sent to " + Console.H16(_stored) : " stored in emulator (ringbuffer full)."
      Console.Log(str);
    }
    
    Emulator.onReset = (function(_oldFn)
    {
        return function()
        {
            _oldFn();
            return; // TODO: fix up when we receive a new spec from Notch

            var buffer = [];
            var last = 0x9000;

            var shiftmap = [];
            var shifted = 'QWERTYUIOPASDFGHJKLZXCVBNM';
            var unshifted = 'qwertyuiopasdfghjklzxcvbnm';


            var screen = document.getElementById('screen');
            if (screen)
            {
                function handleKeyboard(e, _etype)
                {
                    var charcode = e.charCode || e.keyCode;

                    if (e.ctrlKey && ((charcode | 0x20) >= 0x61) && ((charcode | 0x20) <= 0x7a))
                    {
                        charcode = (charcode | 0x20) - 0x61;
                    }
                    
                    var code = charcode;
                    if( _etype )
                    {
                      if(Console.Keymap[charcode] == undefined)
                      {
                        return true;
                      }
                      code = Console.Keymap[charcode] | ((_etype == 1) ? 0x100 : 0);
                    }
                    else
                    {
                      if( (!e.charCode) && Console.Keymap[e.keyCode] )
                      {
                        return false;
                      }
                    }
                            
                    if (Emulator.mem[last])
                    {
                        if (code)
                        {
                            buffer.push[code];
                        }
                        if( Console.Options['keylog'] ) {  KeyLog( charcode, code, _etype, 0 ); }
                    }
                    else
                    {
                        if (code)
                        {
                            Emulator.mem[last] = code;
                        }
                        if( Console.Options['keylog'] ) { KeyLog( charcode, code, _etype, last ); }
                        last = Console.Options.keyringbuffer ? (last + 1) & 0x900F : 0x9000;
                    }
                    return !code;
                }
                screen.onclick = function()
                {
                    Console.SetKeyboardFocus(handleKeyboard);
                }
            }

            function onModifyKeyPtr(_addr, _value)
            {
                if (Console.Options['keyptr'])
                {
                    Emulator.mem[0x9010] = last;
                    for (var i = 1; i < 0xF; i++)
                    {
                        if (Emulator.mem[(i + last) & 0x900F])
                        {
                            Emulator.mem[0x9010] = (i + last) & 0x900F;
                            return;
                        }
                    }
                }
            }

            function onModifyRingBuffer(_addr, _value)
            {
                if (Console.Options['keyptr'] && (_addr == Emulator.mem[0x9010]))
                {
                    Emulator.mem[0x9010] = (Emulator.mem[0x9010] + 1) & 0x900f;
                }

                if (buffer.length && (_addr == _last) && (_value == 0))
                {
                    Emulator.mem[last] = buffer.shift();
                    if (Console.Options['keylog'])
                    {
                        Console.Log("Keycode " + Emulator.mem[last] + " written to " + last + " (old value was read by app)");
                    }
                    last = Console.Options.keyringbuffer ? (last + 1) & 0x900F : 0x9000;
                }
            }

            for (i = 0x9000; i < 0x9010; i++)
            {
                Emulator.MemoryHooks[i] = onModifyRingBuffer;
            }
            Emulator.MemoryHooks[0x9010] = onModifyKeyPtr;
        }
    })(Emulator.onReset);

})();                     // (function(){

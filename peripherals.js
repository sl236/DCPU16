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
            return; // TODO: fix up when we receive a new spec from Notch

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

            var rgb = [];
            var rgbstyle = [];
            var glyphCache = [];
            var tmpData = [];

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
                rgb[i] = [r, g, b];
                rgbstyle[i] = 'rgb(' + r + ',' + g + ',' + b + ')';
            }

            screenDC.scale(4, 4);
            screenDC.translate(16, 16);
            screenDC.mozImageSmoothingEnabled = false;
            screenDC.save();
            screenDC.fillStyle = 'rgb(0,0,0)';
            screenDC.fillRect(-16, -16, 128 + 16 * 2, 96 + 16 * 2);
            screenDC.restore();
            var screenDClastFS = 0;

            function getGlyph(_idx, _fgColour)
            {
                var glyph = glyphCache[_idx][_fgColour];
                if (!glyph.ok)
                {
                    var char_addr = 0x8180 + ((_idx & 0x7F) << 1);
                    var code0 = Emulator.mem[char_addr];
                    var code1 = Emulator.mem[char_addr + 1];
                    var td = glyph.td;
                    if (!td)
                    {
                        var fg = rgb[_fgColour];
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
                var x = ((_addr - 0x8000) & 31) << 2;
                var y = ((_addr - 0x8000) >>> 5) << 3;
                var bg = (_value >>> 0x8) & 0xF;

                if (screenDClastFS != bg)
                {
                    screenDClastFS = bg;
                    screenDC.fillStyle = rgbstyle[bg];
                }
                screenDC.fillRect(x, y, 4, 8);
                screenDC.drawImage(getGlyph(_value & 0x7F, ((_value >>> 0xC) & 0xF)), x, y);
            }

            function updateCharMap(_addr, _value)
            {
                var ch = ((_addr - 0x8180) >> 1) & 0x7F;

                for (var i = 0; i < 16; i++)
                {
                    glyphCache[ch][i].ok = 0;
                }

                for (var i = 0x8000; i < 0x8180; i++)
                {
                    if ((Emulator.mem[i] & 0x7F) == ch)
                    {
                        updateScreen(i, Emulator.mem[i]);
                    }
                }
            }

            function updateBorder(_addr, _value)
            {
                var bg = _value & 0xF;
                if (screenDClastFS != bg)
                {
                    screenDClastFS = bg;
                    screenDC.fillStyle = rgbstyle[bg];
                }
                screenDC.fillRect(-16, -16, 128 + 16 * 2, 16);
                screenDC.fillRect(-16, 0, 16, 96);
                screenDC.fillRect(128, 0, 16, 96);
                screenDC.fillRect(-16, 96, 128 + 16 * 2, 16);
            }

            for (var i = 0x8000; i < 0x8180; i++)
            {
                Emulator.MemoryHooks[i] = updateScreen;
            }

            for (var i = 0x8180; i < 0x8280; i++)
            {
                Emulator.MemoryHooks[i] = updateCharMap;
            }

            Emulator.MemoryHooks[0x8280] = updateBorder;

            // default font
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

            var start = (new Date()).getTime();

            for (var i = 0; i < font.length; i++)
            {
                Emulator.WriteMem(0x8180 + i, font[i]);
            }

            // profiling
            if (0)
            {

                for (var iter = 0; iter < 200; iter++)
                {
                    for (var i = 0; i < 128; i++)
                    {
                        Emulator.WriteMem(0x8000 + i, 0x8000 + i);
                    }
                }
                Console.Log(((new Date()).getTime() - start) + "ms for 200 frames.");
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

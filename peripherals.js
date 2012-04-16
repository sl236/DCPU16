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
            // screen width is 32 tiles
            // screen height is 12 tiles
            // tile width is 4 emulated pixels
            // tile height is 8 emulated pixels
            // border size is 16 emulated pixels

            // magnification factor is 4
            // therefore canvas size is (32*4*4 + 16*2*4, 12*8*4 + 16*2*4)

            // ------

            $('#emulation').html('<canvas id="screen" width="640" height="512" />');
            var screen = document.getElementById('screen');
            var screenDC = screen.getContext('2d');

            var rgb = [];
            var rgbstyle = [];

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
                else
                {
                    if (r && g)
                    {
                        g = 0xFF;
                    }
                }
                rgb[i] = [r, g, b];
                rgbstyle[i] = 'rgb(' + r + ',' + g + ',' + b + ')';
            }


            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.setAttribute('width', 4);
            tmpCanvas.setAttribute('height', 8);
            var tmpCanvasDC = tmpCanvas.getContext('2d');

            var tmpData = tmpCanvasDC.createImageData(4, 8);
            for (var i = 3; i < tmpData.data.length; i += 4)
            {
                tmpData.data[i] = 0xFF;
            }

            screenDC.scale(4, 4);
            screenDC.translate(16, 16);
            screenDC.save();
            screenDC.fillStyle = 'rgb(0,0,0)';
            screenDC.fillRect(-16, -16, 128 + 16 * 2, 96 + 16 * 2);
            screenDC.restore();

            function updateScreen(_addr, _value)
            {
                var x = ((_addr - 0x8000) & 31) << 2;
                var y = ((_addr - 0x8000) >>> 5) << 3;

                var char_addr = 0x8180 + ((_value & 0x7F) << 1);
                var code0 = Emulator.mem[char_addr];
                var code1 = Emulator.mem[char_addr + 1];
                var fg = rgb[(_value >>> 0xC) & 0xF];
                var bg = rgb[(_value >>> 0x8) & 0xF];
                for (var i = 0; i < 8; i++)
                {
                    tmpData.data[(i * 4 + 0) * 4 + 0] = (code0 & (1 << (i + 8))) ? fg[0] : bg[0];
                    tmpData.data[(i * 4 + 0) * 4 + 1] = (code0 & (1 << (i + 8))) ? fg[1] : bg[1];
                    tmpData.data[(i * 4 + 0) * 4 + 2] = (code0 & (1 << (i + 8))) ? fg[2] : bg[2];

                    tmpData.data[(i * 4 + 1) * 4 + 0] = (code0 & (1 << (i))) ? fg[0] : bg[0];
                    tmpData.data[(i * 4 + 1) * 4 + 1] = (code0 & (1 << (i))) ? fg[1] : bg[1];
                    tmpData.data[(i * 4 + 1) * 4 + 2] = (code0 & (1 << (i))) ? fg[2] : bg[2];

                    tmpData.data[(i * 4 + 2) * 4 + 0] = (code1 & (1 << (i + 8))) ? fg[0] : bg[0];
                    tmpData.data[(i * 4 + 2) * 4 + 1] = (code1 & (1 << (i + 8))) ? fg[1] : bg[1];
                    tmpData.data[(i * 4 + 2) * 4 + 2] = (code1 & (1 << (i + 8))) ? fg[2] : bg[2];

                    tmpData.data[(i * 4 + 3) * 4 + 0] = (code1 & (1 << (i))) ? fg[0] : bg[0];
                    tmpData.data[(i * 4 + 3) * 4 + 1] = (code1 & (1 << (i))) ? fg[1] : bg[1];
                    tmpData.data[(i * 4 + 3) * 4 + 2] = (code1 & (1 << (i))) ? fg[2] : bg[2];
                }

                tmpCanvasDC.putImageData(tmpData, 0, 0);
                screenDC.drawImage(tmpCanvas, x, y);
            }

            function updateCharMap(_addr, _value)
            {
            }

            function updateBorder(_addr, _value)
            {
                screenDC.save();
                screenDC.fillStyle = rgbstyle[_value & 0xF];
                screenDC.fillRect(-16, -16, 128 + 16 * 2, 16);
                screenDC.fillRect(-16, 0, 16, 96);
                screenDC.fillRect(128, 0, 16, 96);
                screenDC.fillRect(-16, 96, 128 + 16 * 2, 16);
                screenDC.restore();
            }

            var i;
            for (i = 0x8000; i < 0x8180; i++)
            {
                Emulator.MemoryHooks[i] = updateScreen;
            }

            for (i = 0x8180; i < 0x8280; i++)
            {
                Emulator.MemoryHooks[i] = updateCharMap;
            }

            Emulator.MemoryHooks[0x8280] = updateBorder;

            // default font
            var font =
                [
                    0x0000, 0x0000, 0x005f, 0x0000, 0x0300, 0x0300, 0x3e14, 0x3e00, 0x2e6b, 0x3a00, 0x611c, 0x4300, 0x1a25, 0x5a00, 0x0003, 0x0000,
                    0x3e41, 0x4100, 0x4141, 0x3e00, 0x140e, 0x1400, 0x081c, 0x0800, 0x0060, 0x0000, 0x0808, 0x0800, 0x0040, 0x0000, 0x601c, 0x0300,
                    0x7f41, 0x7f00, 0x027f, 0x0000, 0x7949, 0x4f00, 0x4149, 0x7f00, 0x0f08, 0x7f00, 0x4f49, 0x7900, 0x7f49, 0x7900, 0x0101, 0x7f00,
                    0x7f49, 0x7f00, 0x4f49, 0x7f00, 0x0044, 0x0000, 0x0064, 0x0000, 0x0814, 0x2200, 0x1414, 0x1400, 0x2214, 0x0800, 0x0159, 0x0f00,
                    0x7f41, 0x4f00, 0x7f11, 0x7f00, 0x7f49, 0x7700, 0x7f41, 0x6300, 0x7f41, 0x3e00, 0x7f49, 0x4100, 0x7f09, 0x0100, 0x7f41, 0x7b00,
                    0x7f08, 0x7f00, 0x417f, 0x4100, 0x4040, 0x3f00, 0x7f08, 0x7700, 0x7f40, 0x4000, 0x7f06, 0x7f00, 0x7f01, 0x7f00, 0x7f41, 0x7f00,
                    0x7f09, 0x0f00, 0x3f21, 0x5f00, 0x7f09, 0x7700, 0x6f49, 0x7b00, 0x017f, 0x0100, 0x7f40, 0x7f00, 0x0f70, 0x0f00, 0x7f30, 0x7f00,
                    0x7708, 0x7700, 0x0778, 0x0700, 0x7149, 0x4700, 0x7f41, 0x0000, 0x031c, 0x6000, 0x0041, 0x7f00, 0x0c03, 0x0c00, 0x4040, 0x4000,
                    0x0304, 0x0000, 0x7454, 0x7c00, 0x7f44, 0x7c00, 0x7c44, 0x4400, 0x7c44, 0x7f00, 0x7c54, 0x5c00, 0x7f05, 0x0100, 0x5c54, 0x7c00,
                    0x7f04, 0x7c00, 0x007d, 0x0000, 0x407d, 0x0000, 0x7f10, 0x6c00, 0x7f40, 0x0000, 0x7c18, 0x7c00, 0x7c04, 0x7c00, 0x7c44, 0x7c00,
                    0x7c14, 0x1c00, 0x1c14, 0x7c00, 0x7c04, 0x0400, 0x5c54, 0x7400, 0x7f44, 0x4400, 0x7c40, 0x7c00, 0x1c60, 0x1c00, 0x7c30, 0x7c00,
                    0x6c10, 0x6c00, 0x5c50, 0x7c00, 0x6454, 0x4c00, 0x0877, 0x4100, 0x007f, 0x0000, 0x4177, 0x0800, 0x0000, 0x0000
                ];
            for (i = 0; i < font.length; i++)
            {
                Emulator.WriteMem(0x8180 + 0x40 + i, font[i]);
            }

            _oldFn();
        }
    })(Emulator.onReset);


})();                        // (function(){
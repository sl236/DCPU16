// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------
// Debug console, utility and bootstrap functions

(function()
{

    // -------------
    // Debug console
    // -------------

    var DebugCommands =
{
    clear:
  {
      help: 'clear\nClears the debug log area.',
      fn: function()
      {
          Console.logArea.value = '';
      }
  },

    reset:
  {
      help: 'reset\nResets the VM to power-on state.',
      fn: function()
      {
          Console.logArea.value = '';
          Emulator.Reset();
          Assembler.Patch();
      }
  },

    step:
  {
      help: 'step\nSingle-steps the emulation.',
      fn: function()
      {
          var tmp = Emulator.regs[12];
          Emulator.regs[12] = (Emulator.regs[9] + 3) & 0xFFFF; // guaranteed not to hit
          Emulator.Step();
          Emulator.regs[12] = tmp;
          Emulator.Status();
      }
  },

    bp:
  {
      help: 'bp addr\nSets breakpoint to addr.',
      fn: function(_args)
      {
          if (_args.length)
          {
              var addr = parseInt(_args.shift(), 16);
              Emulator.regs[12] = addr;
              Console.Log("Breakpoint set to " + Console.H16(Emulator.regs[12]));
          }
      }
  },

    trace:
  {
      help: 'trace\nRepeatedly single-steps the emulation.',
      fn: function()
      {
          Emulator.paused = 0;
          setTimeout("Emulator.Trace()", 0);
      }
  },

    run:
  {
      help: 'run\nContinues the emulation until an error condition is encountered or emulation becomes paused due to a debug console command.',
      fn: function()
      {
          Emulator.paused = 0;
          setTimeout("Emulator.Run()", 0);
      }
  },

  pause:
  {
      help: 'pause\nPauses a trace or emulation run.',
      fn: function() { Emulator.paused = true; }
  },
  
  asm:
  {
      help: 'asm [url]\nSwitch to assembly entry mode, optionally loading source from supplied URL (note browser cross-site scripting policies).',
      fn: function(_args)
      {
          function go(_data)
          {
              if (_data && _data.indexOf('Raw text') == 0)
              {
                  _data = '; ' + _data;
              }
              Console.BeginEdit(function(_text)
              {
                  if (!Assembler.Assemble(_text))
                  {
                      Assembler.Patch();
                      return 0;
                  }
                  return 1;
              });
              Console.inputArea.value = _data ? _data : Assembler.Program;
          }

          if (_args.length)
          {
              $.ajax({
                  url: _args.join(' '),
                  dataType: 'text',
                  success: function(data) { go(data); }
              });
          }
          else
          {
              go();
          }
      }
  },

    status:
  {
      help: 'status\nDisplay current status.',
      fn: function()
      {
          Emulator.Status();
          Assembler.Status();
      }
  },

    dump:
  {
      help: 'dump addr [count]\nDump memory in 16-word units starting from unit containing addr.',
      fn: Emulator.Dump
  },

  disasm:
  {
    help: 'disasm [addr] [count]\nDisassemble count instructions from supplied address or pc.',
    fn: function(_args)
    {
      var addr = _args? _args.shift() : undefined;
      var count = _args? _args.shift() : undefined;
      if( addr == undefined ) { addr = Emulator.regs[9]; }
      if( count == undefined ) { count = 4; }
      for( var i = 0; i < count; i++ )
      {
        var r = Emulator.Disassemble(addr);
        Console.Log( r[0] );
        addr += r[1];
      }
    }
  },

  patch:
  {
      help: 'patch [addr data [data [data ...]]]\nCopy arbitrary data to memory; no-argument form copies retained assembler data to memory',
      fn: function(_args)
      {
          if (!_args.length)
          {
              Assembler.Patch();
              Emulator.Status();
              return;
          }

          var addr = parseInt(_args.shift(), 16);
          var line = (_addr & 0xfff0);
          var data;
          while ((data = _args.shift()) != undefined)
          {
              Emulator.WriteMem(addr++, parseInt(data, 16));
          }
          while (line < _addr)
          {
              Emulator.Dump([line]);
              line += 0x10;
          }
      }
  },

    keylog:
  {
      help: 'keylog\nToggles keyboard event logging.\n',
      fn: function(_args)
      {
          if (_args.length)
          {
              Console.Options['keylog'] = !parseInt(_args[0]);
          }
          if (Console.Options['keylog'])
          {
              Console.Options['keylog'] = 0;
              Console.Log("Keyboard event logging disabled.\n");
          }
          else
          {
              Console.Options['keylog'] = 1;
              Console.Log("Keyboard event logging enabled.\n");
          }
      }
  },

    keypointer:
  {
      help: 'keypointer\nToggles 0x10co.de non-spec keyboard ringbuffer pointer at 0x9010\n',
      fn: function(_args)
      {
          if (_args.length)
          {
              Console.Options['keyptr'] = !parseInt(_args[0]);
          }
          if (Console.Options['keyptr'])
          {
              Console.Options['keyptr'] = 0;
              Console.Log("0x9010 keyboard ringbuffer pointer disabled.\n");
          }
          else
          {
              Console.Options['keyptr'] = 1;
              Emulator.WriteMem(0x9010, 0x9000);
              Console.Log("0x9010 keyboard ringbuffer pointer enabled.\n");
          }
      }
  },

    keyringbuffer:
  {
      help: 'keyringbuffer\nToggles between full ringbuffer emulation and just writing character data to 0x9000 only\n',
      fn: function(_args)
      {
          if (_args.length)
          {
              Console.Options.keyringbuffer = !parseInt(_args[0]);
          }
          if (Console.Options.keyringbuffer)
          {
              Console.Options.keyringbuffer = 0;
              Console.Log("Just writing character data to 0x9000 (full ringbuffer emulation disabled).\n");
          }
          else
          {
              Console.Options.keyringbuffer = 1;
              Console.Log("Keyboard ringbuffer emulation enabled at 0x9000... 0x900F.\n");
          }
      }
  },

    map:
  {
      help: 'map [code1 [code2]]\nWhen keycode code1 is received by Javascript, code2 will be sent to the emulated ringbuffer. With no arguments, displays current mappings.\nUse keylog to discover codes sent by browser.\n',
      fn: function(_args)
      {
          if (_args.length)
          {
              if (_args[1] != undefined)
              {
                  Console.Keymap[parseInt(_args[0])] = parseInt(_args[1]);
                  Console.Log(parseInt(_args[0]) + " mapped to " + (parseInt(_args[1]) ? parseInt(_args[1]) : "[suppress]"));
              }
              else
              {
                  Console.Keymap[parseInt(_args[0])] = undefined;
                  Console.Log(parseInt(_args[0]) + " mapping reset.");
              }
          }
          else
          {
              Console.Log("Keyboard mappings: ");
              for (var i in Console.Keymap)
              {
                  if (Console.Keymap[i] != undefined)
                  {
                      Console.Log(i + ' -> ' + (Console.Keymap[i] ? Console.Keymap[i] : "[suppress]"));
                  }
              }
          }
      }
  },

    help:
  {
      help: 'help [command]\nDisplays information about a command or the set of available commands.',
      fn: function(_args)
      {
          if (_args && _args.length && DebugCommands[_args[0]])
          {
              Console.Log(DebugCommands[_args[0]].help ? DebugCommands[_args[0]].help : _args[0] + ': no help available');
          }
          else
          {
              var s = ['Known commands: '];
              for (var i in DebugCommands)
              {
                  s.push(i);
              }
              s.push('use   help commandname   for help with a specific command');
              Console.Log(s);
          }
      }
  }
}

    function DebugCommand(_cmds)
    {
        if (_cmds && _cmds.length)
        {
            var cmd = _cmds.shift();
            if (DebugCommands[cmd])
            {
                DebugCommands[cmd].fn(_cmds);
            }
            else
            {
                Console.Log('Unknown command: ' + cmd);
                if (DebugCommands.help) { DebugCommands.help.fn(); }
            }
        }
    }

    Console.Shell = function(cmd)
    {
        DebugCommand(cmd.split(' '));
    }

    Console.DebugCommand = function()
    {
        Console.Shell(Console.inputArea.value);
        Console.inputArea.value = '';
        return false;
    }

    Console.BeginEdit = function(_callback)
    {
        Console.EditCB = _callback;
        $('.editor').show();
        Console.inputArea.value = '';
        Console.inputArea.rows = 20;
    }

    Console.EditOK = function()
    {
        if (!Console.EditCB(Console.inputArea.value))
        {
            $('.editor').hide();
            Console.inputArea.value = Console.prompt;
            Console.inputArea.rows = 1;
            Console.EditCB = undefined;
        }
    }

    Console.EditCancel = function()
    {
        $('.editor').hide();
        Assembler.Program = Console.inputArea.value;
        Console.inputArea.value = Console.prompt;
        Console.inputArea.rows = 1;
        Console.EditCB = undefined;
    }

    Console.Log = function(_text)
    {
        if (typeof (_text) === 'string')
        {
            Console.logArea.value += _text + "\n";
        }
        else
        {
            var s = '';
            for (var i = 0; i < _text.length; i++)
            {
                if ((s.length + _text[i].length) > 130)
                {
                    Console.logArea.value += s + '\n';
                    s = '';
                }
                s += _text[i] + ' ';
            }
            Console.logArea.value += s + '\n';
        }
        Console.logArea.scrollTop = Console.logArea.scrollHeight;
    }

    // -------------
    // Command line history
    // -------------    

    var TerminalControl =
    {
        TextHistory: [],
        currHistory: 0,
        currText: '',

        handleKeyDown: function(e)
        {
            switch (e.keyCode)
            {
                case 38:
                    if (TerminalControl.currHistory > 0)
                    {
                        if (TerminalControl.currHistory == TerminalControl.TextHistory.length)
                        {
                            TerminalControl.currText = Console.inputArea.value;
                        }
                        TerminalControl.currHistory--;
                        Console.inputArea.value = TerminalControl.TextHistory[TerminalControl.currHistory];
                    }
                    return false;
                case 40:
                    if (TerminalControl.currHistory < TerminalControl.TextHistory.length)
                    {
                        TerminalControl.currHistory++;
                        if (TerminalControl.currHistory < TerminalControl.TextHistory.length)
                        {
                            Console.inputArea.value = TerminalControl.TextHistory[TerminalControl.currHistory];
                        }
                        else
                        {
                            Console.inputArea.value = TerminalControl.currText;
                        }
                    }
                    return false;
                case 13:
                    {
                        TerminalControl.TextHistory.push(Console.inputArea.value);
                        TerminalControl.currHistory = TerminalControl.TextHistory.length;
                        setTimeout("Console.DebugCommand()", 0);
                    }
                    return false;
            }
            return true;
        }
    }

    // -------------
    // Keyboard dispatch
    // -------------    

    Console.prompt = 'Emulator command area. Type help for help.';

    Console.HandleKeyDown = function(e)
    {
        if (!Console.EditCB)
        {
            return TerminalControl.handleKeyDown(e);
        }
        return true;
    }
    var KeyboardFocus = Console.HandleKeyDown;

    Console.SetKeyboardFocus = function(_callback)
    {
        if (_callback)
        {
            KeyboardFocus = _callback;
        }
        else
        {
            if (Console.inputArea.value == Console.prompt) { Console.inputArea.value = ''; }
            KeyboardFocus = Console.HandleKeyDown;
        }
    }

    // -------------
    // Utility
    // -------------
    // -----------------------
    Console.H8 = function(_i)
    {
        var h = _i.toString(16);
        while (h.length < 2)
        {
            h = '0' + h;
        }
        return h;
    }

    // -----------------------
    Console.H16 = function(_i)
    {
        var h = _i.toString(16);
        while (h.length < 4)
        {
            h = '0' + h;
        }
        return h;
    }


    // -------------
    // Bootstrapping
    // -------------
    Console.Boot = function()
    {
        $('.editor').hide();
        Console.logArea = document.getElementById('log');
        Console.inputArea = document.getElementById('intext');
        Console.inputArea.value = Console.prompt;

        Emulator.Reset();

        document.onkeydown = function(e)
        {
            return KeyboardFocus(e);
        }

        var m = (/shell=([^&]+)/i).exec(window.location);
        if (m && m[1])
        {
            DebugCommand(unescape(m[1]).replace(/,/g, ' ').split(' '));
        }

    }

})();                   // (function(){

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
              var addr = eval('0x' + _args.shift());
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
      help: 'asm\nSwitch to assembly entry mode.',
      fn: function()
      {
          Console.BeginEdit(function(_text)
          {
              Assembler.Assemble(_text);
              Assembler.Patch();
          });
          Console.inputArea.value = Assembler.Program;
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

          var addr = eval('0x' + _args.shift());
          var line = (_addr & 0xfff0);
          var data;
          while ((data = _args.shift()) != undefined)
          {
              Emulator.WriteMem(addr++, eval('0x' + data));
          }
          while (line < _addr)
          {
              Emulator.Dump([line]);
              line += 0x10;
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

    Console.DebugCommand = function()
    {
        var cmd = Console.inputArea.value.split(' ');
        Console.inputArea.value = '';
        DebugCommand(cmd);
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
            Console.inputArea.value = '';
            Console.inputArea.rows = 1;
            Console.EditCB = undefined;
        }
    }

    Console.EditCancel = function()
    {
        $('.editor').hide();
        Console.inputArea.value = '';
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

        Emulator.Reset();

        document.onkeydown = function(e)
        {
            return KeyboardFocus(e);
        }
    }

})();       // (function(){

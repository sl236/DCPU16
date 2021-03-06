// DCPU16 emulator javascript implementation
// -----------------------------------------------------------------------
// http://www.toothycat.net/wiki/wiki.pl?MoonShadow/DCPU16
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
// -----------------------------------------------------------------------
// Debug console, utility and bootstrap functions

(function()
{
    function mem_write_breakpoint(_addr, _value)
    {
    	Console.Log("Memory breakpoint hit at " + Console.H16(_addr) + " with " + Console.H16(_value));
    	Emulator.paused = true;
    }
    
    Console.MBP_FN = mem_write_breakpoint;

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

  mbp:
  {
      help: 'mbp addr\nToggles a memory write breakpoint at addr.',
      fn: function(_args)
      {
          if (_args.length)
          {
              var addr = parseInt(_args.shift(), 16);
              if( !Emulator.MemoryHooks[addr] || (Emulator.MemoryHooks[addr] == mem_write_breakpoint) )
              {
              	if( Emulator.MemoryHooks[addr] == mem_write_breakpoint )
              	{
              		Emulator.MemoryHooks[addr] = null;
	            	Console.Log("Memory write breakpoint cleared at " + Console.H16(addr));
              	}
              	else
              	{
              		Emulator.MemoryHooks[addr] = mem_write_breakpoint;
	            	Console.Log("Memory write breakpoint set at " + Console.H16(addr));
              	}
              }
              else
              {
              	Console.Log("Could not set memory write breakpoint at " + Console.H16(addr) + ", address in use by memory mapped hardware.");
              }
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
  
  image:
  {
     help: 'image [file.b64]\nResets emulator and reads a base 64 encoded memory image. With no arguments, produces a base64 image from current memory content.',
     fn: function(_args) 
     { 
     	if( _args.length )
     	{
     		Emulator.paused=1;
         Console.ReadFile
                (
                    _args.join(' '),
                    function(data) { Emulator.LoadB64Image(data); }
                );
        }
        else
        {
        	window.open( "data:application/octet-stream,"+Emulator.GetB64MemoryDump(), "image.dmp.b64" );
        }
     }
  },

  runimage:
  {
     help: 'runimage [file.b64]\nResets emulator, reads a base 64 encoded memory image and runs it. With no arguments, produces a base64 image from current memory content.',
     fn: function(_args) 
     { 
     	if( _args.length )
     	{
     		Emulator.paused=1;
         Console.ReadFile
                (
                    _args.join(' '),
                    function(data) { Emulator.LoadB64Image(data); Emulator.paused=0; Emulator.Run(); }
                );
        }
        else
        {
        	window.open( "data:application/octet-stream,"+Emulator.GetB64MemoryDump(), "image.dmp.b64" );
        }
     }
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
                      return 0;
                  }
                  return 1;
              });
              Console.inputArea.value = _data ? _data : Assembler.Program;
          }

          if (_args.length)
          {
              Console.ReadFile
                (
                    _args.join(' '),
                    function(data) { go(data); }
                );
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
          var addr = _args ? _args.shift() : undefined;
          var count = _args ? _args.shift() : undefined;
          if (addr == undefined) { addr = Emulator.regs[9]; }
          if (count == undefined) { count = 4; }
          addr |= 0;
          count |= 0;
          for (var i = 0; i < count; i++)
          {
              var r = Emulator.Disassemble(addr);
              Console.Log(r[0]);
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
          var line = (addr & 0xfff0);
          var data;
          while ((data = _args.shift()) != undefined)
          {
              Emulator.WriteMem(addr++, parseInt(data, 16));
          }
          while (line < addr)
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

    Console.ReadFile = function(_file, _cb)
    {
        $.ajax({
            url: _file,
            dataType: 'text',
            success: _cb,
            error: (function(_f)
                    { 
                        return function(_xhr, _status, _thrown ) 
                        { 
                            Console.Log("Failed to read '" + _f + "': " + _status.toString() + "; " + _thrown.toString());
                        }
                    }
                )(_file)
        });
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

        handleKeyDown: function(e, _etype)
        {
            if (_etype != 1)
            {
                return true;
            }

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

    Console.HandleKeyEvent = function(e, _up)
    {
        if (!Console.EditCB)
        {
            return TerminalControl.handleKeyDown(e, _up);
        }
        return true;
    }
    var KeyboardFocus = Console.HandleKeyEvent;

    Console.SetKeyboardFocus = function(_callback)
    {
        if (_callback)
        {
            KeyboardFocus = _callback;
        }
        else
        {
            if (Console.inputArea.value == Console.prompt) { Console.inputArea.value = ''; }
            KeyboardFocus = Console.HandleKeyEvent;
        }
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
        for( var i = 0; i < Peripherals.length; i++ )
        {
            Peripherals[i](DebugCommands);
        }
        Emulator.Reset();

        document.onkeypress = function(e)
        {
            return KeyboardFocus(e, 0);
        }

        document.onkeydown = function(e)
        {
            return KeyboardFocus(e, 1);
        }

        document.onkeyup = function(e)
        {
            return KeyboardFocus(e, 2);
        }

        var m = (/shell=([^&]+)/i).exec(window.location);
        if (m && m[1])
        {
            DebugCommand(unescape(m[1]).replace(/,/g, ' ').split(' '));
        }
    }

})();                     // (function(){

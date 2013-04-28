// ----------------------
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

// ----------------------
var Console =
{
	Out: function(_text)
	{
		java.lang.System.out.print(_text);
	},

	Log: function(_text)
    {
    	if (!Wrapper.options['q'])
    	{
    		java.lang.System.err.println(_text);
    	}
    },

	ReadFile: function(_file, _callback)
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
};
window.Console = Console;

function setTimeout( _fn, _time )
{
    (function(_expr, _old) { Wrapper.timeout = function() { return (_old ? _old() : false) || eval(_expr); } })(_fn, Wrapper.timeout);
}

// ----------------------
var mc = {
	Build: function(){},
	Backends: [],
	Output: 'dasm16'
};

load( 'lexer.js' );
load( 'mc_parser.js' );
load( 'mc_backend_dasm16.js' );
// ----------------------

(function()
{
    if (Wrapper.Arguments.length)
    {
    	var file = null;
    	for (var i = 0; i < Wrapper.Arguments.length; i++)
    	{
    		var x = Wrapper.Arguments[i];
    		if (x[0] == '-')
    		{
    			if (x.length >= 2)
    			{
    				Wrapper.options[x[1]] = (x.length > 2) ? x.substring(2) : true;
    			}
    		}
    		else
    		{
    			file = x;
    		}
    	}
    	if (!file)
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

		// ----------------------
		Console.ReadFile(file, function(_data){
			mc.Build(_data);
		});
		// ----------------------
    }
    else
    {
    	Console.Log("Usage: ./mc [options] file\nAvailable options:\n");
    }

})();

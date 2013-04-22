(function(){
// -------------------------------------

var TT = 
{
	Error:			0,
	Char:			1,
	Identifier:		2,
	Integer:		3,
	String:			4,
	EOF:			5,

	Names: []
};
for( var i in TT ) { TT.Names[TT[i]] = i; }

// -------------------------------------

var TokenMap = [];
var EscapeMap = [ ];

// -------------------------------------

(function()
{
	var identifierStarts = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
	for( var i = 0; i < identifierStarts.length; ++i )
	{
		TokenMap[identifierStarts[i]] = TT.Identifier;
	}

	var digits = '0123456789';
	for (var i = 0; i < digits.length; ++i)
	{
		TokenMap[digits[i]] = TT.Integer;
	}

	TokenMap['"'] = TT.String;

	EscapeMap['t'] = "\t";
	EscapeMap['n'] = "\n";
	EscapeMap['r'] = "\r";
})();

// -------------------------------------

function Lexer(_data) 
{ 
	this.m_data = _data;
	this.m_pos = 0;
	this.m_row = 0;
	this.m_col = 0;
	this.m_TT = TT.Error;
	this.Next();
}

Lexer.prototype.Next = function()
{
	var data = this.m_data;
	var pos = this.m_pos;
	var row = this.m_row;
	var col = this.m_col;
	var len = data.length;
	var c;
	while( (pos < len) && ((c = data[pos]) <= 32 ) )
	{
		if( c == 10 )
		{
			col = 0;
			++row;
		}
		else
		{
			++col;
		}
		pos++;
	}

	if( pos >= len )
	{
		this.m_pos = pos;
		this.m_row = row;
		this.m_col = col;
		this.m_TT = TT.EOF;
		return;
	}

	var start = pos;
	var tt = TokenMap[c];
	++col; ++pos;

	switch( tt )
	{
		case TT.Identifier:
			{
				while( pos < len )
				{
					var cc = data[pos];
					var t = TokenMap[cc];
					if( ( t != TT.Identifier ) && ( t != TT.Integer ) )
						break;
					++col; 
					++pos;
					c += cc;
				}
			}
			break;

		case TT.Integer:
			{
				var radix = 10;
				while (pos < len)
				{
					var cc = data[pos];
					var t = TokenMap[cc];
					if (t != TT.Integer)
					{
						if( ( c == '0') && ( cc == 'x' ) && ( radix == 10 ) )
						{
							c = '';
							cc = '';
							radix = 16;
						}
						else
						{
							break;
						}
					}
					++col;
					++pos;
					c += cc;
				}
				c = parseInt(c, radix);
			}
			break;

		case TT.String:
			{
				c = '';
				this.m_pos = pos;
				this.m_row = row;
				this.m_col = col;

				while (pos < len)
				{
					if( data[pos] == '\\' )
					{
						++col; ++pos;
						var cc = EscapeMap[data[pos]];
						c += cc ? cc : data[pos];
						++col; ++pos;
					}
					else if( TokenMap[data[pos]] == TT.String )
					{
						++col; ++pos;
						break;
					}
					else
					{
						c += data[pos];
						++col; ++pos;
					}

				}

				if( pos == len )
				{
					this.m_token = "Unterminated string constant";
					this.m_TT = TT.Error;
					return;
				}
			}
			break;

		default:
				tt = TT.Char;
			break;
	}

	this.m_TT = tt;
	this.m_token = c;
	this.m_pos = pos;
	this.m_row = row;
	this.m_col = col;
}

// -------------------------------------



// -------------------------------------

mc.Parse=function(_data)
{
	var lex = new Lexer(_data);	
	while( lex.m_TT != TT.EOF )
	{
		Console.Log( TT.Names[lex.m_TT] + ": '" + lex.m_token + "'" );
		if( lex.m_TT == TT.Error )
		{
			return 0;
		}

		lex.Next();
	}

	return 1;
}

// -------------------------------------
mc.Build=function(_data)
{
	if (!mc.Backends[mc.Output])
	{
		Console.Log("No backend available for " + mc.Output);
		return;
	}

	var tree = mc.Parse(_data);
	if( tree )
	{
		var result = mc.Backends[mc.Output].Build( tree );
		if( result )
		{
			Console.Out(result);
		}
		else
		{
			Console.Log("Build failed for " + mc.Output );
		}
	}
	else
	{
		Console.Log("Parse failed.");
	}
}

// -------------------------------------
})();

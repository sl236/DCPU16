var TT = {}; // Token types
function Lexer() {}

(function(){
// -------------------------------------

TT = 
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

Lexer = function(_data, _context) 
{ 
	this.m_data = _data;
	this.m_pos = 0;
	this.m_row = 0;
	this.m_col = 0;
	this.m_TT = TT.Error;
	this.m_context = _context;
	this.Next();
}

Lexer.prototype.PushContext = function()
{
	this.m_context = this.m_context.MakeChild();
}

Lexer.prototype.PopContext = function()
{
	this.m_context = this.m_context.GetParent();
}

Lexer.prototype.IsOK = function()
{
	return (this.m_TT != TT.EOF) && (this.m_TT != TT.Error);
}

Lexer.prototype.Warn = function(_message)
{
	Console.Log("Warning: line " + (this.m_row + 1) + " column " + (this.m_col + 1) + ": " + _message);
}

Lexer.prototype.SetError = function( _message )
{
	if( this.m_TT != TT.Error )
	{
		this.m_TT = TT.Error;
		this.m_token = "Error: line " + (this.m_row + 1) + " column " + (this.m_col + 1) + ": " + _message;
		Console.Log( this.m_token );
	}
	return 0;
}

Lexer.prototype.ConsumeIdentifier = function()
{
	if( this.IsOK() && ( this.m_TT == TT.Identifier ) )
	{
		var token = this.m_token;
		this.Next();
		return token;
	}

	return this.SetError("Expected an identifier");
}

Lexer.prototype.ConsumeChar = function(c)
{
	if( this.IsOK() && ( this.m_TT == TT.Char ) && (this.m_token == c) )
	{
		this.Next();
	}
	else
	{
		this.SetError( 'Expected: ' + c + ' got: ' + this.m_token );
	}
}

Lexer.prototype.ConsumeOptionalChar = function (c) {
    if (this.IsOK() && (this.m_TT == TT.Char) && (this.m_token == c)) {
        this.Next();
        return 1;
    }
    return 0;
}

Lexer.prototype.Next = function()
{
	var data = this.m_data;
	var pos = this.m_pos;
	var row = this.m_row;
	var col = this.m_col;
	var len = data.length;
	var c;
	while( (pos < len) && ((c = data[pos]) <= ' ' ) )
	{
		if( c == "\n" )
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
					this.SetError("Unterminated string constant");
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

})();
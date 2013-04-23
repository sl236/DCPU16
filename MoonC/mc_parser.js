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

function Lexer(_data, _context) 
{ 
	this.m_data = _data;
	this.m_pos = 0;
	this.m_row = 0;
	this.m_col = 0;
	this.m_TT = TT.Error;
	this.m_context = _context;
	this.Next();
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

// -------------------------------------

function Context(_parent)
{
	this.m_parent = _parent;
	this.m_types = {};
	this.m_vars = {};
	this.m_funs = {};
}

Context.prototype.TypeDef = function(_name)
{
	if( this.m_types[_name] ) { return this.m_types[_name]; }
	return this.m_parent ? this.m_parent.TypeDef(_name) : false;
}

// -------------------------------------
var RT = 
{	
	Invalid: 0,
	StorageClassSpecifier: 1,
	TypeSpecifier: 2,
	StructSpecifier: 3,
	UnionSpecifier: 4,
	EnumSpecifier: 5,
	TypeQualifier: 6
};

var ReservedWords = { };
[ 'typedef', 'extern', 'static', 'auto', 'register' ].map( function(i){ ReservedWords[i] = RT.StorageClassSpecifier; } );
[ 'struct' ].map( function(i){ ReservedWords[i] = RT.StructSpecifier; } );
[ 'union' ].map( function(i){ ReservedWords[i] = RT.UnionSpecifier; } );
[ 'enum' ].map( function(i){ ReservedWords[i] = RT.EnumSpecifier; } );

var integralTypeNames = {};
var baseTypeNames = {};
var typeLengths = {};
var typeSignedness = {};
var typeQualifiers = {};
var compositeTypes = {};
['void', 'char', 'int', 'float', 'double' ].map(function(i) { baseTypeNames[i] = i; });
['char', 'int'].map(function(i) { integralTypeNames[i] = i; });
['short', 'long'].map(function(i) { typeLengths[i] = i; });
['signed', 'unsigned'].map(function(i) { typeSignedness[i] = i; });
[ 'struct', 'union', 'class' ].map(function(i) { compositeTypes[i] = i; });

function parseCompositeTypeDef(lex)
{
	lex.SetError( "TODO: parseCompositeTypeDef(lex)" );
}

function parseType(lex)
{
	var typedef = false;
	var decl = {};
	
	if( ( lex.m_TT == TT.Identifier) && ( lex.m_token == 'typedef' ) )
	{
		typedef = true;
		lex.Next();
	}
	
	while( lex.IsOK() && (lex.m_TT == TT.Identifier) )
	{
		// void, char, int, float, double
		if( baseTypeNames[lex.m_token] )
		{
			if( !decl.base || (decl.base == lex.m_token) )
			{
				decl.base = lex.m_token;
				if( decl.tlen && !integralTypeNames[decl.base] )
				{
					return lex.SetError( decl.tlen + " is invalid for " + decl.base );
				}
				lex.Next();
			}
			else
			{
				return lex.SetError( "Unexpected " + lex.m_token + ": already seen " + decl.base );
			}
		}
		else if( typeLengths[lex.m_token] )
		{
			if (!decl.tlen || (decl.tlen == lex.m_token))
			{
				decl.tlen = lex.m_token;
				if( decl.base && !integralTypeNames[decl.base] )
				{
					return lex.SetError( decl.tlen + " is invalid for " + decl.base );
				}
				lex.Next();
			}
			else
			{
				return lex.SetError("Unexpected " + lex.m_token + ": already seen " + decl.tlen);
			}
		}
		else if( typeSignedness[lex.m_token] )
		{
			if (!decl.tsign || (decl.tsign == lex.m_token))
			{
				decl.tsign = lex.m_token;
				if( decl.base && !integralTypeNames[decl.base] )
				{
					return lex.SetError( decl.tsign + " is invalid for " + decl.base );
				}
				lex.Next();
			}
			else
			{
				return lex.SetError("Unexpected " + lex.m_token + ": already seen " + decl.tsign);
			}
		}
		else if( typeQualifiers[lex.m_token] )
		{
			if (!decl.tqual || (decl.tqual == lex.m_token))
			{
				decl.tqual = lex.m_token;
				lex.Next();
			}
			else
			{
				return lex.SetError("Unexpected " + lex.m_token + ": already seen " + decl.tqual);
			}			
		}
		else if( compositeTypes[lex.m_token] )
		{
			if( !decl.base )
			{
				decl.base = lex.m_token;
				lex.Next();
				if( ( lex.m_TT == TT.Char ) && ( lex.m_token == '{' ) )
				{
					decl.def = parseCompositeTypeDef(lex);
				}
				else if( lex.m_TT == TT.Identifier )
				{
					var def = lex.m_context.TypeDef( lex.m_token );
					if( def )
					{
						decl.name = lex.m_token;
						decl.def = def;
						lex.Next();
					}
					else if( !ReservedWords[lex.m_token] )
					{
						decl.name = lex.m_token;
						lex.m_context.m_types[decl.name] = decl;
						lex.Next();
						if( ( lex.m_TT == TT.Char ) && ( lex.m_token == '{' ) )
						{
							decl.def = parseCompositeTypeDef(lex);
						}
						else if( ( lex.m_TT == TT.Char ) && ( lex.m_token == ';' ) )
						{
							return decl;
						}
						else
						{
							return lex.SetError( "Unexpected " + lex.m_token + ". Expected { or ;");
						}
					}
					else
					{
						return lex.SetError(lex.m_token + " is invalid here");
					}
				}
				else
				{
					return lex.SetError("Unexpected " + lex.m_token + ": expecting a " + decl.base + " name or definition");
				}			
			}
			else
			{
				return lex.SetError( "Unexpected " + lex.m_token + ": already seen " + decl.base );
			}		
		}
		else if( lex.m_token == 'enum' )
		{			
			return lex.SetError("TODO: enums");
		}
		else 
		{
			var td = lex.m_context.TypeDef( lex.m_token );
			if( td )
			{
				decl.base = decl.base ? decl.base : 'typedef';
				decl.name = lex.m_token;
				decl.def = td;
				lex.Next();
			}
			else if( typedef )
			{
				typedef = false;
				lex.m_context.m_types[lex.m_token] = decl;
				lex.Next();
				if( ( lex.m_TT == TT.Char ) && ( lex.m_token == ';' ) )
				{
					return decl;
				}
				lex.SetError("Expected ; but got " + lex.m_token);				
			}
			else
			{
				return decl;
			}
		}
	}
	
	if( typedef && !Object.keys(decl).length )
	{
		return lex.SetError( "Expected a type definition to follow typedef" );
	}
	
	return decl;
}


// ----------------------
function parseTranslationUnit(lex)
{
	// external declaration: function-definition | declaration

	// function-definition: declaration-specifiers? declarator declaration-list? compound-statement
	// declaration: declaration-specifiers init-declarator-list? ';'

	// declaration-specifiers: (storage-class-specifier | type-specifier | type-qualifier) declaration-specifiers?
	// declarator: pointer? direct-declarator
	// declaration-list: declaration declaration-list?

	// init-declarator-list: init-declarator | init-declarator , init-declarator-list
	// init-declarator: declarator | declarator = initializer
	
	// direct-declarator: identifier | ( declarator ) | direct-declarator [ ] | direct-declarator [ constant-expression ] | direct-declarator ( ) | direct-declarator ( parameter-type-list ) | direct-declarator ( identifier-list )

	// storage-class-specifier: <reserved>
    // type-specifier: <reserved> | struct-or-union-specifier | enum-specifier | typedef-name

	// compound-statement: { declaration-list? statement-list? }

	var type = parseType(lex);
	var name = '';

	if( lex.IsOK() && type )
	{		
		if (lex.m_TT == TT.Identifier)
		{
			name = lex.m_token;
			lex.Next();
		}
		else if ((lex.m_TT == TT.Char) && (lex.m_token == ';'))
		{
			return lex.Next();
		}
		else
		{
			return lex.SetError("Expected identifier or ; but got '" + lex.m_token + "'");
		}
	}
	else
	{
		return lex.SetError("Expected a declaration");
	}
	
	if( lex.IsOK() )
	{
		if ((lex.m_TT == TT.Char) && (lex.m_token == ';'))
		{
			if( lex.m_context.m_vars[name] )
			{
				return lex.SetError("Duplicate declaration: " + lex.m_context.m_vars[name]);
			}
			
			lex.m_context.m_vars[name] = { 'type': type }
			return lex.Next();
		}
		else if ((lex.m_TT == TT.Char) && (lex.m_token == '='))
		{
			return lex.SetError("TODO: implement initialisers");
		}
		else if ((lex.m_TT == TT.Char) && (lex.m_token == '('))
		{
			return lex.SetError("TODO: implement functions");
		}
		else
		{
			return lex.SetError("Unexpected '" + lex.m_token + "', expecting = ( or ;");	
		}
	}
	else
	{
		return lex.SetError("Unexpected " + lex.m_token);	
	}
	
	return lex.SetError("TODO: implement declaration");	
}

// -------------------------------------

mc.Parse=function(_data)
{
	var lex = new Lexer(_data, new Context());
	var result = [];
	while( lex.IsOK() )
	{
		var unit = parseTranslationUnit(lex);
		if (unit)
		{ 
			result.push(unit);
		}
	}

	return result;
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

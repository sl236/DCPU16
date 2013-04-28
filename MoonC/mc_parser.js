(function(){


// -------------------------------------
var ReservedWords = { };

["typedef", "extern", "static", "auto",
	"register", "void", "char", "short",
	"int", "long", "float", "double",
	"signed", "unsigned",
	"struct", "union", "const", "restrict",
	"volatile", "sizeof", "enum", "inline",
	"case", "default", "if", "else",
	"switch", "while", "do", "for",
	"goto", "continue", "break", "return"
].map(function(i) { ReservedWords[i] = 1; });

var integralTypeNames = {};
var baseTypeNames = {};
var typeLengths = {};
var typeSignedness = {};
var typeQualifiers = {};
var compositeTypes = {};
['void', 'char', 'int', 'float', 'double'].map(function(i) { baseTypeNames[i] = i; });
['char', 'int'].map(function(i) { integralTypeNames[i] = i; });
['short', 'long'].map(function(i) { typeLengths[i] = i; });
['signed', 'unsigned'].map(function(i) { typeSignedness[i] = i; });
['static', 'const', 'volatile'].map(function(i) { typeQualifiers[i] = i; });
['struct', 'union', 'class'].map(function(i) { compositeTypes[i] = i; });



// -------------------------------------
function Context(_parent)
{
	this.m_parent = _parent;
	this.m_types = {};
	this.m_vars = {};
	this.m_funs = {};
}

Context.prototype.GetParent = function()
{
	return this.m_parent;
}

Context.prototype.MakeChild = function()
{
	return new Context(this);
}

Context.prototype.TypeDef = function(_name)
{
	if( this.m_types[_name] ) { return this.m_types[_name]; }
	return this.m_parent ? this.m_parent.TypeDef(_name) : false;
}

Context.prototype.FuncDef = function(_name)
{
	if (this.m_funs[_name]) { return this.m_funs[_name]; }
	return this.m_parent ? this.m_parent.FuncDef(_name) : false;
}

Context.prototype.VarDef = function(_name)
{
	if (this.m_vars[_name]) { return this.m_vars[_name]; }
	return this.m_parent ? this.m_parent.VarDef(_name) : false;
}

Context.prototype.IsDefined = function(_name)
{
	return ReservedWords[_name] || this.TypeDef(_name) || this.FuncDef(_name) || this.VarDef(_name);
}



// -------------------------------------
function parseSpecifierQualifier(lex,decl)
{
	// void, char, int, float, double
	if (baseTypeNames[lex.m_token])
	{
		if (!decl.base || (decl.base == lex.m_token))
		{
			decl.base = lex.m_token;
			if (decl.tlen && !integralTypeNames[decl.base])
			{
				return lex.SetError(decl.tlen + " is invalid for " + decl.base);
			}
		}
		else
		{
			return lex.SetError("Unexpected " + lex.m_token + ": already seen " + decl.base);
		}
	}
	else if (typeLengths[lex.m_token])
	{
		if (!decl.tlen || (decl.tlen == lex.m_token))
		{
			decl.tlen = lex.m_token;
			if (decl.base && !integralTypeNames[decl.base])
			{
				return lex.SetError(decl.tlen + " is invalid for " + decl.base);
			}
		}
		else
		{
			return lex.SetError("Unexpected " + lex.m_token + ": already seen " + decl.tlen);
		}
	}
	else if (typeSignedness[lex.m_token])
	{
		if (!decl.tsign || (decl.tsign == lex.m_token))
		{
			decl.tsign = lex.m_token;
			if (decl.base && !integralTypeNames[decl.base])
			{
				return lex.SetError(decl.tsign + " is invalid for " + decl.base);
			}
		}
		else
		{
			return lex.SetError("Unexpected " + lex.m_token + ": already seen " + decl.tsign);
		}
	}
	else if (typeQualifiers[lex.m_token])
	{
		decl[lex.m_token] = 1;
	}
	else
	{
		return 0;
	}

	lex.Next();
	return 1;
}



// -------------------------------------
function parseDeclarator(lex)
{
	if (lex.m_TT != TT.Identifier)
	{
		return lex.SetError("Expected an identifier, got" + lex.m_token);
	}
	
	var fdef = lex.m_context.FuncDef(lex.m_token);
	var vdef = lex.m_context.VarDef(lex.m_token);
	var tdef = lex.m_context.TypeDef(lex.m_token);
	if (fdef)
	{
		if( fdef['block'] && !(fdef['inline']) )
		{
			return lex.SetError(lex.m_token + ": function already declared");
		}
	}
	else if ( vdef )
	{
		if ( !vdef['extern'] )
		{
			return lex.SetError(lex.m_token + ": variable already declared");
		}		
	}
	else if (tdef)
	{
		return lex.SetError(lex.m_token + ": type already declared");
	}
	else if (ReservedWords[lex.m_token])
	{
		return lex.SetError(lex.m_token + " is a reserved word");
	}

	var result = lex.m_token;
	lex.Next();
	return result;
}




// -------------------------------------
function parseCompositeTypeDef(lex, decl)
{
	decl.members = [];
	lex.ConsumeChar('{');

	while(lex.IsOK() && !((lex.m_TT == TT.Char) && (lex.m_token == '}')))
	{
		
		var item = parseType(lex);		
		if( !item.base )
		{
			return lex.SetError("Expected a type");
		}
		item.name = parseDeclarator(lex);
		decl.members.push(item);
		lex.ConsumeChar(';');
	}

	lex.ConsumeChar('}');
}




// -------------------------------------
function parseFunctionArgumentDeclaration(lex,decl)
{
	lex.ConsumeChar('(');
	decl.args = [];
	while( lex.IsOK() && !((lex.m_TT == TT.Char) && (lex.m_token == ')')) )
	{
		var curr_arg = { type: parseType(lex) };

		if( lex.IsOK() && ( lex.m_TT == TT.Identifier ) )
		{
			if (lex.m_context.IsDefined(lex.m_token))
			{
				return lex.SetError(lex.m_token + " is already defined and/or reserved");
			}
			if (lex.m_context.TypeDef(lex.m_token))
			{
				return lex.SetError(lex.m_token + "is an existing type name");
			}
			curr_arg.name = lex.m_token;
			lex.Next();
		}
		
		decl.args.push( curr_arg );
		if( !((lex.m_TT == TT.Char) && (lex.m_token == ',')) )
		{
			break;
		}
		lex.Next();
	}
	lex.ConsumeChar(')');
}




// -------------------------------------
function parseType(lex)
{
	var typedef = false;
	var decl = {};
	
	if( ( lex.m_TT == TT.Identifier) && ( lex.m_token == 'typedef' ) )
	{
		typedef = true;
		lex.Next();
	}
	
	while( lex.IsOK() )
	{
		if(lex.m_TT == TT.Identifier)
		{
			if (parseSpecifierQualifier(lex,decl))
			{
				;			
			}
			else if( compositeTypes[lex.m_token] )
			{
				if( !decl.base )
				{
					decl.base = lex.m_token;
					lex.Next();
					if( ( lex.m_TT == TT.Char ) && ( lex.m_token == '{' ) )
					{
						parseCompositeTypeDef(lex,decl);
					}
					else if( lex.m_TT == TT.Identifier )
					{
						var def = lex.m_context.TypeDef( lex.m_token );
						if( def )
						{
							decl.tname = lex.m_token;
							decl.tcontext = (function(x){return function() { return x; }})(lex.m_context);
							lex.Next();
						}
						else if( !lex.m_context.IsDefined(lex.m_token) )
						{
							var child = {tname: lex.m_token, base:decl.base };
							decl.base = lex.m_token;
							decl.tcontext = (function(x){return function() { return x; }})(lex.m_context);
							lex.m_context.m_types[child.tname] = child;
							lex.Next();
							if( ( lex.m_TT == TT.Char ) && ( lex.m_token == '{' ) )
							{
								parseCompositeTypeDef(lex,child);
							}
							else
							{
								return lex.SetError( "Unexpected " + lex.m_token + ". Expected " + child.tname + " to be defined.");
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
				decl = { base: 'enum', members: [] };		
				return lex.SetError("TODO: enums");
			}
			else 
			{
				var td = lex.m_context.TypeDef( lex.m_token );
				if( td )
				{
					decl.base = 'typedef';
					decl.tname = lex.m_token;
					decl.tcontext = (function(x){return function() { return x; }})(lex.m_context);
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
		else if( ( lex.m_TT == TT.Char ) && (lex.m_token == '*') )
		{
			decl = { base: '*', child: decl };
			lex.Next();
		}
		else if ((lex.m_TT == TT.Char) && (lex.m_token == '('))
		{
			decl = { base: '(*)', retval: decl };
			lex.Next();
			lex.ConsumeChar('*');
			decl.name = lex.ConsumeIdentifier();
			lex.ConsumeChar(')');
			parseFunctionArgumentDeclaration(lex, decl);

			if( typedef )
			{
				lex.m_context.m_types[decl.name] = decl;
				delete decl.name;
			}
			return decl;
		}
		else
		{
			break;
		}
	}
	
	if( typedef && !Object.keys(decl).length )
	{
		return lex.SetError( "Expected a type definition to follow typedef" );
	}
	
	return decl;
}




// -------------------------------------
function parseExpression(lex)
{
	while( lex.IsOK() && !((lex.m_TT == TT.Char) && (lex.m_token == ';')) )
	{
		var sequence = [];
		while( lex.IsOK() && !((lex.m_TT == TT.Char) && (lex.m_token == ',')) )
		{
			return lex.SetError("TODO: expressions");
		}
		
	}
}




// -------------------------------------
function parseStatement(lex)
{

	var result = { 'op': lex.m_token };

	if (((lex.m_TT == TT.Char) && (lex.m_token == '{')))
	{
		lex.PushContext();
		result = { 
				'op': 'block', 
				'data': parseCodeBlock(lex), 
				'ctx': (function(x){return function() { return x; }})(lex.m_context)
			};
		lex.PopContext();
	}
	else if ((lex.m_TT == TT.Identifier) && ReservedWords[lex.m_token])
	{
		switch (lex.m_token)
		{
			case "if":
				{
					lex.Next();
					lex.ConsumeChar('(');
					result.cond = parseExpression(lex);
					lex.ConsumeChar(')');
					result.block = parseStatement(lex);
					if( lex.IsOK() && (lex.m_TT == TT.Identifier) && (lex.m_token == 'else') )
					{
						lex.Next();
						result.fblock = parseStatement(lex);
					}
				}
				break;

			case "while":
					lex.Next();
					lex.ConsumeChar('(');
					result.cond = parseExpression(lex);
					lex.ConsumeChar(')');
					result.block = parseStatement(lex);
				break;

			case "do":
					lex.Next();
					result.block = parseStatement(lex);
					if( lex.IsOK() && (lex.m_TT == TT.Identifier) && (lex.m_token == 'while') )
					{
						lex.ConsumeChar('(');
						result.cond = parseExpression(lex);
						lex.ConsumeChar(')');
						lex.ConsumeChar(';');
					}
				break;

			case "for":
					lex.Next();
					lex.ConsumeChar('(');
					result.init = parseExpression(lex);
					lex.ConsumeChar(';');
					result.cond = parseExpression(lex);
					lex.ConsumeChar(';');
					result.iter = parseExpression(lex);
					lex.ConsumeChar(')');
					result.block = parseStatement(lex);
				break;

			case "switch":
					lex.Next();
					lex.ConsumeChar('(');
					result.cond = parseExpression(lex);
					lex.ConsumeChar(')');
					result.block = parseStatement(lex);
				break;

			case "case":					
					lex.Next();
					result.expr = parseExpression(lex);
					lex.ConsumeChar(':');
				break;

			case "default":
					lex.Next();
					lex.ConsumeChar(':');
				break;

			case "break":
					lex.Next();
					lex.ConsumeChar(';');
				break;

			case "continue":
					lex.Next();
					lex.ConsumeChar(';');
				break;

			case "return":
					lex.Next();
					if( lex.IsOK() && !((lex.m_TT == TT.Char) && (lex.m_token == ';')) )
					{
						result.result = parseExpression(lex);
					}
					lex.ConsumeChar(';');
				break;

			case "goto":
					lex.Next();
					result.lbl = lex.ConsumeIdentifier();
				break;

			default:
				return parseTranslationUnit(lex);
		}
	}
	else if ((lex.m_TT == TT.Identifier) && ReservedWords[lex.m_token])
	{
		return parseTranslationUnit(lex);
	}
	else
	{
		result = { 'op': 'expr', 'data': parseExpression(lex) };
		lex.ConsumeChar(';');
	}

	return result;
}




// -------------------------------------
function parseCodeBlock(lex)
{
	var statements = [];
	lex.ConsumeChar('{');

	while( lex.IsOK() && !((lex.m_TT == TT.Char) && (lex.m_token == '}')) )
	{
		var statement = parseStatement(lex);
		if(statement) { statements.push(statement); }
	}

	lex.ConsumeChar('}');
	return statements;
}





// -------------------------------------
function parseTranslationUnit(lex)
{
	var type = parseType(lex);
	var decl;
	var name = '';

	if( lex.IsOK() && Object.keys(type).length )
	{		
		if ((lex.m_TT == TT.Char) && (lex.m_token == ';'))
		{
			if( !(type.base && ( type.base == '(*)' ) && type.name) )
			{
				return lex.Next();
			}
			name = type.name;
			delete type.name;
		}
		else
		{
			name = parseDeclarator(lex);
		}
	}
	else
	{
		return lex.SetError("Expected a declaration");
	}
	
	while( lex.IsOK() )
	{
		if ((lex.m_TT == TT.Char) && (lex.m_token == ';'))
		{
			var vd = lex.m_context.m_vars[name];
			if( vd && !vd['extern'] )
			{
				return lex.SetError("Duplicate declaration: " + lex.m_context.m_vars[name]);
			}
			
			lex.m_context.m_vars[name] = { 'type': type };
			if( decl )
			{
				lex.m_context.m_vars[name].decl = decl;
			}
			return lex.Next();
		}
		else if ((lex.m_TT == TT.Char) && (lex.m_token == '='))
		{
			lex.ConsumeChar('=');
			decl = parseExpression(lex);
		}
		else if ((lex.m_TT == TT.Char) && (lex.m_token == '('))
		{
			var fdecl = { 'base':'(*)', 'retval':type };
			lex.m_context.m_funs[name] = fdecl;
			parseFunctionArgumentDeclaration(lex, fdecl);
			if (((lex.m_TT == TT.Char) && (lex.m_token == '{')))
			{
				lex.PushContext();
				for( var i = 0; i < fdecl.args.length; i++ )
				{
					if( fdecl.args[i].name )
					{
						lex.m_context.m_vars[fdecl.args[i].name] = fdecl.args[i];
					}
				}
				fdecl['ctx'] = (function(x){return function() { return x; }})(lex.m_context);
				fdecl['block'] = parseCodeBlock(lex);
				lex.PopContext();
				return;
			}
			return lex.ConsumeChar(';');
		}
		else
		{
			return lex.SetError("Unexpected '" + lex.m_token + "', expecting = ( or ;");	
		}
	}
}




// -------------------------------------
mc.Parse=function(_data)
{
	var context = new Context();
	var lex = new Lexer(_data, context);
	while( lex.IsOK() )
	{
		parseTranslationUnit(lex);
	}

	return context;
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

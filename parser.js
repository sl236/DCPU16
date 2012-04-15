// ------------------------------------------------------
// Javascript parser generator - http://www.toothycat.net/wiki/wiki.pl?MoonShadow/JavascriptParser
// Distributed under the just do what you like license (http://sam.zoy.org/wtfpl/COPYING)
//
// Grammar is an associative array of (rulename => array( definition, matchfunction ) )
// definition is a |-separated list of space-separated lists of terms
// a term is a rulename or a terminal
// a terminal is a /regexp/ or a 'literal string' or a $ (EOF-marker).
// matchfunction is passed a single argument which is an array of matches for the terms in the matched |-part of the rule.
// parser returns an array of [status, evaluation, unconsumed-input], where status is 1 if successful and 0 otherwise, 
// and if successful evaluation is a function that, when invoked, causes the matched parse tree to be evaluated.
// matchfunctions will not be called until the parse tree is evaluated; note that this implies a matchfunction cannot
// have side effects on the parsing.

function Parser ()
{
  if( arguments.length )
  {
    this._Initialise.apply( this, arguments );
  }
}

Parser.prototype._Initialise = function( _grammar )
{
    this.m_grammar = _grammar;
    
    for( var rule in this.m_grammar )
    {
        var f = this.m_grammar[rule][1];
        if( !f ) { f = function(_match) { return _match.length != 1 ? _match : _match[0]; }; }
        this.m_grammar[rule] = [ this.ParseGrammarLine( this.m_grammar[rule][0] ), f ];
    }
}

String.prototype.StripLeadingWhitespace = function()
{
    var r = this.match( /^(\s)+/ );
    if( r )
    {
        return this.substring( r.index + r[0].length );
    }
    return this;
}

String.prototype.FetchToNextWhitespace = function()
{
    var r = this.match( /\s/ );
    if( r )
    {
        return this.substring( 0, r.index );
    }
    else
    {
        return this;
    };
}

Parser.prototype.ParseGrammarLine = function( _line )
{    
    var result = [ ];
    var curr = [ ];
    
    _line = _line.StripLeadingWhitespace();
    while( _line.length )
    {
        var token = _line.FetchToNextWhitespace();
        _line = _line.substring( token.length );
        _line = _line.StripLeadingWhitespace();
                
        switch( token.charAt(0) )
        {
            case '|':
                    result.push( curr );
                    curr = [ ];
                break;
                
            case '/':
                    token = '^'+token.substring(1,token.length-1);
                    curr.push( [0, new RegExp(token)] ); // regexp
                break;
                
            case '\'':
                    curr.push( [1, token.substring(1,token.length-1)] ); // literal
                break;
            
            case '$':
                    curr.push( [3, 'EOF'] ); // EOF
                break;
                
            default:
                    curr.push( [2, token] ); // rule name
                break;
        }
    }
    
    if( curr.length )
    {
        result.push( curr );
    }
    
    return result;
}

Parser.prototype.Parse = function( _input, _rule )
{
    if( !_rule ) { _rule = "START"; }    
    if( !this.m_grammar[_rule] ) { return [ 0, [ ], _input]; }
        
    for( var poss = 0; poss < this.m_grammar[_rule][0].length; poss++ )
    {
        var input = _input;
        var matches = [ ];
        var nodes = this.m_grammar[_rule][0][poss];
        var fail = false;
        // window.Console.Log('Trying ' + _rule + ' on "' + _input + '"');
                
        for( var node = 0; (node < nodes.length) && (!fail); node++ )
        {
            switch( nodes[node][0] )
            {
                case 0:  // regexp
                    {
                        var r = input.match( nodes[node][1] );
                        if( r )
                        {
                            matches.push( (function(x){return function() { return x; }})(r[0]) );
                            input = input.substring( r[0].length );
                        }
                        else
                        {
                            // window.Console.Log(_rule + ' failed to match regexp ' + nodes[node][1].toString());
                            fail = true;
                        }
                    }
                    break;
                    
                case 1:  // literal
                        if( input.substring(0, nodes[node][1].length ) == nodes[node][1] )
                        {
                            var x = nodes[node][1];
                            matches.push( (function(_x){return function() { return _x; }})(x) );
                            input = input.substring( nodes[node][1].length );
                        }
                        else
                        {
                            // window.Console.Log(_rule + ' failed to match literal ' + nodes[node][1]);
                            fail = true;
                        }
                    break;
                    
                case 2:  // rule name
                    {
                        var r = this.Parse( input, nodes[node][1] );
                        if( r[0] )
                        {
                            matches.push( r[1] );
                            input = r[2];
                        }
                        else
                        {
                            fail = true;
                        }                        
                    }
                    break;
                    
                case 3:  // EOF
                    {
                        fail = input.length;
                        // if( fail) { window.Console.Log(_rule + ' failed to match EOF: "' + input + '" (' + input.charCodeAt(0) + ')'); }
                    }
                    break;
            }
        }
        
        if( !fail )
        {
            var f = (function(r,m){return function()
            {
                var n = [ ];
                for( var i = 0; i < matches.length; i++ )
                {
                    n[i] = m[i]();
                }                
                return r(n);
            }})( this.m_grammar[_rule][1], matches );
            return [ 1, f, input];
        }
    }
    
    return [ 0, [ ], input];
}

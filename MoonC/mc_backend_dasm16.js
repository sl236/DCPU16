(function(){
// -------------------------------------


function dump( t, indent )
{
	var result = '';
	var ind = indent + '    ';
	if( t )
	{
		if( typeof(t) === 'object' )
		{
			for( var i in t )
			{
				if( t.hasOwnProperty(i) )
				{
					result += "\n" + ind + i + ': ' + dump(t[i], ind);
				}
			}
		}
		else
		{
			result += t;
		}
	}
	return result;
}

// -------------------------------------
mc.Backends['dasm16'] = 
{
	Build: function(tree) 
	{ 
		return dump(tree, '') + "\n";
	}
}

// -------------------------------------
})();
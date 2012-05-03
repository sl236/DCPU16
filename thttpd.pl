#! /usr/bin/perl -w
use English;
use strict;
use IO::Select;
use threads;
use threads::shared;

# ---------------------------------------------------------------
# Minimal webserver
# Supports HTTP/1.0 (RFC 1945) and CGI 1.1
#

$|  = 1;

# mapping of file extensions to MIME types
my %mimetypes = 
(
   '' => 'Application/Octet-Stream',			# default
   'txt'  => 'text/plain',
   'js'  => 'text/plain',
   'xml'  => 'text/xml',
   'htm'  => 'text/html',
   'html' => 'text/html',
   'jpg'  => 'image/jpeg',
   'gif'  => 'image/gif',
   'pl'   => '_cgi'
);

# icons for directory listings
my %icons =						# these are URLs, not filesystem locations
(
	'' => '/file.jpg',			# default
    'text/plain' => '/text.jpg',
	'text/html' => '/file.jpg',
	'image/jpeg' => '/file.jpg',
	'image/gif' => '/file.jpg',
	'_directory' => '/folder.jpg',
	'_cgi' => '/cgi.jpg'
);

# When given a directory URL, look for these, in order;
# serve the first one found, and only give dir listing 
# if none of these exist.
my @indexpages =
(
    'index.htm',
    'index.html',
    'default.htm',
    'default.html'
);

# serve everything in this directory and its subdirectories:
my $serverroot = `pwd`;
chomp $serverroot;
chomp $serverroot;
$serverroot = $serverroot . '/';
chdir $serverroot;

my $server_name = '127.0.0.1';
my $server_port = 8010;

my $CRLF = "\015\012";

#
# ---------------------------------------------------------------
use IO::Socket;    # so we can do sockety stuff
use Net::hostent;  # so we can use gethostbyname
use FileHandle;
use IPC::Open2;    # two-way communication with CGI scripts

$SIG{CHLD} = 'IGNORE';

# all output to client goes through here
sub output
{
  my ($socket, $text) = @_;
  print $socket $text;
}

sub respond
{
  my ($client, $responsehash) = @_;

  output ($client, $responsehash->{'header'} . $CRLF);

  if($responsehash->{'content'})
  { 
     output ($client, "Content-Length:" . ((length ($responsehash->{'body'}))) . $CRLF);
	 output ($client, "Content-Type:" . $responsehash->{'type'} . $CRLF);
  }
  else
  {
     output ($client, "Content-Length:0" . $CRLF);
  }

  output ($client, $CRLF);

  if($responsehash->{'content'})
  { 
	 output ($client, $responsehash->{'body'});
  }
};

sub handle
{
  my ($client) = @_;
  my %response = ('header' => 'HTTP/1.0 400 Bad request', 'content' => 0);

  my $request = <$client>;
  my %headers = ( );
  my @content = ( );
  my $remote_host = '';
  chdir $serverroot;

  {
    my ($port, $iaddr) = sockaddr_in(getpeername($client));
    my $remote_host    = inet_ntoa($iaddr);
  }
  print $request;

  binmode($client);
  
  if( $request =~ /^POST/i )
  {
	  my $header = <$client>;
	  
	  while($header =~ /[^\015\012]/)
	  {
		if($header =~ /([^\015\012]+)\: ?([^\015\012]+)/)
		{
		  $headers{$1} = $2;
		}
		$header = <$client>;
	  }
	  if (defined $headers{'Content-Length'})
	  {
		my $length = 0;
		my $line;
		while(($length < $headers{'Content-Length'}) && ($line = <$client>))
		{
		   $length += length $line;
		   push @content, $line;
		}
	  }
  }

  shutdown ($client, 0); # make socket write-only
  my $fname = '';        # this is global. we compare with it when we redirect so we don't get stuck in a loop.

handlerequest:

  if(
     ($request =~ /^(GET) ([^ \015\012]*)/) || 
	 ($request =~ /^(POST) ([^ \015\012]*)/)
	)
  {
    $headers{'METHOD'} = $1;
    $fname = $2;

	# $fname is interpreted relative to server root.
	# assume / is path separator
	$fname=~s'\\'/'g;
	# do some magic to work out ..'s in paths
	while($fname=~s'[^/]+/[.]{2,3}(/|$)''g)
	{
		;
	}
	# remove any ..'s we couldn't cancel out
	$fname=~s'/[.]{2,3}''g;
	$fname=~s'^/'';

    $headers{'QUERY_STRING'} = '';
	if ($fname =~ /^(.*?)\?(.*)$/)
	{
	   $fname = $1;
	   $headers{'QUERY_STRING'} = $2;
	}
	$response{'header'} = 'HTTP/1.0 404 File not found';
	$response{'content'} = 1;
	$response{'type'} = 'text/html';
	$response{'body'} = '<HTML><BODY>File was not found.</BODY></HTML>';

	if (-f $serverroot.$fname)
	{
	   $response{'header'} = 'HTTP/1.0 200 OK';
	   $response{'filename'} = $fname;
	   if ($fname =~ /\.([^.]+)?/)
	   {
	      my $type = $mimetypes{lc $1};
		  defined $type or $type = $mimetypes{''};
		  $response{'type'} = $type;
	   }

	   if ($response{'type'} ne '_cgi')
	   {

		my $fh = new FileHandle($serverroot.$fname, 'r');
		binmode($fh);
		$response{'body'} = '';
		my $buffer = '';
		while(read($fh, $buffer, 4096))
		{
			$response{'body'} .= $buffer;
		}
		$fh->close;
	   }
	}
	elsif (-d $serverroot.$fname)
	{
	   my $cdir = $fname;
       opendir(DIR, $serverroot.$fname);
	   my @dir = readdir(DIR);
       closedir DIR;
	   $cdir =~ /\/$/ or $cdir .= '/';
	   $cdir =~ s'^/'';

	   my $dirlist = join(' ',@dir);
	   foreach my $indexfile(@indexpages)
	   {
	      if(($dirlist =~ /$indexfile/) && (-f $serverroot . $cdir . $indexfile))
		  {
		     $request = 'GET /' . $cdir . $indexfile;
			 goto handlerequest;
		  }
	   }

	   my $count = $#dir;
	   $response{'header'} = 'HTTP/1.0 200 OK';
	   while($count >= 0)
	   {
	     my $file = $dir[$count];
		 my $mtype = $mimetypes{''};

         if (-d $serverroot . $cdir . $file)
		 {
		   $mtype = '_directory';
		 }
		 elsif ($file =~ /\.([^.]+)?/)
		 {
            defined $mimetypes{lc $1} and $mtype = $mimetypes{lc $1};
		 }

		 my $icon = $icons{$mtype};
		 (defined $icon) or $icon = $icons{''};

         $file = '<A HREF="/' . $cdir . $file . '"><IMG SRC="' . $icon . '" BORDER=0 ALT="' . $mtype . '">' . $file . '</A>';
		 $dir[$count] = $file;
	     $count--;
	   }
       $response{'body'} = '<HTML><BODY>' . join ('<BR>', @dir) . '</BODY></HTML>';
	}
  }

  if (($response{'type'} eq '_cgi') && defined($response{'filename'}))
  {
    local %ENV;
	%ENV = (
	  'SERVER_SOFTWARE' => 'perl_server',
	  'SERVER_NAME' => $server_name,
	  'GATEWAY_INTERFACE' => 'CGI/1.1',
# stuff below are defaults; overridden from response hash if and when necessary.
	  'SERVER_PROTOCOL' => 'HTTP/1.0',
	  'SERVER_PORT' => $server_port,
	  'REQUEST_METHOD' => 'GET',
	  'PATH_INFO' => '',
	  'PATH_TRANSLATED' => '',
	  'SCRIPT_NAME' => $response{'filename'},
	  'QUERY_STRING' => '',
	  'REMOTE_ADDR' => $remote_host
	);
	defined ($headers{'QUERY_STRING'}) and $ENV{'QUERY_STRING'} = $headers{'QUERY_STRING'};
	defined ($headers{'METHOD'}) and $ENV{'REQUEST_METHOD'} = $headers{'METHOD'};
	defined ($headers{'Content-Length'}) and $ENV{'CONTENT_LENGTH'} = $headers{'Content-Length'};
	defined ($headers{'Content-Type'}) and $ENV{'CONTENT_TYPE'} = $headers{'Content-Type'};

	foreach my $header(keys %headers)
	{
	  my $ename = $header;
	  $ename =~ s/-/_/g;
	  $ename =~ s/ //g;
	  $ename =~ tr[a-z][A-Z];
	  $ENV{'HTTP_'.$ename} = $headers{$header};
	}


	my $reader = '';
	my $writer = '';
    my $pid = open2($reader, $writer, $response{'filename'} );
	binmode($reader);
	binmode($writer);

	my @result = ( );
	my @cgiheaders = ( );
	my $length = 0;
	my $body = 1;

	foreach (@content)
	{
		print $writer $_;
 	}

	while(<$reader>)
	{
		if ($body > 1)
		{
		   $length += length $_;
           push @result, $_;
		}
		elsif (!($_ =~ /[^\015\012]/))
        {
		    $body++;
		}
		else
		{
		    my $l = $_;
			if ($l =~ /^Location\: ?([^ \015\012]+)/)
			{
			  my $loc = $1;
			  if($loc =~ /\:/)
			  {
			     push @cgiheaders, $l;
				 $response{'header'} = 'HTTP/1.0 302 CGI relocation';
			  }
			  elsif($loc ne $fname)
			  {
			     $request = "GET ".$loc;
				 $writer->close;
				 $reader->close;
				 %response = ('header' => 'HTTP/1.0 400 Bad request', 'content' => 0);
				 goto handlerequest;
			  }
			}
            elsif($l =~ /^Status: ?([^ \015\012]+)/)
			{
				 $response{'header'} = 'HTTP/1.0 ' . $1;
			}
			else
			{
		      push @cgiheaders, $_;
			}
		}
	}
	$writer->close;
	$reader->close;

    output ($client, $response{'header'} . $CRLF);

	foreach (@cgiheaders)
	{
		output ($client, $_);
	}

	output ($client, "Content-Length:".$length.$CRLF.$CRLF);

	foreach (@result)
	{
		output ($client, $_);
	}
	output ($client, $CRLF);
  }
  else
  {
    respond ($client, \%response, \%headers);
  }

  $client->flush();
  shutdown ($client, 2);
}

# -----------------------------------------------------------

local *S;

socket     (S, PF_INET   , SOCK_STREAM , getprotobyname('tcp')) or die "couldn't open socket: $!";
setsockopt (S, SOL_SOCKET, SO_REUSEADDR, 1);
bind       (S, sockaddr_in($server_port, INADDR_ANY));
listen     (S, 5)                                               or die "don't hear anything:  $!";

my $ss = IO::Select->new();
$ss -> add (*S);

while(1) {
  my @connections_pending = $ss->can_read();
  foreach (@connections_pending) {
    my $fh;
    my $remote = accept($fh, $_);

    my($port,$iaddr) = sockaddr_in($remote);
    my $peeraddress = inet_ntoa($iaddr);

    my $t = threads->create(\&handle, $fh);
    $t->detach();
  }
}


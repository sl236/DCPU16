typedef unsigned int uint;

char test;

typedef struct test2_
{ 
	char x;
	uint y;
} test2;

struct test3
{
	test2 z;
};

test3 tvar;
typedef unsigned int uint;

char testv;
char *ptest;

typedef struct test2_
{ 
	char x;
	uint y;
	void * test;
} test2;

struct test3
{
	test2 z;
	test3 * w;
};

test3 tvar;

typedef void (*testfntype)(int a, uint b);
testfntype ptestfn;

void testfn( int a );

void testfn( int a )
{
}

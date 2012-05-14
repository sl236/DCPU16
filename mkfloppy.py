#!/usr/bin/python
import os
import sys

# ------------------------------
# configuration

SECTOR_SIZE = 512

# ------------------------------
# utility functions

def readfile(path):
	"""read a file and return the list of sectors"""
	with open(path,'rb') as fd:
		result = bytearray(fd.read())
	if (len(result) & (SECTOR_SIZE-1)) != 0:
		result = result + ( (SECTOR_SIZE-(len(result) & (SECTOR_SIZE-1))) * b'\x00' )
	return result			

def readshort( src, word_offset ):
	return (src[word_offset*2]<<8) | src[word_offset*2+1]

def writeshort( dest, word_offset, data ):
	dest[word_offset*2] = (data >> 8) & 0xFF
	dest[word_offset*2+1] = data & 0xFF

# ------------------------------
# check prerequisites

if not os.access('assemble', os.F_OK):
	print >> sys.stderr, 'command-line assembler not found!'
	sys.exit(-1)

if not os.access('bootsector.dasm16', os.F_OK):
	print >> sys.stderr, 'bootsector.dasm16 not found!'
	sys.exit(-1)

os.system('./assemble bootsector.dasm16 -Oxxd | xxd -r > bootsector.bin')

if not os.access('bootsector.bin', os.R_OK):
	print >> sys.stderr, 'bootsector.bin cannot be read!'
	sys.exit(-1)

# ------------------------------
# create initial filesystem

fs = readfile('bootsector.bin')
fs[SECTOR_SIZE-4] = b'M'
fs[SECTOR_SIZE-3] = b'o'
fs[SECTOR_SIZE-2] = b'o'
fs[SECTOR_SIZE-1] = b'n'

fs = fs + bytearray((SECTOR_SIZE * 2) * b'\0')	# root inode and bitmap
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

# ------------------------------
# check prerequisites

if not os.access('assemble', os.F_OK):
	print >> sys.stderr, 'command-line assembler not found!'
	sys.exit(-1)

if not os.access('bootsector.dasm16', os.F_OK):
	print >> sys.stderr, 'bootsector.dasm16 not found!'
	sys.exit(-1)

if not os.access('bootsector.bin', os.W_OK):
	print >> sys.stderr, 'bootsector.bin cannot be written!'
	sys.exit(-1)
	
os.system('./assemble bootsector.dasm16 -Oxxd | xxd -r > bootsector.bin')

if not os.access('bootsector.bin', os.R_OK):
	print >> sys.stderr, 'bootsector.bin cannot be read!'
	sys.exit(-1)

# ------------------------------
# create initial filesystem

bootsector = readfile('bootsector.bin')

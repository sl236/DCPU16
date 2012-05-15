#!/usr/bin/python
import os
import sys
import subprocess
import stat

# ------------------------------
# configuration

SECTOR_SIZE = 1024
SOURCE_DIR = 'floppy'
OUT_FILE = 'floppy.img'

# from defs.dasm16

direntry_cname =		0	# mangled: bits 0..14 are two chars in range 0..127; bits 15, 16 are bottom two bits of all other chars, xored together
direntry_inode =		7	# inode for this entry
direntry_cached_size =	8	# for directory listings, might be out of date
direntry_cached_flags =	9	# type is immutable so should be safe, other bits might be out of date
direntry_size =			10
direntry_cname_maxlength = 14

inode_type_mask		= ((1<<3)-1)
inode_type_free		= 0		# unused entry
inode_type_file		= 1
inode_type_dir		= 2
inode_flag_simple	= (1<<4)

inode_magic			= 0
inode_entity_flags	= 4
inode_entity_size	= 5
inode_refcount		= 6
inode_parent		= 7
inode_reserved_area	= 8
inode_header_size	= 12

# ------------------------------
# utility functions

def sector_align( x ):
	if (len(x) & (SECTOR_SIZE-1)) != 0:
		x += ( (SECTOR_SIZE-(len(x) & (SECTOR_SIZE-1))) * b'\x00' )
		
def adddirentry(fs, parent, child, name):
	hash = gethash( name )
	dataareasize = (SECTOR_SIZE/2)-inode_header_size
	maxentries = int(dataareasize / direntry_size)
	tgt = maxentries
	
	for entry in range(0, maxentries ):
		offset = parent*SECTOR_SIZE + (inode_header_size + ((entry + hash) % maxentries)) * 2
		if( fs[offset] == 0 ):
			tgt = ((entry + hash) % maxentries)
			break
	if( tgt == maxentries ):
		print >> sys.stderr, 'could not insert '+file+' at '+path+': directory full!'
		sys.exit(-1)
	
	tgt = parent*(SECTOR_SIZE/2) + inode_header_size + tgt
	
	writemangledname( fs, parent + tgt, name )
	writeshort(fs, parent + tgt + direntry_inode, len(fs)/SECTOR_SIZE )
	writeshort(fs, parent + tgt + direntry_cached_size, readshort( fs, child*(SECTOR_SIZE/2)+inode_entity_size ) )	
	writeshort(fs, parent + tgt + direntry_cached_flags, readshort( fs, child*(SECTOR_SIZE/2)+inode_entity_flags ) )
	writeshort(fs, parent*(SECTOR_SIZE/2) + inode_entity_size, readshort( fs, parent*(SECTOR_SIZE/2)+inode_entity_size ) + 1 )

def addfile(fs, name, path, parent):
	with open(path+'/'+name, 'rb') as fd:
		result = bytearray(fd.read())
	entity_size = int((len(result)+1)/2)
	inode = bytearray( (inode_header_size*2) * b'\x00' )
	
	writeshort(inode, inode_magic+0, 0x6c75)						# magic0
	writeshort(inode, inode_magic+1, 0x6e61)						# magic1
	writeshort(inode, inode_magic+2, 0xfe01)						# magic2
	writeshort(inode, inode_magic+3, 0x696e)						# magic3
	writeshort(inode, inode_entity_flags, inode_type_file)			# flags
	writeshort(inode, inode_entity_size, entity_size)				# entity size
	writeshort(inode, inode_refcount, 0x0001)						# refcount
	writeshort(inode, inode_parent, parent)							# parent
	writeshort(inode, inode_reserved_area+0, 0x0000)				# reserved
	writeshort(inode, inode_reserved_area+1, 0x0000)				# reserved
	writeshort(inode, inode_reserved_area+2, 0x0000)				# reserved
	writeshort(inode, inode_reserved_area+3, 0x0000)				# reserved
	
	child = len(fs)/SECTOR_SIZE				
	if(((entity_size-inode_header_size)*2) <= SECTOR_SIZE):
		inode += result
		sector_align(inode)
		writeshort(inode, 4, inode_type_file | inode_flag_simple )
	else:
		sector_align(inode)
		sector_align(result)
		for sector in range(0, len(result)/SECTOR_SIZE):
			writeshort( inode, inode_header_size+sector, child+sector+1 )
		inode += result
	fs += inode
	adddirentry(fs, parent, child, name)
	

def adddir(fs, name, path, parent):
	files = os.listdir(path+'/'+name)	
	entity_size = len(files)
	inode = bytearray( (inode_header_size*2) * b'\x00' )
	
	writeshort(inode, inode_magic+0, 0x6c75)									# magic0
	writeshort(inode, inode_magic+1, 0x6e61)									# magic1
	writeshort(inode, inode_magic+2, 0xfe02)									# magic2
	writeshort(inode, inode_magic+3, 0x696e)									# magic3
	writeshort(inode, inode_entity_flags, inode_type_dir | inode_flag_simple)	# flags
	writeshort(inode, inode_entity_size, entity_size)							# entity size
	writeshort(inode, inode_refcount, 0x0001)									# refcount
	writeshort(inode, inode_parent, parent)										# parent
	writeshort(inode, inode_reserved_area+0, 0x0000)							# reserved
	writeshort(inode, inode_reserved_area+1, 0x0000)							# reserved
	writeshort(inode, inode_reserved_area+2, 0x0000)							# reserved
	writeshort(inode, inode_reserved_area+3, 0x0000)							# reserved
	
	sector_align(inode)
	child = len(fs)/SECTOR_SIZE
	fs += inode
	for file in files:
		mode = os.stat(path+'/'+name+'/'+file).st_mode
		if stat.S_ISDIR(mode):
			adddir( fs, file, path + '/' + name, child )
		elif stat.S_ISREG(mode):
			addfile( fs, file, path + '/' + name, child )
		else:
			print >> sys.stderr, 'not sure how to deal with ' + path+'/'+name+'/'+file + ', skipping'
	adddirentry(fs, child, child, '.')
	adddirentry(fs, child, parent, '..')
			
def readshort( src, word_offset ):
	return (src[word_offset*2]<<8) | src[word_offset*2+1]

def writeshort( dest, word_offset, data ):
	dest[word_offset*2] = (data >> 8) & 0xFF
	dest[word_offset*2+1] = data & 0xFF

def gethash( data ):
	if(len(data) > direntry_cname_maxlength):
		print >> sys.stderr, data+': filename too long!'
	chars = [ord(c) for c in data]
	sum = 0
	for i in range(0, len(chars)):
		if( chars[i]>=0x80 ):
			print >> sys.stderr, data+': invalid character in filename!'
		sum ^= chars[i]
	return sum

def writemangledname( dest, word_offset, data ):
	if(len(data) > direntry_cname_maxlength):
		print >> sys.stderr, data+': filename too long!'
	chars = [ord(c) for c in data]
	if((len(chars) & 1)!=0):
		chars.append(0)
	sum = 0
	for i in range(0, len(chars)):
		sum ^= chars[i]
	for i in range(0, len(chars), 2):
		code = ((chars[i]&0x7f) << 7) | (chars[i+1]&0x7f)
		hash = ((sum ^ chars[i] ^ chars[i+1]) & 3)
		writeshort( dest, word_offset+(i/2), code|(hash<<14) )	
	
# ------------------------------
# check prerequisites

if not os.access('assemble', os.F_OK):
	print >> sys.stderr, 'command-line assembler not found!'
	sys.exit(-1)

if not os.access('bootsector.dasm16', os.F_OK):
	print >> sys.stderr, 'bootsector.dasm16 not found!'
	sys.exit(-1)

proc = subprocess.Popen(["./assemble bootsector.dasm16 -q -Oxxd | xxd -r"], stdout=subprocess.PIPE, shell=True)
(out, err) = proc.communicate()
fs = bytearray( out )
if( len(fs) == 0 ):
	print >> sys.stderr, 'failed to assemble boot sector.'
	sys.exit(-1)

sector_align(fs)
fs[SECTOR_SIZE-4] = b'M'
fs[SECTOR_SIZE-3] = b'o'
fs[SECTOR_SIZE-2] = b'o'
fs[SECTOR_SIZE-1] = b'n'

# ------------------------------
# create initial filesystem

fs += bytearray( SECTOR_SIZE * b'\x00' )	# volume bitmap / superblock
adddir( fs, '', SOURCE_DIR, 2 )

with open(OUT_FILE, 'wb') as fd:
	fd.write(fs)

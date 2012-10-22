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
#FLOPPY_SIZE = SECTOR_SIZE * 1440
FLOPPY_SIZE = SECTOR_SIZE * 180

# from defs.dasm16

direntry_cname =		0	# two chars per word
direntry_inode =		7	# inode for this entry
direntry_next =			8	# for directory listings
direntry_cached_flags =	9	# type is immutable so should be safe, other bits might be out of date
direntry_size =			10
direntry_cname_maxlength = 14

inode_type_mask			= ((1<<3)-1)
inode_type_free			= 0		# unused entry
inode_type_file			= 1
inode_type_dir			= 2
inode_type_superblock	= 7		# superblock record
inode_flag_simple		= (1<<4)

inode_magic				= 0
inode_entity_flags		= 4
inode_entity_size_high	= 5
inode_entity_size_low	= 6
inode_refcount			= 7
inode_parent			= 8
inode_reserved_area		= 9
inode_header_size		= 12

inode_direntry_first	= inode_reserved_area

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
		offset = parent*SECTOR_SIZE + (inode_header_size + ((entry + hash) % maxentries)*direntry_size) * 2
		if( fs[offset] == 0 ):
			tgt = ((entry + hash) % maxentries)
			break
	if( tgt == maxentries ):
		print >> sys.stderr, 'could not insert '+file+' at '+path+': directory full!'
		sys.exit(-1)
	
	print >> sys.stderr, ('{0:04x}'.format(child)) + ': ' + name + ' -> (' + '{0:04x}'.format(tgt*direntry_size) + '+' + '{0:04x}'.format(inode_header_size) + ') -> ' + '{0:04x}'.format((tgt*direntry_size)+inode_header_size) + '/' + ('{0:04x}'.format(parent))
	tgt = parent*(SECTOR_SIZE/2) + inode_header_size + (tgt * direntry_size)
		
	writestring(fs, tgt, name)
	writeshort(fs, tgt + direntry_inode, child )
	writeshort(fs, tgt + direntry_cached_flags, readshort( fs, child*(SECTOR_SIZE/2)+inode_entity_flags ) )
	writeshort(fs, tgt + direntry_next, readshort( fs, parent*(SECTOR_SIZE/2)+inode_direntry_first ) )
	writeshort(fs, parent*(SECTOR_SIZE/2) + inode_entity_size_low, readshort( fs, parent*(SECTOR_SIZE/2)+inode_entity_size_low ) + 1 )
	writeshort(fs, parent*(SECTOR_SIZE/2) + inode_direntry_first, child )

def addfile(fs, name, path, parent):
	with open(path+'/'+name, 'rb') as fd:
		result = bytearray(fd.read())
	entity_size = int((len(result)+1)/2)
	inode = bytearray( (inode_header_size*2) * b'\x00' )
	
	writeshort(inode, inode_magic+0, 0x6c75)						# magic0
	writeshort(inode, inode_magic+1, 0x6e61)						# magic1
	writeshort(inode, inode_magic+2, 0xfe00|inode_type_file)		# magic2
	writeshort(inode, inode_magic+3, 0x696e)						# magic3
	writeshort(inode, inode_entity_flags, inode_type_file)			# flags
	writeshort(inode, inode_entity_size_high, entity_size>>16)		# entity size
	writeshort(inode, inode_entity_size_low, entity_size&0xFFFF)	# 
	writeshort(inode, inode_refcount, 0x0001)						# refcount
	writeshort(inode, inode_parent, parent)							# parent
	writeshort(inode, inode_reserved_area+0, 0x0000)				# reserved
	writeshort(inode, inode_reserved_area+1, 0x0000)				# reserved
	writeshort(inode, inode_reserved_area+2, 0x0000)				# reserved
	
	child = len(fs)/SECTOR_SIZE				
	print >> sys.stderr, path+'/'+name + ': ' + ('{0:04x}'.format(child))
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
	cpath = path+'/'+name if(len(name)!=0) else path
	files = os.listdir(cpath)	
	entity_size = len(files)
	inode = bytearray( (inode_header_size*2) * b'\x00' )
	
	writeshort(inode, inode_magic+0, 0x6c75)									# magic0
	writeshort(inode, inode_magic+1, 0x6e61)									# magic1
	writeshort(inode, inode_magic+2, 0xfe00|inode_type_dir)						# magic2
	writeshort(inode, inode_magic+3, 0x696e)									# magic3
	writeshort(inode, inode_entity_flags, inode_type_dir | inode_flag_simple)	# flags
	writeshort(inode, inode_entity_size_high, 0)								# entity size
	writeshort(inode, inode_entity_size_low, entity_size)						# entity size
	writeshort(inode, inode_refcount, 0x0001)									# refcount
	writeshort(inode, inode_parent, parent)										# parent
	writeshort(inode, inode_reserved_area+0, 0x0000)							# reserved
	writeshort(inode, inode_reserved_area+1, 0x0000)							# reserved
	writeshort(inode, inode_reserved_area+2, 0x0000)							# reserved
	
	sector_align(inode)
	child = len(fs)/SECTOR_SIZE
	print >> sys.stderr, cpath + ': ' + ('{0:04x}'.format(child))
	fs += inode
	for file in files:
		mode = os.stat(cpath+'/'+file).st_mode
		if stat.S_ISDIR(mode):
			adddir( fs, file, cpath, child )
		elif stat.S_ISREG(mode):
			addfile( fs, file, cpath, child )
		else:
			print >> sys.stderr, 'not sure how to deal with ' + cpath+'/'+file + ', skipping'
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
	if( ( len(chars) & 1 ) != 0 ):
		chars.append(0)
	sum = 0
	for i in range(0, len(chars), 2):
		sum ^= ((chars[i]&0x7f)<<8)|(chars[i+1]&0x7f)
		print >> sys.stderr, data + '/ {0:02x}: {1:04x}'.format(i, sum)
	return sum

def writestring( dest, word_offset, data ):
	if(len(data) > direntry_cname_maxlength):
		print >> sys.stderr, data+': filename too long!'
	chars = [ord(c) for c in data]
	if((len(chars) & 1)!=0):
		chars.append(0)
	for i in range(0, len(chars), 2):
		code = ((chars[i]&0x7f) << 8) | (chars[i+1]&0x7f)
		#print >> sys.stderr, ('{0:04x}'.format(word_offset))+'/'+('{0:04x}'.format(word_offset+(i/2))) + ' -- ' + chr(chars[i])+chr(chars[i+1])+'/'+('{0:04x}'.format(word_offset+(code)))
		writeshort( dest, word_offset+(i/2), code )	
	
# ------------------------------
# check prerequisites

if not os.access('assemble', os.F_OK):
	print >> sys.stderr, 'command-line assembler not found!'
	sys.exit(-1)

if not os.access('bootsector.dasm16', os.F_OK):
	print >> sys.stderr, 'bootsector.dasm16 not found!'
	sys.exit(-1)

proc = subprocess.Popen(["./assemble bootsector.dasm16 -Oxxd | xxd -r"], stdout=subprocess.PIPE, shell=True)
(out, err) = proc.communicate()
fs = bytearray( out )
if( len(fs) == 0 ):
	print >> sys.stderr, 'failed to assemble boot sector.'
	sys.exit(-1)

sector_align(fs)
fs[SECTOR_SIZE-6] = b'm'
fs[SECTOR_SIZE-5] = b'o'
fs[SECTOR_SIZE-4] = b'o'
fs[SECTOR_SIZE-3] = b'n'
fs[SECTOR_SIZE-2] = b'f'
fs[SECTOR_SIZE-1] = b's'

# ------------------------------
# create initial filesystem

fs += bytearray( SECTOR_SIZE * b'\x00' )	# volume bitmap / superblock
adddir( fs, '', SOURCE_DIR, 2 )

# mark used blocks
usedsectors = int(len(fs)/SECTOR_SIZE)

for i in range( 0, usedsectors & ~7 ):
	fs[SECTOR_SIZE+(inode_header_size*2)+int(i/8)] = 0xFF

if (usedsectors&7) != 0:
	fs[SECTOR_SIZE+(inode_header_size*2)+int(usedsectors/8)] = ((1<<(usedsectors & 7))-1)<<(8-(usedsectors & 7))
	
# fill superblock structure
superblock = SECTOR_SIZE/2
writeshort(fs, superblock+inode_magic+0, 0x6c75)									# magic0
writeshort(fs, superblock+inode_magic+1, 0x6e61)									# magic1
writeshort(fs, superblock+inode_magic+2, 0xfe00|inode_type_superblock)				# magic2
writeshort(fs, superblock+inode_magic+3, 0x696e)									# magic3
writeshort(fs, superblock+inode_entity_flags, inode_type_superblock | inode_flag_simple)		# flags
writeshort(fs, superblock+inode_entity_size_high, ((FLOPPY_SIZE-len(fs))/SECTOR_SIZE)>>16)		# entity size for a superblock is the amount of free space on disk
writeshort(fs, superblock+inode_entity_size_low, ((FLOPPY_SIZE-len(fs))/SECTOR_SIZE)& 0xFFFF)	# entity size for a superblock is the amount of free space on disk
writeshort(fs, superblock+inode_refcount, 0x0001)									# refcount
writeshort(fs, superblock+inode_parent, 1)											# parent
writeshort(fs, superblock+inode_reserved_area+0, 0x0000)							# reserved
writeshort(fs, superblock+inode_reserved_area+1, 0x0000)							# reserved
writeshort(fs, superblock+inode_reserved_area+2, 0x0000)							# reserved

# pad to floppy size
if(len(fs)<FLOPPY_SIZE):
	fs += bytearray( (FLOPPY_SIZE-len(fs)) * b'\x00' )

# write out
with open(OUT_FILE, 'wb') as fd:
	fd.write(fs)

.DEFAULT_GOAL := all

kernel.dasm16 : MoonOS/*.dasm16

FLOPPY_DIR := floppy
FLOPPY_CONTENT := $(addprefix $(FLOPPY_DIR)/,kernel.image )

floppy.img: mkfloppy.py bootsector.dasm16 $(FLOPPY_CONTENT)
	./mkfloppy.py

$(FLOPPY_DIR)/%.image : %.dasm16 assemble *.js
	./assemble -Oxxd -q $< | xxd -r > $@
	
all: floppy.img.b64
     
$(FLOPPY_CONTENT): | $(FLOPPY_DIR)
     
$(FLOPPY_DIR):
	mkdir $(FLOPPY_DIR)
	
%.b64 : %
	base64 $< > $@
.DEFAULT_GOAL := all

FLOPPY_DIR := floppy
FLOPPY_CONTENT := $(addprefix $(FLOPPY_DIR)/,kernel.image )

floppy.img: mkfloppy.py bootsector.dasm16 $(FLOPPY_CONTENT)
	./mkfloppy.py

$(FLOPPY_DIR)/%.image : %.dasm16 assemble *.js
	./assemble -Oxxd -q $< | xxd -r > $@

%.dasm16.preprocessed : %.dasm16
	cpp $< > $@

%.xxd : %.dasm16.preprocessed 
	./assemble -Oxxd $< > $@

all: floppy.img.b64
     
$(FLOPPY_CONTENT): | $(FLOPPY_DIR)
     
$(FLOPPY_DIR):
	mkdir $(FLOPPY_DIR)
	
%.b64 : %
	base64 $< > $@

clean:
	rm $(FLOPPY_CONTENT) floppy.img floppy.img.b64

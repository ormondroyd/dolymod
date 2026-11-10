# Converts holes-are-bonds.html to rich text with macOS textutil, then sets an
# A4 page with 1.5 cm margins and starts the answers on a new page, which
# textutil can't do from HTML. Run from the repo root.
import pathlib
import subprocess

here = pathlib.Path(__file__).parent
rtf = here / 'holes-are-bonds.rtf'
subprocess.run(['textutil', '-convert', 'rtf', str(here / 'holes-are-bonds.html'), '-output', str(rtf)], check=True)
s = rtf.read_text()
s = s.replace('\\deftab720', '\\paperw11906\\paperh16838\\margl850\\margr850\\margt850\\margb850\n\\deftab720', 1)
assert s.count('Answers for teachers') == 1
s = s.replace('Answers for teachers', '\\page Answers for teachers')
rtf.write_text(s)

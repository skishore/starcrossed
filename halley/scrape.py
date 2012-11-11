#!/usr/bin/env python
from __future__ import with_statement
import datetime
import re
import subprocess

def filename_to_title(filename):
  assert('_' in filename), 'Expected a filename with underscores, got "%s"' % (filename,)
  title = filename.split('_')[0]
  return re.sub('[A-Z]', lambda x: ' ' + x.group(0), title).strip().lstrip()

def call(command):
  #print 'Calling "%s"' % (command,)
  return subprocess.Popen(command, stdout=subprocess.PIPE, shell=True).stdout.read()

def replace_unicode_apostrophes(filename):
  contents = open(filename).read()
  open(filename, 'w').write(contents.replace('\xe2??', "'"))

def scrape_wapo(target, date):
  call('rm *.bin; rm *.jpz; rm *.puz; rm temp')

  domain = 'http://www.sundaycrosswords.com/ccpuz'
  bin_file = call('curl %s/%s | grep -o "[^\\\"]*\\.bin"' % (domain, target))[:-1]
  assert(bin_file[-4:] == '.bin'), 'Got malformed .bin file: %s' % (bin_file,)
  jpz_file = '%s.jpz' % (bin_file[:-4],)
  puz_file = '%s.puz' % (bin_file[:-4],)

  call('curl %s/%s > %s' % (domain, bin_file, bin_file))
  call('unzip %s' % (bin_file,))

  # These .jpz files are missing a title and author. We to add them manually.
  # TODO: find the title on the page instead of doing this messy inference from the filename.
  title = date.strftime('%B %d, %Y - ') + filename_to_title(jpz_file)
  call('sed "s/<title><\\/title>/<title>%s<\\/title>/" %s > temp' % (title, jpz_file))
  call('mv temp %s' % (jpz_file,))
  call('sed "s/<creator><\\/creator>/<creator>Merl Reagle<\\/creator>/" %s > temp' % (jpz_file,))
  call('mv temp %s' % (jpz_file,))

  call('java -jar jpz2puz.jar %s' % (jpz_file,))
  replace_unicode_apostrophes(puz_file)
  call('mv %s ../puz_files/%s\ WaPo.puz' % (puz_file, date.isoformat()[:10]))
  call('rm *.bin; rm *.jpz; rm *.puz; rm temp')

if __name__ == '__main__':
  date_str = call('curl http://www.sundaycrosswords.com/ccpuz/MPuz.php | grep -o "For  puzzle of [0-9]\+/[0-9]\+/[0-9]\+"')
  assert(date_str and date_str[:15] == 'For  puzzle of '), 'Unexpected date "%s"' % (date_str,)
  date = datetime.datetime.strptime(date_str[15:-1], '%m/%d/%Y') + datetime.timedelta(days=7)
  scrape_wapo('MPuz.php', date)
  scrape_wapo('MPuz1WO.php', date + datetime.timedelta(days=-7))
  scrape_wapo('MPuz2WO.php', date + datetime.timedelta(days=-14))
  scrape_wapo('MPuz3WO.php', date + datetime.timedelta(days=-21))
